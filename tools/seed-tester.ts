// Give a test character the progress of someone who's finished the trainers'
// lessons (for tools/playtest.ts "story"). Stop the server first: it reads
// server/data/accounts.json when it starts.
//
//   npx tsx tools/seed-tester.ts Tester1
import { readFileSync, writeFileSync } from "node:fs";
import { CHAPTERS, QUEST_REV } from "../shared/quests";
import { xpForLevel } from "../shared/disciplines";
import { MAP_REV } from "../server/src/storage";
import { PLACES } from "../shared/map";
import { SHOP_STEW } from "../shared/cooking";
import { ITEMS } from "../shared/items";

const FILE = new URL("../server/data/accounts.json", import.meta.url);
const name = process.argv[2];
if (!name) throw new Error("usage: npx tsx tools/seed-tester.ts <username>");
const accounts = JSON.parse(readFileSync(FILE, "utf8"));
const acc = accounts[name.toLowerCase()];
if (!acc) throw new Error(`no account ${name}: log in once first`);

// Every lesson done (not the side quests), and the Prologue up to Maren's lessons.
const ch: Record<string, { step: number; count: number }> = {};
for (const c of CHAPTERS) {
  if (c.side) continue;
  if (c.act && !["awakening", "hall", "lanterns", "sweeper"].includes(c.id)) continue;
  ch[c.id] = { step: c.steps.length, count: 0 };
}
// Levels a player usually has once the lessons are done.
const levels: Record<string, number> = {
  fishing: 8, cooking: 8, trading: 5, woodcutting: 8, smithing: 6, handicraft: 6, mining: 8, smelting: 6,
  melee: 11, defense: 10, magic: 5, ranged: 6, hunting: 6, renown: 3, foraging: 5, alchemy: 4, enchanting: 2, farming: 4, leadership: 1,
};
const skillXp: Record<string, number> = {};
for (const [k, lv] of Object.entries(levels)) skillXp[k] = xpForLevel(lv);
acc.save = {
  ...acc.save,
  questRev: QUEST_REV, mapRev: MAP_REV,
  quest: { active: null, ch },
  skillXp, x: PLACES.lighthallSteps.x, y: PLACES.lighthallSteps.y + 2,
  coins: 30000,
  inventory: ["health_potion", SHOP_STEW], counts: [3, 8], slots: [0, 1], durability: [null, null],
  belt: {
    axe: { item: "axe_bronze_pine", durability: 150 }, rod: { item: "rod_pine", durability: 40 }, pickaxe: { item: "pickaxe_bronze_pine", durability: 150 },
    shovel: { item: "shovel_stone_pine", durability: 40 }, hammer: { item: "hammer_bronze_pine", durability: 150 }, tongs: { item: "tongs_bronze", durability: 150 }, pot: { item: "pot_stone", durability: 40 },
  },
  gear: { weapon: { item: "sword_bronze_pine", durability: 150 }, offhand: { item: "shield_bronze", durability: 150 }, head: { item: "helmet_bronze", durability: 150 }, body: { item: "platebody_leather", durability: 150 }, legs: null, feet: null },
  hp: 999, stamina: 999,
};
for (const it of [...acc.save.inventory, ...Object.values(acc.save.belt).map((b: any) => b?.item), ...Object.values(acc.save.gear).map((g: any) => g?.item)]) {
  if (it && !ITEMS[it as keyof typeof ITEMS]) throw new Error(`not an item: ${it}`);
}
writeFileSync(FILE, JSON.stringify(accounts));
console.log(`${name}: lessons done, ready for the story test.`);
