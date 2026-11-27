// Shared helpers, constants and login bookkeeping for the game room.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { type } from "@colyseus/schema";
import { MAP, MAP_HEIGHT, MAP_WIDTH, TICK_MS } from "../../../shared/map";
import { RESOURCES, RESOURCE_FOR_ITEM, ResourceId } from "../../../shared/foraging";
import { GatherSkill } from "../../../shared/disciplines";
import { MonsterId, POTION_ID } from "../../../shared/combat";
import { CombatStyle, isArmor, isWeapon } from "../../../shared/gear";
import { ToolType, isTool, Metal } from "../../../shared/tools";
import { ItemId } from "../../../shared/items";
import { ArrowId, arrowId } from "../../../shared/handicraft";
import { STAMINA_REGEN_MS, isFood } from "../../../shared/cooking";
import { Account, store } from "../storage";
import type { WorldRoom } from "../WorldRoom";

/** Arrows a bow shoots, best tip first. */
export const ARROW_ORDER: ArrowId[] = (["mithril", "steel", "iron", "bronze"] as Metal[]).map(arrowId);
/** What a stone sold for, before stone was taken out of the game. Old saves get this many coins for each one. */
export const STONE_PRICE = 2;

export const STEP_LOOP_MS = 50; // how often the server checks whether someone should take a step
export const AUTOSAVE_TICKS = 100; // 100 x 0.6s = once a minute
export const MIN_SAVE_GAP_MS = 10_000; // "important" saves happen right away, but at most every 10s per player
export const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,11}$/;
export const MIN_PASSWORD = 6;
/** How many of a stack to sell or move: a whole number from 1 up, or everything if left out. */
export const wantCount = (count: unknown) => (Number.isInteger(count) && (count as number) >= 1 ? (count as number) : Infinity);
export const CRAFT_TICKS = 3; // one smelt, smith or cook every 3 ticks (1.8s); crafting is about success, not speed
export const REGEN_TICKS = Math.round(STAMINA_REGEN_MS / TICK_MS); // 50 ticks = 30s per stamina
// For automated play-tests only (never set on Render): every gathering tick gets an item.
export const FAST_GATHER_FOR_TESTS = process.env.RPG_FAST_GATHER === "1";
/** For testing day and night: shift the world's clock by this many milliseconds. */
export const CLOCK_SHIFT_MS = Number(process.env.RPG_CLOCK_SHIFT_MS) || 0;
/** The world's clock (day and night are worked out from it, shared/daynight.ts). */
/** The story's stations: lanterns and shrines (shared/story.ts). */
export const STORY_STATIONS = new Set<string>(["west_shrine", "thorn_shrine", ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`lantern_${n}`, `round_${n}`])]);
export const worldNow = () => Date.now() + CLOCK_SHIFT_MS;

// Shared by every room on this server process.
export const online = new Set<string>(); // username keys currently logged in
export const pendingSaves = new Map<string, Promise<void>>(); // logout saves still being written
export const failedLogins = new Map<string, { count: number; until: number }>();
// Players whose connection dropped (phone switched apps, Wi-Fi blip). They get
// RECONNECT_SECONDS to come back as if nothing happened before being logged out.
export const RECONNECT_SECONDS = 120;
export const waitingToReconnect = new Map<string, { reject: Function }>();
// The login log (the admin's /admin/logins page): which log line each connected player's session is.
export const loginLines = new Map<string, Promise<number | null>>(); // sessionId -> login log id

/** A short name for the player's browser and computer, from its user agent, e.g. "Chrome on Windows". */
export function deviceName(userAgent: string | string[] | undefined): string {
  const ua = String(userAgent ?? "");
  if (!ua) return "unknown";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "a browser";
  const system = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "";
  return system ? `${browser} on ${system}` : browser;
}

/** Add a line to the login log without ever holding up (or breaking) a login. */
export function logLogin(username: string, outcome: string, device: string): Promise<number | null> {
  return store.addLogin({ username: username.slice(0, 40), outcome, device }).catch((err) => {
    console.error("Login log failed:", err.message);
    return null;
  });
}
export function logLogout(sessionId: string, how: string) {
  const line = loginLines.get(sessionId);
  loginLines.delete(sessionId);
  return line?.then((id) => id === null ? undefined : store.endLogin(id, how))
    .catch((err) => console.error("Login log failed:", err.message));
}

/** What onAuth hands to onJoin (client.auth): the account, plus a little about this login for the log. */
export type AuthedAccount = Account & { isNew?: boolean; device?: string };

export const CARDINAL = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Things that can count toward a tutorial step. */
export type QuestEvent =
  | { kind: "gather"; skill: GatherSkill; resource: ResourceId; withTool: boolean }
  | { kind: "toolBreak"; tool: ToolType }
  | { kind: "craft"; item: ItemId; worked: boolean }
  | { kind: "eat"; item: ItemId }
  | { kind: "sell"; item: ItemId }
  | { kind: "buy"; item: ItemId }
  | { kind: "repair" }
  | { kind: "trash"; item: ItemId }
  | { kind: "kill"; monster: MonsterId; style?: CombatStyle }
  | { kind: "drink" }
  | { kind: "enchant" }
  | { kind: "track" }
  | { kind: "bounty" }
  | { kind: "plot" }
  | { kind: "plant" }
  | { kind: "harvest" };

/** Where each crafting skill is done. */
export const STATION_FOR = { smelting: "furnace", smithing: "anvil", cooking: "stove", handicraft: "workbench", alchemy: "alchemy_table" } as const;

export const isRock = (x: number, y: number) =>
  y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && MAP[y][x] === "rock";
export const isTree = (x: number, y: number) =>
  y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && MAP[y][x] === "tree";

/** "a bronze bar" / "an iron bar". */
export const aOr = (word: string) => /(tongs|platelegs|boots)\b/.test(word) ? `a pair of ${word}` : `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
/** "2 bronze bars", "3 health potions" (names already plural, like "Pine logs", stay as they are). */
export const plural = (name: string) => /[a-rt-z]$/i.test(name) ? `${name.toLowerCase()}s` : name.toLowerCase();

/** Where an item goes when the bag is sorted (lower first). */
export function sortGroup(item: ItemId): number {
  if (isTool(item)) return 0;
  if (isWeapon(item)) return 1;
  if (isArmor(item)) return 2;
  if (isFood(item)) return 3;
  if (item === POTION_ID) return 4;
  if (item.endsWith("_bar")) return 5;
  const r = RESOURCE_FOR_ITEM[item];
  if (r) return { woodcutting: 6, mining: 7, fishing: 8 }[RESOURCES[r].skill as "woodcutting" | "mining" | "fishing"] ?? 9;
  return 10;
}

/** "chop Oak trees", "mine Copper rocks", "fish at Trout spots": for messages. */
export function verbFor(id: ResourceId) {
  const r = RESOURCES[id];
  if (r.skill === "woodcutting") return `chop ${r.node}s`;
  if (r.skill === "mining") return `mine ${r.node}s`;
  if (r.skill === "foraging") return "dig";
  return id === "minnow" ? "catch Minnows" : `fish at ${r.node}s`;
}

// Every world room running on this server, so a bug report can say who sent it.
export const rooms = new Set<WorldRoom>();

/**
 * For bug reports: the logged-in player behind a connection (the client sends
 * its room session id), as the server sees them. Null if nobody matches.
 */
export function playerForReport(sessionId: string) {
  for (const room of rooms) {
    const info = room.reportInfo(sessionId);
    if (info) return info;
  }
  return null;
}
