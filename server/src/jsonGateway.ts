/**
 * 🎮 The JSON door: lets game clients that can't speak Colyseus (the Godot app)
 * play on the same server as the web game.
 *
 * A Godot player opens a plain WebSocket to /json and talks in JSON text. For
 * each one, this file opens an ordinary Colyseus connection back to this same
 * server, exactly like a browser would, and passes things along both ways:
 *
 *   app → server:  {"op":"join","username":"...","password":"...","create":false}
 *                  {"op":"send","type":"move","data":{"x":10,"y":20}}   (any message the web game can send)
 *                  {"op":"leave"}
 *   server → app:  {"op":"joined","sessionId":"..."}
 *                  {"op":"error","code":401,"message":"Wrong username or password."}
 *                  {"op":"state","full":true,"tick":1,"players":{...},"monsters":{...},"depleted":{...}}
 *                  {"op":"state","full":false,"tick":2,"players":{"id":{...}},"removed":{"players":["id"]}}
 *                  {"op":"msg","type":"bag","data":...}                  (every message the server sends)
 *                  {"op":"left","code":1000}
 *
 * The game rules don't change at all: WorldRoom can't tell a Godot player from
 * a browser player. State updates send only the players, monsters and spots
 * that changed since the last one ("full":false), with the whole thing first.
 */
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { Client as ColyseusClient, type Room } from "colyseus.js";

/** Where the gateway's inside connection goes: this same server. */
const selfUrl = (port: number) => `ws://127.0.0.1:${port}`;
/** The address Godot connects to. */
export const JSON_PATH = "/json";

type Collections = "players" | "monsters" | "plots" | "depleted";
const COLLECTIONS: Collections[] = ["players", "monsters", "plots", "depleted"];

/** Puts the JSON door in front of Colyseus's own WebSocket handling, on the same port. */
export function attachJsonGateway(http: HttpServer, port: number) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  // Colyseus already listens for WebSocket upgrades on this server. Take its
  // listeners and call them ourselves for every address except /json.
  const colyseusListeners = http.listeners("upgrade") as ((req: IncomingMessage, socket: Duplex, head: Buffer) => void)[];
  http.removeAllListeners("upgrade");
  http.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = (req.url ?? "").split("?")[0];
    if (path === JSON_PATH) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
      return;
    }
    for (const l of colyseusListeners) l.call(http, req, socket, head);
  });
  wss.on("connection", (ws: WebSocket) => new JsonPlayer(ws, port));
  console.log(`JSON door for the Godot app is open at ${JSON_PATH}`);
}

class JsonPlayer {
  private room: Room | null = null;
  private joining = false;
  private last: Record<Collections, Map<string, string>> = { players: new Map(), monsters: new Map(), plots: new Map(), depleted: new Map() };
  private sentFull = false;
  private alive = true;

  constructor(private ws: WebSocket, private port: number) {
    ws.on("message", (raw) => this.onMessage(String(raw)));
    ws.on("close", () => { this.alive = false; void this.room?.leave(true).catch(() => {}); this.room = null; });
    ws.on("error", () => {});
    // Keep the connection alive through Render's proxy, and drop apps that vanished.
    let missed = 0;
    ws.on("pong", () => { missed = 0; });
    const ping = setInterval(() => {
      if (!this.alive) return clearInterval(ping);
      if (++missed > 3) { ws.terminate(); return clearInterval(ping); }
      ws.ping();
    }, 10_000);
  }

  private out(obj: unknown) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private async onMessage(text: string) {
    let m: any;
    try { m = JSON.parse(text); } catch { return this.out({ op: "error", code: 400, message: "That wasn't JSON." }); }
    if (m?.op === "join") return this.join(m);
    if (m?.op === "send") {
      if (!this.room || typeof m.type !== "string") return;
      this.room.send(m.type, m.data);
      return;
    }
    if (m?.op === "leave") { await this.room?.leave(true).catch(() => {}); this.room = null; return; }
    if (m?.op === "ping") return this.out({ op: "pong", t: m.t });
  }

  private async join(m: { username?: unknown; password?: unknown; create?: unknown; device?: unknown }) {
    if (this.room || this.joining) return;
    this.joining = true;
    try {
      const client = new ColyseusClient(selfUrl(this.port));
      const room = await client.joinOrCreate("world", {
        username: String(m.username ?? ""), password: String(m.password ?? ""), create: !!m.create,
      });
      if (!this.alive) { void room.leave(true); return; }
      this.room = room;
      this.out({ op: "joined", sessionId: room.sessionId });
      room.onMessage("*", (type, data) => this.out({ op: "msg", type, data }));
      room.onStateChange((state: any) => this.sendState(state));
      room.onLeave((code) => { this.out({ op: "left", code }); this.room = null; });
      room.onError((code, message) => this.out({ op: "error", code, message }));
    } catch (err: any) {
      this.out({ op: "error", code: err?.code ?? 500, message: err?.message ?? "Couldn't join." });
    } finally {
      this.joining = false;
    }
  }

  /** Sends what changed since last time (everything, the first time). */
  private sendState(state: any) {
    const json = state.toJSON();
    const full = !this.sentFull;
    const msg: any = { op: "state", full, tick: json.tick };
    const removed: Partial<Record<Collections, string[]>> = {};
    let any = full;
    for (const c of COLLECTIONS) {
      const now: Record<string, unknown> = json[c] ?? {};
      const before = this.last[c];
      const changed: Record<string, unknown> = {};
      const seen = new Set<string>();
      for (const [id, v] of Object.entries(now)) {
        seen.add(id);
        const s = JSON.stringify(v);
        if (full || before.get(id) !== s) { changed[id] = v; before.set(id, s); any = true; }
      }
      for (const id of [...before.keys()]) {
        if (!seen.has(id)) { before.delete(id); (removed[c] ??= []).push(id); any = true; }
      }
      if (full || Object.keys(changed).length) msg[c] = changed;
    }
    if (Object.keys(removed).length) msg.removed = removed;
    this.sentFull = true;
    if (any || json.tick !== undefined) this.out(msg);
  }
}
