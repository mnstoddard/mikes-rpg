// Sound effects: the sounds Mike picked in the Sound Gallery's "Try it in action" scene.
//
// Every file in ./sfx is CC0 (public domain, safe for Steam, no credit needed); where each one
// comes from is listed in docs/AUDIO-CREDITS.md. To swap a sound, change its file name in PICKS
// below (the names match the Sound Gallery).
//
// Browsers only allow sound after the player has clicked, tapped or pressed a key, so nothing
// plays before then (logging in counts). ⚙️ Settings has an on/off switch and a volume slider,
// and the game remembers both.
import { MAP, type Tile } from "../../../shared/map";

const FILES = import.meta.glob("./sfx/*.mp3", { query: "?url", import: "default", eager: true }) as Record<string, string>;
const url = (id: string) => FILES[`./sfx/${id}.mp3`];

/** What plays at each moment of each action (Mike's picks; the rest are the gallery's defaults). */
const PICKS = {
  chopping: { swing: "sp-med-sounds-woosh-1", hit: "k-rpg-chop", get: "k-impact-impact-plank-medium-000" },
  mining: { swing: "sp-med-sounds-woosh-2", hit: "k-impact-impact-mining-000", get: "k-plat-break" },
  smithing: { swing: "", hit: "k-impact-impact-metal-heavy-000", get: "sp-ninja-sounds-gold-1" },
  smelting: { swing: "", hit: "k-impact-impact-metal-heavy-000", get: "sp-ninja-sounds-gold-1" },
  cooking: { stirs: ["k-impact-impact-glass-light-000", "k-rpg-knife-slice", "k-rpg-metal-click"], stirsPerSecond: 2.9, get: "sp-ninja-sounds-gold-2" },
  fighting: { swing: "sp-med-sounds-woosh-1", hit: "k-impact-impact-soft-heavy-000", hurt: "sp-med-sounds-monster-1", defeated: "sp-ninja-sounds-kill" },
  levelUp: "beat-snes-ogg-treasure",
  questDone: "beat-snes-ogg-victory",
  playerHurt: "k-impact-impact-punch-medium-002",
} as const;

/** Footsteps for each kind of ground (two takes each, so walking doesn't sound like a loop). */
const STEPS = {
  grass: ["k-impact-footstep-grass-000", "k-impact-footstep-grass-001"],
  dirt: ["k-rpg-footstep-0", "k-rpg-footstep-4"],
  wood: ["k-impact-footstep-wood-000", "k-impact-footstep-wood-002"],
  stone: ["k-impact-footstep-concrete-000"],
  carpet: ["k-impact-footstep-carpet-000"],
  snow: ["k-impact-footstep-snow-001"],
} as const;
type Ground = keyof typeof STEPS;
const GROUND: Partial<Record<Tile, Ground>> = {
  grass: "grass", field: "grass", dig: "dirt", withered: "dirt", sand: "dirt", path: "dirt", gravel: "dirt", grave: "dirt",
  floor: "wood", boards: "wood", bridge: "wood", house: "wood", door: "wood",
  cobble: "stone", marble: "stone", cave: "stone", glow: "stone", well: "stone", gate: "stone",
  carpet: "carpet",
};

/** How loud each kind of sound is (before the volume slider). */
const LOUD = { step: 0.3, stir: 0.45, swing: 0.5, hit: 0.8, get: 0.7, jingle: 0.7, hurt: 0.7 };

const ON_KEY = "rpg.sfxOn";
const VOL_KEY = "rpg.sfxVolume";
function load(key: string, fallback: string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function save(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } }

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let enabled = load(ON_KEY, "1") === "1";
let volume = Math.min(1, Math.max(0, Number(load(VOL_KEY, "0.8")) || 0.8));
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    // Load the short sounds now so the first chop isn't late.
    for (const id of Object.keys(FILES)) buffer(id.slice(6, -4));
  }
  if (ctx.state === "suspended") void ctx.resume();
}
window.addEventListener("pointerdown", unlock, { capture: true });
window.addEventListener("keydown", unlock, { capture: true });

function buffer(id: string): Promise<AudioBuffer | null> {
  let b = buffers.get(id);
  if (!b) {
    const u = url(id);
    b = !ctx || !u ? Promise.resolve(null) : fetch(u).then((r) => r.arrayBuffer()).then((a) => ctx!.decodeAudioData(a)).catch(() => null);
    if (ctx) buffers.set(id, b);
  }
  return b;
}

/** Play one sound (by its gallery name). `delay` is in seconds. */
export function play(id: string, loud = 0.8, delay = 0) {
  if (!enabled || !id || !ctx || !master) return;
  const when = ctx.currentTime + delay;
  void buffer(id).then((b) => {
    if (!b || !ctx || !master) return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const g = ctx.createGain();
    g.gain.value = loud;
    src.connect(g).connect(master);
    src.start(Math.max(when, ctx.currentTime));
  });
}

// ---------------------------------------------------------------- game moments

type SwingAction = "chopping" | "mining" | "smithing" | "smelting" | "fighting";
const isSwing = (a: string): a is SwingAction => a in PICKS && a !== "cooking";

/** The arm starts coming down (just before a chop, pick, hammer or sword lands). */
export function onSwing(action: string) {
  if (isSwing(action)) play(PICKS[action].swing, LOUD.swing);
}

/** The tool lands (a chop, pick or hammer blow). Fighting hits come from the server instead (see onFightHit). */
export function onToolHit(action: string) {
  if (isSwing(action) && action !== "fighting") play(PICKS[action].hit, LOUD.hit);
}

/** Something new went into the bag while you were working: a log, some ore, a bar, a meal... */
export function onGot(action: string) {
  const p = (PICKS as unknown as Record<string, { get?: string } | undefined>)[action];
  if (p?.get) play(p.get, LOUD.get);
}

/** You hit a monster (or missed). */
export function onFightHit(miss: boolean) {
  if (miss) return;
  play(PICKS.fighting.hit, LOUD.hit);
  play(PICKS.fighting.hurt, LOUD.hurt, 0.08);
}

/** A monster you were fighting went down. */
export function onMonsterDefeated() { play(PICKS.fighting.defeated, LOUD.get); }

/** A monster hit you. */
export function onPlayerHurt() { play(PICKS.playerHurt, LOUD.hurt); }

/** Any level up: a skill, a discipline or a combat mastery. */
let lastLevelUp = 0;
export function onLevelUp() {
  // A skill and its mastery can level up at the same moment: play the fanfare once.
  const now = performance.now();
  if (now - lastLevelUp < 2000) return;
  lastLevelUp = now;
  play(PICKS.levelUp, LOUD.jingle, 0.15);
}

export function onQuestDone() { play(PICKS.questDone, LOUD.jingle, 0.1); }

/** You stepped onto a tile. */
let lastStep = 0;
export function onStep(x: number, y: number) {
  const now = performance.now();
  if (now - lastStep < 120) return; // doors and jumps can move you twice at once
  lastStep = now;
  const ground = GROUND[MAP[y]?.[x] as Tile] ?? "grass";
  const takes = STEPS[ground];
  play(takes[Math.floor(Math.random() * takes.length)], LOUD.step);
}

/** Call every frame with what you're doing: cooking stirs on its own beat. */
let stirClock = 0;
let lastStir = "";
export function update(dt: number, myAction: string) {
  if (myAction !== "cooking") { stirClock = 0.6; return; }
  stirClock += dt * PICKS.cooking.stirsPerSecond;
  if (stirClock < 1) return;
  stirClock -= 1;
  const stirs = PICKS.cooking.stirs;
  let pick: string = stirs[Math.floor(Math.random() * stirs.length)];
  while (stirs.length > 1 && pick === lastStir) pick = stirs[Math.floor(Math.random() * stirs.length)];
  lastStir = pick;
  play(pick, LOUD.stir);
}

// ---------------------------------------------------------------- settings

/** Hook up the ⚙️ Settings switch and slider (added to the page in vite.config.ts). */
export function setupSoundSettings() {
  const box = document.getElementById("set-sfx") as HTMLInputElement | null;
  const vol = document.getElementById("set-sfx-vol") as HTMLInputElement | null;
  if (box) {
    box.checked = enabled;
    box.onchange = () => { enabled = box.checked; save(ON_KEY, enabled ? "1" : "0"); if (enabled) { unlock(); play(PICKS.chopping.hit, LOUD.hit); } };
  }
  if (vol) {
    vol.value = String(volume);
    vol.oninput = () => { volume = Number(vol.value); save(VOL_KEY, String(volume)); if (master) master.gain.value = volume; };
    vol.onchange = () => { unlock(); play(PICKS.chopping.hit, LOUD.hit); };
  }
}
