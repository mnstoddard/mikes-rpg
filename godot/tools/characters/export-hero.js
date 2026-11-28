// Runs inside the Lifelike Heroes page. Builds a person (hero or NPC) from a recipe,
// dresses them, bakes every motion into glTF animation clips and returns a .glb.
(() => {
const X = window.__dbg, T = X.THREE;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// keep only the vertices a geometry's triangles use (partGeo copies the whole body)
function compact(g) {
  if (!g.index) return g;
  const idx = g.index.array, n = g.attributes.position.count, map = new Int32Array(n).fill(-1); let k = 0;
  for (let i = 0; i < idx.length; i++) if (map[idx[i]] < 0) map[idx[i]] = k++;
  if (k === n) return g;
  const out = new T.BufferGeometry();
  const pick = (a) => { const C = a.array.constructor, s = a.itemSize, arr = new C(k * s);
    for (let i = 0; i < n; i++) if (map[i] >= 0) for (let j = 0; j < s; j++) arr[map[i] * s + j] = a.array[i * s + j];
    return new T.BufferAttribute(arr, s, a.normalized); };
  for (const [name, a] of Object.entries(g.attributes)) out.setAttribute(name, pick(a));
  for (const [name, list] of Object.entries(g.morphAttributes)) out.morphAttributes[name] = list.map(pick);
  out.morphTargetsRelative = g.morphTargetsRelative;
  const ni = new Uint32Array(idx.length); for (let i = 0; i < idx.length; i++) ni[i] = map[idx[i]];
  out.setIndex(new T.BufferAttribute(ni, 1));
  return out;
}

// a garment cut from the close-fitting helper shell (or the body), pushed out along its normals
function cut(part, keep, clampP, push) {
  const P = part.pos, idx = part.idx, out = [];
  for (let i = 0; i < idx.length; i += 3) { const t = [idx[i], idx[i + 1], idx[i + 2]].map((a) => [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]]);
    if (keep(...t)) out.push(idx[i], idx[i + 1], idx[i + 2]); }
  let g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  g.setAttribute('skinIndex', new T.BufferAttribute(part.si, 4));
  g.setAttribute('skinWeight', new T.BufferAttribute(part.sw, 4, true));
  g.setIndex(out);
  g = compact(g);
  if (clampP) { const a = g.attributes.position, v = new T.Vector3(); for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i); clampP(v); a.setXYZ(i, v.x, v.y, v.z); } }
  g.computeVertexNormals();
  const a = g.attributes.position, nn = g.attributes.normal;
  for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) + nn.getX(i) * push, a.getY(i) + nn.getY(i) * push, a.getZ(i) + nn.getZ(i) * push);
  g.computeVertexNormals();
  return g;
}

// tiling UVs at 1 m per repeat: around the body (or each leg), and up
function wrapUV(g, crotch) {
  const a = g.attributes.position, uv = new Float32Array(a.count * 2);
  for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    const cx = y < crotch ? Math.sign(x) * 0.1 : 0, r = y < crotch ? 0.09 : 0.16;
    uv[i * 2] = Math.atan2(x - cx, z) * r * 3; uv[i * 2 + 1] = y * 3; } // about 3 repeats per metre
  g.setAttribute('uv', new T.BufferAttribute(uv, 2));
}

// a skirt or robe: a flared tube from the waist, following the legs as they move
function skirt(L, from, to, flare, bi) {
  const rings = 14, segs = 48, pos = [], si = [], sw = [], uv = [], ix = [];
  const hipW = L.hipW, hipD = L.hipD;
  for (let r = 0; r <= rings; r++) { const t = r / rings, y = from + (to - from) * t;
    const rad = 1 + flare * Math.pow(t, 1.3);
    for (let s = 0; s <= segs; s++) { const th = s / segs * Math.PI * 2, x = Math.sin(th) * hipW * rad, z = Math.cos(th) * hipD * rad + L.hipZ + 0.012 * t;
      pos.push(x, y, z); uv.push(s / segs * 2 * Math.PI * hipW * rad * 3, y * 3);
      const side = Math.max(0, Math.min(1, 0.5 + x / (hipW * rad) * 0.75)); // 1 = left leg (+x)
      const legW = smooth(0.05, 0.9, t) * 0.85, knee = smooth(0.55, 1, t) * 0.35 * legW;
      const wl = (legW - knee) * side, wr = (legW - knee) * (1 - side), kl = knee * side, kr = knee * (1 - side);
      si.push(bi.root, bi['upperleg01.L'], bi['upperleg01.R'], side > 0.5 ? bi['lowerleg01.L'] : bi['lowerleg01.R']);
      sw.push(1 - legW, wl, wr, side > 0.5 ? kl + kr : kl + kr); } }
  for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) { const a = r * (segs + 1) + s, b = a + segs + 1; ix.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
  g.setIndex(ix); g.computeVertexNormals();
  return g;
}

function hairTexture(color) { // the hair shader's root-to-tip shading, painted into a texture so any engine shows it
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'), img = x.createImageData(64, 64), base = new T.Color(color);
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const v = 1 - j / 63, u = i / 63;
    const k = (0.55 + (1.12 - 0.55) * smooth(0, 0.7, v)) * (0.92 + 0.08 * Math.sin(u * 18.85)), o = (j * 64 + i) * 4;
    img.data[o] = Math.min(255, base.clone().convertLinearToSRGB().r * k * 255); img.data[o + 1] = Math.min(255, base.clone().convertLinearToSRGB().g * k * 255); img.data[o + 2] = Math.min(255, base.clone().convertLinearToSRGB().b * k * 255); img.data[o + 3] = 255; }
  x.putImageData(img, 0, 0); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

const LOOP = new Set(['idle', 'walk', 'run', 'sneak', 'talk', 'look', 'block', 'shield', 'chop', 'mine', 'dig', 'smith', 'smelt', 'cook', 'alchemy', 'saw', 'enchant', 'sit', 'fish']);

window.__exportPerson = async function (job) {
  X.renderer.setAnimationLoop(null);
  await X.go({ state: { who: job.who, mode: 'create', tab: 'body', motion: 'idle' }, cfg: job.cfg, build: true, freeze: 0 });
  const h = X.hero();
  h.group.remove(X.props.held); h.group.remove(X.props.heldL);
  const D = X.morphed(await X.getData(job.who), X.state.cfg[job.who]);
  const bi = Object.fromEntries(D.bones.map((b, i) => [b.name, i]));
  const H = (n) => D.heads[bi[n]];
  const bones = h.skeleton.bones;

  // name what the page built, by its material
  const matName = new Map(Object.entries(h.mats).map(([k, m]) => [m, k]));
  const meshes = []; h.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const count = {};
  for (const m of meshes) {
    const k = matName.get(m.material) || 'part';
    const nice = { skin: 'Body', cloth: 'Undergarments', eye: 'Eye', lash: 'Lashes', hair: 'Hair', buzz: 'HairBuzz', beard: 'Beard' }[k] || k;
    count[nice] = (count[nice] || 0) + 1; m.name = count[nice] > 1 ? nice + count[nice] : nice;
    if (m.geometry.index) m.geometry = compact(m.geometry);
  }
  h.body.name = 'Body';
  // bake the shader-only looks into plain material settings
  for (const [k, m] of Object.entries(h.mats)) { m.name = k; m.onBeforeCompile = () => {};
    if (k === 'hair') { m.map = hairTexture(m.color); m.color = new T.Color(1, 1, 1); } }

  // clothes
  const L = { legTop: H('upperleg01.L')[1], knee: H('lowerleg01.L')[1], foot: H('foot.L')[1], waist: H('spine04')[1] + 0.03,
    neck: H('neck01')[1], shX: Math.abs(H('upperarm01.L')[0]), elX: Math.abs(H('lowerarm01.L')[0]), wrX: Math.abs(H('wrist.L')[0]), hipW: 0, hipD: 0, hipZ: 0 };
  { const P = D.parts.tights.pos; let mx = 0, mnz = 9, mxz = -9; for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - L.legTop) < 0.03) { mx = Math.max(mx, Math.abs(P[i])); mnz = Math.min(mnz, P[i + 2]); mxz = Math.max(mxz, P[i + 2]); }
    L.hipW = mx + 0.02; L.hipD = (mxz - mnz) / 2 + 0.03; L.hipZ = (mxz + mnz) / 2; }
  const crotch = L.legTop - 0.05;
  const tri3 = (f) => (a, b, c) => f(a) && f(b) && f(c);
  const any3 = (f) => (a, b, c) => f(a) || f(b) || f(c);
  const armR = (p) => Math.abs(p[0]); // arms hang out to the side: distance out from the middle
  const outfit = job.outfit || [];
  const made = [];
  for (const piece of outfit) {
    const mat = new T.MeshStandardMaterial({ color: piece.color, roughness: piece.rough ?? 0.9, metalness: 0, side: piece.double ? T.DoubleSide : T.FrontSide });
    if (piece.tex) { // the shared tileable cloth and leather textures from the style guide
      const ld = new T.TextureLoader(), base = 'tex/' + piece.tex + '/' + piece.tex;
      const TC = window.__texCache = window.__texCache || {};
      const [al, nm, orm] = TC[piece.tex] = TC[piece.tex] || await Promise.all(['_albedo', '_normal', '_orm'].map((s) => ld.loadAsync(base + s + '.png')));
      for (const t of [al, nm, orm]) { t.wrapS = t.wrapT = T.RepeatWrapping; } al.colorSpace = T.SRGBColorSpace; al.userData.mimeType = 'image/jpeg';
      Object.assign(mat, { map: al, normalMap: nm, aoMap: orm, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1 });
      mat.normalScale.set(0.8, 0.8); mat.color.set(piece.tint || '#ffffff'); }
    mat.name = piece.name; let g;
    if (piece.kind === 'shirt') { const sl = { none: L.shX * 1.02, short: (L.shX + L.elX) / 2, elbow: L.elX, long: L.wrX - 0.03 }[piece.sleeve || 'long'];
      const lo = piece.hem === 'thigh' ? L.legTop - 0.16 : L.waist - 0.06, hi = L.neck - (piece.neck ?? 0.035);
      const isVest = piece.sleeve === 'none';
      g = cut(D.parts.tights, any3((p) => p[1] > lo && p[1] < hi && armR(p) < sl && (!isVest || p[1] > lo)), (v) => { v.y = Math.max(lo, Math.min(hi, v.y)); }, piece.push ?? 0.008); }
    else if (piece.kind === 'trousers') { const lo = piece.length === 'knee' ? L.knee - 0.04 : L.foot + 0.1, hi = L.waist + 0.02;
      g = cut(D.parts.tights, any3((p) => p[1] > lo && p[1] < hi && armR(p) < L.shX), (v) => { v.y = Math.max(lo, Math.min(hi, v.y)); }, piece.push ?? 0.006); }
    else if (piece.kind === 'boots') { const hi = L.foot + (piece.height ?? 0.3);
      g = cut(D.parts.tights, any3((p) => p[1] < hi), (v) => { v.y = Math.min(hi, v.y); }, piece.push ?? 0.012); }
    else if (piece.kind === 'apron') { const lo = piece.lo ?? L.knee + 0.05, hi = piece.hi ?? L.neck - 0.17, w = piece.w ?? 0.17;
      g = cut(D.parts.tights, tri3((p) => p[1] > lo && p[1] < hi && Math.abs(p[0]) < w + 0.03 && p[2] > (p[1] < crotch ? 0.0 : 0.03)), (v) => { v.y = Math.max(lo, Math.min(hi, v.y)); v.x = Math.max(-w, Math.min(w, v.x)); }, piece.push ?? 0.022); }
    else if (piece.kind === 'skirt') { g = skirt(L, L.waist + 0.02, L.foot + (piece.hemUp ?? 0.08), piece.flare ?? 0.9, bi); }
    else if (piece.kind === 'belt') { const lo = L.waist - 0.03, hi = L.waist + 0.025;
      g = cut(D.parts.tights, any3((p) => p[1] > lo && p[1] < hi && armR(p) < L.shX), (v) => { v.y = Math.max(lo, Math.min(hi, v.y)); }, piece.push ?? 0.02); }
    if (!g.attributes.uv) wrapUV(g, crotch);
    const m = new T.SkinnedMesh(g, mat); m.name = piece.name; m.frustumCulled = false; h.group.add(m); m.bind(h.skeleton); made.push(m);
  }
  // Split the body into regions, so the parts under clothes can be hidden (no skin poking through, fewer triangles).
  // "Body" keeps the head, neck and hands (and the fist shapes); the rest become Body_<region>.
  const R = { torsoTop: L.neck - 0.065, waist: L.waist - 0.04, knee: L.knee, feet: L.foot + 0.11, shX: L.shX, elX: L.elX - 0.02, hand: L.wrX - 0.06 };
  const regionOf = (x, y) => { const ax = Math.abs(x);
    if (ax >= R.hand) return 'Body';
    if (y > R.waist && ax >= R.shX * 0.98 && y < R.torsoTop + 0.08) return ax < R.elX ? 'Body_UpperArms' : 'Body_Forearms';
    if (y > R.waist && y < R.torsoTop) return 'Body_Torso';
    if (y <= R.waist && y > R.knee) return 'Body_Thighs';
    if (y <= R.knee && y > R.feet) return 'Body_Shins';
    if (y <= R.feet) return 'Body_Feet';
    return 'Body'; };
  { const g = h.body.geometry, P = g.attributes.position, idx = g.index.array, buckets = {};
    for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      const r = regionOf((P.getX(a) + P.getX(b) + P.getX(c)) / 3, (P.getY(a) + P.getY(b) + P.getY(c)) / 3); (buckets[r] = buckets[r] || []).push(a, b, c); }
    for (const [r, list] of Object.entries(buckets)) {
      const sub = g.clone(); sub.setIndex(list); let cg = compact(sub);
      if (r === 'Body') { h.body.geometry = cg; continue; }
      cg.morphAttributes = {}; const m = new T.SkinnedMesh(cg, h.body.material); m.name = r; m.frustumCulled = false; h.group.add(m); m.bind(h.skeleton); } }
  const covers = (piece) => { const out = [];
    if (piece.kind === 'shirt' && (piece.neck ?? 0.035) <= 0.05) { out.push('Body_Torso'); if (piece.sleeve === 'long') out.push('Body_UpperArms', 'Body_Forearms'); if (piece.sleeve === 'elbow') out.push('Body_UpperArms'); }
    if (piece.kind === 'trousers') { out.push('Body_Thighs'); if (piece.length !== 'knee') out.push('Body_Shins'); }
    if (piece.kind === 'skirt') out.push('Body_Thighs', 'Body_Shins');
    if (piece.kind === 'boots' && (piece.height ?? 0.3) >= 0.12) out.push('Body_Feet');
    return out; };
  outfit.forEach((piece, i) => { made[i].userData.covers = covers(piece); });
  if (job.dropCovered) { const hide = new Set(made.flatMap((m) => m.userData.covers));
    for (const r of hide) { const m = h.group.children.find((o) => o.name === r); if (m) m.visible = false; } }
  for (const m of made) if (!m.userData.covers.length) delete m.userData.covers;

  if (job.hideUnder) meshes.filter((m) => m.name === 'Undergarments' || m.name === 'Undergarments2').forEach((m) => { if (job.hideUnder === 'all') m.visible = false; });

  // bake the motions
  const names = h.names, clips = [];
  for (const bn of bones) bn.name = bn.name.replace(/\./g, '_');
  const fps = 30;
  for (const m of X.MOTIONS) {
    if (job.motions && !job.motions.includes(m.id)) continue;
    const n = Math.max(2, Math.round(m.T * fps)), times = [], q = names.map(() => []), rp = [], mi = [];
    for (let i = 0; i <= n; i++) { const t = i / n * m.T; times.push(t); X.applyPose(h, m.f(t));
      names.forEach((nm, j) => { const b = h.B[nm].quaternion; q[j].push(b.x, b.y, b.z, b.w); });
      const p = h.B.root.position; rp.push(p.x, p.y, p.z);
      const inf = h.body.morphTargetInfluences || []; mi.push(...inf); }
    const tracks = names.map((nm, j) => new T.QuaternionKeyframeTrack(h.B[nm].name + '.quaternion', times, q[j]));
    tracks.push(new T.VectorKeyframeTrack(h.B.root.name + '.position', times, rp));
    if (h.body.morphTargetInfluences && h.body.morphTargetInfluences.length) tracks.push(new T.NumberKeyframeTrack('Body.morphTargetInfluences', times, mi));
    clips.push(new T.AnimationClip(LOOP.has(m.id) ? m.id + '_loop' : m.id, m.T, tracks));
  }
  // rest on the first idle frame
  X.applyPose(h, X.MOTIONS[0].f(0));
  h.group.name = job.name;
  h.group.updateMatrixWorld(true);
  let tris = 0; h.group.traverse((o) => { if (o.isMesh && o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  const ex = new window.GLTFExporter();
  const buf = await ex.parseAsync(h.group, { binary: true, animations: clips, onlyVisible: true });
  const u8 = new Uint8Array(buf); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return { b64: btoa(s), tris: Math.round(tris), clips: clips.length, parts: (() => { const o = []; h.group.traverse((m) => { if (m.isMesh && m.visible) o.push(m.name); }); return o; })() };
};
})();
