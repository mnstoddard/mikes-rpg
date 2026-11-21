import { npcAt } from "./npcs";
import type { ResourceId } from "./foraging";
// The world map, shared by server (walkability, pathfinding) and client (drawing).
// Later this gets replaced by maps drawn in the Tiled editor.
//
// Legend:  . grass   , path   ~ water   = bridge
// Trees:   T pine  O oak  B birch  M maple  Y yew  I ironwood  E elderwood
// Rocks:   # stone  c copper  t tin  i iron  k coal  v silver  g gold  m mithril
// Fishing: any water next to land gives Minnows. Numbered water tiles are
//          special spots: 2 trout  3 perch  4 salmon  5 pike  6 tuna  7 swordfish  8 eel
// Easy types are near the middle; the best ones are on the east island, over the bridge.
// Danger:  : dark forest floor   | fence   + gate   ! warning sign
//          Everything from the fence row down is the Dark Forest (the danger zone),
//          where monsters attack on sight. The gate stays shut until Old Maren's combat lesson.
// Houses:  W wall   _ floor (the Mages' Guild hall, south-west of town; its door faces the road)
//          H wall   p floor (the wooden trainer buildings: Trainer Row north of the road,
//          Tam's General Store and Rook's workshop in the square, Kael's lodge by the gate,
//          Herbalist Wren's hut by the lake)
// Foraging: * a glinting dig patch (dig it with a shovel)
// Farm:    f a farm lot (shared/farming.ts LOTS): plots are bought from Farmer Odo. The farm is east of
//          the island, over the second bridge; Odo's farmhouse is the H block at its west end.
// Cave:    C cave floor   K cave wall (the spider cave east of the quarry counts as danger, like the forest)
//          G crystal cave floor (through the spider cave). Gem rocks: U amethyst  Q topaz  L soul stone
//          N emerald  Z sapphire  R ruby; deeper ores: P platinum  X iridium
const RAW = `
~~~~~~~~~~~~~~~~~~~~~~~~~~~KKKKKKKKKKKKKKKKKKKK~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~.........T.TT.iikk..KCCCCCKUGQGLGNGZGRPK~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~.......TT.T...T.##cc*#KCCCCCCGGGGGGGGGGGGK~~~~~~~~~~~~~................................~~
~~~....T....T....T...##tt.#KKKCKKKUGQKLGNKZGRXK~~~~~~~~~~~~~HHHHHHH.ffffff..ffffff..ffffff...~
~~.*.......,,,,,,,,,,,,,,,,,,,,,,,KKKKKKKKKKKKK~~~~~~~~~~~~~HpppppH.ffffff..ffffff..ffffff...~
~~..OO.....,.....................,.~~~~~~~~~~~~~77~~~~~~~~~~HpppppH.ffffff..ffffff..ffffff...~
~...OO...*.,HHHHHHH.HHHHHHH.HHHHH,.MM4~~~~~~~~......~~~~~~~~HpppppH.ffffff..ffffff..ffffff..T~
~..........,HpppppH.HpppppH.HpppH,.MM.4~~~~~...I..I...~~~~~~HHHpHHH.ffffff..ffffff..ffffff...~
~..........,HpppppH.HpppppH.HpppH,....~~~~~...I.....E..~~~~~...,....ffffff..ffffff..ffffff...~
~...~22~...,HHHpHHH.HHHpHHH.HHpHH,....~~~~~.......,..E..~~~~...,.............................~
~..5~~~~~..,.....................,..*.~~~~~.......,,,,,,,===,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,.~
~..5~~~~~==,,,,,,,,,,,,,,,,,,,,,,,,,,,====,,,,,,,,,..vv...8~.................................~
~..~~~~~~..,HHHpHHH.HHHpHHH......,....~~~~~.......,..vg...8~..ffffff..ffffff..ffffff..ffffff.~
~...~33~.*.,HpppppH.HpppppH......,....~~~~~.*gg...,.......~~..ffffff..ffffff..ffffff..ffffff.~
~..........,HpppppH.HpppppH......,.YY.~~~~~..mm...,...E..~~~..ffffff..ffffff..ffffff..ffffff.~
~...BB..*..,HHHHHHH.HHHHHHH......,.YY.~~~~~~......,.....~~~~T.ffffff..ffffff..ffffff..ffffff.~
~.*.BWWW_WWW,,,,,,,,,,,,,,,,,,,,,,..*.~~~~~~~~...mm....~~~~~..ffffff..ffffff..ffffff..ffffff.~
~~...W_____W*HHpHH...HHHHHHH.........~~~~~~~~~~~......~~~~~~.Tffffff..ffffff..ffffff..ffffff.~
~~~..W_____W.HpppH.TTHpppppH..T....~~~~~~~~~~~~~~~~~~~~~~~~~T......T...............T.......T.~
~~~~~W_W_W_W.HHHHH.*.HHHpHHH......~~~~~~~~~~~~~~~~~~~~~~~~~~...............T................~~
~~~~~~~~~~~~~~~~~~~~66~~...,..!~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~||||+||||~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~::::T:::,::::T::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~::::T::::::T:::,::::::::::T::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~:::::::*::O:::::::,,,,,,::::::::::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~::::T:::::::::::::::::::::,::::T::::Y::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~::::::::O::::T::::,,,,,,,,,,,,,,,,::::::::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~:::T:::::::::::::::,:::::::T:::*:::,:::ii:::::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~:::::::::::Y:::::::,:::::::::::::::,:::ik::::::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~::::T:::::::::::::,::::T::::::::::,:::::::M::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~:::::::::::::::::,,,,,,,,,,,,,,,,,:::::::::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~:::::T:::::::Y:::::::::::::::::::::::T::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~::::::::::::::::::::::T:::::::::::::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~:::::::::::~~~~~~::::::::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
`.trim();

export const TILE_SIZE = 32;
export const TICK_MS = 600; // one game tick, like old-school RuneScape

export type Tile = "grass" | "path" | "water" | "tree" | "rock" | "bridge" | "fence" | "gate" | "sign" | "wall" | "floor" | "house" | "boards"
  | "dig" | "cave" | "cavewall" | "crystal" | "field";

const LEGEND: Record<string, Tile> = {
  ".": "grass", ",": "path", "~": "water", "=": "bridge", ":": "grass", "|": "fence", "+": "gate", "!": "sign",
  W: "wall", _: "floor", H: "house", p: "boards",
  "*": "dig", C: "cave", K: "cavewall", G: "crystal", f: "field",
};

/** Map letters for each type of tree, rock and fishing spot. */
const NODE_LEGEND: Record<string, [Tile, ResourceId]> = {
  T: ["tree", "pine"], O: ["tree", "oak"], B: ["tree", "birch"], M: ["tree", "maple"],
  Y: ["tree", "yew"], I: ["tree", "ironwood"], E: ["tree", "elderwood"],
  "#": ["rock", "stone"], c: ["rock", "copper"], t: ["rock", "tin"], i: ["rock", "iron"],
  k: ["rock", "coal"], v: ["rock", "silver"], g: ["rock", "gold"], m: ["rock", "mithril"],
  2: ["water", "trout"], 3: ["water", "perch"], 4: ["water", "salmon"], 5: ["water", "pike"],
  6: ["water", "tuna"], 7: ["water", "swordfish"], 8: ["water", "eel"],
  // The crystal cave: gem rocks, soul stone veins, platinum and iridium.
  U: ["rock", "amethyst"], Q: ["rock", "topaz"], L: ["rock", "soulstone"], N: ["rock", "emerald"],
  Z: ["rock", "sapphire"], R: ["rock", "ruby"], P: ["rock", "platinum"], X: ["rock", "iridium"],
};

const ROWS = RAW.split("\n").map((row) => [...row]);
export const MAP: Tile[][] = ROWS.map((row) => row.map((ch) => NODE_LEGEND[ch]?.[0] ?? LEGEND[ch] ?? "grass"));
/** Which type of tree, rock or special fishing spot is on each tile (null if none). */
export const MAP_NODES: (ResourceId | null)[][] = ROWS.map((row) => row.map((ch) => NODE_LEGEND[ch]?.[1] ?? null));
export const MAP_HEIGHT = MAP.length;
export const MAP_WIDTH = MAP[0].length;

const BLOCKED: ReadonlySet<Tile> = new Set<Tile>(["water", "tree", "rock", "fence", "sign", "wall", "house", "cavewall"]);

/** The gate into the Dark Forest, and the first row of the danger zone (the fence row). */
export const GATE = (() => {
  const y = ROWS.findIndex((r) => r.includes("+"));
  return { x: ROWS[y].indexOf("+"), y };
})();
export const DANGER_TOP = GATE.y;
/** The Dark Forest (and the spider cave by the quarry): monsters there attack on sight. */
export const isDanger = (x: number, y: number) => y >= DANGER_TOP || MAP[y]?.[x] === "cave" || MAP[y]?.[x] === "crystal";

export function isWalkable(x: number, y: number): boolean {
  if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH) return false;
  return !BLOCKED.has(MAP[y][x]) && !npcAt(x, y);
}

export function randomSpawn(): { x: number; y: number } {
  // Spawn somewhere on the main road near the middle of the map.
  for (;;) {
    const x = 12 + Math.floor(Math.random() * 16);
    const y = 11;
    if (isWalkable(x, y)) return { x, y };
  }
}
