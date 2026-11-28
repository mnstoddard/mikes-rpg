// Trees: every tree in Emberfall (the woodcutting trees plus a dead tree).
// Each one is a trunk and branches (bark texture) with soft foliage clumps
// covered in leaf cards. The same seed always gives the same tree.
import { THREE, rng, Builder, limb, curvePath, blob, leafCards, leafTexture, barkTexture, mat, paint, mix, foliageShade, fbm } from "./lib.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Look for each species. Bark colours follow the style guide's wood palette.
export const SPECIES = {
  oak:       { name: "Oak",       bark: [0x9c7650, 0x5e4430], leaves: [0x4e9a3a, 0x8cc850, 0xb8e070], core: [0x3f8030, 0x6db33f], h: [6.5, 8], crown: 2.8, shape: "broad", branches: 6, spread: 1.35, thick: 1.6, low: 0.4 },
  maple:     { name: "Maple",     bark: [0x86604a, 0x4f3a2c], leaves: [0xd2552c, 0xf0943a, 0xffc35a], core: [0xa53a22, 0xd8743a], h: [6.5, 8], crown: 2.4, shape: "broad", branches: 5, spread: 0.8, thick: 1.25, tallCrown: 1.2 },
  birch:     { name: "Birch",     bark: [0xf1ebdc, 0x3a3530], leaves: [0x5fa83c, 0xa8d860, 0xd8ec8a], core: [0x4a8a30, 0x86c04a], h: [7, 9], crown: 1.7, shape: "small", branches: 4, spread: 0.6, barkStyle: "birch", thin: 0.7 },
  yew:       { name: "Yew",       bark: [0x8e4a33, 0x4e2418], leaves: [0x2b5e2c, 0x4f8a3e, 0x6ea24c], core: [0x1f4a22, 0x3d7334], h: [5, 6.5], crown: 2.5, shape: "needle", branches: 7, spread: 1.4, thick: 2.0, low: 0.35 },
  ironwood:  { name: "Ironwood",  bark: [0x7d8489, 0x464c52], leaves: [0x3c7a5a, 0x6aa884, 0x9fd0b0], core: [0x2b5e46, 0x4f8a6a], h: [9, 11], crown: 2.2, shape: "broad", branches: 6, spread: 0.45, thick: 1.5, tallCrown: 1.5 },
  elderwood: { name: "Elderwood", bark: [0x6e4f96, 0x3a2852], leaves: [0x8a62c8, 0xb894f0, 0xe0c8ff], core: [0x5a3e8e, 0x8a66c0], h: [7, 8.5], crown: 2.7, shape: "broad", branches: 6, spread: 1.2, thick: 1.5, glow: 0x7b4fbf },
  crownwood: { name: "Crownwood", bark: [0xb08a5a, 0x6a4e2e], leaves: [0xe0a83a, 0xf6d36a, 0xfff0a8], core: [0xb07a22, 0xe0aa3a], h: [8, 9.5], crown: 2.8, shape: "broad", branches: 6, spread: 1.0, thick: 1.5 },
};

// Which shared library bark each tree uses (elderwood keeps its own purple bark).
const LIB_BARK = { Oak: ["bark_oak"], Maple: ["bark_oak", 0xe8c8b8], Yew: ["bark_oak", 0xe0b0a0], Crownwood: ["bark_oak", 0xfff0d0], Ironwood: ["bark_oak", 0xb8c8d0], Birch: ["bark_birch"] };
function barkMat(sp, dead = false) {
  const l = dead ? ["bark_oak", 0xb8b4b0] : LIB_BARK[sp.name];
  if (l) return mat(`bark_${sp.name}${dead ? "_dead" : ""}`, { lib: { name: l[0], tint: l[1] ?? 0xffffff } });
  return mat(`bark_${sp.name}`, { map: barkTexture(sp.bark[0], sp.bark[1], 7, sp.barkStyle ?? "ridged"), roughness: 0.8 });
}
function coreMat(sp) {
  return mat(`foliage_${sp.name}`, { roughness: 0.7, ...(sp.glow ? { emissive: sp.glow, emissiveIntensity: 0.25 } : {}) });
}
function cardMat(sp, seed) {
  return mat(`leaves_${sp.name}`, { map: leafTexture(sp.shape, sp.leaves, seed), alphaTest: 0.5, double: true, roughness: 0.7, ...(sp.glow ? { emissive: sp.glow, emissiveIntensity: 0.3 } : {}) });
}

/** Paint bark: a little darker at the foot (soft AO), lighter up high. */
const barkPaint = (H) => (v) => mix(0xd8d2c8, 0xffffff, Math.min(1, 0.5 + v.y / (H * 0.5)));

/** A broadleaf tree: oak, maple, birch, ironwood, elderwood, crownwood. */
function broadleaf(sp, seed, { dead = false } = {}) {
  const r = rng(seed);
  const b = new Builder(`tree_${sp.name.toLowerCase()}`);
  const H = r.range(...sp.h);
  const thick = sp.thick ?? 1, thin = sp.thin ?? 1;
  const baseR = 0.28 * thick * thin;
  const bm = barkMat(sp, dead), cm = coreMat(sp), lm = cardMat(sp, seed % 5);

  // trunk: leans a little, tapers, flares at the roots
  const trunkLen = H * 0.62;
  const trunk = curvePath(V(0, -0.15, 0), V(r.range(-0.1, 0.1), 1, r.range(-0.1, 0.1)), trunkLen, 7, r, 0.05);
  const tr = trunk.map((_, i) => baseR * (1 - (i / trunk.length) * 0.55));
  b.add(paint(limb(trunk, tr, { sides: 10, flare: 0.55, seed, barkScale: 1.2 }), barkPaint(H)), bm);

  // main branches from the top half of the trunk
  const tips = [];
  const nb = sp.branches + r.int(-1, 1);
  for (let i = 0; i < nb; i++) {
    const at = Math.floor(trunk.length * r.range(sp.low ?? 0.5, 0.92));
    const start = trunk[Math.min(at, trunk.length - 1)].clone();
    const a = (i / nb) * Math.PI * 2 + r.range(-0.4, 0.4);
    const out = sp.spread * r.range(0.7, 1.1);
    const dir = V(Math.cos(a) * out, r.range(0.7, 1.1), Math.sin(a) * out);
    const len = H * r.range(0.28, 0.4);
    const pts = curvePath(start, dir, len, 4, r, 0.12);
    const br = baseR * r.range(0.42, 0.58);
    b.add(paint(limb(pts, pts.map((_, k) => br * (1 - (k / pts.length) * 0.7)), { sides: 6, barkScale: 1.2 }), barkPaint(H)), bm);
    tips.push(pts[pts.length - 1]);
    // a twig or two off each branch
    if (!dead || r() < 0.7) {
      const mid = pts[2];
      const tw = curvePath(mid, V(dir.x * 1.2 + r.range(-0.5, 0.5), 0.8, dir.z * 1.2 + r.range(-0.5, 0.5)), len * 0.45, 2, r, 0.2);
      b.add(paint(limb(tw, tw.map((_, k) => br * 0.45 * (1 - k / tw.length * 0.7)), { sides: 5 }), barkPaint(H)), bm);
      tips.push(tw[tw.length - 1]);
    }
  }
  const top = trunk[trunk.length - 1];
  tips.push(top.clone().add(V(0, H * 0.12, 0)));

  if (dead) {
    // just a few dry leaves clinging on
    const dl = mat("leaves_dry", { map: leafTexture(sp.shape, [0x8a7048, 0xb8955a, 0x6a5a40], 2), alphaTest: 0.5, double: true });
    for (const t of tips.slice(0, 3)) b.add(paint(leafCards([t.x, t.y, t.z], 0.5, 3, r, { size: 0.8 }), () => mix(0xffffff, 0xffffff, 0)), dl);
    return b.build();
  }

  // the crown: a soft clump at each branch tip, plus one in the middle
  const R = sp.crown;
  const tc = sp.tallCrown ?? 1;
  const clumps = tips.map((t) => ({ c: [t.x, t.y + R * 0.15, t.z], r: R * r.range(0.45, 0.62) }));
  if (tc > 1) for (let i = 0; i < 2; i++) clumps.push({ c: [top.x + r.range(-0.4, 0.4), top.y + R * (0.6 + i * 0.7) * tc, top.z + r.range(-0.4, 0.4)], r: R * r.range(0.5, 0.6) });
  clumps.push({ c: [top.x, top.y + R * 0.35, top.z], r: R * 0.7 });
  const crownC = [top.x, top.y + R * 0.3, top.z];
  for (const k of clumps) {
    const g = blob(k.r * 0.8, { detail: 2, lump: 0.22, seed: seed + k.c[0] * 10 | 0, squash: [1, 0.82, 1] });
    g.translate(...k.c);
    b.add(paint(g, foliageShade(crownC, R * 1.3, sp.core[1], sp.core[0])), cm);
    const cards = leafCards(k.c, k.r * 0.95, Math.round(40 * (k.r / (R * 0.55)) ** 2), r, { size: R * 0.78, squash: [1, 0.85, 1], minY: -0.6 });
    b.add(paint(cards, foliageShade(crownC, R * 1.3, 0xffffff, 0x9aa890)), lm);
  }
  return b.build();
}

/** Pine: a straight trunk with layered skirts of needles. Variants: classic, tall, snowy. */
function pine(seed, variant = 0) {
  const r = rng(seed);
  const b = new Builder("tree_pine");
  const H = r.range(8, 10) * (variant === 1 ? 1.3 : 1);
  const bm = mat("bark_pine", { lib: { name: "bark_pine" } });
  const nm = mat("foliage_Pine", { roughness: 0.75 });
  const lm = mat("needles_Pine", { map: leafTexture("needle", [0x3a7a40, 0x6aa850, 0x9ccc6a], 4), alphaTest: 0.5, double: true, roughness: 0.75 });
  const sm = mat("snow", { roughness: 0.6 });

  const trunk = curvePath(V(0, -0.15, 0), V(0, 1, 0), H * 0.92, 6, r, 0.02);
  b.add(paint(limb(trunk, trunk.map((_, i) => 0.3 * (1 - i / trunk.length * 0.8)), { sides: 9, flare: 0.5, seed }), barkPaint(H)), bm);

  const tiers = variant === 1 ? 6 : 5;
  const base = H * 0.22, topY = H * 1.02;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1);
    const y = base + (topY - base) * f * 0.86;
    const rad = (variant === 1 ? 1.9 : 2.6) * (1 - f * 0.78) + 0.25;
    const ht = (topY - base) / tiers * 1.55;
    // a lumpy, drooping cone skirt
    const g = new THREE.ConeGeometry(rad, ht, 22, 5, true);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const a = Math.atan2(v.z, v.x);
      const edge = (0.5 - v.y / ht); // 1 at the rim
      const wob = 1 + (fbm(Math.cos(a) * 2 + t, Math.sin(a) * 2, t * 3, seed, 2) - 0.5) * 0.5 * edge;
      v.x *= wob; v.z *= wob;
      v.y -= edge * edge * 0.35 * rad * (0.6 + 0.4 * Math.sin(a * 5 + t)); // the rim droops in scallops
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    g.translate(0, y + ht / 2, 0);
    const snowy = variant === 2;
    b.add(paint(g, (vv, n) => {
      const c = mix(0x2f6a34, 0x5c9a4a, (vv.y - y) / ht + 0.15);
      return snowy && n.y > 0.35 ? mix(c, 0xf4f8ff, Math.min(1, (n.y - 0.35) * 2.2)) : c;
    }), snowy ? sm : nm);
    // needle sprigs around the rim
    const cards = [];
    const n = Math.round(14 + rad * 12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r.range(-0.25, 0.25);
      const f2 = r.range(0.45, 1.0); // from part-way up the skirt out to the rim
      const cr = rad * f2;
      const cy = y + ht * (1 - f2) * 0.95 - 0.1;
      cards.push(leafCards([Math.cos(a) * cr * 0.9, cy, Math.sin(a) * cr * 0.9], 0.12, 1, r, { size: Math.max(0.7, rad * 0.6), tilt: 0.5, minY: -0.2 }));
    }
    for (const c of cards) b.add(paint(c, () => mix(0xffffff, 0xffffff, 0)), lm);
  }
  return b.build();
}

/** Yew: short, wide and dark, with a thick twisted trunk. */
function yew(seed) {
  return broadleaf(SPECIES.yew, seed);
}

export const TREES = [
  { id: "tree_oak", name: "Oak", group: "Trees", variants: ["Round"], make: (s) => broadleaf(SPECIES.oak, s), note: "Woodcutting 5. Wide crown on a stout, flared trunk." },
  { id: "tree_pine", name: "Pine", group: "Trees", variants: ["Classic", "Tall", "Snowy"], make: (s, v) => pine(s, v), note: "Woodcutting 1. Layered skirts of needles; Snowy for Frostfell." },
  { id: "tree_birch", name: "Birch", group: "Trees", variants: ["Single"], make: (s) => broadleaf(SPECIES.birch, s), note: "Woodcutting 10. White papery bark, light airy leaves." },
  { id: "tree_maple", name: "Maple", group: "Trees", variants: ["Red"], make: (s) => broadleaf(SPECIES.maple, s), note: "Woodcutting 20. Thornwood. Warm red and orange crown." },
  { id: "tree_yew", name: "Yew", group: "Trees", variants: ["Old"], make: (s) => yew(s), note: "Woodcutting 35. Thornwood. Dark needles, broad and low." },
  { id: "tree_ironwood", name: "Ironwood", group: "Trees", variants: ["Steel"], make: (s) => broadleaf(SPECIES.ironwood, s), note: "Woodcutting 50. The Tangle. Grey metal-sheen bark, blue-green leaves." },
  { id: "tree_elderwood", name: "Elderwood", group: "Trees", variants: ["Violet"], make: (s) => broadleaf(SPECIES.elderwood, s), note: "Woodcutting 70. Deep Thornwood. Purple bark and leaves with a soft glow." },
  { id: "tree_crownwood", name: "Crownwood", group: "Trees", variants: ["Gilded"], make: (s) => broadleaf(SPECIES.crownwood, s), note: "Planned for the Sundered Crown. Golden leaves." },
  { id: "tree_dead", name: "Dead tree", group: "Trees", variants: ["Oak"], make: (s) => broadleaf({ ...SPECIES.oak, bark: [0x8a8078, 0x4e4842] }, s, { dead: true }), note: "Bare grey branches, for blighted places and the shrines." },
];
