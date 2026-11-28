// Crafting stations: the anvil, furnace, cooking stove, alchemy table,
// workbench, enchanting altar, spinning wheel, tanning rack, storage chest
// and the guild board. Each one sits on the ground with its working side
// facing +Z (toward the player). Glowing parts use emission so Godot's glow
// lights them up.
import { THREE, rng, Builder, paint, mix, blob, leafCards } from "./lib.js";
import { M, box, post, logX, turned, ring, groundAO, flameGeo, gableRoof, coneRoof } from "./kit.js";

function anvil(seed) {
  const b = new Builder("station_anvil");
  // a big oak stump to stand it on
  b.put(paint(post(0.36, 0.55, { sides: 14, taper: 0.95 }), groundAO(0.5, 0.3)), M.log());
  b.put(paint(turned([[0, 0.55], [0.33, 0.55], [0.34, 0.56], [0, 0.565]], 16, 0xd8b88a), () => new THREE.Color(0xd8b88a)), M.wood());
  const ir = M.iron();
  b.put(box(0.42, 0.1, 0.3, { bevel: 0.02 }), ir, { p: [0, 0.62, 0] });          // foot
  b.put(box(0.24, 0.16, 0.18, { bevel: 0.02 }), ir, { p: [0, 0.75, 0] });        // waist
  b.put(box(0.62, 0.1, 0.24, { bevel: 0.025 }), ir, { p: [-0.02, 0.88, 0] });    // face
  const horn = new THREE.ConeGeometry(0.11, 0.34, 12, 1);
  horn.rotateZ(Math.PI / 2); horn.scale(1, 0.8, 1);
  b.put(horn, ir, { p: [0.44, 0.88, 0] });
  b.put(box(0.12, 0.08, 0.2), ir, { p: [-0.36, 0.89, 0] });                      // heel
  // a hammer resting on top
  b.put(post(0.018, 0.34, { sides: 6 }), M.wood(), { p: [-0.1, 0.95, 0.06], r: [0, 0, Math.PI / 2 - 0.2] });
  b.put(box(0.06, 0.06, 0.12, { bevel: 0.01 }), ir, { p: [-0.12, 0.96, 0.06] });
  return b.build();
}

function furnace(seed) {
  const b = new Builder("station_furnace");
  const st = M.stone();
  // a round stone kiln with a dome top and a chimney
  b.put(paint(turned([[0, 0], [0.75, 0], [0.78, 0.15], [0.74, 0.9], [0.62, 1.25], [0.35, 1.5], [0.2, 1.56], [0, 1.56]], 18, 0xffffff, 2), groundAO(1, 0.25)), st);
  b.put(paint(post(0.2, 0.9, { sides: 12, taper: 0.85 }), () => new THREE.Color(0xcfc8bc)), st, { p: [0, 1.4, -0.05] });
  b.put(ring(0.19, 0.04, 0x55585c, 14), M.iron(), { p: [0, 2.3, -0.05] });
  // the mouth: a dark arch with glowing coals inside
  b.put(box(0.6, 0.55, 0.14, { bevel: 0.05, color: 0x2a2220 }), M.rock(), { p: [0, 0.48, 0.68] });
  b.put(box(0.44, 0.36, 0.1, { bevel: 0.04 }), M.ember(), { p: [0, 0.42, 0.71] });
  const fl = flameGeo(0.3, 0.1);
  for (const x of [-0.12, 0.04, 0.15]) b.put(fl, M.flame(), { p: [x, 0.3, 0.76], s: [1, 1 - Math.abs(x), 0.5] });
  // iron lintel and a small coal pile
  b.put(box(0.74, 0.08, 0.18), M.iron(), { p: [0, 0.8, 0.7] });
  const r = rng(seed);
  for (let i = 0; i < 7; i++) {
    const g = blob(0.07, { detail: 1, lump: 0.3, seed: i + 3 });
    b.put(paint(g, () => mix(0x26262a, 0x3a3a40, r())), M.rock(), { p: [0.75 + r.range(-0.15, 0.15), 0.05, 0.55 + r.range(-0.15, 0.15)] });
  }
  return b.build();
}

function stove(seed) {
  const b = new Builder("station_stove");
  const st = M.stone();
  // a brick hearth with an iron cooking plate, a pot and a little chimney pipe
  b.put(paint(box(1.3, 0.85, 0.8, { bevel: 0.05, tex: 1 }), groundAO(0.8, 0.25)), st, { p: [0, 0.425, 0] });
  b.put(box(1.36, 0.06, 0.86, { bevel: 0.02 }), M.iron(), { p: [0, 0.88, 0] });
  b.put(box(0.5, 0.32, 0.06, { bevel: 0.03, color: 0x2a2220 }), M.rock(), { p: [-0.25, 0.33, 0.39] });
  b.put(box(0.38, 0.2, 0.04), M.ember(), { p: [-0.25, 0.3, 0.41] });
  b.put(post(0.09, 1.3, { sides: 10 }), M.iron(), { p: [0.5, 0.9, -0.28] });
  b.put(turned([[0.12, 0], [0.14, 0.05], [0.1, 0.1], [0, 0.1]], 10), M.iron(), { p: [0.5, 2.2, -0.28] });
  // the pot with stew
  b.put(turned([[0, 0], [0.18, 0.01], [0.24, 0.1], [0.24, 0.24], [0.26, 0.27], [0.22, 0.27], [0.21, 0.24], [0.21, 0.1], [0, 0.04]], 18), M.iron(), { p: [-0.25, 0.91, 0.05] });
  b.put(tintDisc(0.21, 0xc07a3a), M.cloth(), { p: [-0.25, 1.12, 0.05] });
  // a frying pan
  b.put(turned([[0, 0], [0.16, 0], [0.18, 0.04], [0.17, 0.045], [0, 0.01]], 16), M.iron(), { p: [0.2, 0.91, 0.12] });
  b.put(box(0.25, 0.025, 0.04, { bevel: 0.01 }), M.wood(), { p: [0.46, 0.94, 0.12] });
  return b.build();
}
const tintDisc = (r, c) => { const g = new THREE.CircleGeometry(r, 18); g.rotateX(-Math.PI / 2); return paint(g, () => new THREE.Color(c)); };

/** A plain wooden table: top w x d at height h, origin on the floor. */
function table(b, w, d, h, wood = M.wood(), legInset = 0.08) {
  b.put(box(w, 0.07, d, { bevel: 0.02, tex: 1 }), wood, { p: [0, h - 0.035, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.put(paint(box(0.07, h - 0.07, 0.07, { bevel: 0.015 }), groundAO(0.6, 0.2)), wood, { p: [sx * (w / 2 - legInset), (h - 0.07) / 2, sz * (d / 2 - legInset)] });
  b.put(box(w - legInset * 2, 0.05, 0.04), wood, { p: [0, 0.18, -(d / 2 - legInset)] });
}

function alchemy(seed) {
  const b = new Builder("station_alchemy");
  table(b, 1.5, 0.75, 0.9, M.woodDark());
  const r = rng(seed);
  // flasks of glowing liquid
  const liquids = [0x7be38a, 0xf28ab2, 0x7fb8f0, 0xffd75a];
  const flasks = [[-0.5, 0.1, 0.32], [-0.28, -0.12, 0.24], [0.05, 0.15, 0.2], [0.45, -0.05, 0.28]];
  flasks.forEach(([x, z, h], i) => {
    const bulb = h * 0.45;
    const prof = [[0, 0], [bulb * 0.8, 0.01], [bulb, bulb * 0.6], [bulb * 0.7, bulb * 1.3], [0.025, bulb * 1.6], [0.025, h], [0.035, h + 0.01], [0, h + 0.01]];
    b.put(turned(prof, 14), M.glass(), { p: [x, 0.9, z] });
    const liq = turned([[0, 0], [bulb * 0.75, 0.015], [bulb * 0.92, bulb * 0.55], [bulb * 0.8, bulb * 0.9], [0, bulb * 0.9]], 12);
    b.put(liq, glowLiquid(liquids[i]), { p: [x, 0.9, z] });
    b.put(post(0.03, 0.04, { sides: 8, color: 0xc89a6a }), M.wood(), { p: [x, 0.9 + h, z] });
  });
  // mortar and pestle, a book, a candle
  b.put(turned([[0, 0], [0.08, 0], [0.1, 0.07], [0.08, 0.09], [0.07, 0.06], [0, 0.03]], 12, 0xc8c2b8), M.rock(), { p: [0.2, 0.9, 0.12] });
  b.put(post(0.015, 0.16, { sides: 6 }), M.wood(), { p: [0.22, 0.95, 0.12], r: [0.5, 0, 0.3] });
  b.put(box(0.26, 0.05, 0.2, { bevel: 0.01, color: 0x7a3a2a }), M.leather(), { p: [-0.05, 0.925, -0.2], r: [0, 0.3, 0] });
  b.put(box(0.24, 0.035, 0.18, { bevel: 0.005, color: 0xf0e6cc }), M.paper(), { p: [-0.05, 0.93, -0.2], r: [0, 0.3, 0] });
  b.put(post(0.025, 0.12, { sides: 8, color: 0xf6efdc }), M.cloth(), { p: [0.62, 0.9, -0.22] });
  b.put(flameGeo(0.06, 0.015), M.flame(), { p: [0.62, 1.025, -0.22] });
  // a shelf of jars at the back
  b.put(box(1.4, 0.04, 0.2), M.woodDark(), { p: [0, 1.35, -0.3] });
  for (const sx of [-0.65, 0.65]) b.put(box(0.05, 0.5, 0.05), M.woodDark(), { p: [sx, 1.12, -0.33] });
  for (let i = 0; i < 6; i++) {
    const x = -0.55 + i * 0.22, h = r.range(0.1, 0.16);
    b.put(turned([[0, 0], [0.05, 0], [0.055, h * 0.8], [0.035, h], [0, h]], 10, [0xb87a4a, 0x7a9a5a, 0x6a7ab8, 0xc8a05a][i % 4]), M.cloth(), { p: [x, 1.37, -0.3] });
  }
  return b.build();
}
const glowLiquid = (c) => {
  const m = M.glass().clone();
  m.name = "potion_" + c.toString(16);
  m.color.set(c); m.opacity = 0.9; m.transparent = false; m.emissive.set(c); m.emissiveIntensity = 0.6; m.roughness = 0.2;
  return m;
};

function workbench(seed) {
  const b = new Builder("station_workbench");
  const w = M.wood();
  // a thick plank top, sturdy legs, a shelf, a vise and some tools
  b.put(box(1.8, 0.12, 0.8, { bevel: 0.03, tex: 1.2 }), w, { p: [0, 0.86, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.put(paint(box(0.11, 0.8, 0.11, { bevel: 0.02 }), groundAO(0.6, 0.2)), w, { p: [sx * 0.78, 0.4, sz * 0.32] });
  b.put(box(1.6, 0.05, 0.62, { bevel: 0.015 }), w, { p: [0, 0.22, 0] });
  const ir = M.iron();
  b.put(box(0.18, 0.14, 0.16, { bevel: 0.02 }), ir, { p: [0.72, 0.98, 0.36] });
  b.put(post(0.012, 0.28, { sides: 6 }), ir, { p: [0.58, 0.95, 0.44], r: [0, 0, Math.PI / 2] });
  // a saw
  b.put(box(0.5, 0.11, 0.005, { bevel: 0.002, color: 0xc8ccd2 }), ir, { p: [-0.35, 0.94, 0.15], r: [-Math.PI / 2, 0, 0.2] });
  b.put(box(0.14, 0.04, 0.09, { bevel: 0.01 }), M.woodDark(), { p: [-0.08, 0.94, 0.2], r: [0, 0.2, 0] });
  // a mallet and some planks
  b.put(box(0.1, 0.1, 0.18, { bevel: 0.02 }), M.woodDark(), { p: [0.15, 0.97, -0.15] });
  b.put(post(0.016, 0.3, { sides: 6 }), M.wood(), { p: [0.15, 0.97, -0.15], r: [0, 0, Math.PI / 2] });
  for (let i = 0; i < 3; i++) b.put(box(1.2, 0.04, 0.16, { bevel: 0.01, tex: 1.2 }), w, { p: [-0.1, 0.27 + i * 0.045, -0.05 + i * 0.03], r: [0, 0.05 * i, 0] });
  return b.build();
}

function altar(seed) {
  const b = new Builder("station_altar");
  const st = M.stone();
  // a carved white-stone pedestal, a rune ring and a floating crystal
  b.put(paint(box(1.3, 0.25, 1.3, { bevel: 0.05, tex: 1, color: 0xe8e2d8 }), groundAO(0.25, 0.25)), st, { p: [0, 0.125, 0] });
  b.put(turned([[0, 0], [0.45, 0], [0.4, 0.1], [0.28, 0.2], [0.26, 0.7], [0.36, 0.8], [0.52, 0.9], [0.52, 0.98], [0, 0.98]], 8, 0xeeeae0, 1), st, { p: [0, 0.25, 0] });
  b.put(ring(0.42, 0.018, 0xffffff, 32), M.arcane(), { p: [0, 1.25, 0] });
  b.put(ring(0.55, 0.012, 0xffffff, 32), M.arcane(), { p: [0, 0.27, 0] });
  const cr = new THREE.OctahedronGeometry(0.16, 0);
  cr.scale(1, 1.7, 1);
  b.put(cr, M.arcane(), { p: [0, 1.55, 0] });
  // little standing crystals at the corners
  for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    const c = new THREE.OctahedronGeometry(0.07, 0); c.scale(1, 2.2, 1);
    b.put(c, M.arcane(), { p: [x, 0.4, z] });
  }
  return b.build();
}

function spinningWheel(seed) {
  const b = new Builder("station_spinning_wheel");
  const w = M.wood();
  // a slanted bench on three legs, a big spoked wheel and a spindle with wool
  b.put(box(1.1, 0.07, 0.32, { bevel: 0.02 }), w, { p: [0, 0.5, 0], r: [0, 0, 0.12] });
  for (const [x, z] of [[-0.45, -0.12], [-0.45, 0.12], [0.45, 0]]) b.put(post(0.03, 0.52, { sides: 8 }), w, { p: [x, 0, z], r: [z * 0.8, 0, x * 0.2] });
  for (const z of [-0.06, 0.06]) b.put(post(0.025, 0.55, { sides: 8 }), w, { p: [-0.15, 0.52, z] });
  const wheel = new THREE.TorusGeometry(0.38, 0.03, 8, 32);
  b.put(paint(wheel, () => new THREE.Color(0xb88a5a)), w, { p: [-0.15, 1.0, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    const sp = post(0.012, 0.76, { sides: 5 }); sp.translate(0, -0.38, 0);
    b.put(sp, w, { p: [-0.15, 1.0, 0], r: [0, 0, a] });
  }
  b.put(logX(0.04, 0.16), w, { p: [-0.15, 1.0, 0], r: [0, Math.PI / 2, 0] });
  b.put(post(0.02, 0.3, { sides: 6 }), w, { p: [0.35, 0.53, 0] });
  b.put(paint(blob(0.09, { detail: 2, lump: 0.25, seed: 4, squash: [1, 1.3, 1] }), () => new THREE.Color(0xf4efe2)), M.cloth(), { p: [0.35, 0.86, 0] });
  return b.build();
}

function tanningRack(seed) {
  const b = new Builder("station_tanning_rack");
  const w = M.log();
  // an A-frame of poles with a hide laced into it
  for (const sx of [-1, 1]) {
    b.put(post(0.045, 1.9, { sides: 8 }), w, { p: [sx * 0.75, 0, -0.25], r: [0.25, 0, 0] });
    b.put(post(0.04, 1.2, { sides: 8 }), w, { p: [sx * 0.75, 0, 0.35], r: [-0.45, 0, 0] });
  }
  b.put(logX(0.045, 1.8), w, { p: [0, 1.78, 0.2] });
  b.put(logX(0.04, 1.7), w, { p: [0, 0.35, -0.16] });
  // the hide: a gently curved sheet
  const hide = new THREE.PlaneGeometry(1.2, 1.25, 8, 8);
  const p = hide.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const edge = Math.abs(x) / 0.6;
    p.setX(i, x * (1 - 0.12 * Math.cos(y * 2.5)));
    p.setZ(i, -Math.cos(x * 2.6) * 0.06 - edge * 0.02);
  }
  hide.computeVertexNormals();
  b.put(paint(hide, (v) => mix(0x8a5a34, 0xc8925a, 0.5 + v.y * 0.4)), mat2("hide"), { p: [0, 1.05, 0.03], r: [0.3, 0, 0] });
  return b.build();
}
import { mat } from "./lib.js";
const mat2 = (n) => mat(n, { roughness: 0.7, double: true });

function chest(seed, variant = 0) {
  const b = new Builder("station_chest");
  const w = variant === 1 ? M.woodDark() : M.wood();
  const ir = variant === 1 ? M.brass() : M.iron();
  // a planked box with a rounded lid and metal bands
  b.put(paint(box(0.95, 0.5, 0.6, { bevel: 0.03, tex: 0.6 }), groundAO(0.5, 0.2)), w, { p: [0, 0.25, 0] });
  const lid = new THREE.CylinderGeometry(0.3, 0.3, 0.95, 16, 1, false, -Math.PI / 2, Math.PI);
  lid.rotateX(-Math.PI / 2); lid.rotateY(Math.PI / 2);
  lid.scale(1, 0.55, 1);
  b.put(tintUV(lid), w, { p: [0, 0.5, 0] });
  for (const x of [-0.36, 0.36]) {
    b.put(box(0.06, 0.52, 0.62, { bevel: 0.01 }), ir, { p: [x, 0.25, 0] });
    const band = new THREE.TorusGeometry(0.31, 0.02, 6, 16, Math.PI);
    band.rotateY(Math.PI / 2); band.scale(1, 0.55, 1);
    b.put(band, ir, { p: [x, 0.5, 0] });
  }
  b.put(box(0.12, 0.14, 0.04, { bevel: 0.01 }), ir, { p: [0, 0.44, 0.31] });
  return b.build();
}
const tintUV = (g) => paint(g, () => new THREE.Color(1, 1, 1));

function guildBoard(seed) {
  const b = new Builder("station_guild_board");
  const w = M.woodDark();
  const r = rng(seed);
  // two posts, a framed board with notices, and a little roof
  for (const x of [-0.9, 0.9]) b.put(paint(post(0.07, 2.4, { sides: 8 }), groundAO(0.5, 0.25)), M.log(), { p: [x, 0, 0] });
  b.put(box(1.7, 1.1, 0.06, { bevel: 0.02, tex: 1 }), M.wood(), { p: [0, 1.45, 0] });
  for (const y of [0.88, 2.02]) b.put(box(1.86, 0.08, 0.1, { bevel: 0.02 }), w, { p: [0, y, 0.01] });
  for (let i = 0; i < 7; i++) {
    const pw = r.range(0.22, 0.32), ph = r.range(0.26, 0.36);
    b.put(paint(new THREE.PlaneGeometry(pw, ph), () => mix(0xf4ead0, 0xe8d8b0, r())), M.paper(), { p: [-0.62 + (i % 4) * 0.4 + r.range(-0.04, 0.04), 1.7 - Math.floor(i / 4) * 0.45 + r.range(-0.04, 0.04), 0.035], r: [0, 0, r.range(-0.12, 0.12)] });
    b.put(post(0.012, 0.02, { sides: 6, color: 0xc03030 }), M.cloth(), { p: [-0.62 + (i % 4) * 0.4, 1.83 - Math.floor(i / 4) * 0.45, 0.036], r: [Math.PI / 2, 0, 0] });
  }
  gableRoof(b, M.roof(), 1.9, 0.45, 0.3, { over: 0.12, thick: 0.06, color: 0xb4553a, at: [0, 2.35, 0] });
  return b.build();
}

export const STATIONS = [
  { id: "station_anvil", name: "Anvil", group: "Crafting stations", variants: ["Iron on a stump"], make: (s) => anvil(s), note: "Smithing. Smith Brann's anvil, on an oak stump with a hammer resting on it." },
  { id: "station_furnace", name: "Furnace", group: "Crafting stations", variants: ["Stone kiln"], make: (s) => furnace(s), note: "Smelting. A round stone kiln with glowing coals and a chimney." },
  { id: "station_stove", name: "Cooking stove", group: "Crafting stations", variants: ["Brick hearth"], make: (s) => stove(s), note: "Cooking. A brick hearth with an iron plate, a pot of stew and a pan." },
  { id: "station_alchemy", name: "Alchemy table", group: "Crafting stations", variants: ["Potion bench"], make: (s) => alchemy(s), note: "Alchemy. Flasks of glowing potions, a mortar and pestle, a book and a shelf of jars." },
  { id: "station_workbench", name: "Workbench", group: "Crafting stations", variants: ["Carpenter's bench"], make: (s) => workbench(s), note: "Handicraft. A thick plank bench with a vise, a saw and a mallet." },
  { id: "station_altar", name: "Enchanting altar", group: "Crafting stations", variants: ["White stone"], make: (s) => altar(s), note: "Magic and Enchanting. A carved pedestal with a floating crystal and rune rings that glow." },
  { id: "station_spinning_wheel", name: "Spinning wheel", group: "Crafting stations", variants: ["Wooden"], make: (s) => spinningWheel(s), note: "Handicraft (thread). A spoked wheel with a tuft of wool on the spindle." },
  { id: "station_tanning_rack", name: "Tanning rack", group: "Crafting stations", variants: ["Pole frame"], make: (s) => tanningRack(s), note: "Handicraft (leather). A hide laced into a pole frame." },
  { id: "station_chest", name: "Storage chest", group: "Crafting stations", variants: ["Iron bands", "Brass bands"], make: (s, v) => chest(s, v), note: "Your storage. The brass one is the enchanted chest in your Emberhall room." },
  { id: "station_guild_board", name: "Guild board", group: "Crafting stations", variants: ["Notice board"], make: (s) => guildBoard(s), note: "For bounties and guild jobs, like Captain Bryn's board in Market Square." },
];
