// Shops, selling, the bounty board and Captain Bryn's Renown.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { buyPriceFor, sellPriceFor } from "../../../shared/crafting";
import { isGear } from "../../../shared/gear";
import { isTool } from "../../../shared/tools";
import { ITEMS, ItemId } from "../../../shared/items";
import { NpcDef, isChest, npcById } from "../../../shared/npcs";
import { clearEntry, countIn, countItem, stackName, takeFromEntry, takeItem } from "../../../shared/bag";
import { buyWithCharisma, sellWithCharisma, tradingXp } from "../../../shared/stats";
import { formatMoney } from "../../../shared/money";
import { GUIDE_NAME, boardOpen, isProtected } from "../../../shared/quests";
import { SHOPS, SHOP_IDS, ShopId, isShop, canBuyHere } from "../../../shared/shops";
import { BOUNTY_COUNT, Bounty, bountyName, bountyReward, newBoard, newBounty, slotCounts, REROLL_FEE, boardDay } from "../../../shared/bounties";
import { RENOWN_RANKS, RenownView, rankForRenown } from "../../../shared/renown";
import { isStoryItem } from "../../../shared/story";
import { Player } from "./schema";
import { wantCount, STORY_STATIONS, aOr } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const shopsMethods = {
  openShop(this: WorldRoom, client: Client, p: Player, npc: NpcDef) {
    p.faceX = npc.x;
    p.faceY = npc.y;
    if (npc.id === "bryn") this.renownTalk(client, p); // a new rank, if you've earned one
    if (this.robeHelp(client, p, npc)) return;
    if (this.storyClick(client, p, npc)) return;
    if (npc.id.startsWith("book_")) return this.bookClick(client, p, npc);
    if (this.talkQuest(client, p, npc)) return;
    if (STORY_STATIONS.has(npc.id)) return this.say(client, `${npc.name}: ${this.stationLook(p, npc)}`);
    if (npc.id === "maren") return;
    if (npc.id === "board") return this.openBoard(client, p);
    if (npc.id === "repairer") {
      this.say(client, `${npc.name}: ${npc.greeting}`);
      return this.sendRepairs(client, p, true);
    }
    if (npc.id === "archmage" || npc.id === "guildboard") return this.openGuild(client, p, npc);
    if (isChest(npc.id)) return this.openChest(client, p, npc.id);
    this.say(client, `${npc.name}: ${npc.greeting}`);
    if (npc.kind === "station") return client.send("station", { npc: npc.id });
    if (npc.id === "odo") this.sendFarm(client, p);

    if (isShop(npc.id)) client.send("shop", { npc: npc.id });
  },
  // ---- Bounty board (rules in shared/bounties.ts) ----

  /** Click the board: shut until Maren tells you about it, then show your 5 bounties. */
  openBoard(this: WorldRoom, client: Client, p: Player) {
    if (!boardOpen(p.quest)) {
      return this.say(client, `📋 The bounty board isn't open to you yet. Finish ${GUIDE_NAME}'s lessons first.`);
    }
    this.fillBoard(p);
    this.sendBounties(client, p, true);
  },
  /** Pin up a full board of bounties if it's open to you and not full. */
  fillBoard(this: WorldRoom, p: Player) {
    if (!boardOpen(p.quest)) return;
    // A new day: a whole new board.
    const today = boardDay();
    if (p.boardDay !== today) { p.boardDay = today; p.bounties = []; }
    if (p.bounties.length >= BOUNTY_COUNT) return;
    p.bounties = newBoard(p);
    if (p.tracked && !p.bounties.some((x) => x.item === p.tracked)) p.tracked = null;
    p.dirty = true;
  },
  /** What the quest tracker shows: a bounty's item, or null for Maren's quest. */
  sendTracked(this: WorldRoom, client: Client, p: Player) {
    client.send("tracked", { item: p.tracked });
  },
  /** Can this player use the board right now? Says why not. */
  boardReady(this: WorldRoom, client: Client, p: Player): boolean {
    if (!boardOpen(p.quest)) {
      this.say(client, `📋 The bounty board isn't open to you yet. Finish ${GUIDE_NAME}'s lessons first.`);
      return false;
    }
    if (!this.nearNpc(p, "board")) {
      this.say(client, "You need to be next to the bounty board.");
      return false;
    }
    return true;
  },
  /** The board's bounties (the client works out rewards and what you have with the same shared code). */
  sendBounties(this: WorldRoom, client: Client, p: Player, open = false) {
    client.send("bounties", { bounties: p.bounties, open });
    this.sendTracked(client, p);
  },
  /** The shop you're standing next to (a trainer or the General Store), if any. */
  nearShop(this: WorldRoom, p: Player): ShopId | null {
    return SHOP_IDS.find((id) => this.nearNpc(p, id)) ?? null;
  },
  renownView(this: WorldRoom, p: Player): RenownView {
    return { level: this.renownLevel(p), rank: p.renownRank, title: p.title, titles: this.titlesOf(p) };
  },
  sendRenown(this: WorldRoom, client: Client, p: Player) {
    client.send("renown", this.renownView(p));
  },
  /** Talking to Captain Bryn: he names you a new rank if your Renown is high enough. */
  renownTalk(this: WorldRoom, client: Client, p: Player) {
    if (!boardOpen(p.quest)) return this.sendRenown(client, p);
    const earned = rankForRenown(this.renownLevel(p));
    if (earned > p.renownRank) {
      p.renownRank = earned;
      const title = RENOWN_RANKS[earned].title;
      if (!p.title) p.title = title;
      p.dirty = true;
      this.say(client, `🏅 Captain Bryn: Folk all over town know your name now. From today, you're ${title}! Wear it with pride: everyone sees it over your head (pick another in my shop window). And I've some special things for sale to those I've named.`);
    }
    this.sendRenown(client, p);
  },
};

/** The messages from players about this. */
export function registerShops(this: WorldRoom) {
    // While a shop is open, clicking an inventory item sells it (if that shop buys it).
    this.onMessage("sell", (client, msg: { slot: number; count?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!item) return;
      if (p.locked[msg.slot]) return this.say(client, `That ${ITEMS[item].single} is locked. Unlock it to sell it.`);
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(p, item, "sell"));
      if (isStoryItem(item)) return this.say(client, `No one would buy your ${ITEMS[item].single}. It's worth more to you.`);
      const shop = this.nearShop(p);
      if (!shop) return this.say(client, "You need to be next to a shopkeeper to sell.");
      if (!SHOPS[shop].buys(item)) return this.say(client, `${npcById(shop)!.name} only buys ${SHOPS[shop].buysText}. Shopkeeper Tam at the General Store buys anything.`);
      // Sell `count` of the stack (all of it if left out).
      const n = Math.min(countIn(p, msg.slot), wantCount(msg.count));
      const price = sellWithCharisma(sellPriceFor(item, p.mastery, p.durability[msg.slot]), p.levels.charisma, this.tradingLevel(p)) * n;
      takeFromEntry(p, msg.slot, n);
      p.coins += price;
      this.say(client, `You sell ${stackName(item, n)} for ${formatMoney(price)}.`);
      for (let k = 0; k < n; k++) this.questEvent(p, client, { kind: "sell", item });
      this.addSkillXp(p, client, "trading", tradingXp(price));
      this.sendInventory(client, p);
      this.saveSoon(p);
    });
    // Sell everything that isn't locked, in one go.
    this.onMessage("sellAll", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const shop = this.nearShop(p);
      if (!shop) return this.say(client, "You need to be next to a shopkeeper to sell.");
      const name = npcById(shop)!.name;
      let count = 0;
      let total = 0;
      const sold: ItemId[] = [];
      const kept = new Set<ItemId>();
      for (let i = 0; i < p.inventory.length; i++) {
        const item = p.inventory[i];
        if (!item || p.locked[i]) continue;
        if (isProtected(p.quest, item)) { kept.add(item); continue; }
        if (!SHOPS[shop].buys(item)) continue;
        const n = countIn(p, i);
        total += sellWithCharisma(sellPriceFor(item, p.mastery, p.durability[i]), p.levels.charisma, this.tradingLevel(p)) * n;
        clearEntry(p, i);
        for (let k = 0; k < n; k++) sold.push(item);
        count += n;
      }
      if (kept.size) this.say(client, `${name}: I'll leave your ${[...kept].map((i) => ITEMS[i].name.toLowerCase()).join(" and ")} alone. ${this.giverName(p)} needs you to use those first.`);
      if (!count) return this.say(client, kept.size ? "You have nothing else to sell here." : `You have nothing ${name} buys that isn't locked. (${name} buys ${SHOPS[shop].buysText}.)`);
      p.coins += total;
      this.say(client, `You sell ${count} item${count === 1 ? "" : "s"} for ${formatMoney(total)}.`);
      for (const item of sold) this.questEvent(p, client, { kind: "sell", item });
      this.addSkillXp(p, client, "trading", tradingXp(total));
      this.sendInventory(client, p);
      this.saveSoon(p);
    });
    // Buy from a shop (endless stock). Prices don't use your Mastery.
    this.onMessage("buy", (client, msg: { item: string; count?: number }) => {
      const p = this.state.players.get(client.sessionId);
      const item = msg?.item as ItemId;
      if (!p || !ITEMS[item]) return;
      const shop = this.nearShop(p);
      if (!shop) return this.say(client, "You need to be next to a shopkeeper to buy.");
      if (!canBuyHere(SHOPS[shop], item, this.tradingLevel(p), p.renownRank)) {
        const rare = SHOPS[shop].rare?.find((r) => r.item === item);
        const special = SHOPS[shop].renown?.find((r) => r.item === item);
        if (rare) return this.say(client, `You need Trading level ${rare.trading} to buy that here. Trading goes up as you sell things.`);
        if (special) return this.say(client, `Captain Bryn only sells that to those he's named ${RENOWN_RANKS[special.rank].title}.`);
        return;
      }
      const want = Math.max(1, Math.min(28, Math.floor(Number(msg.count) || 1)));
      const price = buyWithCharisma(buyPriceFor(item), p.levels.charisma, this.tradingLevel(p));
      let bought = 0;
      while (bought < want) {
        if (!this.fits(p, item) || p.coins < price) break;
        p.coins -= price;
        this.give(p, item);
        bought++;
      }
      if (!bought) {
        return this.say(client, this.fits(p, item)
          ? `You need ${formatMoney(price)} for ${aOr(ITEMS[item].single)}.` : this.fullReason(p, item));
      }
      this.sendInventory(client, p);
      this.say(client, `You buy ${bought} ${bought === 1 ? ITEMS[item].single : ITEMS[item].name.toLowerCase()} for ${formatMoney(price * bought)}.`);
      this.questEvent(p, client, { kind: "buy", item });
      this.saveSoon(p);
    });
    // Bounty board: hand in the full amount for one bounty (never locked or worn items).
    this.onMessage("handIn", (client, msg: { index: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.index)) return;
      const b = p.bounties[msg.index];
      if (!b || !this.boardReady(client, p)) return;
      const ok = (i: number) => slotCounts(b.item, p.inventory[i], p.locked[i], p.durability[i]) && !isProtected(p.quest, b.item);
      const have = countItem(p, b.item, ok);
      if (have < b.count) {
        const unused = isTool(b.item) || isGear(b.item) ? " unused" : "";
        return this.say(client, `You need ${b.count}${unused} ${b.count === 1 ? ITEMS[b.item].single : ITEMS[b.item].name.toLowerCase()} for that bounty (you have ${have}). Locked items don't count.`);
      }
      const reward = bountyReward(b, p.mastery, this.renownLevel(p));
      takeItem(p, b.item, b.count, ok);
      p.coins += reward.coins;
      this.say(client, `📋 Bounty done: ${bountyName(b).toLowerCase()}! You get ${formatMoney(reward.coins)}, ${reward.xp} ${reward.label} XP and ${reward.renown} Renown XP.`);
      if (reward.skill) this.addSkillXp(p, client, reward.skill, reward.xp);
      this.addSkillXp(p, client, "renown", reward.renown);
      if (reward.monster) this.addCombatMastery(p, client, reward.monster, reward.xp);
      // A new job goes up in its place.
      const others = p.bounties.filter((_, i) => i !== msg.index).map((x) => x.item);
      const next = newBounty(p, [...others, b.item]);
      if (next) p.bounties[msg.index] = next; else p.bounties.splice(msg.index, 1);
      if (p.tracked === b.item && !p.bounties.some((x) => x.item === b.item)) p.tracked = null; // done: the tracker goes back to Maren's quest
      this.questEvent(p, client, { kind: "bounty" });
      this.sendInventory(client, p);
      this.sendBounties(client, p);
      this.saveSoon(p);
    });
    // Bounty board: swap all 5 for new ones (free for now).
    this.onMessage("refreshBounties", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.boardReady(client, p)) return;
      if (p.coins < REROLL_FEE) return this.say(client, `📋 New notices cost ${formatMoney(REROLL_FEE)} (for the notice writer). The board changes by itself every day.`);
      p.coins -= REROLL_FEE;
      client.send("coins", p.coins);
      p.bounties = newBoard(p);
      if (p.tracked && !p.bounties.some((x) => x.item === p.tracked)) p.tracked = null;
      this.say(client, "📋 You take down the old notices. New ones are pinned up.");
      this.sendBounties(client, p);
      p.dirty = true;
    });
    // Pick what the quest tracker shows: a bounty (by its place on the board), or Maren's quest.
    this.onMessage("track", (client, msg: { bounty?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const b = Number.isInteger(msg?.bounty) ? p.bounties[msg.bounty!] : undefined;
      p.tracked = b && boardOpen(p.quest) ? b.item : null;
      p.dirty = true;
      this.sendTracked(client, p);
      if (p.tracked) this.questEvent(p, client, { kind: "track" });
    });
}
