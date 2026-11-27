// Skills, Mastery, stamina, health, carrying, and what gets sent to the player about them.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Room, Client } from "colyseus";
import { type } from "@colyseus/schema";
import { RESOURCES, FORAGE_FINDS, resourcesFor } from "../../../shared/foraging";
import { MasteryId, masteryIn as masteryLevelIn, speedBonusPercent, valueBonusPercent } from "../../../shared/mastery";
import { DISCIPLINES, DISCIPLINE_IDS, DisciplineId, SkillId, disciplineLevels, findSkill, isCraftSkill, isUnlocked, levelForXp } from "../../../shared/disciplines";
import { masteryName, SMITH_ORDER, smithLevel } from "../../../shared/crafting";
import { SPELLS, SPELL_IDS, maxHealth, maxMana, clothMana } from "../../../shared/combat";
import { GEAR_SLOTS, WEAPONS, isWeapon, ArmorType, SOFT_NAMES } from "../../../shared/gear";
import { METALS, MATERIALS, MATERIAL_IDS } from "../../../shared/tools";
import { ITEMS, ItemId } from "../../../shared/items";
import { roomFor } from "../../../shared/bag";
import { carriedWeight, carryCapacity, kg, weightOf } from "../../../shared/weight";
import { OVERLOAD_MAX, loadLevel, maxStamina, walkBonus } from "../../../shared/stats";
import { enchantTotal, fits, vitalityHp } from "../../../shared/enchanting";
import { ARROW_LEVEL, CLOTH_LEVEL, SOFT_LEVEL, TANNING, THREAD_LEVEL, WOOD_LEVEL, BAITS } from "../../../shared/handicraft";
import { GemId, CUT_LEVEL, GEMS, JEWEL_BARS, JEWEL_METALS, jewelTotals } from "../../../shared/jewelry";
import { BUFFS, BUFF_IDS, Buffs, POTIONS, POTION_TYPES, buffPower } from "../../../shared/alchemy";
import { BASE_INGREDIENTS, DISHES, DISH_IDS, STAMINA_COST, isFood } from "../../../shared/cooking";
import { TREES, earnedPoints, rankCost, spentPoints, treeNode } from "../../../shared/skilltree";
import { GUIDE_NAME, teacherOf, unlockedSkills, marenDone } from "../../../shared/quests";
import { SHOPS, SHOP_IDS } from "../../../shared/shops";
import { RENOWN_RANKS } from "../../../shared/renown";
import { TITHE_SHARE, titheCost } from "../../../shared/story";
import { CROPS, CROP_IDS, MASTERY_EXTRA } from "../../../shared/farming";
import { Player } from "./schema";
import { worldNow, aOr, verbFor } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const statsMethods = {
  /** Potion buffs that are running, for the bar under your health. */
  sendBuffs(this: WorldRoom, client: Client, p: Player) {
    client.send("buffs", p.buffs);
  },
  /** Buffs that ran out: say so, and walk at normal speed again. */
  expireBuffs(this: WorldRoom, p: Player, client: Client | undefined) {
    const now = worldNow();
    let changed = false;
    for (const id of BUFF_IDS) {
      const b = p.buffs[id];
      if (b && b.until <= now) {
        delete p.buffs[id];
        changed = true;
        if (client) {
          const spell = id === "ward" ? "ward fades" : id === "haste" ? "haste wears off" : id === "invisible" ? "invisibility wears off: monsters can see you again" : id === "blessed" ? "blessing fades" : null;
          this.say(client, spell ? `${BUFFS[id].icon} Your ${spell}.` : `${BUFFS[id].icon} Your ${BUFFS[id].name.toLowerCase()} potion wears off.`);
        }
      }
    }
    p.invisible = buffPower(p.buffs, "invisible", now) > 0;
    if (!changed) return;
    p.stepMs = this.stepMsOf(p);
    p.dirty = true;
    if (client) this.sendBuffs(client, p);
  },
  /** Enough stamina for one more of this? If not, say so (and how to get more). */
  hasStamina(this: WorldRoom, client: Client | undefined, p: Player, skill: SkillId): boolean {
    const cost = STAMINA_COST[skill];
    if (p.stamina >= cost) return true;
    if (client) {
      const eat = p.inventory.some((it) => isFood(it)) ? "Eat something from your bag" : "Eat a fish or a meal (the General Store sells stew)";
      this.say(client, `You're too tired: ${findSkill(skill).def.name} needs ${cost} stamina and you have ${p.stamina}. ${eat}, or rest (1 stamina every 30 seconds).`);
    }
    return false;
  },
  useStamina(this: WorldRoom, p: Player, skill: SkillId) {
    p.stamina = Math.max(0, p.stamina - STAMINA_COST[skill]);
  },
  sendStamina(this: WorldRoom, client: Client, p: Player) {
    client.send("stamina", { stamina: p.stamina, max: p.maxStamina, winded: Math.min(p.winded, p.stamina) });
  },
  /** Total weight carried (bag, tool belt and worn gear), in tenths of a kg. */
  carried(this: WorldRoom, p: Player) {
    return carriedWeight(p, p.belt, p.gear);
  },
  /** How many more of this item you could carry, by weight. */
  canLift(this: WorldRoom, p: Player, item: ItemId): number {
    const w = weightOf(item);
    const spare = this.capacity(p) * OVERLOAD_MAX - this.carried(p);
    return w <= 0 ? Infinity : Math.max(0, Math.floor(spare / w));
  },
  /** Room in the bag (a slot or stack) and strength to carry one more? */
  fits(this: WorldRoom, p: Player, item: ItemId) {
    return roomFor(p, item) >= 1 && this.canLift(p, item) >= 1;
  },
  /** Why you can't take one more of this: bag full, or too heavy. */
  fullReason(this: WorldRoom, p: Player, item: ItemId) {
    if (roomFor(p, item) < 1) return "Your bag is full. Sell or drop something first, or put things in your enchanted chest.";
    return `That's too heavy even to drag: you're carrying ${kg(this.carried(p))}, ${OVERLOAD_MAX} times the ${kg(this.capacity(p))} you can carry. Sell, drop or eat something, or put things in your enchanted chest.`;
  },
  /** Armor you're wearing (not your weapon), for armor enchantments. */
  armorItems(this: WorldRoom, p: Player) {
    return GEAR_SLOTS.filter((sl) => sl !== "weapon").map((sl) => p.gear[sl]?.item ?? null);
  },
  /** Mastery points earned (1 per Mastery level, everywhere) minus those spent. */
  freePoints(this: WorldRoom, p: Player) {
    return earnedPoints(p.mastery, p.combatMastery) - spentPoints(p.tree);
  },
  /** How many ingredients fit in your pot: 3, plus the Cooking tree's "Bigger pot". */
  potSize(this: WorldRoom, p: Player) {
    return BASE_INGREDIENTS + this.tree(p, "cooking", "slots");
  },
  /** Max health: from your Strength level, plus the Defense tree's "Toughness". */
  maxHpOf(this: WorldRoom, p: Player) {
    return maxHealth(p.levels.strength) + this.tree(p, "defense", "health") + jewelTotals(p.jewels).health + vitalityHp(enchantTotal(this.armorItems(p), "vitality"));
  },
  /** Max mana: from your Wisdom level. */
  maxManaOf(this: WorldRoom, p: Player) {
    return maxMana(p.levels.wisdom) + jewelTotals(p.jewels).mana + clothMana(p.gear);
  },
  /** Max stamina: from your Endurance level, plus emeralds. */
  maxStaminaOf(this: WorldRoom, p: Player) {
    return maxStamina(p.levels.endurance) + jewelTotals(p.jewels).stamina;
  },
  /** What you can carry: from your Dexterity level. */
  capacity(this: WorldRoom, p: Player) {
    return carryCapacity(p.levels.dexterity);
  },
  /** "Old Maren hasn't taught you Mining yet." */
  notTaught(this: WorldRoom, skill: SkillId, p?: Player) {
    const marenDoneQ = !p || marenDone(p.quest);
    const name = findSkill(skill).def.name;
    const c = teacherOf(skill);
    if (!c) return `You haven't learned ${name} yet.`;
    return c.id === "maren" ? `${GUIDE_NAME} hasn't taught you ${name} yet. Keep following her lessons in the 📜 Quests tab.`
      : `You haven't learned ${name} yet. ${c.name} teaches it (${c.where}).` + (skill === "woodcutting" && !marenDoneQ ? ` Need firewood? Talk to ${GUIDE_NAME}: she'll give you some.` : "");
  },
  /**
   * Work out everything that comes from your skills and quests: which skills
   * you've been taught, each Discipline's level, and the stats they give
   * (health, stamina, mana, carry weight, walking speed). Call after any skill
   * level-up or quest step. Says what went up, and sends the client the new numbers.
   */
  refreshStats(this: WorldRoom, p: Player, client: Client | undefined) {
    const taught = new Set(p.unlocked);
    const before = { ...p.levels };
    p.unlocked = unlockedSkills(p.quest);
    p.levels = disciplineLevels(p.skillXp, p.unlocked);
    const oldHp = p.maxHp, oldStamina = p.maxStamina;
    p.maxHp = this.maxHpOf(p);
    if (p.maxHp > oldHp) p.hp += p.maxHp - oldHp; // the new health comes filled
    p.hp = Math.min(p.hp, p.maxHp);
    p.maxStamina = this.maxStaminaOf(p);
    if (p.maxStamina > oldStamina) p.stamina += p.maxStamina - oldStamina;
    p.stamina = Math.min(p.stamina, p.maxStamina);
    p.mana = Math.min(p.mana, this.maxManaOf(p));
    p.stepMs = this.stepMsOf(p);
    if (!client) return;
    for (const id of p.unlocked) {
      if (!taught.has(id) && p.levels) {
        const { def } = findSkill(id);
        this.say(client, `📖 You've learned ${def.name}! ${def.description}`);
      }
    }
    for (const d of DISCIPLINE_IDS) {
      if (p.levels[d] > before[d]) {
        this.say(client, `Congratulations, your ${DISCIPLINES[d].name} is now level ${p.levels[d]}! ${this.statNote(p, d)}`);
        client.send("levelup", { discipline: d, level: p.levels[d] });
      }
    }
    this.sendDisciplines(client, p);
    this.sendVitals(client, p);
    this.sendStamina(client, p);
    if (!taught.has("magic") && p.unlocked.includes("magic")) this.sendSpellbook(client, p); // Rowan just taught you: Firebolt goes on the bar
  },
  /** What a Discipline level-up did for you: "Max health 60." */
  statNote(this: WorldRoom, p: Player, d: DisciplineId) {
    switch (d) {
      case "strength": return `Max health ${p.maxHp}.`;
      case "endurance": return `Max stamina ${p.maxStamina}.`;
      case "wisdom": return `Max mana ${this.maxManaOf(p)}.`;
      case "dexterity": return `You can carry ${kg(this.capacity(p))}, and walk ${Math.round(walkBonus(p.levels.dexterity) * 100)}% faster.`;
      case "charisma": return "Shops pay you a little more and charge you a little less.";
    }
  },
  /** After buying or resetting: max health may change, and the client redraws the trees. */
  treeChanged(this: WorldRoom, client: Client, p: Player) {
    const max = this.maxHpOf(p);
    if (max !== p.maxHp) {
      p.hp = Math.max(1, Math.min(max, p.hp + Math.max(0, max - p.maxHp)));
      p.maxHp = max;
      this.sendVitals(client, p);
    }
    client.send("tree", p.tree);
    this.saveSoon(p);
  },
  /** Health, mana and their maximums (only you see your mana). */
  sendVitals(this: WorldRoom, client: Client, p: Player) {
    client.send("vitals", { hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: this.maxManaOf(p) });
  },
  /** Rings or amulet changed: new stats, and tell the client. */
  /** Armor went on or off: max health may change (Vitality). New health starts empty, like a ring's. */
  gearStatsChanged(this: WorldRoom, client: Client, p: Player) {
    // Vitality armor changes max health; cloth changes max mana.
    p.maxHp = this.maxHpOf(p);
    p.hp = Math.min(p.hp, p.maxHp);
    p.mana = Math.min(p.mana, this.maxManaOf(p));
    this.sendVitals(client, p);
  },
  jewelsChanged(this: WorldRoom, client: Client, p: Player) {
    // Extra max health or stamina from a jewel starts empty and fills up over
    // time, so taking a ring off and on again can't heal you.
    const hp = p.hp, stamina = p.stamina;
    this.refreshStats(p, client);
    p.hp = Math.min(hp, p.maxHp);
    p.stamina = Math.min(stamina, p.maxStamina);
    client.send("jewels", p.jewels);
    this.sendInventory(client, p);
    this.sendVitals(client, p);
    this.sendStamina(client, p);
    this.saveSoon(p);
  },
  sendGear(this: WorldRoom, client: Client, p: Player) {
    p.held = p.gear.weapon?.item ?? "";
    // The armor everyone sees you wearing (the weapon is `held`; a shield is armor too).
    p.worn = (["head", "body", "legs", "feet", "offhand"] as const).map((sl) => p.gear[sl]?.item ?? "").filter((id) => id && !isWeapon(id)).join(",");
    client.send("gear", { gear: p.gear, spell: p.spell });
  },
  /** Skill level (up to 99): unlocks better types. */
  addSkillXp(this: WorldRoom, p: Player, client: Client | undefined, skill: SkillId, xp: number) {
    if (!isUnlocked(p.unlocked, skill)) return; // no XP in a skill nobody has taught you yet
    const before = levelForXp(p.skillXp[skill]);
    // The skill tree's "Quick learner": more skill XP (rounded at random, so small amounts still count).
    let boosted = xp * (1 + this.tree(p, skill, "xp")) * (1 + buffPower(p.buffs, "blessed", worldNow()) / 100);
    // Ember Debt: while you carry Tithe marks, the shrine takes a fifth.
    if (p.tithe > 0) {
      const tithe = boosted * TITHE_SHARE;
      boosted -= tithe;
      p.titheXp += tithe;
      const cost = titheCost(Math.max(...Object.values(p.levels)));
      if (p.titheXp >= cost) {
        p.titheXp -= cost;
        p.tithe--;
        if (!p.tithe) p.titheXp = 0;
        if (client) this.say(client, p.tithe ? `⛓️ A Tithe mark fades. ${p.tithe} left.` : "⛓️ Your last Tithe mark fades. All your XP is yours again.");
      }
    }
    p.skillXp[skill] += Math.floor(boosted) + (Math.random() < boosted % 1 ? 1 : 0);
    const after = levelForXp(p.skillXp[skill]);
    if (!client) {
      if (after > before) this.refreshStats(p, undefined);
      return;
    }
    this.sendMastery(client, p);
    this.sendDisciplines(client, p); // the floating "+5 Fishing XP" comes from this
    if (after > before) {
      const { def } = findSkill(skill);
      this.say(client, `Your ${def.name} level is now ${after}!`);
      if (skill === "cooking") {
        for (const dish of DISH_IDS) {
          const lv = DISHES[dish].level;
          if (lv > before && lv <= after) this.say(client, `You can now cook ${DISHES[dish].icon} ${DISHES[dish].name.toLowerCase()}! ${DISHES[dish].note}.`);
        }
        for (const fish of resourcesFor("fishing")) {
          const lv = RESOURCES[fish].level;
          if (lv > 1 && lv > before && lv <= after) this.say(client, `You can now cook ${ITEMS[RESOURCES[fish].item].name.toLowerCase()}!`);
        }
      } else if (skill === "farming") {
        for (const c of CROP_IDS) {
          const lv = CROPS[c].level;
          if (lv > 1 && lv > before && lv <= after) this.say(client, `🌱 You can now grow ${ITEMS[CROPS[c].produce].name.toLowerCase()}! Farmer Odo sells the seeds.`);
        }
      } else if (skill === "smithing") {
        // One new thing at the anvil each level (version 0.22).
        for (const m of MATERIAL_IDS) {
          for (const t of SMITH_ORDER) {
            const lv = smithLevel(t, MATERIALS[m].level);
            if (lv > before && lv <= after) this.say(client, `🔨 You can now make ${t === "rod" ? "fishing rods" : `${MATERIALS[m].name.toLowerCase()} ${t === "tongs" ? "tongs" : t === "platelegs" ? "platelegs" : t === "darts" ? "darts" : `${t}s`}`} at the anvil!`);
          }
        }
      } else if (skill === "handicraft") {
        for (const b of Object.values(BAITS)) if (b.level > before && b.level <= after) this.say(client, `You can now make ${b.name.toLowerCase()} at the workbench!`);
        const now = (lv: number) => lv > before && lv <= after;
        for (const [w, lv] of Object.entries(WOOD_LEVEL)) {
          if (now(lv)) this.say(client, `🪵 You can now carve ${w} staffs at the workbench!`);
          if (now(lv + 2)) this.say(client, `🏹 You can now carve ${w} bows at the workbench!`);
        }
        for (const [m, lv] of Object.entries(ARROW_LEVEL)) if (now(lv)) this.say(client, `🏹 You can now make ${m} arrows at the workbench!`);
        for (const t of TANNING) if (now(t.level)) this.say(client, `🟫 You can now tan ${ITEMS[t.hide].name.toLowerCase()} into leather at the tanning rack!`);
        if (now(THREAD_LEVEL)) this.say(client, "🧵 You can now spin spider silk into thread at the spinning wheel!");
        if (now(CLOTH_LEVEL)) this.say(client, "🧶 You can now weave cloth at the spinning wheel!");
        for (const soft of ["leather", "cloth"] as const) {
          for (const [type, lv] of Object.entries(SOFT_LEVEL[soft])) if (now(lv!)) this.say(client, `You can now make ${SOFT_NAMES[soft][type as ArmorType]!.toLowerCase()} at the workbench!`);
        }
      } else if (skill === "defense") {
        for (const m of Object.values(METALS)) if (m.level > before && m.level <= after) this.say(client, `You can now wear ${m.name.toLowerCase()} armor!`);
        this.sendVitals(client, p);
      } else if (skill === "melee" || skill === "ranged" || skill === "magic") {
        for (const w of Object.values(WEAPONS)) if (w.style === skill && w.level > before && w.level <= after) this.say(client, `You can now use ${aOr(w.name.toLowerCase())}!`);
        if (skill === "magic") {
          for (const id of SPELL_IDS) {
            const sp = SPELLS[id];
            if (sp.level <= before || sp.level > after) continue;
            if (sp.book) {
              if (p.books.includes(id)) this.say(client, `You can now cast ${sp.icon} ${sp.name}!`);
              continue;
            }
            const placed = this.addToBar(p, id);
            this.say(client, `You can now cast ${sp.icon} ${sp.name}! ${placed ? "It's on your spell bar." : "Your spell bar is full: press ✎ on it to swap it in."}`);
          }
          this.sendSpellbook(client, p);
        }
      } else if (skill === "alchemy") {
        for (const t of POTION_TYPES) {
          const d = POTIONS[t];
          if (d.level > before && d.level <= after) this.say(client, d.hidden ? "⚗️ Your Alchemy is good enough for a hidden recipe now. Keep experimenting!" : `⚗️ You can now brew ${d.name.toLowerCase()}s!`);
        }
      } else if (skill === "foraging") {
        for (const f of FORAGE_FINDS) if (f.level > before && f.level <= after) this.say(client, `🌱 You can now dig up ${ITEMS[f.item].name.toLowerCase()}${f.night ? " (at night)" : ""}!`);
      } else if (skill === "renown") {
        for (let r = 1; r < RENOWN_RANKS.length; r++) {
          if (RENOWN_RANKS[r].level > before && RENOWN_RANKS[r].level <= after) this.say(client, `🏅 Your Renown is ${after}: Captain Bryn has a new rank for you (${RENOWN_RANKS[r].title}). Go and see him!`);
        }
        this.say(client, "📋 Bounties ask for a little more now, and pay more too.");
      } else if (skill === "trading") {
        const now = (lv: number) => lv > before && lv <= after;
        for (const id of SHOP_IDS) for (const r of SHOPS[id].rare ?? []) if (now(r.trading)) this.say(client, `💰 ${SHOPS[id].title.replace(/^\S+ /, "")} will sell you ${ITEMS[r.item].name.toLowerCase()} now.`);
        this.say(client, "💰 Shops pay you a little more and charge a little less.");
      } else if (isCraftSkill(skill)) {
        for (const m of Object.values(METALS)) {
          if (m.level > before && m.level <= after) {
            this.say(client, skill === "smelting" ? `You can now smelt ${m.name.toLowerCase()} bars!` : `You can now make ${m.name.toLowerCase()} tools!`);
          }
        }
        if (skill === "smelting") {
          for (const b of Object.values(JEWEL_BARS)) if (b.level > before && b.level <= after) this.say(client, `You can now smelt ${b.name.toLowerCase()}s!`);
        } else if (skill === "smithing") {
          for (const m of Object.values(JEWEL_METALS)) if (m.level > before && m.level <= after) this.say(client, `💍 You can now make ${m.name.toLowerCase()} rings and amulets!`);
          for (const [g, lv] of Object.entries(CUT_LEVEL)) {
            if (lv > before && lv <= after) this.say(client, g === "soul" ? "💎 You can now cut emberstone into refined emberstones!" : `💎 You can now cut ${GEMS[g as GemId].name.toLowerCase()}s!`);
          }
        }
      } else {
        for (const id of resourcesFor(skill)) {
          const r = RESOURCES[id];
          if (r.level > before && r.level <= after) this.say(client, `You can now ${verbFor(id)}!`);
        }
      }
      client.send("skillup", { skill, level: after });
      this.refreshStats(p, client); // Discipline levels, health, stamina, mana, speed...
      this.checkQuest(p, client); // "Reach Fishing level 3" steps
    }
  },
  /** Mastery in one type (no cap): faster at it, and it sells for more. */
  addMasteryXp(this: WorldRoom, p: Player, client: Client | undefined, id: MasteryId, xp: number) {
    const before = masteryLevelIn(p.mastery, id);
    p.mastery[id] = (p.mastery[id] ?? 0) + xp;
    const after = masteryLevelIn(p.mastery, id);
    if (!client || after <= before) return;
    const crafted = !(id in RESOURCES);
    this.say(client, `${masteryName(id)} Mastery ${after}! ` + (id.startsWith("crop_")
      ? `${Math.round((after - 1) * MASTERY_EXTRA * 100)}% chance of an extra one each harvest.`
      : crafted
      ? `Fewer failures, and it sells for ${valueBonusPercent(after)}% more.`
      : `${speedBonusPercent(after)}% faster, sells for ${valueBonusPercent(after)}% more.`));
    client.send("masteryup", { resource: id, level: after });
    if (this.step(p)?.goal.kind === "spendPoint") this.sendQuest(client, p); // "you have a point to spend"
  },
  /** Discipline levels and the skills you've been taught. (The client works out the stats from these too.) */
  sendDisciplines(this: WorldRoom, client: Client, p: Player) {
    client.send("disciplines", { levels: p.levels, unlocked: p.unlocked });
  },
  /** Skill levels and per-type Mastery, both shown in the Skills panel. */
  sendMastery(this: WorldRoom, client: Client, p: Player) {
    client.send("skillxp", p.skillXp);
    client.send("mastery", p.mastery);
  },
  say(this: WorldRoom, client: Client, text: string) {
    client.send("message", text);
  },
  /** Carrying more than you can: slower, and say so when it changes (report #31). */
  checkLoad(this: WorldRoom, client: Client, p: Player) {
    const lv = loadLevel(this.carried(p), this.capacity(p));
    if (lv === p.loadLevel) return;
    const was = p.loadLevel;
    p.loadLevel = lv;
    if (lv > 0) p.running = false; // too heavy to run (version 0.22)
    client.send("heavy", lv > 0);
    p.stepMs = this.stepMsOf(p);
    const SPEED = ["", "half speed, and you can't run", "a quarter of your speed", "an eighth of your speed"];
    if (lv > was) this.say(client, `🏋️ You're carrying ${kg(this.carried(p))}, more than the ${kg(this.capacity(p))} you can carry. You slow to ${SPEED[lv]}. Sell, trash or eat something, or use your enchanted chest.`);
    else if (lv === 0) this.say(client, "🎒 Your load is light enough again: you're back to full speed.");
    else this.say(client, `🏋️ A little lighter: you're at ${SPEED[lv]} now.`);
  },
};

/** The messages from players about this. */
export function registerStats(this: WorldRoom) {
    // Mastery skill trees: buy the next rank of an upgrade with Mastery points.
    this.onMessage("treeBuy", (client, msg: { node: string }) => {
      const p = this.state.players.get(client.sessionId);
      const node = treeNode(String(msg?.node));
      if (!p || !node) return;
      const rank = p.tree[node.id] ?? 0;
      if (rank >= node.maxRank) return this.say(client, `${node.name} is already at its top rank.`);
      const free = this.freePoints(p);
      const cost = rankCost(rank + 1);
      if (free < cost) return this.say(client, `Rank ${rank + 1} of ${node.name} costs ${cost} Mastery point${cost === 1 ? "" : "s"}, and you have ${free}. Every Mastery level you gain earns one.`);
      p.tree[node.id] = rank + 1;
      this.say(client, `🌳 ${findSkill(node.skill).def.name}: ${node.name} rank ${rank + 1}!`);
      this.treeChanged(client, p);
      this.checkQuest(p, client); // Maren's "spend a Mastery point" step
    });
    // Reset one skill's tree (or every tree): free for now, all the points come back.
    this.onMessage("treeReset", (client, msg: { skill?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const skill = msg?.skill && msg.skill in TREES ? (msg.skill as SkillId) : null;
      const before = spentPoints(p.tree);
      for (const id of Object.keys(p.tree)) if (!skill || treeNode(id)?.skill === skill) delete p.tree[id];
      const back = before - spentPoints(p.tree);
      if (!back) return;
      this.say(client, `🌳 You reset ${skill ? `your ${findSkill(skill).def.name} tree` : "all your skill trees"}. ${back} Mastery point${back === 1 ? "" : "s"} back to spend.`);
      this.treeChanged(client, p);
    });
}
