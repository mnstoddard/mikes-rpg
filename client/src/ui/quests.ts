// The quest tracker, the 📜 Quests tab, lessons and the conversation box.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { type QuestView, type ChapterView, chapterById } from "../../../shared/quests";
import { ItemId, ITEMS } from "../../../shared/items";
import { Bounty, slotCounts, bountyReward } from "../../../shared/bounties";
import { isTool } from "../../../shared/tools";
import { isGear } from "../../../shared/gear";
import { speakButton, autoSpeak, stopSpeaking } from "../speech";
import { RANKS as LIGHT_RANKS } from "../../../shared/story";
import { formatMoney } from "../../../shared/money";
import { openPanel, el, icon, renownLv } from "./core";
import { lastMastery } from "./skills";
import { logDialogue } from "./messages";
import { invItems, locked, durability, countAt, renderInventory } from "./bag";
import { closeRepair } from "./repair";
import { closeShop } from "./shop";
import { closeCraft } from "./craft";
import { bounties, closeBounties, closeGuild, closeChest } from "./guild";
import { closeInfo } from "./info";

// ---- The quest tracker and the trainers' dialog ----

// ---- The quest tracker (next to your health) and the 📜 Quests tab ----
// The tracker shows one thing: the current lesson's step, or a bounty you picked in the Quests tab.

const questEl = document.getElementById("quest")!;

const questListEl = document.getElementById("quest-list")!;

let lastQuest: QuestView | null = null;

/** The tracked bounty's item, or null for Maren's quest. */
let trackedItem: ItemId | null = null;

/** After signing out: no quest or tracked item from the last character. */
export function forgetQuest() { trackedItem = null; lastQuest = null; }

let onTrack: (bounty: number | null) => void = () => {};

export function setQuestActions(actions: { track: (bounty: number | null) => void }) {
  onTrack = actions.track;
}

questEl.onclick = () => openPanel(document.body.dataset.panel === "quests" ? "" : "quests");

/** How many of a bounty's items you have that count (unlocked, unused). */
const bountyHave = (b: Bounty) => invItems.reduce((sum, id, i) => sum + (slotCounts(b.item, id, !!locked[i], durability[i]) ? countAt(i) : 0), 0);

const trackedBounty = () => bounties.find((b) => b.item === trackedItem) ?? null;

export function renderTracked(item: ItemId | null) {
  trackedItem = item;
  renderTracker();
}

export function renderQuest(q: QuestView, flash = false) {
  const wasLocked = !!lastQuest?.robeLock?.length;
  lastQuest = q;
  document.body.classList.toggle("robe-lock", !!q.robeLock?.length);
  document.body.classList.toggle("run-lesson", !!q.runLesson);
  renderTracker(flash);
  if (wasLocked || q.robeLock?.length) renderInventory(); // the robe pieces glow (or stop glowing)
}

// ---- The robe step at the very start (version 0.21, Mike's notes): one click at a time ----
// The screen goes dim except for a spotlight on the one thing to click: the dialog's Next button while Celene
// talks, then the 🎒 bag, then the robe piece, then its Equip button. Nothing else works (no walking, no camera,
// no other panels) until that click. The server refuses walking too.

/** Still to put on (item id prefixes), while the very first quest's robe step is on. */
const robeLeft = () => lastQuest?.robeLock ?? [];

export const isRobePiece = (id: string) => robeLeft().some((pre) => id.startsWith(pre));

/** The one thing that can be clicked right now, or null (no lesson on, or the opening scene is playing). */
function lessonTarget(): HTMLElement | null {
  if (!robeLeft().length || document.body.classList.contains("intro-on") || document.getElementById("creator")) return null;
  const vis = (q: string) => { const e = document.querySelector<HTMLElement>(q); return e && e.offsetParent ? e : null; };
  if (document.body.classList.contains("dialog-open")) return vis("#dialog-next");
  if (document.body.classList.contains("info-open")) return vis("#info-buttons .robe-glow") ?? vis("#info-buttons button:last-child");
  if (document.body.dataset.panel === "inventory") return vis("#slots .slot.robe-glow") ?? vis("#bag-tab");
  return vis("#bag-tab");
}

function robeBlock(e: Event) {
  if (!robeLeft().length) return;
  const t = e.target as Element | null;
  if (t?.closest?.("#intro-skip, #creator")) return;
  const target = lessonTarget();
  if (target && t && target.contains(t)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (target && (e.type === "pointerdown" || e.type === "keydown")) {
    target.classList.remove("wobble");
    void target.offsetWidth;
    target.classList.add("wobble");
  }
}

for (const type of ["pointerdown", "pointerup", "pointermove", "click", "dblclick", "wheel", "touchstart", "touchmove", "contextmenu"]) window.addEventListener(type, robeBlock, { capture: true, passive: false });

for (const type of ["keydown", "keyup"]) window.addEventListener(type, (e) => {
  const k = e as KeyboardEvent;
  if (!robeLeft().length || (k.target as Element | null)?.closest?.("input, textarea, #creator")) return;
  // Enter and Space still turn the dialog's pages; every other key waits (and letting go of a key is always fine).
  if (type === "keyup" || (document.body.classList.contains("dialog-open") && (k.key === "Enter" || k.key === " "))) return;
  robeBlock(e);
}, { capture: true });

// The dim screen with its spotlight, following the target as panels open and close.
const spot = document.createElement("div");

spot.id = "lesson-spot";

document.body.appendChild(spot);

(function followSpot() {
  const t = lessonTarget();
  document.body.classList.toggle("lesson-dim", !!t);
  if (t) {
    const r = t.getBoundingClientRect();
    spot.style.left = `${r.left - 6}px`; spot.style.top = `${r.top - 6}px`;
    spot.style.width = `${r.width + 12}px`; spot.style.height = `${r.height + 12}px`;
  }
  requestAnimationFrame(followSpot);
})();

function bar(fraction: number) {
  const b = el("q-bar");
  const fill = document.createElement("div");
  fill.style.width = `${Math.floor(Math.min(1, fraction) * 100)}%`;
  b.appendChild(fill);
  return b;
}

/** The quest said in words: what to do, and what's wrong first. */
function questWords(q: QuestView) {
  const who = q.giver ? `${q.quest}, from ${q.giver}.` : `${q.quest}.`;
  const left = q.checklist?.filter((c) => !c.done).map((c) => c.label);
  return [who, q.warning ?? "", `${q.task}.`, left?.length ? `Still to do: ${left.join(", ")}.` : q.progress ? `${q.progress}.` : ""].filter(Boolean).join(" ").replace(/\.\./g, ".");
}

let spokenQuest: string | null = null;

/** The picture checklist: 🐟 1 / 3, then ✓ once you have them all. */
function needPictures(need: NonNullable<QuestView["need"]>) {
  const box = el("q-need");
  for (const n of need) {
    const done = n.have >= n.want;
    const chip = el("q-chip" + (done ? " done" : ""));
    chip.append(icon("q-pic", n.icon, n.tint));
    chip.append(el("q-count", done ? (n.want > 1 ? `${n.want} ✓` : "✓") : n.want > 1 ? `${n.have} / ${n.want}` : "☐"));
    box.append(chip);
  }
  return box;
}

export function renderTracker(flash = false) {
  if (document.body.dataset.panel === "quests") renderQuestTab();
  const b = trackedBounty();
  const q = lastQuest;
  if (!b && !q) return;
  document.body.classList.add("has-quest");
  questEl.replaceChildren();
  if (b) {
    const have = bountyHave(b);
    const item = ITEMS[b.item];
    questEl.append(el("q-title", "📋 Bounty"), el("q-task", `${b.count} × ${item.name}${isTool(b.item) || isGear(b.item) ? " (unused)" : ""}`),
      el("q-progress", have >= b.count ? `✓ ${b.count} / ${b.count}: hand it in at the board!` : `${have} / ${b.count}`), bar(have / b.count));
  } else if (q) {
    const title = el("q-title", q.done || !q.giver ? `📜 ${q.quest}` : `📜 ${q.quest} · ${q.giver}`);
    title.prepend(speakButton(() => questWords(q), "Read the quest out loud"));
    questEl.append(title, el("q-task", (q.talk ? "❗ " : "") + q.task));
    if (q.warning) questEl.append(el("q-warn", `⚠️ ${q.warning}`));
    // Steps done in any order show a checklist, ticked as you go (version 0.21).
    if (q.checklist?.length) {
      const box = el("q-check");
      for (const c of q.checklist) box.append(el(c.done ? "done" : "", c.label));
      questEl.append(box);
    } else if (q.need?.length) questEl.append(needPictures(q.need));
    else if (q.progress) questEl.append(el("q-progress", q.progress));
    if (q.fraction != null) questEl.append(bar(q.fraction));
    // A new step (or a new warning) is read out by itself.
    const key = `${q.quest}|${q.task}|${q.warning ?? ""}`;
    if (key !== spokenQuest) {
      autoSpeak(questWords(q), true);
      spokenQuest = key;
    }
  }
  if (bounties.length) questEl.append(el("q-switch", "Tap to switch quest or bounty"));
  if (flash) {
    questEl.classList.remove("flash");
    void questEl.offsetWidth; // restart the animation
    questEl.classList.add("flash");
  }
}

/** Which 📜 tab is open (version 0.22, Mike's note): the main quest, side quests, or finished ones. */
let questTabAt: "main" | "side" | "done" = "main";

/** Which finished quest's recap is open in the ✅ tab. */
let questRecap: string | null = null;

/**
 * The 📜 tab (version 0.22, Mike's note: it was bigger than a phone screen and too busy).
 * Three tabs: 📍 Main quest (what you're on, and the story), ⭐ Side quests (trainers'
 * lessons, side quests and bounties) and ✅ Done (tap one for a recap, like a little wiki).
 * Quests you haven't found yet stay hidden: people with a ❗ over their heads have them.
 */
export function renderQuestTab() {
  questListEl.replaceChildren();
  const row = (glyph: string, tint: string | undefined, title: string, sub: string, state: string, tracked: boolean, onclick: () => void) => {
    const r = el("qt-row" + (tracked ? " tracked" : ""));
    r.append(speakButton(() => `${title}. ${sub}. ${state}`), icon("qt-icon", glyph, tint), el("qt-title", title), el("qt-sub", sub), el("qt-state", tracked ? "📍 Tracking" : state));
    r.title = tracked ? "Showing next to your health" : "Tap to track this";
    r.onclick = onclick;
    return r;
  };
  const tb = trackedBounty();
  const q = lastQuest;
  const glyph: Record<ChapterView["state"], string> = { done: "✅", active: "📍", started: "⏸️", open: "❗", locked: "🔒" };
  const subOf = (c: ChapterView) =>
    c.state === "done" ? "Tap for a recap"
      : c.task ? `${c.task} (step ${c.step + 1} of ${c.of})`
        : `❗ Talk to ${c.name}, ${c.where}`;
  const chapterRow = (c: ChapterView) => {
    const sub = subOf(c);
    const r = el("qt-row qt-chapter" + (c.state === "done" ? " done" : c.state === "open" ? " open" : ""));
    r.append(speakButton(() => `${c.title}, from ${c.name}. ${sub}.`), el("qt-icon", glyph[c.state]), el("qt-title", `${c.title} · ${c.name}`), el("qt-sub", sub));
    return r;
  };

  // The tabs.
  const chapters = q?.chapters ?? [];
  const found = (c: ChapterView) => c.state === "active" || c.state === "started";
  const sideNow = chapters.filter((c) => !c.act && found(c));
  const doneAll = chapters.filter((c) => c.state === "done");
  const tabs = el("qt-tabs");
  const tabBtn = (id: typeof questTabAt, label: string) => {
    const b = document.createElement("button");
    b.className = "qt-tab" + (questTabAt === id ? " on" : "");
    b.textContent = label;
    b.onclick = () => { questTabAt = id; questRecap = null; renderQuestTab(); };
    tabs.append(b);
  };
  tabBtn("main", "📍 Main");
  tabBtn("side", `⭐ Side${sideNow.length + bounties.length ? ` (${sideNow.length + bounties.length})` : ""}`);
  tabBtn("done", `✅ Done${doneAll.length ? ` (${doneAll.length})` : ""}`);
  questListEl.append(tabs);

  if (questTabAt === "main") {
    if (!q) return;
    // What you're on (tap to show it by your health again).
    questListEl.append(row("📜", undefined, q.giver ? `${q.quest} · ${q.giver}` : q.quest, q.task, q.progress ?? (q.done ? "" : "Tap to track"), !tb, () => onTrack(null)));
    // The story: chapters you're on, and the next one (the main quest always shows the way).
    const story = chapters.filter((c) => c.act && c.state !== "done" && c.state !== "locked");
    const rank = LIGHT_RANKS[q.rank ?? 0];
    questListEl.append(el("qt-head", `✨ The story · ${rank}`));
    for (const c of story) questListEl.append(chapterRow(c));
    if (!story.length) questListEl.append(el("qt-note", "More of the story opens up as you go."));
    return;
  }

  if (questTabAt === "side") {
    // Only what you've found: lessons and side quests you've started.
    for (const c of sideNow) questListEl.append(chapterRow(c));
    if (bounties.length) {
      questListEl.append(el("qt-head", "📋 Bounties"));
      bounties.forEach((b, i) => {
        const item = ITEMS[b.item];
        const have = bountyHave(b);
        const reward = bountyReward(b, lastMastery, renownLv());
        questListEl.append(row(item.icon, item.tint, `${b.count} × ${item.name}`, `${formatMoney(reward.coins)} · +${reward.renown} Renown`,
          have >= b.count ? "✓ Ready to hand in" : `You have ${have} / ${b.count}`, tb === b, () => onTrack(i)));
      });
      questListEl.append(el("qt-note", "Hand bounties in at the board in the town square, next to Captain Bryn."));
    }
    if (!sideNow.length && !bounties.length) questListEl.append(el("qt-note", "No side quests yet."));
    questListEl.append(el("qt-note", "Look for people with a ❗ over their heads: they have something for you."));
    return;
  }

  // ✅ Done: tap one to read back what happened.
  if (!doneAll.length) { questListEl.append(el("qt-note", "Nothing finished yet. Quests you finish go here, so you can look back at them.")); return; }
  for (const c of [...doneAll].reverse()) {
    const r = chapterRow(c);
    r.classList.add("qt-recap-row");
    r.onclick = () => { questRecap = questRecap === c.id ? null : c.id; renderQuestTab(); };
    questListEl.append(r);
    if (questRecap !== c.id) continue;
    const ch = chapterById(c.id);
    const box = el("qt-recap");
    box.append(el("qt-recap-where", `${ch.name}, ${ch.where}`));
    const list = el("qt-recap-steps");
    for (const st of ch.steps) {
      list.append(el("qt-recap-step", `✓ ${st.task}`));
      const said = [...(st.lines ?? []), ...Object.values(st.visitLines ?? {}).flat()];
      if (said.length) list.append(el("qt-recap-said", `“${said.join(" ")}”`));
    }
    box.append(list);
    questListEl.append(box);
  }
}

const dialogName = document.getElementById("dialog-name")!;

const dialogText = document.getElementById("dialog-text")!;

const dialogPage = document.getElementById("dialog-page")!;

const dialogNext = document.getElementById("dialog-next") as HTMLButtonElement;

let dialogLines: string[] = [];

let dialogAt = 0;

/** Show what someone says, one paragraph at a time (Next, then OK). */
export function openDialog(name: string, lines: string[]) {
  if (!lines.length) return;
  closeShop();
  closeRepair();
  closeBounties();
  closeCraft();
  closeGuild();
  closeChest();
  closeInfo();
  dialogLines = lines;
  dialogAt = 0;
  dialogName.textContent = name;
  logDialogue(name, lines);
  document.body.classList.add("dialog-open");
  renderDialog();
}

function renderDialog() {
  dialogText.textContent = dialogLines[dialogAt];
  // The first page waits for anything already being said (like what you were just given); Next cuts in.
  if (dialogAt === 0) autoSpeak(`${dialogName.textContent}. ${dialogLines[0]}`, true);
  else autoSpeak(dialogLines[dialogAt]);
  dialogPage.textContent = dialogLines.length > 1 ? `${dialogAt + 1} / ${dialogLines.length}` : "";
  dialogNext.textContent = dialogAt < dialogLines.length - 1 ? "Next ▸" : "OK";
}

dialogNext.onclick = () => {
  if (dialogAt < dialogLines.length - 1) { dialogAt++; renderDialog(); } else closeDialog();
};

document.getElementById("dialog-speak")?.replaceWith(Object.assign(speakButton(() => dialogLines[dialogAt] ?? "", "Read this out loud again"), { id: "dialog-speak" }));

export function closeDialog() {
  if (document.body.classList.contains("dialog-open")) stopSpeaking();
  document.body.classList.remove("dialog-open");
}
