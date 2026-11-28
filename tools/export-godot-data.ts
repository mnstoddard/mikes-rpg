// Writes the world data the Godot app needs (godot/data/world.json) from the same
// shared/ files the server and web game use, so the two versions can't drift apart.
// Run (from the server folder, so the shared files load the same way as the server):
//   cd server && npx tsx ../tools/export-godot-data.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MAP, MAP_WIDTH, MAP_HEIGHT, isWalkable } from "../shared/map";
import { AREAS, DOORS, PLACES, MAP_LABELS, groundHeight, CITY_BUILDINGS } from "../shared/world";
import { NPCS } from "../shared/npcs";
import { GAME_VERSION } from "../shared/version";

const legend: string[] = [];
const code = (t: string) => {
  let i = legend.indexOf(t);
  if (i < 0) { i = legend.length; legend.push(t); }
  return String.fromCharCode(48 + i); // "0", "1", ... (one character per tile)
};
const rows: string[] = [];
const walk: string[] = [];
const heights: number[][] = [];
for (let y = 0; y < MAP_HEIGHT; y++) {
  let r = "", w = "";
  for (let x = 0; x < MAP_WIDTH; x++) {
    r += code(MAP[y][x]);
    w += isWalkable(x, y) ? "1" : "0";
    const h = groundHeight(x, y);
    if (Math.abs(h) > 0.001) heights.push([x, y, Math.round(h * 100) / 100]);
  }
  rows.push(r); walk.push(w);
}
const out = {
  note: "Made by tools/export-godot-data.ts from shared/. Don't edit by hand: run the script again.",
  version: GAME_VERSION,
  tile_m: 2,
  w: MAP_WIDTH, h: MAP_HEIGHT,
  legend, rows, walkable: walk, heights,
  areas: AREAS, doors: DOORS, places: PLACES, labels: MAP_LABELS,
  buildings: CITY_BUILDINGS,
  npcs: NPCS.map((n) => ({ id: n.id, name: n.name, kind: n.kind, x: n.x, y: n.y, color: n.color })),
};
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../godot/data");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "world.json"), JSON.stringify(out));
console.log(`godot/data/world.json: ${MAP_WIDTH}x${MAP_HEIGHT} tiles, ${legend.length} kinds, ${heights.length} raised tiles, ${NPCS.length} NPCs`);
