// The world of Elderra: the big outdoor map (Heartvale and the lands around it)
// and every inside place (buildings, caves), built from code when the game
// starts. Shared by the server and the client, so both build exactly the same
// world (the random bits use a fixed seed).
//
// All the places live on ONE big grid of tiles. The outdoor map sits at the
// top left; each inside place (an "area") sits on its own patch further down,
// with empty space around it. Doors link a tile in one area to a tile in
// another, so walking onto a shop's door puts you inside the shop. The client
// only draws the area you're in.
//
// Characters used on the grid (the legend is in shared/map.ts):
//   . grass   , dirt path   ; cobblestones   ~ water   = bridge   s sand   w withered grass
//   ^ cliff   h hedge   q well   x barricade   | fence   + gate   ! warning sign
//   r roof    u gold roof (the Lighthall)   H wooden wall   p floorboards   D door   J locked door
//   A white stone wall   a white stone floor   o glowing floor   z gold carpet   S statue
//   W purple wall   _ purple rug (the Mages' Guild)   n table   b bookshelf   e crates   y bed
//   C cave floor   K cave wall   G crystal floor   V gravestone   l stony ground   * dig patch   f farm lot
//   Trees: T pine  O oak  B birch  M maple  Y yew  I ironwood  E elderwood
//   Rocks: # copper or tin (it was stone)  c copper  t tin  i iron  k coal  v silver  g gold  m mithril
//          U amethyst  Q topaz  L emberstone  N emerald  Z sapphire  R ruby  P platinum  X iridium
//   Fishing: 2 trout  3 perch  4 salmon  5 pike  6 tuna  7 swordfish  8 eel
//   (space) nothing: the empty space between areas
import type { MonsterId } from "./combat";

export interface Point { x: number; y: number }

/** One place you can be: the outdoors, or an inside place. */
export interface AreaDef {
  id: string;
  name: string;
  /** Where it sits on the big grid. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** outdoor: day and night, the sea all around. indoor: lit, black around. cave: dim, black around. */
  kind: "outdoor" | "indoor" | "cave";
  /** Monsters here attack on sight (the Dark Forest, the spider cave...). */
  danger?: boolean;
}

/** A door: step on it to go through to `to` (a tile in another area). */
export interface Door {
  x: number;
  y: number;
  /** Where you arrive. */
  to: Point;
  /** The area you arrive in. */
  area: string;
  /** "Enter Forester Holt's house", "Leave". */
  label: string;
  /** A name sign drawn over the door (outside doors of shops and trainers). */
  sign?: string;
}

// ---------------------------------------------------------------- helpers

/** A tiny seeded random number generator, so everyone builds the same world. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Canvas {
  g: string[][];
  constructor(public w: number, public h: number, fill = ".") {
    this.g = Array.from({ length: h }, () => Array<string>(w).fill(fill));
  }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x: number, y: number) { return this.in(x, y) ? this.g[y][x] : " "; }
  set(x: number, y: number, ch: string) { if (this.in(x, y)) this.g[y][x] = ch; }
  /** Fill a rectangle (inclusive corners). `only`: only replace these characters. */
  fill(x0: number, y0: number, x1: number, y1: number, ch: string, only?: string) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!only || only.includes(this.get(x, y))) this.set(x, y, ch);
  }
  /** A rough oval (lakes, clearings, groves). */
  blob(cx: number, cy: number, rx: number, ry: number, ch: string, r: () => number, wobble = 0.18, only?: string) {
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) {
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1 + (r() - 0.5) * wobble * 2 && (!only || only.includes(this.get(x, y)))) this.set(x, y, ch);
      }
    }
  }
  /** Sprinkle a character over a rectangle (only on `on` tiles). */
  scatter(x0: number, y0: number, x1: number, y1: number, ch: string, chance: number, r: () => number, on = ".") {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (on.includes(this.get(x, y)) && r() < chance) this.set(x, y, ch);
  }
  /** Exactly `n` of a character at random free spots in a rectangle. */
  place(x0: number, y0: number, x1: number, y1: number, ch: string, n: number, r: () => number, on = ".") {
    for (let tries = 0; n > 0 && tries < 4000; tries++) {
      const x = x0 + Math.floor(r() * (x1 - x0 + 1)), y = y0 + Math.floor(r() * (y1 - y0 + 1));
      if (on.includes(this.get(x, y))) { this.set(x, y, ch); n--; }
    }
  }
  /** A road from one point to another (across, then down), `width` tiles wide. */
  road(x0: number, y0: number, x1: number, y1: number, ch = ",", width = 1, only?: string) {
    const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0];
    this.fill(ax, y0, bx, y0 + width - 1, ch, only);
    this.fill(x1, ay, x1 + width - 1, by, ch, only);
  }
  /** Walls round the edge of the whole canvas, floor inside. */
  room(wall: string, floor: string) {
    this.fill(0, 0, this.w - 1, this.h - 1, wall);
    this.fill(1, 1, this.w - 2, this.h - 2, floor);
    return this;
  }
  /** Draw text rows onto the canvas at (x, y). Spaces are left alone. */
  stamp(x: number, y: number, rows: string[]) {
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== " ") this.set(x + dx, y + dy, ch); }));
  }
}

// ---------------------------------------------------------------- building the world

/** Things the builder records as it goes, for NPCs, monsters and the farm. */
const places: Record<string, Point> = {};
/** Places the story sends you to walk to (not stood on by anyone). */
const storySpots: Record<string, Point> = {};
/** The nearest open ground (grass, path, sand...) to a spot. */
function nearFree(c: Canvas, x: number, y: number): Point {
  for (let r = 0; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (".,;:sw".includes(c.get(x + dx, y + dy))) return { x: x + dx, y: y + dy };
    }
  }
  throw new Error(`nowhere free near ${x},${y}`);
}
const spawns: [MonsterId, number, number][] = [];
const lots: Point[] = [];
const areas: AreaDef[] = [];
const doors: Door[] = [];
/** Outside door tiles waiting to be linked to their area's inside door. */
const pendingDoors: { x: number; y: number; out: Point; area: string; sign?: string; label: string }[] = [];

export const OVER_W = 240;
export const OVER_H = 160;
/** The fence along the north edge of the Thornwood (the Dark Forest). Everything south of it is dangerous. */
export const FENCE_Y = 103;
/** The gate in that fence, on the south road. */
export const GATE: Point = { x: 101, y: FENCE_Y };

/** Monster homes to pick once the outdoors is finished (so no tree grows on a cow later). */
const spawnRequests: [MonsterId, number, number, number, number, number, string][] = [];
function spawnIn(_c: Canvas, kind: MonsterId, n: number, x0: number, y0: number, x1: number, y1: number, _r: () => number, _ox = 0, _oy = 0, on = ".,:Cwas;Gl") {
  spawnRequests.push([kind, n, x0, y0, x1, y1, on]);
}
function pickSpawns(c: Canvas, r: () => number) {
  for (const [kind, count, x0, y0, x1, y1, on] of spawnRequests) pickSpawn(c, kind, count, x0, y0, x1, y1, r, on);
}
function pickSpawn(c: Canvas, kind: MonsterId, n: number, x0: number, y0: number, x1: number, y1: number, r: () => number, on: string, ox = 0, oy = 0) {
  for (let tries = 0; n > 0 && tries < 5000; tries++) {
    const x = x0 + Math.floor(r() * (x1 - x0 + 1)), y = y0 + Math.floor(r() * (y1 - y0 + 1));
    if (!on.includes(c.get(x, y))) continue;
    if (spawns.some(([, sx, sy]) => sx === x + ox && sy === y + oy)) continue;
    spawns.push([kind, x + ox, y + oy]);
    n--;
  }
}

/**
 * A building seen from outside: roof, a front wall along the bottom, and a
 * door. `side` is the wall the door is in; you come out on that side.
 */
function building(c: Canvas, x: number, y: number, w: number, h: number, door: { side: "s" | "n" | "e" | "w"; at: number } | null, opts: { roof?: string; wall?: string } = {}) {
  const roof = opts.roof ?? "r", wall = opts.wall ?? "H";
  c.fill(x, y, x + w - 1, y + h - 1, roof);
  c.fill(x, y + h - 1, x + w - 1, y + h - 1, wall);
  if (!door) return null;
  const d = door.side === "s" ? { x: x + door.at, y: y + h - 1, out: { x: x + door.at, y: y + h } }
    : door.side === "n" ? { x: x + door.at, y, out: { x: x + door.at, y: y - 1 } }
    : door.side === "w" ? { x, y: y + door.at, out: { x: x - 1, y: y + door.at } }
    : { x: x + w - 1, y: y + door.at, out: { x: x + w, y: y + door.at } };
  c.set(d.x, d.y, "D");
  return d;
}

function buildOverworld(): Canvas {
  const r = rng(20261121);
  const c = new Canvas(OVER_W, OVER_H, ".");

  // ---- The Greyspine Peaks: cliffs along the north edge, hills below ----
  for (let x = 0; x < OVER_W; x++) {
    const depth = 4 + Math.floor(3 * Math.sin(x / 7) + 2 * Math.sin(x / 3.1) + r() * 2);
    c.fill(x, 0, x, Math.max(2, depth), "^");
  }
  // Stony ground and rocky outcrops in the hills.
  for (let i = 0; i < 26; i++) c.blob(14 + r() * 186, 8 + r() * 26, 3 + r() * 6, 2 + r() * 3, "l", r, 0.4, ".");
  for (const [cx, cy, rx, ry] of [[30, 16, 5, 3], [62, 22, 3, 2], [150, 14, 6, 3], [182, 24, 4, 3], [128, 30, 3, 2], [14, 30, 4, 4]] as const) c.blob(cx, cy, rx, ry, "^", r, 0.25);

  // ---- The sea along the east edge (the Saltmere Coast) ----
  for (let y = 0; y < OVER_H; y++) {
    const shore = 206 + Math.floor(2 * Math.sin(y / 9) + r() * 1.5);
    c.fill(shore, y, OVER_W - 1, y, "~");
    c.fill(shore - 5, y, shore - 1, y, "s", ".");
  }
  // Islands off the coast: a rocky one and a far one, joined by bridges.
  c.blob(223, 46, 6, 7, "s", r, 0.12);
  c.blob(223, 46, 4, 5, ".", r, 0.15);
  c.blob(232, 66, 5, 7, "s", r, 0.12);
  c.blob(232, 66, 3, 5, ".", r, 0.15);
  c.blob(226, 88, 4, 4, "s", r, 0.1);
  c.blob(226, 88, 2, 2, ".", r, 0.1);

  // ---- The west: the road to the Ashen Barrens, closed for now ----
  c.fill(0, 0, 2, OVER_H - 1, "^");
  for (let y = 0; y < OVER_H; y++) {
    const edge = 3 + Math.floor(3 + 2 * Math.sin(y / 6) + r() * 2);
    c.fill(3, y, edge, y, "^", ".");
  }
  // Withered land creeping in from the west, where the Withering began.
  for (let i = 0; i < 9; i++) c.blob(12 + r() * 10, 56 + r() * 36, 4 + r() * 4, 3 + r() * 3, "w", r, 0.3, ".");

  // ---- The Thornwood: everything south of the fence ----
  c.fill(3, FENCE_Y + 1, 205, OVER_H - 1, ":", ".");
  for (let x = 0; x < OVER_W; x++) {
    const depth = OVER_H - 3 - Math.floor(2 * Math.sin(x / 5) + r() * 2);
    c.fill(x, depth, x, OVER_H - 1, "T", ":.");
  }

  // ---- The big lake, west of town ----
  c.blob(46, 54, 24, 14, "~", r, 0.08);
  c.blob(40, 50, 4, 3, ".", r, 0.2); // a little island
  c.set(40, 50, "Y"); c.set(41, 49, "Y");
  // ---- The river: down from the mountains, past the farm, into the Thornwood ----
  for (let y = 3; y < OVER_H - 2; y++) {
    const x = 163 + Math.round(Math.sin(y / 11) * 1.5);
    c.fill(x, y, x + 2, y, "~");
  }

  // ---- Roads ----
  // The main road, west to east, through the town square.
  c.road(6, 73, 207, 73, ",", 2);
  // North road: from the square up to the quarry.
  c.road(88, 12, 88, 74, ",", 2);
  // South road: from the square down to the forest gate and on into the Thornwood.
  c.road(101, 74, 101, 150, ",", 2);
  // Hill roads to the old mine and the spider cave.
  c.road(52, 12, 88, 31, ",", 1);
  c.road(88, 14, 112, 14, ",", 1);
  c.road(112, 10, 112, 14, ",", 1);
  // Forest paths: west to the goblin camp, east to the spiders and graveyard, south-west to Wolf Hollow.
  c.road(50, 118, 101, 118, ",", 1);
  c.road(102, 124, 186, 124, ",", 1);
  // Bridges where roads cross water.
  for (let y = 0; y < OVER_H; y++) for (let x = 0; x < OVER_W; x++) if (c.get(x, y) === "~") {
    if ((y === 73 || y === 74) && x < 206) c.set(x, y, "=");
    if (y === 124 && x > 150 && x < 180) c.set(x, y, "=");
  }
  // Causeways out to the islands: from the beach, across the water, to the next land.
  const causeway = (y: number, x: number) => {
    while (c.get(x, y) !== "~") x++;
    while (c.get(x, y) === "~" || /\d/.test(c.get(x, y))) c.set(x++, y, "=");
  };
  causeway(46, 200); causeway(88, 200);
  c.fill(226, 52, 227, 61, "=", "~"); causeway(61, 226);

  // ---- The town square and the Lighthall ----
  c.fill(84, 63, 118, 77, ";");
  // The Lighthall: the Lightkeepers' great white temple, built around the Heart Shrine.
  const lh = building(c, 92, 47, 19, 17, { side: "s", at: 9 }, { roof: "u", wall: "A" });
  c.fill(93, 63, 109, 63, "A");
  c.set(lh!.x, lh!.y, "D");
  c.fill(96, 64, 106, 65, "a"); // the white steps
  pendingDoors.push({ ...lh!, area: "lighthall", label: "Enter the Lighthall", sign: "✨ The Lighthall" });
  places.lighthallSteps = { x: 101, y: 65 };
  places.board = { x: 110, y: 69 };
  places.bryn = { x: 112, y: 69 };
  c.set(90, 70, "q"); // the well
  // Hedges and flower beds round the square.
  for (const x of [85, 117]) c.fill(x, 64, x, 66, "h");

  // ---- West of the square: the General Store and Rook's workshop (south of the road) ----
  const tam = building(c, 74, 76, 9, 7, { side: "n", at: 4 });
  pendingDoors.push({ ...tam!, area: "tam", label: "Enter the General Store", sign: "💰 General Store" });
  const rook = building(c, 63, 76, 9, 7, { side: "n", at: 4 });
  pendingDoors.push({ ...rook!, area: "rook", label: "Enter Woodworker Rook's workshop", sign: "🪚 Woodworker Rook" });
  places.tanning_rack = { x: 72, y: 76 };
  // Old Maren's cottage, on the lake's east shore (her stove is inside).
  const maren = building(c, 64, 64, 5, 4, { side: "s", at: 2 });
  pendingDoors.push({ ...maren!, area: "maren", label: "Enter Old Maren's cottage", sign: "🎣 Old Maren" });
  // Wren's hut, by the lake, and the chicken coop north of the road.
  const wren = building(c, 54, 76, 7, 6, { side: "n", at: 3 });
  pendingDoors.push({ ...wren!, area: "wren", label: "Enter Herbalist Wren's hut", sign: "🌱 Herbalist Wren" });
  c.fill(72, 61, 82, 69, "|"); c.fill(73, 62, 81, 68, "."); c.set(77, 69, "."); // the coop's fence, with a gap
  spawnIn(c, "chicken", 6, 73, 62, 81, 68, r);
  // The Mages' Guild, south-west of town, near the lake shore.
  c.road(39, 74, 39, 81, ",", 1);
  const guild = building(c, 31, 82, 17, 11, { side: "n", at: 8 }, { roof: "r", wall: "W" });
  for (let x = 31; x <= 47; x++) c.set(x, 82, x === 39 ? "D" : "W"); // purple stone front
  pendingDoors.push({ ...guild!, area: "guild", label: "Enter the Mages' Guild", sign: "🔮 Mages' Guild" });

  // ---- East of the square: Trainer Row (north of the road) and the inn ----
  const holt = building(c, 121, 63, 8, 9, { side: "s", at: 3 });
  pendingDoors.push({ ...holt!, area: "holt", label: "Enter Forester Holt's house", sign: "🪓 Forester Holt" });
  const greta = building(c, 131, 63, 8, 9, { side: "s", at: 3 });
  pendingDoors.push({ ...greta!, area: "greta", label: "Enter Miner Greta's house", sign: "⛏️ Miner Greta" });
  const brann = building(c, 141, 62, 10, 10, { side: "s", at: 4 });
  pendingDoors.push({ ...brann!, area: "smithy", label: "Enter Smith Brann's smithy", sign: "🔨 Smith Brann" });
  const inn = building(c, 153, 63, 8, 9, { side: "s", at: 3 });
  pendingDoors.push({ ...inn!, area: "inn", label: "Enter the Hearthstone Inn", sign: "🍺 Hearthstone Inn" });
  c.fill(119, 72, 162, 72, ",", ".");
  // Cottages where the townsfolk live (no way in).
  for (const [x, y] of [[121, 52], [131, 51], [141, 52], [151, 53], [70, 86], [80, 88], [106, 79], [62, 92]] as const) building(c, x, y, 6, 6, null);

  // ---- South of the square: the pasture, Kael's lodge and the gate ----
  c.fill(116, 80, 158, 98, "|");
  c.fill(117, 81, 157, 97, ".");
  c.fill(117, 89, 117, 90, "."); c.fill(158, 89, 158, 90, ".");
  spawnIn(c, "cow", 5, 118, 82, 156, 96, r);
  spawnIn(c, "boar", 3, 130, 84, 156, 96, r);
  const kael = building(c, 104, 89, 8, 9, { side: "w", at: 5 });
  pendingDoors.push({ ...kael!, area: "kael", label: "Enter Huntmaster Kael's lodge", sign: "🏹 Huntmaster Kael" });
  // The fence, with its one gate on the south road.
  c.fill(3, FENCE_Y, OVER_W - 1, FENCE_Y, "|", ".,:wsTOBMY*");
  c.fill(GATE.x, FENCE_Y, GATE.x + 1, FENCE_Y, "+");
  c.set(GATE.x - 2, FENCE_Y - 1, "!");
  c.set(GATE.x + 3, FENCE_Y - 1, "!");

  // ---- Meadows round town ----
  c.scatter(60, 36, 160, 100, "T", 0.025, r);
  c.scatter(60, 36, 160, 100, "O", 0.012, r);
  c.scatter(118, 36, 160, 60, "O", 0.03, r);
  c.place(60, 40, 160, 100, "*", 14, r);
  c.blob(76, 46, 6, 5, "T", r, 0.3, ".");
  // A pine wood just north of Trainer Row (Holt's first lesson), and a dig patch outside Wren's door.
  c.scatter(118, 59, 162, 61, "T", 0.35, r);
  c.scatter(118, 44, 165, 50, "T", 0.2, r);
  c.set(wren!.out.x + 2, wren!.out.y, "*");
  c.blob(74, 98, 9, 3, "O", r, 0.4, ".");
  // Yews along the lake's north shore, birches to the south-west.
  c.place(26, 34, 70, 40, "Y", 6, r);
  c.place(14, 76, 30, 100, "B", 18, r);
  c.place(14, 76, 30, 100, "O", 10, r);
  // Fishing in the lake: trout by the town, perch to the south, pike out west.
  const shoreSpots = (x0: number, y0: number, x1: number, y1: number, ch: string, n: number) => {
    for (let tries = 0; n > 0 && tries < 4000; tries++) {
      const x = x0 + Math.floor(r() * (x1 - x0 + 1)), y = y0 + Math.floor(r() * (y1 - y0 + 1));
      if (c.get(x, y) !== "~") continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ".,;sw:".includes(c.get(x + dx, y + dy)))) continue;
      c.set(x, y, ch);
      n--;
    }
  };
  shoreSpots(56, 44, 71, 68, "2", 5);
  shoreSpots(36, 60, 58, 69, "3", 4);
  shoreSpots(20, 42, 36, 66, "5", 4);
  // Slimes in the wet meadow east of the lake, under the willows.
  spawnIn(c, "slime", 5, 64, 42, 82, 58, r);
  // Bats come out over the meadows at night (they only bite back here).
  spawnIn(c, "giant_bat", 2, 60, 40, 84, 60, r);
  spawnIn(c, "giant_bat", 2, 120, 76, 160, 100, r);

  // ---- The quarry and the Greyspine hills ----
  c.blob(90, 24, 16, 8, ",", r, 0.25, ".T");
  c.place(74, 17, 106, 32, "#", 14, r, ",");
  c.place(74, 17, 106, 32, "c", 9, r, ",");
  c.place(74, 17, 106, 32, "t", 9, r, ",");
  c.place(30, 10, 70, 32, "i", 7, r, ".l");
  c.place(118, 10, 150, 30, "i", 5, r, ".l");
  c.place(118, 10, 160, 30, "k", 6, r, ".l");
  c.place(30, 10, 70, 32, "k", 4, r, ".l");
  spawnIn(c, "rat", 6, 76, 18, 104, 32, r);
  spawnIn(c, "giant_bat", 2, 30, 12, 70, 34, r);
  c.scatter(14, 8, 200, 36, "T", 0.05, r);
  c.scatter(130, 8, 200, 36, "B", 0.05, r);
  c.scatter(14, 8, 70, 36, "B", 0.02, r);
  c.place(110, 8, 200, 36, "M", 10, r);
  c.place(14, 8, 200, 36, "*", 14, r, ".l");
  // The old mine and the spider cave, in the cliffs.
  c.fill(48, 6, 56, 11, "^");
  const mine = { x: 52, y: 11, out: { x: 52, y: 12 } };
  c.set(mine.x, mine.y, "D");
  c.fill(51, 12, 53, 12, ",");
  pendingDoors.push({ ...mine, area: "old_mine", label: "Enter the old mine", sign: "⛏️ Old mine" });
  c.fill(108, 4, 116, 9, "^");
  const spider = { x: 112, y: 9, out: { x: 112, y: 10 } };
  c.set(spider.x, spider.y, "D");
  pendingDoors.push({ ...spider, area: "spider_cave", label: "Enter the spider cave ⚠", sign: "🕷️ Spider cave ⚠" });

  // ---- The farm, over the river ----
  c.fill(168, 42, 199, 100, ".", ".TOBM*s");
  c.fill(168, 41, 199, 41, "h"); c.fill(168, 101, 199, 101, "h");
  building(c, 168, 43, 7, 6, null); // Odo's farmhouse
  places.odo = { x: 171, y: 50 };
  places.chest_farm = { x: 169, y: 51 };
  for (const y of [44, 52, 60, 77, 85, 93]) {
    for (const x of [177, 185, 193]) {
      if (y === 93 && x !== 177) continue;
      lots.push({ x, y });
    }
  }
  // Keep the first seven lots in the old order: everyone's farm stays theirs (only the place moves).
  for (const l of lots) c.fill(l.x, l.y, l.x + 5, l.y + 5, "f");

  // ---- The Saltmere Coast ----
  places.chest_east = { x: 203, y: 71 };
  c.fill(202, 70, 205, 76, "s", ".");
  shoreSpots(206, 30, 214, 100, "6", 7);
  shoreSpots(214, 36, 232, 56, "7", 5);
  shoreSpots(226, 56, 239, 78, "8", 5);
  c.place(219, 40, 228, 52, "v", 3, r);
  c.place(219, 40, 228, 52, "g", 3, r);
  c.place(219, 40, 228, 52, "I", 4, r);
  c.place(228, 60, 236, 72, "E", 4, r);
  c.place(228, 60, 236, 72, "m", 2, r);
  c.place(228, 60, 236, 72, "I", 2, r);
  c.place(224, 86, 228, 90, "m", 1, r);
  c.place(176, 8, 204, 36, "Y", 4, r);
  // Salmon in the river.
  shoreSpots(158, 20, 168, 100, "4", 8);

  // ---- The Westroad shrine (smashed), and the barricade on the Barrens road ----
  places.westShrine = { x: 16, y: 70 };
  c.fill(13, 67, 19, 71, ",", ".w");
  c.fill(4, 72, 10, 75, ",", "^.w");
  c.fill(4, 72, 4, 75, "x");
  c.set(6, 71, "!");
  // Ashbound scouts smashing the shrine (Act 1: Ash on the Road).
  spawnIn(c, "ashbound_scout", 4, 8, 64, 24, 71, r, 0, 0, ".,w");

  // ---- The Thornwood ----
  c.scatter(3, FENCE_Y + 1, 205, OVER_H - 3, "T", 0.17, r, ":");
  c.scatter(3, FENCE_Y + 1, 205, OVER_H - 3, "O", 0.05, r, ":");
  c.scatter(3, FENCE_Y + 1, 205, OVER_H - 3, "M", 0.03, r, ":");
  c.scatter(3, FENCE_Y + 1, 205, OVER_H - 3, "Y", 0.012, r, ":");
  c.place(3, FENCE_Y + 1, 205, OVER_H - 3, "*", 12, r, ":");
  c.place(20, 120, 90, 150, "i", 5, r, ":");
  c.place(120, 125, 200, 150, "k", 4, r, ":");
  // Clearings: by the gate (and the forest's first shrine), the goblin camp, the spiders' hollow, the raiders' camp.
  const FOREST = ":TOMY*ik";
  c.blob(101, 110, 9, 5, ":", r, 0.2, FOREST);
  c.road(101, 74, 101, 150, ",", 2);
  places.thornShrine = { x: 105, y: 110 };
  places.rhys = { x: 108, y: 111 };
  places.chest_forest = { x: 97, y: 108 };
  c.blob(44, 120, 12, 7, ":", r, 0.25, FOREST);
  c.blob(150, 120, 12, 8, ":", r, 0.25, FOREST);
  c.blob(116, 146, 13, 6, ":", r, 0.25, FOREST);
  c.blob(70, 141, 10, 6, ":", r, 0.25, FOREST); // Wolf Hollow
  c.road(50, 118, 101, 118, ",", 1, FOREST + ","); c.road(102, 124, 186, 124, ",", 1, FOREST + ",="); c.road(71, 138, 101, 138, ",", 1, FOREST + ",");
  c.fill(66, 133, 74, 136, "^");
  const den = { x: 70, y: 136, out: { x: 70, y: 137 } };
  c.set(den.x, den.y, "D");
  c.fill(68, 137, 72, 138, ":");
  pendingDoors.push({ ...den, area: "wolf_den", label: "Enter the wolf den ⚠", sign: "🐺 Wolf den ⚠" });
  // Tents in the goblin camp.
  for (const [x, y] of [[38, 117], [48, 122], [42, 124]] as const) c.fill(x, y, x + 1, y + 1, "e");
  // The graveyard, east over the river.
  c.blob(186, 120, 11, 9, ":", r, 0.2, FOREST);
  c.fill(178, 113, 196, 113, "h"); c.fill(178, 129, 196, 129, "h"); c.fill(178, 113, 178, 129, "h"); c.fill(196, 113, 196, 129, "h");
  c.fill(178, 124, 178, 124, ","); c.fill(178, 123, 178, 123, ":");
  for (let y = 115; y <= 127; y += 3) for (let x = 181; x <= 193; x += 3) if (r() < 0.8) c.set(x, y, "V");
  // Monsters of the Thornwood: wolves near the gate, goblins west, spiders east, Ashbound raiders deep south.
  spawnIn(c, "wolf", 7, 84, 106, 122, 122, r, 0, 0, ":");
  spawnIn(c, "goblin", 5, 34, 114, 56, 128, r, 0, 0, ":");
  spawnIn(c, "spider", 4, 140, 114, 162, 130, r, 0, 0, ":");
  spawnIn(c, "bandit", 3, 106, 142, 128, 152, r, 0, 0, ":");
  spawnIn(c, "giant_bat", 2, 180, 115, 195, 128, r, 0, 0, ":");
  spawnIn(c, "giant_bat", 1, 90, 106, 112, 118, r, 0, 0, ":");
  spawnIn(c, "hollow_wolf", 5, 62, 139, 80, 146, r, 0, 0, ":"); // Wolf Hollow's Blighted pack (Act 1)

  c.fill(GATE.x, FENCE_Y, GATE.x + 1, FENCE_Y, "+");
  // ---- The story's lanterns and places (shared/story.ts) ----
  // Lanterns on the Lighthall's steps and round the square (Light the Way).
  ([[95, 64], [107, 64], [92, 67], [110, 66], [94, 71], [108, 71]] as const).forEach(([x, y], i) => { places[`lantern_${i + 1}`] = { x, y }; });
  // Shrine lanterns round Heartvale (Lantern Rounds): quarry road, lake, inn, farm, coast, Kael's gate.
  ([[91, 40], [71, 58], [160, 72], [168, 76], [203, 66], [97, 101]] as const).forEach(([x, y], i) => { places[`round_${i + 1}`] = nearFree(c, x, y); });
  // Places to walk to: Odo's fields (Blessing the Fields), Holt's dead trees (What Holt Saw), the Thornwood clearing.
  const spots: Record<string, [number, number]> = {
    fieldNorth: [183, 49], fieldMid: [189, 58], fieldSouth: [183, 82],
    nearLighthall: [87, 57], nearWestShrine: [20, 66], nearGate: [96, 106],
    farLake: [46, 38], farPeaks: [150, 30], farCoast: [205, 36],
    thornEdge: [103, 112],
  };
  for (const [k, [x, y]] of Object.entries(spots)) storySpots[`spot.${k}`] = nearFree(c, x, y);
  // ---- Last: keep every doorway and every person's spot clear ----
  const WALK = ".,;:asw*=Cfo_pzGl";
  const clear = (p: Point) => {
    if (!WALK.includes(c.get(p.x, p.y))) c.set(p.x, p.y, ",");
  };
  for (const d of pendingDoors) clear(d.out);
  for (const p of Object.values(places)) {
    clear(p);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ("TOBMYIE#ctikvgmV".includes(c.get(p.x + dx, p.y + dy))) c.set(p.x + dx, p.y + dy, c.get(p.x, p.y) === ";" ? ";" : ".");
  }
  pickSpawns(c, r);
  return c;
}

// ---------------------------------------------------------------- inside places

interface Inside {
  id: string;
  name: string;
  kind: AreaDef["kind"];
  danger?: boolean;
  canvas: Canvas;
  /** The door(s) out, in order: [0] goes back outside. */
  doors: Point[];
  /** Named spots inside (for NPCs and stations). */
  spots: Record<string, Point>;
  /** Monsters inside: [kind, local x, local y]. */
  monsters?: [MonsterId, number, number][];
}

/** A plain wooden room with the door in the middle of the bottom wall. */
function house(w: number, h: number) {
  const c = new Canvas(w, h).room("H", "p");
  const door = { x: Math.floor(w / 2), y: h - 1 };
  c.set(door.x, door.y, "D");
  return { c, door };
}

function insides(): Inside[] {
  const r = rng(77);
  const list: Inside[] = [];

  // ---- The Lighthall: the Lightkeepers' temple, built around the Heart Shrine ----
  {
    const c = new Canvas(37, 27).room("A", "a");
    // The west wing: the ledger room (locked), Enchanter Vale's alcove, the keepers' quarters.
    c.fill(10, 1, 10, 25, "A");
    c.fill(1, 9, 9, 9, "A"); c.fill(1, 18, 9, 18, "A");
    c.set(5, 9, "J"); // the ledger room's locked door
    c.fill(10, 13, 10, 14, "a"); c.fill(10, 21, 10, 22, "a");
    c.fill(2, 2, 8, 2, "b"); c.fill(2, 4, 3, 7, "n"); c.fill(6, 4, 8, 4, "e");
    // Sister Wynne's dormitory: beds along the walls (the way in from the nave stays clear).
    for (let y = 19; y <= 25; y++) c.set(1, y, "y");
    for (const y of [19, 24, 25]) c.set(9, y, "y");
    c.fill(2, 10, 4, 10, "b");
    // The east wing: the Hall of Champions (statues of past Radiants) and the library.
    c.fill(26, 1, 26, 25, "A");
    c.fill(27, 18, 35, 18, "A");
    c.fill(26, 12, 26, 14, "a"); c.fill(26, 21, 26, 22, "a");
    for (const [x, y] of [[28, 3], [31, 3], [34, 3], [28, 8], [34, 8], [28, 13], [34, 13]] as const) c.set(x, y, "S");
    // The library: shelves along both walls, and two rows of free-standing shelves (books on both sides).
    c.fill(28, 19, 35, 19, "b"); c.fill(28, 25, 35, 25, "b");
    for (const y of [21, 23]) { c.fill(29, y, 30, y, "b"); c.fill(33, y, 34, y, "b"); }
    // The nave: pillars, a gold carpet from the door to the shrine, and the shrine's glow.
    for (const [x, y] of [[13, 5], [23, 5], [13, 11], [23, 11], [13, 17], [23, 17], [13, 22], [23, 22]] as const) c.set(x, y, "A");
    c.fill(16, 3, 20, 7, "o");
    c.fill(17, 8, 19, 25, "z");
    const door = { x: 18, y: 26 };
    c.set(door.x, door.y, "D");
    list.push({
      id: "lighthall", name: "The Lighthall", kind: "indoor", canvas: c, doors: [door],
      spots: {
        heartShrine: { x: 18, y: 5 }, wake: { x: 18, y: 8 }, aldric: { x: 21, y: 9 }, celene: { x: 15, y: 9 },
        vale: { x: 3, y: 14 }, ledgerDoor: { x: 5, y: 9 }, oren: { x: 31, y: 13 }, lisette: { x: 31, y: 22 },
        tomas: { x: 6, y: 11 }, wynne: { x: 5, y: 22 }, plinth: { x: 31, y: 8 },
        // Four of the Radiants' statues (Brother Oren's tour).
        radiant_1: { x: 28, y: 13 }, radiant_2: { x: 34, y: 13 }, radiant_3: { x: 28, y: 8 }, radiant_4: { x: 34, y: 8 },
      },
    });
  }
  // ---- Old Maren's cottage, by the lake: her stove, her bed, and her fishing things ----
  {
    const { c, door } = house(9, 7);
    c.set(7, 1, "y"); c.fill(4, 1, 5, 1, "b"); c.set(1, 4, "n"); c.set(7, 4, "e");
    list.push({ id: "maren", name: "Old Maren's cottage", kind: "indoor", canvas: c, doors: [door], spots: { maren: { x: 4, y: 3 }, stove: { x: 2, y: 2 } } });
  }
  // ---- Shops and trainers' houses ----
  {
    const { c, door } = house(11, 8);
    c.fill(2, 3, 8, 3, "n"); c.set(5, 3, "p"); c.fill(1, 1, 9, 1, "b");
    list.push({ id: "tam", name: "The General Store", kind: "indoor", canvas: c, doors: [door], spots: { tam: { x: 5, y: 2 } } });
  }
  {
    const { c, door } = house(9, 8);
    c.fill(1, 1, 2, 2, "e"); c.fill(6, 1, 7, 1, "e");
    list.push({ id: "holt", name: "Forester Holt's house", kind: "indoor", canvas: c, doors: [door], spots: { holt: { x: 4, y: 3 } } });
  }
  {
    const { c, door } = house(9, 8);
    c.fill(1, 1, 2, 1, "e"); c.fill(6, 1, 7, 2, "e");
    list.push({ id: "greta", name: "Miner Greta's house", kind: "indoor", canvas: c, doors: [door], spots: { greta: { x: 4, y: 3 } } });
  }
  {
    const { c, door } = house(13, 9);
    c.fill(1, 1, 11, 1, "e");
    list.push({ id: "smithy", name: "Smith Brann's smithy", kind: "indoor", canvas: c, doors: [door], spots: { brann: { x: 6, y: 4 }, furnace: { x: 3, y: 3 }, anvil: { x: 9, y: 3 } } });
  }
  {
    const { c, door } = house(11, 8);
    c.fill(1, 1, 9, 1, "e");
    list.push({ id: "rook", name: "Woodworker Rook's workshop", kind: "indoor", canvas: c, doors: [door], spots: { rook: { x: 5, y: 3 }, workbench: { x: 8, y: 3 }, spinning_wheel: { x: 2, y: 3 } } });
  }
  {
    const { c, door } = house(9, 8);
    c.fill(1, 1, 7, 1, "e");
    list.push({ id: "kael", name: "Huntmaster Kael's lodge", kind: "indoor", canvas: c, doors: [door], spots: { kael: { x: 4, y: 3 } } });
  }
  {
    const { c, door } = house(8, 7);
    c.fill(1, 1, 6, 1, "b");
    list.push({ id: "wren", name: "Herbalist Wren's hut", kind: "indoor", canvas: c, doors: [door], spots: { wren: { x: 3, y: 3 } } });
  }
  {
    const { c, door } = house(13, 9);
    c.fill(4, 4, 5, 5, "n"); c.fill(8, 4, 9, 5, "n"); c.fill(1, 1, 3, 1, "e");
    list.push({ id: "inn", name: "The Hearthstone Inn", kind: "indoor", canvas: c, doors: [door], spots: { stove_inn: { x: 2, y: 3 }, chest_inn: { x: 10, y: 2 } } });
  }
  // ---- The Mages' Guild ----
  {
    const c = new Canvas(19, 11).room("W", "_");
    c.fill(1, 1, 17, 1, "b");
    const door = { x: 9, y: 10 };
    c.set(door.x, door.y, "D");
    list.push({
      id: "guild", name: "The Mages' Guild", kind: "indoor", canvas: c, doors: [door],
      spots: {
        archmage: { x: 9, y: 3 }, moss: { x: 3, y: 4 }, alchemy_table: { x: 2, y: 3 }, altar: { x: 6, y: 3 },
        repairer: { x: 15, y: 5 }, guildboard: { x: 12, y: 3 }, chest: { x: 16, y: 3 },
      },
    });
  }
  // ---- Caves ----
  {
    // The spider cave in the Greyspine cliffs: cave spiders, and a way through to the crystal cave.
    const c = new Canvas(28, 15, "K");
    c.blob(8, 9, 6, 4, "C", r, 0.2); c.blob(18, 7, 7, 4, "C", r, 0.2); c.fill(8, 8, 22, 9, "C");
    c.fill(13, 9, 13, 13, "C");
    const door = { x: 13, y: 14 }; c.set(door.x, door.y, "D");
    c.fill(24, 6, 26, 7, "C");
    const inner = { x: 27, y: 6 }; c.set(inner.x, inner.y, "D");
    c.place(4, 5, 24, 12, "#", 3, r, "C");
    list.push({ id: "spider_cave", name: "The spider cave", kind: "cave", danger: true, canvas: c, doors: [door, inner], spots: {},
      monsters: [["cave_spider", 7, 8], ["cave_spider", 17, 6], ["cave_spider", 20, 9]] });
  }
  {
    // The crystal cave: gem rocks, emberstone veins, platinum and iridium.
    const c = new Canvas(30, 14, "K");
    c.blob(10, 7, 9, 5, "G", r, 0.15); c.blob(21, 7, 8, 5, "G", r, 0.15);
    c.fill(1, 6, 4, 7, "G");
    const door = { x: 0, y: 6 }; c.set(door.x, door.y, "D");
    const rocks = "UUUQQQLLLNNZZRRPX";
    for (const ch of rocks) c.place(4, 2, 28, 12, ch, 1, r, "G");
    c.place(4, 2, 28, 12, "L", 2, r, "G");
    list.push({ id: "crystal_cave", name: "The crystal cave", kind: "cave", danger: true, canvas: c, doors: [door], spots: {} });
  }
  {
    // The old mine: deeper ores, and rats.
    const c = new Canvas(32, 16, "K");
    c.fill(2, 10, 29, 12, "C"); c.fill(15, 2, 17, 12, "C"); c.blob(7, 6, 5, 3, "C", r, 0.2); c.blob(25, 5, 5, 3, "C", r, 0.2);
    c.fill(5, 6, 15, 7, "C"); c.fill(17, 5, 22, 6, "C");
    c.fill(15, 13, 15, 14, "C");
    const door = { x: 15, y: 15 }; c.set(door.x, door.y, "D");
    for (const [ch, n] of [["i", 5], ["k", 5], ["v", 3], ["g", 2], ["m", 2]] as const) c.place(2, 2, 29, 12, ch, n, r, "C");
    list.push({ id: "old_mine", name: "The old mine", kind: "cave", canvas: c, doors: [door], spots: {},
      monsters: [["rat", 6, 11], ["rat", 24, 11], ["rat", 16, 8]] });
  }
  {
    // The wolf den in Wolf Hollow: the alpha wolf and its pack (Kael's Wolf Hunt).
    const c = new Canvas(20, 13, "K");
    c.blob(10, 6, 8, 5, "C", r, 0.15);
    c.fill(10, 10, 10, 11, "C");
    const door = { x: 10, y: 12 }; c.set(door.x, door.y, "D");
    list.push({ id: "wolf_den", name: "The wolf den", kind: "cave", danger: true, canvas: c, doors: [door], spots: {},
      monsters: [["alpha_wolf", 10, 4], ["wolf", 6, 5], ["wolf", 14, 5], ["wolf", 7, 8], ["wolf", 13, 8]] });
  }
  return list;
}

// ---------------------------------------------------------------- putting it together

function assemble() {
  const over = buildOverworld();
  areas.push({ id: "heartvale", name: "Heartvale", x: 0, y: 0, w: OVER_W, h: OVER_H, kind: "outdoor" });
  // Pack the inside places in rows below the outdoors, with empty space between them.
  const inside = insides();
  const GAP = 6;
  let x = GAP, y = OVER_H + GAP, rowH = 0;
  const pos: Record<string, Point> = {};
  for (const a of inside) {
    if (x + a.canvas.w + GAP > OVER_W) { x = GAP; y += rowH + GAP; rowH = 0; }
    pos[a.id] = { x, y };
    areas.push({ id: a.id, name: a.name, x, y, w: a.canvas.w, h: a.canvas.h, kind: a.kind, danger: a.danger });
    x += a.canvas.w + GAP;
    rowH = Math.max(rowH, a.canvas.h);
  }
  const H = y + rowH + GAP;
  const grid = new Canvas(OVER_W, H, " ");
  over.g.forEach((row, yy) => row.forEach((ch, xx) => grid.set(xx, yy, ch)));
  for (const a of inside) {
    const o = pos[a.id];
    a.canvas.g.forEach((row, yy) => row.forEach((ch, xx) => grid.set(o.x + xx, o.y + yy, ch)));
    for (const [k, p] of Object.entries(a.spots)) places[`${a.id}.${k}`] = { x: o.x + p.x, y: o.y + p.y };
    for (const [kind, mx, my] of a.monsters ?? []) spawns.push([kind, o.x + mx, o.y + my]);
  }
  // A door's inside landing: the floor tile next to it.
  const inward = (d: Point) => {
    for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
      const ch = grid.get(d.x + dx, d.y + dy);
      if (ch !== " " && !"AHWKJ^D".includes(ch)) return { x: d.x + dx, y: d.y + dy };
    }
    throw new Error(`door at ${d.x},${d.y} has no floor next to it`);
  };
  const insideById = Object.fromEntries(inside.map((a) => [a.id, a]));
  const inDoor = (id: string, i = 0) => {
    const d = insideById[id].doors[i];
    return { x: pos[id].x + d.x, y: pos[id].y + d.y };
  };
  for (const p of pendingDoors) {
    const inner = inDoor(p.area);
    doors.push({ x: p.x, y: p.y, to: inward(inner), area: p.area, label: p.label, sign: p.sign });
    doors.push({ x: inner.x, y: inner.y, to: p.out, area: "heartvale", label: "Leave" });
  }
  // The spider cave goes on through to the crystal cave.
  const sc = inDoor("spider_cave", 1), cc = inDoor("crystal_cave");
  doors.push({ x: sc.x, y: sc.y, to: inward(cc), area: "crystal_cave", label: "Go deeper: the crystal cave" });
  doors.push({ x: cc.x, y: cc.y, to: inward(sc), area: "spider_cave", label: "Back to the spider cave" });
  places.wake = places["lighthall.wake"];
  return grid;
}

const GRID = assemble();

/** The whole world, one row of characters per line. */
export const WORLD_ROWS: string[] = GRID.g.map((row) => row.join(""));
export const WORLD_W = GRID.w;
export const WORLD_H = GRID.h;
export const AREAS: readonly AreaDef[] = areas;
export const DOORS: readonly Door[] = doors;
/** Named spots: where people and stations stand, where you wake up... */
export const PLACES: Readonly<Record<string, Point>> = { ...places, ...storySpots };
/** Just the story's places to walk to ("spot.fieldNorth"...). */
export const STORY_SPOTS: Readonly<Record<string, Point>> = storySpots;
/** Monster homes: [type, x, y]. */
export const WORLD_SPAWNS: readonly [MonsterId, number, number][] = spawns;
/** Names of the regions and landmarks, for the world map (🗺️). */
export const MAP_LABELS: readonly { x: number; y: number; text: string; big?: boolean }[] = [
  { x: 120, y: 3, text: "The Greyspine Peaks", big: true },
  { x: 92, y: 26, text: "Quarry" },
  { x: 46, y: 55, text: "The lake" },
  { x: 101, y: 57, text: "The Lighthall" },
  { x: 140, y: 58, text: "Trainer Row" },
  { x: 137, y: 90, text: "Pasture" },
  { x: 186, y: 69, text: "The farm" },
  { x: 220, y: 30, text: "Saltmere Coast", big: true },
  { x: 24, y: 82, text: "To the Barrens (closed)" },
  { x: 100, y: 128, text: "The Thornwood (Dark Forest)", big: true },
  { x: 44, y: 128, text: "Goblin camp" },
  { x: 150, y: 129, text: "Spider hollow" },
  { x: 70, y: 147, text: "Wolf Hollow" },
  { x: 116, y: 153, text: "Ashbound camp" },
  { x: 187, y: 132, text: "Graveyard" },
];

/** The farm's lots (top-left tile of each 6 × 6 lot). The first seven are the original ones. */
export const WORLD_LOTS: readonly Point[] = lots;
