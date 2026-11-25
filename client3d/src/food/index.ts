// The food library: every fish (raw and cooked), ingredient, crop, cooked
// dish and fishing spot for the 3D game, in one list.
//
// How to use one in the game:
//   import { createFood } from "./food";
//   const trout = createFood("fish-trout", { seed: 42, variant: 0 });
//   scene.add(trout.object);
//   // every frame:  trout.update(dt, time);
//   // a click:      trout.poke?.();
//
// Or build one directly: createFish("trout", { state: "caught" }),
// createSpot("pike", rng, 1), createDish("curry", rng, 0)...
//
// Sizes are real, in metres (a tuna is 1.8 m long, a potato 9 cm), so scale
// food up for icons. "status" is Mike's review: only "approved" models should
// go into the game. The Food Gallery page is where Mike approves each one.
import { DISHES, FISH_IDS, INGREDIENTS, RAW_FISH_STAMINA, ingredientStamina, type DishId, type FishId } from "../../../shared/cooking";
import { CROPS, type CropId } from "../../../shared/farming";
import { RESOURCES } from "../../../shared/foraging";
import { ITEMS, type ItemId } from "../../../shared/items";
import { Rng, Showpiece, makeRng } from "./common";
import { createFish, type FishState } from "./fish";
import { INGREDIENT_VARIANTS, IngredientKind, createIngredient } from "./ingredients";
import { DISH_VARIANTS, createDish } from "./dishes";
import { SPOT_VARIANTS, createSpot } from "./spots";

export type { Showpiece, Stage } from "./common";
export { createFish, FISH_LOOKS } from "./fish";
export { createIngredient } from "./ingredients";
export { createDish } from "./dishes";
export { createSpot } from "./spots";

/** Mike's review of a model. */
export type ReviewStatus = "waiting" | "approved" | "changes";

export type FoodCategory = "fish" | "cooked" | "dish" | "ingredient" | "spot";

export const CATEGORIES: Record<FoodCategory, { name: string; action: string }> = {
  fish: { name: "Fish", action: "Splash" },
  cooked: { name: "Cooked fish", action: "Turn" },
  dish: { name: "Dishes", action: "Turn" },
  ingredient: { name: "Ingredients and crops", action: "Turn" },
  spot: { name: "Fishing spots", action: "Make one jump" },
};

export interface FoodType {
  /** "fish-trout", "cooked-trout", "dish-curry", "ingredient-potato", "spot-trout". */
  id: string;
  name: string;
  category: FoodCategory;
  /** One line about it. */
  about: string;
  /** Where you find it in Embervale. */
  where: string;
  /** Real size, in words. */
  size: string;
  variants: readonly string[];
  /** Its colour in the game (list swatch). */
  color: number;
  /** Mike's review. Updated from the Food Gallery. */
  status: ReviewStatus;
  /** Numbers from the game's rules, for the info card. */
  stats(): [string, string][];
  build(rng: Rng, variant: number): Showpiece;
}

const nameOf = (id: string) => ITEMS[id as ItemId]?.name ?? id;

// ---------- Fish ----------

const FISH_TEXT: Record<FishId, { about: string; where: string; size: string }> = {
  minnow: { about: "A tiny silver fish with a dark stripe. Everyone's first catch.", where: "Any shallow water next to land.", size: "About 8 cm" },
  trout: { about: "Olive back with black spots and a pink stripe down its side.", where: "The lake, near town.", size: "About 40 cm" },
  perch: { about: "Golden yellow with dark bars, orange fins and a spiny fin on its back.", where: "The south side of the lake.", size: "About 30 cm" },
  salmon: { about: "Silver and strong, with a blue-grey back. Swims up the river.", where: "The river, down from the mountains.", size: "About 75 cm" },
  pike: { about: "A long, green hunter with pale spots, a flat duck-bill head and fins set far back.", where: "Out west in the lake.", size: "About 1 m" },
  tuna: { about: "A big, fast sea fish: navy back, silver belly, yellow finlets and a crescent tail.", where: "Along the Saltmere Coast.", size: "About 1.8 m" },
  swordfish: { about: "A huge sea fish with a long sword for a nose and a tall sickle fin.", where: "Around the rocky island off the coast.", size: "About 3 m, sword included" },
  eel: { about: "Long and dark like a snake, with a glowing violet line. The hardest catch.", where: "By the far island, out at sea.", size: "About 1.2 m" },
};

function fishTypes(): FoodType[] {
  const out: FoodType[] = [];
  for (const f of FISH_IDS) {
    const res = RESOURCES[f];
    const t = FISH_TEXT[f];
    out.push({
      id: `fish-${f}`, name: nameOf(f).replace(/s$/, "") || f, category: "fish", status: "waiting",
      about: t.about, where: t.where, size: t.size, color: res.color, variants: ["Swimming", "Caught"],
      stats: () => [
        ["Fishing level", String(res.level)],
        ["XP per catch", String(res.xp)],
        ["Seconds per try", String(res.seconds)],
        ["Stamina, eaten raw", String(RAW_FISH_STAMINA[f])],
        ["Sells for", `${ITEMS[f]?.sellPrice ?? 0} bronze`],
      ],
      build: (rng, v) => createFish(f, { seed: Math.floor(rng() * 1e6), state: (v === 1 ? "caught" : "swim") as FishState }),
    });
  }
  for (const f of FISH_IDS) {
    const t = FISH_TEXT[f];
    const fishName = nameOf(f).replace(/s$/, "") || f;
    out.push({
      id: `cooked-${f}`, name: `Cooked ${fishName.toLowerCase()}`, category: "cooked", status: "waiting",
      about: `How a ${fishName.toLowerCase()} looks once it's cooked. The game cooks fish into stews and curries, so this is for dishes, the stove and the eating animation.`,
      where: `Cook it at the stove (Cooking level ${INGREDIENTS[f].level}).`, size: t.size, color: RESOURCES[f].color, variants: ["Grilled", "Fried"],
      stats: () => [
        ["Cooking level", String(INGREDIENTS[f].level)],
        ["Stamina in a stew", String(Math.round(ingredientStamina("stew", f)))],
        ["Stamina in a curry", String(Math.round(ingredientStamina("curry", f)))],
      ],
      build: (rng, v) => createFish(f, { seed: Math.floor(rng() * 1e6), state: v === 1 ? "fried" : "grilled" }),
    });
  }
  return out;
}

// ---------- Dishes ----------

const DISH_TEXT: Record<DishId, string> = {
  stew: "A wooden bowl of stew with chunks, herbs and a spoon. The first thing everyone cooks.",
  stirfry: "Strips of meat and bright vegetables in a hot iron wok.",
  curry: "A blue-rimmed bowl of orange curry with a mound of rice.",
  steak: "A seared steak with grill marks, carrots and potato wedges on a plate.",
  roast: "A roast on a big platter, ringed with roast potatoes.",
};

function dishTypes(): FoodType[] {
  return (Object.keys(DISH_VARIANTS) as DishId[]).map((d) => ({
    id: `dish-${d}`, name: DISHES[d].name, category: "dish" as const, status: "waiting" as const,
    about: DISH_TEXT[d], where: "Cooked at the stove, over 1 log.", size: "A bowl or plate, 15 to 30 cm", color: 0xe0a050,
    variants: DISH_VARIANTS[d],
    stats: () => [
      ["Cooking level", String(DISHES[d].level)],
      ["Best with", DISHES[d].note],
      ["Fire bonus", `× ${DISHES[d].fire}`],
    ],
    build: (rng, v) => createDish(d, rng, v),
  }));
}

// ---------- Ingredients and crops ----------

const ING_TEXT: Record<IngredientKind, { about: string; size: string; color: number }> = {
  raw_chicken: { about: "Pale pink chicken: a drumstick with its bone, or a breast fillet.", size: "About 12 cm", color: 0xf0c6b2 },
  raw_beef: { about: "A red steak with a fat rim and marbling, or a few chunks for stew.", size: "About 20 cm", color: 0xb3303a },
  raw_boar: { about: "Darker red meat with thick fat and a strip of bristly skin, or a whole haunch.", size: "About 25 cm", color: 0x86222c },
  potato: { about: "Lumpy brown potatoes with little eyes.", size: "About 9 cm", color: 0xb58a52 },
  carrot: { about: "Orange carrots with leafy green tops.", size: "About 15 cm", color: 0xe8741e },
  onion: { about: "Golden or red onions with papery skin and a root tuft.", size: "About 8 cm", color: 0xc98a3a },
  wheat: { about: "A sheaf of golden wheat tied in the middle.", size: "About 35 cm", color: 0xd6b45c },
  ginseng: { about: "A pale forked root that looks a bit like a little person. Its plant has red berries.", size: "About 12 cm", color: 0xe2c99a },
  blue_lotus: { about: "A blue water flower with a golden heart. Grows on lily pads.", size: "About 14 cm across", color: 0x5a7fe0 },
  mushroom: { about: "Brown-capped mushrooms with pale stems and gills.", size: "About 7 cm", color: 0xa8754a },
  wild_root: { about: "Knobbly, twisty roots dug up in the wild.", size: "About 15 cm", color: 0x9a7348 },
  truffle: { about: "A dark, warty lump that smells amazing. Rare and valuable.", size: "About 6 cm", color: 0x3b2b22 },
};

function ingredientTypes(): FoodType[] {
  return (Object.keys(INGREDIENT_VARIANTS) as IngredientKind[]).map((k) => {
    const ing = (INGREDIENTS as Record<string, (typeof INGREDIENTS)[keyof typeof INGREDIENTS] | undefined>)[k];
    const crop = (CROPS as Record<string, (typeof CROPS)[CropId] | undefined>)[k];
    const t = ING_TEXT[k];
    const where = [ing?.from, crop ? `Grows on the farm (Farming ${crop.level})` : null].filter(Boolean).join(". ") || "Found in the wild";
    return {
      id: `ingredient-${k}`, name: nameOf(k), category: "ingredient" as const, status: "waiting" as const,
      about: t.about, where: `${where}.`, size: t.size, color: t.color, variants: INGREDIENT_VARIANTS[k],
      stats: () => {
        const rows: [string, string][] = [];
        if (ing) rows.push(["Cooking level", String(ing.level)], ["Stamina it adds", String(ing.stamina)]);
        if (crop) rows.push(["Farming level", String(crop.level)], ["Grows in", crop.minutes >= 60 ? `${crop.minutes / 60} hours` : `${crop.minutes} minutes`]);
        rows.push(["Sells for", `${ITEMS[k as ItemId]?.sellPrice ?? 0} bronze`]);
        return rows;
      },
      build: (rng, v) => createIngredient(k, rng, v),
    };
  });
}

// ---------- Fishing spots ----------

function spotTypes(): FoodType[] {
  return FISH_IDS.map((f) => {
    const res = RESOURCES[f];
    return {
      id: `spot-${f}`, name: res.node, category: "spot" as const, status: "waiting" as const,
      about: f === "minnow" ? "Clear shallow water with reeds and a little school of minnows." : `Ripples tinted the spot's colour from the game, bubbles, and a ${nameOf(f).replace(/s$/, "").toLowerCase()} that jumps out now and then.`,
      where: FISH_TEXT[f].where, size: "A pond about 3 m across", color: res.color, variants: SPOT_VARIANTS,
      stats: () => [
        ["Fishing level", String(res.level)],
        ["Catches", nameOf(f)],
        ["Seconds per try", String(res.seconds)],
        ["Runs out?", "Never"],
      ],
      build: (rng, v) => createSpot(f, rng, v),
    };
  });
}

export const FOOD_TYPES: FoodType[] = [...fishTypes(), ...dishTypes(), ...ingredientTypes(), ...spotTypes()].sort(
  (a, b) => Object.keys(CATEGORIES).indexOf(a.category) - Object.keys(CATEGORIES).indexOf(b.category),
);
export const FOOD_BY_ID: Record<string, FoodType> = Object.fromEntries(FOOD_TYPES.map((t) => [t.id, t]));

/** Make a model. The same seed and variant always give the same one. */
export function createFood(id: string, opts: { seed?: number; variant?: number } = {}): Showpiece {
  const type = FOOD_BY_ID[id];
  const variant = Math.max(0, Math.min(type.variants.length - 1, opts.variant ?? 0));
  return type.build(makeRng(opts.seed ?? 1), variant);
}

