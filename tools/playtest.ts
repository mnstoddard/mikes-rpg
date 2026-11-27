// Test players: bots that log in to a local server and play the story like a
// person would (walking through doors, talking, fighting, gathering).
//
//   1. Start the server:  cd server && PORT=2567 npx tsx src/index.ts
//   2. Run a test:        npx tsx tools/playtest.ts prologue
//
// Tests: "prologue" (a new character, from waking up to Old Maren's first
// lesson), "story" (a character who's done the lessons: A Blessing, the Oath
// and all of Act 1; seed it first with tools/seed-tester.ts).
import { Client, Room } from "colyseus.js";
import { DOORS, PLACES, areaAt } from "../shared/map";
import { npcById } from "../shared/npcs";
import type { QuestView } from "../shared/quests";
import { MONSTERS, MonsterId } from "../shared/combat";
import { MAP, isWalkable } from "../shared/map";
import { treeKey } from "../shared/foraging";
import { nodeAt } from "../shared/foraging";
import { tileOf } from "../shared/farming";
import { isFood, SHOP_STEW } from "../shared/cooking";

const URL = process.env.RPG_URL ?? "ws://localhost:2567";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Bot {
  room!: Room;
  quest: QuestView | null = null;
  /** What Keeper Celene said in the opening scene (new characters). */
  intro: string[] | null = null;
  log: string[] = [];
  started = Date.now();
  deaths = 0;
  constructor(public name: string, public password = "secret123") {}

  async join(create: boolean) {
    this.room = await new Client(URL).joinOrCreate("world", { username: this.name, password: this.password, create });
    this.room.onMessage("quest", (q: QuestView) => { this.quest = q; });
    this.room.onMessage("message", (t: string) => { this.note(`💬 ${t}`); if (t.startsWith("☠")) this.deaths++; });
    this.room.onMessage("dialog", (d: { name: string; lines: string[] }) => this.note(`🗨️ ${d.name}: ${d.lines.join(" / ")}`));
    this.room.onMessage("intro", (d: { name: string; lines: string[] }) => { this.intro = d.lines; this.note(`🎬 ${d.name}: ${d.lines.join(" / ")}`); });
    this.room.onMessage("*", () => {});
    await this.until(() => !!this.me, 8000, "join");
    this.room.send("ready");
  }
  note(s: string) {
    const t = ((Date.now() - this.started) / 1000).toFixed(0).padStart(5);
    this.log.push(`${t}s ${s}`);
    if (process.env.VERBOSE) console.log(`[${this.name}] ${t}s ${s}`);
  }
  get me(): any { return this.room?.state?.players?.get(this.room.sessionId); }
  get pos() { return { x: this.me.x as number, y: this.me.y as number }; }
  get task() { return this.quest?.task ?? ""; }

  async until(ok: () => boolean, ms = 20000, what = "something") {
    const end = Date.now() + ms;
    while (!ok()) {
      if (Date.now() > end) throw new Error(`${this.name}: timed out waiting for ${what} (task: ${this.task}, at ${this.pos?.x},${this.pos?.y})`);
      await sleep(100);
    }
  }

  /** Walk to a tile, going through doors to get to another area. */
  async goTo(x: number, y: number, near = 0) {
    await this.enter(x, y);
    if (Math.max(Math.abs(this.pos.x - x), Math.abs(this.pos.y - y)) <= near) return;
    this.room.send("move", { x, y });
    await this.until(() => Math.max(Math.abs(this.pos.x - x), Math.abs(this.pos.y - y)) <= Math.max(near, 0), 120000, `to walk to ${x},${y}`);
  }

  /** Go through doors until we're in the same area as a tile. */
  async enter(x: number, y: number) {
    for (let hop = 0; hop < 6; hop++) {
      const here = areaAt(this.pos.x, this.pos.y)?.id, there = areaAt(x, y)?.id;
      if (here === there) break;
      const door = this.doorToward(here!, there!);
      if (!door) throw new Error(`${this.name}: no way from ${here} to ${there}`);
      this.room.send("move", { x: door.x, y: door.y });
      await this.until(() => areaAt(this.pos.x, this.pos.y)?.id !== here, 90000, `to go through the door to ${door.area}`);
    }
  }

  /** The first door on the way from one area to another (a search over the doors). */
  doorToward(from: string, to: string) {
    const prev = new Map<string, (typeof DOORS)[number] | null>([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const a = queue.shift()!;
      if (a === to) break;
      for (const d of DOORS) {
        if (areaAt(d.x, d.y)?.id !== a || prev.has(d.area)) continue;
        prev.set(d.area, d);
        queue.push(d.area);
      }
    }
    let d = prev.get(to);
    if (!d) return null;
    while (areaAt(d.x, d.y)?.id !== from) d = prev.get(areaAt(d.x, d.y)!.id)!;
    return d;
  }

  /** Walk over to someone (or something) and talk to them (use it). */
  async talk(id: string) {
    const npc = npcById(id)!;
    await this.enter(npc.x, npc.y);
    const before = this.log.length;
    this.room.send("talk", { id });
    await this.until(() => this.log.length > before && Math.abs(this.pos.x - npc.x) + Math.abs(this.pos.y - npc.y) <= 2, 120000, `to talk to ${id}`);
    await sleep(400);
  }

  /** Keep talking to someone until the task changes. */
  async talkUntilNew(id: string) {
    const t = this.task;
    await this.talk(id);
    if (this.log.slice(-3).some((l) => l.includes("bag is too full"))) { this.dropJunk(); await sleep(800); await this.talk(id); }
    await this.until(() => this.task !== t, 5000, `the task to change after talking to ${id}`).catch((e) => this.note(`⚠️ ${e.message}`));
  }

  has(item: string) { return this.count(item) > 0; }
  count(item: string) {
    const b = this.bag;
    if (!b) return 0;
    return b.inventory.reduce((n: number, it: string | null, i: number) => n + (it === item ? b.counts[i] : 0), 0);
  }
  bag: any = null;
  /** Drop things the story doesn't need, like a player would (worms, sage, logs we didn't want...). */
  /** Things the current chapter needs, so dropJunk leaves them alone. */
  keep: string[] = [];
  dropJunk() {
    const junk = ["axe_bronze_oak", "copper_ore", "tin_ore", "red_cap", "wild_root", "oak_logs", "worm", "mushroom", "sage", "honey", "old_bone", "minnow", "pine_logs", "ginseng", "food_scraps"];
    this.bag.inventory.forEach((it: string | null, i: number) => { if (it && junk.includes(it) && !this.keep.includes(it)) this.room.send("drop", { slot: i }); });
    this.note("🗑️ dropped junk to make room");
  }
  /** Eat a meal or a fish when stamina runs low, like a player would. */
  async eatIfTired() {
    if (this.stamina >= 25) return;
    let i = this.bag?.inventory.findIndex((it: string | null) => isFood(it as any)) ?? -1;
    // Out of food and nearly worn out: buy stew from Tam, like a player would (resting is 1 stamina every 30 seconds).
    if (i < 0 && this.stamina < 12 && !this.shopping && Date.now() - this.shoppedAt > 120000) {
      this.shopping = true; this.shoppedAt = Date.now();
      try {
        const back = { ...this.pos };
        await this.talk("tam");
        this.room.send("buy", { item: SHOP_STEW, count: 6 });
        await sleep(1000);
        this.note("🍲 bought stew from Tam");
        await this.enter(back.x, back.y);
      } finally { this.shopping = false; }
      i = this.bag?.inventory.findIndex((it: string | null) => isFood(it as any)) ?? -1;
    }
    if (i >= 0) { this.room.send("eat", { slot: i }); await sleep(600); }
  }
  shopping = false;
  shoppedAt = 0;
  watchBag() {
    this.room.onMessage("bag", (b: any) => { this.bag = b; });
    this.room.onMessage("stamina", (m: any) => { this.stamina = m.stamina; });
  }
  stamina = 100;
  slotOf(item: string) { return this.bag?.inventory.indexOf(item) ?? -1; }

  /** Fight monsters of one kind until the task changes. */
  async fight(kind: MonsterId, untilTaskChanges = true, max = 40) {
    const t = this.task;
    for (let n = 0; n < max; n++) {
      if (untilTaskChanges && this.task !== t) return;
      if (this.me.hp < this.me.maxHp * 0.35) await this.heal();
      await this.eatIfTired();
      const target = this.nearestMonster(kind);
      if (!target) { await sleep(1000); continue; }
      const [id, m] = target;
      this.room.send("attack", { id });
      await this.until(() => !m.alive || this.task !== t || this.me.hp < this.me.maxHp * 0.3, 90000, `to beat a ${kind}`).catch(() => {});
    }
  }
  nearestMonster(kind: MonsterId): [string, any] | null {
    let best: [string, any] | null = null, bestD = Infinity;
    this.room.state.monsters.forEach((m: any, id: string) => {
      if (m.kind !== kind || !m.alive || areaAt(m.x, m.y) !== areaAt(this.pos.x, this.pos.y)) return;
      const d = Math.abs(m.x - this.pos.x) + Math.abs(m.y - this.pos.y);
      if (d < bestD) { bestD = d; best = [id, m]; }
    });
    return best;
  }
  async heal() {
    for (const potion of ["health_potion", "potion_health"]) {
      const i = this.slotOf(potion);
      if (i >= 0) { this.room.send("drink", { slot: i }); await sleep(600); return; }
    }
    // No potions: back off and rest a little.
    await sleep(3000);
  }

  /** Chop, mine or fish the nearest node of a type until the task changes (or we have enough). */
  async gather(kind: "chop" | "mine" | "fish" | "dig", resource: string | null, done: () => boolean, near: { x: number; y: number }) {
    await this.enter(near.x, near.y);
    if (this.bag) this.dropJunk();
    for (let n = 0; n < 200 && !done(); n++) {
      if (this.log.slice(-10).some((l) => l.includes("bag is full") || l.includes("too heavy"))) { this.dropJunk(); this.log.push("(made room)"); await sleep(1000); }
      await this.eatIfTired();
      let spot = this.nearestNode(resource, kind, near);
      // All used up: wait for them to grow back (the Training Ground only has a few of each).
      for (let w = 0; !spot && w < 40; w++) { await sleep(3000); spot = this.nearestNode(resource, kind, near); }
      if (!spot) throw new Error(`${this.name}: no ${resource ?? kind} near ${near.x},${near.y}`);
      this.room.send(kind, spot);
      const k = treeKey(spot.x, spot.y);
      // Work it until it's used up (or we have what we need).
      const seen = this.log.length;
      await this.until(() => done() || this.room.state.depleted.has(k) || this.log.slice(seen).some((l) => /too heavy|too tired|bag is full/.test(l)), 90000, `to ${kind}`).catch(() => {});
      await sleep(300);
    }
  }
  nearestNode(resource: string | null, kind: string, near: { x: number; y: number }) {
    const tile = kind === "chop" ? "tree" : kind === "mine" ? "rock" : kind === "dig" ? "dig" : "water";
    let best: { x: number; y: number } | null = null, bestD = Infinity;
    for (let y = Math.max(0, near.y - 25); y < near.y + 25; y++) for (let x = Math.max(0, near.x - 25); x < near.x + 25; x++) {
      if (MAP[y]?.[x] !== tile) continue;
      if (resource && nodeAt(x, y) !== resource) continue;
      if (this.room.state.depleted.has(treeKey(x, y))) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWalkable(x + dx, y + dy))) continue;
      const d = Math.abs(x - this.pos.x) + Math.abs(y - this.pos.y);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
    return best;
  }

  minutes() { return ((Date.now() - this.started) / 60000).toFixed(1); }
  leave() { return this.room.leave(); }
}

export { PLACES, MONSTERS };

// ---------------------------------------------------------------- scenarios

/** A brand-new character: wake up, meet everyone, light the lanterns, and get sent to Maren. */
async function prologue(name: string) {
  const b = new Bot(name);
  await b.join(true);
  b.watchBag();
  const step = (s: string) => console.log(`[${b.minutes()} min] ${s} -> task: ${b.task}`);
  step("woke up");
  // The opening scene: Celene comes over and talks by herself, and hands over the robe.
  await b.until(() => !!b.intro && b.has("platebody_cloth"), 5000, "the opening scene and the robe"); step("Celene's opening scene");
  if (!/robe/i.test(b.task)) throw new Error(`expected the robe step, got: ${b.task}`);
  // Can't leave the Emberhall in just a shirt.
  const out = DOORS.find((d) => areaAt(d.x, d.y)?.id === "lighthall")!;
  b.room.send("move", { x: out.x, y: out.y });
  await sleep(6000);
  if (areaAt(b.pos.x, b.pos.y)?.id !== "lighthall") throw new Error("walked out of the Emberhall without the robe");
  step("the doors stay shut without the robe");
  // Aldric walks you through the robe instead of going on with the story.
  const t0 = b.task;
  await b.talk("aldric");
  if (b.task !== t0 || !b.log.slice(-4).some((l) => l.includes("Equip"))) throw new Error("Aldric didn't help with the robe");
  step("Aldric explains the robe");
  if (!b.quest!.robeLock?.length) throw new Error("the robe step should lock everything but the bag");
  b.room.send("wear", { slot: b.slotOf("platebody_cloth") });
  await sleep(600);
  if (b.quest!.robeLock?.join() !== "platelegs_cloth") throw new Error(`robe lock should wait for the skirt, got ${b.quest!.robeLock}`);
  if (!b.quest!.checklist?.[0].done || b.quest!.checklist?.[1].done) throw new Error("the robe checklist should tick the top only");
  if (/Walk/.test(b.task)) throw new Error("the robe top alone counted as the whole robe");
  b.room.send("wear", { slot: b.slotOf("platelegs_cloth") });
  await b.until(() => /Walk/.test(b.task), 5000, "the robe to count"); step("robe on");
  // Celene's walking lesson: the two glowing marks down the hall.
  for (const k of ["spot.hallLeft", "spot.hallRight"]) await b.goTo(PLACES[k].x, PLACES[k].y);
  await b.until(() => /Aldric/.test(b.task), 5000, "the walking lesson to finish"); step("walked to both marks");
  // One flowing talk with Aldric: Awakening's end and the start of The Hall of Embers together.
  await b.talkUntilNew("aldric"); step("Aldric (Awakening done, Hall of Embers started)");
  if (!/Oren/.test(b.task)) throw new Error(`expected Oren's tour next, got: ${b.task}`);
  for (const id of ["oren", "circle_aldemar", "circle_vale", "plinth"]) await b.talk(id);
  step("Oren's tour");
  if (b.quest!.checklist?.length !== 3) throw new Error("meeting the three should show a checklist");
  for (const id of ["tomas", "wynne"]) await b.talk(id);
  step("met Tomas and Wynne");
  // Keeper Lisette: her side quest, The Four Books, read in order. Her tick waits for it.
  await b.talk("lisette");
  if (!/glowing lectern/.test(b.task)) throw new Error(`expected The Four Books, got: ${b.task}`);
  if (b.quest!.checklist) throw new Error("one book at a time: no checklist");
  if (!b.quest!.lit?.includes("book_1")) throw new Error("the first book should glow");
  const t1 = b.task;
  await b.talk("book_3");
  if (b.task !== t1) throw new Error("read a later book out of order");
  for (let n = 1; n <= 4; n++) await b.talk(`book_${n}`);
  if (!/Lisette/.test(b.task)) throw new Error(`expected to go back to Lisette, got: ${b.task}`);
  await b.talk("lisette");
  await b.until(() => /Go back to High Keeper Aldric/.test(b.task), 5000, "Lisette's tick to finish the three"); step("The Four Books (side quest), Lisette ticked");
  await b.talkUntilNew("aldric"); step("Hall done, Light the Way started");
  for (let n = 1; n <= 6; n++) await b.talk(`lantern_${n}`);
  step("lanterns lit");
  await b.talkUntilNew("aldric"); step("got the lantern, The Old Sweeper too");
  if (!b.has("lantern")) throw new Error("no lantern");
  await b.until(() => b.quest!.marks.includes("maren"), 5000, "Maren's ❗"); step("The Old Sweeper");
  await b.talkUntilNew("maren"); step("Maren's first lesson");
  const marks = b.quest!.marks;
  console.log(`Marks now: ${marks.join(", ")}. Lit: ${b.quest!.lit?.length}. Deaths: ${b.deaths}. Took ${b.minutes()} minutes.`);
  await b.leave();
  return b;
}

/** Someone who's done the lessons (tools/seed-tester.ts): A Blessing, the Oath, and all of Act 1. */
async function story(name: string) {
  const b = new Bot(name);
  await b.join(false);
  b.watchBag();
  const times: [string, string][] = [];
  let mark = Date.now();
  const done = (what: string) => {
    const mins = ((Date.now() - mark) / 60000).toFixed(1);
    times.push([what, mins]);
    console.log(`[${b.minutes()} min] ${what} (${mins} min) · deaths ${b.deaths} · tithe ${b.me.tithe} · task: ${b.task}`);
    mark = Date.now();
  };
  const town = PLACES.lighthallSteps;
  let t = "";
  const isDone = (id: string) => b.quest?.chapters.find((c) => c.id === id)?.state === "done";
  const started = (id: string) => ["done", "active", "started"].includes(b.quest?.chapters.find((c) => c.id === id)?.state ?? "");
  const plotTile = () => {
    let at = -1;
    b.room.state.plots.forEach((pl: any, k: string) => { if (pl.owner === b.name) at = Number(k); });
    if (at < 0) throw new Error("no plot");
    return tileOf(at, 0);
  };
  await b.until(() => !!b.quest, 10000, "the quest tracker");
  // Every minute (with PLAYTEST_TRACE set): where the bot is and what it's on, to spot where it gets stuck.
  if (process.env.PLAYTEST_TRACE) setInterval(() => console.log(`  · ${b.minutes()} min at ${b.pos.x},${b.pos.y} (${areaAt(b.pos.x, b.pos.y)?.id}) · ${b.task} · last: ${b.log.slice(-2).join(" | ").slice(0, 160)}`), 60000).unref();
  const quarry = { x: 90, y: 24 };
  const digSome = async (until: () => boolean) => b.gather("dig", null, until, PLACES["tg.greta"]);

  // P.7 A Blessing: dig 20 patches (that also finds the herbs for Moss's tonics).
  if (!isDone("blessing")) {
    await b.talkUntilNew("celene");
    t = b.task;
    await digSome(() => b.task !== t);
    await b.talkUntilNew("celene");
    done("A Blessing");
  }
  // P.8 Oath of the Flame.
  if (!isDone("oath")) {
    await b.talkUntilNew("aldric");
    await b.talk("heart_shrine");
    await b.talkUntilNew("aldric");
    if (b.me.rank !== 1) throw new Error("not an Ember");
    done("Oath of the Flame");
  }

  // Odo's field first, so the crop grows while we do the rest. Wait out the blessing before harvesting.
  if (!started("odo_field")) {
    await b.talkUntilNew("odo");
    b.room.send("farmBuy");
    await sleep(800);
    b.room.send("buy", { item: "seed_potato", count: 4 });
    await sleep(800);
    t = b.task;
    b.room.send("farm", plotTile());
    await b.until(() => b.task !== t, 60000, "planting");
    done("Odo's field: planted");
  }

  // 1.1 Lantern Rounds.
  if (!isDone("rounds")) {
    await b.talkUntilNew("aldric");
    for (let n = 1; n <= 6; n++) await b.talk(`round_${n}`);
    await b.talkUntilNew("aldric");
    done("1.1 Lantern Rounds");
  }
  // 1.2 The First Tithe.
  if (!isDone("first_tithe")) {
    await b.talk("aldric");
    if (b.count("potion_tithe") < 2) throw new Error("no tonics from Aldric");
    done("1.2 The First Tithe");
  }
  // 1.11 Maren's Question.
  if (!isDone("marens_question")) {
    await b.talk("maren");
    if (!b.has("marens_charm")) throw new Error("no charm");
    done("1.11 Maren's Question");
  }
  // 1.3 Blessing the Fields.
  if (!isDone("bless_fields")) {
    await b.talkUntilNew("celene");
    for (const k of ["spot.fieldNorth", "spot.fieldMid", "spot.fieldSouth"]) await b.goTo(PLACES[k].x, PLACES[k].y, 1);
    await b.talkUntilNew("odo");
    await b.talkUntilNew("celene");
    done("1.3 Blessing the Fields");
  }
  // 1.4 Tithe Tonics.
  if (!isDone("tonics")) {
    b.keep = ["red_cap", "wild_root"];
    await b.talkUntilNew("moss");
    if (b.count("red_cap") < 5 || b.count("wild_root") < 5) await digSome(() => b.count("red_cap") >= 5 && b.count("wild_root") >= 5);
    const table = npcById("alchemy_table")!;
    await b.enter(table.x, table.y);
    t = b.task;
    for (let n = 0; n < 15 && b.task === t; n++) {
      // A failed brew uses up the herbs: dig for more.
      if (b.count("red_cap") < 1 || b.count("wild_root") < 1) { await digSome(() => b.count("red_cap") >= 2 && b.count("wild_root") >= 2); await b.enter(table.x, table.y); }
      await b.talk("alchemy_table");
      const had = b.count("potion_tithe");
      b.room.send("craft", { item: "potion_tithe" });
      await b.until(() => b.count("potion_tithe") > had, 30000, "brewing").catch(() => {});
      await sleep(500);
    }
    await b.talkUntilNew("moss");
    b.keep = [];
    done("1.4 Tithe Tonics");
  }
  // 1.5 The Totem.
  if (!isDone("totem")) {
    b.keep = ["oak_logs"];
    await b.talkUntilNew("rook");
    await b.gather("chop", "oak", () => b.count("oak_logs") >= 5, PLACES["tg.holt"]);
    await b.talkUntilNew("rook");
    await b.talkUntilNew("aldric");
    await b.talkUntilNew("rook");
    b.keep = [];
    done("1.5 The Totem");
  }
  // 1.6 Ash on the Road.
  if (!isDone("ash_road")) {
    const reporting = b.task.startsWith("Report");
    await b.talkUntilNew("bryn");
    if (!reporting) {
      await b.goTo(PLACES.westShrine.x + 2, PLACES.westShrine.y + 2, 2);
      await b.fight("ashbound_scout");
    }
    await b.talkUntilNew("bryn");
    done("1.6 Ash on the Road");
  }
  // 1.7 Rebuild the Shrine.
  if (!isDone("rebuild")) {
    b.keep = ["oak_logs", "bronze_bar", "copper_ore", "tin_ore"];
    await b.talkUntilNew("aldric");
    // Back for another go after a stop: the logs or bars might have gone (the shrine checks again).
    if (b.task.startsWith("Rebuild") && (b.count("oak_logs") < 6 || b.count("bronze_bar") < 2)) await b.gather("chop", "oak", () => b.count("oak_logs") >= 6, PLACES["tg.holt"]);
    if (b.count("bronze_bar") < 2) {
      await b.gather("mine", "copper", () => b.count("copper_ore") >= 3, quarry);
      await b.gather("mine", "tin", () => b.count("tin_ore") >= 3, quarry);
    }
    const furnace = npcById("furnace")!;
    await b.enter(furnace.x, furnace.y);
    for (let n = 0; n < 10 && b.count("bronze_bar") < 2; n++) {
      if (b.count("copper_ore") < 1 || b.count("tin_ore") < 1) {
        await b.gather("mine", "copper", () => b.count("copper_ore") >= 2, quarry);
        await b.gather("mine", "tin", () => b.count("tin_ore") >= 2, quarry);
        await b.enter(furnace.x, furnace.y);
      }
      await b.talk("furnace");
      const msgs = b.log.length;
      b.room.send("craft", { item: "bronze_bar" });
      await b.until(() => b.log.slice(msgs).some((l) => /You smelt|fail to smelt|You need/.test(l)), 30000, "smelting").catch(() => {});
      await sleep(500);
    }
    // Oak logs for the shrine's frame: keep them when making room. Chop until the task moves on.
    b.keep = ["oak_logs"];
    await b.gather("chop", "oak", () => !b.task.startsWith("Get") && b.count("oak_logs") >= 6, PLACES["tg.holt"]);
    await b.until(() => !b.task.startsWith("Get"), 5000, "oak logs and bars");
    await b.talkUntilNew("rook");
    await b.talkUntilNew("west_shrine");
    b.keep = [];
    await b.talkUntilNew("aldric");
    done("1.7 Rebuild the Shrine");
  }
  // 1.8 What Holt Saw.
  if (!isDone("holt_saw")) {
    await b.talkUntilNew("holt");
    for (const k of ["spot.nearLighthall", "spot.farLake", "spot.nearWestShrine", "spot.nearGate", "spot.farPeaks", "spot.farCoast"]) await b.goTo(PLACES[k].x, PLACES[k].y, 1);
    await b.talkUntilNew("holt");
    done("1.8 What Holt Saw");
  }
  // 1.9 Odo's Stubborn Field: harvest (no blessing).
  if (!isDone("odo_field")) {
    await b.talk("odo");
    await b.until(() => (b.room.state.serverNow ?? 0) >= 0 && !(b.quest?.task ?? "").startsWith("Plant"), 2000, "harvest step").catch(() => {});
    t = b.task;
    b.dropJunk();
    for (let n = 0; n < 60 && b.task === t; n++) {
      if (b.log.slice(-3).some((l) => l.includes("bag is full"))) b.dropJunk();
      b.room.send("farm", plotTile());
      await sleep(20000);
    }
    await b.talkUntilNew("odo");
    done("1.9 Odo's Stubborn Field");
  }
  // 1.10 The Hollow Wolves.
  if (!isDone("hollow_wolves")) {
    await b.talkUntilNew("kael");
    t = b.task;
    for (let n = 0; n < 6 && b.task === t; n++) {
      await b.goTo(16, 90, 3); // the grey dust west of the pasture (again after a knock-out: you wake at a shrine)
      await b.fight("hollow_wolf", true, 15);
    }
    await b.talkUntilNew("kael");
    done("1.10 The Hollow Wolves");
  }
  // 1.12 A Flame at the Valley's Edge.
  if (!isDone("thorn_light")) {
    await b.talkUntilNew("aldric");
    t = b.task;
    for (let n = 0; n < 6 && (b.task.startsWith("Lead") || b.task.includes("wolves")); n++) {
      t = b.task;
      await b.goTo(PLACES["spot.thornEdge"].x, PLACES["spot.thornEdge"].y, 1);
      await b.fight("wolf", true, 15);
    }
    await b.talkUntilNew("thorn_shrine");
    await b.talkUntilNew("rhys");
    await b.talk("aldric");
    if (b.me.rank !== 2) throw new Error("not a Flame");
    done("1.12 A Flame at the Valley's Edge");
  }
  console.log(`\nAll done in ${b.minutes()} minutes. Deaths: ${b.deaths}. Tithe marks now: ${b.me.tithe}.`);
  for (const [w, m] of times) console.log(`  ${w.padEnd(34)} ${m} min`);
  await b.leave();
  return b;
}

const SCENARIOS: Record<string, (name: string) => Promise<Bot>> = { prologue, story };

if (process.argv[2]) {
  const which = process.argv[2];
  const name = process.argv[3] ?? `Bot${Math.floor(Math.random() * 9000 + 1000)}`;
  SCENARIOS[which](name).then((b) => {
    if (process.env.LOG) console.log(b.log.join("\n"));
    process.exit(0);
  }).catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
}
