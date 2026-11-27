// Walking, running, doors and paths.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Door, TICK_MS, doorAt, isDanger, isWalkable, inTrainingBounds } from "../../../shared/map";
import { clearAt, findPath, Point, smoothPath } from "../../../shared/pathfinding";
import { RUN_COST, RUN_SPEED, loadLevel, loadSpeed, walkBonus } from "../../../shared/stats";
import { metalSlow } from "../../../shared/combat";
import { fits } from "../../../shared/enchanting";
import { buffPower } from "../../../shared/alchemy";
import { gateOpen, chapterDone, marenDone } from "../../../shared/quests";
import { store } from "../storage";
import { Player } from "./schema";
import { worldNow, CARDINAL } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const movementMethods = {
  /**
   * Walking, smoothly: every 50ms everyone who's walking moves a little, at their
   * own speed (one tile per stepMs). You can stand anywhere, not just mid-tile;
   * the tile under you (x, y) is what talking, gathering, doors and quests use.
   */
  stepPlayers(this: WorldRoom) {
    const now = Date.now();
    this.state.players.forEach((p) => {
      const dt = Math.min(0.2, Math.max(0, (now - (p.movedAt || now)) / 1000));
      p.movedAt = now;
      // Moved by something else (a door, waking up at the shrine...): stand in the middle of that tile.
      if (Math.floor(p.fx) !== p.x || Math.floor(p.fy) !== p.y) { p.fx = p.x + 0.5; p.fy = p.y + 0.5; }
      if (!p.path.length) { p.goalF = null; p.smoothed = null; }
      let dist = dt * 1000 / Math.max(50, p.stepMs);
      if (p.path.length) {
        // A new path (from talking, fighting, gathering...): straighten it.
        if (p.path !== p.smoothed) { p.path = smoothPath({ x: p.fx, y: p.fy }, p.path); p.smoothed = p.path; p.goalF = null; }
        while (dist > 0 && p.path.length) {
          const wp = p.path[0];
          const last = p.path.length === 1;
          const tx = last && p.goalF ? p.goalF.x : wp.x + 0.5, ty = last && p.goalF ? p.goalF.y : wp.y + 0.5;
          const d = Math.hypot(tx - p.fx, ty - p.fy);
          const go = Math.min(d, dist);
          const nx = d > 0 ? p.fx + ((tx - p.fx) / d) * go : tx, ny = d > 0 ? p.fy + ((ty - p.fy) / d) * go : ty;
          dist -= go;
          if (!this.moveTo(p, nx, ny, false)) return;
          if (go >= d) p.path.shift();
          if (!p.path.length) this.arrived(p);
        }
        return;
      }
      // Holding a direction key: walk that way, sliding along walls and round corners.
      if (p.walkDir && !p.fighting && !p.target && !p.talkTo && !p.crafting) {
        const next = this.keyMove(p, p.walkDir, dist);
        if (next) this.moveTo(p, next.x, next.y, true);
      }
    });
  },
  /**
   * Put a walking player at a new spot. Crossing onto a new tile is a "step": it
   * costs running breath, opens doors, counts for quests. False if they stopped
   * (the Dark Forest gate, or through a door).
   */
  moveTo(this: WorldRoom, p: Player, nx: number, ny: number, byKeys: boolean): boolean {
    const tx = Math.floor(nx), ty = Math.floor(ny);
    // Running costs a little breath for every tile's length you run.
    if (this.canRun(p) && !(isDanger(tx, ty) && !isDanger(p.x, p.y) && !gateOpen(p.quest))) {
      p.runDist += Math.hypot(nx - p.fx, ny - p.fy);
      if (p.runDist >= 1) { p.runDist -= 1; this.runStep(p, Date.now()); }
    }
    if (tx === p.x && ty === p.y) { p.fx = nx; p.fy = ny; return true; }
    // The Dark Forest's gate stays shut until Old Maren says you're ready.
    if (isDanger(tx, ty) && !isDanger(p.x, p.y) && !gateOpen(p.quest)) {
      p.path = [];
      const now = Date.now();
      if (!byKeys || now - p.gateToldAt > 4000) {
        this.stopActions(p);
        const client = this.clientOf(p);
        if (client) this.say(client, this.notReady());
      }
      p.gateToldAt = now;
      return false;
    }
    // New players stay in town (the training grounds) until Old Maren's lessons are done.
    if (this.heldInTown(p, { x: tx, y: ty })) {
      p.path = [];
      const now = Date.now();
      if (!byKeys || now - p.gateToldAt > 4000) {
        this.stopActions(p);
        const client = this.clientOf(p);
        if (client) this.say(client, this.stayInTown());
      }
      p.gateToldAt = now;
      return false;
    }
    p.fx = nx; p.fy = ny;
    p.x = tx; p.y = ty;
    p.dirty = true;
    // Walked onto a door: through it you go (when walking with the keys, or when it's where you were going).
    const door = doorAt(tx, ty);
    const last = p.path[p.path.length - 1];
    if (door && (byKeys || (last && last.x === tx && last.y === ty))) {
      p.path = [];
      this.goThrough(p, door);
      p.fx = p.x + 0.5; p.fy = p.y + 0.5;
      return false;
    }
    this.checkReach(p);
    this.checkGrille(p);
    return true;
  },
  /** At the end of a path: if you were walking over to talk to someone, talk. */
  arrived(this: WorldRoom, p: Player) {
    if (!p.talkTo) return;
    const npc = p.talkTo;
    p.talkTo = null;
    const client = this.clientOf(p);
    if (client && this.isNextTo(p, npc)) this.openShop(client, p, npc);
  },
  /**
   * Where the keys take you this time: straight that way if it's clear; if not,
   * slide along the wall; walking into the edge of a gap (a doorway, between two
   * trees), you're eased round the corner into it.
   */
  keyMove(this: WorldRoom, p: Player, d: Point, dist: number): Point | null {
    const ok = (x: number, y: number) => isWalkable(x, y);
    const fits = (x: number, y: number) => clearAt(x, y, ok);
    const full = { x: p.fx + d.x * dist, y: p.fy + d.y * dist };
    if (fits(full.x, full.y)) return full;
    // Slide: keep the part of the move that isn't into the wall (at full speed, so it doesn't feel sticky).
    const slides: Point[] = [];
    if (Math.abs(d.x) > 0.05) slides.push({ x: p.fx + Math.sign(d.x) * dist * Math.max(Math.abs(d.x), 0.7), y: p.fy });
    if (Math.abs(d.y) > 0.05) slides.push({ x: p.fx, y: p.fy + Math.sign(d.y) * dist * Math.max(Math.abs(d.y), 0.7) });
    if (Math.abs(d.y) > Math.abs(d.x)) slides.reverse();
    for (const s of slides) if (fits(s.x, s.y)) return s;
    // Round the corner: the tile straight ahead is open, but we're a little off to one side of it.
    const ax = Math.abs(d.x) >= Math.abs(d.y);
    const ahead = ax ? { x: Math.floor(p.fx) + Math.sign(d.x), y: Math.floor(p.fy) } : { x: Math.floor(p.fx), y: Math.floor(p.fy) + Math.sign(d.y) };
    if (ok(ahead.x, ahead.y)) {
      const mid = ax ? Math.floor(p.fy) + 0.5 : Math.floor(p.fx) + 0.5;
      const off = (ax ? p.fy : p.fx) - mid;
      if (Math.abs(off) > 0.001) {
        const step = Math.sign(-off) * Math.min(Math.abs(off), dist);
        const nudged = ax ? { x: p.fx, y: p.fy + step } : { x: p.fx + step, y: p.fy };
        if (fits(nudged.x, nudged.y)) return nudged;
      }
    }
    return null;
  },
  /** How long each step takes: Dexterity, and a swiftness potion. */
  stepMsOf(this: WorldRoom, p: Player) {
    const now = worldNow();
    const speed = 1 + walkBonus(p.levels.dexterity) + (buffPower(p.buffs, "swift", now) + buffPower(p.buffs, "haste", now)) / 100;
    const load = loadSpeed(loadLevel(this.carried(p), this.capacity(p)));
    return Math.round(TICK_MS / Math.max(0.5, speed - metalSlow(p.gear)) / (this.canRun(p) ? RUN_SPEED : 1) / load);
  },
  /** Running, with breath left for another tile. */
  canRun(this: WorldRoom, p: Player) {
    return p.running && p.stamina - p.winded >= RUN_COST && this.carried(p) <= this.capacity(p);
  },
  /** A tile run: a little breath used up for now. Out of breath, you're back to walking. */
  runStep(this: WorldRoom, p: Player, now: number) {
    p.winded += RUN_COST;
    p.lastRunAt = now;
    const client = this.clients.find((c) => this.state.players.get(c.sessionId) === p);
    if (!this.canRun(p)) {
      p.stepMs = this.stepMsOf(p);
      if (client && !p.outOfBreath) this.say(client, "😮‍💨 You're out of breath, so you slow to a walk. Stop running for a few seconds and your stamina comes back.");
      p.outOfBreath = true;
    }
    if (client) this.sendStamina(client, p);
  },
  // ---- Combat (numbers in shared/combat.ts) ----

  /** Step through a door into another area (a shop, a cave...). Dangerous places stay shut until Kael's lesson. */
  goThrough(this: WorldRoom, p: Player, door: Door) {
    const sid = this.sidOf(p);
    const client = sid ? this.clients.getById(sid) : undefined;
    if (this.robeStep(p)) {
      if (client) this.dialog(client, ["Not like that, friend! Put your robe on first: open your 🎒 bag, click the robe, then press Equip. Then come and meet High Keeper Aldric."], "Keeper Celene");
      return;
    }
    if (isDanger(door.to.x, door.to.y) && !isDanger(p.x, p.y) && !gateOpen(p.quest)) {
      if (client) this.say(client, this.notReady());
      return;
    }
    // Emberhold's gates (version 0.20): Initiates stay inside the walls until they've sworn the Oath of the Flame.
    if (door.gate && !chapterDone(p.quest, "oath")) {
      if (client) this.dialog(client, ["Halt there, Initiate! Nobody goes out into the valley until they've sworn the Oath of the Flame at the Emberhall. Finish your training first: open 📜 Quests to see what's next."], "Gate guard");
      return;
    }
    if (this.heldInTown(p, door.to)) {
      if (client) this.say(client, this.stayInTown());
      return;
    }
    this.stopActions(p);
    p.path = [];
    p.x = door.to.x;
    p.y = door.to.y;
    p.dirty = true;
    // Monsters chasing you lose track of you.
    this.state.monsters.forEach((m) => { if (m.target === sid) m.target = null; });
  },
  /** Would this step take a new player out of town before their training is done? */
  heldInTown(this: WorldRoom, p: Player, to: { x: number; y: number }) {
    return !marenDone(p.quest) && inTrainingBounds(p.x, p.y) && !inTrainingBounds(to.x, to.y);
  },
  stayInTown(this: WorldRoom) {
    return `🧭 Not so fast: stay in town until your training is done. Open 📜 Quests to see what's next (finish Old Maren's lessons and the wider world opens up).`;
  },
  notReady(this: WorldRoom) {
    return `⚠ You're not ready to go in there yet. Monsters there attack on sight: finish Huntmaster Kael's lesson first (he'll open the gate for you).`;
  },
  /** Walk until the tile is within reach. */
  pathNear(this: WorldRoom, p: Point, t: Point): Point[] {
    if (this.nearTile(p, t)) return [];
    const full = findPath({ x: p.x, y: p.y }, t);
    const stop = full.findIndex((pt) => this.nearTile(pt, t));
    return stop < 0 ? full : full.slice(0, stop + 1);
  },
  stopActions(this: WorldRoom, p: Player) {
    p.walkDir = null;
    p.fighting = null;
    p.target = null;
    p.activity = null;
    p.resource = null;
    p.talkTo = null;
    p.crafting = null;
    p.action = "idle";
  },
  isNextTo(this: WorldRoom, p: Point, t: Point) {
    return Math.abs(p.x - t.x) + Math.abs(p.y - t.y) === 1;
  },
  /** Shortest path to any tile directly north/south/east/west of the target. */
  pathNextTo(this: WorldRoom, from: Point, t: Point): Point[] {
    if (this.isNextTo(from, t)) return [];
    let best: Point[] = [];
    for (const d of CARDINAL) {
      const goal = { x: t.x + d.x, y: t.y + d.y };
      if (!isWalkable(goal.x, goal.y)) continue;
      const path = findPath({ x: from.x, y: from.y }, goal);
      if (path.length && (!best.length || path.length < best.length)) best = path;
    }
    return best;
  },
};

/** The messages from players about this. */
export function registerMovement(this: WorldRoom) {
    // Clients only send intent; the server decides what actually happens.
    // fx, fy (optional) is the exact spot clicked inside that tile, so you walk right to it.
    this.onMessage("move", (client, msg: { x: number; y: number; fx?: number; fy?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      if (!isWalkable(msg.x, msg.y)) return;
      // Putting on the robe at the very start (version 0.21, Mike's note): you can't walk off until it's on.
      if (this.robeStep(p)) return;
      this.stopActions(p);
      const goal = { x: msg.x, y: msg.y };
      const path = p.x === goal.x && p.y === goal.y ? [goal] : findPath({ x: p.x, y: p.y }, goal);
      p.path = smoothPath({ x: p.fx, y: p.fy }, path);
      p.smoothed = p.path;
      const fx = msg.fx, fy = msg.fy;
      const exact = Number.isFinite(fx) && Number.isFinite(fy) && Math.floor(fx!) === goal.x && Math.floor(fy!) === goal.y
        && clearAt(fx!, fy!, (x, y) => isWalkable(x, y) && !doorAt(x, y));
      p.goalF = path.length && exact && !doorAt(goal.x, goal.y) ? { x: fx!, y: fy! } : null;
    });
    // Walking with the keyboard (WASD): the client says which way the keys point
    // (dx, dy: any direction, not just the 8 tile directions) whenever that changes,
    // and 0,0 when they're let go. You keep walking that way until then.
    this.onMessage("walk", (client, msg: { dx: number; dy: number }) => {
      const p = this.state.players.get(client.sessionId);
      const dx = msg?.dx, dy = msg?.dy;
      if (!p || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
      const len = Math.hypot(dx, dy);
      if (len >= 0.01 && this.robeStep(p)) return; // dressing first (version 0.21)
      if (len < 0.01) {
        if (p.walkDir) { p.walkDir = null; p.path = []; }
        return;
      }
      if (!p.walkDir) this.stopActions(p);
      p.walkDir = { x: dx / len, y: dy / len };
      p.path = [];
    });
    // Run (Shift, or the 🏃 button): faster, using stamina for the moment (it comes back once you stop).
    this.onMessage("run", (client, msg: { on: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.running = !!msg?.on;
      if (p.running && this.carried(p) > this.capacity(p)) {
        p.running = false;
        client.send("heavy", true);
        this.say(client, "🏋️ You're carrying too much to run. Sell, trash or store something first.");
      }
      p.outOfBreath = false;
      p.stepMs = this.stepMsOf(p);
    });
}
