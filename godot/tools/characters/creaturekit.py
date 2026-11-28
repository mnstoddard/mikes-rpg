"""Creature kit: builds smooth, rounded creatures from soft shapes (signed distance fields),
paints them into textures, rigs them with bones and bakes their animations into a .glb.

Every creature is one smooth skin (the shapes melt into each other), plus separate eyes.
Units are metres, Y is up, the creature faces +Z, and its feet stand on y = 0."""
import io, json, math, struct
import numpy as np
from skimage.measure import marching_cubes
import fast_simplification, xatlas
from PIL import Image

# ---------------- shapes ----------------
def V(*a): return np.array(a, dtype=np.float64)

def smin(a, b, k):
    if k <= 0: return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)

class Ellipsoid:
    def __init__(s, c, r, bone, paint, k=0.03, rot=None):
        s.c, s.r, s.bone, s.paint, s.k = V(*c), V(*r), bone, paint, k
        s.R = np.eye(3) if rot is None else rot
    def sdf(s, p):
        q = (p - s.c) @ s.R  # into the shape's own axes
        k0 = np.linalg.norm(q / s.r, axis=-1); k1 = np.linalg.norm(q / (s.r * s.r), axis=-1)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-9)

class Cone:  # a rounded cone (capsule whose radius changes) from a to b
    def __init__(s, a, b, ra, rb, bone, paint, k=0.03):
        s.a, s.b, s.ra, s.rb, s.bone, s.paint, s.k = V(*a), V(*b), ra, rb, bone, paint, k
    def sdf(s, p):
        ba = s.b - s.a; t = np.clip(((p - s.a) @ ba) / (ba @ ba), 0, 1)
        return np.linalg.norm(p - (s.a + t[..., None] * ba), axis=-1) - (s.ra + (s.rb - s.ra) * t)

def rotY(a): c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rotX(a): c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def rotZ(a): c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def hexcol(h):
    h = h.lstrip('#'); c = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)  # to linear
def to_srgb(c):
    c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)

# smooth 3D value noise, for soft painted variation in the fur
def vnoise(p, scale, seed=0):
    q = p * scale; i = np.floor(q).astype(np.int64); f = q - i; f = f * f * (3 - 2 * f)
    def h(ix, iy, iz):
        n = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
        n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) & 0xffff) / 65535.0
    x, y, z = i[..., 0], i[..., 1], i[..., 2]; fx, fy, fz = f[..., 0], f[..., 1], f[..., 2]
    L = lambda a, b, t: a + (b - a) * t
    return L(L(L(h(x, y, z), h(x + 1, y, z), fx), L(h(x, y + 1, z), h(x + 1, y + 1, z), fx), fy),
             L(L(h(x, y, z + 1), h(x + 1, y, z + 1), fx), L(h(x, y + 1, z + 1), h(x + 1, y + 1, z + 1), fx), fy), fz)

# ---------------- the creature ----------------
class Creature:
    def __init__(s, name, bones, shapes, paints, eyes, anims, cell=0.008, tris=10000, tex=1024, rules=None, ground=True, glow=None, fur=0.08, scale=1.0):
        s.name, s.bones, s.shapes, s.paints, s.eyes, s.anims = name, bones, shapes, paints, eyes, anims
        s.cell, s.tris, s.tex, s.rules, s.ground, s.glow, s.fur, s.scale = cell, tris, tex, rules or [], ground, glow, fur, scale

    def sdf(s, p, each=False):
        ds = [sh.sdf(p) for sh in s.shapes]
        d = ds[0]
        for sh, di in zip(s.shapes[1:], ds[1:]): d = smin(d, di, sh.k)
        if s.ground: d = np.maximum(d, 0.004 - p[..., 1])  # flat soles
        return (d, ds) if each else d

    def paint(s, p, n):
        """colour, roughness and glow for points on the skin"""
        _, ds = s.sdf(p, each=True); D = np.stack(ds, -1)
        w = np.exp(-(D - D.min(-1, keepdims=True)) / 0.006); w /= w.sum(-1, keepdims=True)
        names = list(s.paints)
        col = np.zeros(p.shape[:-1] + (3,)); rough = np.zeros(p.shape[:-1]); glow = np.zeros(p.shape[:-1])
        for j, sh in enumerate(s.shapes):
            pc = s.paints[sh.paint]; col += w[..., j:j + 1] * hexcol(pc[0]); rough += w[..., j] * pc[1]
            if len(pc) > 2: glow += w[..., j] * pc[2]
        for name, fn in s.rules:
            m = np.clip(fn(p, n), 0, 1)[..., None]; pc = s.paints[name]
            col = col * (1 - m) + hexcol(pc[0]) * m; rough = rough * (1 - m[..., 0]) + pc[1] * m[..., 0]
            glow = glow * (1 - m[..., 0]) + (pc[2] if len(pc) > 2 else 0) * m[..., 0]
        if s.fur:  # soft clumps of lighter and darker fur
            v = vnoise(p, 38, 1) * 0.6 + vnoise(p, 90, 2) * 0.4
            col = col * (1 + s.fur * (v[..., None] - 0.5) * 2)
        return col, rough, glow

    def place_eyes(s):
        """each eye: from a point inside the head, look along 'dir' to the skin, then sink the eye a little into it"""
        for e in s.eyes:
            if 'dir' not in e: continue
            o = V(*e['from']); d = V(*e['dir']); d /= np.linalg.norm(d); t = 0.0
            for _ in range(2000):  # walk out from inside the head until we reach the skin
                dist = s.sdf(o[None] + d[None] * t)[0]
                if dist >= 0: break
                t += max(-dist * 0.8, 2e-4)
            p = o + d * t; n = s.grad(p[None])[0]
            look = n * (1 - e.get('forward', 0.35)) + V(0, 0, 1) * e.get('forward', 0.35); look /= np.linalg.norm(look)
            e['c'] = tuple(p - look * e['r'][2] * e.get('sink', 0.55))
            e['quat'] = quat_from_to(V(0, 0, 1), look)

    def build(s):
        s.place_eyes()
        P = np.array([[b[2][0], b[2][1], b[2][2]] for b in s.bones])
        lo = np.array([min(-0.05, 0) for _ in range(3)], dtype=float)
        # bounds from the shapes
        pts = []
        for sh in s.shapes:
            if isinstance(sh, Ellipsoid): m = sh.r.max(); pts += [sh.c - m, sh.c + m]
            else: m = max(sh.ra, sh.rb); pts += [np.minimum(sh.a, sh.b) - m, np.maximum(sh.a, sh.b) + m]
        pts = np.array(pts); lo = pts.min(0) - 0.04; hi = pts.max(0) + 0.04; lo[1] = max(lo[1], -0.02)
        c = s.cell; ax = [np.arange(lo[i], hi[i], c) for i in range(3)]
        G = np.stack(np.meshgrid(*ax, indexing='ij'), -1)
        d = s.sdf(G.reshape(-1, 3)).reshape(G.shape[:3])
        v, f, _, _ = marching_cubes(d, 0.0, spacing=(c, c, c)); v += lo
        if len(f) > s.tris: v, f = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), 1 - s.tris / len(f))
        v = v.astype(np.float64)
        # pull points back onto the true surface and take normals from the shape itself
        for _ in range(2):
            n = s.grad(v); v = v - n * s.sdf(v)[:, None]
        n = s.grad(v)
        s.v, s.f, s.n = v, f.astype(np.int64), n
        s.skin()
        s.unwrap_and_paint()

    def grad(s, p, e=1e-3):
        g = np.stack([s.sdf(p + V(*(e * (i == j) for j in range(3)))) - s.sdf(p - V(*(e * (i == j) for j in range(3)))) for i in range(3)], -1)
        return g / np.maximum(np.linalg.norm(g, axis=-1, keepdims=True), 1e-9)

    def skin(s):
        bn = [b[0] for b in s.bones]
        _, ds = s.sdf(s.v, each=True); W = np.zeros((len(s.v), len(bn)))
        for sh, di in zip(s.shapes, ds):
            # each shape pulls its points toward its bone; nearby shapes blend softly
            W[:, bn.index(sh.bone)] += np.exp(-np.maximum(di + 0.004, 0) / 0.012)
        if W.shape[1] < 4: W = np.concatenate([W, np.zeros((len(W), 4 - W.shape[1]))], 1)
        idx = np.argsort(-W, 1)[:, :4]; w = np.take_along_axis(W, idx, 1)
        w[w < 0.02 * w[:, :1]] = 0; w /= w.sum(1, keepdims=True); idx[w == 0] = 0
        s.joints, s.weights = idx.astype(np.uint16), w.astype(np.float32)

    def unwrap_and_paint(s):
        at = xatlas.Atlas(); at.add_mesh(s.v.astype(np.float32), s.f.astype(np.uint32))
        po = xatlas.PackOptions(); po.padding = 6; po.resolution = s.tex; po.bilinear = True
        at.generate(pack_options=po); vm, ind, uv = at[0]
        s.v, s.n, s.joints, s.weights, s.f, s.uv = s.v[vm], s.n[vm], s.joints[vm], s.weights[vm], ind.astype(np.int64), uv
        # AO from the shape itself: how open the space is just above each point
        s.ao = s.occlusion(s.v, s.n)
        N = s.tex; pos = np.zeros((N, N, 3)); nor = np.zeros((N, N, 3)); aot = np.ones((N, N)); mask = np.zeros((N, N), bool)
        UV = s.uv * (N - 1)
        for tri in s.f:
            a, b, c = UV[tri]
            x0, y0 = np.floor(np.minimum(np.minimum(a, b), c)).astype(int) - 1; x1, y1 = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int) + 1
            x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, N - 1), min(y1, N - 1)
            if x1 < x0 or y1 < y0: continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.0, np.arange(y0, y1 + 1) + 0.0)
            den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(den) < 1e-12: continue
            l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
            l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
            l3 = 1 - l1 - l2; m = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
            if not m.any(): continue
            L = np.stack([l1[m], l2[m], l3[m]], -1); L = np.clip(L, 0, None); L /= L.sum(-1, keepdims=True)
            yy, xx = ys[m].astype(int), xs[m].astype(int)
            pos[yy, xx] = L @ s.v[tri]; nor[yy, xx] = L @ s.n[tri]; aot[yy, xx] = L @ s.ao[tri]; mask[yy, xx] = True
        P = pos[mask]; Nn = nor[mask]; Nn /= np.maximum(np.linalg.norm(Nn, axis=-1, keepdims=True), 1e-9)
        col, rough, glow = s.paint(P, Nn)
        alb = np.zeros((N, N, 3)); alb[mask] = col
        orm = np.zeros((N, N, 3)); orm[..., 0] = 1; orm[..., 1] = 0.7
        orm[mask, 0] = aot[mask]; orm[mask, 1] = rough
        emi = np.zeros((N, N, 3)); emi[mask] = glow[:, None] * (hexcol(s.glow) if s.glow else 0)
        alb, orm, emi = [dilate(x, mask, 10) for x in (alb, orm, emi)]
        # glTF puts uv (0,0) at the top-left of the image
        s.img_albedo = Image.fromarray((to_srgb(alb) * 255).round().astype(np.uint8))
        s.img_orm = Image.fromarray((np.clip(orm, 0, 1) * 255).round().astype(np.uint8))
        s.img_emit = Image.fromarray((to_srgb(emi) * 255).round().astype(np.uint8)) if s.glow else None
        s.uv_gl = s.uv.copy(); s.uv_gl[:, 1] = s.uv[:, 1]  # rows were written with y = v, so v maps straight to the row

    def occlusion(s, p, n):
        ao = np.zeros(len(p)); sc = 1.0
        for i in range(1, 6):
            h = 0.012 * i; ao += sc * (h - s.sdf(p + n * h)); sc *= 0.6
        return np.clip(1 - 3.0 * ao, 0.35, 1)

def dilate(img, mask, it):
    img = img.copy(); m = mask.copy()
    for _ in range(it):
        acc = np.zeros_like(img); cnt = np.zeros(m.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sm = np.roll(m, (dy, dx), (0, 1)); si = np.roll(img, (dy, dx), (0, 1))
            acc[sm] += si[sm]; cnt[sm] += 1
        new = (~m) & (cnt > 0); img[new] = acc[new] / cnt[new][:, None]; m |= new
    return img

# ---------------- eyes ----------------
def eye_texture(iris, glow=False, N=256):
    y, x = np.mgrid[0:N, 0:N] / (N - 1) * 2 - 1; x = -x
    r = np.hypot(x, y * 1.0)
    base = hexcol('#1b1420') * np.ones((N, N, 3))
    ic = hexcol(iris); ring = np.clip((r - 0.35) / 0.4, 0, 1)
    col = base * (1 - np.clip(1 - r / 0.82, 0, 1)[..., None] * 0)
    t = np.clip(1 - (r - 0.0) / 0.78, 0, 1)
    col = base + (ic - base) * (np.clip((r - 0.3) / 0.5, 0, 1) ** 0.8)[..., None] * (r < 0.86)[..., None]
    col = np.where((r > 0.86)[..., None], hexcol('#120c10'), col)
    # lower glow, then two highlights
    low = np.clip(1 - np.hypot(x * 1.2, (y + 0.45) * 2.2) / 0.6, 0, 1) * 0.55
    col = col + (ic * 1.4 - col) * low[..., None]
    for cx, cy, rr in ((-0.32, 0.38, 0.2), (0.3, -0.18, 0.08)):
        h = np.clip(1 - np.hypot(x - cx, y - cy) / rr, 0, 1); col = col + (1 - col) * (np.clip(h * 3, 0, 1))[..., None]
    if glow: col = np.clip(col * 1.0 + ic * 0.5 * (r < 0.86)[..., None], 0, 1)
    return Image.fromarray((to_srgb(col) * 255).astype(np.uint8)[::-1])

def eye_mesh(seg=32, rings=16):
    v, n, uv, f = [], [], [], []
    for i in range(rings + 1):
        th = math.pi * i / rings
        for j in range(seg + 1):
            ph = 2 * math.pi * j / seg
            x, y, z = math.sin(th) * math.cos(ph), math.cos(th), math.sin(th) * math.sin(ph)
            v.append((x, y, z)); n.append((x, y, z)); uv.append((x * 0.5 + 0.5, 1 - (y * 0.5 + 0.5)) if z > 0 else (0.02, 0.02))
    for i in range(rings):
        for j in range(seg):
            a = i * (seg + 1) + j; b = a + seg + 1; f += [(a, a + 1, b), (b, a + 1, b + 1)]
    return np.array(v), np.array(n), np.array(uv), np.array(f)

# ---------------- animation helpers ----------------
def quat_euler(x, y, z):  # XYZ order
    cx, sx, cy, sy, cz, sz = math.cos(x / 2), math.sin(x / 2), math.cos(y / 2), math.sin(y / 2), math.cos(z / 2), math.sin(z / 2)
    return (sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz)

def quat_from_to(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); c = np.cross(a, b); w = 1 + a @ b
    if w < 1e-6: return (0, 1, 0, 0)
    q = np.array([c[0], c[1], c[2], w]); return tuple(q / np.linalg.norm(q))

# ---------------- glb writer ----------------
def write_glb(cr, path, eyes_img, fps=30):
    bn = [b[0] for b in cr.bones]; par = [bn.index(b[1]) if b[1] else -1 for b in cr.bones]
    K = cr.scale  # the whole creature is drawn at this size
    head = np.array([b[2] for b in cr.bones], dtype=np.float64) * K
    blob = bytearray(); views = []; accs = []
    def add(arr, target=None, comp=None, typ=None, minmax=False, norm=False):
        arr = np.ascontiguousarray(arr); off = len(blob); blob.extend(arr.tobytes())
        while len(blob) % 4: blob.append(0)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": arr.nbytes, **({"target": target} if target else {})})
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": int(arr.shape[0]), "type": typ}
        if norm: a["normalized"] = True
        if minmax: a["min"] = [float(x) for x in np.atleast_1d(arr.min(0))]; a["max"] = [float(x) for x in np.atleast_1d(arr.max(0))]
        accs.append(a); return len(accs) - 1
    def add_img(img):
        b = io.BytesIO(); img.save(b, 'PNG'); data = b.getvalue(); off = len(blob); blob.extend(data)
        while len(blob) % 4: blob.append(0)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data)}); return len(views) - 1
    F, VEC2, VEC3, VEC4, SCALAR, MAT4 = 5126, "VEC2", "VEC3", "VEC4", "SCALAR", "MAT4"
    images, textures, materials, meshes, nodes = [], [], [], [], []
    def tex(img):
        images.append({"bufferView": add_img(img), "mimeType": "image/png"}); textures.append({"source": len(images) - 1, "sampler": 0}); return len(textures) - 1
    t_alb, t_orm = tex(cr.img_albedo), tex(cr.img_orm)
    skin_mat = {"name": cr.name + "_skin", "pbrMetallicRoughness": {"baseColorTexture": {"index": t_alb}, "metallicRoughnessTexture": {"index": t_orm}, "metallicFactor": 0.0, "roughnessFactor": 1.0},
                "occlusionTexture": {"index": t_orm}}
    if cr.img_emit is not None: skin_mat["emissiveTexture"] = {"index": tex(cr.img_emit)}; skin_mat["emissiveFactor"] = [1, 1, 1]
    materials.append(skin_mat)
    t_eye = tex(eyes_img)
    materials.append({"name": cr.name + "_eye", "pbrMetallicRoughness": {"baseColorTexture": {"index": t_eye}, "metallicFactor": 0.0, "roughnessFactor": 0.08},
                      **({"emissiveTexture": {"index": t_eye}, "emissiveFactor": [0.6, 0.6, 0.6]} if cr.eyes and cr.eyes[0].get('glow') else {})})
    # body
    prim = {"attributes": {"POSITION": add((cr.v * K).astype(np.float32), 34962, F, VEC3, True), "NORMAL": add(cr.n.astype(np.float32), 34962, F, VEC3),
                           "TEXCOORD_0": add(cr.uv_gl.astype(np.float32), 34962, F, VEC2), "JOINTS_0": add(cr.joints.astype(np.uint16), 34962, 5123, VEC4),
                           "WEIGHTS_0": add(cr.weights.astype(np.float32), 34962, F, VEC4)},
            "indices": add(cr.f.astype(np.uint32).reshape(-1), 34963, 5125, SCALAR), "material": 0}
    meshes.append({"name": cr.name + "_body", "primitives": [prim]})
    ev, en, euv, ef = eye_mesh()
    meshes.append({"name": cr.name + "_eye", "primitives": [{"attributes": {"POSITION": add(ev.astype(np.float32), 34962, F, VEC3, True), "NORMAL": add(en.astype(np.float32), 34962, F, VEC3),
        "TEXCOORD_0": add(euv.astype(np.float32), 34962, F, VEC2)}, "indices": add(ef.astype(np.uint32).reshape(-1), 34963, 5125, SCALAR), "material": 1}]})
    # bones
    for i, b in enumerate(cr.bones):
        t = head[i] - (head[par[i]] if par[i] >= 0 else 0)
        nodes.append({"name": b[0], "translation": [float(x) for x in t]})
    for i in range(len(bn)):
        ch = [j for j in range(len(bn)) if par[j] == i]
        if ch: nodes[i]["children"] = ch
    for k, e in enumerate(cr.eyes):
        hb = bn.index(e['bone']); c = V(*e['c']) * K - head[hb]
        nodes.append({"name": f"Eye_{'LR'[k]}" if len(cr.eyes) == 2 else f"Eye_{k + 1}", "mesh": 1, "translation": [float(x) for x in c], "scale": [float(x) * K for x in e['r']],
                      "rotation": [float(x) for x in e['quat']] if 'quat' in e else list(quat_euler(e.get('pitch', 0), e.get('yaw', 0), e.get('roll', 0)))})
        nodes[hb].setdefault("children", []).append(len(nodes) - 1)
    ibm = np.zeros((len(bn), 4, 4), np.float32)
    for i in range(len(bn)): m = np.eye(4); m[:3, 3] = -head[i]; ibm[i] = m.T  # column-major
    skin = {"joints": list(range(len(bn))), "inverseBindMatrices": add(ibm.reshape(len(bn), 16), None, F, MAT4), "skeleton": 0}
    nodes.append({"name": cr.name + "_Body", "mesh": 0, "skin": 0}); body_node = len(nodes) - 1
    nodes.append({"name": cr.name, "children": [0, body_node]}); root = len(nodes) - 1
    # animations
    anims = []
    for aname, (T, fn) in cr.anims.items():
        n = max(2, int(round(T * fps))); times = np.linspace(0, T, n + 1).astype(np.float32)
        poses = [fn(t) for t in times]; ch, sm = [], []
        ti = add(times.reshape(-1, 1), None, F, SCALAR, True)
        used = set(); [used.update(k for k in p if not k.startswith('@')) for p in poses]
        for b in bn:
            if b not in used: continue
            q = np.array([quat_euler(*p.get(b, (0, 0, 0))) for p in poses], np.float32)
            sm.append({"input": ti, "output": add(q, None, F, VEC4), "interpolation": "LINEAR"}); ch.append({"sampler": len(sm) - 1, "target": {"node": bn.index(b), "path": "rotation"}})
        if any('@root' in p for p in poses):
            tr = np.array([head[0] + V(*p.get('@root', (0, 0, 0))) * K for p in poses], np.float32)
            sm.append({"input": ti, "output": add(tr, None, F, VEC3), "interpolation": "LINEAR"}); ch.append({"sampler": len(sm) - 1, "target": {"node": 0, "path": "translation"}})
        for key in [k for k in poses[0] if k.startswith('@scale:')]:
            b = key.split(':')[1]; sc = np.array([p[key] for p in poses], np.float32)
            sm.append({"input": ti, "output": add(sc, None, F, VEC3), "interpolation": "LINEAR"}); ch.append({"sampler": len(sm) - 1, "target": {"node": bn.index(b), "path": "scale"}})
        anims.append({"name": aname, "channels": ch, "samplers": sm})
    gl = {"asset": {"version": "2.0", "generator": "Emberfall creature kit"}, "scene": 0, "scenes": [{"name": cr.name, "nodes": [root]}],
          "nodes": nodes, "meshes": meshes, "skins": [skin], "materials": materials, "textures": textures, "images": images,
          "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}], "animations": anims,
          "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(blob)}]}
    js = json.dumps(gl, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
    open(path, 'wb').write(out)
    return len(cr.f), len(out)
