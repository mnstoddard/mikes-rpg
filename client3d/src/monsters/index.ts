// The monster library: every monster in the game (and the planned ones from
// the story docs), made in code, smooth and cute, with five animations each.
//
// How to use it in the game:
//   import { createMonster } from "./monsters";
//   const wolf = createMonster("wolf", { variant: 0, seed: 7 }); // game monster ids
//   scene.add(wolf.object);          // faces +Z, stands on y = 0, real size in metres
//   wolf.play("walk");               // idle, walk, attack, hit, death
//   wolf.update(dt, time);           // every frame
//
// Attack and hit play once and go back to idle or walk. Death lies down, then
// the monster shrinks away and pops back (like a respawn).
// "status" is Mike's review: only approved monsters (and their chosen
// variant) should go into the game. The Monster Gallery is where he reviews them.
import { MONSTERS, MonsterId } from "../../../shared/combat";
import { ITEMS } from "../../../shared/items";
import type { ItemId } from "../../../shared/items";
import { alphaWolf, boar, cow, direWolf, frostWyrm, hollowWolf, primeval, rat, wolf } from "./beasts";
import { caveSpider, dustTitan, fireBeetle, giantSpider, thornmother } from "./bugs";
import { chicken, ghost, giantBat, slime, wisp } from "./critters";
import { ashboundRaider, ashboundScout, goblin, graveGhoul, sable, vael } from "./folk";
import type { Monster } from "./kit";
import { deepOne } from "./serpent";

export type { Anim, Monster } from "./kit";
export { ANIMS } from "./kit";

export type ReviewStatus = "waiting" | "approved" | "changes";
export type MonsterGroup = "town" | "danger" | "planned" | "bosses";

export const MONSTER_GROUPS: Record<MonsterGroup, { name: string; about: string }> = {
  town: { name: "Near town", about: "In the game now: the farm, the meadows and the lake round Heartvale." },
  danger: { name: "Danger zones", about: "In the game now: the Dark Forest, the cave, the Westroad, Wolf Hollow and the Thornwood." },
  planned: { name: "Planned creatures", about: "From the design and story docs, not in the game yet." },
  bosses: { name: "Planned bosses", about: "The story's big fights (Acts 2 and 4), not in the game yet." },
};

export interface MonsterType {
  id: string;
  name: string;
  group: MonsterGroup;
  /** The game's monster id, for monsters already in the game. */
  gameId?: MonsterId;
  variants: string[];
  about: string;
  where: string;
  /** For the list's colour swatch. */
  color: number;
  build: (variant: number, seed: number) => Monster;
  facts: () => [string, string][];
  status: ReviewStatus;
}

const itemName = (id: ItemId) => (ITEMS[id] as { name?: string } | undefined)?.name ?? id;

/** The game's own numbers for a monster (shared/combat.ts), so the 2D and 3D games agree. */
function gameFacts(id: MonsterId): [string, string][] {
  const m = MONSTERS[id];
  const f: [string, string][] = [
    ["Level", String(m.level)],
    ["Health", String(m.hp)],
    ["Hits up to", m.maxHit ? String(m.maxHit) : "Never fights back"],
    ["Attacks", m.aggressive ? "On sight" : m.maxHit ? "Only if you attack" : "Never"],
  ];
  if (m.night) f.push(["Comes out", "At night"]);
  if (m.pack) f.push(["Runs in", "Packs"]);
  if (m.drops.length) f.push(["Drops", m.drops.map((d) => itemName(d.item)).join(", ")]);
  if (m.coins[1]) f.push(["Coins", `${m.coins[0]} to ${m.coins[1]}`]);
  return f;
}
const planned = (...f: [string, string][]) => () => [...f, ["In the game", "Planned"]] as [string, string][];

const T = (t: Omit<MonsterType, "status" | "facts"> & { facts?: () => [string, string][] }): MonsterType => ({
  facts: t.gameId ? () => gameFacts(t.gameId!) : () => [],
  status: "waiting",
  ...t,
});

export const MONSTER_TYPES: MonsterType[] = [
  // ---- Near town ----
  T({ id: "chicken", gameId: "chicken", name: "Chicken", group: "town", variants: ["White hen", "Brown hen", "Rooster"], color: 0xf6f2e8, build: chicken,
    about: "Clucks about the farm pecking at the ground. Never fights back.", where: "The farm, next to the square." }),
  T({ id: "rat", gameId: "rat", name: "Rat", group: "town", variants: ["Brown", "Grey", "White"], color: 0x8a6a52, build: rat,
    about: "A chubby rat with a long pink tail. Bites back if you swing at it.", where: "Round the back of town, near the north field." }),
  T({ id: "cow", gameId: "cow", name: "Cow", group: "town", variants: ["Black and white", "Brown", "Highland cream"], color: 0xf4f1ea, build: cow,
    about: "A big, gentle cow with a bell. Never fights back.", where: "The east pasture." }),
  T({ id: "slime", gameId: "slime", name: "Slime", group: "town", variants: ["Green", "Blue", "Pink"], color: 0x6fd06a, build: slime,
    about: "A wobbly jelly that hops about. Squishes flat when hit and melts into a puddle when beaten.", where: "The wet meadow by the lake." }),
  T({ id: "boar", gameId: "boar", name: "Boar", group: "town", variants: ["Brown", "Dark", "Bristly"], color: 0x6e4c36, build: boar,
    about: "A stocky wild pig with tusks and a bristly crest. Charges if you attack it.", where: "The meadow south-east of the square." }),
  T({ id: "giant_bat", gameId: "giant_bat", name: "Giant bat", group: "town", variants: ["Brown", "Black", "Pale"], color: 0x6a4a3a, build: giantBat,
    about: "Flaps about at night. Swoops down to bite. Over the meadows it only bites back; in the forest it attacks.", where: "Night only: the meadows, the cave and the forest." }),
  // ---- Danger zones ----
  T({ id: "wolf", gameId: "wolf", name: "Wolf", group: "danger", variants: ["Grey", "Brown", "Black"], color: 0x8d949c, build: wolf,
    about: "Runs in packs of 2 or 3: when one goes for you, the others join in.", where: "The Thornwood, near the gate." }),
  T({ id: "hollow_wolf", gameId: "hollow_wolf", name: "Hollow wolf", group: "danger", variants: ["Ashen", "Hollow-eyed"], color: 0xb8bec4, build: hollowWolf,
    about: "A Blighted wolf: grey, thin, with glowing eyes and cracks that pulse with a sickly light.", where: "Wolf Hollow (Act 1: The Hollow Wolves)." }),
  T({ id: "alpha_wolf", gameId: "alpha_wolf", name: "Alpha wolf", group: "danger", variants: ["Blighted", "Silver"], color: 0xa9b0b6, build: alphaWolf,
    about: "Kael's Wolf Hunt: a huge pack leader with a thick ruff and a scar. The story says it's Blighted. Best fought as a party.", where: "The wolf den, south-west of the Dark Forest path." }),
  T({ id: "cave_spider", gameId: "cave_spider", name: "Cave spider", group: "danger", variants: ["Brown", "Black", "Pale"], color: 0x6a4a36, build: caveSpider,
    about: "A spider about as wide as a dog, with big eyes. Rears up and bites.", where: "The little cave east of the quarry." }),
  T({ id: "spider", gameId: "spider", name: "Giant spider", group: "danger", variants: ["Red hourglass", "Forest green", "Striped"], color: 0x3a2a30, build: giantSpider,
    about: "As tall as a person. Spins the forest road shut with webs (Act 2A: Webs Across the Path).", where: "The east Thornwood." }),
  T({ id: "goblin", gameId: "goblin", name: "Goblin", group: "danger", variants: ["Green", "Mossy", "Tunnel"], color: 0x7fae4e, build: goblin,
    about: "Small, sneaky and quick with a goblin-forged dagger. They hoard emberstone because \"it keeps the grey sickness away\".", where: "The goblin camp in the west Thornwood; later the Greyspine tunnels." }),
  T({ id: "ashbound_scout", gameId: "ashbound_scout", name: "Ashbound scout", group: "danger", variants: ["Hooded", "Hooded (dark)"], color: 0x8a7c6a, build: ashboundScout,
    about: "The Ashbound's lookouts, in ash-grey leather with ember trim. Only fight if you start it.", where: "The smashed Westroad shrine (Act 1: Ash on the Road)." }),
  T({ id: "bandit", gameId: "bandit", name: "Ashbound raider", group: "danger", variants: ["Greatsword", "Sword and shield"], color: 0x5e5a52, build: ashboundRaider,
    about: "Tough Ashbound fighters deep in the Thornwood. They carry stolen rings.", where: "Deep in the south Thornwood." }),
  // ---- Planned creatures ----
  T({ id: "fire_beetle", name: "Fire beetle", group: "planned", variants: ["Ember", "Lava"], color: 0xb8341e, build: fireBeetle,
    about: "Its shell opens to show a glowing belly. Drops beetle shell (fire resist potion) and a glowing gland.", where: "The quarry.",
    facts: planned(["Level", "10"]) }),
  T({ id: "wisp", name: "Will-o'-wisp", group: "planned", variants: ["Blue", "Green", "Gold"], color: 0x7fd8ff, build: wisp,
    about: "A floating light with a flame tail and orbiting sparks. Drops wisp essence (big ember value). Lights up the ground at night.", where: "Night only: the Dark Forest.",
    facts: planned(["Level", "16"], ["Comes out", "At night"]) }),
  T({ id: "grave_ghoul", name: "Grave ghoul", group: "planned", variants: ["Mossy", "Pale"], color: 0xa8b4a0, build: graveGhoul,
    about: "A hunched, shuffling ghoul with long claws. Drops bone dust and ghoul eyes.", where: "Night only: the Graveyard.",
    facts: planned(["Level", "22"], ["Comes out", "At night"]) }),
  T({ id: "graveyard_ghost", name: "Graveyard ghost", group: "planned", variants: ["Drifting", "Thread-bound"], color: 0xe6f0ff, build: ghost,
    about: "A drained Emberborn, still tied to the old shrine. Not hostile at night (Act 2A: The Silent Graveyard). The Thread-bound one still has its thread of light.", where: "Night only: the Graveyard.",
    facts: planned(["Attacks", "Never (story)"]) }),
  T({ id: "dire_wolf", name: "Dire wolf", group: "planned", variants: ["Dark", "Scarred", "Blighted"], color: 0x4a4440, build: direWolf,
    about: "A group-quest boss from the design doc: a giant wolf with a spiky mane and big fangs. Drops dire wolf pelt and big fang.", where: "Wolf Hollow (The Howling Hollow).",
    facts: planned(["Level", "20"]) }),
  T({ id: "primeval_beast", name: "Primeval beast", group: "planned", variants: ["Tusker", "Frostfell"], color: 0x7a4a2e, build: primeval,
    about: "An ancient woolly beast from the Sundered Crown. Its hide makes Primeval leather, the best leather armor.", where: "The Sundered Crown (and Frostfell's ancient beasts).",
    facts: planned(["Level", "70+"]) }),
  // ---- Planned bosses ----
  T({ id: "thornmother", name: "The Thornmother", group: "bosses", variants: ["Thorned", "Blighted grey"], color: 0x4a3450, build: thornmother,
    about: "A huge Blighted spider queen with a crown and back of thorns. Party recommended. Drops the Thornmother fang.", where: "Thornwood (Act 2A boss).",
    facts: planned(["Rank reward", "Blaze"]) }),
  T({ id: "frost_wyrm", name: "Frost Wyrm", group: "bosses", variants: ["Ice blue", "Snowy"], color: 0x7fb6d8, build: frostWyrm,
    about: "A young wyrm nesting near the summit. Rears up and breathes frost (bring a frost resist potion). Drops wyrm scale.", where: "Greyspine Peaks (Act 2B boss)." ,
    facts: planned() }),
  T({ id: "deep_one", name: "The Deep One", group: "bosses", variants: ["Kelp", "Abyss"], color: 0x3a7a6a, build: deepOne,
    about: "A Blighted sea serpent that rises out of the harbour. Fight it from the docks and boats. Drops serpent hide.", where: "Saltmere Coast (Act 2C boss).",
    facts: planned() }),
  T({ id: "dust_titan", name: "The Dust Titan", group: "bosses", variants: ["Blighted", "Sandstone"], color: 0xa8a49a, build: dustTitan,
    about: "A giant Blighted beetle that guards the old road of the Old Kingdom. Drops titan shell (a shield part).", where: "The Ashen Barrens (Act 2D boss).",
    facts: planned() }),
  T({ id: "sable", name: "Sable", group: "bosses", variants: ["Ponytail, sword", "Loose hair, Severing Blade"], color: 0x2c2833, build: sable,
    about: "Leader of the Ashbound, once the Emberguard's brightest champion. In the thread-cut cloak. The Emberguard path's final fight (Sable's Raid).", where: "The Emberheart (Act 4, Emberguard path).",
    facts: planned() }),
  T({ id: "vael", name: "Vale", group: "bosses", variants: ["High Keeper", "Vale's Shade"], color: 0xf2c14e, build: vael,
    about: "The High Keeper, secretly the first of the Undying. Threads of stolen light swirl round him; he re-forms until you cut them. The Ashbound path's final fight.", where: "The Emberheart (Act 4, Ashbound path).",
    facts: planned() }),
];

export const MONSTER_BY_ID: Record<string, MonsterType> = Object.fromEntries(MONSTER_TYPES.map((t) => [t.id, t]));
export const MONSTER_IDS = MONSTER_TYPES.map((t) => t.id);

/** Make a monster by its id (game ids like "wolf" or "bandit" work too). */
export function createMonster(id: string, opts: { variant?: number; seed?: number } = {}): Monster {
  const t = MONSTER_BY_ID[id];
  if (!t) throw new Error(`No monster called ${id}`);
  return t.build(Math.max(0, Math.min(t.variants.length - 1, opts.variant ?? 0)), opts.seed ?? 1);
}
