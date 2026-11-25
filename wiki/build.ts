// Builds the Emberfall wiki: one web page, wiki/emberfall-wiki.html.
//
//   npm run wiki
//
// Two kinds of pages go in:
// 1. Hand-written pages in wiki/pages/*.md (the lore, places, factions, people,
//    the story plan). Edit those like any text file.
// 2. Pages made straight from the game's code in shared/ (monsters, items,
//    skills, spells, quests, shops, books, version history, the numbers behind
//    the mechanics). These are rebuilt every time, so they always match the
//    game. Never hand-edit them: change the game, then run `npm run wiki`.
//
// When a hand-written page and a game page have the same title (for example
// "Old Maren"), they become one page: the story first, then "In the game".
//
// Names: the game's code still uses some old names (Lightkeepers, Kindled...).
// RENAMES below swaps them for the lore bible's names in everything the wiki
// copies from the code, and the Names page lists what still needs changing in
// the game. When the game is renamed, these swaps simply stop finding anything.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ITEMS, ItemId } from "../shared/items";
import { MONSTERS, MONSTER_IDS, SPELLS, SPELL_IDS, MonsterId, ATTACK_STAMINA, POTION_HEAL, WANDER_RADIUS, LEASH_RADIUS, AGGRO_RADIUS, MANA_REGEN_TICKS, HEALTH_REGEN_MS, ARMOR_LEVEL } from "../shared/combat";
import { DISCIPLINES, DISCIPLINE_IDS, SkillId, xpForLevel, MAX_LEVEL, findSkill } from "../shared/disciplines";
import { NPCS } from "../shared/npcs";
import { AREAS, MAP_LABELS, WORLD_SPAWNS, FENCE_Y } from "../shared/world";
import { areaAt } from "../shared/map";
import { SHOPS, SHOP_IDS } from "../shared/shops";
import { CHAPTERS, Chapter } from "../shared/quests";
import { TREES } from "../shared/skilltree";
import { RENOWN_RANKS } from "../shared/renown";
import { RANKS as GUILD_RANKS, CHEST_RENT, CHEST_START, CHEST_STEP, EXPAND_GOLD } from "../shared/guild";
import { UPDATES, GAME_VERSION } from "../shared/version";
import { ALL_BOOKS } from "../shared/lore";
import { RESOURCES, RESOURCE_IDS, FORAGE_FINDS } from "../shared/foraging";
import { POTIONS, POTION_TYPES, BONUSES, BONUS_IDS, POTION_COOLDOWN_MS, BUFF_MINUTES } from "../shared/alchemy";
import { ENCHANTS, ENCHANT_IDS } from "../shared/enchanting";
import { CROPS, CROP_IDS, PLOT_SIZES, PLOT_GOLD } from "../shared/farming";
import { GEMS, GEM_IDS, CUT_LEVEL, STAT_NAMES, JEWEL_METALS, JEWEL_METAL_IDS, JEWEL_TYPES } from "../shared/jewelry";
import { DISHES, DISH_IDS, INGREDIENTS, FOOD_KINDS, STAMINA_REGEN_MS } from "../shared/cooking";
import { WEAPONS, WEAPON_TYPES, ARMOR, ARMOR_TYPES, METAL_DAMAGE, ARMOR_METAL, isGear } from "../shared/gear";
import { METALS, METAL_IDS, WOODS, WOOD_IDS, TOOL_TYPES, TOOL_TYPE_IDS, NO_TOOL_SLOWDOWN, barId, isTool } from "../shared/tools";
import { WOOD_LEVEL, WOOD_DAMAGE, BAITS, BAIT_IDS, TANNING } from "../shared/handicraft";
import { STORY_ITEMS, STORY_ITEM_IDS, RANKS as TRIAL_RANKS, TITHE_MAX, TITHE_SHARE, titheCost, BLESS_MINUTES, BLESS_POWER } from "../shared/story";
import { maxHealth, maxStamina, maxMana, carryCapacity, walkBonus, priceBonus, tradingBonus, RUN_SPEED, RUN_REST_MS } from "../shared/stats";
import { DAY_MS, NIGHT_MS, TWILIGHT_MS } from "../shared/daynight";
import { COIN_KINDS, BRONZE_PER_SILVER, SILVER_PER_GOLD } from "../shared/money";
import { PARTY_MAX, PARTY_NEAR } from "../shared/party";
import { BOUNTY_COUNT, REROLL_FEE } from "../shared/bounties";
import { SPELL_BOOKS, SPELL_BOOK_IDS } from "../shared/spells";
import { MASTERY_FIRST_LEVEL_XP, MASTERY_GROWTH } from "../shared/mastery";
import { TICK_MS } from "../shared/map";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- names

/** Old names in the game's code -> the lore bible's names. Longest first. */
const RENAMES: [RegExp, string][] = [
  [/Lightkeepers'/g, "Emberguard's"],
  [/Lightkeepers/g, "Emberguard"],
  [/Lightkeeper/g, "Emberguard"],
  [/Lightwardens?/g, "Emberwarden"],
  [/Kindled/g, "Emberborn"],
  [/Elderra/g, "Emberfall"],
  [/Wellspring/g, "Heartfire"],
  [/Aurelite/g, "Embersteel"],
  [/Crown of Aurel/g, "Ember Crown"],
  [/Aurel Seed/g, "Heart Seed"],
  [/the kingdom of Aurel/g, "the Old Kingdom"],
  [/(the )?Aurel's/g, "the Old Kingdom's"],
  [/(the )?Aurel\b/g, "the Old Kingdom"],
  [/Vael/g, "Vale"],
  [/Ysolde/g, "Rowan"],
  [/Ysra/g, "Ida"],
];
let renamedOnPage = false;
function canon(text: string): string {
  let out = text;
  for (const [re, to] of RENAMES) out = out.replace(re, () => { renamedOnPage = true; return to; });
  return out.replace(/\bthe the\b/g, "the").replace(/\bThe the\b/g, "The").replace(/^the Old/, "The Old");
}

// ---------------------------------------------------------------- pages

interface Page {
  title: string;
  slug: string;
  category: string;
  icon: string;
  summary: string;
  aliases: string[];
  infobox: [string, string][];
  /** Markdown-ish source (see md()). */
  body: string;
  /** Where the facts come from, shown at the bottom. */
  sources: string[];
  /** Hand-written (true) or made from the code. */
  written: boolean;
  /** Names were swapped from the game's old ones. */
  renamed?: boolean;
}

/** Page address: plain letters, digits and dashes (the only kind of #link an artifact keeps). Some words are taken by claude.ai. */
const RESERVED = new Set(["settings", "sidebar", "customize", "upgrade", "downloads", "random", "search"]);
const slugify = (t: string) => {
  const s = t.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return RESERVED.has(s) || s.startsWith("comment-") || s.startsWith("cat-") ? `${s}-page` : s;
};
const pages = new Map<string, Page>();

function addPage(p: Partial<Page> & { title: string; category: string }) {
  const page: Page = { slug: slugify(p.title), icon: "", summary: "", aliases: [], infobox: [], body: "", sources: [], written: false, ...p };
  const old = pages.get(page.slug);
  if (!old) { pages.set(page.slug, page); return page; }
  // Merge: hand-written story first, then the game's facts.
  const written = old.written ? old : page;
  const game = old.written ? page : old;
  written.body = written.body.trimEnd() + (written.written ? "\n\n## In the game\n\n" : "\n\n") + game.body;
  for (const [k, v] of game.infobox) if (!written.infobox.some(([wk]) => wk === k)) written.infobox.push([k, v]);
  written.sources = [...new Set([...written.sources, ...game.sources])];
  written.aliases = [...new Set([...written.aliases, ...game.aliases])];
  written.icon ||= game.icon;
  written.summary ||= game.summary;
  written.renamed ||= game.renamed;
  pages.set(written.slug, written);
  return written;
}

/** Wrap a game-made page so it remembers whether any names were swapped. */
function gamePage(p: Partial<Page> & { title: string; category: string }, make: () => string) {
  renamedOnPage = false;
  const body = make();
  const title = canon(p.title);
  return addPage({ ...p, title, body, renamed: renamedOnPage, written: false });
}

// ---------------------------------------------------------------- hand-written pages

function readWritten() {
  const dir = path.join(HERE, "pages");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const text = readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n");
    const cut = text.indexOf("\n---\n");
    if (cut < 0) throw new Error(`${file}: no --- line between the header and the page`);
    const head = text.slice(0, cut);
    const body = text.slice(cut + 5);
    const meta: Record<string, string> = {};
    const infobox: [string, string][] = [];
    for (const line of head.split("\n")) {
      const m = line.match(/^([\w.]+):\s*(.*)$/);
      if (!m) continue;
      if (m[1].startsWith("infobox.")) infobox.push([m[1].slice(8).replace(/_/g, " "), m[2]]);
      else meta[m[1]] = m[2];
    }
    if (!meta.title || !meta.category) throw new Error(`${file}: needs a title: and a category: line`);
    addPage({
      title: meta.title, category: meta.category, icon: meta.icon ?? "", summary: meta.summary ?? "",
      aliases: (meta.aliases ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      infobox, body, sources: [`wiki/pages/${file}`], written: true,
    });
  }
}

// ---------------------------------------------------------------- helpers for game pages

const esc = (s: string) => s.replace(/\|/g, "\\|");
const link = (title: string, text?: string) => (text && text !== title ? `[[${title}|${text}]]` : `[[${title}]]`);
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const secs = (ticks: number) => `${Math.round(ticks * TICK_MS / 100) / 10}s`;
const num = (n: number) => n.toLocaleString("en-US");
const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map((c) => esc(String(c))).join(" | ")} |`)].join("\n");
const coins = (bronze: number) => {
  if (bronze >= BRONZE_PER_SILVER * SILVER_PER_GOLD) return `${num(Math.round(bronze / (BRONZE_PER_SILVER * SILVER_PER_GOLD) * 10) / 10)} gold`;
  if (bronze >= BRONZE_PER_SILVER) return `${num(Math.round(bronze / BRONZE_PER_SILVER * 10) / 10)} silver`;
  return `${bronze} bronze`;
};
const itemName = (id: string) => canon(ITEMS[id as ItemId]?.name ?? id);
const itemIcon = (id: string) => { const i = ITEMS[id as ItemId]?.icon ?? ""; return i.startsWith("svg:") ? "🛠️" : i; };
const skillName = (id: SkillId) => findSkill(id).def.name;
const skillLink = (id: SkillId) => link(skillName(id));
const npcName = (id: string) => canon(NPCS.find((n) => n.id === id)?.name ?? id);

/** Item pages we make (everything with a fixed id); combos like meals and enchanted tools get table pages. */
const itemPageIds = new Set<string>();
const itemLink = (id: string) => {
  const name = itemName(id);
  if (itemPageIds.has(id)) return link(name);
  // Tools, weapons and armor link to their type's page.
  const m = id.match(/^([a-z]+)_/);
  if (m && (TOOL_TYPES as any)[m[1]]) return link(canon((TOOL_TYPES as any)[m[1]].name), name);
  if (m && (WEAPONS as any)[m[1]]) return link((WEAPONS as any)[m[1]].name, name);
  if (m && (ARMOR as any)[m[1]]) return link((ARMOR as any)[m[1]].name, name);
  if (id.startsWith("meal_")) return link("Cooking", name);
  if (id.startsWith("arrows_")) return link("Arrows", name);
  if (id.startsWith("potion_")) return link("Potions", name);
  return name;
};

/** Where a world tile is, in words: its area, and outdoors the nearest map label. */
function whereIs(x: number, y: number): string {
  const area = areaAt(x, y);
  if (!area) return "somewhere";
  if (area.kind !== "outdoor") return area.name;
  let best = MAP_LABELS[0], bestD = Infinity;
  for (const l of MAP_LABELS) { const d = (l.x - x) ** 2 + (l.y - y) ** 2; if (d < bestD) { bestD = d; best = l; } }
  const zone = y >= FENCE_Y ? "The Thornwood" : "Heartvale";
  const near = best.text.replace(/^The /, "the ");
  return near.toLowerCase().includes(zone.toLowerCase()) ? zone : `${zone}, near ${near}`;
}

// ---------------------------------------------------------------- monsters

function monsterPages() {
  const rows: (string | number)[][] = [];
  for (const id of MONSTER_IDS) {
    const m = MONSTERS[id];
    const name = canon(m.name);
    const where = new Map<string, number>();
    for (const [kind, x, y] of WORLD_SPAWNS) if (kind === id) { const w = whereIs(x, y); where.set(w, (where.get(w) ?? 0) + 1); }
    const whereText = [...where].map(([w, n]) => `${w} (${n})`).join(", ") || "Nowhere yet (not placed in the world)";
    const temper = m.maxHit === 0 ? "Never fights back" : m.aggressive ? "Attacks on sight" : "Fights back if you hit it";
    rows.push([`${m.icon} ${link(name)}`, m.level, m.hp, m.maxHit, temper + (m.night ? ", night only" : "") + (m.pack ? ", pack" : ""), [...where.keys()].join("; ") || "—"]);
    gamePage({
      title: m.name, category: "Monsters", icon: m.icon, sources: ["shared/combat.ts", "shared/world.ts"],
      summary: `A level ${m.level} monster. ${temper}.`,
      infobox: [["Level", String(m.level)], ["Health", String(m.hp)], ["Biggest hit", String(m.maxHit)], ["Attacks every", secs(m.speed)],
        ["Temper", temper], ["Out", m.night ? "Night only" : "Day and night"], ["Comes back after", secs(m.respawnTicks)], ["Coins", m.coins[1] ? `${m.coins[0]} to ${m.coins[1]} bronze` : "None"]],
    }, () => [
      `The **${name}** is a level ${m.level} monster with ${m.hp} health. ${temper}${m.pack ? ", and it runs in a pack: when one goes for you, the others nearby join in" : ""}.${m.night ? " It's only out at night: it vanishes at sunrise and comes back at dusk." : ""}`,
      `Defeating one gives ${m.xp} bonus XP on top of 1 XP per point of damage, plus ${MONSTERS[id].xp + m.level} [[Hunting]] XP shared by everyone who hurt it.`,
      "## Where it lives", whereText + ".",
      "## Drops",
      m.drops.length ? table(["Item", "Chance"], m.drops.map((d) => [`${itemIcon(d.item)} ${itemLink(d.item)}`, pct(d.chance)])) : "Nothing.",
      m.coins[1] ? `It also drops ${m.coins[0]} to ${m.coins[1]} bronze coins.` : "",
      "Higher [[Hunting]] and your Mastery of this monster make drops more likely.",
    ].join("\n\n"));
  }
  gamePage({ title: "Monsters", category: "Monsters", icon: "🐺", sources: ["shared/combat.ts"], summary: "Every monster in the game." }, () => [
    "Every monster in the game today, from the code. Monsters wander a few tiles from home, chase you for a while, then give up and go home.",
    table(["Monster", "Level", "Health", "Biggest hit", "Temper", "Where"], rows),
    `Monsters wander up to ${WANDER_RADIUS} tiles from home, notice you within ${AGGRO_RADIUS} tiles (if they attack on sight), and give up the chase ${LEASH_RADIUS} tiles from home.`,
    "See also [[Combat]], [[Hunting]] and [[The Blight]].",
  ].join("\n\n"));
}

// ---------------------------------------------------------------- items

function itemSources(id: string) {
  const out: string[] = [];
  for (const r of RESOURCE_IDS) { const d = RESOURCES[r]; if (d.item === id && d.skill !== "foraging") out.push(`Gathered with ${skillLink(d.skill as SkillId)} level ${d.level} from a ${d.node.toLowerCase()} (${d.xp} XP each).`); }
  for (const f of FORAGE_FINDS) if (f.item === id) out.push(`Dug up with [[Foraging]] level ${f.level}${f.night ? ", only at night" : ""} (${f.xp} XP).`);
  for (const c of CROP_IDS) if (CROPS[c].produce === id) out.push(`Grown with [[Farming]] level ${CROPS[c].level}: ripe after ${CROPS[c].minutes} minutes, ${CROPS[c].yield[0]} to ${CROPS[c].yield[1]} a tile.`);
  for (const mid of MONSTER_IDS) for (const d of MONSTERS[mid].drops) if (d.item === id) out.push(`Dropped by the ${link(canon(MONSTERS[mid].name))} (${pct(d.chance)}).`);
  for (const s of SHOP_IDS) {
    if (SHOPS[s].stock.includes(id as ItemId)) out.push(`Sold by ${link(npcName(s))}.`);
    for (const r of SHOPS[s].rare ?? []) if (r.item === id) out.push(`Sold by ${link(npcName(s))} once your [[Trading]] is ${r.trading}.`);
  }
  for (const c of CHAPTERS) c.steps.forEach((st) => { for (const g of st.give ?? []) if (g.item === id) out.push(`Given in the quest ${link(canon(c.title))}.`); });
  return [...new Set(out)];
}

function itemUses(id: string) {
  const out: string[] = [];
  const using = Object.keys(pagesItemDefs()).filter((other) => (ITEMS[other as ItemId].inputs ?? []).includes(id as ItemId));
  for (const o of using) out.push(`Goes into ${itemLink(o)}.`);
  for (const t of POTION_TYPES) if (POTIONS[t].pair.includes(id as ItemId)) out.push(`Half of the recipe for the ${link(POTIONS[t].name)}.`);
  for (const b of BONUS_IDS) if (b === id) out.push(`A bonus third ingredient in [[Alchemy]]: ${BONUSES[b].note}.`);
  if ((INGREDIENTS as any)[id]) out.push(`A cooking ingredient (${FOOD_KINDS[(INGREDIENTS as any)[id].kind as keyof typeof FOOD_KINDS].toLowerCase()}): see [[Cooking]].`);
  for (const m of METAL_IDS) if (METALS[m].ores.includes(id as any)) out.push(`Smelted into ${itemLink(barId(m))}.`);
  if ((WOOD_LEVEL as any)[id.replace("_logs", "")] !== undefined && id.endsWith("_logs")) out.push("Used for tool handles, bows, staffs and arrows, and burned as cooking fuel.");
  for (const t of TANNING) if (t.hide === id) out.push(`Tanned into [[Leather]] at Woodworker Rook's rack ([[Handicraft]] level ${t.level}).`);
  return [...new Set(out)];
}

let ITEM_DEFS: Record<string, any> | null = null;
/** Every item with a fixed id (not meals, potions with bonuses, cut gems or enchanted things). */
function pagesItemDefs() {
  if (ITEM_DEFS) return ITEM_DEFS;
  // Tools, weapons, armor and arrows come in every metal and wood: they get one page per type instead.
  const ids = Reflect.ownKeys(ITEMS).filter((k): k is string => typeof k === "string" && !/^(meal_|potion_|rough_|gem_|soulgem_|soulstone_|arrows_)|\+/.test(k) && !isTool(k) && !isGear(k));
  for (const m of METAL_IDS) if (!ids.includes(barId(m))) ids.push(barId(m));
  ITEM_DEFS = Object.fromEntries(ids.map((id) => [id, ITEMS[id as ItemId]]).filter(([, d]) => d));
  return ITEM_DEFS!;
}

function groupOfItem(id: string): string {
  if (/_logs$/.test(id)) return "Logs";
  if (/_ore$|^coal$/.test(id)) return "Ore";
  if (/_bar$/.test(id)) return "Bars";
  if ((INGREDIENTS as any)[id] && RESOURCE_IDS.some((r) => RESOURCES[r].item === id && RESOURCES[r].skill === "fishing")) return "Fish";
  if (/^seed_/.test(id)) return "Seeds";
  if (/^book_/.test(id)) return "Spell books";
  if ((STORY_ITEMS as any)[id]) return "Story items";
  if (FORAGE_FINDS.some((f) => f.item === id) || CROP_IDS.some((c) => CROPS[c].produce === id)) return "Herbs, roots and crops";
  if (MONSTER_IDS.some((m) => MONSTERS[m].drops.some((d) => d.item === id))) return "Monster drops";
  return "Materials and food";
}

function itemPages() {
  const defs = pagesItemDefs();
  for (const id of Object.keys(defs)) itemPageIds.add(id);
  const groups = new Map<string, string[]>();
  for (const [id, d] of Object.entries(defs)) {
    const g = groupOfItem(id);
    groups.set(g, [...(groups.get(g) ?? []), id]);
    const story = (STORY_ITEMS as any)[id];
    const book = (SPELL_BOOKS as any)[id];
    gamePage({
      title: d.name, category: "Items", icon: itemIcon(id), sources: ["shared/items.ts"],
      aliases: [canon(d.single)].filter((a) => a.toLowerCase() !== canon(d.name).toLowerCase()),
      summary: story ? canon(story.description) : `${g.replace(/s$/, "")}. Sells for ${d.sellPrice} bronze.`,
      infobox: [["Kind", g], ["Shop pays", d.sellPrice ? `${d.sellPrice} bronze` : story ? "Can't be sold" : "—"], ["Game id", "`" + id + "`"]],
    }, () => {
      const src = itemSources(id), use = itemUses(id);
      return [
        story ? canon(story.description) : "",
        book ? `Read it to learn the spell ${link(SPELLS[book as keyof typeof SPELLS].name)}.` : "",
        d.inputs ? `Made from: ${d.inputs.map((i: string) => itemLink(i)).join(", ")}. A made thing is worth what goes into it plus 25%.` : "",
        "## Where to get it", src.length ? src.map((s) => `- ${s}`).join("\n") : "Nowhere in the game yet.",
        use.length ? "## What it's for\n\n" + use.map((s) => `- ${s}`).join("\n") : "",
      ].filter(Boolean).join("\n\n");
    });
  }
  const order = ["Logs", "Ore", "Bars", "Fish", "Herbs, roots and crops", "Seeds", "Monster drops", "Materials and food", "Spell books", "Story items"];
  gamePage({ title: "Items", category: "Items", icon: "🎒", sources: ["shared/items.ts"], summary: "Every item, grouped." }, () => [
    "Every item with its own page, grouped by kind, with what a shop pays for one (before Mastery and Charisma). Tools, weapons, armor, meals, potions and gems come in many versions, so each has a page of its own instead: [[Tools]], [[Weapons]], [[Armor]], [[Cooking]], [[Potions]], [[Gems and jewelry]], [[Enchanting]], [[Arrows]].",
    ...order.filter((g) => groups.has(g)).map((g) => `## ${g}\n\n` + table(["Item", "Shop pays"], groups.get(g)!.map((id) => [`${itemIcon(id)} ${itemLink(id)}`, defs[id].sellPrice ? `${defs[id].sellPrice} bronze` : "—"]))),
  ].join("\n\n"));
}

function gearPages() {
  // Tools
  gamePage({ title: "Tools", category: "Items", icon: "🪓", sources: ["shared/tools.ts"], summary: "Axes, pickaxes, shovels, rods, hammers, tongs and pots." }, () => [
    "A tool is a metal head (or none, for a rod) on a wooden handle. Gathering tools make you faster; crafting tools make your tries work more often. Every use wears it down a little; Repairer Oswin or the [[Mend]] spell fixes it.",
    table(["Tool", "Helps", "What it does"], TOOL_TYPE_IDS.map((t) => [`${link(TOOL_TYPES[t].name)}`, skillLink(TOOL_TYPES[t].skill as SkillId), TOOL_TYPES[t].helps === "speed" ? "Faster gathering" : "Fewer failed tries"])),
    `Without the right gathering tool, gathering takes ${NO_TOOL_SLOWDOWN} times as long.`,
    "## Metals", table(["Metal", "Level", "Bonus", "Uses", "Smelted from"], METAL_IDS.map((m) => [itemLink(barId(m)), METALS[m].level, pct(METALS[m].bonus), METALS[m].durability, METALS[m].ores.map(itemLink).join(" + ")])),
    "## Woods (handles)", table(["Wood", "Bonus", "Lasts", "Handicraft level"], WOOD_IDS.map((w) => [itemLink(`${w}_logs`), pct(WOODS[w].bonus), `×${WOODS[w].durability}`, WOOD_LEVEL[w]])),
  ].join("\n\n"));
  for (const t of TOOL_TYPE_IDS) {
    const d = TOOL_TYPES[t];
    gamePage({ title: d.name, category: "Items", icon: d.icon.startsWith("svg:") ? "🛠️" : d.icon, sources: ["shared/tools.ts"], summary: `A tool for ${skillName(d.skill as SkillId)}.`, infobox: [["Helps", skillName(d.skill as SkillId)], ["Effect", d.helps === "speed" ? "Faster" : "Fewer failures"]] }, () =>
      `The ${d.name.toLowerCase()} helps ${skillLink(d.skill as SkillId)}: ${d.helps === "speed" ? "you gather faster" : "your tries fail less often"}. Better metal and better wood make it stronger and last longer. See [[Tools]] for every metal and wood. Smiths make them at the anvil with [[Smithing]].`);
  }
  // Weapons
  gamePage({ title: "Weapons", category: "Items", icon: "🗡️", sources: ["shared/gear.ts"], summary: "Melee, ranged and magic weapons." }, () => [
    "Hold a weapon in your gear strip's Weapon slot. With nothing in your hand you punch. Better metal adds to the biggest hit.",
    table(["Weapon", "Style", "Level", "Biggest hit", "Speed", "Range", "Hands"], WEAPON_TYPES.map((w) => { const d = WEAPONS[w]; return [`${d.icon} ${link(d.name)}`, d.style === "magic" ? "Magic" : d.style === "melee" ? "Melee" : "Ranged", d.level, d.maxHit || "spells", secs(d.speed), d.range, d.twoHanded ? "Two" : "One"]; })),
    "## Metal bonus", table(["Metal", "Adds to biggest hit"], Object.entries(METAL_DAMAGE).filter(([m]) => m !== "stone").map(([m, v]) => [m[0].toUpperCase() + m.slice(1), `+${v}`])),
    "Bows and staffs are wooden: their wood adds damage instead: " + WOOD_IDS.map((w) => `${WOODS[w].name} +${WOOD_DAMAGE[w]}`).join(", ") + ".",
  ].join("\n\n"));
  for (const w of WEAPON_TYPES) {
    const d = WEAPONS[w];
    const skill = d.style === "magic" ? "magic" : d.style;
    gamePage({ title: d.name, category: "Items", icon: d.icon, sources: ["shared/gear.ts"], summary: `A ${d.style === "magic" ? "magic" : d.style} weapon.`,
      infobox: [["Style", skillName(skill as SkillId)], ["Level", String(d.level)], ["Biggest hit", d.maxHit ? `${d.maxHit} + metal` : "From spells"], ["Attacks every", secs(d.speed)], ["Range", `${d.range} tile${d.range > 1 ? "s" : ""}`], ["Hands", d.twoHanded ? "Two (no shield)" : "One"]] }, () =>
      `${d.icon} The ${d.name.toLowerCase()} needs ${skillLink(skill as SkillId)} level ${d.level}. ${d.maxHit ? `Its biggest hit is ${d.maxHit}, plus its metal's bonus.` : "It doesn't hit by itself: bolt spells fly from it."} It attacks every ${secs(d.speed)} and reaches ${d.range} tile${d.range > 1 ? "s" : ""}.${d.twoHanded ? " It takes both hands, so no shield." : ""} See [[Weapons]] and [[Combat]].`);
  }
  gamePage({ title: "Armor", category: "Items", icon: "🛡️", sources: ["shared/gear.ts", "shared/combat.ts"], summary: "Helmets, platebodies, platelegs, boots and shields." }, () => [
    "Armor makes monsters miss you more. Metal armor slows your attacks a tiny bit (1% per bar in it); cloth adds mana and spell damage instead.",
    table(["Piece", "Slot", "Bars", "Armor (bronze)"], ARMOR_TYPES.map((a) => [`${ARMOR[a].icon} ${link(ARMOR[a].name)}`, ARMOR[a].slot, ARMOR[a].bars, ARMOR[a].points])),
    "## Materials", table(["Material", "Armor ×", "Defense level"], Object.entries(ARMOR_METAL).map(([m, v]) => [m[0].toUpperCase() + m.slice(1), v, (ARMOR_LEVEL as any)[m] ?? "—"])),
  ].join("\n\n"));
  for (const a of ARMOR_TYPES) {
    const d = ARMOR[a];
    gamePage({ title: d.name, category: "Items", icon: d.icon, sources: ["shared/gear.ts"], summary: `Armor for the ${d.slot} slot.`, infobox: [["Slot", d.slot], ["Bars to make", String(d.bars)], ["Armor (bronze)", String(d.points)]] }, () =>
      `${d.icon} A ${d.name.toLowerCase()} goes in your ${d.slot} slot. A bronze one gives ${d.points} armor and takes ${d.bars} bar${d.bars > 1 ? "s" : ""} to make with [[Smithing]]; better metal multiplies it. Leather and cloth versions are made with [[Handicraft]]. See [[Armor]].`);
  }
  gamePage({ title: "Arrows", category: "Items", icon: "🏹", sources: ["shared/handicraft.ts"], summary: "Ammunition for bows." }, () =>
    "Arrows are made with [[Handicraft]] at Woodworker Rook's workbench, 10 at a time, and fired from a [[Bow]]. About a third of them can be picked back up.");
}

function potionPages() {
  gamePage({ title: "Potions", category: "Items", icon: "🧪", sources: ["shared/alchemy.ts"], summary: "Every potion and how to brew it." }, () => [
    `Potions are brewed with [[Alchemy]] at the alchemy table in the Mages' Guild: two ingredients and an empty [[Empty vials|vial]], and maybe a third ingredient for a bonus. You can drink one every ${POTION_COOLDOWN_MS / 1000} seconds; buffs last ${BUFF_MINUTES} minutes.`,
    table(["Potion", "Alchemy level", "Ingredients", "Does"], POTION_TYPES.map((t) => [`${link(POTIONS[t].name)}`, POTIONS[t].level, POTIONS[t].pair.map(itemLink).join(" + "), POTIONS[t].description + (POTIONS[t].hidden ? " (secret recipe)" : "")])),
    "## Bonus ingredients", table(["Third ingredient", "Adds"], BONUS_IDS.map((b) => [itemLink(b), BONUSES[b].note])),
  ].join("\n\n"));
  for (const t of POTION_TYPES) {
    const p = POTIONS[t];
    gamePage({ title: p.name, category: "Items", icon: p.icon, sources: ["shared/alchemy.ts"], summary: p.description + ".", infobox: [["Alchemy level", String(p.level)], ["Ingredients", p.pair.map(itemName).join(" + ")], ["XP", String(p.xp)], ["First tries work", pct(p.start)]] }, () =>
      `${p.description}. Brew it with [[Alchemy]] level ${p.level} from ${p.pair.map(itemLink).join(" and ")} in a vial.${p.hidden ? " It isn't listed at the table until you've brewed one: someone has to tell you the recipe." : ""}${p.tithe ? " It clears one Tithe mark (see [[The Tithe]])." : ""} See [[Potions]].`);
  }
}

function foodPages() {
  gamePage({ title: "Meals", category: "Items", icon: "🍲", sources: ["shared/cooking.ts"], summary: "Dishes you cook at a stove." }, () => [
    "Meals are cooked with [[Cooking]]: pick a dish, put ingredients in the pot, and pick a log to burn. Every mix is its own meal. Meals give back stamina.",
    table(["Dish", "Cooking level", "Good with"], DISH_IDS.map((d) => [`${DISHES[d].icon} ${DISHES[d].name}`, DISHES[d].level, DISHES[d].note])),
    "## Ingredients", table(["Ingredient", "Kind"], Object.keys(INGREDIENTS).map((i) => [itemLink(i), FOOD_KINDS[(INGREDIENTS as any)[i].kind as keyof typeof FOOD_KINDS]])),
  ].join("\n\n"));
  gamePage({ title: "Crops", category: "Items", icon: "🌾", sources: ["shared/farming.ts"], summary: "What you can grow at the farm." }, () => [
    "Plant Farmer Odo's seeds on your plot. Crops grow even while you're logged out. See [[Farming]].",
    table(["Crop", "Farming level", "Ripe after", "Harvest", "Seed price"], CROP_IDS.map((c) => [itemLink(CROPS[c].produce), CROPS[c].level, `${CROPS[c].minutes} min`, `${CROPS[c].yield[0]}–${CROPS[c].yield[1]}`, `${CROPS[c].seedPrice} bronze`])),
    "## Plot sizes", table(["Size", "Price"], PLOT_SIZES.map((s, i) => [`${s[0]} × ${s[1]}`, `${PLOT_GOLD[i]} gold`])),
  ].join("\n\n"));
  gamePage({ title: "Gems and jewelry", category: "Items", icon: "💎", sources: ["shared/jewelry.ts"], summary: "Gems, rings and amulets." }, () => [
    "Gem rocks give rough gems of different sizes (carats). Cut them, set them in a ring or amulet, and wear it for a bonus. Emberstone becomes soul gems for [[Enchanting]].",
    table(["Gem", "Cut at level", "Gives (per carat)", "Shop pays per carat (rough)"], GEM_IDS.map((g) => [GEMS[g].name, CUT_LEVEL[g], `+${GEMS[g].per} ${STAT_NAMES[GEMS[g].stat]}`, `${GEMS[g].price} bronze`])),
    "## Settings", table(["Metal", "Bars"], JEWEL_METAL_IDS.map((m) => [(JEWEL_METALS as any)[m].name ?? m, "—"])).replace(/\| — \|/g, "| |"),
    "Pieces: " + Object.values(JEWEL_TYPES).map((t) => `${t.icon} ${t.name} (${t.bars} bar${t.bars > 1 ? "s" : ""})`).join(", ") + ".",
  ].join("\n\n"));
  gamePage({ title: "Enchanting", category: "Skills", icon: "✨", sources: ["shared/enchanting.ts"] }, () => [
    "Enchantments you can put on things at the altar in the Mages' Guild, using a soul gem with souls in it (trap souls with [[Soul trap]]). Staff enchantments also need a cut gem of the right kind.",
    table(["Enchantment", "Goes on", "Gem", "Does"], ENCHANT_IDS.map((e) => [`${ENCHANTS[e].icon} ${ENCHANTS[e].name}`, ENCHANTS[e].on + (ENCHANTS[e].gatherOnly ? " (gathering only)" : ""), ENCHANTS[e].gem ? GEMS[ENCHANTS[e].gem!].name : "—", ENCHANTS[e].describe(20, 3)])),
    "The numbers shown are for power 20 and a 3 carat gem.",
  ].join("\n\n"));
}

// ---------------------------------------------------------------- skills, spells

const EFFECT_TEXT: Record<string, (p: number) => string> = {
  speed: (p) => `${pct(p)} faster`, double: (p) => `${pct(p)} chance of an extra one`, staminaSave: (p) => `${pct(p)} chance it costs no stamina`,
  success: (p) => `${pct(p)} fewer failures`, xp: (p) => `${pct(p)} more XP`, extra: (p) => `${pct(p)} chance to make an extra one`,
  toolCare: (p) => `${pct(p)} chance your gear doesn't wear`, slots: (p) => `+${p} ingredient slot`, mealStamina: (p) => `meals give ${pct(p)} more stamina`,
  accuracy: (p) => `hit ${pct(p)} more often`, damage: (p) => `hit ${pct(p)} harder`, manaSave: (p) => `${pct(p)} chance a spell is free`,
  health: (p) => `+${p} max health`, dodge: (p) => `monsters hit you ${pct(p)} less`, enchantSlot: () => "a second enchantment",
  potency: (p) => `${pct(p)} stronger enchantments`, reenchant: () => "enchant again after taking one off", growth: (p) => `crops ripen ${pct(p)} sooner`,
};

function skillPages() {
  const teaches = new Map<SkillId, Chapter[]>();
  for (const c of CHAPTERS) for (const st of c.steps) for (const u of st.unlocks ?? []) teaches.set(u, [...(teaches.get(u) ?? []), c]);
  for (const d of DISCIPLINE_IDS) {
    const D = DISCIPLINES[d];
    gamePage({ title: D.name, category: "Skills", icon: D.icon, sources: ["shared/disciplines.ts", "shared/stats.ts"], summary: D.description, infobox: [["Kind", "Discipline"], ["Skills", D.skills.map((s) => s.name).join(", ")]] }, () => [
      `${D.icon} **${D.name}** is one of the five [[Disciplines]]. ${D.description} Its level is the average of the levels of its skills you've learned, rounded down.`,
      table(["Skill", "What it is"], D.skills.map((s) => [`${s.icon} ${link(s.name)}`, canon(s.description)])),
    ].join("\n\n"));
    for (const s of D.skills) {
      const tree = TREES[s.id] ?? [];
      const by = teaches.get(s.id) ?? [];
      gamePage({ title: s.name, category: "Skills", icon: s.icon, sources: ["shared/disciplines.ts", "shared/skilltree.ts", "shared/quests.ts"], summary: canon(s.description),
        infobox: [["Discipline", `${D.icon} ${D.name}`], ["Taught by", by.length ? [...new Set(by.map((c) => link(npcName(c.giver))))].join(", ") : "Everyone starts with it, or it trains by itself"], ["Max level", String(MAX_LEVEL)]] }, () => [
        `${s.icon} **${s.name}** is a skill in ${link(D.name)}. ${canon(s.description)}`,
        by.length ? `You learn it in ${by.map((c) => link(canon(c.title))).join(", ")}, from ${[...new Set(by.map((c) => link(npcName(c.giver))))].join(", ")}.` : "",
        tree.length ? "## Skill tree\n\nSpend Mastery points here (see [[Mastery]]). Each upgrade has " + tree[0].maxRank + " ranks.\n\n" + table(["Upgrade", "Each rank"], tree.map((n) => [`${n.icon} ${n.name}`, (EFFECT_TEXT[n.effect] ?? ((p: number) => String(p)))(n.per)])) : "",
        RESOURCE_IDS.some((r) => RESOURCES[r].skill === s.id) ? "## What you can gather\n\n" + table(["Level", "From", "Gives", "XP"], RESOURCE_IDS.filter((r) => RESOURCES[r].skill === s.id).map((r) => [RESOURCES[r].level, RESOURCES[r].node, itemLink(RESOURCES[r].item), RESOURCES[r].xp])) : "",
        s.id === "foraging" ? "## What you can dig up\n\n" + table(["Level", "Find", "XP", "Note"], FORAGE_FINDS.map((f) => [f.level, itemLink(f.item), f.xp, f.night ? "Night only" : ""])) : "",
        s.id === "magic" ? "## Spells\n\n" + table(["Level", "Spell", "Mana"], SPELL_IDS.map((id) => [SPELLS[id].level, `${SPELLS[id].icon} ${link(SPELLS[id].name)}`, SPELLS[id].mana])) : "",
        s.id === "alchemy" ? "See [[Potions]] for every recipe." : "",
        s.id === "cooking" ? "## Dishes\n\n" + table(["Dish", "Level", "Good with"], DISH_IDS.map((d2) => [`${DISHES[d2].icon} ${DISHES[d2].name}`, DISHES[d2].level, DISHES[d2].note])) + "\n\nSee [[Meals]]." : "",
        s.id === "farming" ? "See [[Crops]] for what grows, and how long it takes." : "",
        s.id === "renown" ? "## Ranks\n\n" + table(["Renown level", "Title"], RENOWN_RANKS.filter((r) => r.title).map((r) => [r.level, r.title])) : "",
      ].filter(Boolean).join("\n\n"));
    }
  }
  gamePage({ title: "Disciplines", category: "Mechanics", icon: "📊", sources: ["shared/disciplines.ts", "shared/stats.ts"], summary: "The five big areas you level up, and what each raises." }, () => [
    "There are five disciplines. Each holds skills, and each raises one of your stats. A discipline's level is the average of the skills in it that you've learned (rounded down), so it rises as they do.",
    table(["Discipline", "Raises", "Skills"], DISCIPLINE_IDS.map((d) => [`${DISCIPLINES[d].icon} ${link(DISCIPLINES[d].name)}`, DISCIPLINES[d].description.replace(/^.*?\. /, ""), DISCIPLINES[d].skills.map((s) => link(s.name)).join(", ")])),
    "## Stats at each level",
    table(["Level", "Health (Strength)", "Stamina (Endurance)", "Mana (Wisdom)", "Carry (Dexterity)", "Walk speed (Dexterity)", "Prices (Charisma)"], [1, 10, 20, 31, 50, 75, 99].map((l) => [l, maxHealth(l), maxStamina(l), maxMana(l), `${carryCapacity(l) / 10} kg`, `+${pct(walkBonus(l))}`, `${pct(priceBonus(l))} better`])),
    `[[Trading]] adds another ${pct(tradingBonus(2))} better prices per level above 1.`,
  ].join("\n\n"));
  gamePage({ title: "Spells", category: "Spells", icon: "🪄", sources: ["shared/combat.ts", "shared/spells.ts"], summary: "Every spell." }, () => [
    "Spells use mana and train [[Spellcasting]]. Bolts fly from a staff in your hand; the others are cast from your spell bar. Some can only be learned from a spell book.",
    table(["Spell", "Kind", "Level", "Mana", "What it does"], SPELL_IDS.map((id) => [`${SPELLS[id].icon} ${link(SPELLS[id].name)}`, SPELLS[id].kind, SPELLS[id].level, SPELLS[id].mana, canon(SPELLS[id].description)])),
  ].join("\n\n"));
  const bookOf = new Map(SPELL_BOOK_IDS.map((b) => [SPELL_BOOKS[b], b]));
  for (const id of SPELL_IDS) {
    const s = SPELLS[id];
    const book = bookOf.get(id as any);
    const drops = book ? MONSTER_IDS.filter((m) => MONSTERS[m].drops.some((d) => d.item === book)) : [];
    gamePage({ title: s.name, category: "Spells", icon: s.icon, sources: ["shared/combat.ts", "shared/spells.ts"], summary: canon(s.description),
      infobox: [["Spellcasting level", String(s.level)], ["Mana", String(s.mana)], ["Kind", { bolt: "Bolt (from a staff)", self: "On yourself", target: "On a monster", area: "All around you" }[s.kind]], ["Learned from", book ? "A spell book" : "Levelling up"]] }, () => [
      `${s.icon} ${canon(s.description)}`,
      `It needs [[Spellcasting]] level ${s.level} and costs ${s.mana} mana at Mastery 1 (Mastery lowers the cost).${s.maxHit ? ` Its biggest hit is ${s.maxHit}${s.kind === "bolt" ? ", plus your staff's bonus" : ""}.` : ""}${s.seconds ? ` It lasts ${s.seconds} seconds at Mastery 1.` : ""}`,
      book ? `Learn it by reading ${itemLink(book)}${drops.length ? `, which ${drops.map((m) => link(canon(MONSTERS[m].name))).join(" and ")} sometimes drop` : ""}.` : "",
    ].filter(Boolean).join("\n\n"));
  }
}

// ---------------------------------------------------------------- people, places, quests, shops

function peoplePages() {
  const gives = new Map<string, Chapter[]>();
  for (const c of CHAPTERS) gives.set(c.giver, [...(gives.get(c.giver) ?? []), c]);
  const rows: string[][] = [];
  for (const n of NPCS.filter((n) => n.kind === "person")) {
    const name = canon(n.name);
    const area = areaAt(n.x, n.y);
    const shop = (SHOPS as any)[n.id];
    const qs = gives.get(n.id) ?? [];
    rows.push([link(name), area ? link(area.name) : "—", qs.length ? String(qs.length) : ""]);
    gamePage({ title: n.name, category: "People", icon: n.badge ?? "🧑", sources: ["shared/npcs.ts", "shared/quests.ts", "shared/story.ts"],
      infobox: [["Found in", area ? area.name : "—"], ...(shop ? [["Shop", "Yes"] as [string, string]] : []), ["Game id", "`" + n.id + "`"]] }, () => [
      n.greeting ? `What they say when you click them: *"${canon(n.greeting)}"*` : "",
      `Found in ${area ? link(area.name) : "the world"}.`,
      qs.length ? "**Quests they give:**\n\n" + qs.map((c) => `- ${link(canon(c.title))}${c.act ? ` (${c.act === "act1" ? "Act 1" : "Prologue"})` : c.side ? " (side quest)" : " (lessons)"}`).join("\n") : "",
      shop ? `**Shop:** buys ${canon(shop.buysText)}. Sells: ${shop.stock.map(itemLink).join(", ")}.${shop.rare?.length ? ` With more [[Trading]]: ${shop.rare.map((r: any) => `${itemLink(r.item)} (Trading ${r.trading})`).join(", ")}.` : ""} See [[Shops]].` : "",
    ].filter(Boolean).join("\n\n"));
  }
  gamePage({ title: "People in the game", category: "People", icon: "🧑", sources: ["shared/npcs.ts"], summary: "Everyone you can talk to in the game today." }, () => [
    "Everyone you can talk to in the game today. The [[Groups and people]] page lists the story's characters too, including ones not in the game yet.",
    table(["Person", "Where", "Quests"], rows),
  ].join("\n\n"));
}

function placePages() {
  for (const a of AREAS) {
    const here = NPCS.filter((n) => areaAt(n.x, n.y)?.id === a.id);
    const people = here.filter((n) => n.kind === "person");
    const stations = [...new Set(here.filter((n) => n.kind === "station").map((n) => canon(n.name.replace(/ \d+$/, ""))))];
    const mons = new Map<string, number>();
    for (const [kind, x, y] of WORLD_SPAWNS) if (areaAt(x, y)?.id === a.id) mons.set(kind, (mons.get(kind) ?? 0) + 1);
    gamePage({ title: a.name, category: "Places", icon: a.kind === "cave" ? "🕳️" : a.kind === "indoor" ? "🏠" : "🗺️", sources: ["shared/world.ts", "shared/npcs.ts"],
      infobox: [["Kind", a.kind === "outdoor" ? "Outdoors" : a.kind === "cave" ? "Cave" : "Indoors"], ["Danger", a.danger ? "Monsters attack on sight" : "Safe"], ["Size", `${a.w} × ${a.h} tiles`]] }, () => [
      people.length ? "**People here:** " + people.map((n) => link(canon(n.name))).join(", ") + "." : "",
      stations.length ? "**Things to use:** " + stations.join(", ") + "." : "",
      mons.size ? "**Monsters:** " + [...mons].map(([m, c]) => `${link(canon(MONSTERS[m as MonsterId].name))} (${c})`).join(", ") + "." : "",
      a.kind === "outdoor" ? "**On the map:** " + MAP_LABELS.map((l) => l.text).join(", ") + "." : "",
    ].filter(Boolean).join("\n\n") || "Nothing here yet.");
  }
}

function questPages() {
  const kind = (c: Chapter) => (c.act === "prologue" ? "Prologue" : c.act === "act1" ? "Act 1" : c.side ? "Side quest" : "Lessons");
  for (const c of CHAPTERS) {
    const giver = npcName(c.giver);
    const unlocks = [...new Set(c.steps.flatMap((s) => s.unlocks ?? []))];
    const gifts = c.steps.flatMap((s) => s.give ?? []);
    const coinsTotal = c.steps.reduce((n, s) => n + (s.coins ?? 0), 0);
    gamePage({ title: c.title, category: "Quests", icon: "📜", sources: ["shared/quests.ts", "shared/story.ts"], summary: `${kind(c)} from ${giver}.`,
      infobox: [["Part of", kind(c)], ["Given by", giver], ["Where", canon(c.where)], ["Steps", String(c.steps.length)], ...(c.requires ? [["Needs", `${skillName(c.requires.skill)} ${c.requires.level}`] as [string, string]] : [])] }, () => [
      `**${canon(c.title)}** is ${kind(c) === "Lessons" ? "a lesson" : kind(c) === "Side quest" ? "a side quest" : `part of the ${kind(c)}`} from ${link(giver)}, found ${canon(c.where)}.`,
      c.after?.length ? `It opens after: ${c.after.map((id) => link(canon(CHAPTERS.find((x) => x.id === id)?.title ?? id))).join(", ")}${c.lessons ? `, and ${c.lessons} trainers' lessons` : ""}.` : "",
      "## Steps", c.steps.map((s, i) => `${i + 1}. ${canon(s.task)}${s.give?.length ? ` *(you get: ${s.give.map((g) => `${g.count && g.count > 1 ? g.count + " × " : ""}${itemLink(g.item)}`).join(", ")})*` : ""}`).join("\n"),
      unlocks.length ? `**Teaches:** ${unlocks.map(skillLink).join(", ")}.` : "",
      gifts.length || coinsTotal ? `**Rewards:** ${[...gifts.map((g) => itemLink(g.item)), ...(coinsTotal ? [coins(coinsTotal)] : [])].join(", ")}.` : "",
      "## What people say\n\n" + c.steps.map((s, i) => (s.lines?.length ? `**Step ${i + 1}.** ` + s.lines.map((l) => canon(l)).join(" ") : "")).filter(Boolean).join("\n\n"),
    ].filter(Boolean).join("\n\n"));
  }
  gamePage({ title: "Quests", category: "Quests", icon: "📜", sources: ["shared/quests.ts", "shared/story.ts"], summary: "Every quest built so far." }, () => [
    "Every quest in the game today, in the order they're listed. The story's plan for later acts is on [[Main story]] and [[Side quests]].",
    ...["Prologue", "Lessons", "Side quest", "Act 1"].map((k) => `## ${k === "Side quest" ? "Side quests" : k}\n\n` + table(["Quest", "From", "Steps"], CHAPTERS.filter((c) => kind(c) === k).map((c) => [link(canon(c.title)), link(npcName(c.giver)), c.steps.length]))),
  ].join("\n\n"));
}

function shopPages() {
  gamePage({ title: "Shops", category: "Mechanics", icon: "💰", sources: ["shared/shops.ts", "shared/crafting.ts"], summary: "Who sells what." }, () => [
    "Trainers run little shops. A shop sells for 3 times what it pays, so buying to sell again always loses. [[Charisma]] and [[Trading]] make prices better both ways.",
    ...SHOP_IDS.map((s) => {
      const d = SHOPS[s];
      return `## ${link(npcName(s), canon(d.title))}\n\nBuys: ${canon(d.buysText)}.\n\nSells: ${d.stock.map(itemLink).join(", ")}.${d.rare?.length ? `\n\nWith more Trading: ${d.rare.map((r) => `${itemLink(r.item)} (${r.trading})`).join(", ")}.` : ""}`;
    }),
  ].join("\n\n"));
}

function bookPages() {
  const where = { lighthall: "the Lighthall library", guild: "the Mages' Guild", town: "town houses and the inn" } as const;
  gamePage({ title: "Books in the game", category: "Books", icon: "📚", sources: ["shared/lore.ts"], summary: "Every book you can take off a shelf." }, () => [
    "Click a bookshelf to take down a book. None of them are needed for a quest. A few of them don't quite agree with each other, on purpose: the Emberguard's books tell their side of the story. Compare them with [[History]].",
    ...(Object.keys(ALL_BOOKS) as (keyof typeof ALL_BOOKS)[]).map((k) => `## In ${where[k]}\n\n` + ALL_BOOKS[k].map((b) => `### ${canon(b.title)}\n\n` + b.pages.map((p) => `> ${canon(p)}`).join("\n>\n")).join("\n\n")),
  ].join("\n\n"));
}

function updatePages() {
  gamePage({ title: "Version history", category: "Updates", icon: "🆕", sources: ["shared/version.ts"], summary: `Every game update. The game is at version ${GAME_VERSION}.` }, () => [
    `The game is at **version ${GAME_VERSION}**. Every update adds 0.1; version 1.0 is saved for the finished game.`,
    ...UPDATES.map((u) => `## ${u.version} · ${u.date} · ${canon(u.title)}\n\n` + u.changes.map((c) => `- ${canon(c.text)}${c.reports?.length ? ` *(report${c.reports.length > 1 ? "s" : ""} ${c.reports.map((r) => "#" + r).join(", ")})*` : ""}`).join("\n")),
  ].join("\n\n"));
}

function mechanicsPages() {
  gamePage({ title: "Levels and XP", category: "Mechanics", icon: "📈", sources: ["shared/disciplines.ts"], summary: `Skills go from 1 to ${MAX_LEVEL}.` }, () => [
    `Every skill has its own XP and level, up to ${MAX_LEVEL}. It gets steeper as you go.`,
    table(["Level", "Total XP needed"], [2, 3, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 99].map((l) => [l, num(xpForLevel(l))])),
  ].join("\n\n"));
  gamePage({ title: "Mastery", category: "Mechanics", icon: "⭐", sources: ["shared/mastery.ts", "shared/skilltree.ts"], summary: "Your experience with one type of thing." }, () => [
    `Mastery is your experience with one kind of thing: Oak, Trout, Wolf, Firebolt, Stew. Each Mastery levels separately (the first level takes ${MASTERY_FIRST_LEVEL_XP} XP, each one ${pct(MASTERY_GROWTH - 1)} more than the last) and makes that thing faster, more reliable or more valuable.`,
    "Every Mastery level you earn gives 1 Mastery point to spend in any skill's tree (see each skill's page). Rank 1 costs 1 point, rank 2 costs 2 more, rank 3 costs 3 more. Resetting a tree is free for now.",
  ].join("\n\n"));
  gamePage({ title: "Combat", category: "Mechanics", icon: "⚔️", sources: ["shared/combat.ts"], summary: "How fighting works." }, () => [
    "Hold a [[Weapons|weapon]] and click a monster. Every hit gives XP to the skill you used ([[Melee]], [[Ranged]] or [[Spellcasting]]), to that weapon's or spell's [[Mastery]], and to that monster's Mastery. Getting attacked trains [[Defense]]. With nothing in your hand you punch.",
    `- Each weapon attack costs ${ATTACK_STAMINA} stamina; spells cost mana.\n- Mana comes back 1 every ${MANA_REGEN_TICKS * TICK_MS / 1000} seconds.\n- Health comes back 1 a minute (${HEALTH_REGEN_MS / 60000} min); potions are the quick way. A [[Health potion]] gives ${POTION_HEAL}.\n- One game tick is ${TICK_MS / 1000} seconds.`,
    "Mastery of a weapon or monster makes you hit more often and harder, and Mastery of a monster makes it drop things more often. When you fall, you wake at a shrine (see [[The Tithe]]).",
  ].join("\n\n"));
  gamePage({ title: "Day and night", category: "Mechanics", icon: "🌙", sources: ["shared/daynight.ts"], summary: `A day lasts ${DAY_MS / 60000} minutes, a night ${NIGHT_MS / 60000}.` }, () =>
    `A full day is ${DAY_MS / 60000} minutes of daylight and ${NIGHT_MS / 60000} minutes of night, with ${TWILIGHT_MS / 60000} minutes of dusk and dawn between. Some monsters (like the [[Giant bat]]) and some finds (like [[Moonpetal]]) only come out at night. Your [[Your lantern|lantern]] makes nights less dark.`);
  gamePage({ title: "Money", category: "Mechanics", icon: "🪙", sources: ["shared/money.ts"], summary: "Coins, from bronze up to iridium." }, () =>
    `Coins come in ${COIN_KINDS.length} kinds: ${[...COIN_KINDS].reverse().join(", ")}. Each is worth 100 of the one below it (100 bronze = 1 silver, 100 silver = 1 gold, and so on).`);
  gamePage({ title: "Running", category: "Mechanics", icon: "🏃", sources: ["shared/stats.ts"], summary: "Hold Shift or tap 🏃." }, () =>
    `Hold Shift or tap 🏃 to run ${pct(RUN_SPEED - 1)} faster. Each tile uses 1 stamina for the moment; stop for ${RUN_REST_MS / 1000} seconds and it all comes back. Running never costs stamina for good.`);
  gamePage({ title: "Parties", category: "Mechanics", icon: "🚩", sources: ["shared/party.ts"], summary: `Up to ${PARTY_MAX} players.` }, () =>
    `Click another player to invite them. A party holds up to ${PARTY_MAX}. Members within ${PARTY_NEAR} tiles of the leader share in kills and quest steps, and the leader trains [[Leadership]].`);
  gamePage({ title: "Bounties", category: "Mechanics", icon: "📋", sources: ["shared/bounties.ts", "shared/guild.ts"], summary: "Jobs on the bounty board that pay double." }, () => [
    `The bounty board in the square shows ${BOUNTY_COUNT} jobs a day. Bring the full amount and they pay double what a shop would, plus [[Renown]]. A new job costs ${REROLL_FEE} bronze.`,
    "The [[The Mages' Guild|Mages' Guild]] has its own board of magic jobs (trap souls, brew, enchant), and its own ranks:",
    table(["Guild rank", "Points", "Chest size"], GUILD_RANKS.map((r) => [r.name, r.points, r.maxChest])),
    `Enchanted chests: ${CHEST_START} slots to start, ${CHEST_STEP} more each time you expand (${EXPAND_GOLD.join(", ")} gold), rent ${coins(CHEST_RENT)}.`,
  ].join("\n\n"));
  gamePage({ title: "The Tithe", category: "Mechanics", icon: "🕯️", sources: ["shared/story.ts"], aliases: ["Soul Debt", "Tithe marks"] }, () => [
    `After the Oath, each time you're knocked out you get a Tithe mark (at most ${TITHE_MAX}). While you have marks, ${pct(TITHE_SHARE)} of the XP you earn goes to the shrine instead. Each mark clears once the shrine has taken enough XP (${titheCost(1)} at level 1, ${titheCost(50)} at level 50). You never lose levels or items. A [[Tithe tonic]] clears one mark at once.`,
  ].join("\n\n"));
  gamePage({ title: "Blessings", category: "Mechanics", icon: "📜", sources: ["shared/story.ts"] }, () =>
    `A blessing gives +${BLESS_POWER}% XP for ${BLESS_MINUTES} minutes. Read a [[Blessing scrolls|blessing scroll]] to get one.`);
  gamePage({ title: "Trial marks", category: "Mechanics", icon: "🔥", sources: ["shared/story.ts"], aliases: ["Ranks"] }, () =>
    `The game today has these ranks: ${TRIAL_RANKS.map((r) => canon(r)).join(", ")}. Ember and Flame wear coloured cloaks. In the lore, these become trial marks: Ember, Flame, Blaze and Radiant (see [[Main story]]).`);
}

function namesPage() {
  gamePage({ title: "Names", category: "Wiki", icon: "🏷️", sources: ["wiki/build.ts"], summary: "Old names in the game's code, and the lore bible's names the wiki uses." }, () => [
    "The wiki uses the lore bible's names everywhere. The game's code still uses some old ones; the wiki swaps them automatically in anything it copies from the code. Pages where a swap happened say so at the bottom.",
    table(["The game says", "The wiki says"], RENAMES.map(([re, to]) => [re.source.replace(/\\b|\(the \)\?|\?|\\/g, ""), to])),
    "When the game itself is renamed, nothing needs to change here: the swaps just stop finding anything.",
  ].join("\n\n"));
}

// ---------------------------------------------------------------- markdown -> HTML

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const titleIndex = new Map<string, string>();
const missing = new Map<string, Set<string>>();
let currentSlug = "";

function inline(text: string): string {
  let s = escHtml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, label?: string) => {
    const slug = titleIndex.get(slugify(target.replace(/&amp;/g, "&").replace(/&#39;/g, "'")));
    if (!slug) { missing.set(currentSlug, (missing.get(currentSlug) ?? new Set()).add(target)); return `<a class="new" title="No page yet">${label ?? target}</a>`; }
    return `<a href="#${slug}" data-to="${slug}">${label ?? target}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");
  return s;
}

function md(src: string): string {
  const lines = src.replace(/\\\|/g, "\u0001").split("\n");
  const out: string[] = [];
  let i = 0;
  const cells = (l: string) => l.trim().replace(/\[\[[^\]]*\]\]/g, (x) => x.replace(/\|/g, "\u0001")).replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim().replace(/\u0001/g, "|")));
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^:::\s*(secret|note)\s*(.*)$/))) {
      const inner: string[] = []; i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) inner.push(lines[i++]);
      i++;
      const label = m[1] === "secret" ? `🔒 Secret${m[2] ? ": " + inline(m[2]) : ""}` : inline(m[2] || "Note");
      out.push(`<div class="box ${m[1]}"><div class="box-label">${label}</div>${md(inner.join("\n"))}</div>`);
      continue;
    }
    if ((m = l.match(/^(#{2,4})\s+(.*)$/))) {
      const level = m[1].length;
      const id = slugify(m[2].replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_x, a, b) => b || a));
      out.push(`<h${level} id="s-${id}">${inline(m[2])}</h${level}>`); i++; continue;
    }
    if (l.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const head = cells(rows[0]);
      const body = rows.slice(rows[1] && /^\|[\s\-:|]+\|?$/.test(rows[1]) ? 2 : 1);
      out.push(`<div class="tw"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^\s*[-*] /.test(l) || /^\s*\d+\. /.test(l)) {
      const ordered = /^\s*\d+\. /.test(l);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+\. /.test(lines[i]) : /^\s*[-*] /.test(lines[i]))) items.push(lines[i++].replace(/^\s*([-*]|\d+\.) /, ""));
      out.push(`<${ordered ? "ol" : "ul"}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    if (l.startsWith(">")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${q.join("\n").split(/\n\s*\n/).map((p) => `<p>${inline(p)}</p>`).join("")}</blockquote>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|\||>|:::|\s*[-*] |\s*\d+\. )/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- build

readWritten();
itemPages();
gearPages();
potionPages();
foodPages();
monsterPages();
skillPages();
peoplePages();
placePages();
questPages();
shopPages();
bookPages();
updatePages();
mechanicsPages();
namesPage();

for (const p of pages.values()) {
  titleIndex.set(p.slug, p.slug);
  for (const a of p.aliases) titleIndex.set(slugify(a), p.slug);
}

const CATEGORY_ORDER = ["Wiki", "Lore", "History", "Story", "Places", "Factions", "People", "Quests", "Skills", "Spells", "Monsters", "Items", "Mechanics", "Books", "Updates"];
const out = [...pages.values()].map((p) => {
  currentSlug = p.slug;
  const html = md(p.body);
  return {
    s: p.slug, t: p.title, c: p.category, i: p.icon, sum: inline(p.summary), a: p.aliases,
    ib: p.infobox.map(([k, v]) => [escHtml(k), inline(v)]), h: html, src: p.sources, w: p.written, r: !!p.renamed,
  };
}).sort((a, b) => a.t.localeCompare(b.t));

const data = { built: new Date().toISOString().slice(0, 10), version: GAME_VERSION, categories: CATEGORY_ORDER.filter((c) => out.some((p) => p.c === c)), pages: out };
const template = readFileSync(path.join(HERE, "template.html"), "utf8");
const html = template.replace("/*WIKI_DATA*/null", JSON.stringify(data).replace(/</g, "\\u003c"));
writeFileSync(path.join(HERE, "emberfall-wiki.html"), html);

const unknownCats = [...new Set(out.map((p) => p.c))].filter((c) => !CATEGORY_ORDER.includes(c));
console.log(`Built wiki/emberfall-wiki.html: ${out.length} pages (${out.filter((p) => p.w).length} hand-written), ${Math.round(html.length / 1024)} KB, game version ${GAME_VERSION}.`);
if (unknownCats.length) console.log(`Categories not in the sidebar order: ${unknownCats.join(", ")}`);
const allMissing = [...missing].flatMap(([slug, set]) => [...set].map((t) => `${t} (on ${slug})`));
if (allMissing.length) console.log(`Links to pages that don't exist yet (${allMissing.length}):\n  ` + allMissing.join("\n  "));
