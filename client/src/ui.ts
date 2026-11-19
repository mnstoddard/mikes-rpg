import { INVENTORY_SIZE, ITEMS, ItemId } from "../../shared/items";
import { MAX_LEVEL, SKILLS, SKILL_IDS, SkillId, SkillXp, emptySkills, levelForXp, xpForLevel } from "../../shared/skills";

const MAX_MESSAGES = 6;
const messagesEl = document.getElementById("messages")!;
const slotsEl = document.getElementById("slots")!;
const hoverEl = document.getElementById("hover")!;
const bagCountEl = document.getElementById("bag-count")!;

const skillListEl = document.getElementById("skill-list")!;

// ---- Side panel tabs (Skills / Inventory): one open at a time, tap again to close ----

type Panel = "inventory" | "skills" | "";
const isSmallScreen = () => matchMedia("(max-width: 640px), (max-height: 500px)").matches;

export function openPanel(panel: Panel) {
  document.body.dataset.panel = panel;
  document.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === panel));
}

document.querySelectorAll<HTMLElement>(".tab").forEach((b) => {
  b.addEventListener("click", () => {
    const tab = b.dataset.tab as Panel;
    openPanel(document.body.dataset.panel === tab ? "" : tab);
  });
});
// Big screens start with the inventory open; phones start with everything closed.
openPanel(isSmallScreen() ? "" : "inventory");

// ---- Skills ----

let lastSkills: SkillXp = emptySkills();

export function renderSkills(skills: SkillXp, flash?: SkillId) {
  lastSkills = skills;
  skillListEl.replaceChildren();
  for (const id of SKILL_IDS) {
    const xp = skills[id] ?? 0;
    const level = levelForXp(xp);
    const start = xpForLevel(level);
    const next = xpForLevel(level + 1);
    const maxed = level >= MAX_LEVEL;
    const pct = maxed ? 100 : Math.floor(((xp - start) / (next - start)) * 100);

    const row = document.createElement("div");
    row.className = "skill" + (flash === id ? " flash" : "");
    row.title = SKILLS[id].description;
    const el = (cls: string, text = "") => {
      const d = document.createElement("div");
      d.className = cls;
      d.textContent = text;
      return d;
    };
    const bar = el("skill-bar");
    const fill = document.createElement("div");
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    row.append(
      el("skill-icon", SKILLS[id].icon),
      el("skill-name", SKILLS[id].name),
      el("skill-level", `Lv ${level}`),
      bar,
      el("skill-xp", maxed ? `${xp.toLocaleString()} XP (max level)` : `${xp.toLocaleString()} / ${next.toLocaleString()} XP · ${(next - xp).toLocaleString()} to go`),
    );
    skillListEl.appendChild(row);
  }
}

export function flashSkill(skill: SkillId) {
  renderSkills(lastSkills, skill);
}

renderSkills(lastSkills);

export function showMessage(text: string) {
  const line = document.createElement("div");
  line.textContent = text;
  messagesEl.appendChild(line);
  while (messagesEl.children.length > MAX_MESSAGES) messagesEl.firstChild!.remove();
}

export function renderInventory(items: (ItemId | null)[], onDrop: (slot: number) => void) {
  slotsEl.replaceChildren();
  const used = items.filter(Boolean).length;
  bagCountEl.textContent = used ? String(used) : "";
  for (let i = 0; i < INVENTORY_SIZE; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    const id = items[i];
    if (id) {
      slot.classList.add("filled");
      slot.textContent = ITEMS[id].icon;
      slot.title = `Drop ${ITEMS[id].name}`;
      slot.onclick = () => onDrop(i);
    }
    slotsEl.appendChild(slot);
  }
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
