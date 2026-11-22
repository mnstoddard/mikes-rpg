// The shapes every weapon file shares.
import type * as THREE from "three";
import type { GemId } from "../../../shared/jewelry";
import type { WeaponMetal, WeaponWood } from "./parts";

/** How a weapon is swung (the character's animation). */
export type AttackMove =
  | "slash" // a sword cut
  | "stab" // a quick dagger jab or spear thrust
  | "smash" // a mace over the head
  | "sweep" // a big two-handed swing
  | "throw" // darts
  | "sling" // whirl and let go
  | "shoot" // draw a bow
  | "cast"; // point a staff, a bolt flies

/** Which hand holds it. A bow sits in the left hand; the right draws the string. */
export type Hold = "right" | "left" | "both";

export interface WeaponOptions {
  /** Which design (e.g. Sword: Arming, Broad, Leaf). */
  variant: number;
  /** The head's metal. Ignored by bows and staffs (all wood). */
  metal: WeaponMetal;
  /** The handle's wood (or the whole bow or staff). */
  wood: WeaponWood;
  /** Staffs only: the enchantment's gem, or null for a plain staff. */
  gem: GemId | null;
}

/** What a weapon builder gives back. Grip middle at (0,0,0), pointing up +Y. */
export interface WeaponBuild {
  object: THREE.Group;
  /** Rough length from end to end, in metres (a person is 1.8). */
  length: number;
  /** The tip (where slashes leave a trail and bolts start), in the weapon's own space. */
  tip: THREE.Vector3;
  /** What goes in the hand, if not `object` (arrows are held on a bow). */
  held?: THREE.Group;
  /** What flies when it's used (an arrow, a dart, a sling stone, a bolt). */
  projectile?: () => THREE.Object3D;
  /** Bows: pull the string back, 0 (resting) to 1 (full draw), with an arrow on it. */
  draw?: (amount: number) => void;
  /** Colour of a staff's bolt. */
  boltColor?: number;
}
