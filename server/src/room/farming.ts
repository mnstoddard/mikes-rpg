// Farming: plots, planting, harvesting.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { Point } from "../../../shared/pathfinding";
import { masteryIn as masteryLevelIn } from "../../../shared/mastery";
import { isUnlocked, levelForXp } from "../../../shared/disciplines";
import { ITEMS, ItemId } from "../../../shared/items";
import { countItem, entriesInOrder, takeItem } from "../../../shared/bag";
import { formatMoney } from "../../../shared/money";
import { store, usernameKey } from "../storage";
import { CROPS, FARM_CHEST_PRICE, FarmView, LOTS, LOT_SIZE, MASTERY_EXTRA, PLANT_XP, PLOT_SIZES, SEED_BACK, SEED_BACK_PER_LEVEL, SeedId, cropOfSeed, decodeCrop, encodeCrop, inPlot, isSeed, lotAt, plotPrice, seedId, tileOf, timeLeft } from "../../../shared/farming";
import { LOT_PLACES } from "../../../shared/world";
import { Player, Plot } from "./schema";
import { FAST_GATHER_FOR_TESTS, aOr } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const farmingMethods = {
  /** Everyone's plots come from the world store when the room starts. */
  async loadFarms(this: WorldRoom) {
    try {
      const data = (await store.getWorld("farms")) as { lots?: Record<string, { owner?: string; name?: string; w?: number; h?: number; crops?: string[] }> } | null;
      for (const [k, v] of Object.entries(data?.lots ?? {})) {
        const lot = Number(k);
        if (!LOTS[lot] || !v?.owner) continue;
        const plot = new Plot();
        plot.ownerKey = v.owner;
        plot.owner = v.name ?? v.owner;
        const step = Math.max(0, PLOT_SIZES.findIndex(([w, h]) => w === v.w && h === v.h));
        [plot.w, plot.h] = PLOT_SIZES[step];
        (v.crops ?? []).slice(0, LOT_SIZE * LOT_SIZE).forEach((c, i) => { if (decodeCrop(c)) plot.crops[i] = c; });
        this.state.plots.set(String(lot), plot);
      }
    } catch (err: any) {
      console.error("Loading the farms failed:", err.message);
    }
  },
  async saveFarms(this: WorldRoom) {
    this.farmSaveTimer = null;
    const lots: Record<string, unknown> = {};
    this.state.plots.forEach((plot, k) => { lots[k] = { owner: plot.ownerKey, name: plot.owner, w: plot.w, h: plot.h, crops: [...plot.crops] }; });
    try {
      await store.setWorld("farms", { lots });
    } catch (err: any) {
      console.error("Saving the farms failed:", err.message);
    }
  },
  /** Save the farms a moment from now (planting a whole plot is one save). */
  saveFarmsSoon(this: WorldRoom) {
    if (!this.farmSaveTimer) this.farmSaveTimer = setTimeout(() => void this.saveFarms(), 3000);
  },
  farmView(this: WorldRoom, p: Player): FarmView {
    const mine = this.plotOf(p);
    return {
      lot: mine?.lot ?? null, w: mine?.plot.w ?? 0, h: mine?.plot.h ?? 0, step: mine ? this.plotStep(mine.plot) : -1,
      free: LOTS.length - this.state.plots.size, firstFree: this.step(p)?.goal.kind === "plot", chest: p.farmChest,
    };
  },
  sendFarm(this: WorldRoom, client: Client, p: Player) {
    client.send("farm", this.farmView(p));
  },
  /** Get a plot from Farmer Odo, or make yours bigger. */
  buyPlot(this: WorldRoom, client: Client, p: Player) {
    if (!this.nearNpc(p, "odo")) return this.say(client, "You need to be next to Farmer Odo.");
    if (!isUnlocked(p.unlocked, "farming")) return this.say(client, this.notTaught("farming"));
    const mine = this.plotOf(p);
    const step = mine ? this.plotStep(mine.plot) + 1 : 0;
    if (step >= PLOT_SIZES.length) return this.say(client, "Farmer Odo: Your plot's as big as a lot gets!");
    const lot = mine ? mine.lot : LOTS.findIndex((_, i) => !this.state.plots.has(String(i)));
    if (lot < 0) return this.say(client, "Farmer Odo: Sorry, every lot is taken right now.");
    const price = step === 0 && this.step(p)?.goal.kind === "plot" ? 0 : plotPrice(step);
    if (p.coins < price) return this.say(client, `You need ${formatMoney(price)} for that. You have ${formatMoney(p.coins)}.`);
    p.coins -= price;
    const plot = mine?.plot ?? new Plot();
    [plot.w, plot.h] = PLOT_SIZES[step];
    if (!mine) {
      plot.ownerKey = usernameKey(p.name);
      plot.owner = p.name;
      this.state.plots.set(String(lot), plot);
    }
    p.dirty = true;
    void this.saveFarms();
    const where = LOT_PLACES[lot] ?? "in Emberhold";
    this.say(client, mine ? `🌾 Your plot is now ${plot.w} × ${plot.h}.`
      : `🌾 You have a plot! It's ${plot.w} × ${plot.h}, ${where}: look for your name on its sign. Click it to plant${price ? "" : " (Odo paid for this one)"}.`);
    client.send("coins", p.coins);
    this.sendFarm(client, p);
    if (!mine) this.questEvent(p, client, { kind: "plot" });
  },
  /** Pay Odo to link the farm chest to your enchanted chest. */
  buyFarmChest(this: WorldRoom, client: Client, p: Player) {
    if (!this.nearNpc(p, "odo")) return this.say(client, "You need to be next to Farmer Odo.");
    if (p.farmChest) return this.say(client, "The farm chest is already linked to yours.");
    if (!p.chest.slotCount) return this.say(client, "Farmer Odo: You'll need space in the enchanted chest first. Archmage Rowan rents it out at the Mages' Guild.");
    if (p.coins < FARM_CHEST_PRICE) return this.say(client, `You need ${formatMoney(FARM_CHEST_PRICE)} for that. You have ${formatMoney(p.coins)}.`);
    p.coins -= FARM_CHEST_PRICE;
    p.farmChest = true;
    p.dirty = true;
    this.say(client, "📦 Done! The chest outside the farmhouse now opens your enchanted chest.");
    client.send("coins", p.coins);
    this.sendFarm(client, p);
  },
  /** Click your plot: walk over, then plant and harvest tile after tile. */
  startFarming(this: WorldRoom, client: Client, p: Player, t: Point) {
    const at = lotAt(t.x, t.y);
    if (!at) return;
    const plot = this.state.plots.get(String(at.lot));
    if (!plot) return this.say(client, "Nobody farms this lot yet. Farmer Odo, in the farmhouse, sells plots.");
    if (plot.ownerKey !== usernameKey(p.name)) return this.say(client, `That's ${plot.owner}'s farm. Only they can plant and harvest it.`);
    if (!isUnlocked(p.unlocked, "farming")) return this.say(client, this.notTaught("farming"));
    if (!inPlot(at.index, plot.w, plot.h)) return this.say(client, "That part of the lot isn't yours yet. Farmer Odo can make your plot bigger.");
    this.breakInvisible(p, client, "gather");
    this.stopActions(p);
    // Start on the tile you clicked if there's something to do there, or the nearest one that has.
    const level = levelForXp(p.skillXp.farming);
    const now = Date.now();
    const start = this.farmWork(p, plot, at.index, level, now) ? t : this.nextFarmTile(p, at.lot, plot, level, now);
    if (!start) return this.say(client, this.farmDone(p, plot, level, now));
    p.target = start;
    p.activity = "farming";
    p.farmTimer = 0;
    p.path = this.pathNear(p, start);
    if (!p.path.length && !this.nearTile(p, start)) {
      this.stopActions(p);
      this.say(client, "You can't reach that.");
    }
  },
  /** The seed you'd plant next: the one you picked, or the first in your bag you can grow. */
  seedFor(this: WorldRoom, p: Player, level: number): SeedId | null {
    const ok = (it: ItemId | null): it is SeedId => isSeed(it) && CROPS[cropOfSeed(it)].level <= level;
    if (ok(p.seedPick) && countItem(p, p.seedPick) > 0) return p.seedPick;
    for (const e of entriesInOrder(p)) { const it = p.inventory[e]; if (ok(it)) return it; }
    return null;
  },
  /** Is there something to do on this tile: plant it (with a seed you have), or harvest it? */
  farmWork(this: WorldRoom, p: Player, plot: Plot, index: number, level: number, now: number): "plant" | "harvest" | null {
    if (!inPlot(index, plot.w, plot.h)) return null;
    const c = decodeCrop(plot.crops[index]);
    if (!c) return this.seedFor(p, level) ? "plant" : null;
    return now >= c.ripeAt ? "harvest" : null;
  },
  /** The nearest tile in your plot with something to do. */
  nextFarmTile(this: WorldRoom, p: Player, lot: number, plot: Plot, level: number, now: number): Point | null {
    let best: Point | null = null, bestD = Infinity;
    for (let i = 0; i < LOT_SIZE * LOT_SIZE; i++) {
      if (!this.farmWork(p, plot, i, level, now)) continue;
      const t = tileOf(lot, i);
      const d = Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y)) * 10 + Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  },
  /** Nothing left to do: say why, and when the next crop is ready. */
  farmDone(this: WorldRoom, p: Player, plot: Plot, level: number, now: number): string {
    let soonest = Infinity, empty = 0;
    for (let i = 0; i < LOT_SIZE * LOT_SIZE; i++) {
      if (!inPlot(i, plot.w, plot.h)) continue;
      const c = decodeCrop(plot.crops[i]);
      if (!c) empty++;
      else soonest = Math.min(soonest, c.ripeAt);
    }
    const next = soonest < Infinity ? ` The next crop is ripe in ${timeLeft(soonest - now)}.` : "";
    if (!empty) return `🌱 Everything's planted.${next}`;
    const seeds = p.inventory.filter((it): it is SeedId => isSeed(it));
    if (!seeds.length) return `🌱 You're out of seeds. Farmer Odo sells them.${next}`;
    const need = Math.min(...seeds.map((s) => CROPS[cropOfSeed(s)].level));
    return `🌱 You need Farming level ${need} to plant the seeds you have.${next}`;
  },
  farmTick(this: WorldRoom, p: Player, sessionId: string) {
    const client = this.clients.getById(sessionId);
    const t = p.target!;
    const at = lotAt(t.x, t.y);
    const plot = at && this.state.plots.get(String(at.lot));
    if (!at || !plot || plot.ownerKey !== usernameKey(p.name) || !this.nearTile(p, t)) return this.stopActions(p);
    p.faceX = t.x;
    p.faceY = t.y;
    if (p.action !== "farming") {
      p.action = "farming";
      p.farmTimer = 0;
      return;
    }
    // One tile every 2 ticks.
    if (++p.farmTimer < 2) return;
    p.farmTimer = 0;
    const level = levelForXp(p.skillXp.farming);
    const now = Date.now();
    const work = this.farmWork(p, plot, at.index, level, now);
    if (work) {
      if (!this.hasStamina(client!, p, "farming")) return this.stopActions(p);
      if (work === "plant") this.plant(p, client, plot, at.index, level, now);
      else if (!this.harvest(p, client, plot, at.index, level)) return this.stopActions(p);
      if (!this.roll(p, "farming", "staminaSave")) this.useStamina(p, "farming");
      this.saveFarmsSoon();
    }
    const next = this.nextFarmTile(p, at.lot, plot, level, now);
    if (!next) {
      if (client) this.say(client, this.farmDone(p, plot, level, now));
      return this.stopActions(p);
    }
    p.target = next;
    p.path = this.pathNear(p, next);
  },
  plant(this: WorldRoom, p: Player, client: Client | undefined, plot: Plot, index: number, level: number, now: number) {
    const seed = this.seedFor(p, level)!;
    const crop = cropOfSeed(seed);
    takeItem(p, seed, 1);
    const minutes = CROPS[crop].minutes * (1 - this.tree(p, "farming", "growth"));
    const ms = FAST_GATHER_FOR_TESTS ? minutes * 1000 : minutes * 60_000; // tests: a minute is a second
    plot.crops[index] = encodeCrop({ crop, plantedAt: now, ripeAt: now + Math.round(ms) });
    if (client) {
      this.sendInventory(client, p);
      this.say(client, `🌱 You plant ${aOr(ITEMS[seed].single)}. Ripe in ${timeLeft(ms)}.`);
    }
    this.addSkillXp(p, client, "farming", PLANT_XP);
    this.questEvent(p, client, { kind: "plant" });
  },
  /** Dig up a ripe crop. False if your bag or back can't take it. */
  harvest(this: WorldRoom, p: Player, client: Client | undefined, plot: Plot, index: number, level: number): boolean {
    const c = decodeCrop(plot.crops[index])!;
    const def = CROPS[c.crop];
    const mastery = masteryLevelIn(p.mastery, `crop_${c.crop}`);
    let n = def.yield[0] + Math.floor(Math.random() * (def.yield[1] - def.yield[0] + 1));
    if (Math.random() < this.tree(p, "farming", "double") + (mastery - 1) * MASTERY_EXTRA) n++;
    const got = this.give(p, def.produce, n);
    if (!got) {
      if (client) this.say(client, this.fullReason(p, def.produce));
      return false;
    }
    plot.crops[index] = "";
    const back = Math.random() < SEED_BACK + level * SEED_BACK_PER_LEVEL && this.give(p, seedId(c.crop)) > 0;
    const item = ITEMS[def.produce];
    if (client) {
      this.sendInventory(client, p);
      this.say(client, `🌾 You harvest ${got} ${got === 1 ? item.single : item.name.toLowerCase()}${back ? `, and get ${aOr(ITEMS[seedId(c.crop)].single)} back` : ""}.`);
    }
    this.addSkillXp(p, client, "farming", def.xp);
    this.addMasteryXp(p, client, `crop_${c.crop}`, def.xp);
    this.questEvent(p, client, { kind: "harvest" });
    return true;
  },
};

/** The messages from players about this. */
export function registerFarming(this: WorldRoom) {
    // ---- Farming (shared/farming.ts) ----
    this.onMessage("farm", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      this.startFarming(client, p, { x: msg.x, y: msg.y });
    });
    this.onMessage("farmBuy", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.buyPlot(client, p);
    });
    this.onMessage("farmChest", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.buyFarmChest(client, p);
    });
    this.onMessage("seed", (client, msg: { item: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !isSeed(msg?.item)) return;
      p.seedPick = msg.item as ItemId;
      this.say(client, `🌱 You'll plant ${ITEMS[p.seedPick].name.toLowerCase()} first. Click your plot to plant.`);
    });
}
