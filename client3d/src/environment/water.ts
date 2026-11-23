// Water: the lake and ponds, the river, the sea and waterfalls.
//
// Each piece brings its own banks (the ground dips down under the water) so
// it can be dropped straight into a scene. Water is a low-poly sheet whose
// corners bob up and down; the flat shading makes it sparkle as it moves.
import * as THREE from "three";
import { EnvPiece, NightLights, Parts, VCOL, disposeGroup, glowMat, hash2, jitter, makeRng, mat, mesh, mix, noise2, rockGeo, shade, surface } from "./kit";

export interface WaterOptions {
  variant: number;
  seed: number;
}
type Builder = (o: WaterOptions) => EnvPiece;

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** A rippling water sheet over a rectangle. `shape` says how deep each spot is (0 = dry). */
function waterSheet(o: {
  w: number; d: number; seg: number; y: number;
  shallow: number; deep: number;
  depth: (x: number, z: number) => number;
  wave: (x: number, z: number, t: number) => number;
  opacity?: number;
}) {
  const geo = surface({
    x0: -o.w / 2, z0: -o.d / 2, w: o.w, d: o.d, seg: o.seg,
    height: () => o.y,
    color: (x, z) => {
      const dd = o.depth(x, z);
      return jitter(mix(o.shallow, o.deep, smooth(dd)), () => hash2(Math.floor(x * 4), Math.floor(z * 4), 3), 0.03);
    },
  });
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.12, metalness: 0.15, transparent: true, opacity: o.opacity ?? 0.86 });
  (material as any).__own = true;
  const m = mesh(geo, material, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const rest = Float32Array.from(pos.array as Float32Array);
  return {
    mesh: m,
    material,
    update(t: number) {
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3], z = rest[i * 3 + 2];
        pos.setY(i, o.y + o.wave(x, z, t));
      }
      pos.needsUpdate = true;
    },
  };
}

/** Ground that dips under the water. `depth(x, z)` is 0 on dry land and 1 at the deepest. */
function basin(w: number, d: number, maxDepth: number, depth: (x: number, z: number) => number, land: (x: number, z: number) => number, bed: number, edge: number) {
  const geo = surface({
    x0: -w / 2, z0: -d / 2, w, d, seg: 6,
    height: (x, z) => -smooth(depth(x, z)) * maxDepth + noise2(x, z, 2, 9) * 0.06,
    color: (x, z) => {
      const dd = depth(x, z);
      if (dd <= 0.001) return land(x, z);
      if (dd < 0.18) return jitter(edge, () => hash2(Math.floor(x * 6), Math.floor(z * 6), 4), 0.06);
      return jitter(mix(bed, shade(bed, 0.6), dd), () => hash2(Math.floor(x * 6), Math.floor(z * 6), 5), 0.06);
    },
  });
  return mesh(geo, VCOL(), false);
}

const grassLand = (x: number, z: number) => jitter(mix(0x5e9a3a, 0x86bd52, noise2(x, z, 2.5, 2)), () => hash2(Math.floor(x * 7), Math.floor(z * 7), 3), 0.06);
const sandLand = (x: number, z: number) => mix(0xead29a, 0xe0c286, noise2(x, z, 1.5, 14));

/** Floating white flecks that drift with the water (and come round again). */
function flecks(n: number, area: { x0: number; x1: number; z0: number; z1: number }, y: number, speed: number, color = 0xffffff, size = 0.05, bendZ: (x: number) => number = () => 0) {
  const rng = makeRng(n * 7 + 1);
  const p = new Parts();
  for (let i = 0; i < n; i++) {
    const g = new THREE.CircleGeometry(size * (0.6 + rng()), 5);
    g.rotateX(-Math.PI / 2);
    g.scale(1.8, 1, 1);
    g.translate(0, 0, area.z0 + rng() * (area.z1 - area.z0));
    p.add(g, color);
  }
  const m = p.build(mat(0xffffff, { vertexColors: true, opacity: 0.75 }), false)!;
  m.position.y = y;
  const pos = m.geometry.attributes.position as THREE.BufferAttribute;
  const rest = Float32Array.from(pos.array as Float32Array);
  const offs = Array.from({ length: n }, () => rng());
  const per = pos.count / n;
  const L = area.x1 - area.x0;
  return {
    mesh: m,
    update(t: number) {
      for (let i = 0; i < pos.count; i++) {
        const k = Math.floor(i / per);
        const x = area.x0 + ((offs[k] * L + t * speed * (0.8 + offs[k] * 0.4)) % L);
        pos.setX(i, rest[i * 3] + x);
        pos.setZ(i, rest[i * 3 + 2] + bendZ(x));
      }
      pos.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- the lake and ponds

const PONDS = [
  { shallow: 0x6ac0d8, deep: 0x2a6a9a, bed: 0x8a7a5a, edge: 0xc8b080 }, // lake
  { shallow: 0x7ab8a0, deep: 0x3a7a6a, bed: 0x5a6a4a, edge: 0x8a7a5a }, // lily pond
  { shallow: 0x5a6a4a, deep: 0x2a3a2a, bed: 0x3a3428, edge: 0x5a4a3a }, // murky swamp
];

export const pond: Builder = (o) => {
  const p = PONDS[o.variant] ?? PONDS[0];
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const R = 3.6, size = 11;
  // A wobbly round shoreline.
  const shore = (x: number, z: number) => {
    const a = Math.atan2(z, x);
    const r = R * (1 + Math.sin(a * 3 + o.seed) * 0.08 + Math.sin(a * 5 + 1) * 0.05);
    return 1 - Math.hypot(x, z * 1.2) / r;
  };
  const depth = (x: number, z: number) => Math.max(0, shore(x, z)) * 2.2;
  const land = o.variant === 2 ? (x: number, z: number) => mix(0x6a6a48, 0x7d7458, noise2(x, z, 2, 8)) : grassLand;
  group.add(basin(size, size, 1.0, depth, land, p.bed, p.edge));
  const water = waterSheet({
    w: R * 2.4, d: R * 2.2, seg: 7, y: -0.12,
    shallow: p.shallow, deep: p.deep,
    depth,
    wave: (x, z, t) => Math.sin(x * 2.2 + t * 1.4) * 0.018 + Math.sin(z * 2.6 - t * 1.1) * 0.016,
    opacity: o.variant === 2 ? 0.92 : 0.82,
  });
  // Clip the sheet to the shoreline by hiding dry triangles under the bank.
  const wp = water.mesh.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < wp.count; i += 3) {
    const cx = (wp.getX(i) + wp.getX(i + 1) + wp.getX(i + 2)) / 3, cz = (wp.getZ(i) + wp.getZ(i + 1) + wp.getZ(i + 2)) / 3;
    if (shore(cx, cz) < -0.06) for (let k = 0; k < 3; k++) wp.setXYZ(i + k, cx, -5, cz);
  }
  const rest = Float32Array.from(wp.array as Float32Array);
  group.add(water.mesh);
  const extras = new THREE.Group();
  group.add(extras);
  // Lily pads and flowers.
  const pads: THREE.Object3D[] = [];
  if (o.variant === 1) {
    for (let i = 0; i < 9; i++) {
      const a = rng() * 6.28, r = 0.6 + rng() * 2.2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
      const pad = mesh(new THREE.CircleGeometry(0.28 + rng() * 0.12, 8, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2), mat(jitter(0x4e9a3a, rng, 0.1)), false);
      pad.position.set(x, -0.1, z);
      pad.rotation.y = rng() * 6;
      extras.add(pad);
      pads.push(pad);
      if (rng() < 0.4) {
        const f = new Parts();
        for (let k = 0; k < 6; k++) {
          const pet = new THREE.ConeGeometry(0.05, 0.14, 3);
          pet.rotateX(0.7);
          pet.translate(0, 0.05, 0.04);
          pet.rotateY((k / 6) * 6.28);
          f.add(pet, 0xf4c8e0);
        }
        const fm = f.build()!;
        fm.position.set(x + 0.08, -0.08, z);
        extras.add(fm);
        pads.push(fm);
      }
    }
  }
  // Bubbles rising in the swamp, with a faint glow at night.
  const lights = new NightLights();
  const bubbles: { m: THREE.Mesh; x: number; z: number; p: number }[] = [];
  if (o.variant === 2) {
    const bm = glowMat(0x9ab87a, 0x5a8a4a, { opacity: 0.8 });
    lights.addMat(bm, 0.1, 0.9);
    for (let i = 0; i < 7; i++) {
      const m = mesh(new THREE.SphereGeometry(0.06, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), bm, false);
      const a = rng() * 6.28, r = rng() * 2.2;
      bubbles.push({ m, x: Math.cos(a) * r, z: Math.sin(a) * r * 0.8, p: rng() });
      extras.add(m);
    }
  }
  // Pebbles and reeds round the edge.
  const edge = new Parts();
  for (let i = 0; i < 24; i++) {
    const a = rng() * 6.28;
    const r = R * (1 + Math.sin(a * 3 + o.seed) * 0.08 + Math.sin(a * 5 + 1) * 0.05);
    const x = Math.cos(a) * r * (0.95 + rng() * 0.12), z = (Math.sin(a) * r * (0.95 + rng() * 0.12)) / 1.2;
    const g = rockGeo(0.08 + rng() * 0.12, rng, 0.6);
    g.translate(x, 0, z);
    edge.add(g, jitter(0x8e8a82, rng, 0.1));
  }
  extras.add(edge.build()!);
  let splash = 0;
  const ringMat = mat(0xffffff, { opacity: 0.6 });
  const ring = mesh(new THREE.RingGeometry(0.9, 1.0, 20).rotateX(-Math.PI / 2), ringMat, false);
  ring.visible = false;
  group.add(ring);
  return {
    object: group,
    update(dt, t, env) {
      lights.update(dt, t, env);
      splash = Math.max(0, splash - dt * 0.7);
      const amp = 1 + env.wind + splash * 6;
      for (let i = 0; i < wp.count; i++) {
        const x = rest[i * 3], z = rest[i * 3 + 2];
        if (rest[i * 3 + 1] < -1) continue;
        const r = Math.hypot(x, z);
        wp.setY(i, -0.12 + (Math.sin(x * 2.2 + t * 1.4) * 0.012 + Math.sin(z * 2.6 - t * 1.1) * 0.01) * amp + Math.sin(r * 5 - t * 8) * splash * 0.06 * Math.max(0, 1 - r / 4));
      }
      wp.needsUpdate = true;
      pads.forEach((pd, i) => (pd.position.y = -0.1 + Math.sin(t * 1.2 + i) * 0.01 + Math.sin(Math.hypot(pd.position.x, pd.position.z) * 5 - t * 8) * splash * 0.05));
      for (const b of bubbles) {
        const k = (t * 0.4 + b.p) % 1;
        b.m.position.set(b.x, -0.12, b.z);
        b.m.scale.setScalar(k < 0.8 ? k / 0.8 : 1 - (k - 0.8) * 5);
      }
      ring.visible = splash > 0.01;
      ring.scale.setScalar(0.3 + (1 - splash) * 3);
      ring.position.y = -0.08;
      ringMat.opacity = splash * 0.7;
    },
    poke: () => (splash = 1),
    dispose: () => disposeGroup(group),
  };
};

// ---------------------------------------------------------------- the river

const RIVERS = [
  { shallow: 0x6ab8d0, deep: 0x2e74a0, half: 1.5, speed: 1.0 }, // gentle
  { shallow: 0x7ac4d8, deep: 0x2a6a98, half: 1.6, speed: 2.4 }, // rapids
  { shallow: 0x8ad0e0, deep: 0x4a90b8, half: 0.8, speed: 1.6 }, // mountain stream
];

export const river: Builder = (o) => {
  const p = RIVERS[o.variant] ?? RIVERS[0];
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const L = 20, D = 9;
  const bend = (x: number) => Math.sin(x * 0.35 + o.seed) * 0.5;
  const depth = (x: number, z: number) => Math.max(0, 1 - Math.abs(z - bend(x)) / p.half) * 1.6;
  const stony = o.variant === 2;
  group.add(basin(L, D, stony ? 0.6 : 0.9, depth, stony ? (x, z) => jitter(mix(0x7a9a4a, 0x8a8a7a, noise2(x, z, 1.5, 3)), () => hash2(Math.floor(x * 5), Math.floor(z * 5), 6), 0.08) : grassLand, 0x7a6a50, stony ? 0x9a968c : 0x8a7a5a));
  const water = waterSheet({
    w: L, d: p.half * 2 + 0.6, seg: 8, y: -0.14,
    shallow: p.shallow, deep: p.deep,
    depth,
    wave: () => 0,
  });
  // Bend the water sheet to follow the river.
  const wp = water.mesh.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < wp.count; i++) wp.setZ(i, wp.getZ(i) + bend(wp.getX(i)));
  const rest = Float32Array.from(wp.array as Float32Array);
  group.add(water.mesh);
  // Foam and flecks floating downstream (+x).
  const fl = flecks(o.variant === 1 ? 40 : 18, { x0: -L / 2, x1: L / 2, z0: -p.half * 0.7, z1: p.half * 0.7 }, -0.1, p.speed, 0xffffff, o.variant === 1 ? 0.08 : 0.04, bend);
  group.add(fl.mesh);
  // Rocks in and beside the water.
  const r = new Parts();
  const nRocks = o.variant === 1 ? 9 : stony ? 14 : 4;
  const rockSpots: [number, number][] = [];
  for (let i = 0; i < nRocks; i++) {
    const x = -L / 2 + 0.5 + rng() * (L - 1);
    const z = bend(x) + (rng() - 0.5) * p.half * (stony ? 2.6 : 1.6);
    const g = rockGeo(0.15 + rng() * (o.variant === 1 ? 0.3 : 0.2), rng, 0.7);
    g.translate(x, -0.12, z);
    r.add(g, jitter(0x8a867e, rng, 0.1));
    rockSpots.push([x, z]);
  }
  group.add(r.build()!);
  // White water around the rocks in the rapids.
  const foam = new Parts();
  if (o.variant === 1) for (const [x, z] of rockSpots) {
    const g = new THREE.RingGeometry(0.25, 0.45, 8, 1, -1.3, 2.6);
    g.rotateX(-Math.PI / 2);
    g.translate(x - 0.1, -0.1, z);
    foam.add(g, 0xffffff);
  }
  const foamMesh = foam.build(mat(0xffffff, { vertexColors: true, opacity: 0.7 }), false);
  if (foamMesh) group.add(foamMesh);
  let surge = 0;
  return {
    object: group,
    update(dt, t, env) {
      surge = Math.max(0, surge - dt * 0.5);
      const sp = p.speed * (1 + surge * 2);
      const choppy = o.variant === 1 ? 0.05 : 0.018;
      for (let i = 0; i < wp.count; i++) {
        const x = rest[i * 3], z = rest[i * 3 + 2];
        wp.setY(i, -0.14 + (Math.sin(x * 3 - t * sp * 3) * choppy + Math.sin(z * 4 + x - t * sp * 2) * choppy * 0.6) * (1 + env.wind * 0.5 + surge));
      }
      wp.needsUpdate = true;
      fl.update(t * (1 + surge));
      if (foamMesh) (foamMesh.material as THREE.MeshStandardMaterial).opacity = 0.5 + Math.sin(t * 6) * 0.15;
    },
    poke: () => (surge = 1),
    dispose: () => disposeGroup(group),
  };
};

// ---------------------------------------------------------------- the sea

const SEAS = [
  { shallow: 0x7ac8d8, deep: 0x1e5a8a, wave: 0.06 }, // calm
  { shallow: 0x6ab0c8, deep: 0x1a4a78, wave: 0.16 }, // choppy
  { shallow: 0x6ae0d8, deep: 0x1a8ab0, wave: 0.05 }, // bright turquoise
];

export const sea: Builder = (o) => {
  const p = SEAS[o.variant] ?? SEAS[0];
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const W = 14, D = 12;
  // Beach at the back (-z), sea out to the front (+z).
  const shoreZ = (x: number) => -1.2 + Math.sin(x * 0.5 + o.seed) * 0.5;
  const depth = (x: number, z: number) => Math.max(0, (z - shoreZ(x)) / 6);
  group.add(basin(W, D, 1.6, depth, sandLand, 0xd8c08a, 0xc8ac78));
  const water = waterSheet({
    w: W, d: D, seg: 6, y: -0.1,
    shallow: p.shallow, deep: p.deep,
    depth: (x, z) => Math.min(1, depth(x, z) * 1.4),
    wave: () => 0,
    opacity: 0.85,
  });
  const wp = water.mesh.geometry.attributes.position as THREE.BufferAttribute;
  // Drop the sheet's dry part under the sand.
  for (let i = 0; i < wp.count; i += 3) {
    const cx = (wp.getX(i) + wp.getX(i + 1) + wp.getX(i + 2)) / 3, cz = (wp.getZ(i) + wp.getZ(i + 1) + wp.getZ(i + 2)) / 3;
    if (cz < shoreZ(cx) - 0.8) for (let k = 0; k < 3; k++) wp.setXYZ(i + k, cx, -5, cz);
  }
  const rest = Float32Array.from(wp.array as Float32Array);
  group.add(water.mesh);
  // Foam where the waves wash up the beach.
  const foam = new Parts();
  for (let x = -W / 2; x < W / 2; x += 0.4) {
    const g = new THREE.BoxGeometry(0.42, 0.02, 0.22 + rng() * 0.12);
    g.translate(x + 0.2, 0, shoreZ(x + 0.2) + (rng() - 0.5) * 0.1);
    foam.add(g, 0xffffff);
  }
  const foamMesh = foam.build(mat(0xffffff, { vertexColors: true, opacity: 0.8 }), false)!;
  group.add(foamMesh);
  // A few rocks out in the water.
  const rk = new Parts();
  for (let i = 0; i < 4; i++) {
    const x = -W / 2 + 1 + rng() * (W - 2), z = 2 + rng() * 3;
    const g = rockGeo(0.35 + rng() * 0.4, rng, 0.9);
    g.translate(x, -0.3, z);
    rk.add(g, jitter(0x6e6a64, rng, 0.1));
  }
  group.add(rk.build()!);
  let swell = 0;
  return {
    object: group,
    update(dt, t, env) {
      swell = Math.max(0, swell - dt * 0.35);
      const amp = p.wave * (1 + env.wind * 0.8 + swell * 2.5);
      for (let i = 0; i < wp.count; i++) {
        if (rest[i * 3 + 1] < -1) continue;
        const x = rest[i * 3], z = rest[i * 3 + 2];
        const toShore = Math.max(0, Math.min(1, (z - shoreZ(x)) / 3));
        wp.setY(i, -0.1 + (Math.sin(z * 1.6 + t * 1.6) * 0.7 + Math.sin(x * 1.3 + z * 0.4 - t * 0.9) * 0.4) * amp * toShore + Math.sin(t * 0.8) * 0.04);
      }
      wp.needsUpdate = true;
      // Foam runs up the sand and back.
      const run = (Math.sin(t * 0.8) * 0.5 + 0.5) * (0.6 + swell);
      foamMesh.position.z = -run * 0.7 + 0.15;
      foamMesh.position.y = -0.08 + Math.sin(t * 0.8) * 0.03;
      (foamMesh.material as THREE.MeshStandardMaterial).opacity = 0.45 + run * 0.4;
    },
    poke: () => (swell = 1),
    dispose: () => disposeGroup(group),
  };
};

// ---------------------------------------------------------------- waterfalls

export const waterfall: Builder = (o) => {
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const wide = o.variant === 1, cascade = o.variant === 2;
  const H = o.variant === 0 ? 6 : wide ? 4 : 4.8;
  const fallW = wide ? 4.5 : 1.8;
  // Each tier: water leaves a lip at `top` (at depth z) and falls to `bot`.
  const tiers = cascade
    ? [{ top: H, bot: H * 0.66, z: -1.3 }, { top: H * 0.66, bot: H * 0.33, z: -0.45 }, { top: H * 0.33, bot: 0, z: 0.4 }]
    : [{ top: H, bot: 0, z: -1.3 }];
  const out = cascade ? 0.3 : 0.45; // how far the water arcs out from the lip
  // The cliff behind: rock layers with a notch where the water runs.
  const cliff = new Parts();
  for (let y = 0; y < H; y += 0.75) {
    for (let x = -6; x < 6; x += 0.9) {
      if (Math.abs(x + 0.45) < fallW / 2 + 0.1 && y > 0) {
        cliff.box(0.95, 0.78, 0.8, jitter(0x4e4a44, rng, 0.08), x + 0.45, y + 0.38, -2.2);
        continue;
      }
      const c = jitter(Math.floor(y / 0.75) % 2 ? 0x8a8072 : 0x7a7064, rng, 0.08);
      cliff.box(0.95, 0.8, 1.6, c, x + 0.45, y + 0.4, -1.6 + (rng() - 0.5) * 0.2 - y * 0.04);
    }
  }
  cliff.box(12.2, 0.25, 3, 0x76ae48, 0, H + 0.1, -2.4);
  // Rock shelves for the cascade, each with a shallow pool on top.
  const shelfWater = new Parts();
  tiers.forEach((t, i) => {
    if (i === 0) return;
    const back = -2.4, front = t.z + 0.12;
    const d = front - back;
    for (let x = -fallW / 2 - 0.7; x < fallW / 2 + 0.7; x += 0.55) {
      cliff.box(0.6, 0.4 + rng() * 0.1, d, jitter(0x7a7268, rng, 0.08), x + 0.27, t.top - 0.22, back + d / 2);
    }
    // A little rim of stones along the front edge.
    for (let x = -fallW / 2 - 0.5; x < fallW / 2 + 0.5; x += 0.35) {
      const g = rockGeo(0.13 + rng() * 0.05, rng, 0.6);
      g.translate(x, t.top + 0.03, front - 0.08);
      cliff.add(g, jitter(0x6e6a62, rng, 0.1));
    }
    shelfWater.box(fallW + 0.6, 0.05, d - 0.3, 0x6ab8d8, 0, t.top + 0.02, back + d / 2 - 0.1);
  });
  group.add(cliff.build()!);
  const sw = shelfWater.build(mat(0xffffff, { vertexColors: true, opacity: 0.85, roughness: 0.1 }), false);
  if (sw) group.add(sw);
  // The pool at the bottom.
  const poolDepth = (x: number, z: number) => Math.max(0, 1 - Math.hypot(x / 3.4, (z + 0.6) / 2.2)) * 1.6;
  const ground = basin(12, 8, 0.8, poolDepth, grassLand, 0x6a6a5a, 0x8e8a82);
  ground.position.z = 2;
  group.add(ground);
  const pool = waterSheet({ w: 7.4, d: 5, seg: 6, y: -0.1, shallow: 0x7ac4d8, deep: 0x2a6a98, depth: poolDepth, wave: () => 0 });
  pool.mesh.position.z = 2;
  const pp = pool.mesh.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i += 3) {
    const cx = (pp.getX(i) + pp.getX(i + 1) + pp.getX(i + 2)) / 3, cz = (pp.getZ(i) + pp.getZ(i + 1) + pp.getZ(i + 2)) / 3;
    if (poolDepth(cx, cz) <= 0.0) for (let k = 0; k < 3; k++) pp.setXYZ(i + k, cx, -5, cz);
  }
  const prest = Float32Array.from(pp.array as Float32Array);
  group.add(pool.mesh);
  // The falling water: one rippling ribbon per tier, pouring off its lip.
  const fallMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.84, side: THREE.DoubleSide });
  (fallMat as any).__own = true;
  const falls = tiers.map((t) => {
    const h = t.top - t.bot + 0.15;
    const cols = Math.round(fallW / 0.3), rows = Math.max(3, Math.round(h / 0.3));
    const g = new THREE.PlaneGeometry(fallW, h, cols, rows).toNonIndexed();
    g.translate(0, t.bot + h / 2 - 0.05, 0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const rest = Float32Array.from(pos.array as Float32Array);
    const col = new Float32Array(pos.count * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    group.add(mesh(g, fallMat, false));
    return { t, g, pos, rest, col, h };
  });
  // Splash bits and mist where each tier lands.
  const spray: { m: THREE.Mesh; p: number; x: number; a: number; y: number; z: number }[] = [];
  const sprayMat = mat(0xffffff, { opacity: 0.75 });
  const mistMat = mat(0xffffff, { opacity: 0.25 });
  const mist: { m: THREE.Mesh; y: number }[] = [];
  tiers.forEach((t) => {
    const landZ = t.z + out + 0.1;
    for (let i = 0; i < (cascade ? 12 : 26); i++) {
      const m = mesh(new THREE.IcosahedronGeometry(0.05 + rng() * 0.06, 0), sprayMat, false);
      spray.push({ m, p: rng(), x: (rng() - 0.5) * fallW, a: rng() * 6.28, y: t.bot, z: landZ });
      group.add(m);
    }
    for (let i = 0; i < (cascade ? 2 : 5); i++) {
      const m = mesh(new THREE.IcosahedronGeometry((cascade ? 0.4 : 0.6) + rng() * 0.4, 0), mistMat, false);
      m.position.set((rng() - 0.5) * fallW, t.bot + 0.2, landZ + rng() * 0.4);
      m.scale.y = 0.5;
      mist.push({ m, y: t.bot + 0.2 });
      group.add(m);
    }
  });
  const c1 = new THREE.Color(0xe8f8ff), c2 = new THREE.Color(0x6ab8d8), c = new THREE.Color();
  let gush = 0;
  return {
    object: group,
    update(dt, t, env) {
      gush = Math.max(0, gush - dt * 0.5);
      const speed = 3 + gush * 3;
      for (const f of falls) {
        for (let i = 0; i < f.pos.count; i++) {
          const x = f.rest[i * 3], y = f.rest[i * 3 + 1];
          const k = Math.max(0, Math.min(1, (f.t.top - y) / Math.max(0.5, f.h))); // 0 at the lip, 1 at the bottom
          // Water curves out over the lip, then drops.
          const z = f.t.z + Math.sin(Math.min(1, k * 2.2) * Math.PI * 0.5) * out;
          f.pos.setXYZ(i, x + Math.sin(y * 3 + t * 2 + x) * 0.03, y, z + Math.sin(y * 5 + t * speed * 2 + x * 4) * 0.04);
        }
        f.pos.needsUpdate = true;
        for (let i = 0; i < f.pos.count; i += 3) {
          const x = (f.rest[i * 3] + f.rest[i * 3 + 3] + f.rest[i * 3 + 6]) / 3, y = (f.rest[i * 3 + 1] + f.rest[i * 3 + 4] + f.rest[i * 3 + 7]) / 3;
          const s2 = Math.sin(y * 2.2 + t * speed * 2.2 + Math.sin(x * 7) * 3) * 0.5 + 0.5;
          c.copy(c2).lerp(c1, Math.min(1, Math.pow(s2, 3) * 0.9 + (y < f.t.bot + 0.5 ? 0.6 : 0) + (y > f.t.top - 0.2 ? 0.3 : 0)));
          for (let k = 0; k < 3; k++) c.toArray(f.col, (i + k) * 3);
        }
        (f.g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      }
      for (const s2 of spray) {
        const k = (t * (0.9 + gush) + s2.p) % 1;
        s2.m.position.set(s2.x + Math.cos(s2.a) * k * 0.7, s2.y + Math.sin(k * Math.PI) * (cascade ? 0.4 : 0.7) * (1 + gush * 0.8), s2.z + Math.sin(s2.a) * k * 0.4 + k * 0.4);
        s2.m.scale.setScalar(1 - k * 0.6);
      }
      mist.forEach((m, i) => {
        m.m.position.y = m.y + Math.sin(t * 0.7 + i) * 0.1;
        m.m.rotation.y = t * 0.2 + i;
      });
      for (let i = 0; i < pp.count; i++) {
        if (prest[i * 3 + 1] < -1) continue;
        const x = prest[i * 3], z = prest[i * 3 + 2];
        const r = Math.hypot(x, z - (tiers[tiers.length - 1].z + out - 2));
        pp.setY(i, -0.1 + Math.sin(r * 5 - t * 5) * 0.025 * Math.max(0, 1 - r / 5) * (1 + gush * 2) + Math.sin(x * 2 + t) * 0.01 * (1 + env.wind));
      }
      pp.needsUpdate = true;
    },
    poke: () => (gush = 1),
    dispose: () => disposeGroup(group),
  };
};
