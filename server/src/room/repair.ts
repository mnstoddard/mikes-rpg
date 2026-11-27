// Repairing with spares of the same kind (Repairer Oswin and the Mend spell).
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { type } from "@colyseus/schema";
import { GEAR_SLOTS, GearSlot } from "../../../shared/gear";
import { TOOL_TYPE_IDS, ToolType } from "../../../shared/tools";
import { ItemId } from "../../../shared/items";
import { takeFromEntry } from "../../../shared/bag";
import { formatMoney } from "../../../shared/money";
import { isProtected } from "../../../shared/quests";
import { RepairJob, isRepairable, kindName, maxUses, pickSpare, repairFee, repairKind } from "../../../shared/repair";
import { Player } from "./schema";
import type { WorldRoom } from "../WorldRoom";

export const repairMethods = {
  // ---- The Repairer (shared/repair.ts), at the Mages' Guild ----

  /** Spares in your bag that could give their ember to a repair (not locked, not enchanted, not one the story needs). */
  spares(this: WorldRoom, p: Player, except = -1) {
    const out: { entry: number; item: ItemId; left: number }[] = [];
    p.inventory.forEach((item, e) => {
      if (e === except || !item || !isRepairable(item) || p.locked[e] || item.includes("+") || isProtected(p.quest, item)) return;
      out.push({ entry: e, item, left: p.durability[e] ?? maxUses(item) });
    });
    return out;
  },
  /** Everything worn or broken (belt tools, gear you're wearing, tools and gear in your bag), with the spare that would fix it. */
  repairJobs(this: WorldRoom, p: Player): RepairJob[] {
    const jobs: RepairJob[] = [];
    const add = (where: RepairJob["where"], key: string | number, item: ItemId, durability: number) => {
      const max = maxUses(item);
      if (durability >= max) return;
      const kind = repairKind(item);
      if (!kind) return;
      const spare = pickSpare(item, max - Math.max(0, durability), this.spares(p, where === "bag" ? key as number : -1)) ?? undefined;
      jobs.push({ where, key, item, durability, max, kind, spare, cost: spare ? repairFee(item, spare.restores) : 0 });
    };
    for (const type of TOOL_TYPE_IDS) { const t = p.belt[type]; if (t) add("belt", type, t.item, t.durability); }
    for (const slot of GEAR_SLOTS) { const g = p.gear[slot]; if (g) add("gear", slot, g.item, g.durability); }
    p.inventory.forEach((item, e) => { if (isRepairable(item)) add("bag", e, item, p.durability[e] ?? maxUses(item)); });
    return jobs;
  },
  /** Old Maren's lesson used to send you here with a free repair (no longer: version 0.22). */
  freeRepair(this: WorldRoom, p: Player) {
    return this.step(p)?.goal.kind === "repair";
  },
  sendRepairs(this: WorldRoom, client: Client, p: Player, open = false) {
    client.send("repair", { jobs: this.repairJobs(p), free: this.freeRepair(p), open });
  },
  /** Pour a spare's ember into a worn thing (Oswin, or your own Mend). Returns the uses it gave back. */
  mendWith(this: WorldRoom, p: Player, j: RepairJob): number {
    if (!j.spare) return 0;
    const gain = j.spare.restores;
    if (j.where === "belt") p.belt[j.key as ToolType]!.durability = Math.min(j.max, Math.max(0, j.durability) + gain);
    else if (j.where === "gear") p.gear[j.key as GearSlot]!.durability = Math.min(j.max, Math.max(0, j.durability) + gain);
    else p.durability[j.key as number] = Math.min(j.max, Math.max(0, j.durability) + gain);
    takeFromEntry(p, j.spare.entry, 1);
    p.dirty = true;
    return gain;
  },
  /** Fix these, one at a time (each uses up a spare of the same kind from your bag), as many as you have spares and coins for. */
  doRepairs(this: WorldRoom, client: Client, p: Player, jobs: RepairJob[]) {
    if (!this.nearNpc(p, "repairer")) return this.say(client, "You need to be next to the Repairer at the Mages' Guild.");
    if (!jobs.length) return this.say(client, "Repairer Oswin: Nothing here needs fixing!");
    const free = this.freeRepair(p);
    let paid = 0;
    const fixed: string[] = [];
    const missing = new Set<string>();
    let short = 0;
    // The bag changes as spares are used up, so work out each job again before doing it.
    const wanted = jobs.map((j) => `${j.where}:${j.key}`);
    for (let n = 0; n < 40; n++) {
      const j = this.repairJobs(p).find((x) => wanted.includes(`${x.where}:${x.key}`) && !fixed.includes(`${x.where}:${x.key}`) && !missing.has(`${x.where}:${x.key}`));
      if (!j) break;
      const id = `${j.where}:${j.key}`;
      if (!j.spare) { missing.add(id); continue; }
      const cost = free ? 0 : j.cost;
      if (p.coins < cost) { short++; missing.add(id); continue; }
      p.coins -= cost;
      paid += cost;
      this.mendWith(p, j);
      fixed.push(id);
    }
    if (fixed.length) {
      this.say(client, free ? `Repairer Oswin draws the ember from your spare into ${fixed.length > 1 ? `${fixed.length} things` : "it"}. "Maren's an old friend. The next one costs, mind!"`
        : `Repairer Oswin draws the ember out of your spare${fixed.length > 1 ? "s" : ""} and into ${fixed.length > 1 ? `${fixed.length} things` : "it"}, for ${formatMoney(paid)}. "Everything that comes from the land holds a little ember, even an old axe."`);
      this.questEvent(p, client, { kind: "repair" });
    }
    const noSpare = [...missing].length - short;
    if (noSpare > 0 && !fixed.length) {
      const j = jobs.find((x) => !x.spare) ?? jobs[0];
      this.say(client, `Repairer Oswin: "I need a spare ${kindName(j.kind)} to fix that: any ${kindName(j.kind)} will do, but a finer one gives more. Its ember goes into yours."`);
    }
    if (short) this.say(client, `You don't have enough coins to fix ${fixed.length ? `the other ${short}` : short === 1 ? "that" : "those"}.`);
    this.sendInventory(client, p);
    this.sendRepairs(client, p);
    this.saveSoon(p);
  },
};

/** The messages from players about this. */
export function registerRepair(this: WorldRoom) {
    // The Repairer: fix one thing (on your belt, in your gear, or in your bag), or everything at once.
    this.onMessage("repair", (client, msg: { where: string; key: string | number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const job = this.repairJobs(p).find((j) => j.where === msg?.where && j.key === msg?.key);
      if (job) this.doRepairs(client, p, [job]);
    });
    this.onMessage("repairAll", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.doRepairs(client, p, this.repairJobs(p));
    });
}
