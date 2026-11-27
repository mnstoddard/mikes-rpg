// Can you walk everywhere the story sends you? A flood fill from where new characters wake,
// walking tile to tile and through every door, then a check that each person, station and
// story spot is on (or next to) a tile you reached. Lists anything you can't get to.
//
//   npx tsx tools/reach-check.ts
import { DOORS, MAP, PLACES, WAKE_SPOT, areaAt, isWalkable } from "../shared/map";
import { NPCS } from "../shared/npcs";

const W = MAP[0].length, H = MAP.length;
const seen = new Uint8Array(W * H);
const doorAt = new Map(DOORS.map((d) => [d.y * W + d.x, d]));
const q: number[] = [WAKE_SPOT.y * W + WAKE_SPOT.x];
seen[q[0]] = 1;
while (q.length) {
  const k = q.pop()!;
  const x = k % W, y = (k - x) / W;
  const d = doorAt.get(k);
  const next: [number, number][] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]];
  if (d) next.push([d.to.x, d.to.y]);
  for (const [nx, ny] of next) {
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const nk = ny * W + nx;
    if (seen[nk]) continue;
    // Diagonal steps only where both sides are open (no corner cutting).
    if (nx !== x && ny !== y && !(d && nx === d.to.x && ny === d.to.y) && !(isWalkable(nx, y) && isWalkable(x, ny))) continue;
    if (!isWalkable(nx, ny) && !doorAt.has(nk)) continue;
    seen[nk] = 1;
    q.push(nk);
  }
}
const near = (p: { x: number; y: number }) => {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (seen[(p.y + dy) * W + p.x + dx]) return true;
  return false;
};
let bad = 0;
for (const n of NPCS) if (!near(n)) { bad++; console.log(`can't reach ${n.id} (${n.name}) at ${n.x},${n.y} in ${areaAt(n.x, n.y)?.id}`); }
for (const [k, p] of Object.entries(PLACES)) if (!near(p)) { bad++; console.log(`can't reach place ${k} at ${p.x},${p.y} in ${areaAt(p.x, p.y)?.id}`); }
for (const d of DOORS) if (!near(d.to)) { bad++; console.log(`door ${d.label} at ${d.x},${d.y} lands somewhere unreachable`); }
console.log(bad ? `${bad} places you can't get to.` : "Everything is reachable.");
const byArea: Record<string, number> = {};
for (let k = 0; k < W * H; k++) if (seen[k]) { const a = areaAt(k % W, Math.floor(k / W))?.id ?? "?"; byArea[a] = (byArea[a] ?? 0) + 1; }
console.log("Tiles reached by area:", byArea);
