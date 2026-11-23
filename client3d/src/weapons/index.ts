// The weapon library: every weapon for the 3D game, in one list.
//
// How to use one in the game:
//   import { createWeapon } from "./weapons";
//   const sword = createWeapon("sword", { metal: "iron", wood: "oak" });
//   character.joints.handR.add(sword.held ?? sword.object);
//
// A weapon item id from the game ("sword_iron_oak") turns into options with
// optionsForItem(). Every weapon is built with the grip middle at (0,0,0)
// and the blade pointing up +Y (see parts.ts).
//
// "status" is Mike's review: only "approved" weapons should go into the game.
// The Weapon Gallery page is where Mike looks at each one and approves it.
import type { WeaponType } from "../../../shared/gear";
import { parseWeapon, WeaponItemId } from "../../../shared/gear";
import type { GemId } from "../../../shared/jewelry";
import { WeaponBuild, WeaponOptions, AttackMove, Hold } from "./types";
import { WeaponMetal, WeaponWood } from "./parts";
import {
  DAGGER_VARIANTS, GREATSWORD_VARIANTS, MACE_VARIANTS, SPEAR_VARIANTS, SWORD_VARIANTS,
  buildDagger, buildGreatsword, buildMace, buildSpear, buildSword,
} from "./melee";
import { ARROW_VARIANTS, BOW_VARIANTS, DART_VARIANTS, SLING_VARIANTS, buildArrows, buildBowWeapon, buildDarts, buildSling } from "./ranged";
import { STAFF_VARIANTS, buildStaff } from "./magic";
import {
  GOBLIN_VARIANTS, LIGHTFORGED_VARIANTS, SEVERING_VARIANTS, WARDEN_VARIANTS,
  buildGoblinDagger, buildLightforged, buildSevering, buildWarden,
} from "./story";

export type { WeaponBuild, WeaponOptions, AttackMove, Hold } from "./types";
export * from "./parts";

export type WeaponKind =
  | WeaponType
  | "arrows"
  | "warden"
  | "goblin_dagger"
  | "severing_blade"
  | "lightforged";

/** Mike's review of a weapon. */
export type ReviewStatus = "waiting" | "approved" | "changes";

export interface WeaponModel {
  id: WeaponKind;
  name: string;
  /** The game's weapon type, for its stats (shared/gear.ts). Story weapons say which kind they act like. */
  game?: WeaponType;
  /** In the game now, or only planned in the story docs. */
  inGame: boolean;
  about: string;
  /** Where you get it. */
  from: string;
  variants: readonly string[];
  /** How it's swung, for each variant (one entry: the same for all). */
  moves: AttackMove[];
  hold: Hold[];
  /** Which pickers make sense: head metal, handle wood, a staff's gem. */
  uses: { metal?: boolean; wood?: boolean; gem?: boolean };
  /** Mike's review. Updated from the Weapon Gallery. */
  status: ReviewStatus;
  /** The one design Mike picked for the game, if he chose just one. */
  chosen?: number;
  /** Mike's review note. */
  note?: string;
  build: (o: WeaponOptions) => WeaponBuild;
}

export const WEAPON_MODELS: Record<WeaponKind, WeaponModel> = {
  dagger: {
    id: "dagger", name: "Dagger", game: "dagger", inGame: true, status: "approved", chosen: 1, note: "Just the Curved one.", variants: DAGGER_VARIANTS, moves: ["stab"], hold: ["right"],
    uses: { metal: true, wood: true }, build: buildDagger,
    about: "Short, quick and light. The first weapon most Kindled ever hold.",
    from: "Smithing (1 head + 1 handle). Stone ones in every shop.",
  },
  sword: {
    id: "sword", name: "Sword", game: "sword", inGame: true, status: "approved", variants: SWORD_VARIANTS, moves: ["slash"], hold: ["right"],
    uses: { metal: true, wood: true }, build: buildSword,
    about: "A one-handed blade. Leaves the other hand free for a shield.",
    from: "Smithing at the anvil.",
  },
  mace: {
    id: "mace", name: "Mace", game: "mace", inGame: true, status: "approved", chosen: 1, note: "Just the Spiked one.", variants: MACE_VARIANTS, moves: ["smash"], hold: ["right"],
    uses: { metal: true, wood: true }, build: buildMace,
    about: "Slow and heavy. Brought down from overhead.",
    from: "Smithing at the anvil.",
  },
  spear: {
    id: "spear", name: "Spear", game: "spear", inGame: true, status: "approved", variants: SPEAR_VARIANTS, moves: ["stab"], hold: ["right"],
    uses: { metal: true, wood: true }, build: buildSpear,
    about: "Long reach: hits from 2 tiles away.",
    from: "Smithing at the anvil.",
  },
  greatsword: {
    id: "greatsword", name: "Two-handed sword", game: "greatsword", inGame: true, status: "approved", variants: GREATSWORD_VARIANTS, moves: ["sweep"], hold: ["both"],
    uses: { metal: true, wood: true }, build: buildGreatsword,
    about: "The biggest melee hit, swung with both hands. No shield.",
    from: "Smithing at the anvil.",
  },
  sling: {
    id: "sling", name: "Sling", game: "sling", inGame: true, status: "approved", note: "Looks fine; the swing may need work in the game.", variants: SLING_VARIANTS, moves: ["sling"], hold: ["right"],
    uses: { metal: true }, build: buildSling,
    about: "Whirl it round and let go. The metal is the shot it throws.",
    from: "Smithing. Stone ones in every shop.",
  },
  darts: {
    id: "darts", name: "Darts", game: "darts", inGame: true, status: "approved", variants: DART_VARIANTS, moves: ["throw"], hold: ["right"],
    uses: { metal: true, wood: true }, build: buildDarts,
    about: "Thrown fast, one after another. The quickest weapon there is.",
    from: "Smithing at the anvil.",
  },
  bow: {
    id: "bow", name: "Bow", game: "bow", inGame: true, status: "approved", variants: BOW_VARIANTS, moves: ["shoot"], hold: ["left"],
    uses: { wood: true }, build: buildBowWeapon,
    about: "The longest reach. The wood decides how hard it hits.",
    from: "Handicraft: 2 logs and a thread at Rook's workbench. Kael sells a pine one.",
  },
  arrows: {
    id: "arrows", name: "Arrows", game: "bow", inGame: true, status: "approved", variants: ARROW_VARIANTS, moves: ["shoot"], hold: ["left"],
    uses: { metal: true }, build: buildArrows,
    about: "A bow needs them. The tip sets the damage; about 1 in 3 can be picked up again.",
    from: "Handicraft: a pine log, a tip and 2 feathers make 10.",
  },
  staff: {
    id: "staff", name: "Staff", game: "staff", inGame: true, status: "approved", variants: STAFF_VARIANTS, moves: ["cast"], hold: ["right"],
    uses: { wood: true, gem: true }, build: buildStaff,
    about: "Fires bolts. Plain ones fire Firebolt; a gem from Enchanting changes the bolt.",
    from: "Handicraft (2 logs), then Enchanting at the altar for a gem.",
  },
  warden: {
    id: "warden", name: "Warden's weapon", game: "sword", inGame: false, status: "approved", variants: WARDEN_VARIANTS, moves: ["slash", "shoot", "cast"], hold: ["right", "left", "right"],
    uses: {}, build: buildWarden,
    about: "Kael's reward: a blade, a bow or a staff, whichever way you fight best. Wardens' green.",
    from: "Story: The Hollow Wolves (Act 1, Huntmaster Kael).",
  },
  goblin_dagger: {
    id: "goblin_dagger", name: "Goblin-forged dagger", game: "dagger", inGame: false, status: "approved", variants: GOBLIN_VARIANTS, moves: ["stab"], hold: ["right"],
    uses: {}, build: buildGoblinDagger,
    about: "Rough iron, a bone handle and a lucky tooth. Ugly, but it works.",
    from: "Story: Goblin Trouble (Act 2, Warden Halbrecht).",
  },
  severing_blade: {
    id: "severing_blade", name: "Severing Blade", game: "sword", inGame: false, status: "approved", variants: SEVERING_VARIANTS, moves: ["slash"], hold: ["right"],
    uses: {}, build: buildSevering,
    about: "Mithril, the Thornmother's fang, a cut gem and Ysolde's enchant. Its edge of light cuts Vael's threads.",
    from: "Story: The Severing Blade (Act 4, Ashbound path, Smith Brann).",
  },
  lightforged: {
    id: "lightforged", name: "Lightforged weapon", game: "sword", inGame: false, status: "approved", variants: LIGHTFORGED_VARIANTS, moves: ["slash", "smash", "cast"], hold: ["right"],
    uses: {}, build: buildLightforged,
    about: "White-gold, quenched in a filled soul gem. It shines a little too brightly.",
    from: "Story: Lightforged (Act 4, Lightkeeper path, undercroft forge).",
  },
};

export const WEAPON_KINDS = Object.keys(WEAPON_MODELS) as WeaponKind[];

export const DEFAULT_OPTIONS: WeaponOptions = { variant: 0, metal: "bronze", wood: "oak", gem: null };

/** Make a weapon. Leave out anything to get the default (variant 0, bronze, oak, no gem). */
export function createWeapon(kind: WeaponKind, opts: Partial<WeaponOptions> = {}): WeaponBuild {
  const model = WEAPON_MODELS[kind];
  const o: WeaponOptions = { ...DEFAULT_OPTIONS, ...opts };
  o.variant = Math.max(0, Math.min(model.variants.length - 1, o.variant));
  return model.build(o);
}

/** How a weapon is swung and held, for a variant. */
export const moveOf = (kind: WeaponKind, variant = 0): AttackMove => {
  const m = WEAPON_MODELS[kind].moves;
  return m[Math.min(variant, m.length - 1)];
};
export const holdOf = (kind: WeaponKind, variant = 0): Hold => {
  const h = WEAPON_MODELS[kind].hold;
  return h[Math.min(variant, h.length - 1)];
};

/** A game item ("sword_iron_oak", "staff_stone_yew") as weapon options. */
export function optionsForItem(item: WeaponItemId, gem: GemId | null = null): { kind: WeaponKind; opts: Partial<WeaponOptions> } {
  const { type, metal, wood } = parseWeapon(item);
  return { kind: type, opts: { metal: metal as WeaponMetal, wood: wood as WeaponWood, gem } };
}
