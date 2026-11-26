// Background music for places (version 0.14). For now one song: Kevin MacLeod's
// "Gregorian Chant" plays softly inside the Emberhall (Mike picked it in the
// Sound Gallery). It's CC-BY 4.0, so it's credited in ⚙️ Settings > Credits and in
// docs/AUDIO-CREDITS.md.
//
// "Gregorian Chant" Kevin MacLeod (incompetech.com)
// Licensed under Creative Commons: By Attribution 4.0 License
// http://creativecommons.org/licenses/by/4.0/
//
// ⚙️ Settings has a 🎵 Music switch and volume slider; the game remembers both.
// Browsers only allow sound after a click or key press, and logging in counts.
import chantUrl from "./music/gregorian-chant.mp3?url";

/** Which song plays in which place (area id). */
const SONGS: Record<string, string> = { lighthall: chantUrl };
const ON_KEY = "rpg.musicOn";
const VOL_KEY = "rpg.musicVolume";
const FADE_S = 2.5;

function load(key: string, fallback: string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function save(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } }

let enabled = load(ON_KEY, "1") === "1";
let volume = Math.min(1, Math.max(0, Number(load(VOL_KEY, "0.5")) || 0.5));
let audio: HTMLAudioElement | undefined;
let song = "";
let want = ""; // the song for where you are ("" for none)
let level = 0; // 0..1 fade

/** You're in this place now (area id), or nowhere (""): its song fades in, the last one fades out. */
export function setMusicPlace(areaId: string) {
  want = SONGS[areaId] ?? "";
}

/** Each frame: fade toward the song for this place. */
export function updateMusic(dt: number) {
  const target = enabled && want ? 1 : 0;
  if (want && want !== song && level <= 0.01) {
    // Swap songs once the old one has faded out.
    audio?.pause();
    audio = new Audio(want);
    audio.loop = true;
    audio.preload = "auto";
    song = want;
  }
  const goal = want === song ? target : 0;
  level += Math.sign(goal - level) * Math.min(Math.abs(goal - level), dt / FADE_S);
  if (!audio) return;
  audio.volume = Math.max(0, Math.min(1, level * volume));
  if (level > 0.001 && audio.paused) audio.play().catch(() => { /* waits for the first click or key */ });
  else if (level <= 0.001 && !audio.paused) audio.pause();
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
