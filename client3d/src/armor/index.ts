// The armor library: every armor piece in the game (and the planned ones from
// the story docs), in sets, made in code and fitted to the smooth character.
//
// How to use it in the game:
//   import { wearArmor } from "./armor";
//   const helm = wearArmor(hero, "helmet_steel", { variant: 1 }); // hero = createCharacter(...)
//   helm.remove();                                                   // take it off
//
// Pieces from the game use the game's item ids (helmet_bronze, platebody_leather...).
// "status" is Mike's review: only "approved" pieces (and their chosen
// variant) should go into the game. The Armor Gallery is where he reviews them.
import type { Character, CharacterRecipe } from "../character";
import { ARMOR, ARMOR_METAL, ArmorType, CLOTH_MANA_PER, METAL_SLOW_PER_BAR, SLOT_NAMES, SOFT_NAMES } from "../../../shared/gear";
import { METALS } from "../../../shared/tools";
import { SOFT_LEVEL } from "../../../shared/handicraft";
import { ArmorLook, LOOKS, LookId } from "./looks";
import { PIECE_VARIANTS, PieceKind, WornPiece, wearPiece } from "./pieces";

export { LOOKS } from "./looks";
export type { ArmorLook, LookId } from "./looks";
export { PIECE_VARIANTS } from "./pieces";
export type { PieceKind, WornPiece } from "./pieces";

export type ReviewStatus = "waiting" | "approved" | "changes";

export type ArmorSetId = "bronze" | "iron" | "steel" | "mithril" | "leather" | "cloth" | "aurelite" | "primeval" | "honours";

export interface ArmorSet {
  id: ArmorSetId;
  name: string;
  /** In the game today, or planned (in the story docs). */
  planned: boolean;
  about: string;
}

export const ARMOR_SETS: ArmorSet[] = [
  { id: "bronze", name: "Bronze", planned: false, about: "The first metal armor. Smithed from bronze bars at the anvil." },
  { id: "iron", name: "Iron", planned: false, about: "Darker and tougher. Smithing 15." },
  { id: "steel", name: "Steel", planned: false, about: "Bright, polished and strong. Smithing 30." },
  { id: "mithril", name: "Mithril", planned: false, about: "The best metal in the game today, with a faint blue glow. Smithing 60." },
  { id: "leather", name: "Leather", planned: false, about: "Light armor sewn at Rook's workbench. Doesn't slow you down." },
  { id: "cloth", name: "Cloth robes", planned: false, about: "Thin, but each piece adds mana and makes spells stronger." },
  { id: "aurelite", name: "Aurelite", planned: true, about: "Planned: a new metal above mithril, from Aurelite ore in the Sundered Crown." },
  { id: "primeval", name: "Primeval hide", planned: true, about: "Planned: the best leather, from the Crown's ancient beasts." },
  { id: "honours", name: "Cloaks and honours", planned: true, about: "Planned rewards from the story: rank cloaks, robes and gauntlets." },
];

export interface ArmorEntry {
  /** Game item id for pieces in the game ("helmet_bronze"), or a planned id. */
  id: string;
  name: string;
  set: ArmorSetId;
  piece: PieceKind;
  look: LookId;
  /** Extra pieces worn with it (a robe outfit is a top and a skirt). */
  with?: PieceKind[];
  planned: boolean;
  about?: string;
  /** Rows for the gallery's facts table. */
  facts: [string, string][];
  /** Mike's review. Updated from the Armor Gallery. */
  status: ReviewStatus;
  /** The style (variant) Mike chose for the game. */
  style: number;
}

const TYPE_PIECE: Record<ArmorType, PieceKind> = { helmet: "helmet", platebody: "platebody", platelegs: "platelegs", boots: "boots", shield: "shield" };
const METAL_SETS = ["bronze", "iron", "steel", "mithril"] as const;

function gameFacts(type: ArmorType, mat: (typeof METAL_SETS)[number] | "leather" | "cloth"): [string, string][] {
  const a = ARMOR[type];
  const pts = Math.round(a.points * ARMOR_METAL[mat] * 10) / 10;
  const rows: [string, string][] = [["Slot", SLOT_NAMES[a.slot]], ["Armor", String(pts)]];
  if (mat === "leather" || mat === "cloth") {
    rows.push(["Handicraft level", String(SOFT_LEVEL[mat][type] ?? "-")]);
    rows.push(["Made from", `${a.bars} ${mat}`]);
    if (mat === "cloth") rows.push(["Extra", `+${CLOTH_MANA_PER * a.bars} max mana, spells +3%`]);
    else rows.push(["Extra", "Doesn't slow you down"]);
  } else {
    rows.push(["Smithing level", String(METALS[mat].level)]);
    rows.push(["Made from", `${a.bars} ${METALS[mat].name.toLowerCase()} bar${a.bars > 1 ? "s" : ""}`]);
    rows.push(["Walking", `${Math.round(a.bars * METAL_SLOW_PER_BAR * 100)}% slower`]);
  }
  return rows;
}

const entries: ArmorEntry[] = [];
const TYPES: ArmorType[] = ["helmet", "platebody", "platelegs", "boots", "shield"];
for (const m of METAL_SETS)
  for (const t of TYPES)
    entries.push({ id: `${t}_${m}`, name: `${METALS[m].name} ${ARMOR[t].name.toLowerCase()}`, set: m, piece: TYPE_PIECE[t], look: m, planned: false, facts: gameFacts(t, m), status: "waiting", style: 0 });
for (const m of ["leather", "cloth"] as const)
  for (const t of TYPES) {
    const name = SOFT_NAMES[m][t];
    if (!name) continue;
    entries.push({ id: `${t}_${m}`, name, set: m, piece: TYPE_PIECE[t], look: m, planned: false, facts: gameFacts(t, m), status: "waiting", style: 0 });
  }
const SOFT_PLANNED: Record<ArmorType, string> = { helmet: "Primeval cap", platebody: "Primeval jerkin", platelegs: "Primeval chaps", boots: "Primeval boots", shield: "Primeval buckler" };
for (const t of TYPES) {
  entries.push({ id: `${t}_aurelite`, name: `Aurelite ${ARMOR[t].name.toLowerCase()}`, set: "aurelite", piece: TYPE_PIECE[t], look: "aurelite", planned: true, facts: [["Slot", SLOT_NAMES[ARMOR[t].slot]], ["In the game", "Planned (no numbers yet)"]], status: "waiting", style: 0 });
}
for (const t of TYPES) {
  entries.push({ id: `${t}_primeval`, name: SOFT_PLANNED[t], set: "primeval", piece: TYPE_PIECE[t], look: "primeval", planned: true, facts: [["Slot", SLOT_NAMES[ARMOR[t].slot]], ["In the game", "Planned (no numbers yet)"]], status: "waiting", style: 0 });
}
const honours: Omit<ArmorEntry, "set" | "planned" | "status" | "facts" | "style">[] = [
  { id: "outfit_plain_robe", name: "Plain robe", piece: "platebody", with: ["platelegs"], look: "plain", about: "What you wake up in on the shrine steps (Prologue: Awakening)." },
  { id: "cloak_ember", name: "Ember cloak", piece: "cloak", look: "ember", about: "Rank Ember: an orange cloak everyone sees (Prologue: Oath of the Flame)." },
  { id: "cloak_flame", name: "Flame cloak", piece: "cloak", look: "flame", about: "Rank Flame: a gold cloak." },
  { id: "cloak_silk", name: "Silk cloak", piece: "cloak", look: "silk", about: "From Warden Corvane for clearing the spiders (Act 2A: Webs Across the Path)." },
  { id: "gauntlets_halbrecht", name: "Halbrecht's gauntlets", piece: "gauntlets", look: "halbrecht", about: "From Warden Halbrecht for relighting the Greyspine Lightshrine (Act 2B)." },
  { id: "outfit_radiant", name: "Radiant robes", piece: "platebody", with: ["platelegs"], look: "radiant", about: "The ceremony outfit for the Radiance Ceremony (Act 2D)." },
  { id: "cloak_threadcut", name: "Thread-cut cloak", piece: "cloak", look: "threadcut", about: "For cutting your own thread: no more Soul Debt (Act 4A: Cut the Thread)." },
];
for (const h of honours) entries.push({ ...h, set: "honours", planned: true, facts: [["Worn on", h.piece === "cloak" ? "Back (new slot)" : h.piece === "gauntlets" ? "Hands (new slot)" : "Body and legs"], ["In the game", "Planned (story reward)"]], status: "waiting", style: 0 });

// Mike's reviews (Nov 23, from the Armor Gallery). Every piece is approved in
// its first style, except: shields use the Tower style for now ("maybe we will
// do some different shields that have different properties later"), and the
// bronze helmet, platebody and boots were changed after his notes (helmets
// come straight down, arms fully covered, boots redesigned) and he approved
// them too. The fixes apply to every metal.
const CHOSEN_STYLE: Record<string, number> = { shield_bronze: 2, shield_iron: 2, shield_steel: 2, shield_mithril: 2, shield_aurelite: 2 };
const WAITING = new Set<string>();
for (const e of entries) {
  e.status = WAITING.has(e.id) ? "waiting" : "approved";
  e.style = CHOSEN_STYLE[e.id] ?? 0;
}

export const ARMOR_ENTRIES: ArmorEntry[] = entries;
export const ARMOR_BY_ID: Record<string, ArmorEntry> = Object.fromEntries(entries.map((e) => [e.id, e]));

/** The style choices for an entry. */
export function variantsOf(e: ArmorEntry): readonly string[] {
  return PIECE_VARIANTS[e.piece][LOOKS[e.look].kind];
}
export function lookOf(e: ArmorEntry): ArmorLook {
  return LOOKS[e.look];
}

/** Put an armor entry on a character. remove() takes it off. */
export function wearArmor(c: Character, id: string, opts: { variant?: number } = {}): WornPiece {
  const e = ARMOR_BY_ID[id];
  if (!e) throw new Error(`No armor called ${id}`);
  opts = { variant: e.style, ...opts };
  const look = LOOKS[e.look];
  const worn = [wearPiece(c, e.piece, look, opts.variant ?? 0), ...(e.with ?? []).map((p) => wearPiece(c, p, look, opts.variant ?? 0))];
  return { parts: worn.flatMap((w) => w.parts), remove: () => worn.forEach((w) => w.remove()) };
}

/** Which body slots an entry covers (so the gallery can dress the character to suit). */
export function coversOf(e: ArmorEntry): PieceKind[] {
  return [e.piece, ...(e.with ?? [])];
}

/**
 * Change a character's clothes so armor sits well over them: no hat or hair
 * under a helmet, no tunic or robe hem over platelegs, plain shoes under boots.
 */
export function dressFor(recipe: Partial<CharacterRecipe>, covers: PieceKind[]): { recipe: Partial<CharacterRecipe>; hideHair: boolean } {
  const r = { ...recipe };
  const has = (p: PieceKind) => covers.includes(p);
  if (has("helmet")) {
    r.hat = "none";
    r.glasses = "none";
  }
  if (has("platelegs") || has("platebody")) {
    if (r.top === "robe" || r.top === "tunic" || r.top === undefined) r.top = "long";
    if (r.bottom !== "pants") r.bottom = "pants";
  }
  if (has("boots")) r.shoes = "shoes";
  if (has("gauntlets") && (r.top === "tank" || r.top === "tshirt")) r.top = "long";
  return { recipe: r, hideHair: has("helmet") };
}
