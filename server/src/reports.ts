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
//   /admin/reports                  a page listing every report with its screenshot
//   /admin/api/reports?status=new   the same as JSON (for scripts, or Claude)
//   /admin/reports/:id/screenshot   one report's picture
//   POST /admin/api/reports/:id     JSON { status: "new" | "done" } to tick one off
import express, { type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { store } from "./storage";
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

reportsRouter.get("/admin/api/reports", adminOnly, async (req, res) => {
  const status = STATUSES.has(String(req.query.status)) ? String(req.query.status) : undefined;
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  res.json(await store.listReports({ status, limit }));
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

reportsRouter.get("/admin/reports", adminOnly, (_req, res) => {
  res.type("html").send(ADMIN_PAGE);
});

const ADMIN_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Game reports</title>
<style>
  body { margin: 0; background: #1b1610; color: #f2e6c9; font: 15px/1.45 sans-serif; }
  header { position: sticky; top: 0; background: #2a2218; border-bottom: 2px solid #6b5a3e; padding: 10px 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 18px; color: #ffd84a; font-weight: normal; margin-right: auto; }
  button, select { font: inherit; background: #5a4a2f; color: #fff; border: 1px solid #6b5a3e; border-radius: 3px; padding: 5px 10px; cursor: pointer; }
  main { padding: 12px 16px; display: grid; gap: 12px; max-width: 1100px; margin: 0 auto; }
  .r { background: #2a2218; border: 1px solid #6b5a3e; border-radius: 4px; padding: 12px; display: grid; grid-template-columns: minmax(0, 340px) 1fr; gap: 14px; }
  .r.done { opacity: .55; }
  .r img { width: 100%; border-radius: 3px; cursor: zoom-in; background: #000; }
  .noshot { color: #9a8a6a; font-style: italic; }
  .top { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .tag { font-size: 12px; padding: 1px 7px; border-radius: 10px; background: #6b3a2e; }
  .tag.idea { background: #2e5a6b; }
  .when { color: #b8a888; font-size: 13px; }
  .note { white-space: pre-wrap; margin: 6px 0 8px; font-size: 16px; color: #fff; }
  .meta { font-size: 13px; color: #c9b998; }
  details { margin-top: 6px; font-size: 12px; }
  pre { white-space: pre-wrap; word-break: break-word; background: #120e09; padding: 8px; border-radius: 3px; max-height: 300px; overflow: auto; }
  .empty { text-align: center; color: #9a8a6a; padding: 40px; }
  @media (max-width: 700px) { .r { grid-template-columns: 1fr; } }
</style></head><body>
<header><h1>🐞 Game reports</h1>
  <select id="filter"><option value="new">New only</option><option value="">All</option><option value="done">Done</option></select>
  <button id="reload">Reload</button></header>
<main id="list"><div class="empty">Loading…</div></main>
<script>
const list = document.getElementById("list");
const filter = document.getElementById("filter");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
async function load() {
  const res = await fetch("/admin/api/reports" + (filter.value ? "?status=" + filter.value : ""));
  const reports = await res.json();
  if (!reports.length) { list.innerHTML = '<div class="empty">No reports here yet.</div>'; return; }
  list.innerHTML = reports.map((r) => {
    const p = r.info.player || {};
    const where = p.x != null ? esc(p.area || "?") + " (" + p.x + ", " + p.y + ")" : "not logged in";
    const meta = [
      "Player: <b>" + esc(r.username || "unknown") + "</b>", "Where: " + where,
      "Game: " + esc(r.info.client) + " " + esc(r.info.serverVersion),
      r.info.screen ? "Screen: " + esc(r.info.screen) : "", r.info.panel ? "Open: " + esc(r.info.panel) : "",
    ].filter(Boolean).join(" · ");
    const shot = r.hasScreenshot
      ? '<a href="/admin/reports/' + r.id + '/screenshot" target="_blank"><img loading="lazy" src="/admin/reports/' + r.id + '/screenshot" alt="Screenshot"></a>'
      : '<div class="noshot">No screenshot</div>';
    return '<div class="r ' + esc(r.status) + '">' + shot + '<div>'
      + '<div class="top"><b>#' + r.id + '</b><span class="tag ' + esc(r.kind) + '">' + (r.kind === "idea" ? "Change idea" : "Bug") + '</span>'
      + '<span class="when">' + new Date(r.createdAt).toLocaleString() + '</span>'
      + '<button style="margin-left:auto" data-id="' + r.id + '" data-to="' + (r.status === "done" ? "new" : "done") + '">'
      + (r.status === "done" ? "Mark as new" : "✓ Mark done") + '</button></div>'
      + '<div class="note">' + esc(r.note || "(no note)") + '</div><div class="meta">' + meta + '</div>'
      + '<details><summary>All details</summary><pre>' + esc(JSON.stringify(r.info, null, 2)) + '</pre></details>'
      + '</div></div>';
  }).join("");
}
list.onclick = async (e) => {
  const b = e.target.closest("button[data-id]");
  if (!b) return;
  b.disabled = true;
  await fetch("/admin/api/reports/" + b.dataset.id, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: b.dataset.to }) });
  load();
};
filter.onchange = load;
document.getElementById("reload").onclick = load;
load();
</script></body></html>`;
