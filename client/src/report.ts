// 🐞 Report a bug or note a change, from inside the game.
//
// Tapping the 🐞 button takes a screenshot (the game world plus every panel on
// screen), then opens a little box to type a note. Send posts it all to the
// server (POST /api/reports, see server/src/reports.ts), which adds who you are,
// where you're standing and a copy of your save, and stores it in the database.
import type Phaser from "phaser";
import type { Room } from "colyseus.js";
import { toCanvas } from "html-to-image";
import { recentMessages } from "./ui";
import { GAME_VERSION } from "../../shared/version";

// Show which version this is, at the bottom of Settings.
const versionEl = document.getElementById("game-version");
if (versionEl) versionEl.textContent = `Version ${GAME_VERSION}`;

const MAX_WIDTH = 1280; // screenshots are shrunk to this width to keep them small
const MAX_ERRORS = 20;

// ---- Remember recent errors, so a report can show what went wrong just before ----

const errors: string[] = [];
function noteError(text: string) {
  errors.push(`${new Date().toLocaleTimeString()} ${text}`.slice(0, 500));
  if (errors.length > MAX_ERRORS) errors.shift();
}
window.addEventListener("error", (e) => noteError(`${e.message} (${e.filename?.split("/").pop()}:${e.lineno})`));
window.addEventListener("unhandledrejection", (e) => noteError(`Unhandled: ${e.reason?.message ?? e.reason}`));
const consoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  noteError(args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : safeJson(a))).join(" "));
  consoleError(...args);
};
function safeJson(v: unknown) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

// ---- Which room we're in (set by the world scene when you log in) ----

let room: Room | null = null;
export function setReportRoom(r: Room | null) {
  room = r;
}

// The 3D game draws the world itself: it tells us its name and how to take a picture of it.
let clientName = "2d";
let worldShot: (() => HTMLCanvasElement | null) | null = null;
export function setReportSource(name: string, shot: () => HTMLCanvasElement | null) {
  clientName = name;
  worldShot = shot;
}

/** The server address: in dev the game server is on :2567, in production it's this same address. */
function serverBase() {
  return import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : "";
}

// ---- Screenshot ----

/** The game world, as a picture (Phaser draws it on a canvas we can't copy directly). */
function snapshotWorld(): Promise<HTMLImageElement | HTMLCanvasElement | null> {
  if (worldShot) return Promise.resolve(worldShot());
  const game = (window as any).game as Phaser.Game | undefined;
  if (!game?.renderer) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2000);
    game.renderer.snapshot((img) => {
      clearTimeout(timer);
      resolve(img instanceof HTMLImageElement ? img : null);
    });
  });
}

/** The world with the panels and buttons drawn on top, as a JPEG data URL. */
async function takeScreenshot(): Promise<string | null> {
  const w = window.innerWidth, h = window.innerHeight;
  const scale = Math.min(1, MAX_WIDTH / w);
  const out = document.createElement("canvas");
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, out.width, out.height);

  const world = await snapshotWorld();
  if (world) ctx.drawImage(world, 0, 0, out.width, out.height);

  try {
    const gameCanvas = document.querySelector("#game canvas");
    const reportBox = document.getElementById("report");
    const ui = await toCanvas(document.body, {
      width: w,
      height: h,
      pixelRatio: scale,
      skipFonts: true,
      style: { background: "transparent" },
      filter: (node) => node !== gameCanvas && node !== reportBox,
    });
    ctx.drawImage(ui, 0, 0, out.width, out.height);
  } catch (err) {
    // The panels couldn't be drawn (old browser?): the world alone is still useful.
    console.warn("Report screenshot: couldn't draw the panels", err);
  }
  return out.toDataURL("image/jpeg", 0.8);
}

// ---- What else is useful to know ----

function gatherInfo() {
  const body = document.body;
  const me = room ? (room.state as any)?.players?.get(room.sessionId) : null;
  const game = (window as any).game as Phaser.Game | undefined;
  const cam = game?.scene?.getScenes(true)[0]?.cameras?.main;
  return {
    gameVersion: GAME_VERSION,
    page: location.href,
    screen: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
    touch: "ontouchstart" in window,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    localTime: new Date().toString(),
    panel: [body.dataset.panel, ...Array.from(body.classList).filter((c) => c.endsWith("-open") && c !== "report-open")].filter(Boolean).join(", "),
    zoom: cam ? Math.round(cam.zoom * 100) / 100 : undefined,
    connected: !!room?.connection?.isOpen,
    clientPlayer: me ? { name: me.name, x: me.x, y: me.y, action: me.action, hp: me.hp } : null,
    recentMessages: recentMessages(30),
    recentErrors: [...errors],
  };
}

// ---- The box ----

const btn = document.getElementById("report-btn") as HTMLButtonElement;
const kindBtns = Array.from(document.querySelectorAll<HTMLButtonElement>("#report-kind button"));
const note = document.getElementById("report-note") as HTMLTextAreaElement;
const shotOn = document.getElementById("report-shot-on") as HTMLInputElement;
const shotImg = document.getElementById("report-shot") as HTMLImageElement;
const msg = document.getElementById("report-msg")!;
const send = document.getElementById("report-send") as HTMLButtonElement;
let kind = "bug";
let shot: string | null = null;
let info: ReturnType<typeof gatherInfo> | null = null;

function setMsg(ok: boolean, text: string) {
  msg.textContent = text;
  msg.className = "set-msg " + (ok ? "ok" : "bad");
}

function setKind(k: string) {
  kind = k;
  kindBtns.forEach((b) => b.classList.toggle("active", b.dataset.kind === k));
  note.placeholder = k === "idea" ? "What should change? (e.g. make the axe cheaper)" : "What went wrong? What did you expect?";
}

async function openReport() {
  if (document.body.classList.contains("report-open")) return closeReport();
  btn.disabled = true;
  // Picture first, so it shows the game exactly as it was when you tapped.
  info = gatherInfo();
  shot = await takeScreenshot().catch((err) => { console.warn("Report screenshot failed", err); return null; });
  btn.disabled = false;
  shotImg.src = shot ?? "";
  shotImg.style.display = shot ? "block" : "none";
  shotOn.parentElement!.style.display = shot ? "flex" : "none";
  shotOn.checked = true;
  shotImg.classList.remove("off");
  setMsg(true, "");
  send.disabled = false;
  document.body.classList.add("report-open");
  note.focus();
}

function closeReport() {
  document.body.classList.remove("report-open");
  note.blur();
}

async function sendReport() {
  const text = note.value.trim();
  if (!text) return setMsg(false, "Type a note first.");
  send.disabled = true;
  setMsg(true, "Sending…");
  try {
    const res = await fetch(`${serverBase()}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        note: text,
        client: clientName,
        sessionId: room?.sessionId,
        screenshot: shotOn.checked ? shot : null,
        info,
      }),
    });
    const answer = await res.json().catch(() => ({}));
    if (!res.ok || !answer.ok) throw new Error(answer.error ?? `The server said ${res.status}.`);
    setMsg(true, `Thanks! Saved as report #${answer.id}.`);
    note.value = "";
    setTimeout(() => { if (!note.value) closeReport(); }, 1500);
  } catch (err: any) {
    setMsg(false, err?.message?.startsWith("The ") || err?.message?.startsWith("Too ") ? err.message : "Couldn't send it. Check your connection and try again.");
    send.disabled = false;
  }
}

btn.onclick = () => void openReport();
kindBtns.forEach((b) => (b.onclick = () => setKind(b.dataset.kind!)));
shotOn.onchange = () => shotImg.classList.toggle("off", !shotOn.checked);
send.onclick = () => void sendReport();
document.getElementById("report-close")!.onclick = closeReport;
note.onkeydown = (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void sendReport();
  if (e.key === "Escape") closeReport();
};
setKind("bug");
