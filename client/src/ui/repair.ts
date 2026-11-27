// The Repairer's window (at the Mages' Guild).
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import type { RepairJob } from "../../../shared/repair";
import { ITEMS } from "../../../shared/items";
import { formatMoney } from "../../../shared/money";
import { el, itemIcon } from "./core";
import { coins } from "./bag";
import { closeShop } from "./shop";
import { closeCraft } from "./craft";
import { closeBounties, closeGuild, closeChest } from "./guild";
import { closeInfo } from "./info";
import { closeDialog } from "./quests";

// ---- The Repairer's window (at the Mages' Guild) ----

const repairBody = document.getElementById("repair-body")!;

const repairAllBtn = document.getElementById("repair-all") as HTMLButtonElement;

let repairActions: { repair: (where: string, key: string | number) => void; repairAll: () => void } = { repair: () => {}, repairAll: () => {} };

export function setRepairActions(actions: typeof repairActions) {
  repairActions = actions;
}

export function closeRepair() {
  document.body.classList.remove("repair-open");
}

/** Everything worn or broken, with what it costs to fix. `open` opens the window (otherwise it only updates if open). */
export function showRepairs(view: { jobs: RepairJob[]; free: boolean; open: boolean }) {
  if (view.open) {
    closeDialog();
    closeShop();
    closeCraft();
    closeBounties();
    closeGuild();
    closeChest();
    closeInfo();
    document.body.classList.add("repair-open");
  }
  if (!document.body.classList.contains("repair-open")) return;
  repairBody.replaceChildren();
  const where = { belt: "on your belt", gear: "you're wearing it", bag: "in your bag" };
  if (!view.jobs.length) {
    repairBody.append(el("", "Nothing needs fixing. Come back when something wears out!"));
  } else {
    // Version 0.22: repairs are magic. Everything from the land holds a little ember, so a spare of the same kind gives its ember to the worn one.
    repairBody.append(el("", "\"Everything that comes from the land holds a little ember, even an old axe. Give me a spare of the same kind and I'll pour its ember into yours. A spare as fine as yours mends it fully; a poorer one only a little.\""));
    const list = el("");
    list.id = "repair-list";
    for (const j of view.jobs) {
      const item = ITEMS[j.item];
      const cost = view.free ? 0 : j.cost;
      const row = el("buy-row" + (!j.spare || coins < cost ? " poor" : ""));
      const b = document.createElement("button");
      b.className = "buy-btn";
      const state = j.durability <= 0 ? "💔 broken" : `${Math.round((j.durability / j.max) * 100)}% left`;
      const kind = j.kind.split(":")[1];
      const using = j.spare ? `uses your ${ITEMS[j.spare.item].single}${j.spare.restores < j.max - Math.max(0, j.durability) ? " (mends it a little)" : ""}` : `needs a spare ${kind}`;
      b.append(itemIcon("buy-icon", j.item), el("buy-name", `${item.short ?? item.name} · ${state} · ${using}`), el("buy-price", !j.spare ? "—" : cost ? formatMoney(cost) : "Free"));
      b.title = `Repair your ${item.single} (${where[j.where]}). ${j.spare ? `Oswin uses up your ${ITEMS[j.spare.item].single}.` : `Bring any ${kind}: a finer one gives more.`}`;
      b.disabled = !j.spare;
      b.onclick = () => repairActions.repair(j.where, j.key);
      row.append(b);
      list.append(row);
    }
    repairBody.append(list);
  }
  const ready = view.jobs.filter((j) => j.spare);
  const total = view.free ? 0 : ready.reduce((sum, j) => sum + j.cost, 0);
  repairAllBtn.disabled = !ready.length;
  repairAllBtn.textContent = ready.length > 1 ? `Repair all (${total ? formatMoney(total) : "free"})` : "Repair all";
}

repairAllBtn.onclick = () => repairActions.repairAll();

document.getElementById("repair-close")!.onclick = closeRepair;
