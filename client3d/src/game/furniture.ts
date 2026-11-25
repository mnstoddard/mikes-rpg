// Furniture inside buildings: bookshelves (books on both sides), beds, and the
// things laid out on tables (the General Store's goods, books and candles in
// the Emberhall, bowls of stew at Maren's...). Built once each and drawn as
// instances by the terrain (see terrain.ts).
import * as THREE from "three";
import { Parts, makeRng } from "../environment/kit";
import { createItem } from "../items";
import { createFood } from "../food";

const BOOK_COLORS = [0xa83a2a, 0x2a5aa8, 0x3a8a3a, 0xc8a040, 0x6a3a8a, 0x8a5a2a, 0x2a7a7a, 0xb0603a];

/**
 * A bookshelf 1.8 m wide (along x), open on both sides with books facing out
 * both ways, so a row of them in the middle of a room looks like a library
 * and one against a wall looks full from the room.
 */
export function bookshelf(seed: number): THREE.Object3D {
  const rng = makeRng(seed);
  const p = new Parts();
  const wood = 0x5c3a1a, edge = 0x6e4626;
  const W = 1.8, H = 2.1, D = 0.56;
  // Frame: sides, top, bottom, a middle board between the two faces, and the shelves.
  for (const sx of [-1, 1]) p.add(box(0.07, H, D, sx * (W / 2 - 0.035), H / 2, 0), wood);
  p.add(box(W, 0.07, D, 0, H - 0.035, 0), edge);
  p.add(box(W, 0.1, D, 0, 0.05, 0), wood);
  p.add(box(W - 0.1, H - 0.1, 0.04, 0, H / 2, 0), 0x4a2e14);
  const rows = [0.12, 0.62, 1.12, 1.6];
  for (const y of rows.slice(1)) p.add(box(W - 0.1, 0.04, D, 0, y - 0.02, 0), edge);
  // Books on every shelf, on both sides: different heights and colours, some leaning.
  for (const side of [-1, 1]) {
    for (const y of rows) {
      let x = -W / 2 + 0.1;
      while (x < W / 2 - 0.12) {
        const w = 0.05 + rng() * 0.05, h = 0.3 + rng() * 0.14, d = 0.18 + rng() * 0.05;
        if (rng() < 0.06) { x += 0.08; continue; } // a gap now and then
        p.add(box(w, h, d, x + w / 2, y + h / 2, side * (0.04 + d / 2)), BOOK_COLORS[Math.floor(rng() * BOOK_COLORS.length)]);
        // A little gold band on the spine.
        if (rng() < 0.4) p.add(box(w + 0.004, 0.02, 0.01, x + w / 2, y + h * 0.75, side * (0.04 + d + 0.002)), 0xd8b85a);
        x += w + 0.004;
      }
    }
  }
  return built(p);
}

/** A shop's shelves: jars, sacks, boxes and bottles instead of books (both sides, like the bookshelf). */
export function goodsShelf(seed: number): THREE.Object3D {
  const rng = makeRng(seed);
  const p = new Parts();
  const wood = 0x6e4626, edge = 0x7e5636;
  const W = 1.8, H = 2.1, D = 0.56;
  for (const sx of [-1, 1]) p.add(box(0.07, H, D, sx * (W / 2 - 0.035), H / 2, 0), wood);
  p.add(box(W, 0.07, D, 0, H - 0.035, 0), edge);
  p.add(box(W, 0.1, D, 0, 0.05, 0), wood);
  p.add(box(W - 0.1, H - 0.1, 0.04, 0, H / 2, 0), 0x5a3a1e);
  const rows = [0.12, 0.62, 1.12, 1.6];
  for (const y of rows.slice(1)) p.add(box(W - 0.1, 0.04, D, 0, y - 0.02, 0), edge);
  const jar = (x: number, y: number, z: number, r: number, h: number, color: number) => {
    const g = new THREE.CylinderGeometry(r, r, h, 8);
    g.translate(x, y + h / 2, z);
    p.add(g, color);
    const lid = new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.03, 8);
    lid.translate(x, y + h + 0.015, z);
    p.add(lid, 0x8a6a3a);
  };
  for (const side of [-1, 1]) {
    for (const y of rows) {
      let x = -W / 2 + 0.12;
      while (x < W / 2 - 0.18) {
        const k = rng();
        const z = side * 0.15;
        if (k < 0.35) { const r = 0.06 + rng() * 0.03; jar(x + r, y, z, r, 0.16 + rng() * 0.1, [0xc84a3a, 0x8ab04a, 0xe0b040, 0x6a8ac8][Math.floor(rng() * 4)]); x += r * 2 + 0.04; }
        else if (k < 0.6) { const w = 0.18 + rng() * 0.08; p.add(box(w, 0.14 + rng() * 0.1, 0.2, x + w / 2, y + 0.1, z), [0xb08a5a, 0x9a7a4a, 0xc8a46a][Math.floor(rng() * 3)]); x += w + 0.03; }
        else if (k < 0.8) { const r = 0.1 + rng() * 0.03; const g = new THREE.SphereGeometry(r, 7, 5); g.scale(1, 1.2, 1); g.translate(x + r, y + r * 1.1, z); p.add(g, 0xd8c89a); x += r * 2 + 0.03; }
        else { const r = 0.035; jar(x + r, y, z, r, 0.24, 0x3a6a4a); x += r * 2 + 0.04; }
      }
    }
  }
  return built(p);
}

/** A single bed 1 m wide, 2 m long (along z), head at -z: a wooden frame, a mattress, a pillow and a blanket. */
export function bed(seed: number): THREE.Object3D {
  const rng = makeRng(seed);
  const p = new Parts();
  const wood = 0x6e4a2c;
  const L = 1.9, W = 0.95;
  // Frame and legs.
  p.add(box(W, 0.12, L, 0, 0.3, 0), wood);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.add(box(0.08, 0.3, 0.08, lx * (W / 2 - 0.04), 0.15, lz * (L / 2 - 0.04)), wood);
  // Headboard and footboard.
  p.add(box(W, 0.9, 0.08, 0, 0.45, -L / 2 + 0.04), wood);
  p.add(box(W, 0.55, 0.08, 0, 0.28, L / 2 - 0.04), wood);
  // Mattress, pillow, blanket (folded back a little at the top).
  p.add(box(W - 0.08, 0.14, L - 0.16, 0, 0.43, 0), 0xf2efe6);
  p.add(box(W - 0.3, 0.1, 0.3, 0, 0.55, -L / 2 + 0.3), 0xffffff);
  const blanket = [0x7d8fc9, 0x9a5a5a, 0x6a8a5a, 0xc8a46a][Math.floor(rng() * 4)];
  p.add(box(W - 0.02, 0.05, L * 0.62, 0, 0.52, L / 2 - L * 0.31 - 0.1), blanket);
  p.add(box(W - 0.02, 0.06, 0.12, 0, 0.54, L / 2 - L * 0.62 - 0.08), 0xf2efe6);
  return built(p);
}

/** What lies on a table, by room. Returns null for a bare table. Each kind has a few layouts (variant). */
export function tableTop(area: string, variant: number): THREE.Object3D | null {
  const g = new THREE.Group();
  const put = (o: THREE.Object3D, x: number, z: number, size: number, ry = 0, flat = false) => {
    // Lay long things down, then shrink to fit and sit it on the table top.
    if (flat) o.rotation.z = Math.PI / 2;
    o.rotation.y = ry;
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    const s = b.isEmpty() ? 1 : size / Math.max(1e-3, b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    o.scale.setScalar(s);
    o.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(o);
    o.position.set(x - (b2.min.x + b2.max.x) / 2, TOP - b2.min.y, z - (b2.min.z + b2.max.z) / 2);
    g.add(o);
  };
  const item = (id: string, seed = 3) => createItem(id, { seed }).object;
  const food = (id: string, seed = 3) => createFood(id, { seed }).object;
  if (area === "tam") {
    // The General Store: rods and pots, potions, food and bait for sale.
    const layouts: (() => void)[] = [
      () => { put(item("rod"), 0, -0.2, 1.4, 0, true); put(item("pot"), -0.45, 0.25, 0.4); put(item("pot", 5), 0.35, 0.25, 0.4); },
      () => { put(item("potion"), -0.55, 0, 0.3); put(item("potion", 7), -0.25, 0.15, 0.3); put(item("vial"), 0.05, -0.1, 0.22); put(item("vial", 4), 0.25, 0.1, 0.22); put(item("honey"), 0.55, 0, 0.3); },
      () => { put(food("ingredient-potato"), -0.5, 0, 0.5); put(food("ingredient-carrot"), -0.02, 0.1, 0.5); put(food("ingredient-onion"), 0.5, -0.05, 0.45); },
      () => { put(food("dish-stew"), -0.45, 0, 0.42); put(food("fish-trout"), 0.25, 0.05, 0.6, 0.3); put(item("worm"), 0.65, -0.25, 0.2); },
      () => { put(item("logs"), -0.35, 0, 0.6); put(item("lantern"), 0.45, 0, 0.4); },
    ];
    layouts[variant % layouts.length]();
  } else if (area === "lighthall" || area === "guild") {
    // Books, a candle, a scroll.
    const books = new Parts();
    const rng = makeRng(variant + 11);
    for (let i = 0; i < 3; i++) books.add(box(0.32, 0.06, 0.24, -0.3 + rng() * 0.05, TOP + 0.03 + i * 0.06, -0.1 + rng() * 0.05, rng() * 0.4), BOOK_COLORS[(variant + i) % BOOK_COLORS.length]);
    books.add(box(0.4, 0.04, 0.3, 0.3, TOP + 0.02, 0.15), 0xe8dcc0); // an open book
    books.add(box(0.06, 0.2, 0.06, 0.6, TOP + 0.1, -0.25), 0xf2efe6); // a candle
    books.add(box(0.12, 0.02, 0.12, 0.6, TOP + 0.01, -0.25), 0xc8a040);
    g.add(built(books));
    if (variant % 2) put(item("spell_book"), -0.55, 0.25, 0.3);
  } else if (area === "inn" || area === "maren") {
    put(food(variant % 2 ? "dish-stew" : "dish-roast"), -0.35, 0, 0.42);
    put(food(variant % 3 ? "fish-minnow" : "ingredient-potato"), 0.35, 0.05, 0.35, 0.5);
  } else return null;
  return g;
}

/** The height of a table's top (box-table in terrain.ts). */
const TOP = 0.85;

function box(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function built(p: Parts): THREE.Object3D {
  const m = p.build();
  const g = new THREE.Group();
  if (m) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return g;
}
