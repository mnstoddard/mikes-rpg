// Shared building blocks for Emberfall's Godot scenery.
//
// Every model is made from code with three.js, then exported as a .glb file
// that Godot imports directly. The look: bright, soft and stylized but
// lifelike. Shapes are smooth (not faceted), colours are baked into the
// vertices as soft gradients (darker low down and in the gaps, lighter on
// top), and leaves, grass and bark use small painted textures.
//
// Performance rules every model follows (lag in the open world matters):
//  - meshes that share a material are merged, so a model is 1 to 4 draw calls
//  - small textures (256 px, 512 px at most) shared inside a model
//  - foliage is a few smooth blobs plus leaf cards, not thousands of leaves
//  - a tree is about 1.5k to 3k triangles, a rock 300 to 1.3k, a plant under 400
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export { THREE };

// ---------- Random numbers you can repeat ----------

/** A seeded random number generator: the same seed always gives the same model. */
export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => Math.floor(a + (b - a + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.sign = () => (next() < 0.5 ? -1 : 1);
  return next;
}

function hash3(x, y, z, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 3D noise, 0..1. */
export function noise3(x, y, z, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz, seed);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), sx), L(c(0, 1, 0), c(1, 1, 0), sx), sy),
    L(L(c(0, 0, 1), c(1, 0, 1), sx), L(c(0, 1, 1), c(1, 1, 1), sx), sy),
    sz,
  );
}

/** Layered noise (fbm), roughly 0..1. */
export function fbm(x, y, z, seed = 0, oct = 3) {
  let a = 0.5, f = 1, t = 0, n = 0;
  for (let i = 0; i < oct; i++) { t += a * noise3(x * f, y * f, z * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; }
  return t / n;
}

// ---------- Colours ----------

export const col = (hex) => new THREE.Color(hex);
export function mix(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t))); }

/** Paint every vertex of a geometry with fn(position, normal) -> THREE.Color. */
export function paint(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const out = new Float32Array(p.count * 3);
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (n) nn.fromBufferAttribute(n, i); else nn.set(0, 1, 0);
    const c = fn(v, nn, i);
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(out, 3));
  return geo;
}

/** Paint a whole geometry one colour. */
export const tint = (geo, hex) => { const c = col(hex); return paint(geo, () => c); };

// ---------- Textures (painted on a canvas, small) ----------

const texCache = new Map();
function canvasTex(key, size, draw, { repeat = true, alpha = false } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.name = key;
  t.userData.alpha = alpha;
  texCache.set(key, t);
  return t;
}

const css = (c) => "#" + new THREE.Color(c).getHexString();

/** A cluster of leaves on a transparent card. shape: "broad" (oak, maple), "needle" (pine), "small" (birch, bushes). */
export function leafTexture(shape, colors, seed = 3) {
  return canvasTex(`leaf-${shape}-${colors.join()}-${seed}`, 256, (g, S) => {
    const r = rng(seed);
    g.clearRect(0, 0, S, S);
    const n = shape === "needle" ? 46 : shape === "small" ? 90 : 64;
    for (let i = 0; i < n; i++) {
      // leaves fill a soft round cluster, denser in the middle
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.38;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
      const shade = r();
      const base = new THREE.Color(colors[0]).lerp(new THREE.Color(colors[1]), shade);
      if (r() < 0.18 && colors[2]) base.lerp(new THREE.Color(colors[2]), 0.6);
      g.save();
      g.translate(x, y);
      g.rotate(a + Math.PI / 2 + r.range(-0.6, 0.6));
      if (shape === "needle") {
        // a little sprig of needles
        g.strokeStyle = css(base); g.lineWidth = 2.2; g.lineCap = "round";
        const L = r.range(30, 46);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L); g.stroke();
        for (let k = 4; k < L; k += 4) {
          g.beginPath(); g.moveTo(0, -k); g.lineTo(-9, -k + 7); g.moveTo(0, -k); g.lineTo(9, -k + 7); g.stroke();
        }
      } else {
        const w = shape === "small" ? r.range(6, 9) : r.range(11, 16);
        const h = shape === "small" ? r.range(11, 15) : r.range(20, 28);
        const grad = g.createLinearGradient(-w, 0, w, 0);
        grad.addColorStop(0, css(base.clone().multiplyScalar(0.82)));
        grad.addColorStop(0.5, css(base.clone().multiplyScalar(1.12)));
        grad.addColorStop(1, css(base));
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(w, -h * 0.25, w * 0.8, -h * 0.85, 0, -h);
        g.bezierCurveTo(-w * 0.8, -h * 0.85, -w, -h * 0.25, 0, 0);
        g.fill();
        g.strokeStyle = css(base.clone().multiplyScalar(0.7)); g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, -1); g.lineTo(0, -h * 0.9); g.stroke();
      }
      g.restore();
    }
  }, { repeat: false, alpha: true });
}

/** Grass blades on a transparent card. */
export function grassTexture(colors, seed = 5, flowers = null) {
  return canvasTex(`grass-${colors.join()}-${seed}-${flowers}`, 256, (g, S) => {
    const r = rng(seed);
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < 46; i++) {
      const x = r.range(S * 0.08, S * 0.92), h = r.range(S * 0.45, S * 0.96), lean = r.range(-30, 30), w = r.range(5, 9);
      const c1 = new THREE.Color(colors[0]), c2 = new THREE.Color(colors[1]).lerp(new THREE.Color(colors[0]), r() * 0.4);
      const grad = g.createLinearGradient(0, S, 0, S - h);
      grad.addColorStop(0, css(c1)); grad.addColorStop(1, css(c2));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - w / 2, S);
      g.quadraticCurveTo(x + lean * 0.3, S - h * 0.6, x + lean, S - h);
      g.quadraticCurveTo(x + lean * 0.3 + w * 0.2, S - h * 0.55, x + w / 2, S);
      g.fill();
    }
    if (flowers) {
      for (let i = 0; i < 7; i++) {
        const x = r.range(S * 0.15, S * 0.85), y = r.range(S * 0.1, S * 0.4);
        g.strokeStyle = css(colors[0]); g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, S); g.lineTo(x, y); g.stroke();
        const fc = r.pick(flowers);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.fillStyle = css(fc);
          g.beginPath(); g.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5.5, 3.5, a, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = "#ffd75e"; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
      }
    }
  }, { repeat: false, alpha: true });
}

/** Tiling bark: soft vertical ridges. */
export function barkTexture(base, dark, seed = 7, style = "ridged") {
  return canvasTex(`bark-${base}-${dark}-${seed}-${style}`, 256, (g, S) => {
    const r = rng(seed);
    g.fillStyle = css(base); g.fillRect(0, 0, S, S);
    if (style === "birch") {
      g.fillStyle = css(mix(base, 0xffffff, 0.35)); g.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) {
        const y = r() * S, x = r() * S, w = r.range(14, 50), h = r.range(2, 5);
        g.fillStyle = css(dark);
        g.globalAlpha = r.range(0.55, 0.95);
        g.fillRect(x, y, w, h); g.fillRect(x - S, y, w, h);
      }
      g.globalAlpha = 1;
      return;
    }
    for (let i = 0; i < 60; i++) {
      const x = r() * S, w = r.range(3, 9);
      g.strokeStyle = css(mix(dark, base, r() * 0.5));
      g.globalAlpha = r.range(0.35, 0.8);
      g.lineWidth = w;
      g.beginPath();
      let px = x;
      g.moveTo(px, -10);
      for (let y = 0; y <= S + 10; y += 16) { px += r.range(-3, 3); g.lineTo(px, y); }
      g.stroke();
      // wrap so the texture tiles
      g.save(); g.translate(px > S / 2 ? -S : S, 0); g.stroke(); g.restore();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 90; i++) {
      g.fillStyle = css(mix(base, 0xffffff, 0.25)); g.globalAlpha = 0.25;
      g.fillRect(r() * S, r() * S, r.range(1, 3), r.range(6, 18));
    }
    g.globalAlpha = 1;
  });
}

/** Tiling stone grain: soft speckles and a few cracks (tinted by vertex colour). */
export function stoneTexture(seed = 11) {
  return canvasTex(`stone-${seed}`, 256, (g, S) => {
    const r = rng(seed);
    g.fillStyle = "#d9d9d9"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const v = r.range(170, 250) | 0;
      g.fillStyle = `rgb(${v},${v},${v})`; g.globalAlpha = 0.5;
      const s = r.range(2, 7);
      const x = r() * S, y = r() * S;
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 0.35; g.strokeStyle = "#8a8a8a"; g.lineWidth = 1.3;
    for (let i = 0; i < 7; i++) {
      let x = r() * S, y = r() * S;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += r.range(-18, 18); y += r.range(-18, 18); g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}

/** Tiling wood planks running along U. */
export function plankTexture(base, seed = 13, rows = 4) {
  return canvasTex(`plank-${base}-${seed}-${rows}`, 256, (g, S) => {
    const r = rng(seed);
    const h = S / rows;
    for (let i = 0; i < rows; i++) {
      const c = mix(base, r() < 0.5 ? 0x000000 : 0xffffff, r.range(0.02, 0.12));
      g.fillStyle = css(c); g.fillRect(0, i * h, S, h);
      g.strokeStyle = css(mix(c, 0x000000, 0.18)); g.globalAlpha = 0.5; g.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const y = i * h + r.range(4, h - 4);
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= S; x += 32) g.lineTo(x, y + r.range(-1.5, 1.5));
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = css(mix(c, 0x000000, 0.45)); g.fillRect(0, i * h, S, 2);
      const seam = r() * S;
      g.fillRect(seam, i * h, 2, h);
    }
  });
}

/** Tiling stone blocks (walls). Light grey, tinted by vertex colour. */
export function brickTexture(seed = 17, rows = 4, cols = 3) {
  return canvasTex(`brick-${seed}-${rows}-${cols}`, 256, (g, S) => {
    const r = rng(seed);
    g.fillStyle = "#9a958c"; g.fillRect(0, 0, S, S);
    const h = S / rows, w = S / cols;
    for (let i = 0; i < rows; i++) {
      const off = (i % 2) * w / 2;
      for (let j = -1; j <= cols; j++) {
        const x = j * w + off, v = r.range(205, 245) | 0;
        g.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
        const rr = 6;
        g.beginPath();
        g.roundRect(x + 2.5, i * h + 2.5, w - 5, h - 5, rr);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x + 5, i * h + 4, w - 10, 3);
      }
    }
  });
}

/** Tiling roof tiles (rows of rounded shingles), tinted by vertex colour. */
export function roofTexture(seed = 19, kind = "tile") {
  return canvasTex(`roof-${seed}-${kind}`, 256, (g, S) => {
    const r = rng(seed);
    if (kind === "thatch") {
      g.fillStyle = "#c8b07a"; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 700; i++) {
        const x = r() * S, y = r() * S, v = r.range(150, 240) | 0;
        g.strokeStyle = `rgb(${v},${(v * 0.85) | 0},${(v * 0.55) | 0})`; g.lineWidth = r.range(1, 2.5);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + r.range(-3, 3), y + r.range(18, 40)); g.stroke();
      }
      for (let i = 0; i < 4; i++) { g.fillStyle = "rgba(60,40,10,0.25)"; g.fillRect(0, i * S / 4 + S / 4 - 4, S, 4); }
      return;
    }
    g.fillStyle = "#7a7a7a"; g.fillRect(0, 0, S, S);
    const rows = 6, cols = 6, h = S / rows, w = S / cols;
    for (let i = 0; i < rows; i++) {
      for (let j = -1; j <= cols; j++) {
        const x = j * w + (i % 2) * w / 2, v = r.range(200, 250) | 0;
        const grad = g.createLinearGradient(0, i * h, 0, i * h + h);
        grad.addColorStop(0, `rgb(${v - 40},${v - 40},${v - 40})`); grad.addColorStop(1, `rgb(${v},${v},${v})`);
        g.fillStyle = grad;
        g.beginPath(); g.roundRect(x + 1.5, i * h, w - 3, h - 2, [0, 0, w / 2.4, w / 2.4]); g.fill();
      }
    }
  });
}

/** Tiling plaster with soft blotches (house walls). */
export function plasterTexture(seed = 23) {
  return canvasTex(`plaster-${seed}`, 256, (g, S) => {
    const r = rng(seed);
    g.fillStyle = "#eeeeee"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {
      const v = r.range(215, 255) | 0;
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      g.beginPath(); g.arc(r() * S, r() * S, r.range(6, 22), 0, Math.PI * 2); g.fill();
    }
  });
}

// ---------- The shared texture library (godot/assets/textures) ----------
//
// Materials made with `lib: { name }` use the style guide's shared textures:
// <name>_albedo.png, _normal.png, _orm.png (and _emission.png for glowing ones).
// In the gallery the real images are embedded (small copies); when exporting,
// a tiny stand-in is used and export.mjs points the .glb at the real files in
// godot/assets/textures, so every model shares one copy of each texture.

const libCache = new Map();
/** One map of a library texture: kind is "albedo", "normal", "orm" or "emission". */
export function libTexture(name, kind) {
  const key = `${name}:${kind}`;
  if (libCache.has(key)) return libCache.get(key);
  const src = globalThis.EMBERFALL_LIBTEX?.[name]?.[kind];
  let t;
  if (src) {
    const img = new Image();
    t = new THREE.Texture(img);
    img.onload = () => { t.needsUpdate = true; };
    img.src = src;
  } else {
    const c = document.createElement("canvas");
    c.width = c.height = 4;
    const g = c.getContext("2d");
    g.fillStyle = kind === "normal" ? "#8080ff" : kind === "orm" ? "#ffd900" : "#ffffff";
    g.fillRect(0, 0, 4, 4);
    t = new THREE.CanvasTexture(c);
  }
  t.name = `lib:${name}:${kind}`;
  t.colorSpace = kind === "albedo" || kind === "emission" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  libCache.set(key, t);
  return t;
}

/** Which library textures have an emission map. */
export const LIB_EMISSION = new Set(["embers", "crystal"]);

// ---------- Materials ----------

const matCache = new Map();
/**
 * A soft matte material. Colour comes from the vertices (times `color`), with
 * an optional texture. Godot reads all of this from the .glb.
 */
export function mat(name, o = {}) {
  const key = name + JSON.stringify({ ...o, map: o.map?.name });
  if (matCache.has(key)) return matCache.get(key);
  if (o.lib) {
    // a library material: albedo, normal and ORM (AO, roughness, metallic) maps
    const L = o.lib;
    const orm = libTexture(L.name, "orm");
    const m = new THREE.MeshStandardMaterial({
      name,
      color: o.color ?? 0xffffff,
      vertexColors: o.vertexColors ?? true,
      map: libTexture(L.name, "albedo"),
      normalMap: libTexture(L.name, "normal"),
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: orm, metalnessMap: orm, aoMap: orm,
      roughness: 1, metalness: 1, aoMapIntensity: 0.6,
      side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: o.alphaTest ?? 0,
    });
    if (LIB_EMISSION.has(L.name)) { m.emissiveMap = libTexture(L.name, "emission"); m.emissive.set(0xffffff); m.emissiveIntensity = o.emissiveIntensity ?? 2; }
    else if (o.emissive) { m.emissive.set(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
    // vertex colours are painted against a base colour (`ref`); for a library
    // material they become a soft tint relative to it, times `tint`
    m.userData.ref = new THREE.Color(L.ref ?? 0xffffff);
    m.userData.tint = new THREE.Color(L.tint ?? 0xffffff);
    m.userData.lib = L.name;
    matCache.set(key, m);
    return m;
  }
  const m = new THREE.MeshStandardMaterial({
    name,
    color: o.color ?? 0xffffff,
    vertexColors: o.vertexColors ?? true,
    roughness: o.roughness ?? 0.85,
    metalness: o.metalness ?? 0,
    map: o.map ?? null,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    alphaTest: o.alphaTest ?? 0,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
  matCache.set(key, m);
  return m;
}

// ---------- Geometry helpers ----------

/** Make sure a geometry has position, normal, uv and colour so it can be merged. */
export function prep(geo) {
  if (geo.index) geo = geo.toNonIndexed();
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  if (!geo.attributes.color) tint(geo, 0xffffff);
  for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv", "color"].includes(k)) geo.deleteAttribute(k);
  geo.morphAttributes = {};
  return geo;
}

/**
 * Collects geometry by material, then merges it all into one mesh per
 * material: few draw calls, which keeps the world fast.
 */
export class Builder {
  constructor(name) { this.name = name; this.parts = new Map(); this.extra = []; }
  add(geo, material, matrix) {
    const g = prep(geo.clone());
    if (material.userData?.ref) {
      // turn painted colours into a tint over the library texture
      const c = g.attributes.color, ref = material.userData.ref, t = material.userData.tint;
      for (let i = 0; i < c.count; i++) {
        c.setXYZ(i,
          Math.min(1, (c.getX(i) / Math.max(0.05, ref.r)) * t.r),
          Math.min(1, (c.getY(i) / Math.max(0.05, ref.g)) * t.g),
          Math.min(1, (c.getZ(i) / Math.max(0.05, ref.b)) * t.b));
      }
    }
    if (matrix) g.applyMatrix4(matrix);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(g);
    return this;
  }
  /** Add at a position / rotation (Euler, radians) / scale. */
  put(geo, material, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...p),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
      new THREE.Vector3(...(typeof s === "number" ? [s, s, s] : s)),
    );
    return this.add(geo, material, m);
  }
  /** Keep a separate object (e.g. a light or a part that moves). */
  keep(obj) { this.extra.push(obj); return this; }
  build() {
    const group = new THREE.Group();
    group.name = this.name;
    let i = 0;
    for (const [material, geos] of this.parts) {
      // share identical vertices (smaller files, faster to draw)
      const merged = mergeVertices(mergeGeometries(geos, false), 1e-4);
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${this.name}_${material.name || "part"}${i ? "_" + i : ""}`;
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      i++;
    }
    for (const e of this.extra) group.add(e);
    return group;
  }
}

/** A smooth lumpy blob (rocks, foliage cores, bushes). Indexed so the normals are smooth. */
export function blob(radius, { detail = 3, lump = 0.25, freq = 1.6, seed = 1, squash = [1, 1, 1], flatBottom = null } = {}) {
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute("normal"); geo.deleteAttribute("uv");
  geo = mergeVertices(geo);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * freq + 10, v.y * freq + 20, v.z * freq + 30, seed, 3);
    const r = radius * (1 + (n - 0.5) * 2 * lump);
    v.multiplyScalar(r);
    v.x *= squash[0]; v.y *= squash[1]; v.z *= squash[2];
    if (flatBottom !== null && v.y < flatBottom) v.y = flatBottom + (v.y - flatBottom) * 0.08;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Box-projected UVs (for rocks and blobs), `scale` metres per texture repeat. */
export function boxUV(geo, scale = 1) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, w;
    if (ay >= ax && ay >= az) { u = x; w = z; } else if (ax >= az) { u = z; w = y; } else { u = x; w = y; }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = w / scale;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

/**
 * A tapered, bendy limb (trunks, branches, roots): rings of `sides` vertices
 * along a list of points, with a radius for each point. UVs wrap the bark
 * texture around it.
 */
export function limb(points, radii, { sides = 8, barkScale = 1, flare = 0, seed = 1 } = {}) {
  const rings = points.length;
  const pos = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  let prevN = null;
  let len = 0;
  for (let i = 0; i < rings; i++) {
    const p = points[i];
    const t = new THREE.Vector3().subVectors(points[Math.min(i + 1, rings - 1)], points[Math.max(i - 1, 0)]).normalize();
    // keep a stable frame along the limb
    let nrm = prevN ? prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t))).normalize() : new THREE.Vector3().crossVectors(t, Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize();
    prevN = nrm;
    const bin = new THREE.Vector3().crossVectors(t, nrm).normalize();
    if (i > 0) len += points[i].distanceTo(points[i - 1]);
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      let r = radii[i];
      if (flare && i === 0) r *= 1 + flare * (0.6 + 0.6 * Math.abs(Math.sin(a * 2.5 + seed)));
      if (flare && i === 1) r *= 1 + flare * 0.25 * (0.6 + 0.6 * Math.abs(Math.sin(a * 2.5 + seed)));
      const off = nrm.clone().multiplyScalar(Math.cos(a) * r).add(bin.clone().multiplyScalar(Math.sin(a) * r));
      pos.push(p.x + off.x, p.y + off.y, p.z + off.z);
      uv.push((s / sides) * Math.max(1, Math.round(radii[0] * 6.28 / barkScale)), len / barkScale);
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let s = 0; s < sides; s++) {
    const a = i * (sides + 1) + s, b = a + sides + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the seam column has duplicate vertices; average their normals so it is invisible
  const n = g.attributes.normal;
  for (let i = 0; i < rings; i++) {
    const a = i * (sides + 1), b = a + sides;
    const x = (n.getX(a) + n.getX(b)) / 2, y = (n.getY(a) + n.getY(b)) / 2, z = (n.getZ(a) + n.getZ(b)) / 2;
    n.setXYZ(a, x, y, z); n.setXYZ(b, x, y, z);
  }
  return g;
}

/** Points along a gently curving path from `start` in direction `dir`. */
export function curvePath(start, dir, length, segs, r, wobble = 0.15, droop = 0) {
  const pts = [start.clone()];
  const d = dir.clone().normalize();
  const step = length / segs;
  let p = start.clone();
  for (let i = 1; i <= segs; i++) {
    d.x += r.range(-wobble, wobble); d.z += r.range(-wobble, wobble); d.y += r.range(-wobble, wobble) * 0.5 - droop;
    d.normalize();
    p = p.clone().add(d.clone().multiplyScalar(step));
    pts.push(p);
  }
  return pts;
}

/**
 * Leaf cards scattered over the outside of a foliage blob. Each card faces
 * outward, and its normal points away from the canopy's middle, so light
 * wraps softly around the whole crown like a real tree.
 */
export function leafCards(center, radius, count, r, { size = 1, squash = [1, 1, 1], tilt = 0.6, minY = -0.4 } = {}) {
  const geos = [];
  const c = new THREE.Vector3(...center);
  for (let i = 0; i < count; i++) {
    // a random direction, kept mostly in the upper and side part of the crown
    const dir = new THREE.Vector3(r.range(-1, 1), r.range(minY, 1), r.range(-1, 1)).normalize();
    const pos = dir.clone().multiply(new THREE.Vector3(...squash)).multiplyScalar(radius * r.range(0.78, 1.02)).add(c);
    const s = size * r.range(0.8, 1.2);
    const pl = new THREE.PlaneGeometry(s, s);
    // face outward, with a random spin and a little tilt
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().add(new THREE.Vector3(r.range(-tilt, tilt), r.range(-tilt, tilt), r.range(-tilt, tilt))).normalize());
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() * Math.PI * 2);
    q.multiply(spin);
    pl.applyQuaternion(q);
    pl.translate(pos.x, pos.y, pos.z);
    // spherical normals for soft lighting
    const p = pl.attributes.position, n = pl.attributes.normal, v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k).sub(c).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    geos.push(pl);
  }
  return mergeGeometries(geos.map((g) => g.toNonIndexed()), false);
}

/** Vertex shade for foliage: darker inside and underneath, lighter on top. */
export function foliageShade(center, radius, top, bottom) {
  return (v) => {
    const h = (v.y - (center[1] - radius)) / (radius * 2);
    const d = Math.min(1, Math.hypot(v.x - center[0], v.y - center[1], v.z - center[2]) / radius);
    return mix(bottom, top, Math.max(0, Math.min(1, h * 0.8 + d * 0.35)));
  };
}

/** A lathe (turned) shape from [radius, height] pairs: pots, mushroom caps, barrels. */
export function lathe(profile, segs = 16) {
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segs);
  g.computeVertexNormals();
  return g;
}

/** A rounded box (soft edges look friendlier and catch the light). */
export function softBox(w, h, d, r = 0.04, seg = 2) {
  // a box whose corners are pushed in toward a rounded shape
  const g = new THREE.BoxGeometry(w, h, d, seg + 2, seg + 2, seg + 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    const dlt = v.clone().sub(c);
    if (dlt.lengthSq() > 0) { dlt.normalize().multiplyScalar(r); v.copy(c.add(dlt)); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute("normal");
  let m = mergeVertices(g.toNonIndexed().deleteAttribute("uv"));
  m.computeVertexNormals();
  return boxUV(m, Math.max(w, h, d));
}

/** Count triangles in an object (shown in the gallery). */
export function triCount(obj) {
  let t = 0;
  obj.traverse((o) => { if (o.isMesh) { const g = o.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  return Math.round(t);
}
export function drawCalls(obj) { let n = 0; obj.traverse((o) => { if (o.isMesh) n++; }); return n; }
