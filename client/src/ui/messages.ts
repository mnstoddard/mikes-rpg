// Messages: the last few in the box, and the full log when you tap it.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { NPCS } from "../../../shared/npcs";
import { speakButton, autoSpeak } from "../speech";
import { el } from "./core";
import { closeSettings } from "./settings";

const MAX_MESSAGES = 6;

export const messagesEl = document.getElementById("messages")!;

// ---- Messages: the last few in the box, and every one since you logged in when you tap it ----

const MAX_HISTORY = 500;

/**
 * What kind of message it is, for the message log's filters (Mike's note #14):
 * what people say, party chat, game events (level ups, quests, gifts, news), and warnings.
 */
export type MessageKind = "dialogue" | "chat" | "event" | "warning";

export const history: { at: Date; text: string; kind: MessageKind }[] = [];

const historyList = document.getElementById("history-list")!;

const KIND_LABELS: [MessageKind, string][] = [["dialogue", "💬 Dialogue"], ["chat", "🚩 Chat"], ["event", "⭐ Events"], ["warning", "⚠️ Warnings"]];

const FILTER_KEY = "rpg.logFilters";

const shownKinds = new Set<MessageKind>(KIND_LABELS.map(([k]) => k));

try {
  const saved = JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null");
  if (Array.isArray(saved) && saved.length) { shownKinds.clear(); for (const k of saved) if (KIND_LABELS.some(([id]) => id === k)) shownKinds.add(k); }
} catch { /* storage blocked */ }

const filterBar = document.createElement("div");

filterBar.id = "history-filters";

historyList.before(filterBar);

export function renderFilters() {
  filterBar.replaceChildren();
  for (const [kind, text] of KIND_LABELS) {
    const b = document.createElement("button");
    b.className = "hf-btn" + (shownKinds.has(kind) ? " on" : "");
    b.textContent = text;
    b.title = shownKinds.has(kind) ? "Showing these. Tap to hide them." : "Hidden. Tap to show them.";
    b.onclick = () => {
      if (shownKinds.has(kind)) { if (shownKinds.size > 1) shownKinds.delete(kind); } else shownKinds.add(kind);
      try { localStorage.setItem(FILTER_KEY, JSON.stringify([...shownKinds])); } catch { /* ignore */ }
      renderFilters();
      renderHistory();
    };
    filterBar.append(b);
  }
}

const NPC_NAMES = NPCS.filter((n) => n.kind === "person").map((n) => n.name);

/** Sort a message into one of the log's four kinds. */
function kindOf(text: string): MessageKind {
  if (text.startsWith("🚩")) return "chat";
  if (/^(⚠|❌|🚫|🧭 Not so fast)/u.test(text) || /\b(can't|cannot|too full|not enough|you need|only buys|is locked|isn't ready)\b/i.test(text)) return "warning";
  if (NPC_NAMES.some((n) => text.startsWith(`${n}: `))) return "dialogue";
  return "event";
}

/** Everything someone says in a conversation box goes into the message log too, so it can be read again (Mike's note #13). */
export function logDialogue(name: string, lines: string[]) {
  for (const line of lines) history.push({ at: new Date(), text: `${name}: ${line}`, kind: "dialogue" });
  while (history.length > MAX_HISTORY) history.shift();
  if (document.body.classList.contains("history-open")) renderHistory();
}

/** Chat messages read aloud by themselves (with "Read aloud automatically" on): someone talking, gifts and warnings. (New quest steps are read from the quest box.) */
const SAY_ALOUD = /^(🎁|📍|⚠|❗|🎉|🏅|📖)|^\S*\s?[A-Z][\w' ]{1,28}: /u;

export function showMessage(text: string, kind?: MessageKind) {
  const line = document.createElement("div");
  line.append(speakButton(() => text), text);
  messagesEl.appendChild(line);
  if (SAY_ALOUD.test(text) && !text.startsWith("📜")) autoSpeak(text, true);
  while (messagesEl.children.length > MAX_MESSAGES) messagesEl.firstChild!.remove();
  history.push({ at: new Date(), text, kind: kind ?? kindOf(text) });
  if (history.length > MAX_HISTORY) history.shift();
  if (document.body.classList.contains("history-open")) renderHistory();
}

/** The last few messages, oldest first (for bug reports). */
export function recentMessages(n: number) {
  return history.slice(-n).map((h) => `${h.at.toLocaleTimeString()} ${h.text}`);
}

function renderHistory() {
  // Only jump to the newest message if you were already at the bottom (not while reading back).
  const atBottom = historyList.scrollHeight - historyList.scrollTop - historyList.clientHeight < 30;
  historyList.replaceChildren();
  const shown = history.filter((h) => shownKinds.has(h.kind));
  if (!shown.length) historyList.append(el("", history.length ? "Nothing here with these filters. Tap a filter above to show more." : "No messages yet."));
  for (const h of shown) {
    const row = document.createElement("div");
    const time = document.createElement("span");
    time.className = "h-time";
    time.textContent = h.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const words = h.text;
    row.className = "h-" + h.kind;
    row.append(time, speakButton(() => words), words);
    historyList.appendChild(row);
  }
  if (atBottom || !historyList.dataset.shown) historyList.scrollTop = historyList.scrollHeight;
  historyList.dataset.shown = "1";
}

messagesEl.onclick = () => {
  closeSettings();
  document.body.classList.add("history-open");
  delete historyList.dataset.shown;
  renderHistory();
};

document.getElementById("history-close")!.onclick = () => document.body.classList.remove("history-open");
