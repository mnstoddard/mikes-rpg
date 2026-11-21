// Checks the world map for mistakes (people standing in walls, doors that lead
// nowhere, places you can't reach...) and draws a picture of it.
// Run: npx tsx tools/check-world.ts [out.png]
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { AREAS, DOORS, MAP, MAP_HEIGHT, MAP_WIDTH, MAP_NODES, PLACES, areaAt, charAt, doorAt, isDanger, isWalkable, WAKE_SPOT } from "../shared/map";
import { NPCS } from "../shared/npcs";
import { MONSTER_SPAWNS } from "../shared/combat";
import { LOTS, LOT_SIZE } from "../shared/farming";
import { fishAt } from "../shared/foraging";

const problems: string[] = [];
const W = MAP_WIDTH;
const key = (x: number, y: number) => y * W + x;
const CARD = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Everything you can reach from where new characters wake, walking and through doors.
const seen = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
const queue: [number, number][] = [[WAKE_SPOT.x, WAKE_SPOT.y]];
seen[key(WAKE_SPOT.x, WAKE_SPOT.y)] = 1;
while (queue.length) {
  const [x, y] = queue.pop()!;
  const d = doorAt(x, y);
  const next: [number, number][] = CARD.map(([dx, dy]) => [x + dx, y + dy]);
  if (d) next.push([d.to.x, d.to.y]);
  for (const [nx, ny] of next) {
    if (!isWalkable(nx, ny) || seen[key(nx, ny)]) continue;
    seen[key(nx, ny)] = 1;
    queue.push([nx, ny]);
  }
}
const reach = (x: number, y: number) => !!seen[key(x, y)];
const reachNext = (x: number, y: number) => CARD.some(([dx, dy]) => reach(x + dx, y + dy));

for (const n of NPCS) {
  if (!areaAt(n.x, n.y)) problems.push(`${n.id} is outside every area`);
  const t = MAP[n.y][n.x];
  if (["wall", "house", "marblewall", "cavewall", "water", "void", "tree", "rock", "cliff", "roof"].includes(t)) problems.push(`${n.id} stands on ${t}`);
  if (!reachNext(n.x, n.y)) problems.push(`${n.id} (${n.x},${n.y}) can't be reached`);
}
for (const d of DOORS) {
  if (!isWalkable(d.to.x, d.to.y)) problems.push(`door ${d.label} at ${d.x},${d.y} lands on a blocked tile`);
  if (areaAt(d.to.x, d.to.y)?.id !== d.area) problems.push(`door ${d.label} lands in ${areaAt(d.to.x, d.to.y)?.id}, not ${d.area}`);
  if (!reach(d.x, d.y)) problems.push(`door ${d.label} at ${d.x},${d.y} can't be reached`);
}
for (const [kind, x, y] of MONSTER_SPAWNS) {
  if (!isWalkable(x, y) || doorAt(x, y)) problems.push(`${kind} at ${x},${y} is on a blocked tile`);
  else if (!reach(x, y)) problems.push(`${kind} at ${x},${y} can't be reached`);
}
LOTS.forEach((l, i) => {
  for (let y = l.y; y < l.y + LOT_SIZE; y++) for (let x = l.x; x < l.x + LOT_SIZE; x++) if (MAP[y][x] !== "field") problems.push(`lot ${i} has ${MAP[y][x]} at ${x},${y}`);
  if (!reachNext(l.x, l.y) && !reach(l.x, l.y)) { /* fields are walkable */ }
  if (!reach(l.x, l.y)) problems.push(`lot ${i} can't be reached`);
});
for (const a of AREAS) {
  let any = false;
  for (let y = a.y; y < a.y + a.h && !any; y++) for (let x = a.x; x < a.x + a.w; x++) if (reach(x, y)) { any = true; break; }
  if (!any) problems.push(`area ${a.id} can't be reached`);
}
// Trees, rocks and fishing spots you can't get next to.
const counts: Record<string, number> = {};
let stranded = 0;
for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 0; x < W; x++) {
  const node = MAP_NODES[y][x] ?? (MAP[y][x] === "water" ? fishAt(x, y) : MAP[y][x] === "dig" ? "dig" : null);
  if (!node) continue;
  if (MAP[y][x] === "water" && node === "minnow") { if (reachNext(x, y)) counts.minnow = (counts.minnow ?? 0) + 1; continue; }
  if (MAP[y][x] === "dig" ? !reach(x, y) : !reachNext(x, y)) { stranded++; continue; }
  counts[node] = (counts[node] ?? 0) + 1;
}
console.log(`World ${MAP_WIDTH} x ${MAP_HEIGHT}, ${AREAS.length} areas, ${DOORS.length} doors, ${NPCS.length} people and stations, ${MONSTER_SPAWNS.length} monsters, ${LOTS.length} farm lots`);
console.log("Things to gather:", Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "));
const monsters: Record<string, number> = {};
for (const [k] of MONSTER_SPAWNS) monsters[k] = (monsters[k] ?? 0) + 1;
console.log("Monsters:", Object.entries(monsters).map(([k, v]) => `${k} ${v}`).join(", "));
console.log(`Unreachable trees/rocks/spots (fine in small numbers): ${stranded}`);
// Dangerous places you could walk into from a safe one without the gate (only the gate and dangerous doors should).
let leaks = 0;
for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 0; x < W; x++) {
  if (!reach(x, y) || isDanger(x, y)) continue;
  for (const [dx, dy] of CARD) if (isDanger(x + dx, y + dy) && isWalkable(x + dx, y + dy) && charAt(x + dx, y + dy) !== "+" && !doorAt(x + dx, y + dy)) { leaks++; if (leaks < 5) console.log("leak", x + dx, y + dy); }
}
console.log(`Places to step from safe ground into the Dark Forest other than the gate: ${leaks}`);
if (problems.length) { console.log(`\n${problems.length} PROBLEMS:\n` + problems.join("\n")); process.exitCode = 1; }
else console.log("No problems found.");

// ---- A picture of the map ----
const out = process.argv[2];
if (out) {
  const S = Number(process.argv[3] ?? 4);
  const COL: Record<string, number> = {
    grass: 0x4a8f3c, path: 0xb89b6a, water: 0x2d6fa3, tree: 0x1e4e16, rock: 0x8d8d8d, bridge: 0x8b5a2b, fence: 0x5c3a1a, gate: 0xe0c070,
    sign: 0xffd84a, wall: 0x4b3a6b, floor: 0x6d5a8e, house: 0x7a4f2a, boards: 0xa47a4c, dig: 0xd9c25a, cave: 0x3d3846, cavewall: 0x1f1b24,
    crystal: 0x33405a, field: 0x6b4423, void: 0x000000, door: 0xff3030, lockeddoor: 0x802020, cobble: 0x9c9488, sand: 0xe2cf8e,
    withered: 0x8a8450, cliff: 0x5e5650, hedge: 0x2f5a25, well: 0x4a6a8a, barricade: 0x6a3a1a, roof: 0x8a3b2b, goldroof: 0xe8c860,
    marblewall: 0xd8d4c8, marble: 0xf4f0e6, glow: 0xfff2a0, carpet: 0xc8a030, statue: 0xb0aaa0, table: 0x8b5a2b, shelf: 0x5a3a1e,
    crates: 0x9a6b3a, grave: 0x707078, gravel: 0x8a8a6a,
  };
  const w = MAP_WIDTH * S, h = MAP_HEIGHT * S;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const npcTiles = new Set(NPCS.map((n) => key(n.x, n.y)));
  const monTiles = new Set(MONSTER_SPAWNS.map(([, x, y]) => key(x, y)));
  for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 0; x < W; x++) {
    let c = COL[MAP[y][x]] ?? 0xff00ff;
    if (isDanger(x, y) && MAP[y][x] === "grass") c = 0x23432a;
    if (MAP[y][x] === "rock" && MAP_NODES[y][x] !== "stone") c = 0xc07a3c;
    if (MAP[y][x] === "water" && MAP_NODES[y][x]) c = 0x7fe0ff;
    if (npcTiles.has(key(x, y))) c = 0xffffff;
    if (monTiles.has(key(x, y))) c = 0xff2020;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const row = y * S + sy, i = row * (w * 3 + 1) + 1 + (x * S + sx) * 3;
      raw[i] = c >> 16; raw[i + 1] = (c >> 8) & 255; raw[i + 2] = c & 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
  console.log(`Picture written to ${out}`);
}
