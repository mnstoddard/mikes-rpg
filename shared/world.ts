// The world of Embervale: the big outdoor map (Heartvale and the lands around it)
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
//   r roof    u gold roof (the Emberhall)   H wooden wall   p floorboards   D door   J locked door
//   A white stone wall   a white stone floor   o glowing floor   z gold carpet   S statue   F brazier   d inside door (between rooms)   ] iron grille
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
  /** One of Emberhold's gates out into Heartvale (open once you've sworn the Oath of the Flame). */
  gate?: boolean;
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
const pendingDoors: { x: number; y: number; out: Point; area: string; sign?: string; label: string; from?: string }[] = [];
/**
 * Version 0.20: the town moved inside Emberhold's walls. Heartvale's old village
 * buildings are still drawn (it's where the gates will lead one day), but their
 * doors don't go anywhere now: the same shops and houses are in the city.
 */
const oldTown = (_d: { x: number; y: number; out: Point; area: string; sign?: string; label: string }) => {};
const oldLots: Point[] = [];

/**
 * Emberhold's walls as Heartvale sees them (version 0.20): a walled block where the old village was. The city itself
 * is its own area (buildEmberhold); these walls, towers, rooftops and gates are what you see from out in the valley.
 */
export const HV_WALL = { X0: 66, X1: 170, Y0: 40, Y1: 97 };
/** The four gates in those walls. `out` is the way out into the valley; the tiles are the archway. */
export const HV_GATES: { name: string; out: Point; tiles: Point[] }[] = [
  { name: "North Gate", out: { x: 0, y: -1 }, tiles: [96, 97, 98].flatMap((x) => [{ x, y: 40 }, { x, y: 41 }]) },
  { name: "West Gate", out: { x: -1, y: 0 }, tiles: [72, 73, 74].flatMap((y) => [{ x: 66, y }, { x: 67, y }]) },
  { name: "Saltmere Gate", out: { x: 1, y: 0 }, tiles: [72, 73, 74].flatMap((y) => [{ x: 170, y }, { x: 169, y }]) },
  { name: "River Gate", out: { x: 0, y: 1 }, tiles: [100, 101, 102].flatMap((x) => [{ x, y: 97 }, { x, y: 96 }]) },
];

/** The city behind the walls, from outside: streets and rooftops, the Emberhall on its hill, the bell tower. */
function hvCityBackdrop(c: Canvas, r: () => number) {
  const { X0, X1, Y0, Y1 } = HV_WALL;
  const riverAt = (y: number) => 163 + Math.round(Math.sin(y / 11) * 1.5);
  // A building fits where every tile is still unbuilt (">") and no other building ("B") touches it.
  const free = (x: number, y: number, w: number, h: number) => {
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      const edge = yy === y - 1 || yy === y + h || xx === x - 1 || xx === x + w;
      if (xx <= X0 + 1 || xx >= X1 - 1 || yy <= Y0 + 1 || yy >= Y1 - 1) return false;
      const ch = c.get(xx, yy);
      if (edge ? ch === "B" : ch !== ">") return false;
    }
    return true;
  };
  const street = (x0: number, y0: number, x1: number, y1: number) => c.fill(x0, y0, x1, y1, "<", ">");
  // Main streets from each gate to the middle, and a lane inside the wall.
  street(X0 + 2, 72, X1 - 2, 74); street(96, Y0 + 2, 98, Y1 - 2); street(100, 75, 102, Y1 - 2);
  street(X0 + 2, Y0 + 2, X1 - 2, Y0 + 3); street(X0 + 2, Y1 - 3, X1 - 2, Y1 - 2);
  street(X0 + 2, Y0 + 2, X0 + 3, Y1 - 2); street(X1 - 3, Y0 + 2, X1 - 2, Y1 - 2);
  street(76, 60, 160, 61); street(76, 85, 160, 86); street(84, Y0 + 2, 85, Y1 - 2); street(130, Y0 + 2, 131, Y1 - 2);
  for (let y = Y0 + 2; y <= Y1 - 2; y++) { const x = riverAt(y); c.fill(x, y, x + 2, y, "~"); }
  // The Emberhall on Ember Hill, north of the middle, with the plaza in front; the bell tower by the square.
  const hall = { x: 102, y: 44, w: 19, h: 14 };
  c.fill(hall.x - 2, hall.y - 1, hall.x + hall.w + 1, hall.y + hall.h + 2, "<");
  cityBuildings.push({ ...hall, district: "hill", floors: 3, wall: "marble", roof: "gold", detail: false, landmark: "emberhall", chimney: false, seed: 9 });
  c.fill(hall.x, hall.y, hall.x + hall.w - 1, hall.y + hall.h - 1, ">");
  cityBuildings.push({ x: 108, y: 66, w: 4, h: 4, district: "market", floors: 5, wall: "stone", roof: "slate", detail: false, landmark: "belltower", chimney: false, seed: 8 });
  c.fill(106, 64, 114, 71, "<"); c.fill(108, 66, 111, 69, ">");
  for (let y = Y0 + 3; y < Y1 - 3; y++) for (let x = X0 + 3; x < X1 - 3; x++) {
    if (c.get(x, y) !== ">") continue;
    if (x >= hall.x - 1 && x <= hall.x + hall.w && y >= hall.y - 1 && y <= hall.y + hall.h) continue;
    if (x >= 107 && x <= 112 && y >= 65 && y <= 70) continue;
    const sizes: [number, number][] = [[6, 5], [5, 4], [7, 5], [4, 4], [5, 5], [4, 3], [3, 3]];
    const s = sizes.slice(Math.floor(r() * 3)).find(([w, h]) => free(x, y, w, h));
    if (!s) continue;
    const [w, h] = s;
    c.fill(x, y, x + w - 1, y + h - 1, "B");
    const rx = (x - X0) / (X1 - X0), ry = (y - Y0) / (Y1 - Y0);
    const d: District = rx > 0.86 ? "docks" : ry < 0.32 ? "hill" : ry > 0.62 ? "lower" : rx < 0.3 ? "forge" : "market";
    const wall: CityBuilding["wall"] = d === "lower" ? (r() < 0.5 ? "timber" : "plank") : d === "docks" ? (r() < 0.5 ? "plank" : "stone") : d === "market" && r() < 0.4 ? "timber" : "stone";
    const roof: CityBuilding["roof"] = d === "hill" ? "slate" : d === "forge" ? "dark" : d === "lower" ? "thatch" : d === "docks" ? (r() < 0.5 ? "dark" : "red") : "red";
    const floors = d === "hill" ? 2 + (r() < 0.2 ? 1 : 0) : d === "market" ? 2 : r() < 0.4 ? 2 : 1;
    cityBuildings.push({ x, y, w, h, district: d, floors, wall, roof, detail: false, chimney: r() < 0.4, seed: Math.floor(r() * 1e6) });
  }
  // Everything that isn't a building is a street (still out of reach behind the wall).
  for (let y = Y0 + 2; y <= Y1 - 2; y++) for (let x = X0 + 2; x <= X1 - 2; x++) {
    const ch = c.get(x, y);
    if (ch === "B") c.set(x, y, ">");
    else if (ch === ">" && !(x >= hall.x && x < hall.x + hall.w && y >= hall.y && y < hall.y + hall.h) && !(x >= 108 && x <= 111 && y >= 66 && y <= 69)) c.set(x, y, "<");
  }
}

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

  // ---- The big lake, west of the city ----
  c.blob(42, 55, 20, 12, "~", r, 0.08);
  c.blob(38, 51, 4, 3, ".", r, 0.2); // a little island
  c.set(38, 51, "Y"); c.set(39, 50, "Y");
  // ---- The Glass River: down from the mountains, through Emberhold, into the Thornwood ----
  for (let y = 3; y < OVER_H - 2; y++) {
    const x = 163 + Math.round(Math.sin(y / 11) * 1.5);
    c.fill(x, y, x + 2, y, "~");
  }

  // ---- Emberhold's walls (version 0.20): the city stands where the old village was ----
  // From out here you see its walls, towers and rooftops, with the Emberhall's spire in the middle. Each of its
  // four gates is a way in: step into the archway and you're inside the city (the doors are made in assemble()).
  const { X0, X1, Y0, Y1 } = HV_WALL;
  c.fill(X0, Y0, X1, Y1, ">");
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    if (x > X0 + 1 && x < X1 - 1 && y > Y0 + 1 && y < Y1 - 1) continue;
    if (c.get(x, y) === "~" && y > Y0 + 1 && y < Y1 - 1) continue;
    c.set(x, y, "%");
  }
  // The river runs in under the north wall and out under the south wall, through iron grilles.
  for (let x = X0; x <= X1; x++) for (const y of [Y0, Y0 + 1, Y1 - 1, Y1]) if (x >= 161 && x <= 167 && Math.abs(x - (163 + Math.round(Math.sin(y / 11) * 1.5)) - 1) <= 1) c.set(x, y, "~");
  const tower = (x: number, y: number) => { c.fill(x - 1, y - 1, x + 1, y + 1, "&"); cityTowers.push({ x, y }); };
  for (const x of [X0 + 1, 86, 120, 145, X1 - 1]) { tower(x, Y0 + 1); tower(x, Y1 - 1); }
  for (const y of [57, 86]) { tower(X0 + 1, y); tower(X1 - 1, y); }
  // The gates: archways you can walk into.
  for (const g of HV_GATES) for (const t of g.tiles) c.set(t.x, t.y, "}");
  // Inside: the city's streets and rooftops (scenery from out here: the 3D game draws them from CITY_BUILDINGS).
  hvCityBackdrop(c, r);
  for (const g of HV_GATES) {
    const t = g.tiles[Math.floor(g.tiles.length / 2)];
    citySigns.push({ x: t.x + g.out.x * 2, y: t.y + g.out.y * 2, text: `🚪 Emberhold: ${g.name}` });
  }
  citySigns.push({ x: 111, y: 36, text: "Emberhold", big: true });

  // ---- Roads, from the gates out into the valley ----
  c.road(6, 73, X0 - 1, 73, ",", 2);           // the Westroad, out of the West Gate
  c.road(X1 + 1, 73, 207, 73, ",", 2);         // the coast road, out of the Saltmere Gate, past the farm
  c.road(97, 14, 97, Y0 - 1, ",", 2);          // the quarry road, out of the North Gate
  c.road(101, Y1 + 1, 101, 150, ",", 2);       // the south road, out of the River Gate to Kael's gate
  // Hill roads to the old mine and the spider cave.
  c.road(52, 12, 88, 31, ",", 1);
  c.road(88, 31, 97, 31, ",", 1);
  c.road(88, 14, 112, 14, ",", 1);
  c.road(112, 10, 112, 14, ",", 1);
  // A track round the outside of the walls, so you can walk from gate to gate.
  c.road(X0 - 3, Y0 - 3, X1 + 3, Y0 - 3, ",", 1, ".TOBMY*wl");
  c.road(X0 - 3, Y0 - 3, X0 - 3, Y1 + 3, ",", 1, ".TOBMY*wl");
  c.road(X1 + 3, Y0 - 3, X1 + 3, Y1 + 3, ",", 1, ".TOBMY*wl");
  c.road(X0 - 3, Y1 + 3, X1 + 3, Y1 + 3, ",", 1, ".TOBMY*wl");
  // Forest paths: west to the goblin camp, east to the spiders and graveyard, south-west to Wolf Hollow.
  c.road(50, 118, 101, 118, ",", 1);
  c.road(102, 124, 186, 124, ",", 1);
  // Bridges where roads cross water.
  for (let y = 0; y < OVER_H; y++) for (let x = 0; x < OVER_W; x++) if (c.get(x, y) === "~") {
    if ((y === 73 || y === 74) && x > X1 && x < 206) c.set(x, y, "=");
    if ((y === Y0 - 3 || y === Y1 + 3) && x > X0 && x < X1 + 4) c.set(x, y, "=");
    if (y === 124 && x > 150 && x < 180) c.set(x, y, "=");
  }
  // Causeways out to the islands: from the beach, across the water, to the next land.
  const causeway = (y: number, x: number) => {
    while (c.get(x, y) !== "~") x++;
    while (c.get(x, y) === "~" || /\d/.test(c.get(x, y))) c.set(x++, y, "=");
  };
  causeway(46, 200); causeway(88, 200);
  c.fill(226, 52, 227, 61, "=", "~"); causeway(61, 226);

  // ---- The pasture, out west by the valley's edge: cows and boars, and the grey dust creeping up to its fence ----
  c.fill(22, 80, 52, 98, "|", ".,wTOBMY*");
  c.fill(23, 81, 51, 97, ".");
  c.fill(37, 80, 38, 80, "."); c.fill(52, 88, 52, 89, "."); // gaps in the fence
  c.road(38, 75, 38, 80, ",", 1);
  spawnIn(c, "cow", 6, 26, 82, 50, 96, r);
  spawnIn(c, "boar", 3, 26, 82, 50, 96, r);

  // ---- The valley's edge: grey dust, where the shrines' warmth no longer reaches ----
  // The Withering creeps in from the rim of the valley toward the shrines, a little closer every year (see the wiki's
  // "The shrines" and "The Withering"). Thickest out west, where it began, and in the north-east foothills.
  for (let i = 0; i < 16; i++) c.blob(10 + r() * 14, 40 + r() * 60, 4 + r() * 5, 3 + r() * 4, "w", r, 0.3, ".TOBMY*");
  for (let i = 0; i < 6; i++) c.blob(16 + r() * 10, 82 + r() * 16, 3 + r() * 4, 3 + r() * 3, "w", r, 0.3, ".TOBMY*");
  for (let i = 0; i < 10; i++) c.blob(140 + r() * 60, 10 + r() * 14, 4 + r() * 5, 2 + r() * 3, "w", r, 0.3, ".TBMYl*");
  for (let i = 0; i < 6; i++) c.blob(16 + r() * 50, 9 + r() * 10, 4 + r() * 5, 2 + r() * 3, "w", r, 0.3, ".TBYl*");

  // ---- Meadows round the city ----
  c.scatter(52, 30, 180, 104, "T", 0.02, r);
  c.scatter(52, 30, 180, 104, "O", 0.016, r);
  c.place(52, 30, 180, 104, "*", 10, r);
  c.blob(60, 34, 6, 4, "O", r, 0.4, ".");   // an oak copse by the North Gate road (The Totem's oaks)
  c.blob(130, 34, 7, 3, "O", r, 0.4, ".");
  c.blob(78, 100, 9, 2, "O", r, 0.4, ".");
  // Yews along the lake's north shore, birches and oaks round the pasture.
  c.place(26, 34, 62, 40, "Y", 6, r);
  c.place(10, 76, 24, 100, "B", 14, r, ".w");
  c.place(54, 76, 64, 100, "O", 8, r);
  // Fishing in the lake: trout by the city, perch to the south, pike out west.
  const shoreSpots = (x0: number, y0: number, x1: number, y1: number, ch: string, n: number) => {
    for (let tries = 0; n > 0 && tries < 4000; tries++) {
      const x = x0 + Math.floor(r() * (x1 - x0 + 1)), y = y0 + Math.floor(r() * (y1 - y0 + 1));
      if (c.get(x, y) !== "~") continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ".,;sw:".includes(c.get(x + dx, y + dy)))) continue;
      c.set(x, y, ch);
      n--;
    }
  };
  shoreSpots(50, 44, 63, 67, "2", 5);
  shoreSpots(32, 60, 54, 68, "3", 4);
  shoreSpots(20, 42, 34, 66, "5", 4);
  // Slimes in the wet meadow south of the lake.
  spawnIn(c, "slime", 5, 40, 67, 62, 71, r);
  // Bats come out over the meadows at night (they only bite back here).
  spawnIn(c, "giant_bat", 2, 54, 30, 64, 70, r);
  spawnIn(c, "giant_bat", 2, 172, 76, 180, 100, r);

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
  c.scatter(14, 8, 200, 36, "T", 0.05, r, ".w");
  c.scatter(130, 8, 200, 36, "B", 0.05, r, ".w");
  c.scatter(14, 8, 70, 36, "B", 0.02, r, ".w");
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

  // ---- The valley's edge shrine (Act 1: A Flame at the Valley's Edge), in the north-east foothills ----
  // Shrine stones laid out in a ring, waiting for the flame, on the line where the green gives way to grey.
  c.blob(150, 23, 6, 4, ".", r, 0.2, "TOBMYlw*ik");
  c.road(130, 26, 146, 24, ",", 1, ".TOBMYlw*");
  c.road(112, 26, 130, 26, ",", 1, ".TOBMYlw*");
  c.road(97, 26, 112, 26, ",", 1, ".TOBMYlw*,");
  places.thornShrine = { x: 151, y: 22 };
  places.rhys = { x: 154, y: 23 };
  spawnIn(c, "wolf", 5, 140, 16, 162, 30, r, 0, 0, ".wl");

  // ---- The farm, east of the city, out of the Saltmere Gate ----
  c.fill(176, 42, 199, 100, ".", ".TOBM*s");
  c.fill(176, 41, 199, 41, "h"); c.fill(176, 101, 199, 101, "h");
  building(c, 177, 43, 7, 6, null); // Odo's farmhouse
  places.chest_east = { x: 203, y: 71 };
  for (const y of [44, 52, 60, 77, 85, 93]) {
    for (const x of [185, 193]) oldLots.push({ x, y });
  }
  // Odo's fields (the lots you rent are inside Emberhold: the Training Ground and the Lower Town allotments).
  for (const l of oldLots) c.fill(l.x, l.y, l.x + 5, l.y + 5, "f");

  // ---- The Saltmere Coast ----
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
  // Salmon in the river, north and south of the city.
  shoreSpots(158, 4, 168, 36, "4", 5);
  shoreSpots(158, 100, 168, 102, "4", 2);

  // ---- The Westroad shrine (smashed), and the barricade on the Barrens road ----
  places.westShrine = { x: 16, y: 70 };
  c.fill(13, 67, 19, 71, ",", ".w");
  c.fill(4, 72, 10, 75, ",", "^.w");
  c.fill(4, 72, 4, 75, "x");
  c.set(6, 71, "!");
  // Ashbound scouts smashing the shrine (Act 1: Ash on the Road).
  spawnIn(c, "ashbound_scout", 4, 8, 64, 24, 71, r, 0, 0, ".,w");
  // Kael's gate into the Thornwood, just outside the River Gate.
  c.fill(3, FENCE_Y, OVER_W - 1, FENCE_Y, "|", ".,:wsTOBMY*");
  c.fill(GATE.x, FENCE_Y, GATE.x + 1, FENCE_Y, "+");
  c.set(GATE.x - 2, FENCE_Y - 1, "!");
  c.set(GATE.x + 3, FENCE_Y - 1, "!");

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
  c.road(101, HV_WALL.Y1 + 1, 101, 150, ",", 2);
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
  // The Blighted pack (Act 1: The Hollow Wolves) prowls the grey dust out west, raiding the pasture.
  spawnIn(c, "hollow_wolf", 5, 8, 78, 24, 100, r, 0, 0, ".w");

  c.fill(GATE.x, FENCE_Y, GATE.x + 1, FENCE_Y, "+");
  // ---- The story's lanterns and places (shared/story.ts) ----
  // Shrine lanterns round Heartvale (Lantern Rounds): the quarry road, the lake, the inn (inside the city, set in
  // buildEmberhold), the farm, the coast and Kael's gate.
  ([[95, 34], [63, 60], null, [178, 76], [203, 66], [97, 101]] as const).forEach((p, i) => { if (p) places[`round_${i + 1}`] = nearFree(c, p[0], p[1]); });
  // Places to walk to: Odo's fields (Blessing the Fields), Holt's dead trees (What Holt Saw: three near shrines, three
  // out at the valley's edge; the Emberhall garden one is in the city), the valley's edge shrine.
  const spots: Record<string, [number, number]> = {
    fieldNorth: [187, 49], fieldMid: [195, 58], fieldSouth: [187, 82],
    nearWestShrine: [20, 66], nearGate: [108, 100],
    farLake: [12, 92], farPeaks: [170, 18], farCoast: [198, 30],
    thornEdge: [147, 24],
  };
  for (const [k, [x, y]] of Object.entries(spots)) storySpots[`spot.${k}`] = nearFree(c, x, y);
  // ---- Little paths: from each front door straight out to the nearest road (report #28) ----
  for (const d of pendingDoors) {
    const dx = d.out.x - d.x, dy = d.out.y - d.y;
    const trail: Point[] = [];
    let x = d.out.x, y = d.out.y;
    for (let i = 0; i < 14; i++, x += dx, y += dy) {
      const ch = c.get(x, y);
      if (ch === "," || ch === ";" || ch === "=") { for (const p of trail) c.set(p.x, p.y, ","); break; }
      if (ch !== ".") break; // only across open grass
      trail.push({ x, y });
    }
  }
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

// ---------------------------------------------------------------- Emberhold, the walled capital (version 0.20)
//
// Emberhold is its own outdoor area, below the inside places on the grid. A ring
// of stone walls with towers, and four gates (all shut for now). Inside:
//   Ember Hill (north): the Emberhall, and the Emberhall Training Ground beside it,
//     where every trainer teaches.
//   Market Square (middle): the warm well, stalls, the bounty board, the General Store, the bell tower.
//   Forge Row (west): smiths and workshops.   The Docks (east): wharves along the Glass River.
//   Lower Town (south): crowded homes, the Hearthstone Inn, the Mages' Guild, the allotments.
// Most buildings are scenery ("backdrop"): you can see them but not go in. The
// 3D game draws them from CITY_BUILDINGS (a kit: walls, a roof, chimneys, windows).

export const CITY_W = 150;
export const CITY_H = 112;
export type District = "hill" | "forge" | "market" | "docks" | "lower";
/** One building in Emberhold, for the 3D game (the tiles under it are roof, so you can't walk there). */
export interface CityBuilding {
  x: number; y: number; w: number; h: number;
  district: District;
  /** Storeys (the backdrop kit stacks them). */
  floors: number;
  wall: "stone" | "timber" | "plank" | "marble" | "guild";
  roof: "slate" | "red" | "dark" | "thatch" | "gold";
  /** Drawn in full detail (doors, lanterns): the ones you can go into, and the Emberhall. */
  detail: boolean;
  landmark?: "emberhall" | "belltower";
  chimney: boolean;
  seed: number;
}
const cityBuildings: CityBuilding[] = [];
/** Emberhold's four gates, as built (world tiles of each archway). */
const cityGates: { name: string; tiles: Point[] }[] = [];
/** The middles of the towers on the city wall. */
const cityTowers: Point[] = [];
/** Floating name signs: the gates and the districts. */
const citySigns: { x: number; y: number; text: string; big?: boolean }[] = [];
/** Which lots are where, for "your plot is in ..." (by lot number). */
const lotPlaces: string[] = [];

function districtOf(x: number, y: number, riverX: number): District {
  if (x >= riverX - 10) return "docks";
  if (y < 41) return "hill";
  if (y >= 67) return "lower";
  if (x < 58) return "forge";
  return "market";
}

function buildEmberhold(o: Point): Canvas {
  const r = rng(20261126);
  const c = new Canvas(CITY_W, CITY_H, ".");
  const A = (x: number, y: number): Point => ({ x: o.x + x, y: o.y + y });
  const UNSET = "?";

  // ---- The wall: a rounded ring (a "superellipse"), towers at the corners ----
  const cx = 74, cy = 57, rx = 63, ry = 47, N = 20, P = 3.5;
  const poly: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const co = Math.cos(a), si = Math.sin(a);
    const k = 1 + (r() - 0.5) * 0.05;
    poly.push([cx + rx * k * Math.sign(co) * Math.abs(co) ** (2 / P), cy + ry * k * Math.sign(si) * Math.abs(si) ** (2 / P)]);
  }
  const inside = (x: number, y: number) => {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  const wallDist = (x: number, y: number) => {
    let m = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
      const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l));
      m = Math.min(m, Math.hypot(ax + t * dx - x, ay + t * dy - y));
    }
    return m;
  };
  const interior = (x: number, y: number) => c.get(x, y) !== "%" && c.get(x, y) !== "&" && inside(x + 0.5, y + 0.5);
  for (let y = 0; y < CITY_H; y++) for (let x = 0; x < CITY_W; x++) {
    const d = wallDist(x + 0.5, y + 0.5);
    if (d < 1.05) c.set(x, y, "%");
    else if (inside(x + 0.5, y + 0.5)) c.set(x, y, d < 3.6 ? ";" : UNSET); // a lane runs round the inside of the wall
  }
  for (const [px, py] of poly) {
    const tx = Math.round(px - 0.5), ty = Math.round(py - 0.5);
    c.fill(tx - 1, ty - 1, tx + 1, ty + 1, "&");
    cityTowers.push(A(tx, ty));
  }

  // ---- Outside the walls: meadows, a few trees, the roads (you can't get out yet) ----
  c.scatter(0, 0, CITY_W - 1, CITY_H - 1, "O", 0.012, r, ".");
  c.scatter(0, 0, CITY_W - 1, CITY_H - 1, "T", 0.01, r, ".");

  // ---- The Glass River, through the east of the city ----
  const riverAt = (y: number) => 116 + Math.round(Math.sin(y / 9));
  for (let y = 0; y < CITY_H; y++) {
    const x = riverAt(y);
    for (let k = 0; k < 4; k++) if (c.get(x + k, y) !== "&") c.set(x + k, y, c.get(x + k, y) === "%" ? "%" : "~");
  }

  // ---- Streets, squares and the four gates ----
  const gates: { name: string; tiles: Point[] }[] = [];
  /** Pave a street. Where it crosses the wall it becomes a gate; outside, a dirt road; over the river, a bridge. */
  const street = (x0: number, y0: number, x1: number, y1: number, gate?: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ch = c.get(x, y);
      if (ch === " ") continue;
      if (ch === "%" || ch === "&") {
        if (!gate) continue;
        c.set(x, y, "}"); // an open archway (version 0.20: the gates lead out into Heartvale)
        let g = gates.find((q) => q.name === gate);
        if (!g) gates.push(g = { name: gate, tiles: [] });
        g.tiles.push({ x, y });
      } else if (ch === "~" || ch === "=") c.set(x, y, "=");
      else if (inside(x + 0.5, y + 0.5)) c.set(x, y, ";");
      else c.set(x, y, ",");
    }
  };
  street(45, 0, 47, 34, "North Gate");          // north street: the North Gate (to Frostfell) down to the Emberhall plaza
  street(0, 56, 58, 58, "West Gate");           // the West street through Forge Row (to Cinderfall Pass)
  street(90, 56, CITY_W - 1, 58, "Saltmere Gate"); // east, over the river bridge (to Saltmere and the Thornwood)
  street(71, 67, 75, CITY_H - 1, "River Gate");  // south through Lower Town (to the Tangle and Blackfen)
  street(46, 34, 85, 39);   // the Emberhall plaza
  street(70, 40, 72, 49);   // the hill road down to the square
  street(58, 49, 90, 66);   // Market Square
  street(20, 77, 107, 79);  // Lower Town's long street
  street(30, 14, 31, 55);   // lanes: Ember Hill down to Forge Row
  street(14, 44, 58, 45);   // Forge Row's back lane
  street(32, 24, 44, 25);   // the hill lane
  street(108, 14, 111, 104); // the dock street
  street(56, 67, 57, 104);  // Lower Town's west lane
  street(92, 59, 93, 77);   // the lane from the square to the docks
  street(76, 68, 107, 69);  // the lane behind the square
  street(20, 92, 55, 93);   // the Guild lane
  street(121, 46, 129, 68); // the fish market, over the river
  // The wharf: boards along the river's west bank.
  for (let y = 14; y < 104; y++) for (let x = 112; x < riverAt(y); x++) if (interior(x, y)) c.set(x, y, "p");
  // Fish in the river: trout by the wharf, salmon further out.
  const riverSpot = (ch: string, n: number) => {
    for (let tries = 0; n > 0 && tries < 4000; tries++) {
      const y = 20 + Math.floor(r() * 80), x = riverAt(y) + (ch === "2" ? 0 : 3);
      if (c.get(x, y) !== "~" || !interior(x, y)) continue;
      c.set(x, y, ch);
      n--;
    }
  };
  riverSpot("2", 6);
  riverSpot("4", 5);

  // ---- The Emberhall, on Ember Hill ----
  const pushDoor = (d: { x: number; y: number; out: Point } | null, area: string, label: string, sign: string) => {
    if (!d) return;
    pendingDoors.push({ x: o.x + d.x, y: o.y + d.y, out: A(d.out.x, d.out.y), area, label, sign, from: "emberhold" });
  };
  const detail = (x: number, y: number, w: number, h: number, wall: CityBuilding["wall"], roof: CityBuilding["roof"], extra: Partial<CityBuilding> = {}) =>
    cityBuildings.push({ ...A(x, y), w, h, district: districtOf(x, y, 116), floors: 1, wall, roof, detail: true, chimney: false, seed: x * 31 + y, ...extra });
  c.fill(56, 11, 86, 33, ".", UNSET + ";"); // the Emberhall's garden all round it
  const lh = building(c, 62, 15, 19, 17, { side: "s", at: 9 }, { roof: "u", wall: "A" });
  c.fill(62, 31, 80, 31, "A");
  c.set(lh!.x, lh!.y, "D");
  c.fill(66, 32, 76, 33, "a"); // the white steps
  detail(62, 15, 19, 17, "marble", "gold", { landmark: "emberhall" });
  pushDoor(lh, "lighthall", "Enter the Emberhall", "✨ The Emberhall");
  // The Extinguished: four statues in the garden, one at each corner (their plaques are in shared/npcs.ts).
  ([[58, 14], [84, 14], [58, 30], [84, 30]] as const).forEach(([x, y], i) => { c.set(x, y, "S"); places[`extinguished_${i + 1}`] = A(x, y); });
  c.fill(57, 12, 57, 32, "h"); c.fill(85, 12, 85, 32, "h");
  places.lighthallSteps = A(71, 34);
  storySpots["spot.nearLighthall"] = A(59, 21); // What Holt Saw: the trees in the Emberhall's garden

  // ---- The Emberhall Training Ground: every trainer, and everything they teach with ----
  const TX0 = 86, TY0 = 16, TX1 = 107, TY1 = 54;
  c.fill(TX0, TY0, TX1, TY1, "h");
  c.fill(TX0 + 1, TY0 + 1, TX1 - 1, TY1 - 1, ".");
  c.fill(TX0, 35, TX0, 38, ";"); // the way in from the Emberhall plaza
  c.fill(96, TY1, 98, 55, ";");  // and from the east street
  c.fill(87, 36, 106, 37, ","); c.fill(96, 17, 96, 53, ","); // sandy paths across it
  // The practice grove (Forester Holt): pines and two oaks.
  for (const [x, y] of [[88, 18], [90, 19], [92, 18], [94, 19], [89, 21], [91, 22], [93, 21], [95, 22]] as const) c.set(x, y, "T");
  c.set(88, 23, "O"); c.set(94, 24, "O");
  // The pond (Old Maren): minnows anywhere at the edge, a few trout spots.
  c.fill(99, 19, 105, 23, "~");
  for (const [x, y] of [[99, 19], [105, 19], [99, 23], [105, 23]] as const) c.set(x, y, ".");
  c.set(99, 21, "2"); c.set(105, 22, "2");
  // The rocks (Miner Greta): copper and tin, one iron and one coal.
  for (const x of [88, 90, 92]) { c.set(x, 27, "c"); c.set(x, 29, "t"); }
  c.set(94, 27, "i"); c.set(94, 29, "k");
  c.fill(87, 26, 95, 30, "l", ".");
  // Dig patches (Herbalist Wren).
  for (const [x, y] of [[100, 28], [103, 27], [106, 28], [101, 31]] as const) c.set(x, y, "*");
  // Pens (Huntmaster Kael): the chicken coop and the rat pit.
  c.fill(87, 39, 94, 45, "|"); c.fill(88, 40, 93, 44, "."); c.set(94, 42, ".");
  c.fill(87, 47, 94, 53, "|"); c.fill(88, 48, 93, 52, "l"); c.set(94, 50, "l");
  pickSpawn(c, "chicken", 5, 88, 40, 93, 44, r, ".", o.x, o.y);
  pickSpawn(c, "rat", 4, 88, 48, 93, 52, r, "l", o.x, o.y);
  // Farmer Odo's four training-ground lots.
  for (const [x, y] of [[99, 40], [99, 47]] as const) { lots.push(A(x, y)); lotPlaces.push("in the Emberhall Training Ground"); c.fill(x, y, x + 5, y + 5, "f"); }
  const tg: Record<string, [number, number]> = {
    maren: [100, 25], stove: [102, 25], holt: [97, 20], greta: [95, 28],
    furnace: [88, 33], anvil: [91, 33], brann: [89, 35],
    workbench: [98, 33], spinning_wheel: [100, 33], tanning_rack: [102, 33], rook: [99, 35],
    alchemy_table: [104, 33], moss: [104, 35], altar: [106, 33], archmage: [106, 35],
    wren: [104, 30], kael: [97, 45], odo: [97, 40], chest_farm: [97, 48],
  };
  for (const [k, [x, y]] of Object.entries(tg)) places[`tg.${k}`] = A(x, y);
  places.tanning_rack = A(...tg.tanning_rack);
  places.odo = A(...tg.odo);
  places.chest_farm = A(...tg.chest_farm);
  citySigns.push({ ...A(99, 15), text: "⚔️ Emberhall Training Ground" });

  // ---- Market Square ----
  const tam = building(c, 60, 42, 9, 7, { side: "s", at: 4 });
  detail(60, 42, 9, 7, "timber", "red", { floors: 1 });
  pushDoor(tam, "tam", "Enter the General Store", "💰 General Store");
  c.fill(80, 44, 83, 47, "r"); // the bell tower
  cityBuildings.push({ ...A(80, 44), w: 4, h: 4, district: "market", floors: 5, wall: "stone", roof: "slate", detail: false, landmark: "belltower", chimney: false, seed: 7 });
  c.set(74, 58, "q"); // the warm well
  places.board = A(86, 51);
  places.bryn = A(88, 51);
  for (const [x, y] of [[61, 52], [64, 52], [67, 52], [80, 63], [83, 63], [86, 63], [61, 62], [64, 62], [123, 50], [123, 54], [123, 60], [127, 50], [127, 56]] as const) c.set(x, y, "(");
  // The story's lanterns (Light the Way): on the Emberhall's steps and round the plaza.
  ([[65, 33], [77, 33], [52, 36], [82, 36], [60, 39], [84, 39]] as const).forEach(([x, y], i) => { places[`lantern_${i + 1}`] = A(x, y); });

  // ---- Forge Row (west) ----
  const holt = building(c, 16, 47, 7, 9, { side: "s", at: 3 });
  detail(16, 47, 7, 9, "plank", "dark");
  pushDoor(holt, "holt", "Enter Forester Holt's house", "🪓 Forester Holt's house");
  const greta = building(c, 24, 47, 6, 9, { side: "s", at: 3 });
  detail(24, 47, 6, 9, "stone", "dark");
  pushDoor(greta, "greta", "Enter Miner Greta's house", "⛏️ Miner Greta's house");
  const brann = building(c, 35, 47, 10, 9, { side: "s", at: 4 });
  detail(35, 47, 10, 9, "stone", "dark", { chimney: true });
  pushDoor(brann, "smithy", "Enter Smith Brann's smithy", "🔨 Brann's smithy");
  const rook = building(c, 44, 59, 9, 7, { side: "n", at: 4 });
  detail(44, 59, 9, 7, "timber", "dark");
  pushDoor(rook, "rook", "Enter Woodworker Rook's workshop", "🪚 Rook's workshop");

  // ---- The Docks (east) ----
  const maren = building(c, 101, 61, 6, 5, { side: "e", at: 2 });
  detail(101, 61, 6, 5, "plank", "red");
  pushDoor(maren, "maren", "Enter Old Maren's cottage", "🎣 Old Maren's cottage");

  // ---- Lower Town (south) ----
  const inn = building(c, 62, 68, 9, 9, { side: "e", at: 4 });
  detail(62, 68, 9, 9, "timber", "red", { chimney: true });
  pushDoor(inn, "inn", "Enter the Hearthstone Inn", "🍺 Hearthstone Inn");
  places.round_3 = A(72, 70); // Lantern Rounds: the shrine lantern by the inn (where someone paints THE FLAME EATS)
  const kael = building(c, 62, 90, 8, 8, { side: "e", at: 3 });
  detail(62, 90, 8, 8, "plank", "thatch");
  pushDoor(kael, "kael", "Enter Huntmaster Kael's lodge", "🏹 Kael's lodge");
  const wren = building(c, 46, 81, 7, 6, { side: "n", at: 3 });
  detail(46, 81, 7, 6, "plank", "thatch");
  pushDoor(wren, "wren", "Enter Herbalist Wren's hut", "🌱 Wren's hut");
  const guild = building(c, 26, 80, 17, 11, { side: "n", at: 8 }, { roof: "r", wall: "W" });
  for (let x = 26; x <= 42; x++) c.set(x, 80, x === 34 ? "D" : "W");
  detail(26, 80, 17, 11, "guild", "slate");
  pushDoor(guild, "guild", "Enter the Mages' Guild", "🔮 Mages' Guild");
  // The allotments: eight more lots for Farmer Odo's farmers.
  c.fill(78, 81, 106, 96, "h");
  c.fill(79, 82, 105, 95, ",");
  c.fill(91, 80, 92, 81, ","); // the gate in the hedge
  for (const y of [82, 89]) for (const x of [79, 86, 93, 100]) { lots.push(A(x, y)); lotPlaces.push("in the Lower Town allotments"); c.fill(x, y, x + 5, y + 5, "f"); }

  // ---- Lamps along the streets ----
  const lampAt = (x: number, y: number) => { if (";,".includes(c.get(x, y))) c.set(x, y, ")"); };
  for (let y = 14; y < 34; y += 7) lampAt(45, y);
  for (const x of [16, 24, 32, 40, 56]) lampAt(x, 58);
  for (const x of [100, 106]) lampAt(x, 58);
  for (const y of [71, 85, 99]) lampAt(75, y);
  for (let x = 24; x < 106; x += 9) lampAt(x, 77);
  for (let y = 18; y < 104; y += 8) if (y !== 58) lampAt(108, y);
  for (const [x, y] of [[58, 49], [90, 49], [58, 66], [90, 66], [46, 34], [69, 40], [73, 40], [121, 46], [129, 68], [129, 46]] as const) lampAt(x, y);
  // The Emberguard's banners and a few barrels on the docks.
  for (const [x, y] of [[113, 30], [113, 44], [113, 70], [113, 86], [107, 66]] as const) if (c.get(x, y) === "p" || c.get(x, y) === ";") c.set(x, y, "e");

  // ---- Every other building: the backdrop, packed between the streets ----
  const fits = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (c.get(xx, yy) !== UNSET) return false;
    return true;
  };
  for (let y = 0; y < CITY_H; y++) for (let x = 0; x < CITY_W; x++) {
    if (c.get(x, y) !== UNSET) continue;
    const d = districtOf(x, y, 116);
    const sizes: [number, number][] = d === "lower" ? [[5, 4], [4, 4], [6, 5], [4, 3], [3, 3]] : [[6, 5], [7, 5], [5, 5], [5, 4], [4, 4], [4, 3], [3, 3]];
    if (r() < 0.5) sizes.unshift(sizes.splice(1, 1)[0]);
    const s = sizes.find(([w, h]) => fits(x, y, w, h));
    if (!s) continue;
    const [w, h] = s;
    c.fill(x, y, x + w - 1, y + h - 1, "r");
    const floors = d === "hill" ? 2 + (r() < 0.15 ? 1 : 0) : d === "market" ? 2 : d === "lower" ? (r() < 0.3 ? 2 : 1) : r() < 0.5 ? 2 : 1;
    const wall: CityBuilding["wall"] = d === "lower" ? (r() < 0.5 ? "timber" : "plank") : d === "docks" ? (r() < 0.5 ? "plank" : "stone") : d === "market" && r() < 0.4 ? "timber" : "stone";
    const roof: CityBuilding["roof"] = d === "hill" ? "slate" : d === "forge" ? "dark" : d === "lower" ? "thatch" : d === "docks" ? (r() < 0.5 ? "dark" : "red") : "red";
    cityBuildings.push({ ...A(x, y), w, h, district: d, floors, wall, roof, detail: false, chimney: r() < (d === "forge" ? 0.8 : 0.4), seed: Math.floor(r() * 1e6) });
    // Now and then a narrow alley after a building, so the blocks aren't one solid wall.
    if (r() < 0.22) for (let yy = y; yy < y + h; yy++) if (c.get(x + w, yy) === UNSET) c.set(x + w, yy, ";");
  }
  for (let y = 0; y < CITY_H; y++) for (let x = 0; x < CITY_W; x++) if (c.get(x, y) === UNSET) c.set(x, y, ";");

  // ---- Signs over the gates (all shut for now) and the districts ----
  for (const g of gates) {
    const mx = g.tiles.reduce((s, p) => s + p.x, 0) / g.tiles.length, my = g.tiles.reduce((s, p) => s + p.y, 0) / g.tiles.length;
    citySigns.push({ x: o.x + Math.round(mx), y: o.y + Math.round(my), text: `🚪 ${g.name}` });
    cityGates.push({ name: g.name, tiles: g.tiles.map((t) => A(t.x, t.y)) });
  }
  for (const [x, y, text] of [[71, 12, "Ember Hill"], [74, 54, "Market Square"], [36, 61, "Forge Row"], [113, 38, "The Docks"], [64, 81, "Lower Town"], [125, 47, "Fish market"]] as const) {
    citySigns.push({ ...A(x, y), text, big: true });
  }

  // ---- Little paths from each front door to the street, and nobody standing in a wall ----
  for (const d of pendingDoors) {
    if (d.from !== "emberhold") continue;
    const lx = d.out.x - o.x, ly = d.out.y - o.y;
    const dx = lx - (d.x - o.x), dy = ly - (d.y - o.y);
    const trail: Point[] = [];
    let x = lx, y = ly;
    for (let i = 0; i < 10; i++, x += dx, y += dy) {
      const ch = c.get(x, y);
      if (";,=pa".includes(ch)) { for (const p of trail) c.set(p.x, p.y, ";"); break; }
      if (ch !== ".") break;
      trail.push({ x, y });
    }
    if (!";,=pa.".includes(c.get(lx, ly))) c.set(lx, ly, ";");
  }
  for (const [k, p] of Object.entries(places)) {
    const lx = p.x - o.x, ly = p.y - o.y;
    if (!c.in(lx, ly) || k.includes(".") && !k.startsWith("tg.")) continue;
    if (!".,;:asw*=lfp".includes(c.get(lx, ly))) c.set(lx, ly, ";");
  }
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

  // ---- The Emberhall: the Emberguard's temple, built around the Heart Shrine ----
  // Three parts (version 0.14): the great hall in the middle (the Heart Shrine's
  // flame at the top, braziers, and the statues of the Ember Circle along both
  // walls), the library and the stores to the west, and the infirmary to the
  // east, with a bedroom for each patient. Real doors ("d") join the rooms.
  {
    const c = new Canvas(37, 27).room("A", "a");
    // ---- West: the library (north) and, behind an iron grille, the restricted section (south: the old stores and ledger
    // room, version 0.21). Its door off the great hall is barred; only the Keepers go in.
    c.fill(10, 1, 10, 25, "A");
    c.fill(1, 14, 9, 14, "A");
    c.fill(3, 14, 7, 14, "]"); // the iron grille: you can see in, but not get in
    c.set(10, 7, "d"); // library door
    c.set(10, 20, "J"); // the restricted section's barred door
    // The library: shelves along the north wall, then rows of shelves (books on both sides), and a reading table.
    c.fill(1, 1, 9, 1, "b");
    c.fill(2, 4, 4, 4, "b"); c.fill(6, 4, 8, 4, "b");
    c.fill(2, 7, 4, 7, "b");
    c.fill(2, 10, 4, 10, "b"); c.fill(6, 10, 8, 10, "b");
    c.fill(6, 12, 7, 12, "n");
    // The restricted section: tall shelves, and glass cases (tables) chained shut.
    c.fill(2, 17, 8, 17, "b");
    c.fill(2, 20, 4, 20, "b"); c.fill(6, 20, 8, 20, "b");
    c.set(3, 23, "n"); c.set(5, 23, "n"); c.set(7, 23, "n");
    c.fill(1, 25, 9, 25, "b");
    // ---- East: the infirmary. A hall (Keeper Wynne's) with four bedrooms off it, one bed each.
    c.fill(26, 1, 26, 25, "A");
    c.set(26, 13, "d"); // infirmary door
    c.fill(29, 1, 29, 25, "A");
    for (const y of [7, 13, 19]) c.fill(30, y, 35, y, "A");
    for (const [top, door] of [[1, 4], [8, 10], [14, 16], [20, 22]] as const) {
      c.set(29, door, "d");
      c.set(35, top + 1, "y"); // the bed, head against the east wall
      c.set(35, top + 3, "n"); // a bedside table
    }
    c.fill(27, 1, 28, 1, "e"); // linen and bandages
    c.fill(27, 25, 28, 25, "b"); // remedies
    // ---- The great hall: the Heart Shrine's flame, braziers, pillars, and a gold carpet from the door.
    c.fill(16, 3, 20, 7, "o");
    for (const [x, y] of [[14, 4], [22, 4], [14, 23], [22, 23]] as const) c.set(x, y, "F"); // braziers
    for (const [x, y] of [[13, 12], [23, 12], [13, 19], [23, 19]] as const) c.set(x, y, "A"); // pillars
    // The Ember Circle: statues along both walls (Keeper Oren's tour), and Wick's empty plinth.
    // The Ember Circle (Mike's note, version 0.20): Vale behind the Heart Shrine, King Aldemar and the six who raised the other
    // great shrines along the walls, and Wick's empty plinth by the doors. "S" keeps the tile solid; the client draws each statue.
    for (const [x, y] of [[18, 1], [11, 4], [11, 10], [11, 15], [11, 23], [25, 4], [25, 10], [25, 16]] as const) c.set(x, y, "S");
    c.fill(17, 8, 19, 25, "z");
    const door = { x: 18, y: 26 };
    c.set(door.x, door.y, "D");
    list.push({
      id: "lighthall", name: "The Emberhall", kind: "indoor", canvas: c, doors: [door],
      spots: {
        heartShrine: { x: 18, y: 5 }, wake: { x: 18, y: 8 }, aldric: { x: 21, y: 9 }, celene: { x: 15, y: 9 },
        oren: { x: 13, y: 14 }, plinth: { x: 25, y: 21 },
        lisette: { x: 7, y: 8 }, tomas: { x: 13, y: 21 }, vale: { x: 23, y: 7 },
        // Keeper Lisette's Four Books (version 0.21): four lecterns along the library's east wall, read in order.
        book_1: { x: 9, y: 3 }, book_2: { x: 9, y: 5 }, book_3: { x: 9, y: 9 }, book_4: { x: 9, y: 11 },
        // In front of the grille, where Keeper Lisette stops you.
        grille: { x: 5, y: 13 },
        wynne: { x: 28, y: 10 },
        // Keeper Celene's walking lesson: two glowing marks down the hall.
        walkLeft: { x: 13, y: 18 }, walkRight: { x: 23, y: 18 },
        // Her running lesson (version 0.21): a mark down by the great doors.
        runMark: { x: 15, y: 24 },
        // The statues of the Ember Circle (Keeper Oren's tour).
        circle_vale: { x: 18, y: 1 }, circle_aldemar: { x: 11, y: 4 }, circle_crowe: { x: 11, y: 10 }, circle_flint: { x: 11, y: 15 },
        circle_ivy: { x: 11, y: 23 }, circle_merrow: { x: 25, y: 4 }, circle_dunn: { x: 25, y: 10 }, circle_reed: { x: 25, y: 16 },
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
  // Emberhold, the walled capital, below the inside places (so nothing above it moved).
  const cityAt = { x: GAP, y: y + rowH + GAP };
  const city = buildEmberhold(cityAt);
  areas.push({ id: "emberhold", name: "Emberhold", x: cityAt.x, y: cityAt.y, w: CITY_W, h: CITY_H, kind: "outdoor" });
  const H = cityAt.y + CITY_H + GAP;
  const grid = new Canvas(OVER_W, H, " ");
  over.g.forEach((row, yy) => row.forEach((ch, xx) => grid.set(xx, yy, ch)));
  city.g.forEach((row, yy) => row.forEach((ch, xx) => grid.set(cityAt.x + xx, cityAt.y + yy, ch)));
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
    doors.push({ x: inner.x, y: inner.y, to: p.out, area: p.from ?? "heartvale", label: "Leave" });
  }
  // Emberhold's gates (version 0.20): step into a gate's archway out in Heartvale and you're just inside that gate in
  // the city; walk out through a gate in the city and you're just outside it in the valley.
  for (const hv of HV_GATES) {
    const cg = cityGates.find((g) => g.name === hv.name);
    if (!cg) throw new Error(`Emberhold has no ${hv.name}`);
    const dx = hv.out.x, dy = hv.out.y;
    // The city gate's archway: its outer row (furthest out) and inner row.
    const key = (p: Point) => p.x * dx + p.y * dy;
    const outer = Math.max(...cg.tiles.map(key)), inner = Math.min(...cg.tiles.map(key));
    const cityOuter = cg.tiles.filter((p) => key(p) === outer), cityInner = cg.tiles.filter((p) => key(p) === inner);
    const hvOuter = hv.tiles.filter((p) => key(p) === Math.max(...hv.tiles.map(key)));
    const across = (list: Point[]) => [...list].sort((a, b) => (a.x - b.x) * (dy !== 0 ? 1 : 0) + (a.y - b.y) * (dx !== 0 ? 1 : 0));
    const co = across(cityOuter), ci = across(cityInner), ho = across(hvOuter);
    const n = Math.min(co.length, ho.length);
    for (let i = 0; i < n; i++) {
      // From the valley: the archway's outer tile takes you just inside the city gate.
      const inside = { x: ci[Math.min(i, ci.length - 1)].x - dx, y: ci[Math.min(i, ci.length - 1)].y - dy };
      doors.push({ x: ho[i].x, y: ho[i].y, to: inside, area: "emberhold", label: `Enter Emberhold by the ${hv.name}` });
      // From the city: the road just outside the city gate takes you just outside the gate in the valley.
      const road = { x: co[i].x + dx, y: co[i].y + dy };
      doors.push({ x: road.x, y: road.y, to: { x: ho[i].x + dx, y: ho[i].y + dy }, area: "heartvale", label: `Out of the ${hv.name} into Heartvale`, gate: true });
    }
  }
  // The spider cave goes on through to the crystal cave.
  const sc = inDoor("spider_cave", 1), cc = inDoor("crystal_cave");
  doors.push({ x: sc.x, y: sc.y, to: inward(cc), area: "crystal_cave", label: "Go deeper: the crystal cave" });
  doors.push({ x: cc.x, y: cc.y, to: inward(sc), area: "spider_cave", label: "Back to the spider cave" });
  places.wake = places["lighthall.wake"];
  places["spot.hallLeft"] = places["lighthall.walkLeft"];
  places["spot.hallRight"] = places["lighthall.walkRight"];
  places["spot.hallRun"] = places["lighthall.runMark"];
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
  { x: 42, y: 55, text: "The lake" },
  { x: 118, y: 66, text: "Emberhold", big: true },
  { x: 37, y: 89, text: "Pasture" },
  { x: 188, y: 69, text: "The farm" },
  { x: 151, y: 19, text: "Valley's edge shrine" },
  { x: 16, y: 64, text: "Westroad shrine" },
  { x: 14, y: 50, text: "The grey dust" },
  { x: 220, y: 30, text: "Saltmere Coast", big: true },
  { x: 24, y: 78, text: "To the Barrens (closed)" },
  { x: 100, y: 128, text: "The Thornwood (Dark Forest)", big: true },
  { x: 44, y: 128, text: "Goblin camp" },
  { x: 150, y: 129, text: "Spider hollow" },
  { x: 70, y: 147, text: "Wolf Hollow" },
  { x: 116, y: 153, text: "Ashbound camp" },
  { x: 187, y: 132, text: "Graveyard" },
];

/** The farm's lots (top-left tile of each 6 × 6 lot). Since version 0.20 they're all in Emberhold. */
export const WORLD_LOTS: readonly Point[] = lots;
/** Where each lot is ("in the Lower Town allotments"), by lot number. */
export const LOT_PLACES: readonly string[] = lotPlaces;
/** Emberhold's buildings, wall towers and signs, for the 3D game. */
export const CITY_BUILDINGS: readonly CityBuilding[] = cityBuildings;
export const CITY_TOWERS: readonly Point[] = cityTowers;
export const CITY_SIGNS: readonly { x: number; y: number; text: string; big?: boolean }[] = citySigns;
/** The outdoor area a place belongs to: itself if it's outdoors, else where its front door is. */
export function outdoorAreaOf(id: string): AreaDef | null {
  const a = areas.find((ar) => ar.id === id);
  if (!a) return null;
  if (a.kind === "outdoor") return a;
  const d = doors.find((dd) => dd.area === id && !(dd.x >= a.x && dd.x < a.x + a.w && dd.y >= a.y && dd.y < a.y + a.h));
  if (!d) return null;
  const from = areas.find((ar) => d.x >= ar.x && d.x < ar.x + ar.w && d.y >= ar.y && d.y < ar.y + ar.h);
  return from ? outdoorAreaOf(from.id) : null;
}
