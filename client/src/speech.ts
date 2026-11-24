// Read-aloud: the game can say its words out loud, for players who can't read
// (or would rather listen). It uses the browser's own voice (speechSynthesis),
// so it's free and works offline.
//
// - 🔊 buttons (speakButton) sit next to every sentence: what people say, books,
//   the quest you're on and the chat. Tap one to hear it again; tap it while it's
//   talking to stop.
// - "Read aloud automatically" (⚙️ Settings) speaks what people say, books and
//   each new quest step as soon as they appear.

const AUTO_KEY = "rpg.readAloud";
const synth: SpeechSynthesis | undefined = typeof window !== "undefined" ? window.speechSynthesis : undefined;

let auto = false;
try { auto = localStorage.getItem(AUTO_KEY) === "1"; } catch { /* storage blocked */ }

export const canSpeak = () => !!synth;
export const autoRead = () => auto && !!synth;

export function setAutoRead(on: boolean) {
  auto = on;
  try { localStorage.setItem(AUTO_KEY, on ? "1" : "0"); } catch { /* storage blocked */ }
  if (!on) stopSpeaking();
}

/** Words for the ear: no emoji (voices read them out as "red exclamation mark"), and "2 / 3" said as "2 of 3". */
export function forSpeech(text: string): string {
  return text
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 of $2")
    .replace(/(\d)\s*×\s*/g, "$1 ")
    .replace(/[▸◂•·]/g, ", ")
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|️|‍/gu, "")
    .replace(/\s+([,.!?:])/g, "$1")
    .replace(/(^[\s,:]+)|([\s,]+$)/g, "")
    .replace(/\s{2,}/g, " ");
}

let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice;
  const voices = synth?.getVoices() ?? [];
  if (!voices.length) return null; // not loaded yet: try again next time
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  voice = en.find((v) => v.localService && /natural|google|samantha|aria|jenny|daniel/i.test(v.name)) ?? en.find((v) => v.default) ?? en[0] ?? voices[0];
  return voice;
}
synth?.addEventListener?.("voiceschanged", () => { voice = undefined; });

/** What's being said now (so its 🔊 button can show it's talking, and stop it). */
let current: { text: string; button?: HTMLElement } | null = null;

export function stopSpeaking() {
  synth?.cancel();
  current?.button?.classList.remove("speaking");
  current = null;
}

/** Say something out loud (stops whatever was being said). */
export function speak(text: string, button?: HTMLElement) {
  if (!synth) return;
  const words = forSpeech(text);
  stopSpeaking();
  if (!words) return;
  const u = new SpeechSynthesisUtterance(words);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = v?.lang ?? "en-US";
  u.rate = 0.95;
  const mine = { text, button };
  current = mine;
  button?.classList.add("speaking");
  const done = () => { button?.classList.remove("speaking"); if (current === mine) current = null; };
  u.onend = done;
  u.onerror = done;
  synth.speak(u);
}

/** Say it only if "Read aloud automatically" is on. `wait`: let what's being said now finish first, instead of cutting it off. */
export function autoSpeak(text: string, wait = false) {
  if (!autoRead()) return;
  if (!wait || !(synth!.speaking || synth!.pending)) { speak(text); return; }
  const words = forSpeech(text);
  if (!words) return;
  const u = new SpeechSynthesisUtterance(words);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = v?.lang ?? "en-US";
  u.rate = 0.95;
  synth!.speak(u);
}

/** A 🔊 button that reads `text()` out loud (tap again to stop). It doesn't set off whatever it sits on. */
export function speakButton(text: () => string, title = "Read this out loud"): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "speak-btn";
  b.textContent = "🔊";
  b.title = title;
  b.setAttribute("aria-label", title);
  if (!synth) b.style.display = "none";
  const stop = (e: Event) => e.stopPropagation();
  b.addEventListener("pointerdown", stop);
  b.addEventListener("pointerup", stop);
  b.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (current?.button === b) stopSpeaking();
    else speak(text(), b);
  };
  return b;
}
