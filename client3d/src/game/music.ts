// Background music (versions 0.14 and 0.15).
//
// - Anywhere without its own song plays Mike's "Realm of Exploration" (the open-world music).
//   The file was made into a seamless loop: its last bar is crossfaded into its first bar, so
//   when it repeats you can't hear it stop and start.
// - Inside the Emberhall, Kevin MacLeod's "Gregorian Chant" plays instead (Mike picked it in the
//   Sound Gallery). It's CC-BY 4.0, so it's credited in ⚙️ Settings > Credits and in
//   docs/AUDIO-CREDITS.md:
//     "Gregorian Chant" Kevin MacLeod (incompetech.com)
//     Licensed under Creative Commons: By Attribution 4.0 License
//     http://creativecommons.org/licenses/by/4.0/
//
// Songs play through Web Audio (not an <audio> tag) because Web Audio repeats a song with no gap
// at all; an <audio> tag leaves a tiny silence each time it loops. Moving between places fades
// one song out and the next one in. ⚙️ Settings has a 🎵 Music switch and volume slider; the game
// remembers both. Browsers only allow sound after a click or key press, and logging in counts.
import chantUrl from "./music/gregorian-chant.mp3?url";
import worldUrl from "./music/realm-of-exploration.mp3?url";

/** Songs for particular places (area id). Everywhere else plays WORLD_SONG. */
const SONGS: Record<string, string> = { lighthall: chantUrl };
const WORLD_SONG = worldUrl;
/** How loud each song is before the volume slider, so they all sound about as loud as each other. */
const LOUDNESS: Record<string, number> = { [chantUrl]: 1, [worldUrl]: 0.6 };
const ON_KEY = "rpg.musicOn";
const VOL_KEY = "rpg.musicVolume";
const FADE_S = 2.5;

function load(key: string, fallback: string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function save(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } }

let enabled = load(ON_KEY, "1") === "1";
let volume = Math.min(1, Math.max(0, Number(load(VOL_KEY, "0.5")) || 0.5));
let ctx: AudioContext | undefined;
let out: GainNode | undefined; // fade x volume
let source: AudioBufferSourceNode | undefined;
let song = ""; // the song that's loaded (or loading)
let ready = false; // its sound has arrived and is playing
let want = ""; // the song for where you are ("" for none)
let level = 0; // 0..1 fade
let loading = 0; // counts loads, so a slow old load can't start after a newer one

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}
window.addEventListener("pointerdown", unlock, { capture: true });
window.addEventListener("keydown", unlock, { capture: true });

function start(url: string) {
  source?.stop();
  source?.disconnect();
  source = undefined;
  song = url;
  ready = false;
  if (!ctx || !out) return;
  const ticket = ++loading;
  const c = ctx;
  fetch(url)
    .then((r) => r.arrayBuffer())
    .then((a) => c.decodeAudioData(a))
    .then((buf) => {
      if (ticket !== loading || song !== url || !out) return;
      const s = c.createBufferSource();
      s.buffer = buf;
      s.loop = true; // the file itself is a seamless loop
      s.connect(out);
      s.start();
      source = s;
      ready = true;
    })
    .catch(() => { if (ticket === loading) song = ""; /* try again next time */ });
}

/** You're in this place now (area id), or not in the game yet (""): its song fades in, the last one fades out. */
export function setMusicPlace(areaId: string) {
  want = areaId ? (SONGS[areaId] ?? WORLD_SONG) : "";
}

/** Each frame: fade toward the song for this place. */
export function updateMusic(dt: number) {
  if (!ctx || !out) { if (want && enabled) unlock(); if (!ctx || !out) return; }
  // Swap songs once the old one has faded out.
  if (want && want !== song && level <= 0.01) start(want);
  const goal = enabled && want && want === song && ready ? 1 : 0;
  level += Math.sign(goal - level) * Math.min(Math.abs(goal - level), dt / FADE_S);
  out.gain.value = Math.max(0, Math.min(1, level * volume * (LOUDNESS[song] ?? 1)));
  // Stop the old song once it's silent and nothing should play.
  if (!want && level <= 0.001 && source) { source.stop(); source.disconnect(); source = undefined; song = ""; ready = false; }
}

/** ⚙️ Settings: the 🎵 Music switch and slider. */
export function setupMusicSettings() {
  const box = document.getElementById("set-music") as HTMLInputElement | null;
  const vol = document.getElementById("set-music-vol") as HTMLInputElement | null;
  if (box) {
    box.checked = enabled;
    box.onchange = () => { enabled = box.checked; save(ON_KEY, enabled ? "1" : "0"); };
  }
  if (vol) {
    vol.value = String(volume);
    vol.oninput = () => { volume = Number(vol.value); save(VOL_KEY, String(volume)); };
  }
}
