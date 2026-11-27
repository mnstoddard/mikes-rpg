// Fighting: players and monsters.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { areaAt, doorAt, isDanger, isWalkable, spotNear } from "../../../shared/map";
import { findPath, Point } from "../../../shared/pathfinding";
import { isUnlocked, levelForXp, findSkill as skillInfo } from "../../../shared/disciplines";
import { AGGRO_RADIUS, ATTACK_STAMINA, Attack, CombatMasteryId, LEASH_RADIUS, MONSTERS, POTION_ID, SPELLS, WANDER_RADIUS, armorPoints, attackFor, combatMasteryIn, combatMasteryName, defenseXp, hitChance, masteryDrops, maxHitWith, monsterHitChance, tileDistance, ARMOR_LEVEL, isBoltSpell, huntingDrops, huntingXp } from "../../../shared/combat";
import { CombatStyle, GEAR_SLOTS, WEAPONS, isArmor, isWeapon, parseArmor, parseWeapon, METAL_DAMAGE } from "../../../shared/gear";
import { wearFor, Material } from "../../../shared/tools";
import { ITEMS, ItemId } from "../../../shared/items";
import { takeFromEntry, takeItem } from "../../../shared/bag";
import { LEAD_KILL_XP, PARTY_NEAR } from "../../../shared/party";
import { formatMoney } from "../../../shared/money";
import { isNight } from "../../../shared/daynight";
import { TARGET_RANGE, barSlots, soulsOf, spellMana } from "../../../shared/spells";
import { GUARD_CAP, enchantTotal, fireDamage, fits, guardPercent, staffHit, thornsDamage } from "../../../shared/enchanting";
import { ARROW_RECOVER, ArrowId } from "../../../shared/handicraft";
import { isSoulGem, soulCapacity, carats, jewelTotals, parseGem, soulGemId } from "../../../shared/jewelry";
import { buffPower } from "../../../shared/alchemy";
import { treeRoll } from "../../../shared/skilltree";
import { gateOpen, oathSworn } from "../../../shared/quests";
import { TITHE_MAX } from "../../../shared/story";
import { Player, Monster } from "./schema";
import { ARROW_ORDER, worldNow, aOr, CARDINAL } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const combatMethods = {
  twoHanded(this: WorldRoom, item: string | undefined) {
    return isWeapon(item) && !!WEAPONS[parseWeapon(item).type].twoHanded;
  },
  /** Can you attack the monster from where you stand? */
  inRange(this: WorldRoom, p: Player, m: Monster, a: Attack) {
    return tileDistance(p, m) <= a.range;
  },
  /** Is fighting refused right now? (the lesson wants a weapon, a sling or a staff.) Returns what to say. */
  fightBlock(this: WorldRoom, p: Player): string | null {
    const want = this.step(p)?.fightWith;
    if (!want) return null;
    const w = p.gear.weapon?.item;
    const who = this.giverName(p);
    if (want === "weapon" && !w) return `${who} wants you to fight with a weapon. Click one in your bag and press "Equip" first.`;
    if (want !== "weapon" && (!isWeapon(w) || WEAPONS[parseWeapon(w).type].style !== want)) {
      return want === "magic" ? `${who} wants you to use Spellcasting for this. Hold your staff first.` : `${who} wants you to use Ranged for this. Hold your sling first.`;
    }
    return null;
  },
  /** Why you can't wear or hold this yet (too low a level), or null. */
  cantWear(this: WorldRoom, p: Player, item: ItemId): string | null {
    if (isWeapon(item)) {
      const def = WEAPONS[parseWeapon(item).type];
      const { def: skill } = skillInfo(def.style);
      if (!isUnlocked(p.unlocked, def.style)) return this.notTaught(def.style);
      const level = levelForXp(p.skillXp[def.style]);
      if (level < def.level) return `You need ${skill.name} level ${def.level} to hold ${aOr(def.name.toLowerCase())}. (You're level ${level}.)`;
    } else if (isArmor(item)) {
      const m = parseArmor(item).metal;
      const need = ARMOR_LEVEL[m];
      const level = levelForXp(p.skillXp.defense);
      if (level < need) return `You need Defense level ${need} to wear ${m} armor. (You're level ${level}.)`;
    }
    return null;
  },
  /** Each game tick while you're fighting: walk into range, then attack whenever your weapon is ready. */
  combatTick(this: WorldRoom, p: Player, sessionId: string) {
    const client = this.clients.getById(sessionId);
    const m = this.state.monsters.get(p.fighting!);
    if (!m || !m.alive) return this.stopActions(p);
    const a = attackFor(p.gear, p.spell);
    p.attackTimer++;
    if (!this.inRange(p, m, a)) {
      // Chase it: head for its tile (it may have moved).
      const end = p.path[p.path.length - 1];
      if (!end || tileDistance(end, m) > a.range) p.path = findPath({ x: p.x, y: p.y }, { x: m.x, y: m.y });
      if (!p.path.length) {
        if (client) this.say(client, "You can't reach it.");
        this.stopActions(p);
      }
      return;
    }
    p.path = [];
    p.action = "fighting";
    p.faceX = m.x;
    p.faceY = m.y;
    if (p.attackTimer < a.speed) return;
    const blocked = this.fightBlock(p);
    if (blocked) {
      if (client) this.say(client, blocked);
      return this.stopActions(p);
    }
    const def = MONSTERS[m.kind];
    // Pay for the attack: mana for spells, stamina for weapons.
    if (a.spell) {
      const spell = SPELLS[a.spell];
      if (levelForXp(p.skillXp.magic) < spell.level) p.spell = "fire_blast";
      const staffMagic = this.staffEnchant(p);
      const mana = staffMagic ? 1 : spellMana(a.spell, combatMasteryIn(p.combatMastery, a.spell));
      if (p.mana < mana) {
        if (client) this.say(client, `You're out of mana: ${spell.name} needs ${mana} and you have ${p.mana}. It comes back 1 every 6 seconds.`);
        return this.stopActions(p);
      }
      if (!treeRoll(p.tree, "magic", "manaSave")) p.mana -= mana;
    } else {
      if (p.stamina < ATTACK_STAMINA) {
        if (client) this.say(client, "You're too tired to fight. Eat something, or rest (1 stamina every 30 seconds).");
        return this.stopActions(p);
      }
      if (!treeRoll(p.tree, a.style, "staminaSave")) p.stamina -= ATTACK_STAMINA;
    }
    // A bow shoots arrows from your bag: the best tip first. About 1 in 3 can be picked up again.
    let arrow: ArrowId | null = null;
    const held = p.gear.weapon?.item;
    if (isWeapon(held) && parseWeapon(held).type === "bow") {
      arrow = ARROW_ORDER.find((id) => p.inventory.some((it, i) => it === id && !p.locked[i])) ?? null;
      if (!arrow) {
        if (client) this.say(client, "You're out of arrows. Make them at Rook's workbench (Handicraft), or buy bronze arrows from Huntmaster Kael.");
        return this.stopActions(p);
      }
      if (Math.random() >= ARROW_RECOVER) {
        takeItem(p, arrow, 1, (i) => !p.locked[i]);
        if (client) this.sendInventory(client, p);
      }
    }
    p.attackTimer = 0;
    this.breakInvisible(p, client, "attack");
    const style = a.style;
    const weaponM = combatMasteryIn(p.combatMastery, a.mastery);
    const monsterM = combatMasteryIn(p.combatMastery, m.kind);
    const chance = hitChance(levelForXp(p.skillXp[style]), m.kind, a, weaponM, monsterM, this.tree(p, style, "accuracy") + jewelTotals(p.jewels).accuracy / 100);
    const hit = Math.random() < chance;
    const staffMagic = a.spell ? this.staffEnchant(p) : null;
    const max = maxHitWith(a, weaponM) + (staffMagic && a.maxHit ? staffHit(staffMagic.power) : 0) + (arrow ? METAL_DAMAGE[arrow.slice(7) as Material] : 0);
    // The skill tree's damage bonus: +5% is a 5% chance of +1 on a hit of 1, and so on.
    // Weapons (not spells) hit harder with a strength potion.
    const strength = a.spell ? 0 : buffPower(p.buffs, "strength", worldNow()) / 100;
    const roll = hit && max ? (1 + Math.floor(Math.random() * max)) * (1 + this.tree(p, style, "damage") + strength) : 0;
    let damage = Math.floor(roll) + (Math.random() < roll % 1 ? 1 : 0);
    if (staffMagic?.id === "fire" && damage) damage += fireDamage(staffMagic.gem / 10);
    const spell = a.spell ? SPELLS[a.spell] : null;
    if (damage) {
      m.hurtBy.set(sessionId, (m.hurtBy.get(sessionId) ?? 0) + Math.min(damage, m.hp));
      m.hp = Math.max(0, m.hp - damage);
    }
    m.hitWith.set(sessionId, { style, mastery: a.mastery });
    if (hit && spell?.freeze) m.frozenUntil = this.state.tick + spell.freeze;
    if (hit && staffMagic) this.staffEffect(p, client, sessionId, m, staffMagic, damage);
    if (hit && spell?.sleep) { m.sleepUntil = this.state.tick + spell.sleep; m.attackTimer = 0; }
    this.broadcast("hit", { on: "monster", id: p.fighting, damage, miss: !hit, spell: a.spell ?? null, from: sessionId });
    // It fights back now (if it ever does).
    if (def.maxHit > 0 && !m.target) m.target = sessionId;
    if (a.mastery !== "fists") this.wearGear(p, client, "weapon", wearFor(def.level));
    const killed = m.hp <= 0;
    // XP: 1 per damage (a landed sleep counts as a few). The kill's bonus is shared out in killMonster.
    const xp = damage || (hit && spell?.sleep ? Math.ceil(spell.mana / 2) : 0);
    if (client) {
      this.sendVitals(client, p);
      this.sendStamina(client, p);
      if (!hit) this.say(client, spell ? `Your ${spell.name.toLowerCase()} misses the ${def.name.toLowerCase()}.` : `You miss the ${def.name.toLowerCase()}.`);
      else if (spell?.sleep) this.say(client, `The ${def.name.toLowerCase()} falls asleep! 💤`);
      else if (spell?.freeze && !killed) this.say(client, `You hit the ${def.name.toLowerCase()} for ${damage}. It's frozen in place! ❄️`);
    }
    if (xp) {
      this.addSkillXp(p, client, style, xp);
      this.addCombatMastery(p, client, a.mastery, xp);
      this.addCombatMastery(p, client, m.kind, xp);
    }
    if (killed) this.killMonster(m, p, client, style);
    this.saveSoon(p);
  },
  /**
   * You defeated it. Stage 13: its kill XP is split by how much damage each person did,
   * its drops go to whoever did the most, and the kill counts for quests for everyone
   * who hurt it and their party members close by. It comes back after a while.
   */
  killMonster(this: WorldRoom, m: Monster, p: Player, client: Client | undefined, style: CombatStyle) {
    const def = MONSTERS[m.kind];
    m.alive = false;
    m.target = null;
    m.status = "";
    m.respawnAt = this.state.tick + def.respawnTicks;
    if (m.trappedBy && m.trappedUntil > this.state.tick) this.fillSoulGem(m);
    m.trappedUntil = 0;
    m.trappedBy = null;
    m.poison = null;
    const killer = this.sidOf(p);
    const shares = [...m.hurtBy.entries()].filter(([sid, dmg]) => dmg > 0 && this.state.players.has(sid));
    if (!shares.length) shares.push([killer, 1]);
    const total = shares.reduce((sum, [, dmg]) => sum + dmg, 0);
    const topSid = shares.reduce((best, x) => (x[1] > best[1] ? x : best))[0];
    const top = this.state.players.get(topSid) ?? p;
    const topClient = top === p ? client : this.clients.getById(topSid);
    // Drops: to whoever did the most damage. Hunting: a better hunter gets more drops.
    const hunter = isUnlocked(top.unlocked, "hunting") ? huntingDrops(levelForXp(top.skillXp.hunting)) : 1;
    const dropBoost = masteryDrops(combatMasteryIn(top.combatMastery, m.kind)) * hunter;
    const got: string[] = [];
    let lost = 0;
    for (const d of def.drops) {
      if (Math.random() >= Math.min(1, d.chance * dropBoost)) continue;
      if (!this.give(top, d.item)) { lost++; continue; }
      got.push(aOr(ITEMS[d.item].single));
    }
    const [lo, hi] = def.coins;
    const coins = hi ? lo + Math.floor(Math.random() * (hi - lo + 1)) : 0;
    if (coins) { top.coins += coins; got.push(formatMoney(coins)); }
    this.state.players.forEach((other) => { if (other.fighting && this.state.monsters.get(other.fighting) === m) this.stopActions(other); });
    const drops = (got.length ? ` It drops ${got.join(" and ")}.` : "") + (lost ? " Your bag is full or too heavy, so you leave something behind." : "");
    if (topClient) {
      this.say(topClient, top === p ? `You defeat the ${def.name.toLowerCase()}!${drops}` : `The ${def.name.toLowerCase()} is defeated! You did the most damage, so its drops are yours.${drops}`);
      this.sendInventory(topClient, top);
    }
    // Everyone else who helped hears who got the drops.
    for (const [sid] of shares) {
      const pl = this.state.players.get(sid);
      const cl = pl === p ? client : this.clients.getById(sid);
      if (!pl || pl === top || !cl) continue;
      this.say(cl, `${pl === p ? "You defeat" : "Together you defeat"} the ${def.name.toLowerCase()}! ${top.name} did the most damage, so the drops go to them.`);
    }
    if (top !== p) this.saveSoon(top);
    // Kill XP, shared by damage (a bit more for party members near their leader).
    if (def.xp) for (const [sid, dmg] of shares) {
      const pl = this.state.players.get(sid);
      if (!pl) continue;
      const cl = pl === p ? client : this.clients.getById(sid);
      const how = m.hitWith.get(sid) ?? { style, mastery: null };
      const xp = Math.max(1, Math.round(def.xp * dmg / total * (1 + this.groupBonusFor(pl))));
      this.addSkillXp(pl, cl, how.style, xp);
      if (how.mastery) this.addCombatMastery(pl, cl, how.mastery, xp);
      this.addCombatMastery(pl, cl, m.kind, xp);
      if (pl !== p) this.saveSoon(pl);
    }
    // Leadership: each party that fought it, for every member near their leader.
    const led = new Set<string>();
    for (const [sid] of shares) {
      const party = this.parties.get(this.state.players.get(sid)?.party ?? "");
      if (!party || led.has(party.leader)) continue;
      led.add(party.leader);
      const near = this.nearLeader(party).length;
      const lead = this.state.players.get(party.leader);
      if (lead && near) this.addSkillXp(lead, this.clients.getById(party.leader), "leadership", LEAD_KILL_XP * near);
    }
    // Quests: everyone who hurt it, and their party members close by.
    const counted = new Map<string, CombatStyle | undefined>([[killer, style]]);
    for (const [sid] of shares) if (!counted.has(sid)) counted.set(sid, m.hitWith.get(sid)?.style);
    for (const [sid] of shares) {
      const pl = this.state.players.get(sid);
      if (!pl) continue;
      for (const mate of this.partyMates(pl)) if (!counted.has(mate) && tileDistance(this.state.players.get(mate)!, pl) <= PARTY_NEAR) counted.set(mate, undefined);
    }
    counted.forEach((st, sid) => {
      const pl = this.state.players.get(sid);
      if (pl) this.questEvent(pl, pl === p ? client : this.clients.getById(sid), { kind: "kill", monster: m.kind, style: st });
    });
    m.hitWith.clear();
    this.guildKill(p, client, m.kind, style);
    this.shareHunting(m);
  },
  /** Hunting XP for everyone who hurt it, by their share of the damage (at least 1 each). */
  shareHunting(this: WorldRoom, m: Monster) {
    const total = [...m.hurtBy.values()].reduce((a, b) => a + b, 0);
    if (total > 0) {
      const xp = huntingXp(m.kind);
      m.hurtBy.forEach((dmg, sid) => {
        const hunter = this.state.players.get(sid);
        if (!hunter) return;
        this.addSkillXp(hunter, this.clients.getById(sid), "hunting", Math.max(1, Math.round(xp * dmg / total)));
        this.saveSoon(hunter);
      });
    }
    m.hurtBy.clear();
  },
  /** A night-only monster at sunrise: it flies off (no drops), and comes back after dark. */
  sendAway(this: WorldRoom, m: Monster) {
    m.alive = false;
    m.target = null;
    m.status = "";
    m.hp = m.maxHp;
    m.hurtBy.clear();
    m.trappedUntil = 0;
    m.trappedBy = null;
    m.respawnAt = this.state.tick;
    this.state.players.forEach((other) => { if (other.fighting && this.state.monsters.get(other.fighting) === m) this.stopActions(other); });
  },
  /** Monsters: come back after being defeated, wander near home, chase and attack. */
  monsterTick(this: WorldRoom, tick: number) {
    const night = isNight(worldNow());
    this.state.monsters.forEach((m, id) => {
      const def = MONSTERS[m.kind];
      if (def.night && !night) {
        if (m.alive) this.sendAway(m);
        return;
      }
      if (!m.alive) {
        if (tick < m.respawnAt) return;
        m.hurtBy.clear();
        m.hitWith.clear();
        m.alive = true;
        m.hp = m.maxHp;
        m.x = m.homeX;
        m.y = m.homeY;
        m.sleepUntil = m.frozenUntil = 0;
        m.attackTimer = 0;
        m.poison = null;
        return;
      }
      if (m.trappedUntil && m.trappedUntil <= tick) { m.trappedUntil = 0; m.trappedBy = null; }
      if (m.poison && tick % 3 === 0) {
        const { damage, by } = m.poison;
        if (--m.poison.left <= 0) m.poison = null;
        const pl = this.state.players.get(by);
        m.hurtBy.set(by, (m.hurtBy.get(by) ?? 0) + Math.min(damage, m.hp));
        m.hp = Math.max(0, m.hp - damage);
        this.broadcast("hit", { on: "monster", id, damage, miss: false, spell: "poison", from: by });
        if (m.hp <= 0) {
          m.poison = null;
          if (pl) this.killMonster(m, pl, this.clients.getById(by), "magic");
          else { m.alive = false; m.target = null; m.respawnAt = tick + def.respawnTicks; }
          return;
        }
      }
      if (m.sleepUntil > tick) { m.status = "asleep"; return; }
      const frozen = m.frozenUntil > tick;
      const home = { x: m.homeX, y: m.homeY };
      const danger = isDanger(home.x, home.y);
      // Give up on someone who left, ran out of its patch, or is lying on the ground.
      let target = m.target ? this.state.players.get(m.target) : undefined;
      if (m.target && (!target || target.invisible || isDanger(target.x, target.y) !== danger || tileDistance(target, home) > LEASH_RADIUS + 1)) {
        m.target = null;
        target = undefined;
      }
      // Danger zone monsters attack anyone who comes close.
      if (!target && def.aggressive) {
        let best = AGGRO_RADIUS + 1;
        this.state.players.forEach((pl, sid) => {
          const d = tileDistance(pl, m);
          if (d < best && !pl.invisible && isDanger(pl.x, pl.y) && tileDistance(pl, home) <= LEASH_RADIUS && areaAt(pl.x, pl.y) === areaAt(home.x, home.y)) { best = d; m.target = sid; target = pl; }
        });
      }
      // Packs: when one goes for you, the rest of the pack nearby joins in.
      if (target && def.pack) {
        this.state.monsters.forEach((o) => {
          if (o !== m && o.alive && o.kind === m.kind && !o.target && tileDistance(o, m) <= 4) o.target = m.target;
        });
      }
      m.status = frozen ? "frozen" : target ? "fighting" : "";
      if (target) {
        if (tileDistance(target, m) <= 1 && def.maxHit > 0) {
          if (++m.attackTimer >= def.speed) {
            m.attackTimer = 0;
            this.monsterAttack(m, id, target, m.target!);
          }
        } else if (!frozen) {
          m.attackTimer = Math.min(m.attackTimer, def.speed - 1); // ready to bite as soon as it catches you
          this.monsterStep(m, target);
        }
        return;
      }
      if (frozen) return;
      // Wander: now and then take a step somewhere near home (or head home if it chased too far).
      if (tileDistance(m, home) > WANDER_RADIUS) return this.monsterStep(m, home);
      if (Math.random() < 0.15) {
        const goal = { x: m.x + Math.floor(Math.random() * 3) - 1, y: m.y + Math.floor(Math.random() * 3) - 1 };
        if (tileDistance(goal, home) <= WANDER_RADIUS) this.monsterStep(m, goal);
      }
    });
  },
  /** One step toward a goal, staying in its own patch (never out of the Dark Forest, or into it). */
  monsterStep(this: WorldRoom, m: Monster, goal: Point) {
    const danger = isDanger(m.homeX, m.homeY);
    const home = { x: m.homeX, y: m.homeY };
    let best: Point | null = null;
    let bestD = tileDistance(m, goal);
    for (const d of [...CARDINAL, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }]) {
      const n = { x: m.x + d.x, y: m.y + d.y };
      if (!isWalkable(n.x, n.y) || doorAt(n.x, n.y) || isDanger(n.x, n.y) !== danger || tileDistance(n, home) > LEASH_RADIUS) continue;
      if (d.x && d.y && (!isWalkable(m.x + d.x, m.y) || !isWalkable(m.x, m.y + d.y))) continue;
      let taken = false;
      this.state.monsters.forEach((o) => { if (o !== m && o.alive && o.x === n.x && o.y === n.y) taken = true; });
      this.state.players.forEach((o) => { if (o.x === n.x && o.y === n.y) taken = true; });
      if (taken) continue;
      const dist = tileDistance(n, goal) + (d.x && d.y ? 0.1 : 0); // prefer straight steps on a tie
      if (dist < bestD) { bestD = dist; best = n; }
    }
    if (best) { m.x = best.x; m.y = best.y; }
  },
  /** A monster swings at you. Armor and Defense make it miss more; every attack trains Defense. */
  monsterAttack(this: WorldRoom, m: Monster, monsterId: string, p: Player, sessionId: string) {
    const def = MONSTERS[m.kind];
    const client = this.clients.getById(sessionId);
    const chance = monsterHitChance(m.kind, levelForXp(p.skillXp.defense), armorPoints(p.gear) + jewelTotals(p.jewels).armor, this.tree(p, "defense", "dodge"));
    const hit = Math.random() < chance;
    let damage = hit ? 1 + Math.floor(Math.random() * def.maxHit) : 0;
    const ward = p.buffs.ward;
    if (damage && ward && ward.until > worldNow()) {
      const soaked = Math.min(ward.power, damage);
      damage -= soaked;
      ward.power -= soaked;
      if (ward.power <= 0) {
        delete p.buffs.ward;
        if (client) this.say(client, "🛡️ Your ward breaks!");
      }
      if (client) this.sendBuffs(client, p);
    }
    const armor = this.armorItems(p);
    if (damage) {
      const guard = Math.min(GUARD_CAP, guardPercent(enchantTotal(armor, "guard")));
      if (guard) damage = Math.max(1, Math.round(damage * (1 - guard / 100)));
    }
    p.hp = Math.max(0, p.hp - damage);
    p.dirty = true;
    this.broadcast("hit", { on: "player", id: sessionId, damage, miss: !hit, from: monsterId });
    const thorns = hit ? thornsDamage(enchantTotal(armor, "thorns")) : 0;
    if (thorns && enchantTotal(armor, "thorns") > 0) {
      m.hurtBy.set(sessionId, (m.hurtBy.get(sessionId) ?? 0) + Math.min(thorns, m.hp));
      m.hp = Math.max(0, m.hp - thorns);
      this.broadcast("hit", { on: "monster", id: monsterId, damage: thorns, miss: false, spell: null, from: sessionId });
      if (m.hp <= 0) { this.killMonster(m, p, client, "melee"); return; }
    }
    // Armor wears down: one piece you're wearing takes the blow.
    const worn = GEAR_SLOTS.filter((s) => s !== "weapon" && p.gear[s]);
    if (worn.length) this.wearGear(p, client, worn[Math.floor(Math.random() * worn.length)], wearFor(def.level));
    const xp = defenseXp(m.kind);
    this.addSkillXp(p, client, "defense", xp);
    if (p.hp <= 0) return this.die(p, sessionId, def.name);
    // Fight back automatically if you were just standing there.
    if (!p.fighting && !p.path.length && !p.walkDir && !p.target && !p.crafting && !this.fightBlock(p)) {
      p.fighting = monsterId;
      p.attackTimer = 99;
    }
    if (client) {
      this.sendVitals(client, p);
      if (p.hp <= p.maxHp / 4 && p.hp + damage > p.maxHp / 4) {
        this.say(client, `⚠ Your health is low (${p.hp}/${p.maxHp})! ${p.inventory.includes(POTION_ID) ? "Drink a health potion" : "Run away"}!`);
      }
    }
  },
  /** Out of health: you wake up at the Heart Shrine (in the Emberhall) with half your health, and keep everything. */
  die(this: WorldRoom, p: Player, sessionId: string, killer: string) {
    const client = this.clients.getById(sessionId);
    this.stopActions(p);
    p.path = [];
    p.hp = Math.ceil(p.maxHp / 2);
    this.state.monsters.forEach((m) => { if (m.target === sessionId) m.target = null; });
    const shrine = this.respawnShrine(p);
    const spot = spotNear(shrine.at);
    p.x = spot.x;
    p.y = spot.y;
    p.dirty = true;
    // Ember Debt: after the Oath, the shrine takes a tithe for raising you.
    const marked = oathSworn(p.quest) && p.tithe < TITHE_MAX;
    if (marked) p.tithe++;
    if (client) {
      this.say(client, `☠ The ${killer.toLowerCase()} knocked you out! You wake up at ${shrine.name} with half your health. You kept all your things.`);
      if (marked) this.say(client, `⛓️ A gold Tithe mark appears by your health bar (${p.tithe} of ${TITHE_MAX}). While you carry it, a fifth of your XP goes to the shrine, until the mark fades.`);
      else if (oathSworn(p.quest)) this.say(client, `⛓️ You already carry ${TITHE_MAX} Tithe marks: the most there can be.`);
      client.send("died", {});
      this.sendVitals(client, p);
    }
    this.saveSoon(p);
  },
  /** Ember trap's target: the monster you're fighting, or the closest one in reach. */
  trapTarget(this: WorldRoom, p: Player): Monster | null {
    const fighting = p.fighting ? this.state.monsters.get(p.fighting) : undefined;
    if (fighting?.alive && tileDistance(fighting, p) <= TARGET_RANGE) return fighting;
    let best: Monster | null = null;
    let bestD = TARGET_RANGE + 1;
    this.state.monsters.forEach((m) => {
      const dist = tileDistance(m, p);
      if (m.alive && dist < bestD) { best = m; bestD = dist; }
    });
    return best;
  },
  /**
   * A trapped monster died: its ember goes into the caster's best refined emberstone with
   * room. That's the smallest gem it fits in whole; if none can take it all,
   * the gem with the most room (which fills up, and the rest is lost).
   */
  fillSoulGem(this: WorldRoom, m: Monster) {
    const sid = m.trappedBy!;
    const p = this.state.players.get(sid);
    if (!p) return;
    const client = this.clients.getById(sid);
    const souls = soulsOf(m.kind);
    let best = -1, bestRoom = 0, fitsWhole = false;
    p.inventory.forEach((it, i) => {
      if (!isSoulGem(it)) return;
      const g = parseGem(it) as { size: number; souls: number };
      const room = soulCapacity(g.size) - g.souls;
      if (room <= 0) return;
      const whole = room >= souls;
      if (best < 0 || (whole && (!fitsWhole || room < bestRoom)) || (!whole && !fitsWhole && room > bestRoom)) {
        best = i; bestRoom = room; fitsWhole = whole;
      }
    });
    const name = MONSTERS[m.kind].name.toLowerCase();
    if (best < 0) {
      if (client) this.say(client, `👻 The ${name}'s ember drifts away: you have no refined emberstone with room for it.`);
      return;
    }
    const g = parseGem(p.inventory[best]) as { size: number; souls: number };
    const filled = soulGemId(g.size, Math.min(soulCapacity(g.size), g.souls + souls));
    takeFromEntry(p, best, 1);
    this.give(p, filled, 1, null, true);
    const pct = Math.floor((Math.min(soulCapacity(g.size), g.souls + souls) / soulCapacity(g.size)) * 100);
    if (client) {
      this.say(client, `👻 The ${name}'s ember flows into your refined emberstone (${carats(g.size)}): ${pct >= 100 ? "it's full! ✨" : `${pct}% full.`}`);
      this.sendInventory(client, p);
    }
    this.guildJob(p, client ?? undefined, "trap");
    p.dirty = true;
  },
  addCombatMastery(this: WorldRoom, p: Player, client: Client | undefined, id: CombatMasteryId, xp: number) {
    const before = combatMasteryIn(p.combatMastery, id);
    p.combatMastery[id] = (p.combatMastery[id] ?? 0) + xp;
    const after = combatMasteryIn(p.combatMastery, id);
    if (!client) return;
    client.send("combatmastery", p.combatMastery);
    if (after <= before) return;
    const spell = id in SPELLS && !isBoltSpell(id);
    this.say(client, `${combatMasteryName(id)} Mastery ${after}! ` + (id in MONSTERS ? "You hit it more often, and it drops things more often."
      : spell ? "It costs a little less mana, and it's a little stronger." : "You hit more often, and a little harder."));
    client.send("combatmasteryup", { id, level: after });
    if (id in SPELLS) {
      if (before < 10 && after >= 10 && barSlots(p.combatMastery) > p.spellBar.length) this.say(client, `✨ Your spell bar grows to ${barSlots(p.combatMastery)} slots!`);
      this.sendSpellbook(client, p);
    }
  },
};

/** The messages from players about this. */
export function registerCombat(this: WorldRoom) {
    // Click a monster to attack it.
    this.onMessage("attack", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const m = this.state.monsters.get(String(msg?.id));
      if (!p || !m || !m.alive || areaAt(m.x, m.y) !== areaAt(p.x, p.y)) return;
      if (isDanger(m.x, m.y) && !isDanger(p.x, p.y) && !gateOpen(p.quest)) return this.say(client, this.notReady());
      // No fighting until Huntmaster Kael has taught you how (the tutorial comes first).
      if (!isUnlocked(p.unlocked, "melee")) return this.say(client, `⚔️ ${this.notTaught("melee")} Until then, leave the monsters be.`);
      const blocked = this.fightBlock(p);
      if (blocked) return this.say(client, blocked);
      this.stopActions(p);
      p.fighting = String(msg.id);
      p.attackTimer = 99; // the first swing comes as soon as you're in range
      const a = attackFor(p.gear, p.spell);
      p.path = this.inRange(p, m, a) ? [] : findPath({ x: p.x, y: p.y }, { x: m.x, y: m.y });
    });
}
