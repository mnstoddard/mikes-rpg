// 💥 Automatic crash reports.
//
// When the game breaks, this sends a report to the server by itself (POST /api/crashes,
// see server/src/crashes.ts), so the admin can see what happened at /admin/crashes:
//
//   - "error":      a JavaScript error nobody caught (or a promise that failed)
//   - "webgl":      the 3D drawing was lost (the graphics card or the browser gave up,
//                   often because it ran out of memory)
//   - "disconnect": the connection to the game server dropped unexpectedly
//   - "killed":     the page stopped without closing normally (on an iPad this is usually
//                   Safari reloading the page because it ran out of memory). It's noticed
//                   the next time the game opens, from a note the game keeps writing.
//
// Each report has the error and its stack, the game version, the device, memory use,
// what the game was drawing, and the last things that happened (the "trail").
import { GAME_VERSION } from "../../shared/version";

const MAX_TRAIL = 40;
const MAX_SENT = 8; // per page load, so a broken loop can't flood the server
const HEARTBEAT_MS = 5000;
const ALIVE_KEY = "emberfall-alive";

const trail: string[] = [];
/** Note something that happened, for the trail in the next crash report. */
export function crumb(text: string) {
  trail.push(`${new Date().toLocaleTimeString()} ${text}`.slice(0, 300));
  if (trail.length > MAX_TRAIL) trail.shift();
}

// ---- Things the game tells us about itself ----

let sessionId: () => string | undefined = () => undefined;
let clientName = "2d";
let extra: () => Record<string, unknown> = () => ({});
/** The game's room session (so the server can tell who it was) and a way to describe what it's drawing. */
export function setCrashSource(name: string, session: () => string | undefined, stats: () => Record<string, unknown>) {
  clientName = name;
  sessionId = session;
  extra = stats;
}

let messages: () => string[] = () => [];
/** The game's message log (what the player was told just before). */
export function setCrashMessages(f: () => string[]) { messages = f; }

function serverBase() {
  return import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : "";
}

function memory() {
  const m = (performance as any).memory;
  return {
    heapMB: m ? Math.round(m.usedJSHeapSize / 1e6) : undefined,
    heapLimitMB: m ? Math.round(m.jsHeapSizeLimit / 1e6) : undefined,
    deviceMemoryGB: (navigator as any).deviceMemory,
  };
}

function safe<T>(f: () => T): T | undefined {
  try { return f(); } catch { return undefined; }
}

function snapshot() {
  return {
    gameVersion: GAME_VERSION,
    client: clientName,
    page: location.pathname,
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
    touch: "ontouchstart" in window,
    upMinutes: Math.round(performance.now() / 6000) / 10,
    visible: document.visibilityState,
    ...memory(),
    game: safe(extra),
  };
}

let sent = 0;
const seen = new Set<string>();
/** Send a crash report (each different message once per page load). */
export function reportCrash(kind: string, message: string, stack?: string, more?: Record<string, unknown>) {
  const key = `${kind}:${message}`;
  if (seen.has(key) || sent >= MAX_SENT) return;
  seen.add(key);
  sent++;
  crumb(`💥 ${kind}: ${message}`);
  const body = JSON.stringify({
    kind, message: message.slice(0, 1000), stack: stack?.slice(0, 6000), sessionId: safe(sessionId),
    info: { ...snapshot(), ...more, trail: [...trail], messages: safe(messages) },
  });
  const url = `${serverBase()}/api/crashes`;
  // keepalive lets it finish even if the page is closing.
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: body.length < 60000 }).catch(() => {});
}

// ---- Errors ----

window.addEventListener("error", (e) => {
  // A file that failed to load (a sound, a picture) also fires "error", without a message: skip those.
  if (!e.message) return;
  reportCrash("error", `${e.message} (${e.filename?.split("/").pop() ?? "?"}:${e.lineno}:${e.colno})`, e.error?.stack);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  // Sounds that can't play until the player taps are not crashes.
  if (r?.name === "NotAllowedError" || r?.name === "AbortError") return;
  reportCrash("error", `Unhandled: ${r?.message ?? String(r)}`, r?.stack);
});

/** Watch a WebGL canvas for the drawing being lost. */
export function watchCanvas(canvas: HTMLCanvasElement) {
  canvas.addEventListener("webglcontextlost", () => reportCrash("webgl", "The 3D drawing was lost (WebGL context lost)"));
  canvas.addEventListener("webglcontextrestored", () => crumb("3D drawing came back (WebGL context restored)"));
}

// ---- Noticing the page was killed ----
// While the game runs it keeps a small note in localStorage. Closing or leaving the page
// normally removes it. If it's still there next time, the page stopped without warning.

function readAlive(): any {
  try { return JSON.parse(localStorage.getItem(ALIVE_KEY) ?? "null"); } catch { return null; }
}
function writeAlive() {
  try { localStorage.setItem(ALIVE_KEY, JSON.stringify({ at: Date.now(), ...snapshot(), trail: trail.slice(-15) })); } catch { /* private mode */ }
}
const last = readAlive();
// Only if it stopped recently (an old note could be from closing a background tab days ago).
if (last && Date.now() - last.at < 10 * 60_000) {
  const ago = Math.round((Date.now() - last.at) / 1000);
  setTimeout(() => reportCrash("killed", `The game stopped without closing (${ago}s before it opened again)`, undefined, { before: last }), 3000);
}
// Only while the game is on screen: a tab the browser throws away in the background isn't a crash.
const clearAlive = () => { try { localStorage.removeItem(ALIVE_KEY); } catch { /* */ } };
writeAlive();
setInterval(() => { if (document.visibilityState === "visible") writeAlive(); }, HEARTBEAT_MS);
// Leaving normally (closing, reloading, going to another page): not a crash.
window.addEventListener("pagehide", clearAlive);
// Coming back to a page the browser kept (back button): start the note again.
window.addEventListener("pageshow", (e) => { if (e.persisted) writeAlive(); });
document.addEventListener("visibilitychange", () => {
  crumb(`page ${document.visibilityState}`);
  if (document.visibilityState === "hidden") clearAlive(); else writeAlive();
});
crumb("game opened");
