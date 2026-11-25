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

// ---- Smooth (free) movement ----
// Players stand anywhere, not just in the middle of a tile. Positions here are
// in tiles with fractions: (x + 0.5, y + 0.5) is the middle of tile (x, y).
// The tile you stand on (floor of the position) is still what the game uses for
// talking, gathering, fighting, doors and quests.

/** How wide a player is (half their width, in tiles), so they don't clip into walls and trees. */
export const PLAYER_RADIUS = 0.28;

/** Can someone this wide stand here? Every tile under them has to be one you can walk on. */
export function clearAt(fx: number, fy: number, ok: (x: number, y: number) => boolean, r = PLAYER_RADIUS): boolean {
  const x0 = Math.floor(fx - r), x1 = Math.floor(fx + r);
  const y0 = Math.floor(fy - r), y1 = Math.floor(fy + r);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!ok(x, y)) return false;
  return true;
}

/** Can you walk in a straight line from a to b without bumping into anything? */
export function lineClear(ax: number, ay: number, bx: number, by: number, ok: (x: number, y: number) => boolean, r = PLAYER_RADIUS): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.ceil(d / 0.1));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!clearAt(ax + (bx - ax) * t, ay + (by - ay) * t, ok, r)) return false;
  }
  return true;
}

/**
 * Straighten a tile path: skip every tile you can walk to directly, so you head
 * straight for the far corner instead of zig-zagging tile by tile. Keeps the
 * last tile (where you're going). `from` is where you stand now (with fractions).
 */
export function smoothPath(from: { x: number; y: number }, path: Point[]): Point[] {
  if (path.length < 2) return path;
  const goal = path[path.length - 1];
  // Doors only count as open ground when they're where you're going.
  const ok = (x: number, y: number) => isWalkable(x, y) && (!doorAt(x, y) || (x === goal.x && y === goal.y));
  const out: Point[] = [];
  let ax = from.x, ay = from.y;
  let i = 0;
  while (i < path.length) {
    // The farthest tile ahead we can see in a straight line (at least the next one).
    // (Looks up to 30 tiles ahead, so long walks stay quick to work out.)
    let best = i;
    for (let j = i + 1; j < path.length && j <= i + 30; j++) {
      if (!lineClear(ax, ay, path[j].x + 0.5, path[j].y + 0.5, ok)) break;
      best = j;
    }
    out.push(path[best]);
    ax = path[best].x + 0.5;
    ay = path[best].y + 0.5;
    i = best + 1;
  }
  return out;
}
