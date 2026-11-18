import { Room, Client } from "colyseus";
import { MapSchema, Schema, type } from "@colyseus/schema";
import { MAP, MAP_HEIGHT, MAP_WIDTH, TICK_MS, isWalkable, randomSpawn } from "../../shared/map";
import { findPath, Point } from "../../shared/pathfinding";
import { CHOP_SUCCESS_CHANCE, TREE_FALL_CHANCE, TREE_RESPAWN_TICKS, treeKey } from "../../shared/foraging";
import { INVENTORY_SIZE, ITEMS, ItemId } from "../../shared/items";

export class Player extends Schema {
  @type("string") name = "";
  @type("number") x = 0; // tile coordinates
  @type("number") y = 0;
  @type("number") color = 0xffffff;
  @type("string") action = "idle"; // "idle" | "chopping" (so others see the animation)
  @type("number") faceX = 0; // tile the player is working on, for the animation
  @type("number") faceY = 0;

  // Server-only (not synced to everyone):
  path: Point[] = [];
  target: Point | null = null; // tree the player is heading to / chopping
  inventory: (ItemId | null)[] = new Array(INVENTORY_SIZE).fill(null);
}

export class WorldState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  /** Trees that have been chopped down: key "x,y" -> tick when it grows back. */
  @type({ map: "number" }) stumps = new MapSchema<number>();
  @type("number") tick = 0;
}

const COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xff6ec7];
const CARDINAL = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

const isTree = (x: number, y: number) =>
  y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && MAP[y][x] === "tree";

export class WorldRoom extends Room<WorldState> {
  maxClients = 100;
  state = new WorldState();

  onCreate() {
    // Don't stream state on every change; only once per game tick.
    this.setPatchRate(TICK_MS);
    this.setSimulationInterval(() => this.gameTick(), TICK_MS);

    // Clients only send intent; the server decides what actually happens.
    this.onMessage("move", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      if (!isWalkable(msg.x, msg.y)) return;
      this.stopActions(p);
      p.path = findPath({ x: p.x, y: p.y }, { x: msg.x, y: msg.y });
    });

    this.onMessage("chop", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      if (!isTree(msg.x, msg.y)) return;
      if (this.state.stumps.has(treeKey(msg.x, msg.y))) return this.say(client, "That tree has been cut down.");
      this.stopActions(p);
      p.target = { x: msg.x, y: msg.y };
      p.path = this.pathNextTo(p, p.target);
      if (!p.path.length && !this.isNextTo(p, p.target)) {
        p.target = null;
        this.say(client, "You can't reach that.");
      }
    });

    // The client says it's ready once its message handlers are set up.
    this.onMessage("ready", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      this.sendInventory(client, p);
      this.say(client, "Welcome! Click a tree to chop it for logs.");
    });

    this.onMessage("drop", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !p.inventory[msg.slot]) return;
      p.inventory[msg.slot] = null;
      this.sendInventory(client, p);
    });
  }

  gameTick() {
    const tick = ++this.state.tick;

    // Grow back trees whose time is up.
    this.state.stumps.forEach((respawnAt, key) => {
      if (tick >= respawnAt) this.state.stumps.delete(key);
    });

    this.state.players.forEach((p, sessionId) => {
      // Walking speed: one tile per tick.
      const next = p.path.shift();
      if (next) { p.x = next.x; p.y = next.y; return; }
      if (p.target) this.chopTick(p, sessionId);
    });
  }

  private chopTick(p: Player, sessionId: string) {
    const client = this.clients.getById(sessionId);
    const t = p.target!;
    if (!this.isNextTo(p, t)) return this.stopActions(p);
    if (this.state.stumps.has(treeKey(t.x, t.y))) return this.stopActions(p); // someone else felled it

    const free = p.inventory.indexOf(null);
    if (free === -1) {
      if (client) this.say(client, "Your inventory is too full to hold any more logs.");
      return this.stopActions(p);
    }

    if (p.action !== "chopping") {
      p.action = "chopping";
      p.faceX = t.x;
      p.faceY = t.y;
      if (client) this.say(client, "You swing at the tree.");
      return;
    }

    if (Math.random() >= CHOP_SUCCESS_CHANCE) return;

    p.inventory[free] = "logs";
    if (client) {
      this.sendInventory(client, p);
      this.say(client, `You get some ${ITEMS.logs.name.toLowerCase()}.`);
    }
    if (Math.random() < TREE_FALL_CHANCE) {
      this.state.stumps.set(treeKey(t.x, t.y), this.state.tick + TREE_RESPAWN_TICKS);
      if (client) this.say(client, "The tree falls down.");
      // Everyone chopping this tree stops.
      this.state.players.forEach((other) => {
        if (other.target && other.target.x === t.x && other.target.y === t.y) this.stopActions(other);
      });
    }
  }

  private stopActions(p: Player) {
    p.target = null;
    p.action = "idle";
  }

  private isNextTo(p: Point, t: Point) {
    return Math.abs(p.x - t.x) + Math.abs(p.y - t.y) === 1;
  }

  /** Shortest path to any tile directly north/south/east/west of the target. */
  private pathNextTo(from: Point, t: Point): Point[] {
    if (this.isNextTo(from, t)) return [];
    let best: Point[] = [];
    for (const d of CARDINAL) {
      const goal = { x: t.x + d.x, y: t.y + d.y };
      if (!isWalkable(goal.x, goal.y)) continue;
      const path = findPath({ x: from.x, y: from.y }, goal);
      if (path.length && (!best.length || path.length < best.length)) best = path;
    }
    return best;
  }

  private say(client: Client, text: string) {
    client.send("message", text);
  }

  // The inventory goes only to its owner, not to every player.
  private sendInventory(client: Client, p: Player) {
    client.send("inventory", p.inventory);
  }

  onJoin(client: Client, options: { name?: string }) {
    const p = new Player();
    const spawn = randomSpawn();
    p.x = spawn.x;
    p.y = spawn.y;
    p.name = String(options?.name ?? "").trim().slice(0, 12) || `Player${Math.floor(Math.random() * 1000)}`;
    p.color = COLORS[this.state.players.size % COLORS.length];
    this.state.players.set(client.sessionId, p);
    console.log(`${p.name} joined (${this.state.players.size} online)`);
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    console.log(`${p?.name} left (${this.state.players.size} online)`);
  }
}
