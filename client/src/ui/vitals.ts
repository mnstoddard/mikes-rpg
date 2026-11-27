// Health, stamina and mana bars, and the hover label.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { MAX_STAMINA, STAMINA_COST } from "../../../shared/cooking";
import { BUFF_IDS, BUFFS } from "../../../shared/alchemy";
import { TITHE_MAX } from "../../../shared/story";
import { el, serverNow, buffs, hoverEl } from "./core";
import { showMessage } from "./messages";
import { renderInfo } from "./info";
import { drawParty } from "./party";

// ---- Stamina bar (top left, always showing) ----

// ---- Health, stamina and mana bars (top left, always showing) ----

export const staminaEl = document.getElementById("stamina")!;

let staminaNow = MAX_STAMINA;

let staminaMax = MAX_STAMINA;

/** Stamina used up for the moment by running (it comes back once you stop). */
let staminaWinded = 0;

export const vitals = { hp: 50, maxHp: 50, mana: 50, maxMana: 50 };

function vitalRow(label: string, now: number, max: number, color: string, title: string, ghost = 0) {
  const row = el("vital");
  row.title = title;
  const bar = el("stamina-bar");
  const fill = document.createElement("div");
  fill.style.width = `${Math.floor(((now - ghost) / max) * 100)}%`;
  fill.style.background = color;
  bar.appendChild(fill);
  // Running: the part you're out of breath for shows faded (it comes back once you stop).
  if (ghost > 0) {
    const back = el("breath");
    back.style.width = `${Math.floor((ghost / max) * 100)}%`;
    bar.appendChild(back);
    now -= ghost;
  }
  row.append(el("stamina-label", `${label} ${now}/${max}`), bar);
  return row;
}

export function renderVitalBars() {
  staminaEl.replaceChildren();
  const c = STAMINA_COST;
  const hpLow = vitals.hp <= vitals.maxHp / 4;
  staminaEl.append(
    vitalRow("❤", vitals.hp, vitals.maxHp, hpLow ? "#ff3b30" : "#d6443a",
      `Health ${vitals.hp} of ${vitals.maxHp}. Monsters take it away. Drink a health potion to get it back (it also comes back 1 a minute). At 0 you wake up at the nearest shrine that can raise you.`),
    vitalRow("⚡", staminaNow, staminaMax, staminaNow < 10 ? "#e74c3c" : staminaNow < 30 ? "#f1c40f" : "#f5c542",
      `Stamina ${staminaNow} of ${staminaMax}. Chopping costs ${c.woodcutting}, mining ${c.mining}, digging ${c.foraging}, smelting ${c.smelting}, smithing ${c.smithing}, cooking ${c.cooking}, fishing ${c.fishing}, each weapon attack ${c.melee}. ` +
      "It comes back 1 every 30 seconds. Eat fish or a meal (click it in your bag) for more. Running (Shift or 🏃) uses it for a moment: stop for a few seconds and it all comes back.", staminaWinded),
    vitalRow("🔮", vitals.mana, vitals.maxMana, "#4a7bd9", `Mana ${vitals.mana} of ${vitals.maxMana}. Spells use it. It comes back 1 every 6 seconds.`),
  );
  // Potion buffs: an icon and the minutes (or seconds) left for each. Tithe marks first.
  const now = serverNow();
  const running = BUFF_IDS.filter((id) => (buffs[id]?.until ?? 0) > now);
  if (running.length || titheMarks) {
    const row = el("buff-row");
    if (titheMarks) {
      const chip = el("buff tithe", `⛓️ ${titheMarks}`);
      chip.title = `Tithe marks: ${titheMarks} of ${TITHE_MAX}. While you carry them, a fifth of the XP you earn goes to the shrine that raised you. Each mark fades once the shrine has had enough. A Tithe tonic clears one at once.`;
      chip.onclick = () => showMessage(chip.title);
      row.appendChild(chip);
    }
    for (const id of running) {
      const left = Math.ceil((buffs[id]!.until - now) / 1000);
      const chip = el("buff", `${BUFFS[id].icon} ${left >= 60 ? `${Math.ceil(left / 60)}m` : `${left}s`}`);
      chip.title = `${BUFFS[id].name}: ${BUFFS[id].describe(buffs[id]!.power)}. ${left >= 60 ? `About ${Math.ceil(left / 60)} minutes` : `${left} seconds`} left.`;
      row.appendChild(chip);
    }
    staminaEl.append(row);
  }
  staminaEl.classList.toggle("hurt", hpLow);
  queueMicrotask(drawParty); // keep the party panel just under the bars (it is set up later in this file)
}

export function renderStamina(stamina: number, max: number, winded = 0) {
  staminaNow = stamina;
  staminaMax = max;
  staminaWinded = Math.max(0, Math.min(stamina, winded));
  renderVitalBars();
  renderInfo(); // the Eat button turns off when you're full
}

let titheMarks = 0;

/** Ember Debt (shared/story.ts): gold links by your health. */
export function setTithe(n: number) {
  titheMarks = n;
  renderVitalBars();
}

export function renderVitals(hp: number, maxHp: number, mana: number, maxMana: number) {
  Object.assign(vitals, { hp, maxHp, mana, maxMana });
  renderVitalBars();
  renderInfo();
}

/** RuneScape-style "Action Target" text next to the cursor. */
export function setHoverText(action: string | null, target = "", x = 0, y = 0) {
  if (!action) { hoverEl.style.display = "none"; return; }
  hoverEl.innerHTML = "";
  hoverEl.append(action + " ");
  const b = document.createElement("b");
  b.textContent = target;
  hoverEl.append(b);
  hoverEl.style.left = `${x + 14}px`;
  hoverEl.style.top = `${y + 14}px`;
  hoverEl.style.display = "block";
}
