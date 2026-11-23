// Building parts: walls, roofs, doors, fences, gates, hedges, cliffs and bridges.
//
// A wall runs along x, centred on x = 0, standing on y = 0, with its front
// face towards +z (at z = WALL_T / 2). `length` is in metres (one tile = 2 m).
// Roofs sit on a house's footprint (w along x, d along z), ridge along x.
import * as THREE from "three";
import { EnvPiece, Parts, Rng, TILE, WALL_H, WALL_T, disposeGroup, jitter, makeRng, mat, mesh, mix, rockGeo, shade } from "./kit";

export interface WallOptions {
  length: number;
  variant: number;
  seed: number;
  /** How tall (defaults to one storey). */
  height?: number;
}
type WallBuilder = (o: WallOptions) => EnvPiece;

function piece(group: THREE.Group, update?: EnvPiece["update"], poke?: () => void): EnvPiece {
  return { object: group, update: update ?? (() => {}), poke, dispose: () => disposeGroup(group) };
}
function fromParts(p: Parts, material?: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const m = p.build(material);
  if (m) g.add(m);
  return g;
}

// ---------------------------------------------------------------- walls

const PLANKS = [
  { a: 0x8a5a36, b: 0x7a4e2e, post: 0x5e3c22 }, // logs
  { a: 0x9c6a42, b: 0x8a5c38, post: 0x5e3c22 }, // vertical boards
  { a: 0x6f8a9a, b: 0x637d8c, post: 0x4a3a2c }, // painted blue-grey
];

export const plankWall: WallBuilder = (o) => {
  const p = PLANKS[o.variant] ?? PLANKS[0];
  const H = o.height ?? WALL_H, L = o.length;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  if (o.variant === 0) {
    // Round logs laid on top of each other, ends sticking out at the corners.
    const r = 0.16;
    for (let y = r; y < H; y += r * 1.9) {
      const g = new THREE.CylinderGeometry(r, r, L + 0.5, 7);
      g.rotateZ(Math.PI / 2);
      g.rotateX(rng() * 3);
      g.translate(0, y, 0);
      parts.add(g, jitter(rng() < 0.5 ? p.a : p.b, rng, 0.06));
      for (const sx of [-1, 1]) {
        const end = new THREE.CircleGeometry(r * 0.85, 7);
        end.rotateY((sx * Math.PI) / 2);
        end.translate(sx * (L / 2 + 0.251), y, 0);
        parts.add(end, 0xc79a66);
      }
    }
  } else {
    parts.box(L, H, WALL_T * 0.7, p.post, 0, H / 2, -0.02);
    const bw = 0.22;
    const n = Math.round(L / bw);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + (i + 0.5) * (L / n);
      const h = H - 0.08 - rng() * 0.08;
      parts.box(L / n - 0.025, h, 0.06, jitter(rng() < 0.5 ? p.a : p.b, rng, 0.06), x, h / 2, WALL_T / 2 - 0.03);
    }
    // Cross rails and posts.
    for (const y of [0.5, H - 0.4]) parts.box(L, 0.14, 0.08, p.post, 0, y, WALL_T / 2 + 0.02);
    for (const x of [-L / 2 + 0.08, L / 2 - 0.08]) parts.box(0.18, H, WALL_T + 0.08, p.post, x, H / 2, 0);
  }
  return piece(fromParts(parts));
};

const TIMBER = [
  { plaster: 0xeee0c0, beam: 0x6a4428, base: 0x8e8a80 }, // cream and brown
  { plaster: 0xf4f1ea, beam: 0x2e2a28, base: 0x8a8a86 }, // white and black
  { plaster: 0xe2b878, beam: 0x5e3a22, base: 0x8e8478 }, // ochre
];

export const timberWall: WallBuilder = (o) => {
  const p = TIMBER[o.variant] ?? TIMBER[0];
  const H = o.height ?? WALL_H, L = o.length;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  const f = WALL_T / 2;
  parts.box(L, H, WALL_T, p.plaster, 0, H / 2, 0);
  // Stone footing.
  const sh = 0.45;
  for (let x = -L / 2; x < L / 2 - 0.01; ) {
    const w = Math.min(0.35 + rng() * 0.3, L / 2 - x);
    parts.box(w - 0.03, sh - 0.04, WALL_T + 0.1, jitter(p.base, rng, 0.1), x + w / 2, sh / 2, 0);
    x += w;
  }
  // Beams: sill, top plate, middle rail, posts every metre, braces.
  parts.box(L, 0.16, 0.06, p.beam, 0, sh + 0.08, f + 0.03);
  parts.box(L, 0.18, 0.06, p.beam, 0, H - 0.09, f + 0.03);
  parts.box(L, 0.12, 0.05, p.beam, 0, H * 0.58, f + 0.025);
  const posts = Math.max(1, Math.round(L / 1));
  for (let i = 0; i <= posts; i++) parts.box(0.14, H - sh, 0.06, p.beam, -L / 2 + (i * L) / posts + (i === 0 ? 0.07 : i === posts ? -0.07 : 0), (H + sh) / 2, f + 0.03);
  for (let i = 0; i < posts; i++) {
    const x0 = -L / 2 + (i * L) / posts, x1 = x0 + L / posts;
    const y0 = sh + 0.16, y1 = H * 0.58;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, i % 2 ? -dx : dx);
    parts.box(len - 0.1, 0.1, 0.05, p.beam, (x0 + x1) / 2, (y0 + y1) / 2, f + 0.025, 0, ang);
  }
  return piece(fromParts(parts));
};

const STONE = [
  { a: [0x8e8c86, 0x7c7a74, 0x9e9a90], mortar: 0x5a5650, moss: 0 },
  { a: [0xc8a478, 0xb89468, 0xd4b488], mortar: 0x8a7050, moss: 0 },
  { a: [0x86887e, 0x787c70, 0x92948a], mortar: 0x4e5640, moss: 0x5e8a3a },
];

/** Stone blocks in a running pattern over a rectangle of wall. */
function blocks(parts: Parts, L: number, H: number, colors: number[], rng: Rng, bh = 0.32, moss = 0, z = WALL_T / 2) {
  let row = 0;
  for (let y = 0; y < H - 0.01; y += bh, row++) {
    const h = Math.min(bh, H - y);
    let x = -L / 2;
    let first = true;
    while (x < L / 2 - 0.01) {
      let w = (first && row % 2 ? 0.3 : 0.5) + rng() * 0.35;
      first = false;
      w = Math.min(w, L / 2 - x);
      let c = jitter(colors[Math.floor(rng() * colors.length)], rng, 0.06);
      if (moss && (y < 0.7 ? rng() < 0.45 : rng() < 0.12)) c = mix(c, moss, 0.55);
      parts.box(w - 0.04, h - 0.04, 0.06 + rng() * 0.03, c, x + w / 2, y + h / 2, z + 0.02);
      x += w;
    }
  }
}

export const stoneWall: WallBuilder = (o) => {
  const p = STONE[o.variant] ?? STONE[0];
  const H = o.height ?? WALL_H, L = o.length;
  const parts = new Parts();
  parts.box(L, H, WALL_T, p.mortar, 0, H / 2, 0);
  blocks(parts, L, H, p.a, makeRng(o.seed), 0.32, p.moss);
  return piece(fromParts(parts));
};

export const marbleWall: WallBuilder = (o) => {
  const H = o.height ?? WALL_H, L = o.length;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  parts.box(L, H, WALL_T, 0xd8d4cc, 0, H / 2, 0);
  blocks(parts, L, H - 0.3, [0xf2efe8, 0xeae6dc, 0xf6f4ee], rng, 0.5);
  // Gold trim along the top and a plinth along the bottom.
  parts.box(L, 0.14, WALL_T + 0.16, 0xd9b44a, 0, H - 0.22, 0);
  parts.box(L, 0.16, WALL_T + 0.2, 0xf4f1ea, 0, H - 0.07, 0);
  parts.box(L, 0.25, WALL_T + 0.14, 0xe0dcd2, 0, 0.125, 0);
  if (o.variant === 1) {
    // Columns every tile.
    for (let x = -L / 2 + TILE / 2; x < L / 2; x += TILE) {
      const g = new THREE.CylinderGeometry(0.16, 0.18, H - 0.5, 10);
      g.translate(x, H / 2, WALL_T / 2 + 0.13);
      parts.add(g, 0xf8f6f0);
      parts.box(0.46, 0.14, 0.4, 0xf0ece2, x, 0.32, WALL_T / 2 + 0.13);
      parts.box(0.46, 0.14, 0.4, 0xd9b44a, x, H - 0.36, WALL_T / 2 + 0.13);
    }
  }
  return piece(fromParts(parts, mat(0xffffff, { vertexColors: true, roughness: 0.4 })));
};

export const guildWall: WallBuilder = (o) => {
  const H = o.height ?? WALL_H, L = o.length;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  parts.box(L, H, WALL_T, 0x4a3470, 0, H / 2, 0);
  blocks(parts, L, H, [0x6a4a9a, 0x5e4290, 0x74529e], rng, 0.4);
  parts.box(L, 0.1, 0.1, 0xd8b85a, 0, H * 0.62, WALL_T / 2 + 0.06);
  parts.box(L, 0.12, 0.12, 0xd8b85a, 0, H - 0.06, WALL_T / 2 + 0.05);
  parts.box(L, 0.3, 0.1, 0x3a2560, 0, 0.15, WALL_T / 2 + 0.05);
  if (o.variant === 0) {
    // Little gold stars painted above the band.
    for (let x = -L / 2 + 0.5; x < L / 2; x += 1) {
      for (const dy of [0.35, 0.85]) {
        const s = new THREE.CircleGeometry(0.07, 4);
        s.rotateZ(Math.PI / 4 + (dy > 0.5 ? 0 : 0.4));
        s.translate(x + (dy > 0.5 ? 0.5 : 0), H * 0.62 + dy * 0.9 - 0.1, WALL_T / 2 + 0.115);
        parts.add(s, 0xf2d878);
      }
    }
  }
  return piece(fromParts(parts));
};

const CAVE = [
  { a: 0x5a554e, b: 0x4a4640 }, // grey
  { a: 0x6a5644, b: 0x5a4838 }, // brown mine
  { a: 0x4e4a56, b: 0x403c48 }, // crystal-veined
];

export const caveWall: WallBuilder = (o) => {
  const p = CAVE[o.variant] ?? CAVE[0];
  const H = (o.height ?? WALL_H) + 0.6, L = o.length;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  parts.box(L, H, WALL_T * 2, p.b, 0, H / 2, -0.25);
  // Big lumpy rocks stacked into a rough face.
  for (let y = 0.3; y < H; y += 0.55) {
    for (let x = -L / 2; x < L / 2 + 0.2; x += 0.6) {
      const r = 0.38 + rng() * 0.25;
      const g = rockGeo(r, rng, 0.85);
      g.rotateY(rng() * 6);
      g.translate(x + (rng() - 0.5) * 0.25, y + (rng() - 0.5) * 0.15, (rng() - 0.3) * 0.25);
      parts.add(g, jitter(rng() < 0.5 ? p.a : p.b, rng, 0.1));
    }
  }
  const group = fromParts(parts);
  if (o.variant === 1) {
    // Wooden mine supports.
    const w = new Parts();
    for (const x of [-L / 2 + 0.2, L / 2 - 0.2]) w.box(0.22, H - 0.4, 0.22, 0x6e4a2c, x, (H - 0.4) / 2, 0.55);
    w.box(L, 0.24, 0.26, 0x6e4a2c, 0, H - 0.5, 0.55);
    const m = w.build();
    if (m) group.add(m);
  }
  if (o.variant === 2) {
    const glow = new THREE.MeshStandardMaterial({ color: 0xb07ae8, emissive: 0x8a4ad0, emissiveIntensity: 1.1, flatShading: true, roughness: 0.2 });
    (glow as any).__own = true;
    const veins = new Parts();
    for (let i = 0; i < L * 2; i++) {
      const g = new THREE.CylinderGeometry(0, 0.05, 0.25 + rng() * 0.2, 5);
      g.rotateX(Math.PI / 2 - 0.3 + rng() * 0.6);
      g.rotateZ(rng() * 6);
      g.translate((rng() - 0.5) * L, 0.4 + rng() * (H - 0.8), 0.35);
      veins.add(g, 0xffffff);
    }
    const m = veins.build(glow);
    if (m) group.add(m);
  }
  return piece(group);
};

export const cliff: WallBuilder = (o) => {
  const H = (o.height ?? WALL_H) * 1.8, L = o.length;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  const snowy = o.variant === 1;
  const capColor = snowy ? 0xf2f6fa : 0x76ae48;
  // No flat block behind: the whole cliff is packed boulders, three rows
  // deep, overlapping enough that you never see through it.
  for (let x = -L / 2 + 0.45; x < L / 2; x += 0.85) {
    const colH = H * (0.82 + rng() * 0.3);
    // Back rows first: big, rough boulders filling the body of the cliff.
    for (const [zb, sc] of [[-2.0, 0.95], [-1.25, 0.9]] as const) {
      let yb = 0;
      while (yb < colH * sc - 0.2) {
        const r = 0.62 + rng() * 0.25;
        const g = rockGeo(r, rng, 0.8);
        g.scale(1.05, 1, 0.9);
        g.rotateY(rng() * 6);
        g.translate(x + (rng() - 0.5) * 0.3, yb + r * 0.6, zb - (yb / H) * 0.3 + (rng() - 0.5) * 0.2);
        parts.add(g, jitter(0x746a5e, rng, 0.08));
        yb += r * 0.95;
      }
    }
    // Front row: flat-faced boulders that make the rock face.
    let y = 0;
    while (y < colH - 0.3) {
      const r = 0.5 + rng() * 0.3;
      const g = rockGeo(r, rng, 0.7);
      g.scale(1.15, 1, 0.75);
      g.rotateY(rng() * 6);
      const back = (y / H) * 0.6;
      g.translate(x + (rng() - 0.5) * 0.25, y + r * 0.6, -0.45 - back + (rng() - 0.5) * 0.2);
      const band = Math.floor(y / 1.1) % 2;
      parts.add(g, jitter(band ? 0x8a8072 : 0x7a7064, rng, 0.08));
      y += r * 1.0;
    }
    const top = y - 0.12;
    // The cap (grass or snow) sitting on top of this column, spilling over.
    const cap = rockGeo(0.62, rng, 0.5);
    cap.scale(1.15, 1, 2.6);
    cap.translate(x, top, -1.2 - (top / H) * 0.4);
    parts.add(cap, jitter(capColor, rng, 0.03));
    const lip = new THREE.ConeGeometry(0.14, 0.35 + rng() * 0.35, 4);
    lip.rotateX(Math.PI);
    lip.translate(x + (rng() - 0.5) * 0.3, top - 0.2, -0.3 - (top / H) * 0.6);
    parts.add(lip, snowy ? 0xe6eef6 : 0x6a9e3c);
    if (snowy && rng() < 0.5) {
      // Snow caught on a ledge part way up.
      const ledge = rockGeo(0.3, rng, 0.3);
      ledge.translate(x, colH * (0.35 + rng() * 0.3), -0.05);
      parts.add(ledge, 0xeef3f8);
    }
  }
  // Fallen rocks at the foot.
  for (let i = 0; i < L * 0.8; i++) {
    const g = rockGeo(0.12 + rng() * 0.18, rng, 0.6);
    g.translate((rng() - 0.5) * L, 0.05, 0.2 + rng() * 0.5);
    parts.add(g, jitter(0x7e766a, rng, 0.08));
  }
  return piece(fromParts(parts));
};

export const hedge: WallBuilder = (o) => {
  const L = o.length, H = 1.4;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  const wild = o.variant === 1, flowering = o.variant === 2;
  if (!wild) parts.box(L - 0.05, H - 0.1, 0.8, 0x4e8a34, 0, (H - 0.1) / 2, 0);
  for (let x = -L / 2 + 0.25; x < L / 2; x += 0.35) {
    for (let y = 0.3; y < H; y += 0.4) {
      for (const z of [-0.3, 0.3]) {
        const r = wild ? 0.32 + rng() * 0.2 : 0.22;
        const g = new THREE.IcosahedronGeometry(r, 0);
        g.translate(x + (rng() - 0.5) * 0.1, y + (wild ? rng() * 0.2 : 0), z * (wild ? 1.1 : 1));
        parts.add(g, jitter(0x5a9a3c, rng, 0.1));
      }
    }
  }
  if (flowering) {
    for (let i = 0; i < L * 9; i++) {
      const g = new THREE.IcosahedronGeometry(0.05, 0);
      g.translate((rng() - 0.5) * (L - 0.2), 0.3 + rng() * (H - 0.3), (rng() < 0.5 ? -1 : 1) * 0.43);
      parts.add(g, rng() < 0.5 ? 0xf2f2f2 : 0xf4a8c8);
    }
  }
  return piece(fromParts(parts));
};

export const fence: WallBuilder = (o) => {
  const L = o.length;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  if (o.variant === 2) {
    // A low dry-stone wall: a solid core faced with tight courses of flat
    // stones, and a row of stones standing on edge along the top.
    const T = 0.5, Hw = 0.85;
    parts.box(L, Hw, T - 0.06, 0x6e6a62, 0, Hw / 2, 0);
    const stone = (w: number, h: number, d: number, x: number, y: number, z: number, tilt = 0) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) pos.setXYZ(k, pos.getX(k) * (0.92 + rng() * 0.12), pos.getY(k) * (0.9 + rng() * 0.15), pos.getZ(k) * (0.9 + rng() * 0.2));
      if (tilt) g.rotateZ(tilt);
      g.translate(x, y, z);
      parts.add(g, jitter(rng() < 0.5 ? 0x9a968a : 0x8a867a, rng, 0.08));
    };
    let y = 0;
    let row = 0;
    while (y < Hw - 0.12) {
      const h = 0.13 + rng() * 0.06;
      for (const side of [-1, 1]) {
        let x = -L / 2 + (row % 2 ? 0.12 : 0);
        while (x < L / 2) {
          const w = Math.min(0.28 + rng() * 0.22, L / 2 - x + 0.02);
          stone(w + 0.02, h + 0.015, 0.16, x + w / 2, y + h / 2, side * (T / 2 - 0.06));
          x += w;
        }
      }
      y += h;
      row++;
    }
    // Coping: a solid bed of mortar-dark stone along the top, then a tight
    // row of capstones pressed together with no gaps, alternating tall and
    // short for a little pattern.
    parts.box(L, 0.08, T, 0x6e6a62, 0, Hw + 0.04, 0);
    {
      let x = -L / 2, k = 0;
      while (x < L / 2 - 0.01) {
        const w = Math.min(0.16 + rng() * 0.05, L / 2 - x);
        const tall = k % 2 === 0;
        stone(w + 0.03, tall ? 0.26 : 0.2, T + 0.04, x + w / 2, Hw + 0.08 + (tall ? 0.13 : 0.1), 0);
        x += w;
        k++;
      }
    }
    return piece(fromParts(parts));
  }
  const picket = o.variant === 1;
  const wood = picket ? 0xf2efe6 : 0x8a5c36;
  for (let x = -L / 2; x <= L / 2 + 0.01; x += TILE) parts.box(0.14, 1.15, 0.14, jitter(wood, rng, 0.05), x, 0.575, 0);
  if (picket) {
    for (const y of [0.35, 0.8]) parts.box(L, 0.08, 0.05, wood, 0, y, 0.09);
    for (let x = -L / 2 + 0.12; x < L / 2; x += 0.2) {
      parts.box(0.1, 0.9, 0.035, jitter(wood, rng, 0.03), x, 0.5, 0.13);
      const tip = new THREE.ConeGeometry(0.07, 0.12, 4);
      tip.rotateY(Math.PI / 4);
      tip.scale(1, 1, 0.35);
      tip.translate(x, 1.0, 0.13);
      parts.add(tip, wood);
    }
  } else {
    for (const y of [0.4, 0.85]) parts.box(L, 0.1, 0.07, jitter(wood, rng, 0.05), 0, y + (rng() - 0.5) * 0.03, 0.1, 0, (rng() - 0.5) * 0.02);
  }
  return piece(fromParts(parts));
};

export const barricade: WallBuilder = (o) => {
  const L = o.length;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  // Sharpened stakes leaning out in an X, with a rail tying them together.
  for (let x = -L / 2 + 0.3; x < L / 2; x += 0.6) {
    for (const lean of [-0.5, 0.5]) {
      const g = new THREE.CylinderGeometry(0.0, 0.08, 1.8, 6);
      g.translate(0, 0.9, 0);
      g.rotateX(lean);
      g.rotateZ((rng() - 0.5) * 0.2);
      g.translate(x + (rng() - 0.5) * 0.1, 0, 0);
      parts.add(g, jitter(0x6e5034, rng, 0.08));
    }
  }
  const rail = new THREE.CylinderGeometry(0.07, 0.07, L, 6);
  rail.rotateZ(Math.PI / 2);
  rail.translate(0, 0.65, 0);
  parts.add(rail, 0x5e4430);
  // Rope lashings.
  for (let x = -L / 2 + 0.3; x < L / 2; x += 0.6) parts.box(0.06, 0.18, 0.18, 0xc8b080, x, 0.65, 0);
  return piece(fromParts(parts));
};

/** A bridge along z (over water flowing along x), `length` long, one tile wide. */
export const bridge: WallBuilder = (o) => {
  const L = o.length, W = TILE;
  const rng = makeRng(o.seed);
  const parts = new Parts();
  if (o.variant === 1) {
    // A stone arch.
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const z0 = -L / 2 + t0 * L, z1 = -L / 2 + t1 * L;
      const y0 = Math.sin(t0 * Math.PI) * 0.7, y1 = Math.sin(t1 * Math.PI) * 0.7;
      const len = Math.hypot(z1 - z0, y1 - y0);
      const ang = Math.atan2(y1 - y0, z1 - z0);
      parts.box(W, 0.35, len + 0.04, jitter(0x9a968c, rng, 0.06), 0, (y0 + y1) / 2 + 0.2, (z0 + z1) / 2, 0, 0, -ang);
      for (const sx of [-1, 1]) parts.box(0.25, 0.4, len + 0.04, jitter(0x8a867c, rng, 0.06), sx * (W / 2 - 0.12), (y0 + y1) / 2 + 0.55, (z0 + z1) / 2, 0, 0, -ang);
    }
    return piece(fromParts(parts));
  }
  // Wooden planks across, on two beams, with rope rails.
  for (const sx of [-1, 1]) parts.box(0.18, 0.2, L + 0.4, 0x5e3e24, sx * 0.75, 0.1, 0);
  for (let z = -L / 2; z < L / 2; z += 0.24) parts.box(W, 0.07, 0.21, jitter(0x9c6a42, rng, 0.08), (rng() - 0.5) * 0.05, 0.24, z + 0.12, (rng() - 0.5) * 0.04);
  for (const sx of [-1, 1]) {
    for (let z = -L / 2; z <= L / 2 + 0.01; z += L / Math.max(1, Math.round(L / 1.6))) parts.box(0.12, 1.0, 0.12, 0x6e4a2c, sx * (W / 2 - 0.06), 0.65, z);
    parts.box(0.08, 0.08, L, 0xc8b080, sx * (W / 2 - 0.06), 1.05, 0);
  }
  return piece(fromParts(parts));
};

// ---------------------------------------------------------------- doors and gates

/** A door that opens and closes (the action button). Front at z = 0. */
export const door: WallBuilder = (o) => {
  const group = new THREE.Group();
  const frame = new Parts();
  const arched = o.variant === 1, iron = o.variant === 2;
  const W = 1.1, H = 2.1;
  const wood = iron ? 0x5a3a24 : 0x8a5a34;
  frame.box(0.14, H + 0.1, 0.16, 0x4e3220, -W / 2 - 0.07, (H + 0.1) / 2, 0);
  frame.box(0.14, H + 0.1, 0.16, 0x4e3220, W / 2 + 0.07, (H + 0.1) / 2, 0);
  frame.box(W + 0.28, 0.14, 0.16, 0x4e3220, 0, H + 0.07, 0);
  frame.box(W + 0.5, 0.08, 0.5, 0x8e8a80, 0, 0.04, 0.2); // doorstep
  if (arched) {
    const a = new THREE.CylinderGeometry(W / 2 + 0.14, W / 2 + 0.14, 0.16, 12, 1, false, -Math.PI / 2, Math.PI);
    a.rotateX(-Math.PI / 2);
    a.translate(0, H + 0.1, 0);
    frame.add(a, 0x4e3220);
  }
  group.add(fromParts(frame));
  // The door leaf hangs from a hinge on the left.
  const hinge = new THREE.Group();
  hinge.position.set(-W / 2, 0, 0.0);
  const leaf = new Parts();
  for (let i = 0; i < 4; i++) leaf.box(W / 4 - 0.02, H, 0.08, jitter(wood, makeRng(o.seed + i), 0.06), W / 8 + (i * W) / 4, H / 2, 0);
  if (arched) {
    const top = new THREE.CylinderGeometry(W / 2, W / 2, 0.08, 12, 1, false, -Math.PI / 2, Math.PI);
    top.rotateX(-Math.PI / 2);
    top.translate(W / 2, H, 0);
    leaf.add(top, wood);
  }
  const band = iron ? 0x2e2e32 : 0x5e3c22;
  for (const y of [0.35, H - 0.35]) leaf.box(W - 0.06, 0.12, 0.04, band, W / 2, y, 0.05);
  if (iron) {
    for (let x = 0.15; x < W; x += 0.25) for (const y of [0.35, H - 0.35]) leaf.box(0.05, 0.05, 0.03, 0x8a8a90, x, y, 0.08);
    leaf.box(0.2, 0.3, 0.05, 0x3a3a3e, W - 0.22, H * 0.48, 0.07); // lock plate
  }
  const knob = new THREE.SphereGeometry(0.05, 6, 4);
  knob.translate(W - 0.16, H * 0.48 + (iron ? 0.22 : 0), 0.08);
  leaf.add(knob, 0xc9a23a);
  const lm = leaf.build();
  if (lm) hinge.add(lm);
  group.add(hinge);
  let open = 0, target = 0;
  return piece(group, (dt) => {
    open += (target - open) * Math.min(1, dt * 4);
    hinge.rotation.y = -open * 1.6;
  }, () => (target = target ? 0 : 1));
};

export const gate: WallBuilder = (o) => {
  const group = new THREE.Group();
  const L = TILE;
  const posts = new Parts();
  const town = o.variant === 1;
  const wood = 0x8a5c36;
  for (const sx of [-1, 1]) {
    posts.box(0.2, town ? 2.6 : 1.4, 0.2, town ? 0x8e8a80 : 0x6e4a2c, sx * L / 2, town ? 1.3 : 0.7, 0);
    if (town) posts.box(0.32, 0.16, 0.32, 0x9e9a90, sx * L / 2, 2.66, 0);
  }
  if (town) posts.box(L + 0.3, 0.18, 0.18, 0x6e4a2c, 0, 2.45, 0);
  group.add(fromParts(posts));
  const leaves: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const h = new THREE.Group();
    h.position.set(sx * (L / 2 - 0.1), 0, 0);
    const p = new Parts();
    const w = L / 2 - 0.12;
    for (const y of [0.35, 0.95]) p.box(w, 0.1, 0.06, wood, (-sx * w) / 2, y, 0);
    for (let i = 0; i < 4; i++) p.box(0.08, 1.1, 0.05, wood, -sx * (0.1 + (i * (w - 0.15)) / 3), 0.65, 0.05);
    const dl = Math.hypot(w, 0.6);
    p.box(dl, 0.08, 0.05, wood, (-sx * w) / 2, 0.65, -0.05, 0, sx * Math.atan2(0.6, w));
    const m = p.build();
    if (m) h.add(m);
    group.add(h);
    leaves.push(h);
  }
  let open = 0, target = 0;
  return piece(group, (dt) => {
    open += (target - open) * Math.min(1, dt * 3);
    leaves[0].rotation.y = open * 1.4;
    leaves[1].rotation.y = -open * 1.4;
  }, () => (target = target ? 0 : 1));
};

// ---------------------------------------------------------------- roofs

export interface RoofOptions {
  /** Footprint of the house (outer wall faces). */
  w: number;
  d: number;
  variant: number;
  seed: number;
  /** Colour of the triangle gable ends (match the walls). */
  gable?: number;
}
type RoofBuilder = (o: RoofOptions) => EnvPiece;

/** A gable roof: two slopes, ridge along x, sitting on top of the walls (y = 0 is the wall top). */
function gableRoof(o: RoofOptions, layer: (parts: Parts, slope: Slope, rng: Rng) => void, ridgeColor: number, rise = 0.62): THREE.Group {
  const rng = makeRng(o.seed);
  const over = 0.35;
  const half = o.d / 2 + over;
  const h = (o.d / 2) * rise * 2;
  const len = Math.hypot(half, h + over * rise * 2);
  const ang = Math.atan2(h + over * rise * 2, half);
  const parts = new Parts();
  // Gable ends (the triangle bits of wall).
  const tri = new THREE.Shape([new THREE.Vector2(-o.d / 2, 0), new THREE.Vector2(o.d / 2, 0), new THREE.Vector2(0, h)]);
  for (const sx of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(tri, { depth: WALL_T, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    g.translate(sx * (o.w / 2) - (sx > 0 ? WALL_T : 0), 0, 0);
    parts.add(g, o.gable ?? 0xeee0c0);
  }
  for (const side of [-1, 1]) layer(parts, { len, ang, side, w: o.w + over * 2, top: h }, rng);
  // Ridge cap.
  const ridge = new THREE.CylinderGeometry(0.13, 0.13, o.w + over * 2 + 0.1, 6);
  ridge.rotateZ(Math.PI / 2);
  ridge.translate(0, h + 0.06, 0);
  parts.add(ridge, ridgeColor);
  const group = fromParts(parts);
  group.userData.height = h;
  return group;
}

/** Place a slab on one roof slope: `t` is how far down the slope (0 ridge, 1 eave). */
interface Slope { len: number; ang: number; side: number; w: number; top: number }
function onSlope(parts: Parts, s: Slope, t: number, w: number, depth: number, thick: number, color: number, x: number, lift = 0) {
  const g = new THREE.BoxGeometry(w, thick, depth);
  g.translate(0, thick / 2 + lift, 0);
  g.rotateX(s.side * s.ang);
  const top = s.top;
  const dz = Math.cos(s.ang) * t * s.len;
  const dy = -Math.sin(s.ang) * t * s.len;
  g.translate(x, dy + top, s.side * dz);
  parts.add(g, color);
}

function roofPiece(group: THREE.Group, h: number): EnvPiece {
  // Shift so the slopes start at the ridge height.
  for (const c of group.children) c.position.y = 0;
  const wrap = new THREE.Group();
  wrap.add(group);
  wrap.userData.height = h;
  return piece(wrap);
}

const TILES = [
  { a: 0xb8503a, b: 0xa44634, ridge: 0x8a3a2a }, // red clay
  { a: 0x8a5a3a, b: 0x7a4e32, ridge: 0x5e3a24 }, // brown
  { a: 0x56647a, b: 0x4a586c, ridge: 0x3a4454 }, // slate blue
];

export const tileRoof: RoofBuilder = (o) => {
  const p = TILES[o.variant] ?? TILES[0];
  const g = gableRoof(o, (parts, s, rng) => {
    const rows = Math.ceil(s.len / 0.3);
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.5) / rows;
      for (let x = -s.w / 2 + 0.25; x < s.w / 2; x += 0.5) {
        const sx = x + (r % 2) * 0.25;
        if (sx > s.w / 2 - 0.1) continue;
        onSlope(parts, s, t, 0.48, 0.34, 0.07, jitter(r % 2 ? p.a : p.b, rng, 0.06), sx, -0.12 + (r / rows) * 0.0);
      }
    }
    onSlope(parts, s, 0.5, s.w, s.len, 0.1, shade(p.b, 0.7), 0, -0.2);
  }, p.ridge);
  return roofPiece(g, g.userData.height);
};

export const thatchRoof: RoofBuilder = (o) => {
  const pale = o.variant === 1;
  const g = gableRoof(o, (parts, s, rng) => {
    const rows = Math.ceil(s.len / 0.4);
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.5) / rows;
      for (let x = -s.w / 2 + 0.2; x < s.w / 2; x += 0.4) {
        const c = jitter(pale ? 0xd8bc78 : 0xb8954e, rng, 0.08);
        onSlope(parts, s, t, 0.44, 0.48, 0.2 + rng() * 0.06, c, x, -0.1);
      }
    }
  }, pale ? 0xb89a58 : 0x8e7038, 0.75);
  return roofPiece(g, g.userData.height);
};

export const goldRoof: RoofBuilder = (o) => {
  const g = gableRoof(o, (parts, s, rng) => {
    const rows = Math.ceil(s.len / 0.28);
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.5) / rows;
      for (let x = -s.w / 2 + 0.2; x < s.w / 2; x += 0.4) {
        const sx = x + (r % 2) * 0.2;
        if (sx > s.w / 2 - 0.1) continue;
        onSlope(parts, s, t, 0.38, 0.32, 0.06, jitter(r % 2 ? 0xe0b84a : 0xd4a83a, rng, 0.05), sx, -0.1);
      }
    }
    onSlope(parts, s, 0.5, s.w, s.len, 0.1, 0x9a7a2a, 0, -0.18);
  }, 0xf2d878, 0.7);
  const shiny = mat(0xffffff, { vertexColors: true, roughness: 0.35, metalness: 0.55 });
  g.traverse((c) => ((c as THREE.Mesh).isMesh ? ((c as THREE.Mesh).material = shiny) : 0));
  if (o.variant === 1) {
    // A little bell tower with a glowing light on the ridge.
    const t = new Parts();
    const h = g.userData.height;
    t.box(0.9, 1.2, 0.9, 0xf2efe8, 0, h + 0.5, 0);
    const spire = new THREE.ConeGeometry(0.75, 1.3, 4);
    spire.rotateY(Math.PI / 4);
    spire.translate(0, h + 1.75, 0);
    t.add(spire, 0xd9b44a);
    const m = t.build();
    if (m) g.add(m);
  }
  return roofPiece(g, g.userData.height);
};

// ---------------------------------------------------------------- a whole house

export type WallKind = "plank" | "timber" | "stone" | "marble" | "guild";
export const WALLS: Record<WallKind, WallBuilder> = { plank: plankWall, timber: timberWall, stone: stoneWall, marble: marbleWall, guild: guildWall };
export type RoofKind = "tile" | "thatch" | "gold";
export const ROOFS: Record<RoofKind, RoofBuilder> = { tile: tileRoof, thatch: thatchRoof, gold: goldRoof };

const GABLE: Record<WallKind, (v: number) => number> = {
  plank: (v) => (PLANKS[v] ?? PLANKS[0]).a,
  timber: (v) => (TIMBER[v] ?? TIMBER[0]).plaster,
  stone: (v) => (STONE[v] ?? STONE[0]).a[0],
  marble: () => 0xf2efe8,
  guild: () => 0x6a4a9a,
};

export interface HouseOptions {
  /** Footprint in tiles. */
  tw: number;
  td: number;
  wall: WallKind;
  wallVariant: number;
  roof: RoofKind;
  roofVariant: number;
  seed: number;
  /** Leave the front wall off (to see inside). */
  open?: boolean;
  /** Leave the roof off. */
  noRoof?: boolean;
}

/**
 * A simple house: four walls and a roof, front facing +z, centred on 0,0.
 * Returns the walls' front-face z so ornaments can be hung on it.
 */
export function house(o: HouseOptions): { piece: EnvPiece; front: number; w: number; d: number; height: number } {
  const w = o.tw * TILE, d = o.td * TILE;
  const group = new THREE.Group();
  const parts: EnvPiece[] = [];
  const W = WALLS[o.wall];
  const add = (p: EnvPiece, x: number, z: number, ry: number) => {
    p.object.position.set(x, 0, z);
    p.object.rotation.y = ry;
    group.add(p.object);
    parts.push(p);
  };
  if (!o.open) add(W({ length: w, variant: o.wallVariant, seed: o.seed }), 0, d / 2 - WALL_T / 2, 0);
  add(W({ length: w, variant: o.wallVariant, seed: o.seed + 1 }), 0, -d / 2 + WALL_T / 2, Math.PI);
  add(W({ length: d - WALL_T * 2, variant: o.wallVariant, seed: o.seed + 2 }), w / 2 - WALL_T / 2, 0, Math.PI / 2);
  add(W({ length: d - WALL_T * 2, variant: o.wallVariant, seed: o.seed + 3 }), -w / 2 + WALL_T / 2, 0, -Math.PI / 2);
  let height = WALL_H;
  if (!o.noRoof) {
    const r = ROOFS[o.roof]({ w, d, variant: o.roofVariant, seed: o.seed + 4, gable: GABLE[o.wall](o.wallVariant) });
    r.object.position.y = WALL_H;
    group.add(r.object);
    parts.push(r);
    height += r.object.userData.height ?? 2;
  }
  return {
    piece: { object: group, update: (dt, t, e) => parts.forEach((p) => p.update(dt, t, e)), dispose: () => parts.forEach((p) => p.dispose()) },
    front: d / 2,
    w,
    d,
    height,
  };
}

/** A chimney to put on a roof. */
export function chimney(x: number, y: number, z: number, seed: number): THREE.Mesh {
  const p = new Parts();
  const rng = makeRng(seed);
  for (let yy = 0; yy < 1.6; yy += 0.25) for (const [dx, dz] of [[-0.18, 0], [0.18, 0]]) p.box(0.36, 0.23, 0.6, jitter(0x8a7a6c, rng, 0.08), x + dx, y + yy + 0.12, z + dz);
  p.box(0.82, 0.12, 0.72, 0x6e6258, x, y + 1.66, z);
  return p.build()!;
}

export { mesh };
