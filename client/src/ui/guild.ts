// The bounty board, the Mages' Guild and the enchanted chest.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { Bounty, slotCounts, bountyReward } from "../../../shared/bounties";
import { ITEMS } from "../../../shared/items";
import { isTool, maxDurability } from "../../../shared/tools";
import { isGear } from "../../../shared/gear";
import { formatMoney } from "../../../shared/money";
import { GuildView, rankFor, RANKS, expandCost, CHEST_RENT, CHEST_STEP, CHEST_START, GuildBounty, guildReward, isJob, jobIcon, guildBountyName } from "../../../shared/guild";
import { MONSTERS as MONSTER_DEFS } from "../../../shared/combat";
import { Bag, emptyBag, usedSlots, entriesIn, slotTotal } from "../../../shared/bag";
import { gearDurability } from "../../../shared/crafting";
import { isSmallScreen, openPanel, el, renownLv, itemIcon, icon } from "./core";
import { lastMastery } from "./skills";
import { invItems, locked, durability, countAt, coins, renderInventory, durabilityBar, countBadge } from "./bag";
import { closeShop, closeAmount, askAmount } from "./shop";
import { closeCraft } from "./craft";
import { closeInfo } from "./info";
import { renderTracker, closeDialog } from "./quests";

// ---- Bounty board: 5 jobs, hand in the full amount for double a shop's price plus XP ----

const bountyList = document.getElementById("bounty-list")!;

export let bounties: Bounty[] = [];

/** After signing out: the next character starts with no bounties showing. */
export function forgetBounties() { bounties = []; }

let onHandIn: (index: number) => void = () => {};

let onRefreshBounties: () => void = () => {};

const bountyIsOpen = () => document.body.classList.contains("bounty-open");

export function setBountyActions(actions: { handIn: (index: number) => void; refresh: () => void }) {
  onHandIn = actions.handIn;
  onRefreshBounties = actions.refresh;
}

/** The server sent the board's bounties. `open`: the player just clicked the board. */
export function showBounties(list: Bounty[], open: boolean) {
  bounties = list;
  renderTracker();
  if (open) {
    closeShop();
    closeCraft();
    closeGuild();
    closeChest();
    closeInfo();
    closeDialog();
    document.body.classList.add("bounty-open");
    if (!isSmallScreen()) openPanel("inventory"); // see what you're carrying (on phones it would cover the board)
  }
  renderBounties();
}

export function closeBounties() {
  document.body.classList.remove("bounty-open");
}

export function renderBounties() {
  if (!bountyIsOpen()) return;
  bountyList.replaceChildren();
  if (!bounties.length) bountyList.append(el("bounty-note", "No one needs anything right now. Try Refresh."));
  bounties.forEach((b, index) => {
    const item = ITEMS[b.item];
    const have = invItems.reduce((sum, id, i) => sum + (slotCounts(b.item, id, !!locked[i], durability[i]) ? countAt(i) : 0), 0);
    const ready = have >= b.count;
    const reward = bountyReward(b, lastMastery, renownLv());
    const row = el("bounty-row" + (ready ? " ready" : ""));
    const btn = document.createElement("button");
    btn.className = "shop-btn";
    btn.textContent = "Hand in";
    btn.disabled = !ready;
    btn.title = ready ? `Hand in ${b.count} ${item.name.toLowerCase()}` : `You need ${b.count - have} more`;
    btn.onclick = () => onHandIn(index);
    const unused = isTool(b.item) || isGear(b.item) ? " (unused)" : "";
    row.append(itemIcon("bounty-icon", b.item), el("bounty-what", `${b.count} × ${item.name}${unused}`), btn,
      el("bounty-have", `You have ${Math.min(have, b.count)} / ${b.count}`),
      el("bounty-reward", `Reward: ${formatMoney(reward.coins)} · +${reward.xp} ${reward.label} XP · +${reward.renown} Renown XP`));
    bountyList.appendChild(row);
  });
}

document.getElementById("bounty-refresh")!.onclick = () => onRefreshBounties();

document.getElementById("bounty-close")!.onclick = closeBounties;

// ---- The Mages' Guild: rank, renting the enchanted chest, and magic bounties (rules in shared/guild.ts) ----

const guildBody = document.getElementById("guild-body")!;

let guild: GuildView | null = null;

let onBuySpace: () => void = () => {};

export let onDeposit: (slot: number, count?: number) => void = () => {};

let onWithdraw: (slot: number, count?: number) => void = () => {};

let onGuildHandIn: (index: number) => void = () => {};

let onRefreshGuild: () => void = () => {};

const guildIsOpen = () => document.body.classList.contains("guild-open");

export const chestIsOpen = () => document.body.classList.contains("chest-open");

export function setGuildActions(actions: {
  buySpace: () => void; deposit: (slot: number, count?: number) => void; withdraw: (slot: number, count?: number) => void;
  handIn: (index: number) => void; refresh: () => void;
}) {
  onBuySpace = actions.buySpace;
  onDeposit = actions.deposit;
  onWithdraw = actions.withdraw;
  onGuildHandIn = actions.handIn;
  onRefreshGuild = actions.refresh;
}

/** The server sent the guild's state. `open`: the player just clicked the Archmage or the guild board. */
export function showGuild(g: GuildView, open: boolean) {
  guild = g;
  if (open) {
    closeShop();
    closeCraft();
    closeBounties();
    closeChest();
    closeInfo();
    closeDialog();
    document.body.classList.add("guild-open");
    if (!isSmallScreen()) openPanel("inventory");
  }
  renderGuild();
}

export function closeGuild() {
  document.body.classList.remove("guild-open");
}

export function renderGuild() {
  if (!guildIsOpen() || !guild) return;
  const g = guild;
  guildBody.replaceChildren();

  // Rank: points and what the next rank needs.
  const rank = rankFor(g.points);
  const next = RANKS[rank + 1];
  const rankBox = el("guild-rank");
  rankBox.append(el("guild-rank-name", `Rank: ${RANKS[rank].name}`),
    el("bounty-note", next ? `${g.points} guild points · ${next.name} at ${next.points}` : `${g.points} guild points · the highest rank`));
  if (next) {
    const bar = el("q-bar");
    const fill = document.createElement("div");
    const from = RANKS[rank].points;
    fill.style.width = `${Math.floor(((g.points - from) / (next.points - from)) * 100)}%`;
    bar.appendChild(fill);
    rankBox.appendChild(bar);
  }
  guildBody.appendChild(rankBox);

  // The chest: rent it, or buy more space (as much as your rank allows).
  const chestBox = el("guild-section");
  chestBox.append(el("guild-head", "📦 Enchanted chest"));
  const size = g.chestSize;
  const cost = size ? expandCost(size) : CHEST_RENT;
  const nextSize = size ? size + CHEST_STEP : CHEST_START;
  const btn = document.createElement("button");
  btn.className = "shop-btn";
  if (!size) {
    chestBox.append(el("bounty-note", `Rent ${CHEST_START} spaces for ${formatMoney(CHEST_RENT)}. Each space holds a whole stack. Open it from any enchanted chest: here, at the inn, on the coast, at the farm or in the Dark Forest.`));
    btn.textContent = `Rent (${formatMoney(CHEST_RENT)})`;
  } else {
    chestBox.append(el("bounty-note", `You have ${size} spaces.` + (cost == null ? " That's as big as they get." : "")));
    btn.textContent = cost == null ? "Full size" : `+${CHEST_STEP} spaces (${formatMoney(cost)})`;
  }
  const allowed = RANKS[rank].maxChest;
  if (cost != null && nextSize > allowed) {
    const need = RANKS.find((r) => r.maxChest >= nextSize)!;
    chestBox.append(el("craft-warn", `${/^[AEIOU]/.test(RANKS[rank].name) ? "An" : "A"} ${RANKS[rank].name} may rent up to ${allowed} spaces. Reach ${need.name} for more.`));
    btn.disabled = true;
  } else if (cost != null && coins < cost) {
    chestBox.append(el("craft-warn", `You have ${formatMoney(coins)}.`));
    btn.disabled = true;
  }
  if (cost == null) btn.disabled = true;
  btn.onclick = () => onBuySpace();
  chestBox.appendChild(btn);
  guildBody.appendChild(chestBox);

  // Magic bounties.
  const list = el("guild-section");
  list.append(el("guild-head", "📜 Guild bounties"),
    el("bounty-note", "Defeat monsters with spells (hold a staff), bring things the guild enchants with, trap ember, brew potions or enchant things. Each one earns guild points. New jobs every day."));
  g.bounties.forEach((b, index) => list.appendChild(guildBountyRow(b, index)));
  guildBody.appendChild(list);
}

function guildBountyRow(b: GuildBounty, index: number) {
  const reward = guildReward(b);
  const icon_ = isJob(b) ? jobIcon(b.kind) : b.kind === "slay" ? MONSTER_DEFS[b.monster].icon : ITEMS[b.item].icon;
  const tint = b.kind === "reagent" ? ITEMS[b.item].tint : undefined;
  let done: number;
  let ready = false;
  const row = el("bounty-row");
  const btn = document.createElement("button");
  btn.className = "shop-btn";
  if (b.kind === "slay" || isJob(b)) {
    done = b.progress;
    btn.textContent = "🔮";
    btn.disabled = true;
    btn.title = b.kind === "slay" ? "Counts up by itself each time you defeat one with a spell." : "Counts up by itself as you go.";
  } else {
    done = invItems.reduce((sum, id, i) => sum + (id === b.item && !locked[i] ? countAt(i) : 0), 0);
    ready = done >= b.count;
    btn.textContent = "Hand in";
    btn.disabled = !ready;
    btn.onclick = () => onGuildHandIn(index);
  }
  if (ready) row.classList.add("ready");
  row.append(icon("bounty-icon", icon_, tint), el("bounty-what", guildBountyName(b)), btn,
    el("bounty-have", `${b.kind === "reagent" ? "You have" : "Done"} ${Math.min(done, b.count)} / ${b.count}`),
    el("bounty-reward", `Reward: +${reward.points} guild point${reward.points === 1 ? "" : "s"} · ${formatMoney(reward.coins)} · +${reward.magicXp} Spellcasting XP`));
  return row;
}

document.getElementById("guild-refresh")!.onclick = () => onRefreshGuild();

document.getElementById("guild-close")!.onclick = closeGuild;

// ---- Enchanted chest window: tap a stack in your bag to put it in, tap one here to take it out ----

const chestSlotsEl = document.getElementById("chest-slots")!;

const chestTitle = document.getElementById("chest-title")!;

let chest: Bag = emptyBag(0);

export function showChest(c: typeof chest, open: boolean) {
  chest = c;
  if (open) {
    closeShop();
    closeCraft();
    closeBounties();
    closeGuild();
    closeInfo();
    closeDialog();
    document.body.classList.add("chest-open");
    openPanel("inventory"); // so you can tap your items, on phones too
    renderInventory();
  }
  renderChest();
}

export function closeChest() {
  if (!chestIsOpen()) return;
  document.body.classList.remove("chest-open");
  closeAmount();
  renderInventory();
}

function renderChest() {
  if (!chestIsOpen()) return;
  chestTitle.textContent = `📦 Enchanted chest (${usedSlots(chest)}/${chest.slotCount})`;
  chestSlotsEl.replaceChildren();
  for (let i = 0; i < chest.slotCount; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    const here = entriesIn(chest, i);
    if (here.length) {
      const top = here[0];
      const id = chest.inventory[top]!;
      const item = ITEMS[id];
      const n = slotTotal(chest, i);
      slot.classList.add("filled");
      if (here.length > 1) slot.classList.add("mixed");
      slot.appendChild(itemIcon("item-icon", id));
      if (isTool(id)) slot.appendChild(durabilityBar(chest.durability[top] ?? maxDurability(id), maxDurability(id)));
      if (isGear(id)) slot.appendChild(durabilityBar(chest.durability[top] ?? gearDurability(id), gearDurability(id)));
      if (n > 1) slot.appendChild(countBadge(n));
      slot.title = `Take out ${here.length > 1 ? `all ${n} (${here.length} kinds)` : n > 1 ? `${n} ${item.name.toLowerCase()}` : item.single}`;
      slot.onclick = () => {
        if (here.length === 1 && n > 1) return askAmount({ title: `Take out ${item.name.toLowerCase()}`, glyph: item.icon, tint: item.tint, max: n, start: n, verb: "Take out", ok: (k) => onWithdraw(top, k) });
        for (const e of here) onWithdraw(e);
      };
    }
    chestSlotsEl.appendChild(slot);
  }
}
