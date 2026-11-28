// Props, fences and bridges: barrels, crates, lamps, the well, signposts,
// market stalls, carts, benches, campfires, hay; wooden and stone fences,
// hedges, gates; plank and stone bridges.
import { THREE, rng, Builder, paint, mix, blob, leafCards, leafTexture, mat, foliageShade } from "./lib.js";
import { M, box, post, logX, turned, ring, groundAO, flameGeo, gableRoof, coneRoof, limb } from "./kit.js";

// ---------- Props ----------

function barrel(seed, variant) {
  const b = new Builder("prop_barrel");
  const H = 0.9, R = 0.32;
  const prof = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([R * (0.86 + 0.14 * Math.sin(t * Math.PI)), t * H]); }
  prof.unshift([0, 0]); prof.push([0, H]);
  b.put(paint(turned(prof, 18, 0xffffff, 1), groundAO(0.4, 0.2)), M.wood());
  for (const t of [0.12, 0.38, 0.62, 0.88]) {
    const rr = R * (0.86 + 0.14 * Math.sin(t * Math.PI)) + 0.008;
    b.put(ring(rr, 0.014, 0xffffff, 24), M.iron(), { p: [0, t * H, 0] });
  }
  if (variant === 1) {
    // full of apples
    const r = rng(seed);
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.28, d = r() * 0.2;
      b.put(paint(new THREE.IcosahedronGeometry(0.05, 2), () => mix(0xc8303a, 0xe86a3a, r())), M.cloth(), { p: [Math.cos(a) * d, H + 0.02, Math.sin(a) * d] });
    }
  }
  return b.build();
}

function crate(seed, variant) {
  const b = new Builder("prop_crate");
  const r = rng(seed);
  const stack = variant === 1 ? 3 : 1;
  for (let i = 0; i < stack; i++) {
    const s = i === 2 ? 0.5 : 0.6;
    const p = i === 0 ? [0, s / 2, 0] : i === 1 ? [0.66, s / 2, 0.05] : [0.3, 0.6 + s / 2, 0];
    b.put(paint(box(s, s, s, { bevel: 0.02, tex: 0.6 }), groundAO(0.4, 0.15)), M.wood(), { p, r: [0, r.range(-0.2, 0.2), 0] });
    // frame boards on the edges
    for (const y of [-1, 1]) for (const z of [-1, 1]) b.put(box(s + 0.02, 0.06, 0.06, { bevel: 0.01 }), M.woodDark(), { p: [p[0], p[1] + y * (s / 2 - 0.03), p[2] + z * (s / 2 - 0.03)] });
  }
  return b.build();
}

function lampPost(seed) {
  const b = new Builder("prop_lamp_post");
  b.put(paint(post(0.06, 2.6, { sides: 10, taper: 0.8 }), groundAO(0.6, 0.3)), M.iron());
  b.put(turned([[0, 0], [0.16, 0], [0.16, 0.08], [0.08, 0.16], [0, 0.16]], 12), M.rock(), {});
  b.put(box(0.5, 0.04, 0.04), M.iron(), { p: [0.2, 2.5, 0] });
  // a hanging lantern with a glowing glass box
  b.put(post(0.01, 0.12, { sides: 4 }), M.iron(), { p: [0.4, 2.36, 0] });
  b.put(box(0.18, 0.24, 0.18, { bevel: 0.02 }), M.lamp(), { p: [0.4, 2.22, 0] });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.put(box(0.02, 0.28, 0.02, { bevel: 0.005 }), M.iron(), { p: [0.4 + x * 0.09, 2.22, z * 0.09] });
  b.put(coneRoof(0.15, 0.1, 4), M.iron(), { p: [0.4, 2.35, 0], r: [0, Math.PI / 4, 0] });
  b.put(box(0.2, 0.03, 0.2), M.iron(), { p: [0.4, 2.09, 0] });
  return b.build();
}

function well(seed) {
  const b = new Builder("prop_well");
  // a round stone wall, two posts, a little tiled roof, a winch and a bucket
  const prof = [[0.7, 0], [0.75, 0.05], [0.75, 0.75], [0.78, 0.8], [0.58, 0.82], [0.55, 0.78], [0.55, 0.1], [0.55, 0.0]];
  b.put(paint(turned(prof, 20, 0xffffff, 1), groundAO(0.7, 0.25)), M.stone());
  const water = new THREE.CircleGeometry(0.55, 18); water.rotateX(-Math.PI / 2);
  b.put(paint(water, () => new THREE.Color(0x2f7fb0)), mat("well_water", { roughness: 0.05 }), { p: [0, 0.45, 0] });
  for (const x of [-0.66, 0.66]) b.put(post(0.06, 1.9, { sides: 8 }), M.log(), { p: [x, 0.7, 0] });
  b.put(logX(0.06, 1.3), M.log(), { p: [0, 1.6, 0] });
  b.put(post(0.008, 0.6, { sides: 4, color: 0xc8b088 }), M.cloth(), { p: [0, 1.0, 0] });
  b.put(turned([[0, 0], [0.11, 0], [0.13, 0.18], [0.12, 0.2], [0, 0.03]], 12), M.wood(), { p: [0, 0.85, 0] });
  b.put(ring(0.125, 0.008, 0xffffff, 16), M.iron(), { p: [0, 0.98, 0] });
  gableRoof(b, M.roof(), 1.5, 1.4, 0.55, { over: 0.15, thick: 0.08, color: 0xb4553a, at: [0, 2.3, 0] });
  b.put(box(0.06, 0.08, 1.5), M.log(), { p: [-0.66, 2.3, 0] });
  b.put(box(0.06, 0.08, 1.5), M.log(), { p: [0.66, 2.3, 0] });
  return b.build();
}

function signpost(seed) {
  const b = new Builder("prop_signpost");
  b.put(paint(post(0.07, 2.4, { sides: 8 }), groundAO(0.5, 0.3)), M.log());
  const r = rng(seed);
  const signs = [[2.05, 0.3], [1.75, -0.6], [1.45, 1.8]];
  for (const [y, a] of signs) {
    const g = new THREE.Shape();
    g.moveTo(0, -0.1); g.lineTo(0.62, -0.1); g.lineTo(0.75, 0); g.lineTo(0.62, 0.1); g.lineTo(0, 0.1); g.closePath();
    const geo = new THREE.ExtrudeGeometry(g, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 1 });
    geo.translate(0.05, 0, -0.017);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
    b.put(paint(geo, () => mix(0xc8a070, 0xe0c090, r())), M.wood(), { p: [0, y, 0], r: [0, a, 0] });
  }
  return b.build();
}

/** A striped awning texture is drawn into the vertex colour: stripes along X. */
function stall(seed, variant) {
  const b = new Builder("prop_market_stall");
  const r = rng(seed);
  const stripe = [[0xb4473c, 0xf2ead8], [0x3f64a8, 0xf2ead8], [0x4f7f45, 0xf2ead8]][variant];
  // counter, four posts, a sloped striped awning, and goods on the counter
  b.put(paint(box(2.0, 0.9, 0.8, { bevel: 0.03, tex: 1 }), groundAO(0.8, 0.2)), M.wood(), { p: [0, 0.45, 0.2] });
  b.put(box(2.1, 0.06, 0.9, { bevel: 0.02 }), M.woodDark(), { p: [0, 0.93, 0.2] });
  for (const x of [-1, 1]) for (const [z, h] of [[0.6, 2.1], [-0.4, 2.5]]) b.put(post(0.05, h, { sides: 8 }), M.log(), { p: [x * 1.02, 0, z] });
  const aw = new THREE.PlaneGeometry(2.3, 1.25, 16, 2);
  aw.rotateX(-Math.PI / 2 + 0.33);
  b.put(paint(aw, (v) => (Math.floor((v.x + 1.15) / 0.2875) % 2 ? new THREE.Color(stripe[0]) : new THREE.Color(stripe[1]))), mat("awning", { roughness: 0.9, double: true }), { p: [0, 2.3, 0.1] });
  // scalloped valance at the front
  for (let i = 0; i < 8; i++) {
    const c = new THREE.CircleGeometry(0.144, 10, Math.PI, Math.PI);
    b.put(paint(c, () => new THREE.Color(i % 2 ? stripe[1] : stripe[0])), mat("awning", { roughness: 0.9, double: true }), { p: [-1.0 + i * 0.2875, 2.1, 0.7] });
  }
  // goods: baskets of fruit and veg
  for (let i = 0; i < 3; i++) {
    const x = -0.6 + i * 0.6;
    b.put(turned([[0, 0], [0.18, 0], [0.22, 0.12], [0.2, 0.13], [0, 0.02]], 14, 0xc8a06a), M.wood(), { p: [x, 0.96, 0.25] });
    const col = [0xd8342e, 0xf0943a, 0x8cc850][i];
    for (let k = 0; k < 6; k++) b.put(paint(new THREE.IcosahedronGeometry(0.055, 1), () => mix(col, 0xffffff, r() * 0.2)), M.cloth(), { p: [x + r.range(-0.1, 0.1), 1.1, 0.25 + r.range(-0.1, 0.1)] });
  }
  return b.build();
}

function cart(seed) {
  const b = new Builder("prop_cart");
  // a hand cart: plank bed with low sides, two spoked wheels and long handles
  b.put(box(1.6, 0.08, 1.0, { bevel: 0.02, tex: 1 }), M.wood(), { p: [0, 0.62, 0] });
  for (const z of [-0.48, 0.48]) b.put(box(1.6, 0.28, 0.05, { bevel: 0.015, tex: 1 }), M.wood(), { p: [0, 0.8, z] });
  b.put(box(0.05, 0.28, 1.0, { bevel: 0.015 }), M.wood(), { p: [-0.78, 0.8, 0] });
  for (const z of [-0.36, 0.36]) b.put(box(1.4, 0.06, 0.06, { bevel: 0.015 }), M.woodDark(), { p: [1.35, 0.6, z], r: [0, 0, 0.25] });
  b.put(logX(0.035, 1.3), M.iron(), { p: [-0.1, 0.42, 0], r: [0, Math.PI / 2, 0] });
  for (const z of [-0.62, 0.62]) {
    const t = new THREE.TorusGeometry(0.4, 0.04, 8, 24);
    b.put(paint(t, () => new THREE.Color(0x8a6440)), M.woodDark(), { p: [-0.1, 0.42, z] });
    b.put(new THREE.TorusGeometry(0.41, 0.015, 6, 24), M.iron(), { p: [-0.1, 0.42, z] });
    for (let i = 0; i < 4; i++) b.put(post(0.018, 0.8, { sides: 5 }), M.woodDark(), { p: [-0.1 + Math.sin(i * Math.PI / 4) * 0.4, 0.42 - Math.cos(i * Math.PI / 4) * 0.4, z], r: [0, 0, i * Math.PI / 4] });
  }
  // a sack and a crate in the back
  b.put(paint(blob(0.25, { detail: 2, lump: 0.15, seed: 3, squash: [1, 1.3, 0.9] }), () => new THREE.Color(0xd8c49a)), M.cloth(), { p: [-0.35, 0.95, 0.1] });
  b.put(box(0.4, 0.35, 0.4, { bevel: 0.02, tex: 0.5 }), M.wood(), { p: [0.3, 0.84, -0.1], r: [0, 0.3, 0] });
  return b.build();
}

function bench(seed) {
  const b = new Builder("prop_bench");
  b.put(box(1.6, 0.07, 0.4, { bevel: 0.02, tex: 1 }), M.wood(), { p: [0, 0.45, 0] });
  for (const x of [-0.65, 0.65]) b.put(paint(box(0.08, 0.42, 0.36, { bevel: 0.02 }), groundAO(0.4, 0.2)), M.wood(), { p: [x, 0.21, 0] });
  b.put(box(1.6, 0.25, 0.05, { bevel: 0.02, tex: 1 }), M.wood(), { p: [0, 0.75, -0.2], r: [-0.15, 0, 0] });
  for (const x of [-0.65, 0.65]) b.put(box(0.07, 0.4, 0.06, { bevel: 0.015 }), M.wood(), { p: [x, 0.65, -0.18], r: [-0.15, 0, 0] });
  return b.build();
}

function campfire(seed) {
  const b = new Builder("prop_campfire");
  const r = rng(seed);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.28;
    const g = blob(0.12, { detail: 1, lump: 0.25, seed: i, squash: [1.2, 0.7, 1] });
    b.put(paint(g, () => mix(0x8a8780, 0xb0aca2, r())), M.rock(), { p: [Math.cos(a) * 0.55, 0.06, Math.sin(a) * 0.55] });
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.28;
    b.put(logX(0.06, 0.8), M.log(), { p: [Math.cos(a) * 0.12, 0.18, Math.sin(a) * 0.12], r: [0, -a, 0.55] });
  }
  b.put(paint(blob(0.25, { detail: 1, lump: 0.3, seed: 2, squash: [1, 0.25, 1] }), () => new THREE.Color(0xffffff)), M.ember(), { p: [0, 0.04, 0] });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.28;
    b.put(flameGeo(r.range(0.35, 0.6), 0.1), M.flame(), { p: [Math.cos(a) * 0.08, 0.08, Math.sin(a) * 0.08] });
  }
  b.put(flameGeo(0.75, 0.16), M.flame(), { p: [0, 0.08, 0] });
  return b.build();
}

function hayBale(seed, variant) {
  const b = new Builder("prop_hay");
  if (variant === 0) {
    const g = new THREE.CylinderGeometry(0.6, 0.6, 1.1, 18, 1);
    g.rotateZ(Math.PI / 2);
    b.put(paint(g, groundAO(0.8, 0.2)), M.thatch(), { p: [0, 0.6, 0] });
  } else {
    for (let i = 0; i < 3; i++) b.put(paint(box(1.0, 0.45, 0.5, { bevel: 0.08, tex: 1 }), groundAO(0.4, 0.2)), M.thatch(), { p: i < 2 ? [0, 0.225, i * 0.52 - 0.26] : [0, 0.675, 0], r: [0, i === 2 ? 0.2 : 0, 0] });
  }
  return b.build();
}

function sacks(seed) {
  const b = new Builder("prop_sacks");
  const r = rng(seed);
  const spots = [[0, 0], [0.45, 0.1], [0.2, 0.4], [0.22, 0.15, 0.4]];
  for (const [x, z, y = 0] of spots) {
    const g = blob(0.24, { detail: 2, lump: 0.15, seed: r.int(1, 99), squash: [1, 1.35, 0.85], flatBottom: -0.3 });
    b.put(paint(g, (v) => mix(0xb8a07a, 0xe0cfa8, 0.5 + v.y)), M.cloth(), { p: [x, y + 0.3, z], r: [0, r() * 3, 0] });
  }
  return b.build();
}

function flowerPot(seed) {
  const b = new Builder("prop_planter");
  // a wooden planter box full of flowers (for windowsills and doorways)
  b.put(box(1.0, 0.3, 0.35, { bevel: 0.02, tex: 0.6 }), M.wood(), { p: [0, 0.15, 0] });
  const r = rng(seed);
  const lm = mat("planter_leaves", { map: leafTexture("small", [0x3f8a2e, 0x7cc04a, 0xa7d86a], 9), alphaTest: 0.5, double: true });
  b.put(paint(leafCards([0, 0.38, 0], 0.18, 14, r, { size: 0.3, squash: [2.6, 0.7, 1] }), () => new THREE.Color(0xffffff)), lm);
  for (let i = 0; i < 9; i++) {
    const c = [0xf28ab2, 0xffd75a, 0xf6f3ea, 0x7fb8f0][i % 4];
    b.put(paint(new THREE.IcosahedronGeometry(0.045, 1), () => new THREE.Color(c)), M.cloth(), { p: [r.range(-0.42, 0.42), r.range(0.42, 0.5), r.range(-0.1, 0.1)], s: [1, 0.6, 1] });
  }
  return b.build();
}

// ---------- Fences, walls, hedges, gates (2 m segments, ends at x = -1 and x = +1) ----------

function fenceWood(seed, variant) {
  const b = new Builder(variant === 1 ? "fence_picket" : "fence_rail");
  const r = rng(seed);
  for (const x of [-1, 1]) b.put(paint(post(0.07, 1.1, { sides: 8 }), groundAO(0.4, 0.25)), M.log(), { p: [x, 0, 0] });
  if (variant === 0) {
    for (const y of [0.45, 0.85]) b.put(box(2.05, 0.1, 0.05, { bevel: 0.015, tex: 1 }), M.wood(), { p: [0, y + r.range(-0.02, 0.02), 0.06], r: [0, 0, r.range(-0.02, 0.02)] });
  } else {
    for (const y of [0.3, 0.75]) b.put(box(2.0, 0.07, 0.04, { bevel: 0.01, tex: 1 }), M.wood(), { p: [0, y, 0.05] });
    for (let i = 0; i < 11; i++) {
      const x = -0.9 + i * 0.18;
      const g = new THREE.Shape();
      g.moveTo(-0.04, 0); g.lineTo(0.04, 0); g.lineTo(0.04, 0.9); g.lineTo(0, 0.98); g.lineTo(-0.04, 0.9); g.closePath();
      const geo = new THREE.ExtrudeGeometry(g, { depth: 0.025, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 });
      b.put(paint(geo, (v) => mix(0xd8d0c0, 0xffffff, v.y)), mat("paint_white", { roughness: 0.8 }), { p: [x, 0.02, 0.08] });
    }
  }
  return b.build();
}

function stoneWall(seed, variant) {
  const b = new Builder(variant === 1 ? "wall_city" : "wall_stone");
  if (variant === 0) {
    // a low drystone field wall with a mossy top
    const r = rng(seed);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) {
      const s = r.range(0.2, 0.26);
      const g = blob(s, { detail: 1, lump: 0.2, seed: row * 10 + i, squash: [1.6, 0.9, 1.2] });
      b.put(paint(g, (v, n) => mix(0x9c9a94, 0x7e9a58, Math.max(0, n.y - 0.4) * (row === 2 ? 1.5 : 0.4))), M.rock(), { p: [-0.8 + i * 0.4 + (row % 2) * 0.2 + r.range(-0.03, 0.03), 0.18 + row * 0.3, r.range(-0.04, 0.04)] });
    }
  } else {
    // a section of Emberhold's city wall with battlements and a walkway
    b.put(paint(box(4, 5, 1.6, { bevel: 0.05, tex: 1.2, color: 0xe6e0d4 }), groundAO(2, 0.3)), M.stone(), { p: [0, 2.5, 0] });
    b.put(box(4.1, 0.25, 1.75, { bevel: 0.04, color: 0xd8d0c2 }), M.stone(), { p: [0, 5.1, 0] });
    for (let i = 0; i < 4; i++) for (const z of [-0.7, 0.7]) b.put(box(0.6, 0.6, 0.3, { bevel: 0.04, tex: 1, color: 0xe6e0d4 }), M.stone(), { p: [-1.5 + i * 1.0, 5.5, z] });
  }
  return b.build();
}

function hedge(seed) {
  const b = new Builder("fence_hedge");
  const r = rng(seed);
  const lm = mat("hedge_leaves", { map: leafTexture("small", [0x3f8a2e, 0x6db33f, 0x9bd35a], 6), alphaTest: 0.5, double: true, roughness: 0.75 });
  const g = blob(0.55, { detail: 3, lump: 0.1, freq: 3, seed, squash: [1.75, 1.0, 0.75], flatBottom: -0.5 });
  g.translate(0, 0.58, 0);
  b.put(paint(g, foliageShade([0, 0.6, 0], 1.1, 0x5f9f3a, 0x2f6e25)), M.foliage());
  b.put(paint(leafCards([0, 0.62, 0], 0.6, 130, r, { size: 0.5, squash: [1.75, 1.0, 0.78], minY: -0.5, tilt: 0.9 }), foliageShade([0, 0.6, 0], 1.1, 0xffffff, 0xa0aa98)), lm);
  return b.build();
}

function gate(seed) {
  const b = new Builder("fence_gate");
  for (const x of [-1, 1]) b.put(paint(post(0.09, 1.4, { sides: 8 }), groundAO(0.4, 0.25)), M.log(), { p: [x, 0, 0] });
  for (const x of [-0.47, 0.47]) {
    for (const y of [0.3, 0.95]) b.put(box(0.86, 0.09, 0.05, { bevel: 0.015 }), M.wood(), { p: [x, y, 0.05] });
    for (const dx of [-0.38, 0.38]) b.put(box(0.08, 0.8, 0.05, { bevel: 0.015 }), M.wood(), { p: [x + dx, 0.62, 0.05] });
    b.put(box(0.95, 0.07, 0.04, { bevel: 0.01 }), M.wood(), { p: [x, 0.62, 0.08], r: [0, 0, x > 0 ? 0.6 : -0.6] });
  }
  b.put(box(0.05, 0.12, 0.08, { bevel: 0.01 }), M.iron(), { p: [0, 0.7, 0.09] });
  return b.build();
}

// ---------- Bridges (span along X, deck top at y = 0.6) ----------

function bridgePlank(seed) {
  const b = new Builder("bridge_plank");
  const r = rng(seed);
  const L = 6;
  for (let i = 0; i < 20; i++) {
    const x = -L / 2 + 0.15 + i * 0.3;
    const arch = 0.6 + Math.sin(((x + L / 2) / L) * Math.PI) * 0.35;
    b.put(box(0.27, 0.06, 1.6, { bevel: 0.015, tex: 1 }), M.wood(), { p: [x, arch, 0], r: [0, r.range(-0.02, 0.02), Math.cos(((x + L / 2) / L) * Math.PI) * -0.18] });
  }
  for (const z of [-0.75, 0.75]) {
    for (let i = 0; i <= 4; i++) {
      const x = -L / 2 + i * 1.5;
      const top = 1.45 + Math.sin(((x + L / 2) / L) * Math.PI) * 0.35;
      b.put(post(0.06, top + 0.45, { sides: 8 }), M.log(), { p: [x, -0.4, z] });
    }
    // handrail as a curved limb
    const pts = [];
    for (let i = 0; i <= 8; i++) { const x = -L / 2 + (i / 8) * L; pts.push(new THREE.Vector3(x, 1.45 + Math.sin((i / 8) * Math.PI) * 0.35, z)); }
    b.put(paint(limb(pts, pts.map(() => 0.045), { sides: 6 }), () => new THREE.Color(0xffffff)), M.log());
  }
  return b.build();
}

function bridgeStone(seed) {
  const b = new Builder("bridge_stone");
  // a stone arch: a curved deck of blocks, an arch underneath, low parapet walls
  const L = 8, W = 2.4, segs = 12;
  const deckY = (t) => 1.6 + Math.sin(t * Math.PI) * 0.6;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs, tm = (t0 + t1) / 2;
    const x = -L / 2 + tm * L, y = deckY(tm);
    const ang = Math.atan2(deckY(t1) - deckY(t0), L / segs);
    // the arch ring under the deck: thick where the river is, solid at the banks
    const under = Math.max(0, 1.6 * (1 - Math.sin(tm * Math.PI) * 1.05));
    const h = 0.6 + under;
    b.put(paint(box(L / segs + 0.04, h, W, { bevel: 0.04, tex: 1.2, color: 0xd8d0c2 }), groundAO(1.5, 0.3)), M.stone(), { p: [x, y - h / 2, 0], r: [0, 0, ang] });
    for (const z of [-W / 2 + 0.15, W / 2 - 0.15]) b.put(box(L / segs + 0.04, 0.55, 0.3, { bevel: 0.04, tex: 1, color: 0xe6e0d4 }), M.stone(), { p: [x, y + 0.27, z], r: [0, 0, ang] });
  }
  return b.build();
}

export const PROPS = [
  { id: "prop_barrel", name: "Barrel", group: "Props", variants: ["Closed", "Apples"], make: (s, v) => barrel(s, v), note: "An oak barrel with iron hoops." },
  { id: "prop_crate", name: "Crate", group: "Props", variants: ["Single", "Stack"], make: (s, v) => crate(s, v), note: "Wooden crates for docks, shops and storerooms." },
  { id: "prop_sacks", name: "Grain sacks", group: "Props", variants: ["Pile"], make: (s) => sacks(s), note: "Sacks of grain and flour for the market and the farm." },
  { id: "prop_lamp_post", name: "Street lamp", group: "Props", variants: ["Iron"], make: (s) => lampPost(s), note: "An iron lamp post with a hanging lantern that glows at night." },
  { id: "prop_well", name: "Well", group: "Props", variants: ["Stone"], make: (s) => well(s), note: "Like the warm well in Market Square: stone wall, tiled roof, winch and bucket." },
  { id: "prop_signpost", name: "Signpost", group: "Props", variants: ["Crossroads"], make: (s) => signpost(s), note: "Arrow signs for crossroads and gates." },
  { id: "prop_market_stall", name: "Market stall", group: "Props", variants: ["Red", "Blue", "Green"], make: (s, v) => stall(s, v), note: "A counter with a striped awning and baskets of fruit and veg." },
  { id: "prop_cart", name: "Hand cart", group: "Props", variants: ["Loaded"], make: (s) => cart(s), note: "A two-wheeled cart with a sack and a crate." },
  { id: "prop_bench", name: "Bench", group: "Props", variants: ["Wooden"], make: (s) => bench(s), note: "For the plaza, the inn and the Emberhall garden." },
  { id: "prop_campfire", name: "Campfire", group: "Props", variants: ["Lit"], make: (s) => campfire(s), note: "Logs in a ring of stones with glowing flames." },
  { id: "prop_hay", name: "Hay", group: "Props", variants: ["Round bale", "Stacked bales"], make: (s, v) => hayBale(s, v), note: "For Farmer Odo's allotments and barns." },
  { id: "prop_planter", name: "Flower planter", group: "Props", variants: ["Mixed"], make: (s) => flowerPot(s), note: "A window box of flowers for houses and shops." },
];

export const FENCES = [
  { id: "fence_wood", name: "Wooden fence", group: "Fences and bridges", variants: ["Rail", "Picket"], make: (s, v) => fenceWood(s, v), note: "A 2 m section. Line them up end to end." },
  { id: "fence_gate", name: "Field gate", group: "Fences and bridges", variants: ["Double"], make: (s) => gate(s), note: "A 2 m double gate that fits between fence sections." },
  { id: "fence_hedge", name: "Hedge", group: "Fences and bridges", variants: ["Trimmed"], make: (s) => hedge(s), note: "A 2 m trimmed hedge, like the one round the Training Ground." },
  { id: "fence_stone", name: "Stone wall", group: "Fences and bridges", variants: ["Field wall", "City wall"], make: (s, v) => stoneWall(s, v), note: "A low drystone wall (2 m), or a 4 m section of Emberhold's city wall with battlements." },
  { id: "bridge_plank", name: "Plank bridge", group: "Fences and bridges", variants: ["Wooden"], make: (s) => bridgePlank(s), note: "A 6 m arched footbridge for streams." },
  { id: "bridge_stone", name: "Stone bridge", group: "Fences and bridges", variants: ["Arch"], make: (s) => bridgeStone(s), note: "An 8 m stone arch bridge, like the ones over the Glass River." },
];
