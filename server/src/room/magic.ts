// Spells, the spell bar, staffs, enchanting.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { type } from "@colyseus/schema";
import { TICK_MS } from "../../../shared/map";
import { isUnlocked, levelForXp } from "../../../shared/disciplines";
import { MONSTERS, SPELLS, SPELL_IDS, SpellId, attackFor, combatMasteryIn, tileDistance, BoltSpellId, isBoltSpell } from "../../../shared/combat";
import { ITEMS, ItemId } from "../../../shared/items";
import { takeFromEntry, takeItem } from "../../../shared/bag";
import { NOVA_RADIUS, TARGET_RANGE, barSlots, knownSpells, novaMaxHit, spellMana, spellPower, spellSeconds } from "../../../shared/spells";
import { ENCHANTS, EnchantId, Inlay, addEnchant, cappedGem, chainPercent, describeEnchant, enchantForGem, enchantKind, enchantsOf, fits, frostTicks, isEnchantId, isSpent, lifeStealPercent, poisonDamage, soulPower, stripEnchants } from "../../../shared/enchanting";
import { baseItem } from "../../../shared/tools";
import { isSoulGem, soulCapacity, parseGem } from "../../../shared/jewelry";
import { buffPower } from "../../../shared/alchemy";
import { treeRoll } from "../../../shared/skilltree";
import { kindName } from "../../../shared/repair";
import { Player, Monster } from "./schema";
import { worldNow } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const magicMethods = {
  /** Mastery of a weapon type, spell or monster (no cap). */
  /** Spells this player knows right now. */
  known(this: WorldRoom, p: Player): SpellId[] {
    return isUnlocked(p.unlocked, "magic") ? knownSpells(levelForXp(p.skillXp.magic), p.books) : [];
  },
  /** The spell bar, the spells you know, and how many slots you have. */
  sendSpellbook(this: WorldRoom, client: Client, p: Player) {
    const slots = barSlots(p.combatMastery);
    // A new or old save with no bar yet: fill it once you know a spell (Rowan teaches Firebolt).
    if (p.barFresh && this.known(p).length) {
      p.barFresh = false;
      p.spellBar = [];
      for (const id of this.known(p)) this.addToBar(p, id);
    }
    while (p.spellBar.length < slots) p.spellBar.push(null);
    client.send("spellbook", { bar: p.spellBar.slice(0, slots), known: this.known(p), books: p.books, bolt: p.spell });
  },
  /** Put a newly learned spell in the first empty slot. False if the bar is full. */
  addToBar(this: WorldRoom, p: Player, id: SpellId): boolean {
    if (p.spellBar.includes(id)) return true;
    const slots = barSlots(p.combatMastery);
    while (p.spellBar.length < slots) p.spellBar.push(null);
    const i = p.spellBar.findIndex((s, n) => s === null && n < slots);
    if (i < 0) return false;
    p.spellBar[i] = id;
    p.dirty = true;
    return true;
  },
  /** Pick which bolt your staff fires. */
  pickBolt(this: WorldRoom, client: Client, p: Player, id: BoltSpellId) {
    const level = levelForXp(p.skillXp.magic);
    if (level < SPELLS[id].level) return this.say(client, `You need Spellcasting level ${SPELLS[id].level} to cast ${SPELLS[id].name}. (You're level ${level}.)`);
    p.spell = id;
    const mana = spellMana(id, combatMasteryIn(p.combatMastery, id));
    const staff = attackFor(p.gear, id).style === "magic";
    this.say(client, staff ? `Your staff will cast ${SPELLS[id].icon} ${SPELLS[id].name} (${mana} mana). Click a monster to fire it.`
      : `${SPELLS[id].icon} ${SPELLS[id].name} flies from a staff. Hold one (Huntmaster Kael sells them), then click a monster.`);
    this.sendGear(client, p);
    this.sendSpellbook(client, p);
    p.dirty = true;
  },
  /** Invisibility breaks when you attack or gather. */
  breakInvisible(this: WorldRoom, p: Player, client: Client | undefined, why: "attack" | "gather") {
    if (!p.buffs.invisible) return;
    delete p.buffs.invisible;
    p.invisible = false;
    p.dirty = true;
    if (client) {
      this.say(client, `🫥 You ${why === "attack" ? "attack" : "get to work"}, and your invisibility breaks.`);
      this.sendBuffs(client, p);
    }
  },
  /** Cast a spell from the spell bar. */
  castSpell(this: WorldRoom, client: Client, p: Player, id: SpellId, sessionId: string) {
    const d = SPELLS[id];
    if (!isUnlocked(p.unlocked, "magic")) return this.say(client, this.notTaught("magic"));
    if (!this.known(p).includes(id)) {
      return this.say(client, d.book ? `You haven't learned ${d.name}. It comes from a spell book.` : `You need Spellcasting level ${d.level} to cast ${d.name}.`);
    }
    if (isBoltSpell(id)) return this.pickBolt(client, p, id);
    const now = Date.now();
    if (now < p.castReadyAt) return;
    const level = levelForXp(p.skillXp.magic);
    const mastery = combatMasteryIn(p.combatMastery, id);
    const mana = spellMana(id, mastery);
    if (p.mana < mana) return this.say(client, `You need ${mana} mana for ${d.name}, and you have ${p.mana}. It comes back 1 every 6 seconds.`);
    const world = worldNow();
    let xp = Math.ceil(mana / 2);
    let msg: string;
    if (id === "ward") {
      const power = spellPower(id, level, mastery);
      p.buffs.ward = { until: world + spellSeconds(id, mastery) * 1000, power };
      msg = `🛡️ A ward shimmers around you. It soaks up ${power} damage.`;
    } else if (id === "heal") {
      if (p.hp >= p.maxHp) return this.say(client, `You're already at full health (${p.maxHp}).`);
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + spellPower(id, level, mastery));
      msg = `💚 You heal ${p.hp - before} (${p.hp}/${p.maxHp}).`;
    } else if (id === "mend") {
      const problem = this.mend(client, p);
      if (problem) return this.say(client, problem);
      msg = "🪡 Threads of light knit your gear back together: good as new.";
    } else if (id === "haste") {
      const power = spellPower(id, level, mastery);
      p.buffs.haste = { until: world + spellSeconds(id, mastery) * 1000, power };
      msg = `💨 You feel light on your feet: ${power}% faster for ${spellSeconds(id, mastery)} seconds.`;
    } else if (id === "invisibility") {
      p.buffs.invisible = { until: world + spellSeconds(id, mastery) * 1000, power: 1 };
      p.invisible = true;
      this.stopActions(p);
      this.state.monsters.forEach((m) => { if (m.target === sessionId) m.target = null; });
      msg = `🫥 You fade from sight for ${spellSeconds(id, mastery)} seconds. Attacking or gathering breaks it.`;
    } else if (id === "soul_trap") {
      const m = this.trapTarget(p);
      if (!m) return this.say(client, `No monster close enough for ${d.name}. Stand within ${TARGET_RANGE} tiles of one (or attack it first).`);
      this.breakInvisible(p, client, "attack");
      const secs = spellSeconds(id, mastery, buffPower(p.buffs, "soultrap", world));
      m.trappedUntil = this.state.tick + Math.round(secs * 1000 / TICK_MS);
      m.trappedBy = sessionId;
      const gem = p.inventory.some((it) => isSoulGem(it) && (parseGem(it) as { souls: number; size: number }).souls < soulCapacity((parseGem(it) as { size: number }).size));
      msg = `👻 The ${MONSTERS[m.kind].name.toLowerCase()} glows purple: its ember is trapped for ${secs} seconds. Defeat it in time!` +
        (gem ? "" : " (You have no refined emberstone with room, so its ember would be lost. Brann cuts emberstone into refined emberstones.)");
    } else {
      // Frost nova: every monster next to you.
      const max = novaMaxHit(level, mastery);
      const hitList: Monster[] = [];
      this.state.monsters.forEach((m) => { if (m.alive && tileDistance(m, p) <= NOVA_RADIUS) hitList.push(m); });
      if (!hitList.length) return this.say(client, `No monsters within ${NOVA_RADIUS} tiles for ${d.name}.`);
      this.breakInvisible(p, client, "attack");
      let total = 0;
      for (const m of hitList) {
        const id2 = [...this.state.monsters.entries()].find(([, o]) => o === m)![0];
        const damage = 1 + Math.floor(Math.random() * max);
        m.hurtBy.set(sessionId, (m.hurtBy.get(sessionId) ?? 0) + Math.min(damage, m.hp));
        m.hp = Math.max(0, m.hp - damage);
        m.frozenUntil = this.state.tick + (d.freeze ?? 0);
        total += damage;
        this.broadcast("hit", { on: "monster", id: id2, damage, miss: false, spell: "frost_nova", from: sessionId });
        if (MONSTERS[m.kind].maxHit > 0 && !m.target) m.target = sessionId;
        if (m.hp <= 0) this.killMonster(m, p, client, "magic");
      }
      xp += total;
      msg = `🌨️ Ice bursts around you, hitting ${hitList.length} monster${hitList.length === 1 ? "" : "s"} for ${total} in all. They're frozen!`;
    }
    if (!treeRoll(p.tree, "magic", "manaSave")) p.mana -= mana;
    p.castReadyAt = now + 1500;
    p.stepMs = this.stepMsOf(p);
    p.dirty = true;
    this.say(client, msg);
    this.addSkillXp(p, client, "magic", xp);
    this.addCombatMastery(p, client, id, xp);
    this.sendVitals(client, p);
    this.sendBuffs(client, p);
    this.saveSoon(p);
  },
  /** The staff enchantment on the staff in your hand, if any. */
  staffEnchant(this: WorldRoom, p: Player) {
    const item = p.gear.weapon?.item;
    return enchantsOf(item).find((e) => ENCHANTS[e.id].on === "staff") ?? null;
  },
  /** What an enchanted staff's bolt does when it lands. */
  staffEffect(this: WorldRoom, p: Player, client: Client | undefined, sessionId: string, m: Monster, e: { id: EnchantId; gem: number }, damage: number) {
    const ct = e.gem / 10;
    if (e.id === "frost") m.frozenUntil = Math.max(m.frozenUntil, this.state.tick + frostTicks(ct));
    if (e.id === "poison") m.poison = { left: 4, damage: poisonDamage(ct), by: sessionId };
    if (e.id === "lifesteal" && damage) {
      const heal = Math.round(damage * lifeStealPercent(ct) / 100);
      if (heal && p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + heal); if (client) this.sendVitals(client, p); }
    }
    if (e.id === "lightning" && damage) {
      let other: Monster | null = null;
      let otherId = "";
      this.state.monsters.forEach((o, oid) => { if (!other && o !== m && o.alive && tileDistance(o, m) <= 3) { other = o; otherId = oid; } });
      const o = other as Monster | null;
      if (o) {
        const jump = Math.max(1, Math.round(damage * chainPercent(ct) / 100));
        o.hurtBy.set(sessionId, (o.hurtBy.get(sessionId) ?? 0) + Math.min(jump, o.hp));
        o.hp = Math.max(0, o.hp - jump);
        this.broadcast("hit", { on: "monster", id: otherId, damage: jump, miss: false, spell: "lightning", from: sessionId });
        if (MONSTERS[o.kind].maxHit > 0 && !o.target) o.target = sessionId;
        if (o.hp <= 0) this.killMonster(o, p, client, "magic");
      }
    }
  },
  /** How many enchantments an item may hold: 1, or 2 with the tree's Second slot. */
  enchantSlots(this: WorldRoom, p: Player) {
    return 1 + this.tree(p, "enchanting", "enchantSlot");
  },
  /** At the altar: put an enchantment on a bag item, using up a refined emberstone (and a cut gem and inlay for a staff). */
  enchant(this: WorldRoom, client: Client, p: Player, msg: { slot: number; soul: number; effect?: string; gem?: number; inlay?: string }) {
    if (!this.nearNpc(p, "altar")) return this.say(client, "You need to be at the enchanting altar in the Mages' Guild.");
    if (!isUnlocked(p.unlocked, "enchanting")) return this.say(client, this.notTaught("enchanting"));
    const item = p.inventory[msg.slot];
    const kind = enchantKind(item);
    if (!item || !kind) return this.say(client, "Only a staff, a piece of armor or a tool can be enchanted.");
    if (p.locked[msg.slot]) return this.say(client, "That's locked. Unlock it first.");
    const soulItem = p.inventory[msg.soul];
    const soul = parseGem(soulItem);
    if (!soulItem || soul?.kind !== "soulgem" || soul.souls <= 0) return this.say(client, "Pick a refined emberstone with ember in it. Cast 👻 Ember trap on a monster, then defeat it, to fill one.");
    // Which enchantment: a staff's comes from its gem; armor and tools pick one.
    let effect: EnchantId;
    let gemSize = 0;
    let inlay: Inlay = "none";
    if (kind === "staff") {
      const gemItem = msg.gem != null ? p.inventory[msg.gem] : null;
      const g = parseGem(gemItem);
      if (!gemItem || g?.kind !== "cut") return this.say(client, "A staff needs a cut gem too: ruby (fire), sapphire (frost), emerald (poison), topaz (lightning) or amethyst (life steal).");
      effect = enchantForGem(g.gem);
      if (msg.inlay === "silver_bar" || msg.inlay === "gold_bar") {
        if (!p.inventory.some((it, i) => it === msg.inlay && !p.locked[i])) return this.say(client, `You don't have a ${ITEMS[msg.inlay as ItemId].single} for the inlay.`);
        inlay = msg.inlay;
      }
      gemSize = cappedGem(g.size, inlay);
    } else {
      if (!msg.effect || !isEnchantId(msg.effect) || !fits(item, msg.effect)) return this.say(client, "That enchantment doesn't fit that item.");
      effect = msg.effect;
    }
    const current = enchantsOf(item);
    if (current.some((e) => e.id === effect)) return this.say(client, `It already has ${ENCHANTS[effect].name}. Take it off first.`);
    if (current.length >= this.enchantSlots(p)) {
      return this.say(client, current.length === 1 && this.enchantSlots(p) === 1
        ? "It already holds an enchantment. Take it off first (the old one is lost), or learn Second slot in the Enchanting tree."
        : "It can't hold any more enchantments.");
    }
    if (isSpent(item) && !current.length && !this.tree(p, "enchanting", "reenchant")) {
      return this.say(client, "This one had an enchantment taken off, and the magic won't take again. Re-enchant in the Enchanting tree lets you.");
    }
    const level = levelForXp(p.skillXp.enchanting);
    const power = soulPower(soul.souls, level, this.tree(p, "enchanting", "potency"));
    const out = addEnchant(item, { id: effect, power, gem: gemSize });
    // Use up the refined emberstone, the cut gem and the inlay (highest entries first, so slots don't shift under us).
    const gemSlot = kind === "staff" ? msg.gem! : -1;
    p.inventory[msg.slot] = out as ItemId;
    for (const e of [msg.soul, gemSlot].filter((x) => x >= 0).sort((a, b) => b - a)) takeFromEntry(p, e, 1);
    if (inlay !== "none") takeItem(p, inlay as ItemId, 1, (e) => !p.locked[e]);
    const desc = describeEnchant({ id: effect, power, gem: gemSize });
    this.say(client, `✨ The altar flares. Your ${ITEMS[baseItem(item) as ItemId].single} is enchanted with ${desc}.`);
    this.addSkillXp(p, client, "enchanting", 10 + Math.ceil(soul.souls / 2));
    this.sendInventory(client, p);
    this.questEvent(p, client, { kind: "enchant" });
    this.guildJob(p, client, "enchant");
    this.saveSoon(p);
  },
  /** Take every enchantment off a bag item. The magic is lost. */
  disenchant(this: WorldRoom, client: Client, p: Player, slot: number) {
    if (!this.nearNpc(p, "altar")) return this.say(client, "You need to be at the enchanting altar in the Mages' Guild.");
    const item = p.inventory[slot];
    if (!item || !enchantsOf(item).length) return;
    p.inventory[slot] = stripEnchants(item) as ItemId;
    this.say(client, `The enchantment on your ${ITEMS[baseItem(item) as ItemId].single} fades away. Its magic (and its refined emberstone) are gone.`);
    this.sendInventory(client, p);
    this.saveSoon(p);
  },
  /** Mend: fix your most worn tool, weapon or armor piece, using 1 of what it's made of. */
  mend(this: WorldRoom, client: Client, p: Player): string | null {
    // Version 0.22: Mend draws the ember out of a spare of the same kind in your bag (any axe for an axe), like Oswin does.
    const worn = this.repairJobs(p).filter((j) => j.where !== "bag").sort((a, b) => a.durability / a.max - b.durability / b.max);
    if (!worn.length) return "Nothing you're using is worn. (Mend fixes tools on your belt and gear you're wearing.)";
    const target = worn.find((j) => j.spare) ?? worn[0];
    if (!target.spare) return `Mend needs a spare ${kindName(target.kind)} in your bag: its ember goes into the one you're using. Any ${kindName(target.kind)} will do, but a finer one gives more.`;
    this.mendWith(p, target);
    this.sendInventory(client, p);
    if (target.where === "belt") client.send("belt", p.belt); else this.sendGear(client, p);
    return null;
  },
};

/** The messages from players about this. */
export function registerMagic(this: WorldRoom) {
    // Pick which spell to cast with a staff.
    this.onMessage("spell", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const id = msg?.id;
      if (!p || !id || !isBoltSpell(id)) return;
      this.pickBolt(client, p, id);
    });
    // Cast a spell from the spell bar (bolts just pick what your staff fires).
    this.onMessage("cast", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const id = msg?.id as SpellId;
      if (!p || !SPELL_IDS.includes(id)) return;
      this.castSpell(client, p, id, client.sessionId);
    });
    // The enchanting altar (shared/enchanting.ts).
    this.onMessage("enchant", (client, msg: { slot: number; soul: number; effect?: string; gem?: number; inlay?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !Number.isInteger(msg?.soul) || (msg.gem != null && !Number.isInteger(msg.gem))) return;
      this.enchant(client, p, msg);
    });
    this.onMessage("disenchant", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      this.disenchant(client, p, msg.slot);
    });
    // Rearrange the spell bar: a list of spell ids (or null for an empty slot).
    this.onMessage("spellBar", (client, msg: { bar: (string | null)[] }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Array.isArray(msg?.bar)) return;
      const known = this.known(p);
      const slots = barSlots(p.combatMastery);
      const bar: (SpellId | null)[] = [];
      for (let i = 0; i < slots; i++) {
        const id = msg.bar[i] as SpellId;
        bar.push(known.includes(id) && !bar.includes(id) ? id : null);
      }
      p.spellBar = bar;
      p.dirty = true;
      this.sendSpellbook(client, p);
    });
}
