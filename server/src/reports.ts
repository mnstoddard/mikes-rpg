// Bug reports and change ideas, sent from inside the game.
//
// Any client (the 2D Phaser game, the 3D game, anything later) can send one:
//   POST /api/reports   JSON { kind, note, sessionId?, client?, screenshot?, info? }
//     kind:       "bug" or "idea"
//     note:       what the player typed
//     sessionId:  the client's Colyseus room session id. The server uses it to fill in
//                 who sent it, where they were and a copy of their save, so the client
//                 doesn't have to (and can't fake it).
//     client:     which game sent it, e.g. "2d" or "3d"
//     screenshot: a data URL (data:image/jpeg;base64,... or image/png), up to ~4 MB
//     info:       anything else the client wants to add (browser, screen size, open
//                 panel, recent messages, recent errors...). Stored as-is.
//   Answers { ok: true, id } or { ok: false, error }.
//
// Reviewing them (needs the ADMIN_PASSWORD environment variable; any username):
//   /admin/reports                  the report browser: filter bugs / ideas, to do / done,
//                                   search, screenshots, full details, mark done, delete
//   /admin/api/reports?status=new   the list as JSON (for scripts, or Claude); no save copies
//   /admin/api/reports/:id          one report as JSON, with everything
//   /admin/reports/:id/screenshot   one report's picture
//   POST /admin/api/reports/:id     JSON { status: "new" | "done" } to tick one off
//   DELETE /admin/api/reports/:id   throw one away for good
import express, { type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { store, type Report } from "./storage";
import { playerForReport } from "./WorldRoom";

const MAX_NOTE = 4000;
const MAX_SHOT_BYTES = 4 * 1024 * 1024;
const MAX_INFO_CHARS = 200_000;
const KINDS = new Set(["bug", "idea"]);
const STATUSES = new Set(["new", "done"]);

// At most 20 reports per address every 10 minutes, so a stuck button can't flood the database.
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 20;
const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) return true;
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) recent.clear();
  return false;
}

/** Which build of the game is running (Render sets RENDER_GIT_COMMIT). */
const VERSION = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "local";

function parseShot(dataUrl: unknown): { type: string; data: Buffer } | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const data = Buffer.from(m[2], "base64");
  return data.length && data.length <= MAX_SHOT_BYTES ? { type: m[1], data } : null;
}

export const reportsRouter = express.Router();

// ---- Sending a report (from the game) ----

// The game's dev client runs on another port (and the 3D client may live elsewhere), so allow any origin.
reportsRouter.use("/api/reports", (req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return void res.sendStatus(204);
  next();
});

reportsRouter.post("/api/reports", express.json({ limit: "7mb" }), async (req, res) => {
  try {
    if (tooMany(req.ip ?? "?")) return void res.status(429).json({ ok: false, error: "Too many reports in a short time. Try again in a few minutes." });
    const body = req.body ?? {};
    const kind = KINDS.has(body.kind) ? body.kind : "bug";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : "";
    const screenshot = parseShot(body.screenshot);
    if (!note && !screenshot) return void res.status(400).json({ ok: false, error: "Type a note first." });

    let extra: Record<string, unknown> = {};
    if (body.info && typeof body.info === "object") {
      const text = JSON.stringify(body.info);
      extra = text.length <= MAX_INFO_CHARS ? body.info : { truncated: text.slice(0, MAX_INFO_CHARS) };
    }
    const player = typeof body.sessionId === "string" ? playerForReport(body.sessionId) : null;
    const info = {
      client: typeof body.client === "string" ? body.client.slice(0, 40) : "unknown",
      serverVersion: VERSION,
      userAgent: req.get("user-agent") ?? "",
      ...extra,
      player, // from the server, so it's trustworthy: name, x, y, area, save
    };
    const id = await store.addReport({ kind, note, username: player?.username ?? null, info }, screenshot);
    console.log(`Report #${id} (${kind}) from ${player?.username ?? "someone not logged in"}: ${note.slice(0, 80)}`);
    res.json({ ok: true, id });
  } catch (err: any) {
    console.error("Saving a report failed:", err.message);
    res.status(500).json({ ok: false, error: "The server couldn't save that. Try again in a moment." });
  }
});

// ---- Reviewing reports (password protected) ----

function adminOnly(req: Request, res: Response, next: NextFunction) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    res.status(503).type("text").send("Reports can't be viewed yet: set ADMIN_PASSWORD in the server's environment (Render dashboard, Environment tab), then reload.");
    return;
  }
  const [scheme, encoded] = (req.get("authorization") ?? "").split(" ");
  const given = scheme === "Basic" && encoded ? Buffer.from(encoded, "base64").toString().split(":").slice(1).join(":") : "";
  const a = Buffer.from(given), b = Buffer.from(password);
  if (a.length === b.length && timingSafeEqual(a, b)) return next();
  res.set("WWW-Authenticate", 'Basic realm="Game reports"').status(401).type("text").send("Password needed.");
}

/** The list leaves out each report's copy of the player's save (it's big); the single report has it. */
function withoutSave(r: Report): Report {
  const player = r.info.player as Record<string, unknown> | null | undefined;
  if (!player || typeof player !== "object" || !("save" in player)) return r;
  const { save: _save, ...rest } = player;
  return { ...r, info: { ...r.info, player: rest } };
}

reportsRouter.get("/admin/api/reports", adminOnly, async (req, res) => {
  const status = STATUSES.has(String(req.query.status)) ? String(req.query.status) : undefined;
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 500));
  res.json((await store.listReports({ status, limit })).map(withoutSave));
});

reportsRouter.get("/admin/api/reports/:id", adminOnly, async (req, res) => {
  const report = await store.getReport(Number(req.params.id));
  if (!report) return void res.status(404).json({ ok: false, error: "No report with that number." });
  res.json(report);
});

reportsRouter.get("/admin/reports/:id/screenshot", adminOnly, async (req, res) => {
  const shot = await store.getScreenshot(Number(req.params.id));
  if (!shot) return void res.sendStatus(404);
  res.type(shot.type).set("Cache-Control", "private, max-age=86400").send(shot.data);
});

reportsRouter.post("/admin/api/reports/:id", adminOnly, express.json(), async (req, res) => {
  const status = String(req.body?.status);
  if (!STATUSES.has(status)) return void res.status(400).json({ ok: false, error: "status must be new or done" });
  res.json({ ok: await store.setReportStatus(Number(req.params.id), status) });
});

reportsRouter.delete("/admin/api/reports/:id", adminOnly, async (req, res) => {
  const ok = await store.deleteReport(Number(req.params.id));
  if (ok) console.log(`Report #${req.params.id} deleted`);
  res.json({ ok });
});

// The report browser: a small web page (admin-reports.html, next to this file).
const ADMIN_PAGE = readFileSync(new URL("./admin-reports.html", import.meta.url), "utf8");
reportsRouter.get("/admin/reports", adminOnly, (_req, res) => {
  res.type("html").set("Cache-Control", "no-store").send(ADMIN_PAGE);
});
