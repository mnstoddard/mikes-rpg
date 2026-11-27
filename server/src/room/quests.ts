// The story and quests: talking, quest steps, the quest log.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { type } from "@colyseus/schema";
import { RESOURCES, RESOURCE_FOR_ITEM } from "../../../shared/foraging";
import { DISCIPLINES, SkillId, findSkill, isUnlocked, levelForXp, xpForLevel, findSkill as skillInfo } from "../../../shared/disciplines";
import { MONSTERS, POTION_ID, SPELLS } from "../../../shared/combat";
import { GEAR_SLOTS, isGear } from "../../../shared/gear";
import { TOOL_TYPES, TOOL_TYPE_IDS, isTool, parseTool } from "../../../shared/tools";
import { ITEMS, ItemId } from "../../../shared/items";
import { NPCS, NpcDef, npcById } from "../../../shared/npcs";
import { countIn, countItem, roomFor, roomForAll, takeFromEntry, takeItem } from "../../../shared/bag";
import { formatMoney } from "../../../shared/money";
import { SPELL_BOOKS, isSpellBook } from "../../../shared/spells";
import { buffPower } from "../../../shared/alchemy";
import { SHOP_STEW, isFood, isMeal } from "../../../shared/cooking";
import { GUIDE_NAME, Gift, QuestStep, QuestView, giftItems, tutorialDone, currentStep, chapterById, chapterOf, chapterDone, chapterOpen, chapterViews, questMarks, marenDone, ChapterProgress, Chapter, ChapterId, CHAPTERS, gateMet, litLanterns, opensAfter, rankOf, talkWith } from "../../../shared/quests";
import { isShop } from "../../../shared/shops";
import { store } from "../storage";
import { BLESS_MINUTES, BLESS_POWER, FOUR_BOOKS, LISETTE_EXCUSES, RANKS as LIGHT_RANKS, STORY_ITEMS, SPOT_NAMES, isStoryItem } from "../../../shared/story";
import { PLACES } from "../../../shared/map";
import { stepSpots } from "../questTargets";
import { Player } from "./schema";
import { worldNow, QuestEvent, aOr, plural } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const questsMethods = {
  // ---- Old Maren's tutorial (steps in shared/quests.ts) ----

  /** The tutorial step this player is on, or null once it's finished. */
  step(this: WorldRoom, p: Player): QuestStep | null {
    return currentStep(p.quest);
  },
  /** The active chapter's progress (which step, how far along), or null between chapters. */
  prog(this: WorldRoom, p: Player): ChapterProgress | null {
    return p.quest.active ? p.quest.ch[p.quest.active] ?? null : null;
  },
  /** Who gives the active chapter ("Forester Holt"), for messages. */
  giverName(this: WorldRoom, p: Player): string {
    return p.quest.active ? chapterById(p.quest.active).name : GUIDE_NAME;
  },
  /** Something happened that might finish (or count toward) the current step. */
  questEvent(this: WorldRoom, p: Player, client: Client | undefined, ev: QuestEvent) {
    const step = this.step(p);
    if (!step) return;
    const g = step.goal;
    let counts = 0;
    if (g.kind === "gather" && ev.kind === "gather") {
      if ((!g.skill || ev.skill === g.skill) && (!g.resource || ev.resource === g.resource) && (!g.withTool || ev.withTool) && (!g.byHand || !ev.withTool)) counts = 1;
    } else if (g.kind === "toolBreaks" && ev.kind === "toolBreak") {
      if (ev.tool === g.tool) counts = 1;
    } else if (g.kind === "craft" && ev.kind === "craft") {
      if (ev.item.startsWith(g.prefix) && (ev.worked || g.tries)) counts = 1;
    } else if (g.kind === "eat" && ev.kind === "eat") {
      if (isMeal(ev.item)) counts = 1;
    } else if (g.kind === "sell" && ev.kind === "sell") {
      const r = RESOURCE_FOR_ITEM[ev.item];
      if (!g.what || (r && RESOURCES[r].skill === g.what)) counts = 1;
    } else if (g.kind === "buy" && ev.kind === "buy") {
      counts = 1;
    } else if (g.kind === "repair" && ev.kind === "repair") {
      counts = 1;
    } else if (g.kind === "trash" && ev.kind === "trash") {
      if (ev.item.startsWith(g.prefix)) counts = 1;
    } else if (g.kind === "kill" && ev.kind === "kill") {
      if ((!g.monster || ev.monster === g.monster) && (!g.style || ev.style === g.style)) counts = 1;
    } else if (g.kind === "drink" && ev.kind === "drink") {
      counts = 1;
    } else if (g.kind === "enchant" && ev.kind === "enchant") {
      counts = 1;
    } else if (g.kind === "track" && ev.kind === "track") {
      counts = 1;
    } else if (g.kind === "bounty" && ev.kind === "bounty") {
      counts = 1;
    } else if (g.kind === "harvest" && ev.kind === "harvest") {
      if (g.unblessed && buffPower(p.buffs, "blessed", worldNow()) > 0) {
        if (client) this.say(client, `${this.giverName(p)} said no blessings! That one doesn't count. Wait for your ✨ blessing to run out.`);
      } else counts = 1;
    } else if ((g.kind === "plot" || g.kind === "plant") && ev.kind === g.kind) {
      counts = 1;
    }
    if (!counts) return;
    const prog = this.prog(p)!;
    prog.count += counts;
    p.dirty = true;
    if (prog.count >= ("count" in g ? g.count : 1)) this.advance(p, client);
    else if (client) this.sendQuest(client, p);
  },
  /** Steps that finish on their own: reaching a level, or having some items. */
  checkQuest(this: WorldRoom, p: Player, client: Client) {
    const step = this.step(p);
    if (step && this.goalMet(p, step)) this.advance(p, client);
    else this.sendQuest(client, p);
  },
  goalMet(this: WorldRoom, p: Player, step: QuestStep): boolean {
    const g = step.goal;
    if (g.kind === "level") return p.levels[g.discipline] >= g.level;
    if (g.kind === "skillLevel") return levelForXp(p.skillXp[g.skill]) >= g.level;
    if (g.kind === "equip") return g.tools.every((prefix) => TOOL_TYPE_IDS.some((t) => p.belt[t]?.item.startsWith(prefix)));
    if (g.kind === "have") return Object.entries(g.items).every(([item, n]) => this.countOf(p, item as ItemId) >= n!);
    if (g.kind === "gear") return g.items.every((prefix) => GEAR_SLOTS.some((slot) => p.gear[slot]?.item.startsWith(prefix)));
    if (g.kind === "track") return !!p.tracked;
    if (g.kind === "plot") return !!this.plotOf(p);
    if (g.kind === "spendPoint") return Object.values(p.tree).some((rank) => (rank ?? 0) > 0);
    return false;
  },
  countOf(this: WorldRoom, p: Player, item: ItemId) {
    return countItem(p, item);
  },
  /** On to the next step (and past any that are already done, like a level you already have). */
  advance(this: WorldRoom, p: Player, client: Client | undefined) {
    const prog = this.prog(p);
    if (!prog) return;
    const chapter = chapterById(p.quest.active!);
    const finished = this.step(p);
    // A step that finished by itself (putting the robe on): someone says something about it.
    if (client && finished?.doneLines?.length) this.dialog(client, finished.doneLines, finished.doneSpeaker ?? chapter.name);
    prog.step++;
    prog.count = 0;
    prog.got = []; // a fresh list for the next step (the last step's people don't count twice)
    p.dirty = true;
    this.leadStep(p);
    let step = this.step(p);
    while (step && this.goalMet(p, step)) {
      prog.step++;
      step = this.step(p);
    }
    if (!step) {
      // Chapter finished: back to picking the next trainer.
      p.quest.active = null;
      if (client) {
        this.say(client, `🎉 Quest complete: ${chapter.title}!`);
        client.send("questDone", { quest: chapter.title });
      }
      // The Four Books done: Lisette is ticked off The Hall of Embers' checklist, and that quest picks up again (version 0.21).
      if (chapter.id === "four_books" && this.tickLisette(p, client)) return;
    }
    this.saveSoon(p);
    this.refreshStats(p, client); // a lesson may have taught you a skill
    if (!client) return;
    if (step) this.say(client, `📜 Next: ${step.task}.`);
    else {
      // A story chapter that's just opened: say who to see next.
      const next = CHAPTERS.find((c) => (c.act || c.id === "maren") && !c.side && !p.quest.ch[c.id] && chapterOpen(p.quest, c.id) && gateMet(c, this.levelOf(p)));
      if (next) this.say(client, `📜 Next: ${next.title}. Talk to ${next.name}, ${next.where}.`);
      else if (!tutorialDone(p.quest)) this.say(client, "📜 Next: talk to anyone with a ❗ for your next lesson (the 📜 Quests tab lists them all).");
    }
    this.sendQuest(client, p);
  },
  /** Tick Keeper Lisette off The Hall of Embers (her side quest is done). True if that quest is now active (advance() has done the rest). */
  tickLisette(this: WorldRoom, p: Player, client: Client | undefined): boolean {
    const hall = p.quest.ch.hall;
    const step = hall && chapterById("hall").steps[hall.step];
    if (!hall || step?.goal.kind !== "visit" || !step.goal.npcs.includes("lisette")) return false;
    if (!hall.got?.includes("lisette")) hall.got = [...(hall.got ?? []), "lisette"];
    hall.count = hall.got.filter((id) => (step.goal as { npcs: string[] }).npcs.includes(id)).length;
    p.quest.active = "hall";
    p.dirty = true;
    if (client) this.say(client, `📜 The Hall of Embers: ✓ Keeper Lisette (${hall.count} of ${step.goal.npcs.length} Emberguard).`);
    if (hall.count >= step.goal.npcs.length) this.advance(p, client);
    else if (client) this.sendQuest(client, p);
    this.saveSoon(p);
    return true;
  },
  /** Why you can't sell, drop or eat something Maren's current task needs. */
  keepIt(this: WorldRoom, p: Player, item: ItemId, what: "sell" | "drop" | "eat" | "store"): string {
    const name = ITEMS[item].single;
    const who = this.giverName(p);
    if (what === "sell") return `Hold on to that ${name}: ${who} needs you to use it. Come back once you've done what they asked.`;
    if (what === "eat") return `Not yet! ${who} wants to see that ${name} first. Go and show them.`;
    return `Better keep that ${name}. ${who} needs you to use it.`;
  },
  /**
   * Click someone who gives a chapter of the main quest: start their chapter,
   * do its next talk step, or remind you what to do. Returns true if that's
   * all the click does; false lets their usual window open too (a trainer's
   * shop, the guild), e.g. when the step is "buy something from me".
   */
  talkQuest(this: WorldRoom, client: Client, p: Player, npc: NpcDef): boolean {
    const q = p.quest;
    let chapter: Chapter | null = chapterOf(npc.id, q, this.levelOf(p));
    // A side quest that needs a level you don't have yet (e.g. Renown 10): not offered yet.
    if (chapter && !q.ch[chapter.id] && !gateMet(chapter, this.levelOf(p))) {
      if (chapter.side && chapter.requires) this.say(client, `${chapter.name}: Come back when you're better known (${skillInfo(chapter.requires.skill).def.name} ${chapter.requires.level}). I might have a job for you then.`);
      chapter = null;
    }
    if (npc.id === "maren") this.marenHelps(client, p);
    if (!chapter || chapterDone(q, chapter.id)) {
      if (npc.id !== "maren") return false;
      this.dialog(client, tutorialDone(q) ? ["You've learned all anyone in town can teach you. Go and make your fortune!",
        "If you're after work, Captain Bryn's bounty board is right here. Folk pay double for the things they need."]
        : ["You've learned all I can teach you. Go and see the trainers: anyone with a ❗ over their head has a lesson for you.",
          "Your 📜 Quests tab says where each one is."]);
      return true;
    }
    if (!chapterOpen(q, chapter.id)) {
      if (chapter.act) {
        if (npc.id === "maren") return false;
        this.say(client, `${chapter.name}: ${npc.kind === "person" ? "I'll have something more for you later." : ""} (📜 ${chapter.title}: ${opensAfter(q, chapter.id).toLowerCase()}.)`);
        return false;
      }
      if (!marenDone(q)) {
        this.say(client, `${chapter.name}: Come and see me for a lesson once ${GUIDE_NAME} has shown you the basics. She lives in the cottage on the lake shore, west along the road.`);
        return false;
      }
      // Lessons that build on another skill: send them to that trainer first.
      const first = chapterById((chapter.after ?? []).find((a) => !chapterDone(q, a))!);
      const why: Partial<Record<string, string>> = {
        brann: "You'll need to know your way round ore before you can smelt and smith it.",
        rook: "You'll need to know how to cut wood before you can work it.",
        moss: "You'll need to know your herbs before you can brew with them.",
        ysolde: "Learn to look after yourself in a fight before you start throwing spells about.",
        bryn: "Learn how buying and selling works first: the bounty board pays in coin.",
      };
      this.say(client, `${chapter.name}: ${why[chapter.id] ?? "Not yet."} Go and see ${first.name} first (${first.where}).`);
      return false;
    }
    if (q.active !== chapter.id) {
      const was = q.active && !chapterDone(q, q.active) ? chapterById(q.active) : null;
      if (!q.ch[chapter.id]) q.ch[chapter.id] = { step: 0, count: 0 };
      q.active = chapter.id;
      p.dirty = true;
      if (was && chapter.side && chapter.act) this.say(client, `📜 New side quest: ${chapter.title}. ${was.title} waits for you; your 📜 Quests tab has both.`);
      else if (was) this.say(client, `📜 You switch to ${chapter.name}'s lesson. ${was.name}'s will wait for you: talk to them to pick it up again.`);
      this.sendQuest(client, p);
    }
    const step = this.step(p);
    if (!step) return false;
    // A talk step with someone else (deliver the totem to Aldric...): point the way.
    if (step.goal.kind === "talk" && talkWith(chapter, step) !== npc.id) {
      this.dialog(client, [step.task + "."], chapter.name);
      return true;
    }
    if (step.goal.kind !== "talk") {
      const given = this.giveMissing(p, step.ensure);
      if (given) this.sendInventory(client, p);
      const t = step.needsTool && !p.belt[step.needsTool] ? ` And put your ${TOOL_TYPES[step.needsTool].name.toLowerCase()} back on your belt!`
        : this.fightBlock(p) ? ` And ${step.fightWith === "magic" ? "hold your staff" : step.fightWith === "ranged" ? "hold your sling" : "hold a weapon"}!` : "";
      const text = `${step.hint ?? step.task}` + (given ? ` Here, take ${given}.` : "") + t;
      // Trainers with a shop open it too (the step may be to buy or sell something there).
      if (isShop(npc.id)) { this.say(client, `${chapter.name}: ${text}`); return false; }
      this.dialog(client, [text], chapter.name);
      return true;
    }
    return this.doTalk(client, p, chapter, step, npc);
  },
  /** Do a talk step: they say their piece, take what they need, and hand over the rewards. */
  doTalk(this: WorldRoom, client: Client, p: Player, chapter: Chapter, step: QuestStep, npc: NpcDef, before: string[] = [], asIntro = false): boolean {
    const speaker = npc.kind === "person" ? npc.name : chapter.name;
    // Worn or on your belt counts too (you might have put the platelegs on).
    const hasNeed = (pre: string) => p.inventory.some((it) => it?.startsWith(pre))
      || GEAR_SLOTS.some((s) => p.gear[s]?.item.startsWith(pre)) || Object.values(p.belt).some((t) => (t as { item?: string } | null)?.item?.startsWith(pre));
    if (step.need && !hasNeed(step.need.prefix)) {
      this.dialog(client, [step.need.line], speaker);
      return true;
    }
    const take = Object.entries(step.take ?? {}) as [ItemId, number][];
    const short = take.filter(([item, n]) => this.countOf(p, item) < n);
    if (short.length) {
      this.dialog(client, [`You still need ${short.map(([item, n]) => `${n - this.countOf(p, item)} more ${n - this.countOf(p, item) === 1 ? ITEMS[item].single : plural(ITEMS[item].name)}`).join(" and ")}.`], speaker);
      return true;
    }
    const gifts = giftItems(step.give);
    if (!roomForAll(p, gifts.map((g) => g.item))) {
      this.dialog(client, [`I've got ${gifts.length === 1 ? "something" : `${gifts.length} things`} for you, but your bag is too full. Make some room and come back.`], speaker);
      return true;
    }
    for (const [item, n] of take) takeItem(p, item, n);
    for (const g of gifts) this.give(p, g.item, 1, g.durability, true); // gifts never count against weight, so the lessons can't get stuck
    if (step.coins) p.coins += step.coins;
    // What they hand over goes at the end of what they say, so it's clear what you got and where it went.
    const lines = [...(step.lines ?? [])];
    if (gifts.length || step.coins) {
      const names = [...new Set(gifts.map((g) => g.item))].map((item) => {
        const n = gifts.filter((g) => g.item === item).length;
        if (n === 1) return aOr(ITEMS[item].single);
        return `${n} ${plural(ITEMS[item].name)}`;
      });
      if (step.coins) names.push(`${formatMoney(step.coins)} coins`);
      const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
      const where = gifts.length && step.coins ? "They're in your 🎒 bag (coins at the bottom)." : gifts.length ? "Look in your 🎒 bag." : "Coins show at the bottom of your 🎒 bag.";
      lines.push(`🎁 ${speaker} gives you ${list}. ${where}`);
      this.say(client, `🎁 ${speaker} gives you ${list}.`);
      if (step.coins) client.send("reward", { text: `+${formatMoney(step.coins)}` });
    }
    if (take.length) this.say(client, `You hand over ${take.map(([item, n]) => (n === 1 ? aOr(ITEMS[item].single) : `${n} ${plural(ITEMS[item].name)}`)).join(" and ")}.`);
    for (const [skill, xp] of Object.entries(step.xp ?? {}) as [SkillId, number][]) this.addSkillXp(p, client, skill, xp);
    // Alchemist Moss tells you the Tithe tonic's secret recipe.
    if (chapter.id === "tonics" && !p.discovered.includes("tithe")) {
      p.discovered.push("tithe");
      this.say(client, "⚗️ You learn a secret recipe: Tithe tonic (red cap + wild root). It's in your list at the alchemy table.");
      client.send("discovered", p.discovered);
    }
    if (step.bless) this.bless(client, p);
    if (step.warden) this.giveWarden(client, p);
    if (step.opensGate) this.say(client, "🚪 The gate to the Dark Forest is open to you now. It's in Heartvale, just outside Emberhold's River Gate, past the ⚠ signs (the city gates open after the Oath).");
    if (step.opensBoard) this.say(client, "📋 The bounty board is open to you now. Its jobs are in the 📜 Quests tab too.");
    this.advance(p, client);
    if (step.rank) this.updateRank(client, p);
    if (step.opensBoard) { this.fillBoard(p); this.sendBounties(client, p); }
    // Hand over anything the next step needs that you don't have (e.g. a minnow to cook).
    const extra = this.giveMissing(p, this.step(p)?.ensure);
    if (extra) this.say(client, `${chapter.name} also gives you ${extra}.`);
    this.sendInventory(client, p);
    this.saveSoon(p);
    // One flowing conversation (Mike's note #10): if the same person has the next thing to say
    // (the next step, or the next story chapter starting with a talk to them), carry straight on.
    const next = this.nextTalkWith(p, npc);
    if (next) return this.doTalk(client, p, next.chapter, next.step, npc, [...before, ...lines], asIntro);
    const all = [...before, ...lines];
    if (asIntro) client.send("intro", { name: speaker, lines: all, from: npc.id });
    else this.dialog(client, all, speaker);
    return true;
  },
  /** The robe step at the start (Mike's notes #2 and #3): the story waits, and the Emberhall's doors stay shut, until the robe is on. */
  robeStep(this: WorldRoom, p: Player): boolean {
    const step = this.step(p);
    return p.quest.active === "awakening" && step?.goal.kind === "gear";
  },
  /** High Keeper Aldric or Keeper Celene, clicked while you're still in your shirt: they walk you through putting the robe on. */
  robeHelp(this: WorldRoom, client: Client, p: Player, npc: NpcDef): boolean {
    if ((npc.id !== "aldric" && npc.id !== "celene") || !this.robeStep(p)) return false;
    const step = this.step(p)!;
    const given = this.giveMissing(p, step.ensure);
    if (given) this.sendInventory(client, p);
    this.dialog(client, [
      npc.id === "aldric" ? "Welcome, welcome! But first things first: let's get you dressed, and then we'll talk properly." : "Let's get you dressed first, then you can meet High Keeper Aldric.",
      "Open your 🎒 bag with the button at the bottom right of the screen. Click the robe, then press Equip. That's all there is to it.",
      ...(given ? [`Here, take ${given}. You must have dropped yours.`] : []),
    ], npc.name);
    return true;
  },
  // ---- The story (shared/story.ts) ----

  /** Read or use a story item: a blessing scroll, a note, Maren's charm. */
  readStory(this: WorldRoom, client: Client, p: Player, slot: number, item: ItemId) {
    const name = STORY_ITEMS[item as keyof typeof STORY_ITEMS].name;
    if (item === "blessing_scroll") {
      takeFromEntry(p, slot, 1);
      this.say(client, "📜 You read the blessing aloud, and warm light settles on you.");
      this.bless(client, p);
      this.sendInventory(client, p);
      return this.saveSoon(p);
    }
    const flame = rankOf(p.quest) >= 2;
    const text: Partial<Record<string, string[]>> = {
      rooks_note: flame ? ["You break the wax. Inside, in Rook's careful carving-hand:", "\"Ask Maren about the first one.\""]
        : ["You promised Rook you wouldn't read it. Maybe later, once you're a proper Flame of the Emberhall."],
      ashbound_note: ["Charcoal on rough paper, in a hurried hand:", "\"They aren't what they seem.\""],
      marens_charm: ["A little wooden flame, worn smooth. On the back, scratched very small: a single letter, M.", "It's warm, as if someone had only just let go of it."],
      holts_notes: ["Near shrines: 28 dead trees out of 35.", "Far from shrines: 2 dead trees out of 34.", "Underneath, Holt has written: \"Ashbound poison? Then why only near the shrines they DIDN'T smash?\""],
      lantern: ["High Keeper Aldric's lantern. Nights are less dark while you carry it."],
      shrine_totem: ["Rook's oak totem, carved with the Emberhall's flame."],
    };
    this.dialog(client, text[item] ?? [STORY_ITEMS[item as keyof typeof STORY_ITEMS].description], name);
  },
  /**
   * Clicking someone (or something) the story needs: a visit step (light this
   * lantern, meet that Emberguard), or a talk step with someone who isn't the
   * chapter's giver (bring the totem to Aldric). Returns true if that's all the click does.
   */
  storyClick(this: WorldRoom, client: Client, p: Player, npc: NpcDef): boolean {
    const q = p.quest;
    // Keeper Lisette's tick in The Hall of Embers waits for her side quest (version 0.21): talking to her starts it (talkQuest).
    if (npc.id === "lisette" && !chapterDone(q, "four_books")) return false;
    // A visit step in another chapter you've started (a book for Lisette while The Hall of Embers is active): switch to it.
    const cur = this.step(p);
    if (!(cur?.goal.kind === "visit" && cur.goal.npcs.includes(npc.id))) {
      const other = (Object.keys(q.ch) as ChapterId[]).find((id) => {
        if (id === q.active || chapterDone(q, id)) return false;
        const st = chapterById(id).steps[q.ch[id]!.step];
        return st?.goal.kind === "visit" && st.goal.npcs.includes(npc.id) && !q.ch[id]!.got?.includes(npc.id);
      });
      if (other) { q.active = other; p.dirty = true; }
    }
    const step = this.step(p);
    const prog = this.prog(p);
    if (step && prog && step.goal.kind === "visit" && step.goal.npcs.includes(npc.id)) {
      // Keeper Oren's tour (version 0.22, Mike's note): once you've talked to him he walks you round the statues himself.
      const tourLeft = () => step.tour ? (step.goal as { npcs: string[] }).npcs.filter((id) => id !== step.tour && !prog.got?.includes(id)) : [];
      if (prog.got?.includes(npc.id)) {
        if (npc.id === step.tour && tourLeft().length) {
          this.dialog(client, ["Ready? Come along, then. Stay by me."], step.speaker ?? npc.name);
          client.send("tour", { guide: npc.id, stops: tourLeft() });
          return true;
        }
        return false;
      }
      if (step.tour && npc.id !== step.tour && !prog.got?.includes(step.tour)) {
        this.dialog(client, [`(${step.speaker ?? "Your guide"} hurries over.) "Ah, not without me! Come and find me first, and I'll walk you round."`], step.speaker ?? npc.name);
        return true;
      }
      prog.got = [...(prog.got ?? []), npc.id];
      prog.count = prog.got.filter((id) => (step.goal as { npcs: string[] }).npcs.includes(id)).length;
      p.dirty = true;
      const lines = step.visitLines?.[npc.id];
      if (lines) this.dialog(client, lines, step.speaker ?? npc.name);
      if (npc.id === step.tour && tourLeft().length) client.send("tour", { guide: npc.id, stops: tourLeft() });
      if (prog.count >= step.goal.npcs.length) this.advance(p, client);
      else { this.say(client, `📜 ${prog.count} of ${step.goal.npcs.length} ${step.goal.names}.`); this.sendQuest(client, p); }
      this.saveSoon(p);
      return true;
    }
    // A talk step with this person in a chapter you've started (the active one first).
    const ids = [q.active, ...(Object.keys(q.ch) as ChapterId[])].filter((id): id is ChapterId => !!id && !chapterDone(q, id));
    for (const id of ids) {
      const c = chapterById(id);
      const st = c.steps[q.ch[id]!.step];
      if (!st || st.goal.kind !== "talk" || !st.who || st.who !== npc.id) continue;
      if (q.active !== id) {
        q.active = id;
        p.dirty = true;
        this.sendQuest(client, p);
      }
      return this.doTalk(client, p, c, st, npc);
    }
    return false;
  },
  /** One of the Four Books that isn't the one you're on (version 0.21): not yet, a later one, or one you've read (read it again). */
  bookClick(this: WorldRoom, client: Client, p: Player, npc: NpcDef) {
    const n = Number(npc.id.slice(5)) - 1;
    const book = FOUR_BOOKS[n];
    const prog = p.quest.ch.four_books;
    if (!prog) return this.dialog(client, [`${npc.greeting} Keeper Lisette looks after the history books. Ask her about them first.`], npc.name);
    // Step 0 is Lisette's talk; book n is step n + 1.
    if (chapterDone(p.quest, "four_books") || prog.step > n + 1) return this.dialog(client, book.pages, `📖 ${book.title}`);
    this.dialog(client, ["(The book won't come off the shelf. Keeper Lisette calls over: \"The glowing one first, dear. History only makes sense in order.\")"], npc.name);
  },
  /** Walked up to the restricted section's grille (version 0.21): Keeper Lisette hurries over with a reason it's closed today. */
  checkGrille(this: WorldRoom, p: Player) {
    const g = PLACES["lighthall.grille"];
    if (!g || p.y !== g.y || Math.abs(p.x - g.x) > 2) { p.atGrille = false; return; }
    if (p.atGrille) return;
    p.atGrille = true;
    const now = Date.now();
    if (now - p.grilleAt < 4000) return;
    // Keep trying within a minute or so and she gets flustered.
    p.grilleStreak = now - p.grilleAt < 90_000 ? p.grilleStreak + 1 : 1;
    p.grilleAt = now;
    const client = this.clientOf(p);
    if (!client) return;
    const flustered = p.grilleStreak >= 3;
    const line = flustered ? "Please. I'd be in terrible trouble." : LISETTE_EXCUSES[p.grilleTries++ % LISETTE_EXCUSES.length];
    this.dialog(client, [line], "Keeper Lisette");
  },
  /** What a story station looks like to you (lit or not). */
  stationLook(this: WorldRoom, p: Player, npc: NpcDef): string {
    const lit = litLanterns(p.quest).includes(npc.id);
    if (npc.id === "west_shrine") return lit ? "The rebuilt shrine glows gold, and the grass round it is green again. A thin thread of light runs from its flame east along the road, toward Emberhold." : npc.greeting;
    if (npc.id === "thorn_shrine") return lit ? "The valley's edge shrine burns gold. The grass round it is green, but only just: a few steps further out, the dust is grey." : npc.greeting;
    return lit ? "The lantern burns bright and steady." : npc.greeting;
  },
  /** Walked somewhere a reach step wants you to go? */
  checkReach(this: WorldRoom, p: Player) {
    const step = this.step(p);
    const prog = this.prog(p);
    if (!step || !prog || step.goal.kind !== "reach") return;
    const spot = step.goal.spots.find((k) => !prog.got?.includes(k) && Math.max(Math.abs(PLACES[k].x - p.x), Math.abs(PLACES[k].y - p.y)) <= 2);
    if (!spot) return;
    // The running lesson: walking there doesn't count (version 0.21).
    if (step.goal.run && !this.canRun(p)) {
      const c = this.clientOf(p);
      if (c && Date.now() - p.grilleAt > 3000) { p.grilleAt = Date.now(); this.say(c, "🏃 You walked there! Press the 🏃 run button (or hold Shift), walk away a little, and run back to the mark."); }
      return;
    }
    prog.got = [...(prog.got ?? []), spot];
    prog.count = prog.got.length;
    p.dirty = true;
    const client = this.clientOf(p);
    if (client) this.say(client, `📍 ${step.spotLines?.[spot] ?? `You reach ${SPOT_NAMES[spot] ?? "the place"}.`}`);
    if (prog.count >= step.goal.spots.length) this.advance(p, client);
    else if (client) { this.say(client, `📜 ${prog.count} of ${step.goal.spots.length} ${step.goal.names}.`); this.sendQuest(client, p); }
  },
  clientOf(this: WorldRoom, p: Player): Client | undefined {
    return this.clients.find((c) => this.state.players.get(c.sessionId) === p);
  },
  /** An Emberguard blessing: more XP for a while. */
  bless(this: WorldRoom, client: Client, p: Player) {
    p.buffs.blessed = { until: worldNow() + BLESS_MINUTES * 60_000, power: BLESS_POWER };
    this.say(client, `✨ You're blessed: +${BLESS_POWER}% XP for ${BLESS_MINUTES} minutes.`);
    this.sendBuffs(client, p);
    p.dirty = true;
  },
  /** Kael's old Warden weapon: a sword, a bow or a staff, for however you fight best. */
  giveWarden(this: WorldRoom, client: Client, p: Player) {
    const lv = (sk: SkillId) => (isUnlocked(p.unlocked, sk) ? p.skillXp[sk] : -1);
    const best = (["melee", "ranged", "magic"] as SkillId[]).reduce((a, b) => (lv(b) > lv(a) ? b : a));
    const item = (best === "ranged" ? "bow_stone_maple" : best === "magic" ? "staff_iron_oak" : "sword_iron_oak") as ItemId;
    this.give(p, item, 1, null, true);
    this.say(client, `Huntmaster Kael gives you his old Warden's ${best === "ranged" ? "bow (a maple bow)" : best === "magic" ? "staff (iron and oak)" : "blade (an iron sword)"}.`);
  },
  /** Your Emberguard rank went up: a new cloak, and everyone sees it. */
  updateRank(this: WorldRoom, client: Client | undefined, p: Player) {
    const r = rankOf(p.quest);
    if (r === p.rank) return;
    p.rank = r;
    if (client) {
      this.say(client, `🔥 You are now ${r === 1 ? "an" : "a"} ${LIGHT_RANKS[r]} of the Emberhall!${r === 1 ? " (Your Ember cloak shows it.)" : " (Your cloak burns gold.)"}`);
      client.send("questDone", { quest: `Rank: ${LIGHT_RANKS[r]}` });
    }
  },
  /** Old Maren won't let you get stuck: a stew if you're worn out with no food, a potion if you're badly hurt during Kael's lessons. */
  marenHelps(this: WorldRoom, client: Client, p: Player) {
    if (p.stamina < 20 && !p.inventory.some((it) => isFood(it)) && roomFor(p, SHOP_STEW) > 0) {
      this.give(p, SHOP_STEW, 1, null, true);
      this.say(client, `${GUIDE_NAME}: You look worn out! Here, eat this stew. Next time, cook some of your own.`);
      this.sendInventory(client, p);
    }
    if (p.quest.active === "kael" && p.hp < p.maxHp / 3 && !p.inventory.includes(POTION_ID) && roomFor(p, POTION_ID) > 0) {
      this.give(p, POTION_ID, 1, null, true);
      this.say(client, `${GUIDE_NAME}: You're hurt! Here, drink this health potion.`);
      this.sendInventory(client, p);
    }
  },
  /** Give whatever of these you don't have. Returns what was given ("a pine log and a minnow"), or "". */
  giveMissing(this: WorldRoom, p: Player, gifts?: Gift[]): string {
    const given: string[] = [];
    for (const g of gifts ?? []) {
      // A tool counts if you have any of that kind (in your bag or on your belt); a meal counts if you have any meal.
      let have: number;
      if (isTool(g.item)) {
        const type = parseTool(g.item).type;
        have = (p.belt[type] ? 1 : 0) + p.inventory.filter((it) => isTool(it) && parseTool(it).type === type).length;
      } else if (isGear(g.item)) {
        const kind = g.item.split("_")[0];
        have = (GEAR_SLOTS.some((s) => p.gear[s]?.item.startsWith(`${kind}_`)) ? 1 : 0) + p.inventory.filter((it) => it?.startsWith(`${kind}_`)).length;
      } else if (isMeal(g.item)) {
        have = p.inventory.reduce((n, it, i) => n + (isMeal(it) ? countIn(p, i) : 0), 0);
      } else {
        have = this.countOf(p, g.item);
      }
      for (let n = have; n < (g.count ?? 1); n++) {
        if (!this.give(p, g.item, 1, g.durability, true)) break;
        given.push(aOr(ITEMS[g.item].single));
      }
    }
    if (given.length) p.dirty = true;
    return given.length > 1 ? `${given.slice(0, -1).join(", ")} and ${given[given.length - 1]}` : given[0] ?? "";
  },
  dialog(this: WorldRoom, client: Client, lines: string[], name = GUIDE_NAME) {
    client.send("dialog", { name, lines });
  },
  /** What the quest tracker shows. */
  questView(this: WorldRoom, p: Player): QuestView {
    const step = this.step(p);
    const chapters = chapterViews(p.quest, this.levelOf(p));
    const prog = this.prog(p);
    const spots = step?.goal.kind === "reach"
      ? step.goal.spots.filter((k) => !prog?.got?.includes(k)).map((k) => ({ ...PLACES[k], label: SPOT_NAMES[k] ?? "" }))
      : step ? stepSpots(step, p, this.levelOf(p), [...this.state.monsters.values()], (it) => this.countOf(p, it)) : undefined;
    const lessons = chapters.filter((c) => !c.act);
    const base = { number: lessons.filter((c) => c.state === "done").length, of: lessons.length, marks: questMarks(p.quest, this.levelOf(p)), chapters,
      spots, reach: step?.goal.kind === "reach" || undefined, lit: litLanterns(p.quest), rank: rankOf(p.quest) };
    if (!step) {
      return tutorialDone(p.quest)
        ? { ...base, done: true, quest: "All lessons done", giver: "", task: "Tap 📜 Quests to track a bounty from the board.", talk: false }
        : this.nextChapterView(p, base);
    }
    const chapter = chapterById(p.quest.active!);
    const progNow = this.prog(p)!;
    const g = step.goal;
    let progress: string | undefined;
    let fraction: number | undefined;
    if (g.kind === "level") {
      const have = p.levels[g.discipline];
      const skills = DISCIPLINES[g.discipline].skills.filter((sk) => p.unlocked.includes(sk.id))
        .map((sk) => `${sk.name} ${levelForXp(p.skillXp[sk.id])}`).join(", ");
      progress = `${DISCIPLINES[g.discipline].name} ${Math.min(have, g.level)} / ${g.level} (${skills})`;
      fraction = Math.min(1, have / g.level);
    } else if (g.kind === "skillLevel") {
      const xp = p.skillXp[g.skill];
      const need = xpForLevel(g.level);
      progress = `${findSkill(g.skill).def.name} XP ${Math.min(xp, need)} / ${need}`;
      fraction = Math.min(1, xp / need);
    } else if (g.kind === "have") {
      const want = Object.entries(g.items) as [ItemId, number][];
      progress = want.map(([item, n]) => `${Math.min(n, this.countOf(p, item))}/${n} ${ITEMS[item].name.toLowerCase()}`).join(", ");
      fraction = want.reduce((sum, [item, n]) => sum + Math.min(n, this.countOf(p, item)), 0) / want.reduce((sum, [, n]) => sum + n, 0);
    } else if (g.kind === "toolBreaks") {
      const t = p.belt[g.tool];
      progress = t ? `${t.durability} use${t.durability === 1 ? "" : "s"} left` : `Not on your belt yet`;
    } else if (g.kind === "spendPoint") {
      const free = this.freePoints(p);
      progress = free ? `You have ${free} Mastery point${free === 1 ? "" : "s"} to spend` : "No points yet: catch more minnows";
    } else if ("count" in g && g.count > 1) {
      progress = `${progNow.count} / ${g.count}`;
      fraction = progNow.count / g.count;
    }
    const need = this.questNeeds(p, g, progNow);
    const warning = step.needsTool && !p.belt[step.needsTool] ? `Put your ${TOOL_TYPES[step.needsTool].name.toLowerCase()} back on your belt first!`
      : this.fightBlock(p) ? (step.fightWith === "magic" ? "Hold your staff first!" : step.fightWith === "ranged" ? "Hold your sling first!" : "Hold a weapon first!") : undefined;
    const checklist = this.checklist(p, step, progNow);
    const robeLock = this.robeStep(p) && g.kind === "gear" ? g.items.filter((pre) => !GEAR_SLOTS.some((sl) => p.gear[sl]?.item.startsWith(pre))) : undefined;
    const runLesson = g.kind === "reach" && g.run ? true : undefined;
    return { ...base, done: false, quest: chapter.title, giver: chapter.name, task: step.task, progress, fraction, talk: g.kind === "talk", warning, need, checklist, robeLock, runLesson };
  },
  /** Steps you can do in any order (version 0.21, Mike's note): each person, place or piece, ticked off as you go. One-thing steps get none. */
  checklist(this: WorldRoom, p: Player, step: QuestStep, prog: { got?: string[] }): QuestView["checklist"] {
    const g = step.goal;
    const got = prog.got ?? [];
    let list: { label: string; done: boolean }[] = [];
    if (g.kind === "visit") {
      list = g.npcs.map((id) => ({ label: step.checkLabels?.[id] ?? NPCS.find((n) => n.id === id)?.name ?? id, done: got.includes(id) }));
      // Six lanterns all called "Lantern": number them.
      if (new Set(list.map((c) => c.label)).size < list.length) list.forEach((c, i) => { c.label = `${c.label} ${i + 1}`; });
    }
    else if (g.kind === "reach") list = g.spots.map((k) => ({ label: SPOT_NAMES[k] ? SPOT_NAMES[k][0].toUpperCase() + SPOT_NAMES[k].slice(1) : k, done: got.includes(k) }));
    else if (g.kind === "gear") list = g.items.map((pre) => {
      const id = (Object.keys(ITEMS) as ItemId[]).find((it) => it.startsWith(pre));
      return { label: id ? ITEMS[id].single[0].toUpperCase() + ITEMS[id].single.slice(1) : pre, done: GEAR_SLOTS.some((sl) => p.gear[sl]?.item.startsWith(pre)) };
    });
    else if (g.kind === "have") list = (Object.entries(g.items) as [ItemId, number][]).map(([id, n]) => ({ label: n === 1 ? ITEMS[id].single : `${n} ${ITEMS[id].name.toLowerCase()}`, done: this.countOf(p, id) >= n }));
    return list.length > 1 ? list : undefined;
  },
  /** Between chapters: the story chapter (or Maren's lessons) you can start next, by name, else "pick your next lesson" (Mike's note #11). */
  nextChapterView(this: WorldRoom, p: Player, base: Omit<QuestView, "done" | "quest" | "giver" | "task" | "talk">): QuestView {
    const next = CHAPTERS.find((c) => (c.act || c.id === "maren") && !c.side && !p.quest.ch[c.id] && chapterOpen(p.quest, c.id) && gateMet(c, this.levelOf(p)));
    if (next) return { ...base, done: false, quest: next.title, giver: next.name, task: `Talk to ${next.name}, ${next.where}`, talk: true };
    return { ...base, done: false, quest: "Pick your next lesson", giver: "", task: "Talk to anyone with a ❗ (the 📜 Quests tab says where they are)", talk: true };
  },
  /** The quest tracker's picture checklist: one picture per thing the step needs, with how many you have. */
  questNeeds(this: WorldRoom, p: Player, g: QuestStep["goal"], prog: { count: number; got?: string[] }): QuestView["need"] {
    const item = (id: ItemId) => ({ icon: ITEMS[id].icon, tint: ITEMS[id].tint });
    const counted = (pic: { icon: string; tint?: string } | undefined) => pic && "count" in g ? [{ ...pic, have: Math.min(prog.count, g.count), want: g.count }] : undefined;
    switch (g.kind) {
      case "have":
        return (Object.entries(g.items) as [ItemId, number][]).map(([id, n]) => ({ ...item(id), have: Math.min(n, this.countOf(p, id)), want: n }));
      case "gather":
        if (g.resource) return counted(item(RESOURCES[g.resource].item));
        return counted(g.skill ? { icon: findSkill(g.skill).def.icon } : undefined);
      case "kill":
        return counted({ icon: g.monster ? MONSTERS[g.monster].icon : "⚔️" });
      case "craft": {
        const made = (Object.keys(ITEMS) as ItemId[]).find((id) => id.startsWith(g.prefix));
        return counted(made ? item(made) : { icon: findSkill(g.skill).def.icon });
      }
      case "sell": case "buy": return counted({ icon: "🪙" });
      case "plant": return counted({ icon: "🌱" });
      case "harvest": return counted({ icon: "🧺" });
      case "bounty": return counted({ icon: "📋" });
      case "visit": return [{ icon: "🏮", have: g.npcs.filter((n) => prog.got?.includes(n)).length, want: g.npcs.length }];
      case "reach": return [{ icon: "📍", have: g.spots.filter((k) => prog.got?.includes(k)).length, want: g.spots.length }];
      default: return undefined;
    }
  },
  sendQuest(this: WorldRoom, client: Client, p: Player) {
    client.send("quest", this.questView(p));
  },
  /** Standing on one of the 8 tiles around someone or something (a shopkeeper, the furnace, the anvil...). */
  nearNpc(this: WorldRoom, p: Player, id: string) {
    const npc = NPCS.find((n) => n.id === id)!;
    return Math.max(Math.abs(p.x - npc.x), Math.abs(p.y - npc.y)) <= 1;
  },
};

/** The messages from players about this. */
export function registerQuests(this: WorldRoom) {
    this.onMessage("talk", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const npc = npcById(String(msg?.id));
      if (!p || !npc) return;
      this.stopActions(p);
      if (this.isNextTo(p, npc)) return this.openShop(client, p, npc);
      p.talkTo = npc;
      p.path = this.pathNextTo(p, npc);
      if (!p.path.length) {
        p.talkTo = null;
        this.say(client, "You can't reach them.");
      }
    });
    // Read a spell book from your bag: learn its spell (the book is used up).
    this.onMessage("read", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (isStoryItem(item)) return this.readStory(client, p, msg.slot, item);
      if (!isSpellBook(item)) return;
      const spell = SPELL_BOOKS[item];
      const d = SPELLS[spell];
      if (!isUnlocked(p.unlocked, "magic")) return this.say(client, this.notTaught("magic"));
      if (p.books.includes(spell)) return this.say(client, `You already know ${d.name}. You could sell the book.`);
      const level = levelForXp(p.skillXp.magic);
      if (level < d.level) return this.say(client, `The words swim on the page. You need Spellcasting level ${d.level} to learn ${d.name}. (You're level ${level}.)`);
      takeFromEntry(p, msg.slot, 1);
      p.books.push(spell);
      const placed = this.addToBar(p, spell);
      this.say(client, `📖 You learn ${d.icon} ${d.name}! ${placed ? "It's on your spell bar." : "Your spell bar is full: press ✎ on it to swap a spell in."}`);
      this.sendInventory(client, p);
      this.sendSpellbook(client, p);
      this.saveSoon(p);
    });
}
