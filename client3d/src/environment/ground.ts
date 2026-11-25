// Ground and floors: everything you walk on.
//
// Every builder takes a rectangle in the world (x0, z0 is its corner, w and d
// its size in metres) and builds that whole patch, so a big field is one
// piece and neighbouring patches line up exactly.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  EnvPiece, NightLights, Rng, TILE, VCOL, disposeGroup, glowMat, hash2, jitter, makeRng, mat, mesh, mix, noise2, painted, rockGeo, shade, surface,
} from "./kit";

export interface PatchOptions {
  x0: number;
  z0: number;
  w: number;
  d: number;
  variant: number;
  seed: number;
}

type Builder = (o: PatchOptions) => EnvPiece;

/** A piece made of one coloured surface plus some merged extra bits. */
function patch(o: PatchOptions, ground: THREE.BufferGeometry, extras: THREE.BufferGeometry[] = [], material = VCOL()): { group: THREE.Group; piece: EnvPiece } {
  const group = new THREE.Group();
  const g = mesh(ground, material, false);
  group.add(g);
  if (extras.length) {
    const merged = mergeGeometries(extras.map((e) => (e.index ? e.toNonIndexed() : e)), false);
    if (merged) group.add(mesh(merged, VCOL()));
    extras.forEach((e) => e.dispose());
  }
  return { group, piece: { object: group, update() {}, dispose: () => disposeGroup(group) } };
}

/** Scatter `perM2` things per square metre over the patch, each at a repeatable spot. */
function scatter(o: PatchOptions, perM2: number, salt: number, fn: (x: number, z: number, rng: Rng) => void) {
  // One small cell per thing so the scatter is the same however the patch is cut up.
  const cell = 1 / Math.sqrt(perM2);
  const i0 = Math.floor(o.x0 / cell), i1 = Math.ceil((o.x0 + o.w) / cell);
  const j0 = Math.floor(o.z0 / cell), j1 = Math.ceil((o.z0 + o.d) / cell);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const rng = makeRng(Math.floor(hash2(i, j, salt + o.seed) * 1e9) + 1);
      const x = (i + rng()) * cell, z = (j + rng()) * cell;
      if (x < o.x0 + 0.05 || x > o.x0 + o.w - 0.05 || z < o.z0 + 0.05 || z > o.z0 + o.d - 0.05) continue;
      fn(x, z, rng);
    }
  }
}

/** A little 3-sided blade of grass (or a sprout), leaning a bit. */
function blade(x: number, y: number, z: number, h: number, color: number, rng: Rng): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.035 + rng() * 0.02, h, 3);
  g.translate(0, h / 2, 0);
  g.rotateZ((rng() - 0.5) * 0.5);
  g.rotateX((rng() - 0.5) * 0.5);
  g.rotateY(rng() * 6.28);
  g.translate(x, y, z);
  return painted(g, color);
}

function pebble(x: number, y: number, z: number, r: number, color: number, rng: Rng): THREE.BufferGeometry {
  const g = rockGeo(r, rng, 0.55);
  g.rotateY(rng() * 6.28);
  g.translate(x, y + r * 0.2, z);
  return painted(g, color);
}

// ---------------------------------------------------------------- outdoor ground

const GRASS = [
  { a: 0x6fae45, b: 0x8cc256, c: 0x5e9a3a }, // soft
  { a: 0x6aa843, b: 0x86bd52, c: 0x55903a }, // tufty
  { a: 0x78b84c, b: 0x6aa843, c: 0x6aa843 }, // trimmed
];

export const grass: Builder = (o) => {
  const p = GRASS[o.variant] ?? GRASS[0];
  const geo = surface({
    ...o, seg: 6,
    height: (x, z) => noise2(x, z, 3, 1) * 0.08,
    color: (x, z) => {
      if (o.variant === 2) return Math.floor(x / 1) % 2 === 0 ? p.a : shade(p.a, 0.92);
      const n = noise2(x, z, 2.5, 2);
      const base = mix(p.c, p.b, n);
      return jitter(base, () => hash2(Math.floor(x * 7), Math.floor(z * 7), 3), 0.06);
    },
  });
  const extras: THREE.BufferGeometry[] = [];
  if (o.variant !== 2) {
    scatter(o, o.variant === 1 ? 9 : 2.5, 11, (x, z, rng) => {
      const n = o.variant === 1 ? 3 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) extras.push(blade(x + (rng() - 0.5) * 0.12, noise2(x, z, 3, 1) * 0.08, z + (rng() - 0.5) * 0.12, 0.12 + rng() * (o.variant === 1 ? 0.22 : 0.1), jitter(mix(p.c, p.b, rng()), rng), rng));
    });
  }
  return patch(o, geo, extras).piece;
};

export const path: Builder = (o) => {
  const rut = (x: number) => {
    // Two cart ruts per tile, running along z.
    const local = ((x % TILE) + TILE) % TILE;
    return Math.min(Math.abs(local - 0.55), Math.abs(local - 1.45));
  };
  const geo = surface({
    ...o, seg: 7,
    height: (x, z) => noise2(x, z, 1.5, 5) * 0.05 - (o.variant === 1 ? Math.max(0, 0.06 - rut(x) * 0.25) : 0) - (o.variant === 2 ? Math.max(0, 0.45 - noise2(x, z, 1.6, 9)) * 0.12 : 0),
    color: (x, z) => {
      const n = noise2(x, z, 1.2, 6);
      let c = mix(0x9c7650, 0xb89068, n);
      if (o.variant === 1 && rut(x) < 0.13) c = 0x84603e;
      if (o.variant === 2) c = mix(c, 0x6a4c32, Math.min(1, Math.max(0, 0.55 - noise2(x, z, 1.6, 9)) * 3));
      return jitter(c, () => hash2(Math.floor(x * 8), Math.floor(z * 8), 7), 0.05);
    },
  });
  const extras: THREE.BufferGeometry[] = [];
  scatter(o, 3, 21, (x, z, rng) => extras.push(pebble(x, 0.02, z, 0.03 + rng() * 0.04, jitter(0x9a948a, rng, 0.12), rng)));
  const { group, piece } = patch(o, geo, extras);
  if (o.variant === 2) {
    // Puddles in the low spots.
    const water = mat(0x6d7f86, { roughness: 0.08, metalness: 0.2, opacity: 0.75 });
    scatter(o, 0.35, 23, (x, z, rng) => {
      if (noise2(x, z, 1.6, 9) > 0.42) return;
      const r = 0.2 + rng() * 0.25;
      const pd = new THREE.Mesh(new THREE.CircleGeometry(r, 7).rotateX(-Math.PI / 2), water);
      pd.scale.set(1, 1, 0.6 + rng() * 0.4);
      pd.position.set(x, -0.02, z);
      pd.receiveShadow = true;
      group.add(pd);
    });
  }
  return piece;
};

const COBBLE = [
  { stone: [0x9c9a94, 0x8a8984, 0xaaa69c], mortar: 0x5e5a52, moss: 0 },
  { stone: [0xc9a57a, 0xb8916a, 0xd2b48a], mortar: 0x7a6248, moss: 0 },
  { stone: [0x8f9188, 0x7f8478, 0x9a9b90], mortar: 0x4f5a3c, moss: 0x6e9a42 },
];

export const cobble: Builder = (o) => {
  const p = COBBLE[o.variant] ?? COBBLE[0];
  const geo = surface({ ...o, seg: 2, height: () => 0, color: (x, z) => (p.moss && noise2(x, z, 1, 3) > 0.55 ? p.moss : p.mortar) });
  const extras: THREE.BufferGeometry[] = [];
  const sz = 0.4;
  const j0 = Math.floor(o.z0 / sz), j1 = Math.ceil((o.z0 + o.d) / sz);
  for (let j = j0; j < j1; j++) {
    const off = (j % 2) * sz * 0.5;
    const i0 = Math.floor((o.x0 - off) / sz) - 1, i1 = Math.ceil((o.x0 + o.w - off) / sz);
    for (let i = i0; i <= i1; i++) {
      const rng = makeRng(Math.floor(hash2(i, j, 31 + o.seed) * 1e9) + 1);
      const cx = i * sz + off + sz / 2, cz = j * sz + sz / 2;
      // Stones that would hang over the patch edge are trimmed to fit.
      const xa = Math.max(o.x0, cx - sz / 2 + 0.035), xb = Math.min(o.x0 + o.w, cx + sz / 2 - 0.035);
      const za = Math.max(o.z0, cz - sz / 2 + 0.035), zb = Math.min(o.z0 + o.d, cz + sz / 2 - 0.035);
      if (xb - xa < 0.06 || zb - za < 0.06) continue;
      const h = 0.05 + rng() * 0.04;
      const g = new THREE.BoxGeometry(xb - xa, h, zb - za, 1, 1, 1);
      // Round the top a little: pull the top corners in.
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) if (pos.getY(k) > 0) { pos.setX(k, pos.getX(k) * 0.82); pos.setZ(k, pos.getZ(k) * 0.82); pos.setY(k, pos.getY(k) + (rng() - 0.5) * 0.015); }
      g.translate((xa + xb) / 2, h / 2, (za + zb) / 2);
      let c = jitter(p.stone[Math.floor(rng() * p.stone.length)], rng, 0.07);
      if (p.moss && rng() < 0.25) c = mix(c, p.moss, 0.45);
      extras.push(painted(g, c));
    }
  }
  return patch(o, geo, extras).piece;
};

export const sand: Builder = (o) => {
  const wet = o.variant === 1;
  const dunes = o.variant === 2;
  const geo = surface({
    ...o, seg: 7,
    height: (x, z) => Math.sin((x * 0.7 + z * 0.35) * 7) * 0.012 + noise2(x, z, dunes ? 4 : 2, 13) * (dunes ? 0.45 : 0.05),
    color: (x, z) => {
      const ripple = Math.sin((x * 0.7 + z * 0.35) * 7) > 0.4 ? 1.04 : 1;
      const base = wet ? mix(0xb89c6e, 0xa88c60, noise2(x, z, 1.5, 14)) : mix(0xead29a, 0xe0c286, noise2(x, z, 1.5, 14));
      return shade(base, ripple);
    },
  });
  const material = wet ? mat(0xffffff, { vertexColors: true, roughness: 0.35, metalness: 0.05 }) : VCOL();
  const extras: THREE.BufferGeometry[] = [];
  scatter(o, 0.6, 15, (x, z, rng) => extras.push(pebble(x, 0, z, 0.025 + rng() * 0.03, jitter(0xcbb89a, rng, 0.15), rng)));
  return patch(o, geo, extras, material).piece;
};

export const withered: Builder = (o) => {
  const blight = o.variant === 1;
  const geo = surface({
    ...o, seg: 6,
    height: (x, z) => noise2(x, z, 2, 17) * 0.1,
    color: (x, z) => jitter(mix(blight ? 0x6a6872 : 0x7d7458, blight ? 0x55525c : 0x8f8466, noise2(x, z, 1.8, 18)), () => hash2(Math.floor(x * 6), Math.floor(z * 6), 19), 0.07),
  });
  const extras: THREE.BufferGeometry[] = [];
  scatter(o, 3, 41, (x, z, rng) => {
    for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) extras.push(blade(x + (rng() - 0.5) * 0.15, noise2(x, z, 2, 17) * 0.1, z + (rng() - 0.5) * 0.15, 0.14 + rng() * 0.2, jitter(blight ? 0x7c7a84 : 0xa39470, rng, 0.1), rng));
  });
  const { group, piece } = patch(o, geo, extras);
  if (blight) {
    // Cracks glowing the same mint as the 2D game's blight.
    const lights = new NightLights();
    const glow = glowMat(0x7ff0c8, 0x5fe0b0);
    lights.addMat(glow, 0.6, 2.2);
    const cracks: THREE.BufferGeometry[] = [];
    scatter(o, 0.5, 43, (x, z, rng) => {
      let px = x, pz = z, a = rng() * 6.28;
      for (let k = 0; k < 4; k++) {
        const len = 0.18 + rng() * 0.2;
        const g = new THREE.BoxGeometry(len, 0.02, 0.035);
        g.rotateY(-a);
        g.translate(px + (Math.cos(a) * len) / 2, noise2(px, pz, 2, 17) * 0.1 + 0.012, pz + (Math.sin(a) * len) / 2);
        cracks.push(g);
        px += Math.cos(a) * len;
        pz += Math.sin(a) * len;
        a += (rng() - 0.5) * 1.4;
      }
    });
    if (cracks.length) group.add(mesh(mergeGeometries(cracks)!, glow, false));
    piece.update = (dt, t, env) => {
      lights.update(dt, t, env);
      glow.emissiveIntensity *= 0.8 + Math.sin(t * 1.3) * 0.2;
    };
  }
  return piece;
};

export const gravel: Builder = (o) => {
  const geo = surface({
    ...o, seg: 6,
    height: (x, z) => noise2(x, z, 1.5, 51) * 0.08,
    color: (x, z) => jitter(mix(0x8d8a82, 0xa29e94, noise2(x, z, 1.2, 52)), () => hash2(Math.floor(x * 10), Math.floor(z * 10), 53), 0.1),
  });
  const extras: THREE.BufferGeometry[] = [];
  scatter(o, 14, 55, (x, z, rng) => extras.push(pebble(x, noise2(x, z, 1.5, 51) * 0.08, z, 0.025 + rng() * 0.05, jitter(rng() < 0.5 ? 0x9c988e : 0x7f7c74, rng, 0.1), rng)));
  scatter(o, 0.4, 57, (x, z, rng) => extras.push(pebble(x, noise2(x, z, 1.5, 51) * 0.08, z, 0.1 + rng() * 0.1, jitter(0x8f8b82, rng, 0.08), rng)));
  return patch(o, geo, extras).piece;
};

export const field: Builder = (o) => {
  // Ridges along x, one every half metre.
  const ridge = (z: number) => Math.cos(((z % 0.5) / 0.5) * Math.PI * 2) * 0.5 + 0.5;
  const wet = o.variant === 1;
  const geo = surface({
    ...o, seg: 12,
    height: (x, z) => ridge(z) * 0.1 + noise2(x, z, 1, 61) * 0.02,
    color: (x, z) => {
      const r = ridge(z);
      const c = wet ? mix(0x3e2a1c, 0x5a3e2a, r) : mix(0x6a4a30, 0x8a6442, r);
      return jitter(c, () => hash2(Math.floor(x * 6), Math.floor(z * 12), 63), 0.05);
    },
  });
  const extras: THREE.BufferGeometry[] = [];
  if (o.variant === 2) {
    // Little sprouts on top of every ridge.
    for (let z = Math.ceil(o.z0 / 0.5) * 0.5; z < o.z0 + o.d; z += 0.5) {
      for (let x = o.x0 + 0.15; x < o.x0 + o.w; x += 0.3) {
        const rng = makeRng(Math.floor(hash2(Math.round(x * 10), Math.round(z * 10), 65) * 1e9) + 1);
        for (let k = 0; k < 3; k++) {
          const g = new THREE.ConeGeometry(0.03, 0.12, 3);
          g.scale(1, 1, 0.3);
          g.translate(0, 0.06, 0.03);
          g.rotateX(0.5);
          g.rotateY((k / 3) * 6.28 + rng());
          g.translate(x, 0.1, z);
          extras.push(painted(g, jitter(0x7ccf4a, rng, 0.1)));
        }
      }
    }
  }
  scatter(o, 1.2, 67, (x, z, rng) => extras.push(pebble(x, ridge(z) * 0.1, z, 0.03 + rng() * 0.03, jitter(0x5a4230, rng, 0.1), rng)));
  const material = wet ? mat(0xffffff, { vertexColors: true, roughness: 0.45 }) : VCOL();
  return patch(o, geo, extras, material).piece;
};

export const snow: Builder = (o) => {
  const icy = o.variant === 1;
  const geo = surface({
    ...o, seg: 6,
    height: (x, z) => noise2(x, z, 2.2, 71) * 0.18,
    color: (x, z) => {
      const n = noise2(x, z, 1.6, 72);
      if (icy && n > 0.62) return mix(0xbfe0f0, 0xa8d0e8, n);
      return jitter(mix(0xe8eef4, 0xf8fbff, n), () => hash2(Math.floor(x * 5), Math.floor(z * 5), 73), 0.03);
    },
  });
  const extras: THREE.BufferGeometry[] = [];
  scatter(o, 0.4, 75, (x, z, rng) => extras.push(pebble(x, noise2(x, z, 2.2, 71) * 0.18, z, 0.06 + rng() * 0.08, jitter(0x7a7f88, rng, 0.1), rng)));
  return patch(o, geo, extras, mat(0xffffff, { vertexColors: true, roughness: icy ? 0.4 : 0.85 })).piece;
};

// ---------------------------------------------------------------- floors (inside and caves)

const BOARDS = [
  { a: 0xb07a48, b: 0x9c6a3e, gap: 0x5a3a22 }, // oak
  { a: 0x6e4a32, b: 0x5e3e2a, gap: 0x2e1e14 }, // walnut
  { a: 0xc9a072, b: 0xb48a5c, gap: 0x7a5a3a }, // worn pine
];

export const boards: Builder = (o) => {
  const p = BOARDS[o.variant] ?? BOARDS[0];
  const geo = surface({ ...o, seg: 1, height: () => 0, color: () => p.gap });
  const extras: THREE.BufferGeometry[] = [];
  const pw = 0.25;
  for (let z = Math.floor(o.z0 / pw) * pw; z < o.z0 + o.d - 0.01; z += pw) {
    const row = Math.round(z / pw);
    // Planks of different lengths, starting at different places in each row.
    let x = o.x0;
    let k = 0;
    const start = hash2(row, 0, 81 + o.seed) * 1.4;
    while (x < o.x0 + o.w - 0.01) {
      const len = Math.min(k === 0 ? 0.3 + start : 1.2 + hash2(row, k, 82) * 1.0, o.x0 + o.w - x);
      const rng = makeRng(Math.floor(hash2(row, k, 83 + o.seed) * 1e9) + 1);
      const za = Math.max(o.z0, z + 0.008), zb = Math.min(o.z0 + o.d, z + pw - 0.008);
      if (len > 0.04 && zb > za) {
        const g = new THREE.BoxGeometry(len - 0.012, 0.04, zb - za);
        g.translate(x + len / 2, 0.02 + (rng() - 0.5) * 0.006, (za + zb) / 2);
        let c = jitter(rng() < 0.5 ? p.a : p.b, rng, 0.06);
        if (o.variant === 2 && rng() < 0.2) c = shade(c, 1.12);
        extras.push(painted(g, c));
        // A couple of nail heads at each end.
        if (len > 0.5) for (const nx of [x + 0.06, x + len - 0.06]) {
          const n = new THREE.CylinderGeometry(0.012, 0.012, 0.005, 5);
          n.translate(nx, 0.042, (za + zb) / 2);
          extras.push(painted(n, 0x3a3a3a));
        }
      }
      x += len;
      k++;
    }
  }
  return patch(o, geo, extras).piece;
};

export const marble: Builder = (o) => {
  const sz = 1;
  const geo = surface({ ...o, seg: 1, height: () => 0, color: () => (o.variant === 2 ? 0xc9a23a : 0xb8b4ac) });
  const extras: THREE.BufferGeometry[] = [];
  for (let j = Math.floor(o.z0 / sz); j * sz < o.z0 + o.d; j++) {
    for (let i = Math.floor(o.x0 / sz); i * sz < o.x0 + o.w; i++) {
      const rng = makeRng(Math.floor(hash2(i, j, 91 + o.seed) * 1e9) + 1);
      const xa = Math.max(o.x0, i * sz + 0.02), xb = Math.min(o.x0 + o.w, (i + 1) * sz - 0.02);
      const za = Math.max(o.z0, j * sz + 0.02), zb = Math.min(o.z0 + o.d, (j + 1) * sz - 0.02);
      if (xb <= xa || zb <= za) continue;
      const checker = o.variant === 1 && (i + j) % 2 === 1;
      const base = checker ? 0x8fa0b4 : 0xf1eee6;
      // Two-triangle tiles with a faint vein of a different shade.
      const g = new THREE.BoxGeometry(xb - xa, 0.05, zb - za, 2, 1, 2);
      g.translate((xa + xb) / 2, 0.025, (za + zb) / 2);
      const gg = painted(g, base);
      const col = gg.attributes.color as THREE.BufferAttribute;
      const vein = new THREE.Color(shade(base, 0.9));
      const tri = Math.floor(rng() * (col.count / 3));
      for (let v = 0; v < 3; v++) col.setXYZ(tri * 3 + v, vein.r, vein.g, vein.b);
      extras.push(gg);
    }
  }
  return patch(o, geo, extras, mat(0xffffff, { vertexColors: true, roughness: 0.3 })).piece;
};

const RUGS = [
  { field: 0x5b3c8c, border: 0x3a2560, trim: 0xd8b85a }, // Mages' Guild purple
  { field: 0xd9a92e, border: 0xa8323a, trim: 0xf6dc8a }, // Emberhall gold
  { field: 0xa8423a, border: 0x5a2420, trim: 0xe6c690 }, // inn red
];

export const rug: Builder = (o) => {
  const p = RUGS[o.variant] ?? RUGS[0];
  // The rug fills the patch: border round the edge, diamonds in the middle.
  const cx = o.x0 + o.w / 2, cz = o.z0 + o.d / 2;
  const geo = surface({
    ...o, seg: 10,
    height: () => 0.03,
    color: (x, z) => {
      const ex = Math.min(x - o.x0, o.x0 + o.w - x), ez = Math.min(z - o.z0, o.z0 + o.d - z);
      const e = Math.min(ex, ez);
      if (e < 0.12) return p.border;
      if (e < 0.18) return p.trim;
      if (e < 0.3) return p.border;
      const dm = Math.abs(((x - cx) % 1 + 1) % 1 - 0.5) + Math.abs(((z - cz) % 1 + 1) % 1 - 0.5);
      if (dm < 0.18) return p.trim;
      if (dm < 0.26) return p.border;
      return jitter(p.field, () => hash2(Math.floor(x * 9), Math.floor(z * 9), 95), 0.03);
    },
  });
  // Tassels at the two short ends.
  const extras: THREE.BufferGeometry[] = [];
  for (let x = o.x0 + 0.06; x < o.x0 + o.w; x += 0.12) {
    for (const z of [o.z0 - 0.06, o.z0 + o.d + 0.06]) {
      const g = new THREE.BoxGeometry(0.03, 0.012, 0.12);
      g.translate(x, 0.02, z);
      extras.push(painted(g, p.trim));
    }
  }
  const base = surface({ ...o, seg: 1, height: () => 0.015, color: () => p.border });
  const { group, piece } = patch(o, geo, extras);
  group.add(mesh(base, VCOL(), false));
  return piece;
};

export const glowFloor: Builder = (o) => {
  const piece = marble({ ...o, variant: 0 });
  const lights = new NightLights();
  const colors = [0xffe9a0, 0x9fe8ff, 0xd0a8ff];
  const glow = glowMat(0xfff2c0, colors[o.variant] ?? colors[0]);
  lights.addMat(glow, 0.5, 2.0);
  // A ring with runes in every 2 m square.
  const parts: THREE.BufferGeometry[] = [];
  // One ring in the middle of every whole 2 m square of the patch.
  for (let j = 0; (j + 1) * TILE <= o.d + 0.01; j++) {
    for (let i = 0; (i + 1) * TILE <= o.w + 0.01; i++) {
      const cx = o.x0 + i * TILE + 1, cz = o.z0 + j * TILE + 1;
      const ring = new THREE.TorusGeometry(0.62, 0.03, 3, 24);
      ring.rotateX(-Math.PI / 2);
      ring.scale(1, 0.3, 1);
      ring.translate(cx, 0.055, cz);
      parts.push(ring);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const r = new THREE.BoxGeometry(0.1, 0.01, 0.03);
        r.rotateY(-a + (k % 2) * 0.8);
        r.translate(cx + Math.cos(a) * 0.45, 0.055, cz + Math.sin(a) * 0.45);
        parts.push(r);
      }
      const star = new THREE.CircleGeometry(0.16, 4);
      star.rotateX(-Math.PI / 2);
      star.rotateY(Math.PI / 4);
      star.translate(cx, 0.056, cz);
      parts.push(star);
    }
  }
  if (parts.length) piece.object.add(mesh(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!, glow, false));
  piece.update = (dt, t, env) => {
    lights.update(dt, t, { ...env, night: Math.max(env.night, 0.3) });
    glow.emissiveIntensity *= 0.85 + Math.sin(t * 1.5) * 0.15;
  };
  piece.poke = () => (lights.flickerTime = 0.6);
  return piece;
};

export const caveFloor: Builder = (o) => {
  const damp = o.variant === 1;
  const mine = o.variant === 2;
  const geo = surface({
    ...o, seg: 6,
    height: (x, z) => noise2(x, z, 1.4, 101) * 0.16 + noise2(x, z, 0.5, 102) * 0.04,
    color: (x, z) => {
      const n = noise2(x, z, 1.4, 101);
      let c = mix(0x4a4540, 0x5e5850, n);
      if (damp && noise2(x, z, 1.1, 103) < 0.35) c = 0x34363a;
      if (mine) c = mix(0x5a4a3a, 0x6e5c48, n);
      return jitter(c, () => hash2(Math.floor(x * 7), Math.floor(z * 7), 104), 0.07);
    },
  });
  const extras: THREE.BufferGeometry[] = [];
  scatter(o, 2.5, 105, (x, z, rng) => extras.push(pebble(x, noise2(x, z, 1.4, 101) * 0.16, z, 0.04 + rng() * 0.08, jitter(0x5e5a54, rng, 0.12), rng)));
  if (mine) {
    // An old mine-cart track running along x.
    const zc = o.z0 + o.d / 2;
    for (let x = Math.ceil(o.x0 / 0.6) * 0.6; x < o.x0 + o.w; x += 0.6) {
      const g = new THREE.BoxGeometry(0.16, 0.06, 1.0);
      g.translate(x, 0.12, zc);
      extras.push(painted(g, jitter(0x6e4c30, makeRng(Math.round(x * 10) + 7), 0.1)));
    }
    for (const dz of [-0.32, 0.32]) {
      const g = new THREE.BoxGeometry(o.w, 0.05, 0.05);
      g.translate(o.x0 + o.w / 2, 0.175, zc + dz);
      extras.push(painted(g, 0x5c5e62));
    }
  }
  const material = damp ? mat(0xffffff, { vertexColors: true, roughness: 0.4 }) : VCOL();
  return patch(o, geo, extras, material).piece;
};

const CRYSTALS = [[0xb07ae8, 0x8a4ad0], [0x5a9ef0, 0x2a6ad0], [0xb07ae8, 0x5a9ef0, 0x6ae0b0, 0xf07aa8]];

export const crystalFloor: Builder = (o) => {
  const base = caveFloor({ ...o, variant: 0 });
  const set = CRYSTALS[o.variant] ?? CRYSTALS[0];
  const lights = new NightLights();
  const mats = set.map((c) => {
    const m = glowMat(c, c, { roughness: 0.2 });
    lights.addMat(m, 0.6, 1.6);
    return m;
  });
  const byMat: THREE.BufferGeometry[][] = mats.map(() => []);
  scatter(o, 1.1, 111, (x, z, rng) => {
    const k = Math.floor(rng() * set.length);
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const h = 0.12 + rng() * 0.3;
      const g = new THREE.CylinderGeometry(0, 0.04 + rng() * 0.03, h, 5);
      g.translate(0, h / 2, 0);
      g.rotateZ((rng() - 0.5) * 0.9);
      g.rotateX((rng() - 0.5) * 0.9);
      g.translate(x + (rng() - 0.5) * 0.1, noise2(x, z, 1.4, 101) * 0.16, z + (rng() - 0.5) * 0.1);
      byMat[k].push(g);
    }
  });
  byMat.forEach((list, k) => list.length && base.object.add(mesh(mergeGeometries(list.map((g) => g.toNonIndexed()))!, mats[k])));
  base.update = (dt, t, env) => lights.update(dt, t, { ...env, night: 0.6 + Math.sin(t * 0.9) * 0.15 });
  return base;
};
