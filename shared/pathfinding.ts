import { isWalkable, MAP_WIDTH, MAP_HEIGHT } from "./map";

export interface Point { x: number; y: number }

const DIRS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

/**
 * A* on the tile grid with 8-way movement (diagonals cost the same as straight
 * steps, like RuneScape). Diagonals can't cut the corner of a blocked tile.
 * Returns the list of tiles to walk, excluding the start. Empty if unreachable.
 */
export function findPath(start: Point, goal: Point, maxNodes = 4000): Point[] {
  if (!isWalkable(goal.x, goal.y)) return [];
  if (start.x === goal.x && start.y === goal.y) return [];

  const key = (x: number, y: number) => y * MAP_WIDTH + x;
  const h = (x: number, y: number) => Math.max(Math.abs(x - goal.x), Math.abs(y - goal.y));

  const g = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  const open: { k: number; x: number; y: number; f: number; h: number }[] = [];

  const startKey = key(start.x, start.y);
  g.set(startKey, 0);
  open.push({ k: startKey, x: start.x, y: start.y, f: h(start.x, start.y), h: h(start.x, start.y) });

  let expanded = 0;
  while (open.length && expanded++ < maxNodes) {
    // Small maps: a linear scan for the best node is fine.
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i], b = open[bi];
      if (a.f < b.f || (a.f === b.f && a.h < b.h)) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);

    if (cur.x === goal.x && cur.y === goal.y) {
      const path: Point[] = [];
      let k = cur.k;
      while (k !== startKey) {
        path.push({ x: k % MAP_WIDTH, y: Math.floor(k / MAP_WIDTH) });
        k = cameFrom.get(k)!;
      }
      return path.reverse();
    }

    for (const d of DIRS) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_HEIGHT) continue;
      if (!isWalkable(nx, ny)) continue;
      if (d.x && d.y && (!isWalkable(cur.x + d.x, cur.y) || !isWalkable(cur.x, cur.y + d.y))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = g.get(cur.k)! + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        cameFrom.set(nk, cur.k);
        const nh = h(nx, ny);
        open.push({ k: nk, x: nx, y: ny, f: ng + nh, h: nh });
      }
    }
  }
  return [];
}
