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
const RAW = `
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~...........TT.......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~.......TT.....T.........44~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~....T....T..........,,,,.....~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~.........,,,,,,,,,,,,,..,......~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~..OO.....,...............,.......~~~~~~~~~~~~~77~~~~~~~~~~
~...OO.....,....##cc.......,.........~~~~~~~~~......~~~~~~~~
~..........,....##tt.......,....MM....~~~~~~...I..I...~~~~~~
~..........,...............,....MM....~~~~~...I.....E..~~~~~
~...~22~...,......TTT......,,,,,,,,...~~~~~.......,..E..~~~~
~..5~~~~~..,.......T.............,....~~~~~.......,......~~~
~..5~~~~~==,,,,,,,,,,,,,,,,,,,,,,,,,,,====,,,,,,,,,..vv...8~
~..~~~~~~..,..........T..........,....~~~~~.......,..vg...8~
~...~33~...,....T.........iik....,....~~~~~..gg...,.......~~
~..........,..............ikk....,.YY.~~~~~..mm...,...E..~~~
~...BB.....,.........T...........,.YY.~~~~~~......,.....~~~~
~...BB.....,,,,,,,,,,,,,,,,,,,,,,,....~~~~~~~~...mm....~~~~~
~~.....................T.............~~~~~~~~~~~......~~~~~~
~~~......T.........TT.........T....~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~.............................~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~66~~..!,...~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~||||+||||~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~::::T:::,::::T::::~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~::::T::::::T:::,::::::::::T::~~~~~~~~~~~~~~~~~~~
~~~~~~~~~::::::::::O:::::::,,,,,,::::::::::::~~~~~~~~~~~~~~~
~~~~~~::::T:::::::::::::::::::::,::::T::::Y::::~~~~~~~~~~~~~
~~~~~::::::::O::::T::::,,,,,,,,,,,,,,,,::::::::::~~~~~~~~~~~
~~~~:::T:::::::::::::::,:::::::T:::::::,:::ii:::::::~~~~~~~~
~~~~:::::::::::Y:::::::,:::::::::::::::,:::ik::::::::~~~~~~~
~~~~~::::T:::::::::::::,::::T::::::::::,:::::::M::::~~~~~~~~
~~~~~~:::::::::::::::::,,,,,,,,,,,,,,,,,:::::::::::~~~~~~~~~
~~~~~~~:::::T:::::::Y:::::::::::::::::::::::T::::~~~~~~~~~~~
~~~~~~~~~::::::::::::::::::::::T:::::::::::::::~~~~~~~~~~~~~
~~~~~~~~~~~~~:::::::::::~~~~~~::::::::::~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
`.trim();

export const TILE_SIZE = 32;
export const TICK_MS = 600; // one game tick, like old-school RuneScape

export type Tile = "grass" | "path" | "water" | "tree" | "rock" | "bridge" | "fence" | "gate" | "sign";

const LEGEND: Record<string, Tile> = {
  ".": "grass", ",": "path", "~": "water", "=": "bridge", ":": "grass", "|": "fence", "+": "gate", "!": "sign",
};

/** Map letters for each type of tree, rock and fishing spot. */
const NODE_LEGEND: Record<string, [Tile, ResourceId]> = {
  T: ["tree", "pine"], O: ["tree", "oak"], B: ["tree", "birch"], M: ["tree", "maple"],
  Y: ["tree", "yew"], I: ["tree", "ironwood"], E: ["tree", "elderwood"],
  "#": ["rock", "stone"], c: ["rock", "copper"], t: ["rock", "tin"], i: ["rock", "iron"],
  k: ["rock", "coal"], v: ["rock", "silver"], g: ["rock", "gold"], m: ["rock", "mithril"],
  2: ["water", "trout"], 3: ["water", "perch"], 4: ["water", "salmon"], 5: ["water", "pike"],
  6: ["water", "tuna"], 7: ["water", "swordfish"], 8: ["water", "eel"],
};

const ROWS = RAW.split("\n").map((row) => [...row]);
export const MAP: Tile[][] = ROWS.map((row) => row.map((ch) => NODE_LEGEND[ch]?.[0] ?? LEGEND[ch] ?? "grass"));
/** Which type of tree, rock or special fishing spot is on each tile (null if none). */
export const MAP_NODES: (ResourceId | null)[][] = ROWS.map((row) => row.map((ch) => NODE_LEGEND[ch]?.[1] ?? null));
export const MAP_HEIGHT = MAP.length;
export const MAP_WIDTH = MAP[0].length;

const BLOCKED: ReadonlySet<Tile> = new Set<Tile>(["water", "tree", "rock", "fence", "sign"]);

/** The gate into the Dark Forest, and the first row of the danger zone (the fence row). */
export const GATE = (() => {
  const y = ROWS.findIndex((r) => r.includes("+"));
  return { x: ROWS[y].indexOf("+"), y };
})();
export const DANGER_TOP = GATE.y;
/** The Dark Forest: monsters there attack on sight. */
export const isDanger = (x: number, y: number) => y >= DANGER_TOP;

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
