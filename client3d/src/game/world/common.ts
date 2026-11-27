// Sizes and limits used across the 3D game.
// Part of the 3D game (client3d/src/game/world.ts), split out to keep each file to one job.


export const MIN_DIST = 7;
export const MAX_DIST = 42;
export const CAM_KEY = "rpg3d.camera";
export const TAP_SLOP = 10;
/** The keys that walk you: forward, left, back and right (by position, so other keyboard layouts work too). */
export const WALK_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD"];
/** People, monsters and stations further than this (metres, each way) aren't drawn. */
export const CULL_M = 60;
/** At most this many lamps light the scene at once (the nearest ones), so it stays fast. */
export const MAX_LAMPS = 6;
/** The opening scene (version 0.21): when Keeper Celene starts talking, in seconds. */
export const INTRO_TALK = 12.2;
