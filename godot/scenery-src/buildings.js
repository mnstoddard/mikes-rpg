// Buildings: the Emberhall and its tall tower, houses, the smithy, a city
// wall tower, the bell tower and a wayside shrine. Front doors face +Z.
// Each building is a handful of shared materials (stone blocks, plaster,
// timber, roof tiles, thatch), so it is only a few draw calls.
import { THREE, rng, Builder, paint, mix, mat } from "./lib.js";
import { M, box, post, logX, turned, ring, groundAO, flameGeo, gableRoof, gable, coneRoof } from "./kit.js";

const glassM = () => mat("window_glass", { color: 0x3a5a78, vertexColors: false, roughness: 0.1, metalness: 0.2 });

/** A window with a frame, a cross bar and a sill, on a wall facing `face` (+Z = 0, +X = 1, -Z = 2, -X = 3). */
function windowAt(b, x, y, z, face = 0, w = 0.8, h = 1.0, { frame = M.woodDark(), arch = false, shutters = null, ry: ryIn = null } = {}) {
  const ry = ryIn ?? face * Math.PI / 2;
  const R = new THREE.Matrix4().makeRotationY(ry);
  const put = (g, m, off, rot = [0, 0, 0]) => {
    const pos = new THREE.Vector3(...off).applyMatrix4(R).add(new THREE.Vector3(x, y, z));
    b.put(g, m, { p: pos.toArray(), r: [rot[0], rot[1] + ry, rot[2]] });
  };
  put(box(w, h, 0.06, { bevel: 0.005 }), glassM(), [0, 0, 0]);
  for (const sx of [-1, 1]) put(box(0.08, h + 0.08, 0.12, { bevel: 0.015 }), frame, [sx * (w / 2), 0, 0.03]);
  put(box(w + 0.08, 0.08, 0.12, { bevel: 0.015 }), frame, [0, h / 2, 0.03]);
  put(box(w + 0.2, 0.07, 0.2, { bevel: 0.015 }), frame, [0, -h / 2 - 0.02, 0.07]);
  put(box(0.04, h, 0.06, { bevel: 0.01 }), frame, [0, 0, 0.04]);
  put(box(w, 0.04, 0.06, { bevel: 0.01 }), frame, [0, h * 0.1, 0.04]);
  if (arch) {
    const a = new THREE.CylinderGeometry(w / 2, w / 2, 0.06, 14, 1, false, -Math.PI / 2, Math.PI);
    a.rotateX(Math.PI / 2);
    put(paint(a, () => new THREE.Color(0xffffff)), glassM(), [0, h / 2, 0]);
    const t = new THREE.TorusGeometry(w / 2 + 0.02, 0.05, 6, 14, Math.PI);
    put(t, frame, [0, h / 2, 0.04]);
  }
  if (shutters) for (const sx of [-1, 1]) put(box(w / 2, h, 0.04, { bevel: 0.01, tex: 0.5, color: shutters }), mat("shutter_paint", { map: M.wood().map, roughness: 0.75 }), [sx * (w * 0.78), 0, 0.06]);
}

/** A door with a frame (and an optional round top), facing +Z, bottom on y. */
function doorAt(b, x, y, z, w = 1.1, h = 2.1, { arch = false, color = 0xffffff } = {}) {
  b.put(box(w, h, 0.1, { bevel: 0.02, tex: 0.7, color }), M.woodDark(), { p: [x, y + h / 2, z] });
  if (arch) {
    const a = new THREE.CylinderGeometry(w / 2, w / 2, 0.1, 16, 1, false, -Math.PI / 2, Math.PI);
    a.rotateX(Math.PI / 2);
    b.put(paint(a, () => new THREE.Color(color)), M.woodDark(), { p: [x, y + h, z] });
  }
  for (const yy of [0.4, h - 0.4]) b.put(box(w * 0.7, 0.06, 0.03, { bevel: 0.01 }), M.iron(), { p: [x - w * 0.1, y + yy, z + 0.06] });
  b.put(ring(0.05, 0.012, 0xffffff, 10), M.iron(), { p: [x + w * 0.32, y + h * 0.5, z + 0.07], r: [Math.PI / 2, 0, 0] });
  b.put(box(w + 0.5, 0.15, 0.6, { bevel: 0.03, color: 0xd8d0c2 }), M.stone(), { p: [x, y + 0.075, z + 0.25] });
}

function cottage(seed) {
  const b = new Builder("building_cottage");
  const W = 6, D = 4.5, H = 2.8;
  // white plaster walls on a stone footing, dark timber frame, a thatched roof
  b.put(paint(box(W + 0.2, 0.5, D + 0.2, { bevel: 0.05, tex: 1.2, color: 0xc8c0b4 }), groundAO(0.5, 0.25)), M.stone(), { p: [0, 0.25, 0] });
  b.put(box(W, H - 0.5, D, { bevel: 0.04, tex: 2, color: 0xf2ead8 }), M.plaster(), { p: [0, 0.5 + (H - 0.5) / 2, 0] });
  for (const s of [-1, 1]) b.put(gable(D, 1.9, 0.2, 0xf2ead8), M.plaster(), { p: [s * (W / 2 - 0.1), H, 0] });
  const t = M.woodDark();
  for (const x of [-W / 2, -W / 6, W / 6, W / 2]) for (const z of [-D / 2, D / 2]) b.put(box(0.16, H - 0.5, 0.16, { bevel: 0.02 }), t, { p: [x, 0.5 + (H - 0.5) / 2, z] });
  for (const z of [-D / 2, D / 2]) b.put(box(W + 0.1, 0.16, 0.16, { bevel: 0.02 }), t, { p: [0, H, z] });
  for (const x of [-W / 2, W / 2]) b.put(box(0.16, 0.16, D + 0.1, { bevel: 0.02 }), t, { p: [x, H, 0] });
  // thatch: thick and rounded at the eaves
  gableRoof(b, M.thatch(), W, D, 2.0, { over: 0.5, thick: 0.35, color: 0xffffff, at: [0, H - 0.1, 0] });
  // chimney
  b.put(box(0.7, 2.2, 0.7, { bevel: 0.04, tex: 1, color: 0xc8c0b4 }), M.stone(), { p: [W / 2 - 1.0, H + 1.4, -0.7] });
  doorAt(b, -0.6, 0.5, D / 2 + 0.05, 1.0, 1.9, { color: 0x88aacc });
  windowAt(b, 1.6, 1.8, D / 2 + 0.02, 0, 0.9, 0.8, { shutters: 0x6a9a5a });
  windowAt(b, -2.2, 1.8, D / 2 + 0.02, 0, 0.7, 0.8, { shutters: 0x6a9a5a });
  windowAt(b, W / 2 + 0.02, 1.8, 0, 1, 0.8, 0.8, { shutters: 0x6a9a5a });
  windowAt(b, -W / 2 - 0.02, 1.8, 0, 3, 0.8, 0.8, { shutters: 0x6a9a5a });
  return b.build();
}

function townhouse(seed, variant) {
  const b = new Builder("building_townhouse");
  const W = 6, D = 5.5, F = 2.9;
  const roofCol = [0xb4553a, 0x5a6a80][variant];
  // a stone ground floor, a jettied plaster upper floor with timbers, a tiled roof
  b.put(paint(box(W, F, D, { bevel: 0.05, tex: 1.2, color: 0xe2dccf }), groundAO(1.5, 0.3)), M.stone(), { p: [0, F / 2, 0] });
  b.put(box(W + 0.5, F, D + 0.4, { bevel: 0.04, tex: 2, color: 0xf4ecd8 }), M.plaster(), { p: [0, F * 1.5 + 0.1, 0] });
  const t = M.woodDark();
  b.put(box(W + 0.6, 0.2, D + 0.5, { bevel: 0.03 }), t, { p: [0, F + 0.05, 0] });
  for (let i = 0; i <= 4; i++) b.put(box(0.14, F, 0.1, { bevel: 0.02 }), t, { p: [-W / 2 - 0.25 + i * (W + 0.5) / 4, F * 1.5 + 0.1, D / 2 + 0.22] });
  for (let i = 0; i < 4; i++) b.put(box((W + 0.5) / 4 * 1.05, 0.1, 0.08, { bevel: 0.015 }), t, { p: [-W / 2 - 0.25 + (i + 0.5) * (W + 0.5) / 4, F * 1.5, D / 2 + 0.23], r: [0, 0, i % 2 ? 0.55 : -0.55] });
  for (const s of [-1, 1]) b.put(gable(D + 0.4, 2.6, 0.2, 0xf4ecd8), M.plaster(), { p: [s * (W / 2 + 0.15), F * 2 + 0.1, 0] });
  gableRoof(b, M.roof(), W + 0.5, D + 0.4, 2.7, { over: 0.45, thick: 0.18, color: roofCol, at: [0, F * 2 + 0.05, 0] });
  b.put(box(0.8, 2.2, 0.8, { bevel: 0.04, tex: 1, color: 0xd8d0c2 }), M.stone(), { p: [-W / 2 + 1.0, F * 2 + 1.9, -0.6] });
  doorAt(b, 1.4, 0, D / 2 + 0.05, 1.1, 2.2, { arch: true });
  windowAt(b, -1.3, 1.5, D / 2 + 0.02, 0, 1.0, 1.1, { arch: true });
  for (const x of [-1.7, 1.7]) windowAt(b, x, F * 1.5 + 0.1, D / 2 + 0.25, 0, 0.9, 1.0, { shutters: 0x3f64a8 });
  b.put(box(1.2, 0.08, 0.6, { bevel: 0.02 }), t, { p: [1.4, 2.6, D / 2 + 0.35] });
  return b.build();
}

function smithy(seed) {
  const b = new Builder("building_smithy");
  const W = 7, D = 5;
  // an open-fronted forge: stone back wall, timber posts, a tiled roof, a forge hearth with a hood
  b.put(paint(box(W, 3.2, 0.5, { bevel: 0.05, tex: 1.2, color: 0xd8d0c2 }), groundAO(1.5, 0.3)), M.stone(), { p: [0, 1.6, -D / 2] });
  for (const s of [-1, 1]) b.put(paint(box(0.5, 3.2, D, { bevel: 0.05, tex: 1.2, color: 0xd8d0c2 }), groundAO(1.5, 0.3)), M.stone(), { p: [s * W / 2, 1.6, 0] });
  for (const s of [-1, 1]) b.put(gable(D + 0.2, 1.8, 0.4, 0xd8d0c2), M.stone(), { p: [s * W / 2, 3.2, 0] });
  for (const x of [-W / 6, W / 6]) b.put(post(0.15, 3.2, { sides: 10 }), M.log(), { p: [x, 0, D / 2 - 0.2] });
  b.put(box(W + 0.4, 0.3, 0.3, { bevel: 0.03 }), M.woodDark(), { p: [0, 3.25, D / 2 - 0.2] });
  gableRoof(b, M.roof(), W + 0.4, D + 0.2, 1.9, { over: 0.5, thick: 0.18, color: 0x8a5a48, at: [0, 3.2, 0] });
  // floor
  b.put(box(W, 0.12, D, { bevel: 0.03, tex: 1.2, color: 0xa8a094 }), M.stone(), { p: [0, 0.06, 0] });
  // forge hearth against the back wall with glowing coals and a hood up through the roof
  b.put(box(2.0, 0.9, 1.2, { bevel: 0.05, tex: 1, color: 0xc8c0b4 }), M.stone(), { p: [-1.6, 0.45, -D / 2 + 0.85] });
  b.put(box(1.4, 0.08, 0.8, { bevel: 0.03 }), M.ember(), { p: [-1.6, 0.92, -D / 2 + 0.85] });
  const fl = flameGeo(0.35, 0.12);
  for (const x of [-2.0, -1.6, -1.2]) b.put(fl, M.flame(), { p: [x, 0.92, -D / 2 + 0.85] });
  b.put(turned([[1.0, 0], [0.9, 0.1], [0.35, 1.3], [0.35, 1.35], [0, 1.35]], 4, 0xc8c0b4, 1), M.stone(), { p: [-1.6, 2.0, -D / 2 + 0.8], r: [0, Math.PI / 4, 0] });
  b.put(box(0.7, 3.2, 0.7, { bevel: 0.04, tex: 1, color: 0xc8c0b4 }), M.stone(), { p: [-1.6, 4.6, -D / 2 + 0.6] });
  // a water trough and a tool rack
  b.put(box(1.2, 0.5, 0.5, { bevel: 0.03, tex: 0.6 }), M.wood(), { p: [1.8, 0.25, -D / 2 + 0.6] });
  b.put(box(1.1, 0.04, 0.4, { bevel: 0.005 }), mat("trough_water", { color: 0x2f7fb0, vertexColors: false, roughness: 0.05 }), { p: [1.8, 0.45, -D / 2 + 0.6] });
  b.put(box(2.0, 0.08, 0.12, { bevel: 0.02 }), M.woodDark(), { p: [1.4, 2.0, -D / 2 + 0.3] });
  for (let i = 0; i < 4; i++) {
    b.put(post(0.02, 0.6, { sides: 5 }), M.wood(), { p: [0.7 + i * 0.45, 1.4, -D / 2 + 0.38] });
    b.put(box(0.1, 0.12, 0.06, { bevel: 0.01 }), M.iron(), { p: [0.7 + i * 0.45, 1.45, -D / 2 + 0.38] });
  }
  return b.build();
}

/** The Emberhall: the Emberguard's white-stone temple with its tall tower and the ember flame on its spire. */
function emberhall(seed) {
  const b = new Builder("building_emberhall");
  const W = 14, D = 24, H = 9;
  const stone = M.stone();
  const white = 0xf2ede2, trim = 0xd8cdb8, roof = 0x46607a;
  // the raised floor and steps
  b.put(paint(box(W + 3, 0.8, D + 3, { bevel: 0.06, tex: 1.5, color: trim }), groundAO(0.8, 0.3)), stone, { p: [0, 0.4, 0] });
  for (let i = 0; i < 3; i++) b.put(box(6, 0.27, 0.6, { bevel: 0.04, tex: 1, color: trim }), stone, { p: [0, 0.135 + i * 0.27, D / 2 + 1.5 + (2 - i) * 0.5] });
  // the nave
  b.put(box(W, H, D, { bevel: 0.06, tex: 1.5, color: white }), stone, { p: [0, 0.8 + H / 2, 0] });
  // buttresses down both long sides
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    const z = -D / 2 + 2 + i * (D - 4) / 4;
    b.put(paint(box(1.1, H * 0.8, 1.0, { bevel: 0.05, tex: 1.5, color: trim }), groundAO(2, 0.25)), stone, { p: [s * (W / 2 + 0.5), 0.8 + H * 0.4, z] });
    b.put(box(1.0, 0.9, 0.9, { bevel: 0.05, color: trim }), stone, { p: [s * (W / 2 + 0.4), 0.8 + H * 0.8 + 0.2, z], r: [0, 0, s * 0.5] });
  }
  // tall arched windows between the buttresses
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const z = -D / 2 + 2 + (i + 0.5) * (D - 4) / 4;
    windowAt(b, s * (W / 2 + 0.02), 0.8 + H * 0.45, z, s > 0 ? 1 : 3, 1.3, 3.2, { arch: true, frame: M.stone() });
  }
  // the front: a gable with a round rose window and a great arched door
  b.put(gable(W, 5.5, 0.6, white), stone, { p: [0, 0.8 + H, D / 2 - 0.3], r: [0, Math.PI / 2, 0] });
  b.put(gable(W, 5.5, 0.6, white), stone, { p: [0, 0.8 + H, -D / 2 + 0.3], r: [0, Math.PI / 2, 0] });
  gableRoof(b, M.roof(), D + 0.4, W, 5.5, { over: 0.6, thick: 0.3, color: roof, at: [0, 0.8 + H, 0], rotY: Math.PI / 2 });
  doorAt(b, 0, 0.8, D / 2 + 0.06, 2.6, 4.2, { arch: true, color: 0xe0c8a8 });
  b.put(ring(1.9, 0.18, trim, 32), stone, { p: [0, 0.8 + 4.2 + 1.3, D / 2 + 0.1], r: [Math.PI / 2, 0, 0] });
  const rose = new THREE.CircleGeometry(1.8, 24);
  b.put(paint(rose, () => new THREE.Color(0xffffff)), mat("rose_window", { color: 0xffb347, vertexColors: false, roughness: 0.2, emissive: 0xff7a2f, emissiveIntensity: 0.6 }), { p: [0, 0.8 + H + 1.6, D / 2 + 0.02] });
  b.put(ring(1.9, 0.12, trim, 32), stone, { p: [0, 0.8 + H + 1.6, D / 2 + 0.05], r: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 6; i++) b.put(box(0.1, 3.6, 0.08, { bevel: 0.02, color: trim }), stone, { p: [0, 0.8 + H + 1.6, D / 2 + 0.06], r: [0, 0, (i / 6) * Math.PI] });
  // ember braziers either side of the door
  for (const s of [-1, 1]) {
    b.put(turned([[0, 0], [0.3, 0], [0.18, 0.2], [0.15, 1.0], [0.45, 1.3], [0.5, 1.4], [0, 1.35]], 12, 0xffffff), M.iron(), { p: [s * 2.4, 0.8, D / 2 + 1.0] });
    b.put(flameGeo(0.9, 0.3), M.flame(), { p: [s * 2.4, 0.8 + 1.35, D / 2 + 1.0] });
  }
  // the tall tower at the back corner, with your room near the top and the ember spire
  const tx = W / 2 - 1.5, tz = -D / 2 + 1.5, TH = 26;
  b.put(paint(box(5, TH, 5, { bevel: 0.06, tex: 1.5, color: white }), groundAO(3, 0.25)), stone, { p: [tx, 0.8 + TH / 2, tz] });
  for (let k = 1; k < 4; k++) b.put(box(5.4, 0.4, 5.4, { bevel: 0.05, color: trim }), stone, { p: [tx, 0.8 + k * TH / 4, tz] });
  for (const f of [0, 1, 2, 3]) {
    const off = [[0, 2.52], [2.52, 0], [0, -2.52], [-2.52, 0]][f];
    windowAt(b, tx + off[0], 0.8 + TH - 3.5, tz + off[1], f, 1.1, 2.2, { arch: true, frame: M.stone() });
    windowAt(b, tx + off[0], 0.8 + TH * 0.55, tz + off[1], f, 0.7, 1.4, { arch: true, frame: M.stone() });
  }
  // battlements round the tower top
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    b.put(box(0.7, 0.8, 0.5, { bevel: 0.04, color: trim }), stone, { p: [tx - 1.9 + i * 1.27, 0.8 + TH + 0.4, tz + s * 2.4] });
    b.put(box(0.5, 0.8, 0.7, { bevel: 0.04, color: trim }), stone, { p: [tx + s * 2.4, 0.8 + TH + 0.4, tz - 1.9 + i * 1.27] });
  }
  // the spire and the great ember flame
  b.put(coneRoof(2.6, 9, 4, roof), M.roof(), { p: [tx, 0.8 + TH + 0.2, tz], r: [0, Math.PI / 4, 0] });
  b.put(turned([[0, 0], [0.5, 0.1], [0.65, 0.6], [0.4, 0.8], [0, 0.75]], 10, 0xffffff), M.brass(), { p: [tx, 0.8 + TH + 8.8, tz] });
  b.put(flameGeo(2.2, 0.55), M.flame(), { p: [tx, 0.8 + TH + 9.5, tz] });
  b.put(paint(new THREE.IcosahedronGeometry(0.5, 1), () => new THREE.Color(0xffffff)), M.ember(), { p: [tx, 0.8 + TH + 9.8, tz] });
  return b.build();
}

function wallTower(seed) {
  const b = new Builder("building_wall_tower");
  const R = 3, H = 10;
  b.put(paint(turned([[0, 0], [R + 0.3, 0], [R, 1], [R, H], [R + 0.35, H + 0.1], [R + 0.35, H + 0.5], [0, H + 0.5]], 20, 0xe6e0d4, 3), groundAO(3, 0.3)), M.stone());
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.put(box(0.9, 0.8, 0.5, { bevel: 0.04, color: 0xe6e0d4 }), M.stone(), { p: [Math.cos(a) * (R + 0.1), H + 0.9, Math.sin(a) * (R + 0.1)], r: [0, -a, 0] });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    windowAt(b, Math.cos(a) * (R + 0.02), H * 0.6, Math.sin(a) * (R + 0.02), 0, 0.35, 1.1, { frame: M.stone(), ry: Math.PI / 2 - a });
  }
  b.put(coneRoof(R + 0.6, 4, 16, 0xb4553a), M.roof(), { p: [0, H + 0.5, 0] });
  b.put(post(0.04, 1.6, { sides: 6 }), M.iron(), { p: [0, H + 4.4, 0] });
  b.put(box(0.7, 0.45, 0.02, { bevel: 0.005, color: 0xc2431b }), mat("banner", { roughness: 0.9, double: true }), { p: [0.37, H + 5.7, 0] });
  doorAt(b, 0, 0, R - 0.02, 1.2, 2.3, { arch: true });
  return b.build();
}

function bellTower(seed) {
  const b = new Builder("building_bell_tower");
  const S = 3, H = 11;
  b.put(paint(box(S, H - 3, S, { bevel: 0.05, tex: 1.2, color: 0xe2dccf }), groundAO(2, 0.3)), M.stone(), { p: [0, (H - 3) / 2, 0] });
  // open belfry: four corner pillars, the bell, then a pointed roof
  for (const x of [-1, 1]) for (const z of [-1, 1]) b.put(box(0.5, 2.6, 0.5, { bevel: 0.04, color: 0xe2dccf }), M.stone(), { p: [x * (S / 2 - 0.25), H - 3 + 1.3, z * (S / 2 - 0.25)] });
  b.put(box(S + 0.3, 0.35, S + 0.3, { bevel: 0.04, color: 0xd8d0c2 }), M.stone(), { p: [0, H - 3, 0] });
  b.put(box(S + 0.3, 0.35, S + 0.3, { bevel: 0.04, color: 0xd8d0c2 }), M.stone(), { p: [0, H - 0.3, 0] });
  b.put(turned([[0, 0], [0.7, 0], [0.62, 0.15], [0.48, 0.6], [0.45, 1.0], [0.3, 1.15], [0, 1.2]], 18), M.brass(), { p: [0, H - 2.6, 0] });
  b.put(logX(0.08, S - 0.4), M.woodDark(), { p: [0, H - 1.35, 0] });
  b.put(coneRoof(2.3, 4, 4, 0xb4553a), M.roof(), { p: [0, H - 0.15, 0], r: [0, Math.PI / 4, 0] });
  doorAt(b, 0, 0, S / 2 + 0.02, 1.1, 2.2, { arch: true });
  windowAt(b, 0, 5, S / 2 + 0.02, 0, 0.6, 1.2, { arch: true, frame: M.stone() });
  return b.build();
}

function shrine(seed) {
  const b = new Builder("building_shrine");
  // a small round open shrine: a ring of pillars under a dome, an ember flame in a stone bowl
  b.put(paint(turned([[0, 0], [2.4, 0], [2.4, 0.3], [2.1, 0.35], [2.1, 0.55], [0, 0.55]], 24, 0xe6e0d4, 1), groundAO(0.5, 0.3)), M.stone());
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.put(turned([[0.28, 0], [0.22, 0.2], [0.2, 2.6], [0.28, 2.8], [0.3, 2.95], [0, 2.95]], 12, 0xf2ede2, 2), M.stone(), { p: [Math.cos(a) * 1.75, 0.55, Math.sin(a) * 1.75] });
  }
  b.put(turned([[2.2, 0], [2.2, 0.35], [2.05, 0.45], [1.6, 1.2], [0.9, 1.65], [0.2, 1.85], [0, 1.85]], 24, 0x46607a, 2), M.roof(), { p: [0, 3.5, 0] });
  b.put(turned([[0, 0], [0.35, 0], [0.2, 0.25], [0.18, 0.8], [0.6, 1.0], [0.65, 1.1], [0, 1.05]], 14, 0xe6e0d4), M.stone(), { p: [0, 0.55, 0] });
  b.put(paint(new THREE.IcosahedronGeometry(0.35, 1), () => new THREE.Color(0xffffff)), M.ember(), { p: [0, 1.7, 0], s: [1, 0.6, 1] });
  b.put(flameGeo(1.0, 0.3), M.flame(), { p: [0, 1.65, 0] });
  return b.build();
}

export const BUILDINGS = [
  { id: "building_emberhall", name: "The Emberhall", group: "Buildings", variants: ["White stone"], make: (s) => emberhall(s), note: "The Emberguard's temple on Ember Hill: a white-stone hall with a rose window, ember braziers at the door, and the tall tower (your room is near the top) with the ember flame on its spire." },
  { id: "building_cottage", name: "Cottage", group: "Buildings", variants: ["Thatched"], make: (s) => cottage(s), note: "A plaster and timber cottage with a thatched roof, like Old Maren's by the river." },
  { id: "building_townhouse", name: "Townhouse", group: "Buildings", variants: ["Red roof", "Slate roof"], make: (s, v) => townhouse(s, v), note: "Two storeys: stone below, timber and plaster above, for Emberhold's streets." },
  { id: "building_smithy", name: "Smithy", group: "Buildings", variants: ["Open forge"], make: (s) => smithy(s), note: "Smith Brann's open-fronted forge on Forge Row, with a glowing hearth, a hood and a tool rack." },
  { id: "building_wall_tower", name: "Wall tower", group: "Buildings", variants: ["Round"], make: (s) => wallTower(s), note: "A round tower for Emberhold's city wall, with battlements, a cone roof and a banner." },
  { id: "building_bell_tower", name: "Bell tower", group: "Buildings", variants: ["Market Square"], make: (s) => bellTower(s), note: "The bell tower in Market Square, with an open belfry and a brass bell." },
  { id: "building_shrine", name: "Wayside shrine", group: "Buildings", variants: ["Ember flame"], make: (s) => shrine(s), note: "A small round shrine with an ember flame, for roads and the shrine quests." },
];
