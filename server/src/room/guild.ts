// The Mages' Guild and the enchanted chests.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { isUnlocked, levelForXp } from "../../../shared/disciplines";
import { gearDurability } from "../../../shared/crafting";
import { MONSTERS, MonsterId } from "../../../shared/combat";
import { CombatStyle, isGear } from "../../../shared/gear";
import { isTool, maxDurability } from "../../../shared/tools";
import { ITEMS, ItemId, STONE_TO_BRONZE_USES, legacyStone } from "../../../shared/items";
import { NPCS, NpcDef, isChest } from "../../../shared/npcs";
import { addItem, newEntry, stackLimit, wearsOut, compact, countIn, countItem, emptyBag, mergeStacks, stackName, takeFromEntry, takeItem } from "../../../shared/bag";
import { CHEST_MAX, CHEST_RENT, CHEST_START, CHEST_STEP, GUILD_BOUNTY_COUNT, GuildView, RANKS, REAGENTS, expandCost, guildBountyName, guildRenown, guildReward, newGuildBoard, newGuildBounty, rankFor, validGuildBounty, MagicJob, isJob } from "../../../shared/guild";
import { formatMoney } from "../../../shared/money";
import { BAITS, isBait } from "../../../shared/handicraft";
import { YSOLDE_GUILD_STEP, isProtected } from "../../../shared/quests";
import { bountyChoices, REROLL_FEE, boardDay } from "../../../shared/bounties";
import { SaveData, store } from "../storage";
import { FARM_CHEST_PRICE } from "../../../shared/farming";
import { Player } from "./schema";
import { STONE_PRICE, wantCount } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const guildMethods = {
  // ---- The Mages' Guild (rules in shared/guild.ts) ----

  guildPlayer(this: WorldRoom, p: Player) {
    // Reagents: the ones the normal bounty board could ask you for (things you can gather, or have seen drop).
    const reachable = new Set(bountyChoices(p).flat());
    const jobs: MagicJob[] = [];
    if (this.known(p).includes("soul_trap")) jobs.push("trap");
    if (isUnlocked(p.unlocked, "alchemy")) jobs.push("brew");
    if (isUnlocked(p.unlocked, "enchanting")) jobs.push("enchant");
    return { magicLevel: levelForXp(p.skillXp.magic), reagents: REAGENTS.filter((r) => reachable.has(r)), jobs };
  },
  guildView(this: WorldRoom, p: Player): GuildView {
    return { points: p.guildPoints, rank: rankFor(p.guildPoints), chestSize: p.chest.slotCount, bounties: p.guildBounties };
  },
  /** Not until Old Maren's lessons are done. Says why not. */
  guildOpen(this: WorldRoom, client: Client, p: Player): boolean {
    if ((p.quest.ch.ysolde?.step ?? -1) >= YSOLDE_GUILD_STEP) return true;
    this.say(client, "🔮 The Mages' Guild only takes members who have finished Archmage Rowan's lesson.");
    return false;
  },
  /** Click the Archmage or the guild board: the guild window (rank, chest, magic bounties). */
  openGuild(this: WorldRoom, client: Client, p: Player, npc: NpcDef) {
    if (!this.guildOpen(client, p)) return;
    const today = boardDay();
    if (p.guildDay !== today || p.guildBounties.length < GUILD_BOUNTY_COUNT) {
      p.guildDay = today;
      p.guildBounties = newGuildBoard(this.guildPlayer(p));
      p.dirty = true;
    }
    if (npc.id === "archmage") this.say(client, `${npc.name}: ${npc.greeting}`);
    this.sendGuild(client, p, true);
  },
  sendGuild(this: WorldRoom, client: Client, p: Player, open = false) {
    client.send("guild", { ...this.guildView(p), open });
  },
  nearGuild(this: WorldRoom, client: Client, p: Player): boolean {
    if (!this.guildOpen(client, p)) return false;
    if (this.nearNpc(p, "archmage") || this.nearNpc(p, "guildboard")) return true;
    this.say(client, "You need to be at the Mages' Guild.");
    return false;
  },
  /** Next to any enchanted chest? */
  nearChest(this: WorldRoom, p: Player) {
    return NPCS.some((n) => isChest(n.id) && (n.id !== "chest_farm" || p.farmChest) && this.nearNpc(p, n.id));
  },
  /** Click an enchanted chest: your storage, if you've rented it. */
  openChest(this: WorldRoom, client: Client, p: Player, id = "chest") {
    if (id === "chest_farm" && !p.farmChest) {
      return this.say(client, `📦 This chest isn't linked to yours. Farmer Odo can link it to your enchanted chest for ${formatMoney(FARM_CHEST_PRICE)}.`);
    }
    if (!this.guildOpen(client, p)) return;
    if (!p.chest.slotCount) {
      return this.say(client, `🔮 The chest is sealed. Rent space in it from Archmage Rowan at the Mages' Guild (south-west of town) for ${formatMoney(CHEST_RENT)}.`);
    }
    this.sendChest(client, p, true);
  },
  sendChest(this: WorldRoom, client: Client, p: Player, open = false) {
    client.send("chest", { ...this.bagView(p.chest), open });
  },
  /** A guild bounty is done: pay out, and put a new one up in its place. */
  finishGuildBounty(this: WorldRoom, client: Client | undefined, p: Player, index: number) {
    const b = p.guildBounties[index];
    const reward = guildReward(b);
    const rankBefore = rankFor(p.guildPoints);
    p.guildPoints += reward.points;
    p.coins += reward.coins;
    p.guildBounties[index] = newGuildBounty(this.guildPlayer(p), p.guildBounties.filter((_, i) => i !== index).concat(b));
    if (client) {
      this.say(client, `🔮 Guild bounty done: ${guildBountyName(b).toLowerCase()}! +${reward.points} guild point${reward.points === 1 ? "" : "s"}, ${formatMoney(reward.coins)}, ${reward.magicXp} Spellcasting XP and ${guildRenown(reward.points)} Renown XP.`);
      this.addSkillXp(p, client, "magic", reward.magicXp);
      this.addSkillXp(p, client, "renown", guildRenown(reward.points));
      const rank = rankFor(p.guildPoints);
      if (rank > rankBefore) {
        this.say(client, `🎉 You are now a guild ${RANKS[rank].name}! Your enchanted chest can grow to ${RANKS[rank].maxChest} spaces.`);
        if (rankBefore < 2 && rank >= 2) {
          const got = this.give(p, "book_invisibility", 1, null, true) > 0;
          if (got) this.say(client, "Archmage Rowan: \"Well done, Adept. Take this: a spell book of Invisibility. Read it when your Spellcasting is ready.\"");
          this.sendInventory(client, p);
        }
        client.send("guildRank", { rank: RANKS[rank].name });
      }
      client.send("coins", p.coins);
      this.sendGuild(client, p);
    }
    p.dirty = true;
  },
  /** Ember trapping, brewing and enchanting count toward guild bounties that ask for them. */
  guildJob(this: WorldRoom, p: Player, client: Client | undefined, kind: MagicJob) {
    if ((p.quest.ch.ysolde?.step ?? -1) < YSOLDE_GUILD_STEP) return;
    const i = p.guildBounties.findIndex((b) => b.kind === kind);
    const b = p.guildBounties[i];
    if (!b || !isJob(b)) return;
    b.progress++;
    p.dirty = true;
    if (b.progress >= b.count) this.finishGuildBounty(client, p, i);
    else if (client) {
      this.say(client, `🔮 Guild bounty: ${b.progress}/${b.count}.`);
      this.sendGuild(client, p);
    }
  },
  /** A monster fell: count it toward "defeat with spells" guild bounties. */
  guildKill(this: WorldRoom, p: Player, client: Client | undefined, monster: MonsterId, style: CombatStyle) {
    if (style !== "magic" || (p.quest.ch.ysolde?.step ?? -1) < YSOLDE_GUILD_STEP) return;
    p.guildBounties.forEach((b, i) => {
      if (b.kind !== "slay" || b.monster !== monster) return;
      b.progress++;
      p.dirty = true;
      if (b.progress >= b.count) this.finishGuildBounty(client, p, i);
      else if (client) {
        this.say(client, `🔮 Guild bounty: ${b.progress}/${b.count} ${MONSTERS[monster].name.toLowerCase()}s defeated with spells.`);
        this.sendGuild(client, p);
      }
    });
  },
  restoreGuild(this: WorldRoom, p: Player, g: SaveData["guild"]) {
    if (!g) return;
    if (typeof g.points === "number" && Number.isFinite(g.points) && g.points >= 0) p.guildPoints = Math.floor(g.points);
    if (Array.isArray(g.bounties)) p.guildBounties = g.bounties.filter(validGuildBounty).slice(0, GUILD_BOUNTY_COUNT);
    if (Array.isArray(g.chest)) {
      // Older saves had one chest entry per space; newer ones say which space each entry is in.
      const newer = Number.isInteger(g.chestSize);
      const size = Math.min(CHEST_MAX, newer ? Math.max(0, g.chestSize!) : g.chest.length);
      const old = emptyBag(size);
      g.chest.slice(0, 1000).forEach((c, i) => {
        if (c && c.item === "stone") {
          // Stone isn't in the game any more: it's paid out at what it sold for.
          const n = Number.isInteger(c.count) && c.count >= 1 ? Math.min(c.count, 1000) : 1;
          p.coins += n * STONE_PRICE;
          p.loginNotes.push(`🪨 Stone isn't mined any more, so the stone in your enchanted chest was sold for you: +${n * STONE_PRICE} bronze coins.`);
          return;
        }
        if (c && typeof c.item === "string" && legacyStone(c.item)) {
          c.item = legacyStone(c.item)!; // stone tools, weapons and arrows -> bronze
          if (typeof c.durability === "number" && c.durability > 0) c.durability *= STONE_TO_BRONZE_USES;
        }
        if (!c || typeof c.item !== "string" || !(c.item in ITEMS)) return;
        const slot = newer ? c.slot : i;
        if (!Number.isInteger(slot) || slot! < 0 || slot! >= size) return;
        const item = c.item as ItemId;
        const max = isTool(item) ? maxDurability(item) : isGear(item) ? gearDurability(item) : isBait(item) ? BAITS[item].uses : null;
        const d = typeof c.durability === "number" && (c.durability > 0 || (c.durability === 0 && !isBait(item))) ? Math.min(Math.floor(c.durability), max ?? 0) : max;
        const n = Number.isInteger(c.count) && c.count >= 1 ? Math.min(c.count, stackLimit(item)) : 1;
        if (wearsOut(item)) for (let k = 0; k < n; k++) newEntry(old, slot!, item, 1, d);
        else newEntry(old, slot!, item, n, null);
      });
      mergeStacks(old); // join similar things (older chests had every tool in its own space)
      compact(old);
      p.chest = old;
    }
  },
  guildSave(this: WorldRoom, p: Player): NonNullable<SaveData["guild"]> {
    return {
      points: p.guildPoints,
      bounties: p.guildBounties.map((b) => ({ ...b })),
      chestSize: p.chest.slotCount,
      chest: p.chest.inventory.flatMap((item, e) => (item ? [{ item, count: countIn(p.chest, e), durability: p.chest.durability[e], slot: p.chest.slotOf[e] }] : [])),
    };
  },
};

/** The messages from players about this. */
export function registerGuild(this: WorldRoom) {
    // Rent the enchanted chest (first 4 spaces), or pay to add 4 more.
    this.onMessage("buyChestSpace", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.nearGuild(client, p)) return;
      const size = p.chest.slotCount;
      const cost = size ? expandCost(size) : CHEST_RENT;
      if (cost == null) return this.say(client, "Your chest is as big as the guild makes them.");
      const rank = rankFor(p.guildPoints);
      const next = size ? size + CHEST_STEP : CHEST_START;
      if (next > RANKS[rank].maxChest) {
        const need = RANKS.find((r) => r.maxChest >= next)!;
        return this.say(client, `${/^[AEIOU]/.test(RANKS[rank].name) ? "An" : "A"} ${RANKS[rank].name} may only rent ${RANKS[rank].maxChest} spaces. Reach ${need.name} (${need.points} guild points) for more: do the guild's magic bounties.`);
      }
      if (p.coins < cost) return this.say(client, `That costs ${formatMoney(cost)}. You have ${formatMoney(p.coins)}.`);
      p.coins -= cost;
      p.chest.slotCount = next;
      this.say(client, size
        ? `🔮 Archmage Rowan widens your chest's enchantment: ${next} spaces now, for ${formatMoney(cost)}.`
        : `🔮 You rent space in the enchanted chest for ${formatMoney(cost)}: ${next} spaces. Open it here, at the Hearthstone Inn, on the coast or in the Dark Forest.`);
      client.send("coins", p.coins);
      this.sendGuild(client, p);
      this.saveSoon(p);
    });
    // Put a whole stack from your bag into the chest.
    this.onMessage("deposit", (client, msg: { slot: number; count?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!item) return;
      if (!this.nearChest(p)) return this.say(client, "You need to be next to an enchanted chest.");
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(p, item, "store"));
      const n = Math.min(countIn(p, msg.slot), wantCount(msg.count));
      const put = addItem(p.chest, item, n, p.durability[msg.slot]);
      if (!put) return this.say(client, "Your chest is full. Buy more space from Archmage Rowan at the Mages' Guild.");
      takeFromEntry(p, msg.slot, put);
      if (put < n) this.say(client, `Only ${put} fit in your chest.`);
      this.sendInventory(client, p);
      this.sendChest(client, p);
      this.saveSoon(p);
    });
    // Take a whole stack out of the chest into your bag.
    this.onMessage("withdraw", (client, msg: { slot: number; count?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.chest.inventory[msg.slot];
      if (!item) return;
      if (!this.nearChest(p)) return this.say(client, "You need to be next to an enchanted chest.");
      const n = Math.min(countIn(p.chest, msg.slot), wantCount(msg.count));
      const got = this.give(p, item, n, p.chest.durability[msg.slot]);
      if (!got) return this.say(client, this.fullReason(p, item));
      takeFromEntry(p.chest, msg.slot, got);
      if (got < n) this.say(client, `You can only take ${got} (bag space or weight).`);
      this.sendInventory(client, p);
      this.sendChest(client, p);
      this.saveSoon(p);
    });
    // Guild board: hand in reagents for a "bring" bounty.
    this.onMessage("guildHandIn", (client, msg: { index: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.index) || !this.nearGuild(client, p)) return;
      const b = p.guildBounties[msg.index];
      if (!b || b.kind !== "reagent") return;
      const ok = (i: number) => !p.locked[i];
      const have = countItem(p, b.item, ok);
      if (have < b.count) return this.say(client, `You need ${stackName(b.item, b.count)} for that (you have ${have}). Locked items don't count.`);
      takeItem(p, b.item, b.count, ok);
      this.finishGuildBounty(client, p, msg.index);
      this.sendInventory(client, p);
      this.saveSoon(p);
    });
    // Guild board: swap all 3 for new ones (free). Progress on spell bounties is lost.
    this.onMessage("refreshGuild", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.nearGuild(client, p)) return;
      if (p.coins < REROLL_FEE) return this.say(client, `🔮 New guild bounties cost ${formatMoney(REROLL_FEE)}. The board changes by itself every day.`);
      p.coins -= REROLL_FEE;
      client.send("coins", p.coins);
      p.guildBounties = newGuildBoard(this.guildPlayer(p));
      this.say(client, "🔮 The guild board shimmers, and new jobs appear.");
      this.sendGuild(client, p);
      p.dirty = true;
    });
}
