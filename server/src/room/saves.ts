// Loading and saving characters.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { type } from "@colyseus/schema";
import { WAKE_SPOT, doorAt, isWalkable, randomSpawn, spotNear } from "../../../shared/map";
import { masteryLevelForXp } from "../../../shared/mastery";
import { SkillId, disciplineLevels, levelForXp, xpForLevel } from "../../../shared/disciplines";
import { ALL_MASTERY_IDS, gearDurability } from "../../../shared/crafting";
import { ALL_COMBAT_MASTERY_IDS, HEALTH_REGEN_MS, SPELLS, SPELL_IDS, SpellId, BoltSpellId, isBoltSpell } from "../../../shared/combat";
import { GEAR_SLOTS, gearSlot, isGear } from "../../../shared/gear";
import { TOOL_TYPE_IDS, isTool, legacyTool, maxDurability, parseTool } from "../../../shared/tools";
import { INVENTORY_SIZE, ITEMS, ItemId, LEGACY_ITEMS, STONE_TO_BRONZE_USES, legacyStone } from "../../../shared/items";
import { stackLimit, wearsOut, clearEntry, cloneBag, compact, emptyBag } from "../../../shared/bag";
import { JEWEL_SLOTS, emptyJewels, isJewelry, parseGem } from "../../../shared/jewelry";
import { BUFF_IDS, POTIONS, POTION_TYPES } from "../../../shared/alchemy";
import { STAMINA_REGEN_MS, legacyStew } from "../../../shared/cooking";
import { BAITS, isBait } from "../../../shared/handicraft";
import { cleanRanks } from "../../../shared/skilltree";
import { QUEST_REV, migrateQuest, unlockedSkills, rankOf } from "../../../shared/quests";
import { BOUNTY_COUNT, validBounty, boardDay } from "../../../shared/bounties";
import { MAP_REV, SAVE_VERSION, SaveData, store } from "../storage";
import { RENOWN_RANKS } from "../../../shared/renown";
import { TITHE_MAX } from "../../../shared/story";
import { Player } from "./schema";
import { STONE_PRICE, MIN_SAVE_GAP_MS, worldNow } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const savesMethods = {
  // ---- Saving and loading ----

  restore(this: WorldRoom, p: Player, save: SaveData) {
    // Saves from before the tutorial (or an older save version) start over from
    // scratch, so everyone plays Old Maren's tutorial. The account itself is kept.
    if (save.saveVersion !== SAVE_VERSION) {
      if (Object.keys(save).length) console.log(`${p.name}: old save (version ${save.saveVersion ?? "none"}), starting over`);
      save = {};
      // New characters wake up on the steps of the Heart Shrine, inside the Emberhall.
      const spawn = spotNear(WAKE_SPOT);
      p.x = spawn.x;
      p.y = spawn.y;
      return;
    }
    if (save.quest) p.quest = migrateQuest(save.quest, save.questRev);
    p.rank = rankOf(p.quest);
    if (typeof save.tithe === "number" && Number.isInteger(save.tithe)) p.tithe = Math.max(0, Math.min(TITHE_MAX, save.tithe));
    if (p.tithe && typeof save.titheXp === "number" && Number.isFinite(save.titheXp)) p.titheXp = Math.max(0, save.titheXp);
    if (save.mapRev === MAP_REV && Number.isInteger(save.x) && Number.isInteger(save.y) && isWalkable(save.x!, save.y!) && !doorAt(save.x!, save.y!)) {
      p.x = save.x!;
      p.y = save.y!;
    } else {
      // From before the world grew (or somewhere that isn't there any more): the town square.
      const spawn = randomSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
      if (save.mapRev !== MAP_REV) {
        p.loginNotes.push("🏰 Welcome to the new Emberhold! The town is now a walled stone city. You're on the Emberhall's plaza. Every trainer now teaches in the Emberhall Training Ground, right next door (east of the Emberhall). The city gates are shut for now. Tap 🗺️ (top right) for a map of the city.");
      }
    }
    // Load the saved bag as it was (older saves had 28 slots, one entry each), then fit it into today's bag below.
    let stoneRefund = 0;
    const grouped = Array.isArray(save.slots);
    const entries = Array.isArray(save.inventory) ? Math.min(save.inventory.length, grouped ? 1000 : 28) : 0;
    const old = emptyBag(grouped ? INVENTORY_SIZE : entries);
    if (Array.isArray(save.inventory)) {
      for (let i = 0; i < entries; i++) {
        clearEntry(old, i); // start empty, so the lists have no gaps
        const slot = grouped ? save.slots![i] : i;
        if (!Number.isInteger(slot) || slot < 0 || slot >= old.slotCount) continue;
        old.slotOf[i] = slot;
        let item = save.inventory[i];
        if (item === "stone") {
          // Stone isn't in the game any more: it's paid out at what it sold for.
          const n = save.counts?.[i];
          stoneRefund += (Number.isInteger(n) && n! >= 1 ? Math.min(n!, 1000) : 1) * STONE_PRICE;
          old.slotOf[i] = -1;
          continue;
        }
        if (typeof item === "string" && item in LEGACY_ITEMS) item = LEGACY_ITEMS[item]; // logs -> pine logs, etc.
        if (typeof item === "string") item = legacyTool(item) ?? item; // metal-headed rods -> wooden rods
        if (typeof item === "string") item = legacyStew(item) ?? item; // old fish stews -> stews
        const wasStone = typeof item === "string" && legacyStone(item) != null;
        if (typeof item === "string") item = legacyStone(item) ?? item; // stone tools, weapons and arrows -> bronze
        old.inventory[i] = typeof item === "string" && item in ITEMS ? (item as ItemId) : null;
        const it = old.inventory[i];
        if (!it) { old.slotOf[i] = -1; continue; }
        // How many in the stack (saves from before stacks had one per slot).
        const n = save.counts?.[i];
        old.counts[i] = wearsOut(it) ? 1 : Number.isInteger(n) && n! >= 1 ? Math.min(n!, stackLimit(it)) : 1;
        if (isTool(it) || isGear(it) || isBait(it)) {
          const max = isTool(it) ? maxDurability(it) : isGear(it) ? gearDurability(it) : BAITS[it].uses;
          let d = save.durability?.[i];
          if (wasStone && typeof d === "number" && d > 0) d *= STONE_TO_BRONZE_USES; // bronze lasts longer than stone did
          // Broken tools and gear (0 uses left) stay broken; bait at 0 would have been used up.
          old.durability[i] = typeof d === "number" && (d > 0 || (d === 0 && !isBait(it))) ? Math.min(Math.floor(d), max) : max;
        }
      }
    }
    for (const type of TOOL_TYPE_IDS) {
      const t = save.belt?.[type];
      if (t && typeof t.item === "string") t.item = legacyTool(t.item) ?? t.item;
      if (t && typeof t.item === "string" && legacyStone(t.item) && typeof t.durability === "number") {
        t.item = legacyStone(t.item)!; // a stone tool on the belt -> bronze
        t.durability *= STONE_TO_BRONZE_USES;
      }
      if (t && isTool(t.item) && parseTool(t.item).type === type && typeof t.durability === "number" && t.durability > 0) {
        p.belt[type] = { item: t.item, durability: Math.min(Math.floor(t.durability), maxDurability(t.item)) };
      }
    }
    if (typeof save.coins === "number" && Number.isFinite(save.coins) && save.coins >= 0) p.coins = Math.floor(save.coins);
    if (stoneRefund) {
      p.coins += stoneRefund;
      p.loginNotes.push(`🪨 Stone isn't mined any more, so the stone in your bag was sold for you: +${stoneRefund} bronze coins.`);
    }
    // Stamina also came back while you were logged out (1 every 30 seconds). Old saves start full.
    if (typeof save.stamina === "number" && Number.isFinite(save.stamina)) {
      const away = typeof save.staminaAt === "number" ? Math.max(0, Date.now() - save.staminaAt) : 0;
      p.stamina = Math.max(0, Math.floor(save.stamina) + Math.floor(away / STAMINA_REGEN_MS)); // capped below, once Endurance is known
    }
    if (Array.isArray(save.lockedSlots)) {
      for (const i of save.lockedSlots) if (Number.isInteger(i) && i >= 0 && i < old.inventory.length && old.inventory[i]) old.locked[i] = true;
    } else if (Array.isArray(save.locked)) {
      // Briefly, locks were per item type: lock every item of those types that's in the bag.
      old.inventory.forEach((item, i) => { if (item && save.locked!.includes(item)) old.locked[i] = true; });
    }
    this.restoreGuild(p, save.guild);
    p.farmChest = save.farmChest === true;
    if (Number.isInteger(save.renownRank)) p.renownRank = Math.max(0, Math.min(RENOWN_RANKS.length - 1, save.renownRank!));
    if (Number.isInteger(save.boardDay)) p.boardDay = save.boardDay!;
    if (Number.isInteger(save.guildDay)) p.guildDay = save.guildDay!;
    if (typeof save.title === "string") p.title = save.title;
    this.fitOldBag(p, old);
    const ok = (xp: unknown): xp is number => typeof xp === "number" && Number.isFinite(xp) && xp >= 0;
    for (const id of Object.keys(p.skillXp) as SkillId[]) {
      if (save.skillXp) {
        if (ok(save.skillXp[id])) p.skillXp[id] = Math.floor(save.skillXp[id]);
      } else if (ok(save.mastery?.[id])) {
        // Older saves had one Mastery per skill. That level becomes the skill's level.
        p.skillXp[id] = xpForLevel(Math.min(99, masteryLevelForXp(save.mastery[id])));
      }
    }
    if (save.skillXp) {
      for (const id of ALL_MASTERY_IDS) if (ok(save.mastery?.[id])) p.mastery[id] = Math.floor(save.mastery![id]);
      // Before dishes there was one "Fish stew" Mastery: it's now your Stew Mastery.
      if (ok(save.mastery?.fish_stew)) p.mastery.stew = (p.mastery.stew ?? 0) + Math.floor(save.mastery!.fish_stew);
    }
    // Combat: gear, Mastery, health (it came back 1 a minute while you were away) and mana (full).
    for (const slot of GEAR_SLOTS) {
      const g = save.gear?.[slot];
      if (g && typeof g.item === "string" && legacyStone(g.item) && typeof g.durability === "number") {
        g.item = legacyStone(g.item)!; // a stone weapon -> bronze
        g.durability *= STONE_TO_BRONZE_USES;
      }
      if (g && isGear(g.item) && gearSlot(g.item) === slot && typeof g.durability === "number" && g.durability > 0) {
        p.gear[slot] = { item: g.item, durability: Math.min(Math.floor(g.durability), gearDurability(g.item)) };
      }
    }
    for (const id of ALL_COMBAT_MASTERY_IDS) if (ok(save.combatMastery?.[id])) p.combatMastery[id] = Math.floor(save.combatMastery![id]);
    if (isBoltSpell(save.spell ?? "") && levelForXp(p.skillXp.magic) >= SPELLS[save.spell as BoltSpellId].level) p.spell = save.spell as BoltSpellId;
    p.books = SPELL_IDS.filter((id) => SPELLS[id].book && save.books?.includes(id));
    // No bar saved yet (an old save): it fills with the spells you know the first time it's sent.
    p.spellBar = Array.isArray(save.spellBar) ? save.spellBar.slice(0, 8).map((id) => (SPELL_IDS.includes(id as SpellId) ? id as SpellId : null)) : [];
    p.barFresh = !Array.isArray(save.spellBar);
    p.tree = cleanRanks(save.tree);
    p.jewels = emptyJewels();
    for (const s of JEWEL_SLOTS) {
      const j = save.jewels?.[s];
      if (isJewelry(j) && (s === "amulet") === ((parseGem(j) as { type: string }).type === "amulet")) p.jewels[s] = j;
    }
    p.discovered = POTION_TYPES.filter((t) => POTIONS[t].hidden && save.discovered?.includes(t));
    p.buffs = {};
    for (const id of BUFF_IDS) {
      const b = save.buffs?.[id];
      if (b && Number.isFinite(b.until) && Number.isFinite(b.power) && b.until > worldNow()) p.buffs[id] = { until: b.until, power: b.power };
    }
    p.invisible = !!p.buffs.invisible;
    // Skills taught, Discipline levels, and the stats they give.
    p.unlocked = unlockedSkills(p.quest);
    p.levels = disciplineLevels(p.skillXp, p.unlocked);
    p.maxStamina = this.maxStaminaOf(p);
    p.stamina = Math.min(p.stamina, p.maxStamina);
    p.stepMs = this.stepMsOf(p);
    p.maxHp = this.maxHpOf(p);
    p.hp = p.maxHp;
    if (typeof save.hp === "number" && Number.isFinite(save.hp)) {
      const away = typeof save.hpAt === "number" ? Math.max(0, Date.now() - save.hpAt) : 0;
      p.hp = Math.max(1, Math.min(p.maxHp, Math.floor(save.hp) + Math.floor(away / HEALTH_REGEN_MS)));
    }
    p.mana = this.maxManaOf(p);
    if (Array.isArray(save.bounties)) for (const b of save.bounties) if (b && typeof b.item === "string") b.item = legacyStone(b.item) ?? b.item; // stone -> bronze
    if (Array.isArray(save.bounties)) p.bounties = save.bounties.filter(validBounty).slice(0, BOUNTY_COUNT);
    if (typeof save.tracked === "string") save.tracked = legacyStone(save.tracked) ?? save.tracked;
    if (typeof save.tracked === "string" && p.bounties.some((b) => b.item === save.tracked)) p.tracked = save.tracked as ItemId;
  },
  snapshot(this: WorldRoom, p: Player): SaveData {
    // Save where the player is heading, so walking off mid-path doesn't lose the move.
    const dest = p.path.length ? p.path[p.path.length - 1] : p;
    const bag = cloneBag(p);
    compact(bag); // leave out unused entries
    return { saveVersion: SAVE_VERSION, mapRev: MAP_REV, questRev: QUEST_REV, quest: structuredClone(p.quest), x: dest.x, y: dest.y, inventory: bag.inventory, slots: bag.slotOf, coins: p.coins, skillXp: { ...p.skillXp }, mastery: { ...p.mastery }, durability: bag.durability, belt: { ...p.belt }, stamina: p.stamina, staminaAt: Date.now(), hp: p.hp, hpAt: Date.now(), gear: { ...p.gear }, spell: p.spell, combatMastery: { ...p.combatMastery }, tree: { ...p.tree }, lockedSlots: bag.locked.flatMap((on, i) => (on ? [i] : [])), bounties: p.bounties.map((b) => ({ ...b })), tracked: p.tracked ?? undefined, color: p.color, look: p.look || undefined, counts: bag.counts, jewels: { ...p.jewels }, discovered: [...p.discovered], books: [...p.books], spellBar: p.barFresh ? undefined : [...p.spellBar], buffs: structuredClone(p.buffs), guild: this.guildSave(p), farmChest: p.farmChest || undefined, renownRank: p.renownRank || undefined, title: p.title || undefined, tithe: p.tithe || undefined, titheXp: p.tithe ? Math.floor(p.titheXp) : undefined, boardDay: p.boardDay || undefined, guildDay: p.guildDay || undefined };
  },
  async save(this: WorldRoom, p: Player) {
    p.dirty = false;
    p.lastSavedAt = Date.now();
    try {
      await store.save(p.name, this.snapshot(p));
    } catch (err: any) {
      p.dirty = true; // try again on the next autosave
      console.error(`Saving ${p.name} failed:`, err.message);
    }
  },
  /** For important changes (items gained or lost): save now, unless we saved very recently. */
  saveSoon(this: WorldRoom, p: Player) {
    p.dirty = true;
    if (Date.now() - p.lastSavedAt >= MIN_SAVE_GAP_MS) void this.save(p);
  },
  autosave(this: WorldRoom) {
    this.state.players.forEach((p) => { if (p.dirty) void this.save(p); });
  },
};
