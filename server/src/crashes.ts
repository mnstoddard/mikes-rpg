// 💥 Automatic crash reports: when something breaks, the game and the server write it down.
//
// From a player's game (client/src/crash.ts), sent by itself, no button:
//   POST /api/crashes   JSON { kind, message, stack?, sessionId?, info? }
//     kind: "error" (a JavaScript error), "webgl" (the 3D drawing was lost), "disconnect"
//           (lost the server and couldn't get back), "killed" (the page stopped without
//           closing: on an iPad, usually Safari running out of memory)
//
// From the server itself (installCrashCapture below):
//   "server-error"  an error nobody caught (in a message handler, a timer, anywhere)
//   "server-start"  the server started: after a deploy that's expected, but a start with
//                   the same build as the one before means it crashed or ran out of memory
//
// For the admin (the same ADMIN_PASSWORD as the bug reports and the login log):
//   /admin/crashes               the crash list
//   /admin/api/crashes?limit=N   the same as JSON, newest first
import express from "express";
import { readFileSync } from "node:fs";
import { store, type NewCrash } from "./storage";
import { adminOnly } from "./reports";
import { playerForReport } from "./WorldRoom";

const KINDS = new Set(["error", "webgl", "disconnect", "killed"]);
const MAX_INFO_CHARS = 60_000;

/** Which server this is: dev and live can share one database, so every report says which. */
export const SERVER_NAME = process.env.SERVER_NAME
  ?? (process.env.RENDER_GIT_BRANCH ? (process.env.RENDER_GIT_BRANCH === "main" ? "live" : process.env.RENDER_GIT_BRANCH) : "local");
const BUILD = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "local";

// At most 30 reports per address every 10 minutes.
const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (times.length >= 30) return true;
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) recent.clear();
  return false;
}

function serverInfo() {
  const m = process.memoryUsage();
  return { build: BUILD, rssMB: Math.round(m.rss / 1e6), heapMB: Math.round(m.heapUsed / 1e6), upMinutes: Math.round(process.uptime() / 6) / 10, node: process.version };
}

/** Write a crash down. Never throws: a broken database mustn't turn one crash into two. */
export async function recordCrash(c: Omit<NewCrash, "server">) {
  try {
    return await store.addCrash({ ...c, server: SERVER_NAME });
  } catch (err: any) {
    console.error("Couldn't save a crash report:", err?.message);
    return 0;
  }
}

export const crashesRouter = express.Router();

crashesRouter.use("/api/crashes", (req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return void res.sendStatus(204);
  next();
});

crashesRouter.post("/api/crashes", express.json({ limit: "200kb" }), async (req, res) => {
  if (tooMany(req.ip ?? "?")) return void res.status(429).json({ ok: false });
  const b = req.body ?? {};
  const kind = KINDS.has(b.kind) ? b.kind : "error";
  const message = typeof b.message === "string" ? b.message.slice(0, 1000) : "(no message)";
  const stack = typeof b.stack === "string" ? b.stack.slice(0, 6000) : "";
  let info: Record<string, unknown> = b.info && typeof b.info === "object" ? b.info : {};
  if (JSON.stringify(info).length > MAX_INFO_CHARS) info = { note: "too big, left out" };
  // Who it was, from the server's side (the player's own save copy is left out: it's big).
  const who = typeof b.sessionId === "string" ? playerForReport(b.sessionId) : null;
  const { save: _save, ...player } = who ?? ({} as Record<string, unknown>);
  const id = await recordCrash({ kind, message, stack, username: (who?.username as string) ?? null, info: { ...info, player: who ? player : null, server: serverInfo() } });
  res.json({ ok: true, id });
});

crashesRouter.get("/admin/api/crashes", adminOnly, async (req, res) => {
  const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));
  res.set("Cache-Control", "no-store").json(await store.listCrashes({ limit }));
});

const PAGE = readFileSync(new URL("./admin-crashes.html", import.meta.url), "utf8");
crashesRouter.get("/admin/crashes", adminOnly, (_req, res) => {
  res.type("html").set("Cache-Control", "no-store").send(PAGE);
});

// ---- The server's own crashes ----

let installed = false;
/** Catch errors nobody else caught, and note each start (so restarts after a crash show up). */
export function installCrashCapture() {
  if (installed) return;
  installed = true;
  const onError = (kind: string) => (err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`💥 ${kind}:`, e);
    void recordCrash({ kind: "server-error", message: `${kind}: ${e.message}`, stack: e.stack ?? "", username: null, info: { server: serverInfo() } });
  };
  // The game keeps running after these (a crash in one player's message shouldn't kick everyone out).
  process.on("uncaughtException", onError("Uncaught error"));
  process.on("unhandledRejection", onError("Unhandled promise"));
}

/** Note that the server started, and whether it looks like it restarted on its own. */
export async function noteServerStart() {
  let previous: string | undefined;
  try {
    const last = (await store.listCrashes({ limit: 200 })).find((c) => c.kind === "server-start" && c.server === SERVER_NAME);
    previous = (last?.info?.server as { build?: string } | undefined)?.build;
  } catch { /* first start */ }
  const sameBuild = previous && previous === BUILD && BUILD !== "local";
  await recordCrash({
    kind: "server-start",
    message: sameBuild ? "Server restarted without a new deploy (a crash, running out of memory, or a manual restart)" : "Server started (new deploy)",
    stack: "", username: null, info: { server: serverInfo(), previousBuild: previous ?? null, restartWithoutDeploy: !!sameBuild },
  });
}

/** Errors inside the game room (message handlers, timers): written down, and the room keeps going. */
export function roomError(error: unknown, where: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  console.error(`💥 Room error in ${where}:`, e);
  void recordCrash({ kind: "server-error", message: `${where}: ${e.message}`, stack: e.stack ?? "", username: null, info: { server: serverInfo() } });
}
