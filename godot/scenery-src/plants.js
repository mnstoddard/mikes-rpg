// Plants: grass, flowers, bushes, ferns, mushrooms and reeds. These are the
// things scattered by the thousand, so each one is tiny: crossed cards for
// grass and flowers, one soft clump plus a few cards for bushes.
import { THREE, rng, Builder, blob, leafCards, leafTexture, grassTexture, mat, paint, mix, lathe, foliageShade } from "./lib.js";

const P = { light: 0x9bd35a, grass: 0x6db33f, deep: 0x3f8a2e, pink: 0xf28ab2, yellow: 0xffd75a, blue: 0x7fb8f0, white: 0xf6f3ea };

/** Crossed vertical cards (the usual way to draw grass cheaply). */
function crossCards(w, h, n = 3, r) {
  const geos = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);
    g.rotateY((i / n) * Math.PI + r.range(-0.2, 0.2));
    // normals point up and out, so grass lights like the ground under it
    const nn = g.attributes.normal, p = g.attributes.position;
    for (let k = 0; k < nn.count; k++) { const v = new THREE.Vector3(p.getX(k) * 0.3, 1, p.getZ(k) * 0.3).normalize(); nn.setXYZ(k, v.x, v.y, v.z); }
    geos.push(g);
  }
  return geos;
}

/** Grass shading: darker at the root (AO), lighter at the tip. */
const rootShade = (h) => (v) => mix(0xb4c0aa, 0xffffff, Math.min(1, v.y / h + 0.2));

function grass(seed, variant) {
  const r = rng(seed);
  const tall = variant === 1;
  const b = new Builder(tall ? "grass_tall" : "grass_tuft");
  const gm = mat(tall ? "grass_tall" : "grass", { lib: { name: "grass_blades", tint: tall ? 0xf0f0c8 : 0xffffff }, alphaTest: 0.5, double: true });
  const clumps = tall ? 3 : 2;
  for (let c = 0; c < clumps; c++) {
    const h = tall ? r.range(0.9, 1.3) : r.range(0.35, 0.5);
    for (const g of crossCards(h * 1.1, h, 3, r)) {
      g.translate(r.range(-0.25, 0.25), 0, r.range(-0.25, 0.25));
      b.add(paint(g, rootShade(h)), gm);
    }
  }
  return b.build();
}

function flowers(seed, variant) {
  const r = rng(seed);
  const colors = [[P.pink, P.white], [P.yellow, 0xffa94a], [P.blue, 0xb49af0], [P.pink, P.yellow, P.blue, P.white]][variant];
  const b = new Builder("flowers");
  const gm = mat(`flowers_${variant}`, { map: grassTexture([P.grass, P.light], 8 + variant, colors), alphaTest: 0.5, double: true, roughness: 0.85 });
  for (let c = 0; c < 3; c++) {
    const h = r.range(0.4, 0.55);
    for (const g of crossCards(h * 1.1, h, 2, r)) {
      g.translate(r.range(-0.3, 0.3), 0, r.range(-0.3, 0.3));
      b.add(paint(g, rootShade(h)), gm);
    }
  }
  return b.build();
}

function bush(seed, variant) {
  const r = rng(seed);
  const b = new Builder(variant === 1 ? "bush_berry" : variant === 2 ? "bush_flowering" : "bush");
  const leaves = variant === 2 ? [0x3f8a2e, 0x7cc04a, 0xf4a6c6] : [0x3f8a2e, 0x7cc04a, 0xa7d86a];
  const cm = mat("bush_core", { roughness: 0.75 });
  const lm = mat(`bush_leaves_${variant}`, { map: leafTexture("small", leaves, 7 + variant), alphaTest: 0.5, double: true, roughness: 0.7 });
  const clumps = r.int(2, 3);
  const C = [0, 0.55, 0];
  for (let i = 0; i < clumps; i++) {
    const rad = r.range(0.45, 0.65);
    const c = [r.range(-0.35, 0.35), rad * 0.85, r.range(-0.35, 0.35)];
    const g = blob(rad * 0.75, { detail: 2, lump: 0.2, seed: seed + i, squash: [1.1, 0.85, 1.1] });
    g.translate(...c);
    b.add(paint(g, foliageShade(C, 0.9, 0x5f9f3a, 0x2f6e25)), cm);
    b.add(paint(leafCards(c, rad * 0.95, 34, r, { size: 0.6, minY: -0.3 }), foliageShade(C, 0.9, 0xffffff, 0xa0aa98)), lm);
  }
  if (variant === 1) {
    // berries: little shiny red balls on the outside
    const bm = mat("berries", { roughness: 0.3 });
    for (let i = 0; i < 18; i++) {
      const d = new THREE.Vector3(r.range(-1, 1), r.range(-0.1, 1), r.range(-1, 1)).normalize();
      const g = new THREE.IcosahedronGeometry(0.045, 1);
      g.translate(d.x * 0.62, 0.5 + d.y * 0.5, d.z * 0.62);
      b.add(paint(g, () => mix(0xc0283a, 0xe8485a, r())), bm);
    }
  }
  return b.build();
}

function fern(seed) {
  const r = rng(seed);
  const b = new Builder("fern");
  const fm = mat("fern", { roughness: 0.75, double: true });
  // fronds: long curved strips, wide in the middle, with a zig-zag edge for leaflets
  const n = r.int(7, 9);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.range(-0.2, 0.2);
    const L = r.range(0.6, 0.85), segs = 10;
    const pos = [], idx = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = Math.sin(t * Math.PI) * 0.13 * (s % 2 ? 0.75 : 1);
      const x = t * L, y = Math.sin(t * Math.PI * 0.8) * L * 0.55 - t * t * L * 0.25;
      pos.push(x, y, -w, x, y + 0.01, w);
      if (s < segs) { const k = s * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.rotateY(a);
    b.add(paint(g, (v) => mix(0x2f6e25, 0x8cc850, Math.min(1, Math.hypot(v.x, v.z) / L))), fm);
  }
  return b.build();
}

function mushrooms(seed, variant) {
  const r = rng(seed);
  const b = new Builder(variant === 0 ? "mushroom_redcap" : variant === 1 ? "mushroom_brown" : "mushroom_glow");
  const stemM = mat("mushroom_stem", { roughness: 0.8 });
  const capM = variant === 2 ? mat("mushroom_cap_glow", { roughness: 0.5, emissive: 0x6ad8ff, emissiveIntensity: 0.6 }) : mat("mushroom_cap", { roughness: 0.55 });
  const n = variant === 0 ? r.int(1, 3) : r.int(3, 5);
  for (let i = 0; i < n; i++) {
    const s = (i === 0 ? 1 : r.range(0.5, 0.8)) * (variant === 0 ? 0.32 : 0.18);
    const x = i === 0 ? 0 : r.range(-0.2, 0.2), z = i === 0 ? 0 : r.range(-0.2, 0.2);
    const stem = lathe([[0, 0], [s * 0.3, 0], [s * 0.24, s * 0.6], [s * 0.2, s * 1.0], [0, s * 1.0]], 10);
    stem.translate(x, 0, z);
    b.add(paint(stem, (v) => mix(0xcfc6b0, 0xf4eedc, v.y / s)), stemM);
    const cap = lathe([[0, s * 1.38], [s * 0.35, s * 1.33], [s * 0.6, s * 1.18], [s * 0.72, s * 0.98], [s * 0.6, s * 0.92], [s * 0.15, s * 0.95], [0, s * 0.95]], 14);
    cap.translate(x, 0, z);
    const capCol = [0xd8342e, 0x9a6a42, 0x6ad0f0][variant];
    b.add(paint(cap, (v, nrm) => {
      if (nrm.y < -0.2) return mix(0xe8dcc0, 0xffffff, 0.3); // gills
      // white spots on the red cap
      if (variant === 0) {
        const sx = Math.sin((v.x - x) * 38) * Math.sin((v.z - z) * 38) * Math.sin(v.y * 31);
        if (sx > 0.55) return new THREE.Color(0xfaf6ee);
      }
      return mix(capCol, mix(capCol, 0xffffff, 0.25), (v.y - s) / (s * 0.4));
    }), capM);
  }
  return b.build();
}

function reeds(seed) {
  const r = rng(seed);
  const b = new Builder("reeds");
  const rm = mat("reeds", { roughness: 0.8, double: true });
  for (let i = 0; i < 14; i++) {
    const h = r.range(1.0, 1.6);
    const x = r.range(-0.35, 0.35), z = r.range(-0.35, 0.35);
    const lean = [r.range(-0.15, 0.15), r.range(-0.15, 0.15)];
    const g = new THREE.CylinderGeometry(0.008, 0.016, h, 4, 3);
    g.translate(0, h / 2, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const t = p.getY(k) / h; p.setX(k, p.getX(k) + lean[0] * t * t); p.setZ(k, p.getZ(k) + lean[1] * t * t); }
    g.computeVertexNormals();
    g.translate(x, 0, z);
    b.add(paint(g, (v) => mix(0x4f7a30, 0xa8c060, v.y / h)), rm);
    if (i % 3 === 0) {
      // a cattail head
      const c = new THREE.CapsuleGeometry(0.03, 0.16, 3, 6);
      c.translate(x + lean[0], h - 0.12, z + lean[1]);
      b.add(paint(c, () => new THREE.Color(0x6a4428)), rm);
    }
  }
  return b.build();
}

function lilypads(seed) {
  const r = rng(seed);
  const b = new Builder("lilypads");
  const lm = mat("lilypad", { roughness: 0.5 });
  for (let i = 0; i < 5; i++) {
    const s = r.range(0.18, 0.32);
    const g = new THREE.CircleGeometry(s, 14, 0.3, Math.PI * 2 - 0.3);
    g.rotateX(-Math.PI / 2);
    g.translate(r.range(-0.6, 0.6), 0.01, r.range(-0.6, 0.6));
    b.add(paint(g, () => mix(0x3f8a2e, 0x7cc04a, r())), lm);
    if (i === 1) {
      const f = lathe([[0, 0], [0.04, 0.02], [0.09, 0.08], [0.06, 0.1], [0, 0.04]], 8);
      f.translate(g.boundingBox ? 0 : 0, 0, 0);
      const pos = g.attributes.position;
      f.translate(pos.getX(0), 0.02, pos.getZ(0));
      b.add(paint(f, () => new THREE.Color(0xf6b8d0)), lm);
    }
  }
  return b.build();
}

export const PLANTS = [
  { id: "plant_grass", name: "Grass", group: "Plants", variants: ["Tuft", "Tall"], make: (s, v) => grass(s, v), note: "Scattered by the thousand, so it's only crossed cards (about 12 triangles)." },
  { id: "plant_flowers", name: "Wildflowers", group: "Plants", variants: ["Pink", "Yellow", "Blue", "Mixed"], make: (s, v) => flowers(s, v), note: "Meadow flowers in the palette's pink, yellow and blue." },
  { id: "plant_bush", name: "Bush", group: "Plants", variants: ["Leafy", "Berry", "Flowering"], make: (s, v) => bush(s, v), note: "Soft clumps for hedgerows and the forest floor." },
  { id: "plant_fern", name: "Fern", group: "Plants", variants: ["Green"], make: (s) => fern(s), note: "For the Thornwood and shady spots." },
  { id: "plant_mushroom", name: "Mushrooms", group: "Plants", variants: ["Red cap", "Brown", "Glowing"], make: (s, v) => mushrooms(s, v), note: "Red caps and brown clusters to forage; glowing ones for caves and night." },
  { id: "plant_reeds", name: "Reeds", group: "Plants", variants: ["Cattails"], make: (s) => reeds(s), note: "For pond and river edges." },
  { id: "plant_lilypads", name: "Lily pads", group: "Plants", variants: ["Pads"], make: (s) => lilypads(s), note: "Floats on still water, with a pink flower." },
];
