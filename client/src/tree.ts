// The Mastery skill tree window (rules in shared/skilltree.ts).
//
// Opens from the 🌳 button at the top of the 📊 panel, or the "Skill tree"
// button under any skill. One tab per skill; each upgrade shows its rank, what
// it gives now and at the next rank, and a button to buy the next rank.
// Builds its own window and styles, so it doesn't touch index.html.
import { DISCIPLINES, DISCIPLINE_IDS, SkillId, SkillXp, emptySkills, findSkill, isUnlocked, levelForXp } from "../../shared/disciplines";
import type { ItemMasteryXp } from "../../shared/mastery";
import { TREES, TreeRanks, earnedPoints, nodeEffect, rankCost, spentIn, spentPoints } from "../../shared/skilltree";

let ranks: TreeRanks = {};
let mastery: ItemMasteryXp = {};
let combatMastery: Record<string, number | undefined> = {};
let unlocked: SkillId[] = [];
let skillXp: SkillXp = emptySkills();
let tab: SkillId = "cooking";
let isOpen = false;
let onBuy: (node: string) => void = () => {};
let onReset: (skill: SkillId | null) => void = () => {};

/** Ranks bought, for other screens (pot size, success chances...). */
export const treeRanks = () => ranks;
export const freePoints = () => earnedPoints(mastery, combatMastery) - spentPoints(ranks);

export function setTreeActions(a: { buy: (node: string) => void; reset: (skill: SkillId | null) => void }) {
  onBuy = a.buy;
  onReset = a.reset;
}

/** Keep the numbers the window needs up to date (ui.ts calls this when they change). */
export function setTreeData(d: { ranks?: TreeRanks; mastery?: ItemMasteryXp; combatMastery?: Record<string, number | undefined>; unlocked?: SkillId[]; skillXp?: SkillXp }) {
  if (d.ranks) ranks = d.ranks;
  if (d.mastery) mastery = d.mastery;
  if (d.combatMastery) combatMastery = d.combatMastery;
  if (d.unlocked) unlocked = d.unlocked;
  if (d.skillXp) skillXp = d.skillXp;
  renderButton();
  render();
}

// ---- Window and styles ----

const style = document.createElement("style");
style.textContent = `
  #tree { display: none; left: 50%; top: 10%; transform: translateX(-50%); width: min(380px, calc(100vw - 32px)); padding: 12px 14px; z-index: 6; max-height: calc(100vh - 110px); overflow-y: auto; }
  body.tree-open #tree { display: block; }
  #tree h3 { margin: 0 0 4px; font-size: 16px; color: #ffd84a; font-weight: normal; text-align: center; }
  .tree-points { text-align: center; font-size: 13px; color: #9be28a; margin-bottom: 6px; }
  .tree-note { font-size: 11px; color: #c9bc9c; text-align: center; margin-bottom: 6px; }
  .tree-tabs { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 8px; justify-content: center; }
  .tree-tab { font: inherit; font-size: 12px; padding: 4px 6px; border: 1px solid #6b5a3e; border-radius: 3px; background: rgba(0,0,0,.25); color: #f2e6c9; cursor: pointer; touch-action: manipulation; }
  .tree-tab.active { background: #6e5b3a; color: #fff; border-color: #ffd84a; }
  .tree-tab.locked { opacity: .5; }
  .tree-tab .spent { color: #9be28a; margin-left: 2px; }
  .tree-node { display: grid; grid-template-columns: 30px 1fr auto; gap: 2px 8px; align-items: center; padding: 6px 8px; margin-top: 4px; background: rgba(0,0,0,.25); border-radius: 3px; }
  .tree-node.maxed { outline: 1px solid #ffd84a; }
  .tree-icon { font-size: 20px; grid-row: 1 / 4; text-align: center; }
  .tree-name { color: #fff; font-size: 14px; }
  .tree-pips { color: #ffd84a; font-size: 12px; letter-spacing: 2px; }
  .tree-now { grid-column: 2 / 4; font-size: 12px; color: #9be28a; }
  .tree-next { grid-column: 2 / 4; font-size: 12px; color: #c9bc9c; }
  .tree-node .shop-btn { grid-row: 1 / 2; grid-column: 3; padding: 4px 10px; font-size: 13px; flex: none; }
  #tree .buttons { display: flex; gap: 6px; margin-top: 8px; }
  #tree-open { font: inherit; font-size: 12px; margin-left: 6px; padding: 1px 6px; border: 1px solid #6b5a3e; border-radius: 3px; background: #5a4a2f; color: #fff; cursor: pointer; }
  #tree-open.has-points { background: #3d6b2f; border-color: #9be28a; }
  .tree-skill-btn { font: inherit; font-size: 12px; margin-top: 4px; padding: 3px 8px; border: 1px solid #6b5a3e; border-radius: 3px; background: #5a4a2f; color: #fff; cursor: pointer; }
  @media (max-width: 640px), (max-height: 500px) {
    #tree { top: calc(56px + env(safe-area-inset-top)); padding: 8px 10px; max-height: 60vh; }
  }
`;
document.head.appendChild(style);

const win = document.createElement("div");
win.id = "tree";
win.className = "panel";
document.body.appendChild(win);

// The 🌳 button at the top of the Skills (📊) panel, showing points to spend.
const openBtn = document.createElement("button");
openBtn.id = "tree-open";
openBtn.title = "Mastery skill trees: spend Mastery points on upgrades";
openBtn.onclick = (e) => { e.stopPropagation(); openTree(); };
document.querySelector("#skills h3")?.appendChild(openBtn);

function renderButton() {
  const free = freePoints();
  openBtn.textContent = `🌳 ${free}`;
  openBtn.classList.toggle("has-points", free > 0);
  openBtn.title = `Mastery skill trees: ${free} point${free === 1 ? "" : "s"} to spend`;
}

/** A "🌳 Skill tree" button for under a skill in the Skills panel. */
export function treeButton(skill: SkillId): HTMLElement {
  const b = document.createElement("button");
  b.className = "tree-skill-btn";
  const spent = spentIn(ranks, skill);
  b.textContent = `🌳 Skill tree${spent ? ` (${spent} spent)` : ""}`;
  b.onclick = (e) => { e.stopPropagation(); openTree(skill); };
  return b;
}

export function openTree(skill?: SkillId) {
  if (skill) tab = skill;
  isOpen = true;
  document.body.classList.add("tree-open");
  render();
}

export function closeTree() {
  isOpen = false;
  document.body.classList.remove("tree-open");
}

const div = (cls: string, text = "") => {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  return d;
};

function button(text: string, action: () => void, disabled = false, cls = "shop-btn") {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = text;
  b.disabled = disabled;
  b.onclick = action;
  return b;
}

function render() {
  if (!isOpen) return;
  const free = freePoints();
  const earned = earnedPoints(mastery, combatMastery);
  win.replaceChildren();
  const h = document.createElement("h3");
  h.textContent = "🌳 Mastery skill trees";
  win.append(h,
    div("tree-points", `${free} Mastery point${free === 1 ? "" : "s"} to spend (${earned} earned)`),
    div("tree-note", "You earn 1 point every time any Mastery goes up a level. Spend them in any skill's tree. Rank 1 costs 1, rank 2 costs 2, rank 3 costs 3. Resetting is free for now."));

  // One tab per skill, grouped by Discipline.
  const tabs = div("tree-tabs");
  for (const d of DISCIPLINE_IDS) {
    for (const s of DISCIPLINES[d].skills) {
      const open = isUnlocked(unlocked, s.id);
      const spent = spentIn(ranks, s.id);
      const t = button("", () => { tab = s.id; render(); }, false, "tree-tab" + (tab === s.id ? " active" : "") + (open ? "" : " locked"));
      t.textContent = `${s.icon} ${s.name}`;
      if (spent) {
        const sp = document.createElement("span");
        sp.className = "spent";
        sp.textContent = `·${spent}`;
        t.appendChild(sp);
      }
      t.title = open ? `${s.name} tree` : `${s.name}: not learned yet (you can still plan its tree)`;
      tabs.appendChild(t);
    }
  }
  win.appendChild(tabs);

  const { def } = findSkill(tab);
  for (const n of TREES[tab]) {
    const rank = ranks[n.id] ?? 0;
    const maxed = rank >= n.maxRank;
    const cost = rankCost(rank + 1);
    const row = div("tree-node" + (maxed ? " maxed" : ""));
    row.append(div("tree-icon", n.icon), div("tree-name", n.name));
    row.append(button(maxed ? "Max" : `+1 (${cost} pt${cost === 1 ? "" : "s"})`, () => onBuy(n.id), maxed || free < cost));
    const pips = div("tree-pips", "●".repeat(rank) + "○".repeat(n.maxRank - rank) + ` rank ${rank}/${n.maxRank}`);
    pips.style.gridColumn = "2 / 4";
    row.append(pips);
    row.append(div("tree-now", rank ? `Now: ${nodeEffect(n, rank, def.name)}` : "Not bought yet"));
    if (!maxed) row.append(div("tree-next", `Rank ${rank + 1}: ${nodeEffect(n, rank + 1, def.name)}`));
    win.appendChild(row);
  }

  const buttons = div("buttons");
  buttons.append(
    button(`Reset ${def.name}`, () => onReset(tab), !spentIn(ranks, tab)),
    button("Reset all", () => onReset(null), !spentPoints(ranks)),
    button("Close", closeTree),
  );
  win.appendChild(buttons);
}

renderButton();
