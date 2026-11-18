import { Room, Client } from "colyseus";
import { MapSchema, Schema, type } from "@colyseus/schema";
import { TICK_MS, isWalkable, randomSpawn } from "../../shared/map";
import { findPath, Point } from "../../shared/pathfinding";

export class Player extends Schema {
  @type("string") name = "";
  @type("number") x = 0; // tile coordinates
  @type("number") y = 0;
  @type("number") color = 0xffffff;

  // Server-only (not synced): tiles still to walk.
  path: Point[] = [];
}

export class WorldState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("number") tick = 0;
}

const COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xff6ec7];

export class WorldRoom extends Room<WorldState> {
  maxClients = 100;
  state = new WorldState();

  onCreate() {
    // Don't stream state on every change; only once per game tick.
    this.setPatchRate(TICK_MS);
    this.setSimulationInterval(() => this.gameTick(), TICK_MS);

    // Clients only send intent ("I want to walk to x,y"); the server decides.
    this.onMessage("move", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      if (!isWalkable(msg.x, msg.y)) return;
      p.path = findPath({ x: p.x, y: p.y }, { x: msg.x, y: msg.y });
    });
  }

  gameTick() {
    this.state.tick++;
    // Walking speed: one tile per tick.
    this.state.players.forEach((p) => {
      const next = p.path.shift();
      if (next) { p.x = next.x; p.y = next.y; }
    });
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
