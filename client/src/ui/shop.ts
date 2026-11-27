// Shop windows, Farmer Odo's plot window, and the "How many?" box.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { type ShopId, SHOPS } from "../../../shared/shops";
import { ItemId, ITEMS } from "../../../shared/items";
import { formatMoney } from "../../../shared/money";
import { isTool, maxDurability } from "../../../shared/tools";
import { RENOWN_RANKS } from "../../../shared/renown";
import { plotPrice, PLOT_SIZES, FARM_CHEST_PRICE, CROP_IDS, CROPS } from "../../../shared/farming";
import { levelForXp } from "../../../shared/disciplines";
import { openPanel, el, itemIcon, sellPrice, buyPrice, tradingLv, renown, onTitle, icon } from "./core";
import { lastSkillXp } from "./skills";
import { renderInventory, shopIsOpen, onSellAll, invItems, locked, durability, countAt, coins, toolEffect, onBuy, farmView, onFarmBuy, onFarmChest } from "./bag";
import { closeCraft } from "./craft";
import { closeBounties, closeGuild, closeChest } from "./guild";
import { closeInfo } from "./info";

/** The shop window is on its Buy tab (otherwise Sell). */
export let shopBuying = false;

// ---- Shop window (the General Store or a trainer's shop) ----
// You sell by clicking items in your inventory while this is open.

const shopBody = document.getElementById("shop-body")!;

document.querySelectorAll<HTMLElement>(".shop-tab").forEach((b) => {
  b.onclick = () => {
    shopBuying = b.dataset.mode === "buy";
    resetSellAll();
    renderInventory();
  };
});

/** Which shop is open. */
export let shopId: ShopId = "tam";

export function openShop(id: ShopId) {
  shopId = SHOPS[id] ? id : "tam";
  if (shopId === "odo" || shopId === "bryn") shopBuying = true; // plots and seeds, ranks and titles are on the Buy tab
  document.getElementById("shop-title")!.textContent = SHOPS[shopId].title;
  closeCraft();
  closeBounties();
  closeGuild();
  closeChest();
  closeInfo();
  document.body.classList.add("shop-open");
  openPanel("inventory"); // so you can click your items, on phones too
  renderInventory();
}

export function closeShop() {
  if (!shopIsOpen()) return;
  document.body.classList.remove("shop-open");
  closeAmount();
  resetSellAll();
  renderInventory();
}

// "Sell all" asks once more before selling ("Tap again to sell..."), so one
// stray tap can't empty your bag.
const sellAllBtn = document.getElementById("shop-sell-all") as HTMLButtonElement;

let sellAllArmed = false;

let sellAllTimer: number | undefined;

function resetSellAll() {
  sellAllArmed = false;
  clearTimeout(sellAllTimer);
}

sellAllBtn.onclick = () => {
  if (!sellAllArmed) {
    sellAllArmed = true;
    sellAllTimer = window.setTimeout(() => { resetSellAll(); renderShop(); }, 4000);
  } else {
    resetSellAll();
    onSellAll();
  }
  renderShop();
};

export function renderShop() {
  document.querySelectorAll<HTMLElement>(".shop-tab").forEach((b) => b.classList.toggle("active", (b.dataset.mode === "buy") === shopBuying));
  document.body.classList.toggle("shop-buying", shopBuying);
  if (shopBuying) return renderBuy();
  shopBody.replaceChildren();
  const shop = SHOPS[shopId];
  shopBody.append(el("", shopId === "tam" ? "Tam buys anything. Tap an item in your bag to sell it. To keep one, tap 🔒 on your bag, then tap the item."
    : `This shop buys ${shop.buysText} (Tam at the General Store buys anything). Tap an item in your bag to sell it. To keep one, tap 🔒 on your bag.`));
  const prices = el("");
  prices.id = "shop-prices";
  // Prices for the kinds of thing you're carrying (there are too many to list them all).
  const carrying = [...new Set(invItems.filter((id): id is ItemId => !!id && shop.buys(id)))];
  for (const id of carrying) {
    const span = document.createElement("span");
    span.append(itemIcon("", id), ` ${ITEMS[id].name}: ${formatMoney(sellPrice(id))}`);
    span.className = "price";
    prices.appendChild(span);
  }
  const unlockedSlots = invItems.flatMap((id, i) => (id && !locked[i] && shop.buys(id) ? [i] : []));
  const total = unlockedSlots.reduce((sum, i) => sum + sellPrice(invItems[i]!, durability[i]) * countAt(i), 0);
  const unlockedCount = unlockedSlots.reduce((sum, i) => sum + countAt(i), 0);
  const lockedCount = invItems.reduce((sum, id, i) => sum + (id && locked[i] ? countAt(i) : 0), 0);
  shopBody.append(prices, el("", !invItems.some(Boolean) ? "You have nothing to sell. Go chop or fish!"
    : !carrying.length ? `You have nothing this shop buys.`
    : `Sell all gives you ${formatMoney(total)}` + (lockedCount ? ` (keeps ${lockedCount} locked).` : ".")));

  sellAllBtn.disabled = !unlockedCount;
  if (!unlockedCount) resetSellAll();
  sellAllBtn.textContent = sellAllArmed ? `Sell ${unlockedCount} for ${formatMoney(total)}?` : "Sell all";
  sellAllBtn.classList.toggle("armed", sellAllArmed);
}

/** The shop's goods: click one to pick how many to buy. */
function renderBuy() {
  shopBody.replaceChildren();
  if (shopId === "odo") renderFarmOffer();
  if (shopId === "bryn") renderRenownOffer();
  shopBody.append(el("", `Never runs out. You have ${formatMoney(coins)}.`));
  const list = el("");
  list.id = "buy-list";
  for (const id of SHOPS[shopId].stock) {
    const item = ITEMS[id];
    const price = buyPrice(id);
    const row = el("buy-row" + (coins < price ? " poor" : ""));
    const ic = itemIcon("buy-icon", id);
    const one = document.createElement("button");
    one.className = "buy-btn";
    one.append(ic, el("buy-name", item.name), el("buy-price", formatMoney(price)));
    one.title = isTool(id) ? `${item.name}: ${toolEffect(id)}, ${maxDurability(id)} uses. Tap to buy.` : `Buy ${item.name.toLowerCase()}`;
    // As many as you can afford, up to a full bag's worth (the server stops early if your bag or weight runs out).
    const most = Math.max(1, Math.min(BUY_MAX, Math.floor(coins / price)));
    one.onclick = () => askAmount({ title: `Buy ${item.name.toLowerCase()}`, glyph: item.icon, tint: item.tint, max: most, start: 1, each: price, verb: "Buy", ok: (k) => onBuy(id, k) });
    row.append(one);
    list.appendChild(row);
  }
  // Rarer stock (Trading level) and Bryn's specials (Renown rank): shown locked until you can buy them.
  const extra = [
    ...(SHOPS[shopId].rare ?? []).map((r) => ({ item: r.item, ok: tradingLv() >= r.trading, need: `Trading ${r.trading}` })),
    ...(SHOPS[shopId].renown ?? []).map((r) => ({ item: r.item, ok: renown.rank >= r.rank, need: RENOWN_RANKS[r.rank].title })),
  ];
  for (const x of extra) {
    const item = ITEMS[x.item];
    const price = buyPrice(x.item);
    const row = el("buy-row" + (!x.ok ? " locked-stock" : coins < price ? " poor" : ""));
    const one = document.createElement("button");
    one.className = "buy-btn";
    one.append(itemIcon("buy-icon", x.item), el("buy-name", item.name + (x.ok ? "" : ` 🔒 ${x.need}`)), el("buy-price", formatMoney(price)));
    one.title = x.ok ? `Buy ${item.name.toLowerCase()}` : `Needs ${x.need}`;
    one.disabled = !x.ok;
    const most = Math.max(1, Math.min(BUY_MAX, Math.floor(coins / price)));
    one.onclick = () => askAmount({ title: `Buy ${item.name.toLowerCase()}`, glyph: item.icon, tint: item.tint, max: most, start: 1, each: price, verb: "Buy", ok: (k) => onBuy(x.item, k) });
    row.append(one);
    list.appendChild(row);
  }
  shopBody.appendChild(list);
}

/** Captain Bryn: your Renown rank, the next one, and which title to show. */
function renderRenownOffer() {
  const box = el("farm-offer");
  const next = RENOWN_RANKS[renown.rank + 1];
  box.append(el("", `🏅 Renown level ${renown.level}. ` + (renown.rank ? `Bryn has named you ${RENOWN_RANKS[renown.rank].title}.` : "No rank yet.")
    + (next ? ` Next: ${next.title} at Renown ${next.level}.` : " That's the highest rank there is.")));
  if (renown.titles.length) {
    box.append(el("craft-info", "Title over your head:"));
    const row = el("title-row");
    for (const t of ["", ...renown.titles]) {
      const b = document.createElement("button");
      b.className = "buy-btn farm-btn" + (renown.title === t ? " picked" : "");
      b.textContent = t || "None";
      b.onclick = () => onTitle(t);
      row.append(b);
    }
    box.append(row);
  } else {
    box.append(el("craft-info", "Finish bounties to earn Renown. At Renown 5 I'll name you Wanderer, and you can wear the title."));
  }
  shopBody.append(box);
}

/** Farmer Odo: get a plot, make it bigger, or link the farm chest. */
function renderFarmOffer() {
  const f = farmView;
  if (!f) return;
  const box = el("farm-offer");
  const button = (text: string, onClick: () => void, off = false) => {
    const b = document.createElement("button");
    b.className = "buy-btn farm-btn";
    b.textContent = text;
    b.disabled = off;
    b.onclick = onClick;
    return b;
  };
  if (f.lot == null) {
    const price = f.firstFree ? 0 : plotPrice(0);
    box.append(el("", f.free ? `🌾 Get a ${PLOT_SIZES[0][0]} × ${PLOT_SIZES[0][1]} plot of your own. Crops grow even while you're away.` : "🌾 Every lot is taken right now."));
    if (f.free) box.append(button(price ? `Get a plot (${formatMoney(price)})` : "Get a plot (free, Odo pays)", onFarmBuy, coins < price));
  } else {
    const next = PLOT_SIZES[f.step + 1];
    box.append(el("", `🌾 Your plot is ${f.w} × ${f.h}.` + (next ? "" : " That's as big as it gets.")));
    if (next) box.append(button(`Make it ${next[0]} × ${next[1]} (${formatMoney(plotPrice(f.step + 1))})`, onFarmBuy, coins < plotPrice(f.step + 1)));
  }
  box.append(f.chest ? el("", "📦 The farm chest opens your enchanted chest.")
    : button(`Link the farm chest to your enchanted chest (${formatMoney(FARM_CHEST_PRICE)})`, onFarmChest, coins < FARM_CHEST_PRICE));
  const level = levelForXp(lastSkillXp.farming ?? 0);
  const next = CROP_IDS.find((c) => CROPS[c].level > level);
  box.append(el("craft-info", `Seeds you can plant now: ${CROP_IDS.filter((c) => CROPS[c].level <= level).map((c) => ITEMS[CROPS[c].produce].name.toLowerCase()).join(", ") || "none yet"}.`
    + (next ? ` ${ITEMS[CROPS[next].produce].name} at Farming level ${CROPS[next].level}.` : "")));
  shopBody.append(box);
}

document.getElementById("shop-close")!.onclick = closeShop;

/** The server sells at most this many in one go. */
const BUY_MAX = 28;

// ---- "How many?" box: a slider and a number box, for selling, buying and the chest ----

const amountEl = document.getElementById("amount")!;

const amountTitle = document.getElementById("amount-title")!;

const amountRange = document.getElementById("amount-range") as HTMLInputElement;

const amountNumber = document.getElementById("amount-number") as HTMLInputElement;

const amountPrice = document.getElementById("amount-price")!;

const amountOk = document.getElementById("amount-ok") as HTMLButtonElement;

let amountJob: { max: number; each?: number; verb: string; ok: (n: number) => void } | null = null;

export interface AmountAsk {
  title: string;
  glyph: string;
  tint?: string;
  /** Most you can pick (the slider goes 1 to this). */
  max: number;
  /** Where the slider starts. */
  start: number;
  /** Price of one, if money changes hands: shows "12 × 5 bronze = 60 bronze". */
  each?: number;
  /** The button: "Sell", "Buy", "Put in"... */
  verb: string;
  ok: (n: number) => void;
}

export function askAmount(a: AmountAsk) {
  const max = Math.max(1, Math.floor(a.max));
  amountJob = { max, each: a.each, verb: a.verb, ok: a.ok };
  amountTitle.replaceChildren(icon("amount-icon", a.glyph, a.tint), document.createTextNode(a.title));
  amountRange.max = amountNumber.max = String(max);
  amountRange.disabled = max === 1;
  setAmount(a.start);
  document.body.classList.add("amount-open");
}

export function closeAmount() {
  amountJob = null;
  document.body.classList.remove("amount-open");
}

function setAmount(raw: number) {
  if (!amountJob) return;
  const n = Math.max(1, Math.min(amountJob.max, Math.floor(raw) || 1));
  amountRange.value = String(n);
  if (document.activeElement !== amountNumber || Number(amountNumber.value) !== n) amountNumber.value = String(n);
  const { each } = amountJob;
  amountPrice.textContent = each === undefined ? `${n} of ${amountJob.max}`
    : `${n} × ${formatMoney(each)} = ${formatMoney(each * n)}`;
  amountPrice.style.display = each === undefined && amountJob.max === 1 ? "none" : "";
  amountOk.textContent = `${amountJob.verb} ${n}`;
}

amountRange.oninput = () => setAmount(Number(amountRange.value));

amountNumber.oninput = () => { if (amountNumber.value !== "") setAmount(Number(amountNumber.value)); };

amountNumber.onblur = () => setAmount(Number(amountNumber.value));

amountNumber.onkeydown = (e) => { if (e.key === "Enter") amountOk.click(); };

document.getElementById("amount-less")!.onclick = () => setAmount(Number(amountRange.value) - 1);

document.getElementById("amount-more")!.onclick = () => setAmount(Number(amountRange.value) + 1);

document.getElementById("amount-one")!.onclick = () => setAmount(1);

document.getElementById("amount-half")!.onclick = () => amountJob && setAmount(Math.ceil(amountJob.max / 2));

document.getElementById("amount-all")!.onclick = () => amountJob && setAmount(amountJob.max);

document.getElementById("amount-cancel")!.onclick = closeAmount;

amountOk.onclick = () => {
  if (!amountJob) return;
  const n = Number(amountRange.value);
  const ok = amountJob.ok;
  closeAmount();
  ok(n);
};
