// The title screen song: Mike's own music, looping while the login box is up.
//
// Browsers don't let a page start sound by itself until the player has clicked,
// tapped or pressed a key on it. So we try to start right away, and if the
// browser says no, the song starts on the player's first click, tap or key press
// (typing a username counts). The 🔊 / 🔇 button on the login box turns it off
// and on, and the game remembers that choice.
import songUrl from "./audio/title-theme.mp3?url";

const MUTED_KEY = "rpg.titleMusicMuted";
const VOLUME = 0.45; // not too loud: it's background music

let audio: HTMLAudioElement | undefined;
let wanted = false; // true while the login box is showing
let fadeTimer: number | undefined;

function isMuted(): boolean {
  try { return localStorage.getItem(MUTED_KEY) === "1"; } catch { return false; }
}

function setMuted(muted: boolean) {
  try { localStorage.setItem(MUTED_KEY, muted ? "1" : "0"); } catch { /* storage blocked */ }
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(songUrl);
    audio.loop = true;
    audio.preload = "auto";
  }
  return audio;
}

function tryPlay() {
  if (!wanted || isMuted()) return;
  const a = getAudio();
  if (fadeTimer !== undefined) { clearInterval(fadeTimer); fadeTimer = undefined; }
  a.volume = VOLUME;
  if (!a.paused) return;
  a.play().then(stopWaiting, () => waitForFirstTouch());
}

const onFirstTouch = () => tryPlay();
function waitForFirstTouch() {
  window.addEventListener("pointerdown", onFirstTouch, { capture: true });
  window.addEventListener("keydown", onFirstTouch, { capture: true });
}
function stopWaiting() {
  window.removeEventListener("pointerdown", onFirstTouch, { capture: true });
  window.removeEventListener("keydown", onFirstTouch, { capture: true });
}

function updateButton(btn: HTMLButtonElement) {
  const muted = isMuted();
  btn.textContent = muted ? "🔇" : "🔊";
  btn.title = muted ? "Music is off. Tap to turn it on." : "Music is on. Tap to turn it off.";
  btn.setAttribute("aria-label", btn.title);
}

/** Start the song (or get ready to start it on the first click). */
export function startTitleMusic() {
  wanted = true;
  const btn = document.getElementById("title-music") as HTMLButtonElement | null;
  if (btn) {
    updateButton(btn);
    btn.onclick = (e) => {
      e.preventDefault();
      const nowMuted = !isMuted();
      setMuted(nowMuted);
      updateButton(btn);
      if (nowMuted) { audio?.pause(); stopWaiting(); } else tryPlay();
    };
  }
  tryPlay();
}

/** Fade the song out over about a second (when the player has logged in). */
export function stopTitleMusic() {
  wanted = false;
  stopWaiting();
  const a = audio;
  if (!a || a.paused) return;
  if (fadeTimer !== undefined) clearInterval(fadeTimer);
  // Timed by the clock, so the fade still ends on time while the world is loading.
  const from = a.volume, began = performance.now(), FADE_MS = 1200;
  fadeTimer = window.setInterval(() => {
    const left = 1 - (performance.now() - began) / FADE_MS;
    a.volume = Math.max(0, from * left);
    if (left <= 0) {
      clearInterval(fadeTimer);
      fadeTimer = undefined;
      a.pause();
      a.currentTime = 0; // next time the login box shows, start from the beginning
    }
  }, 80);
}
