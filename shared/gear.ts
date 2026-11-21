// Gear: weapons and armor, worn in the gear strip (separate from the tool belt).
//
// Weapons are a head (stone or a metal bar) plus a wooden handle, like tools.
// Armor is all metal: 1 to 3 bars, no wood. Both are smithed at the anvil and
// wear out with use, like tools.
//
// No imports at runtime, so items.ts can build every gear item from this.
import type { Material, Metal, Wood } from "./tools";

export type CombatStyle = "melee" | "ranged" | "magic";
export type WeaponType = "dagger" | "sword" | "mace" | "spear" | "greatsword" | "sling" | "darts" | "bow" | "staff";
export type ArmorType = "helmet" | "platebody" | "platelegs" | "boots" | "shield";
export type GearType = WeaponType | ArmorType;
export type GearSlot = "weapon" | "offhand" | "head" | "body" | "legs" | "feet";
export type WeaponItemId = `${WeaponType}_${Material}_${Wood}`;
export type ArmorItemId = `${ArmorType}_${Metal}`;
export type GearItemId = WeaponItemId | ArmorItemId;

export interface WeaponDef {
  name: string;
  icon: string;
  style: CombatStyle;
  /** Melee / Ranged / Magic level needed to hold it. */
  level: number;
  /** Biggest hit with a stone one (better metal adds to it). Staffs: spells decide the damage. */
  maxHit: number;
  /** Ticks between attacks (1 tick = 0.6s). */
  speed: number;
  /** How far away you can hit from (1 = next to it). */
  range: number;
  /** Takes both hands: no shield. */
  twoHanded?: boolean;
}

export const WEAPONS: Record<WeaponType, WeaponDef> = {
  dagger:     { name: "Dagger",          icon: "🔪", style: "melee",  level: 1,  maxHit: 2, speed: 3, range: 1 },
  sword:      { name: "Sword",           icon: "🗡️", style: "melee",  level: 5,  maxHit: 3, speed: 4, range: 1 },
  mace:       { name: "Mace",            icon: "🏏", style: "melee",  level: 10, maxHit: 5, speed: 5, range: 1 },
  spear:      { name: "Spear",           icon: "🔱", style: "melee",  level: 15, maxHit: 5, speed: 4, range: 2 },
  greatsword: { name: "Two-handed sword", icon: "⚔️", style: "melee",  level: 20, maxHit: 8, speed: 6, range: 1, twoHanded: true },
  sling:      { name: "Sling",           icon: "🪃", style: "ranged", level: 1,  maxHit: 2, speed: 4, range: 4 },
  darts:      { name: "Darts",           icon: "🎯", style: "ranged", level: 5,  maxHit: 2, speed: 2, range: 3 },
  bow:        { name: "Bow",             icon: "🏹", style: "ranged", level: 10, maxHit: 4, speed: 5, range: 6, twoHanded: true },
  staff:      { name: "Staff",           icon: "🪄", style: "magic",  level: 1,  maxHit: 0, speed: 5, range: 5 },
};
export const WEAPON_TYPES = Object.keys(WEAPONS) as WeaponType[];

/** Better metal hits harder: added to the weapon's (or spell's) biggest hit. */
export const METAL_DAMAGE: Record<Material, number> = { stone: 0, bronze: 1, iron: 2, steel: 3, mithril: 5 };

export interface ArmorDef {
  name: string;
  icon: string;
  slot: GearSlot;
  /** Bars it takes to make. */
  bars: number;
  /** Armor points from a bronze one; better metal multiplies it (see ARMOR_METAL). */
  points: number;
}

export const ARMOR: Record<ArmorType, ArmorDef> = {
  helmet:    { name: "Helmet",    icon: "⛑️", slot: "head",    bars: 1, points: 1 },
  platebody: { name: "Platebody", icon: "🦺", slot: "body",    bars: 3, points: 3 },
  platelegs: { name: "Platelegs", icon: "👖", slot: "legs",    bars: 2, points: 2 },
  boots:     { name: "Boots",     icon: "🥾", slot: "feet",    bars: 1, points: 1 },
  shield:    { name: "Shield",    icon: "🛡️", slot: "offhand", bars: 2, points: 2 },
};
export const ARMOR_TYPES = Object.keys(ARMOR) as ArmorType[];

/** Armor points per piece: points × this. A full bronze set is 18, full mithril 54. */
export const ARMOR_METAL: Record<Metal, number> = { bronze: 2, iron: 3, steel: 4, mithril: 6 };

export const GEAR_SLOTS: GearSlot[] = ["weapon", "offhand", "head", "body", "legs", "feet"];
export const SLOT_NAMES: Record<GearSlot, string> = { weapon: "Weapon", offhand: "Shield", head: "Head", body: "Body", legs: "Legs", feet: "Feet" };
export const SLOT_ICONS: Record<GearSlot, string> = { weapon: "🗡️", offhand: "🛡️", head: "⛑️", body: "🦺", legs: "👖", feet: "🥾" };

const WEAPON_SET = new Set<string>(WEAPON_TYPES);
const ARMOR_SET = new Set<string>(ARMOR_TYPES);
const MATERIAL_NAMES = new Set(["stone", "bronze", "iron", "steel", "mithril"]);
const METAL_NAMES = new Set(["bronze", "iron", "steel", "mithril"]);
const WOOD_NAMES = new Set(["pine", "oak", "birch", "maple", "yew", "ironwood", "elderwood"]);

/** The plain id of an enchanted item (see shared/tools.ts baseItem). */
const plain = (item: string) => { const i = item.indexOf("+"); return i < 0 ? item : item.slice(0, i); };

export function isWeapon(item: string | null | undefined): item is WeaponItemId {
  if (!item) return false;
  const [t, m, w, extra] = plain(item).split("_");
  return WEAPON_SET.has(t) && MATERIAL_NAMES.has(m) && WOOD_NAMES.has(w) && extra === undefined;
}
export function isArmor(item: string | null | undefined): item is ArmorItemId {
  if (!item) return false;
  const [t, m, extra] = plain(item).split("_");
  return ARMOR_SET.has(t) && METAL_NAMES.has(m) && extra === undefined;
}
export const isGear = (item: string | null | undefined): item is GearItemId => isWeapon(item) || isArmor(item);

export function parseWeapon(item: WeaponItemId): { type: WeaponType; metal: Material; wood: Wood } {
  const [type, metal, wood] = plain(item).split("_");
  return { type: type as WeaponType, metal: metal as Material, wood: wood as Wood };
}
export function parseArmor(item: ArmorItemId): { type: ArmorType; metal: Metal } {
  const [type, metal] = plain(item).split("_");
  return { type: type as ArmorType, metal: metal as Metal };
}
export const gearType = (item: GearItemId): GearType => plain(item).split("_")[0] as GearType;
export const gearSlot = (item: GearItemId): GearSlot => isWeapon(item) ? "weapon" : ARMOR[parseArmor(item).type].slot;

export const weaponId = (type: WeaponType, metal: Material, wood: Wood): WeaponItemId => `${type}_${metal}_${wood}`;
export const armorId = (type: ArmorType, metal: Metal): ArmorItemId => `${type}_${metal}`;

/** One piece of gear being worn, with how many uses it has left. */
export interface WornGear { item: GearItemId; durability: number }
export type Gear = Record<GearSlot, WornGear | null>;
export const emptyGear = (): Gear => ({ weapon: null, offhand: null, head: null, body: null, legs: null, feet: null });
