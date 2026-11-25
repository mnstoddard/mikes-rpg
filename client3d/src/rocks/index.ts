// The rock library: every mining rock for the 3D game, in one list.
//
// How to use one in the game:
//   import { createRock } from "./rocks";
//   const rock = createRock("copper", { seed: 42, variant: 0 });
//   scene.add(rock.object);
//   // every frame:     rock.update(dt, time);
//   // each ore mined:  rock.hit();  then rock.deplete() when it runs out
//   // respawn:         rock.refill();
//
// "status" is Mike's review from the Ore Gallery: only "approved" rocks go into the game.
import type { ResourceId } from "../../../shared/foraging";
import { makeRng } from "../trees/common";
import type { ReviewStatus } from "../trees";
import { OreLook, ROCK_SHAPES, Rock, buildRock } from "./rock";

export type { Rock, RockState } from "./rock";
export { ROCK_SHAPES, setRockEnvironment } from "./rock";

export type RockKind =
  | "copper" | "tin" | "iron" | "coal" | "silver" | "gold" | "mithril" | "platinum" | "iridium"
  | "amethyst" | "topaz" | "soulstone" | "emerald" | "sapphire" | "ruby"
  | "aurelite" | "wellglass";

export interface RockType {
  id: RockKind;
  name: string;
  /** "metal" ores are smelted into bars; "gem" rocks give rough gems; "planned" ones aren't in the game's rules yet. */
  group: "metal" | "gem" | "planned";
  /** The mining resource it gives (shared/foraging.ts), if it's in the game. */
  resource?: ResourceId;
  about: string;
  /** Where you find it in Elderra. */
  found: string;
  look: OreLook;
  status: ReviewStatus;
}

const CAVE = 0x6e6878; // crystal cave rock: a cool purple-grey
const GREY = 0x8f8a82;

export const ROCK_TYPES: Record<RockKind, RockType> = {
  // ---- Metals ----
  copper: {
    id: "copper", name: "Copper", group: "metal", resource: "copper", status: "waiting",
    about: "Orange nuggets with green patina. Makes bronze, with tin.",
    found: "The quarry (Mining level 1).",
    look: { host: GREY, deposit: "nugget", colors: [0xd9822b, 0xe39a4a, 0xc06a22], metalness: 0.6, roughness: 0.35, count: 8, glints: 4, flecks: 0x4fae8c },
  },
  tin: {
    id: "tin", name: "Tin", group: "metal", resource: "tin", status: "waiting",
    about: "Dull silvery-white lumps. Makes bronze, with copper.",
    found: "The quarry.",
    look: { host: GREY, deposit: "nugget", colors: [0xc4cbce, 0xaab2b6], metalness: 0.5, roughness: 0.55, count: 8 },
  },
  iron: {
    id: "iron", name: "Iron", group: "metal", resource: "iron", status: "waiting",
    about: "Rusty red-brown ore. The start of real weapons and armor.",
    found: "The Greyspine hills and the old mine.",
    look: { host: 0x857a70, deposit: "nugget", colors: [0x8e3b2a, 0xa4492f, 0x6e2e22], metalness: 0.35, roughness: 0.7, count: 9, flecks: 0xb0603a },
  },
  coal: {
    id: "coal", name: "Coal", group: "metal", resource: "coal", status: "waiting",
    about: "Shiny black chunks in dark rock. Fuel for smelting steel and better.",
    found: "The Greyspine hills and the old mine.",
    look: { host: 0x55524e, deposit: "chunk", colors: [0x1a1a1a, 0x262626], metalness: 0.2, roughness: 0.25, count: 9, size: 0.2, glints: 3 },
  },
  silver: {
    id: "silver", name: "Silver", group: "metal", resource: "silver", status: "waiting",
    about: "Bright, shiny silver nuggets. For jewelry.",
    found: "The old mine.",
    look: { host: 0x7d7a78, deposit: "nugget", colors: [0xd6dbe0, 0xc0c6cc], metalness: 0.9, roughness: 0.2, count: 8, glints: 6 },
  },
  gold: {
    id: "gold", name: "Gold", group: "metal", resource: "gold", status: "waiting",
    about: "Gleaming gold nuggets. For jewelry, and worth a lot.",
    found: "The old mine.",
    look: { host: 0x8a7f72, deposit: "nugget", colors: [0xf5c542, 0xe8b02e, 0xffd866], metalness: 0.95, roughness: 0.25, count: 8, glints: 7 },
  },
  mithril: {
    id: "mithril", name: "Mithril", group: "metal", resource: "mithril", status: "waiting",
    about: "Blue metal with a soft glow. The best metal tier in the game today.",
    found: "Deep in the old mine.",
    look: { host: 0x5f6672, deposit: "nugget", colors: [0x3fa9f5, 0x5fbfff, 0x2a8fd9], metalness: 0.8, roughness: 0.25, glow: 0x1a6fc0, glowStrength: 0.45, count: 8, glints: 5 },
  },
  platinum: {
    id: "platinum", name: "Platinum", group: "metal", resource: "platinum", status: "waiting",
    about: "Big pale metal plates in purple cave rock.",
    found: "The crystal cave, through the spider cave.",
    look: { host: CAVE, deposit: "nugget", colors: [0xcfcecb, 0xbabdc0], metalness: 0.95, roughness: 0.15, count: 6, size: 0.24, glints: 6 },
  },
  iridium: {
    id: "iridium", name: "Iridium", group: "metal", resource: "iridium", status: "waiting",
    about: "Rare violet metal that shimmers. The hardest ore to mine.",
    found: "The crystal cave.",
    look: { host: CAVE, deposit: "nugget", colors: [0xb18cff, 0x9a72f0, 0xc9a8ff], metalness: 0.85, roughness: 0.2, glow: 0x6a3fd0, glowStrength: 0.35, count: 7, glints: 6 },
  },

  // ---- Gems ----
  amethyst: {
    id: "amethyst", name: "Amethyst", group: "gem", resource: "amethyst", status: "waiting",
    about: "Purple crystals. Gives rough amethysts in different sizes.",
    found: "The crystal cave.",
    look: { host: CAVE, deposit: "crystal", colors: [0x9b59b6, 0xb57bd0], count: 5, size: 0.2 },
  },
  topaz: {
    id: "topaz", name: "Topaz", group: "gem", resource: "topaz", status: "waiting",
    about: "Warm golden-orange crystals.",
    found: "The crystal cave.",
    look: { host: CAVE, deposit: "crystal", colors: [0xf5b041, 0xf8c766], count: 5, size: 0.2 },
  },
  soulstone: {
    id: "soulstone", name: "Emberstone vein", group: "gem", resource: "soulstone", status: "waiting",
    about: "Pale blue crystals that glow, with sparks drifting off. Used to trap souls.",
    found: "The crystal cave.",
    look: { host: 0x4f5566, deposit: "crystal", colors: [0x5dade2, 0x8fd0f5], glow: 0x3a9ae0, glowStrength: 0.5, count: 6, size: 0.19, motes: 12 },
  },
  emerald: {
    id: "emerald", name: "Emerald", group: "gem", resource: "emerald", status: "waiting",
    about: "Deep green crystals.",
    found: "The crystal cave.",
    look: { host: CAVE, deposit: "crystal", colors: [0x2ecc71, 0x1fa85a], count: 5, size: 0.2 },
  },
  sapphire: {
    id: "sapphire", name: "Sapphire", group: "gem", resource: "sapphire", status: "waiting",
    about: "Rich blue crystals.",
    found: "The crystal cave.",
    look: { host: CAVE, deposit: "crystal", colors: [0x2e5fd6, 0x4a7ae8], count: 5, size: 0.2 },
  },
  ruby: {
    id: "ruby", name: "Ruby", group: "gem", resource: "ruby", status: "waiting",
    about: "Glowing red crystals. The best gem in the game today.",
    found: "The crystal cave.",
    look: { host: CAVE, deposit: "crystal", colors: [0xe0245e, 0xf04a78], glow: 0xc0103a, glowStrength: 0.35, count: 5, size: 0.21 },
  },

  // ---- Planned (story docs) ----
  aurelite: {
    id: "aurelite", name: "Aurelite", group: "planned", status: "waiting",
    about: "A new metal above mithril: white-gold ore with glowing sun veins. Aurelite tools, weapons and armor.",
    found: "The Sundered Crown (not in the game's rules yet).",
    look: { host: 0xb3a68c, deposit: "nugget", colors: [0xf3dc9a, 0xf0c860, 0xe8bc50], metalness: 0.9, roughness: 0.2, glow: 0xffb020, glowStrength: 0.3, count: 9, glints: 7, motes: 10 },
  },
  wellglass: {
    id: "wellglass", name: "Wellglass", group: "planned", status: "waiting",
    about: "Crystals where the Wellspring leaks. The best soul gems and enchants.",
    found: "The Sundered Crown (not in the game's rules yet).",
    look: { host: 0x3e4a58, deposit: "crystal", colors: [0x5fe0d2, 0x86eee2, 0x45c4bb], glow: 0x2fd8c8, glowStrength: 0.45, count: 6, size: 0.27, motes: 16 },
  },
};

export const ROCK_KINDS = Object.keys(ROCK_TYPES) as RockKind[];

/** Make a rock. The same seed and shape always give the same rock. Shapes: 0 Boulder, 1 Cluster, 2 Outcrop. */
export function createRock(kind: RockKind, opts: { seed?: number; variant?: number } = {}): Rock {
  const rng = makeRng(opts.seed ?? 1);
  const shape = Math.max(0, Math.min(ROCK_SHAPES.length - 1, opts.variant ?? 0));
  return buildRock(rng, ROCK_TYPES[kind].look, shape);
}
