import { isWalkable, doorAt, MAP_WIDTH, MAP_HEIGHT } from "./map";

export interface Point { x: number; y: number }

const DIRS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

/** A small binary heap of open nodes, best (lowest f, then h) first. */
class Heap {
  private items: { k: number; f: number; h: number }[] = [];
  get size() { return this.items.length; }
  private less(a: { f: number; h: number }, b: { f: number; h: number }) { return a.f < b.f || (a.f === b.f && a.h < b.h); }
  push(n: { k: number; f: number; h: number }) {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * A* on the tile grid with 8-way movement (diagonals cost the same as straight
 * steps, like RuneScape). Diagonals can't cut the corner of a blocked tile.
 * Doors are only walked onto when they're where you're going (so a path never
 * takes you through a door by accident).
 * Returns the list of tiles to walk, excluding the start. Empty if unreachable.
 */
export function findPath(start: Point, goal: Point, maxNodes = 30000): Point[] {
  if (!isWalkable(goal.x, goal.y)) return [];
  if (start.x === goal.x && start.y === goal.y) return [];

  const W = MAP_WIDTH;
  const key = (x: number, y: number) => y * W + x;
  const h = (x: number, y: number) => Math.max(Math.abs(x - goal.x), Math.abs(y - goal.y));
  const goalKey = key(goal.x, goal.y);
  const ok = (x: number, y: number) => isWalkable(x, y) && (!doorAt(x, y) || key(x, y) === goalKey);

  const g = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  const open = new Heap();

  const startKey = key(start.x, start.y);
  g.set(startKey, 0);
  open.push({ k: startKey, f: h(start.x, start.y), h: h(start.x, start.y) });

  let expanded = 0;
  while (open.size && expanded++ < maxNodes) {
    const cur = open.pop();
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    const cx = cur.k % W, cy = Math.floor(cur.k / W);

    if (cur.k === goalKey) {
      const path: Point[] = [];
      let k = cur.k;
      while (k !== startKey) {
        path.push({ x: k % W, y: Math.floor(k / W) });
        k = cameFrom.get(k)!;
      }
      return path.reverse();
    }

    for (const d of DIRS) {
      const nx = cx + d.x, ny = cy + d.y;
      if (nx < 0 || ny < 0 || nx >= W || ny >= MAP_HEIGHT) continue;
      if (!ok(nx, ny)) continue;
      if (d.x && d.y && (!isWalkable(cx + d.x, cy) || !isWalkable(cx, cy + d.y))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = g.get(cur.k)! + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        cameFrom.set(nk, cur.k);
        const nh = h(nx, ny);
        open.push({ k: nk, f: ng + nh, h: nh });
      }
    }
  }
  return [];
}
