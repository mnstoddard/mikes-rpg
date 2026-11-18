// The world map, shared by server (walkability, pathfinding) and client (drawing).
// Legend:  . grass   , path   ~ water   T tree   # rock   = bridge
// Later this gets replaced by maps drawn in the Tiled editor.
const RAW = `
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~...........TT.......~~~~~~~~~~~~~
~~~~~.......TT.....T.........~~~~~~~~~~~
~~~....T....T..........,,,,.....~~~~~~~~
~~.........,,,,,,,,,,,,,..,......~~~~~~~
~~..TT.....,...............,.......~~~~~
~...TT.....,....####.......,.........~~~
~..........,....####.......,....TT....~~
~..........,...............,....TT....~~
~...~~~~...,......TTT......,,,,,,,,...~~
~..~~~~~~..,.......T.............,....~~
~..~~~~~~==,,,,,,,,,,,,,,,,,,,,,,,....~~
~..~~~~~~..,..........T..........,....~~
~...~~~~...,....T.........###....,....~~
~..........,..............###....,.TT.~~
~...TT.....,.........T...........,.TT.~~
~...TT.....,,,,,,,,,,,,,,,,,,,,,,,....~~
~~.....................T.............~~~
~~~......T.........TT.........T....~~~~~
~~~~~.............................~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
`.trim();

export const TILE_SIZE = 32;
export const TICK_MS = 600; // one game tick, like old-school RuneScape

export type Tile = "grass" | "path" | "water" | "tree" | "rock" | "bridge";

const LEGEND: Record<string, Tile> = {
  ".": "grass", ",": "path", "~": "water", T: "tree", "#": "rock", "=": "bridge",
};

export const MAP: Tile[][] = RAW.split("\n").map((row) =>
  [...row].map((ch) => LEGEND[ch] ?? "grass"),
);
export const MAP_HEIGHT = MAP.length;
export const MAP_WIDTH = MAP[0].length;

const BLOCKED: ReadonlySet<Tile> = new Set<Tile>(["water", "tree", "rock"]);

export function isWalkable(x: number, y: number): boolean {
  if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH) return false;
  return !BLOCKED.has(MAP[y][x]);
}

export function randomSpawn(): { x: number; y: number } {
  // Spawn somewhere on the main road near the middle of the map.
  for (;;) {
    const x = 12 + Math.floor(Math.random() * 16);
    const y = 11;
    if (isWalkable(x, y)) return { x, y };
  }
}
