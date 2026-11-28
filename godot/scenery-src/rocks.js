// Rocks, boulders, cliffs and every ore node you can mine.
// A rock is a smooth, lumpy boulder (stone texture, a little moss on top);
// an ore node is a rock with metal nuggets, coal chunks or gem crystals in it.
import { THREE, rng, Builder, blob, boxUV, stoneTexture, mat, paint, mix, fbm } from "./lib.js";

const stoneMat = () => mat("rock", { lib: { name: "rock", ref: 0x9c9a94 } });

/** Rock paint: stone colour with soft colour patches, moss on the top, darker at the foot (AO). */
function rockPaint(base, seed, { moss = 0.5, mossCol = 0x6f9a3c } = {}) {
  return (v, n) => {
    const patch = fbm(v.x * 0.7, v.y * 0.7, v.z * 0.7, seed, 2);
    let c = mix(base, mix(base, 0xffffff, 0.25), patch);
    if (moss > 0) {
      const m = (n.y - (1 - moss)) * 3 + (fbm(v.x * 2, v.y * 2, v.z * 2, seed + 5, 2) - 0.5) * 1.5;
      if (m > 0) c = mix(c, mossCol, Math.min(1, m));
    }
    return mix(mix(c, 0x000000, 0.28), c, Math.min(1, 0.3 + v.y * 1.4)); // soft AO near the ground
  };
}

/** One boulder geometry (flat bottom, sunk slightly into the ground). */
function boulderGeo(size, seed, squash = [1.2, 0.75, 1], detail = 3) {
  const g = blob(size, { detail, lump: 0.28, freq: 1.3, seed, squash, flatBottom: -size * 0.15 });
  g.translate(0, size * 0.12, 0);
  return boxUV(g, 1.5);
}

const STONE = { granite: 0x9c9a94, slate: 0x6e7680, sandstone: 0xd2b58a, dark: 0x55585c, mossy: 0x7e8e68 };

function rock(seed, kind) {
  const r = rng(seed);
  const b = new Builder(`rock_${kind}`);
  const sm = stoneMat();
  if (kind === "boulder") {
    b.add(paint(boulderGeo(r.range(0.9, 1.2), seed), rockPaint(STONE.granite, seed, { moss: 0.45 })), sm);
  } else if (kind === "pebbles") {
    for (let i = 0; i < 6; i++) {
      const s = r.range(0.08, 0.22);
      const g = boulderGeo(s, seed + i, [1.3, 0.6, 1], 1);
      g.translate(r.range(-0.6, 0.6), 0, r.range(-0.6, 0.6));
      b.add(paint(g, rockPaint(STONE.granite, seed + i, { moss: 0 })), sm);
    }
  } else if (kind === "cluster") {
    for (let i = 0; i < 4; i++) {
      const s = i === 0 ? 0.75 : r.range(0.3, 0.5);
      const g = boulderGeo(s, seed + i * 7, [1.1, 0.85, 1], i === 0 ? 3 : 2);
      const a = r() * 6.28, d = i === 0 ? 0 : r.range(0.7, 1.0);
      g.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
      b.add(paint(g, rockPaint(STONE.granite, seed + i, { moss: 0.4 })), sm);
    }
  } else if (kind === "cliff") {
    // a tall layered outcrop, like a piece of hillside
    // chunky overlapping slabs: a wide base, a tall middle and a few ledges
    const slabs = [[0, 0, 0, 1.6, [1.5, 0.9, 1.0]], [-1.3, 0.2, 0.3, 1.1, [1.2, 1.3, 0.9]], [1.2, 0.1, 0.2, 1.2, [1.1, 1.5, 0.9]], [0.1, 1.3, -0.3, 1.2, [1.3, 1.1, 0.85]], [-0.6, 2.2, -0.4, 0.8, [1.4, 0.8, 0.8]], [0.9, 2.0, -0.2, 0.75, [1.2, 0.9, 0.8]]];
    for (const [x, y, z, s, sq] of slabs) {
      const g = blob(s, { detail: 3, lump: 0.32, freq: 0.9, seed: seed + Math.round(x * 10 + y * 7), squash: sq, flatBottom: y === 0 ? -s * 0.2 : null });
      g.translate(x, y + s * 0.25, z);
      b.add(paint(boxUV(g, 1.5), rockPaint(STONE.slate, seed, { moss: 0.35, mossCol: 0x5e8f3a })), sm);
    }
  } else if (kind === "standing") {
    // a standing stone (shrines, the Ember Circle)
    const g = blob(0.5, { detail: 3, lump: 0.2, freq: 2.2, seed, squash: [1.0, 3.4, 0.6], flatBottom: -1.4 });
    // wider at the foot, a flat-ish slanted top, a slight lean
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i);
      const w = 1.15 - (y + 1.7) / 3.4 * 0.35;
      if (y > 1.25) y = 1.25 + (y - 1.25) * 0.35 + p.getX(i) * 0.25;
      p.setXYZ(i, p.getX(i) * w + y * 0.05, y, p.getZ(i) * w);
    }
    g.computeVertexNormals();
    g.translate(0, 1.45, 0);
    b.add(paint(boxUV(g, 1.5), rockPaint(STONE.granite, seed, { moss: 0.25 })), sm);
  } else if (kind === "sandstone") {
    b.add(paint(boulderGeo(1.1, seed, [1.4, 0.7, 1]), (v, n) => mix(rockPaint(STONE.sandstone, seed, { moss: 0 })(v, n), 0xe8c898, Math.abs(Math.sin(v.y * 9)) * 0.25)), sm);
  }
  return b.build();
}

// ---------- Ore nodes ----------

// Every mineable rock in the game, from shared/foraging and the wiki.
export const ORES = {
  stone:    { name: "Stone",     level: 1,  kind: "plain" },
  copper:   { name: "Copper",    level: 1,  kind: "nugget", lib: "metal_copper", color: 0xc87447, rough: 0.35 },
  tin:      { name: "Tin",       level: 1,  kind: "nugget", lib: "metal_steel", color: 0xc9ced2, rough: 0.4 },
  iron:     { name: "Iron",      level: 20, kind: "nugget", lib: "metal_iron", color: 0x8d9197, rough: 0.5, stone: 0x8a6a58 },
  coal:     { name: "Coal",      level: 30, kind: "coal",   color: 0x2a2a2e },
  silver:   { name: "Silver",    level: 40, kind: "nugget", lib: "metal_silver", color: 0xe3e6ea, rough: 0.25 },
  gold:     { name: "Gold",      level: 55, kind: "nugget", lib: "metal_gold", color: 0xf2c14e, rough: 0.25, stone: 0xd2b58a },
  mithril:  { name: "Mithril",   level: 70, kind: "nugget", lib: "metal_mithril", color: 0x7cc4ee, rough: 0.25, glow: 0x2a6fa8, stone: 0x55585c },
  platinum: { name: "Platinum",  level: 75, kind: "nugget", lib: "metal_platinum", color: 0xdce3e6, rough: 0.2, stone: 0x6e7680 },
  iridium:  { name: "Iridium",   level: 85, kind: "nugget", lib: "metal_iridium", color: 0xb9b2d8, rough: 0.2, glow: 0x6a5aa8, stone: 0x55585c },
  amethyst: { name: "Amethyst",  level: 10, kind: "gem", color: 0x9a6ad8 },
  topaz:    { name: "Topaz",     level: 20, kind: "gem", color: 0xf2b84a, stone: 0xd2b58a },
  emberstone: { name: "Emberstone vein", level: 25, kind: "gem", color: 0x5dade2, glow: 0x3a9ae0, stone: 0x4f5566 },
  emerald:  { name: "Emerald",   level: 30, kind: "gem", color: 0x3fc47a },
  sapphire: { name: "Sapphire",  level: 40, kind: "gem", color: 0x3f74e0 },
  ruby:     { name: "Ruby",      level: 50, kind: "gem", color: 0xe0304a, glow: 0x80101e, stone: 0x4a403b },
  aurelite: { name: "Embersteel (Aurelite)", level: 90, kind: "nugget", lib: "metal_embersteel", color: 0xf0c860, rough: 0.2, glow: 0xffb020, stone: 0xb3a68c, planned: true },
  wellglass:{ name: "Wellglass", level: 95, kind: "gem", color: 0x5fe0d2, glow: 0x2fd8c8, stone: 0x3e4a58, planned: true },
};

/** A six-sided crystal with a pointed tip, base at 0, pointing +Y. */
function crystalGeo(h, w) {
  const g = new THREE.CylinderGeometry(w * 0.85, w, h * 0.75, 6, 1);
  g.translate(0, h * 0.375, 0);
  const tip = new THREE.ConeGeometry(w * 0.85, h * 0.3, 6, 1);
  tip.translate(0, h * 0.75 + h * 0.15, 0);
  const parts = [g.toNonIndexed(), tip.toNonIndexed()];
  const out = new THREE.BufferGeometry();
  const pos = [];
  for (const p of parts) pos.push(...p.attributes.position.array);
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals(); // crisp facets on gems look right
  return out;
}

function oreNode(id, seed, shape = 0) {
  const o = ORES[id];
  const r = rng(seed);
  const b = new Builder(`ore_${id}`);
  const sm = stoneMat();
  const base = o.stone ?? STONE.granite;
  const size = shape === 1 ? 0.7 : 0.95;
  const rocks = [];
  // main rock (Boulder) or a small cluster (Cluster)
  const n = shape === 1 ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? size : size * r.range(0.5, 0.65);
    const g = boulderGeo(s, seed + i * 5, [1.15, 0.85, 1.05]);
    const a = r() * 6.28, d = i === 0 ? 0 : size * 1.05;
    g.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    rocks.push({ g, s, at: [Math.cos(a) * d, 0, Math.sin(a) * d] });
    b.add(paint(g, rockPaint(base, seed + i, { moss: 0.25 })), sm);
  }
  if (o.kind === "plain") return b.build();

  // pick spots on the rock surfaces, facing up and out
  const spots = [];
  for (const rk of rocks) {
    const p = rk.g.attributes.position, nn = rk.g.attributes.normal;
    const want = Math.round(rk.s * (o.kind === "gem" ? 6 : 9));
    let tries = 0;
    while (spots.filter((s) => s.rk === rk).length < want && tries++ < 400) {
      const i = Math.floor(r() * p.count);
      const ny = nn.getY(i);
      if (ny < 0.05 || p.getY(i) < 0.15) continue;
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      if (spots.some((s) => s.v.distanceTo(v) < rk.s * 0.32)) continue;
      spots.push({ rk, v, n: new THREE.Vector3().fromBufferAttribute(nn, i) });
    }
  }

  if (o.kind === "gem") {
    const gm = mat(`gem_${id}`, { color: o.color, vertexColors: false, roughness: 0.12, metalness: 0.1, emissive: o.glow ?? o.color, emissiveIntensity: o.glow ? 0.9 : 0.12 });
    for (const s of spots) {
      // a little bunch of 2 to 4 crystals at each spot
      const k = r.int(2, 4);
      for (let j = 0; j < k; j++) {
        const h = r.range(0.28, 0.6) * (j === 0 ? 1.2 : 0.8), w = h * r.range(0.18, 0.26);
        const g = crystalGeo(h, w);
        const dir = s.n.clone().add(new THREE.Vector3(r.range(-0.5, 0.5), r.range(0, 0.4), r.range(-0.5, 0.5))).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        b.add(g, gm, new THREE.Matrix4().compose(s.v.clone().sub(s.n.clone().multiplyScalar(0.06)), q, new THREE.Vector3(1, 1, 1)));
      }
    }
  } else {
    const isCoal = o.kind === "coal";
    const mm = isCoal
      ? mat("coal", { roughness: 0.45, metalness: 0.1 })
      : mat(`metal_${id}`, { lib: { name: o.lib }, ...(o.glow ? { emissive: o.glow, emissiveIntensity: 0.35 } : {}) });
    for (const s of spots) {
      const sz = r.range(0.1, 0.2) * (isCoal ? 1.4 : 1);
      const g = blob(sz, { detail: 1, lump: 0.3, seed: r.int(1, 999), squash: [1.2, 0.7, 1] });
      g.computeVertexNormals();
      if (isCoal) paint(g, () => mix(0x26262a, 0x3a3a40, r()));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.n);
      b.add(g, mm, new THREE.Matrix4().compose(s.v, q, new THREE.Vector3(1, 1, 1)));
    }
  }
  return b.build();
}

export const ROCKS = [
  { id: "rock_boulder", name: "Boulder", group: "Rocks", variants: ["Granite"], make: (s) => rock(s, "boulder"), note: "A big mossy boulder for meadows and paths." },
  { id: "rock_cluster", name: "Rock cluster", group: "Rocks", variants: ["Granite"], make: (s) => rock(s, "cluster"), note: "One big rock with smaller ones around it." },
  { id: "rock_pebbles", name: "Pebbles", group: "Rocks", variants: ["Scatter"], make: (s) => rock(s, "pebbles"), note: "Small stones to scatter along paths and shores." },
  { id: "rock_cliff", name: "Cliff outcrop", group: "Rocks", variants: ["Slate"], make: (s) => rock(s, "cliff"), note: "Stacked slate ledges, for hillsides and the Greyspine Peaks." },
  { id: "rock_standing", name: "Standing stone", group: "Rocks", variants: ["Granite"], make: (s) => rock(s, "standing"), note: "For shrines and the Ember Circle." },
  { id: "rock_sandstone", name: "Sandstone rock", group: "Rocks", variants: ["Barrens"], make: (s) => rock(s, "sandstone"), note: "Banded sandstone for the Ashen Barrens and the coast." },
];

export const ORE_NODES = Object.entries(ORES).map(([id, o]) => ({
  id: `ore_${id}`,
  name: `${o.name} rock`,
  group: "Ore nodes",
  variants: ["Boulder", "Cluster"],
  make: (s, v) => oreNode(id, s, v),
  note: `${o.planned ? "Planned (Sundered Crown), level not set yet." : `Mining ${o.level}.`}${o.glow ? " Glows softly, best seen at night." : ""}`,
}));
