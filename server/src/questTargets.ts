// Where a quest step sends you, for steps that aren't "talk to someone":
// catch a minnow -> the nearest fishing spot, cook a stew -> the stove, sell
// a fish -> Tam, kill chickens -> the nearest chicken... These become 📍
// spots on the maps, and the gold arrow at your feet points to the nearest
// one, so there's always somewhere to head for (report #30).
import { DOORS, MAP, MAP_HEIGHT, MAP_NODES, MAP_WIDTH, areaAt } from "../../shared/map";
import { NPCS } from "../../shared/npcs";
import { RESOURCES, RESOURCE_FOR_ITEM, ResourceId, isDigPatch, isFishingSpot } from "../../shared/foraging";
import type { QuestStep } from "../../shared/quests";
import type { SkillId } from "../../shared/disciplines";
import type { ItemId } from "../../shared/items";

export interface Spot { x: number; y: number; label: string }
interface Pt { x: number; y: number }

/** Every fishing spot, tree, rock and dig patch, found once. */
let nodes: { fishing: Pt[]; dig: Pt[]; byResource: Map<ResourceId, Pt[]> } | null = null;
function allNodes() {
  if (nodes) return nodes;
  nodes = { fishing: [], dig: [], byResource: new Map() };
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (isFishingSpot(x, y)) nodes.fishing.push({ x, y });
      else if (isDigPatch(x, y)) nodes.dig.push({ x, y });
      const t = MAP[y][x];
      const r = MAP_NODES[y]?.[x];
      if ((t === "tree" || t === "rock" || isFishingSpot(x, y)) && r) {
        if (!nodes.byResource.has(r)) nodes.byResource.set(r, []);
        nodes.byResource.get(r)!.push({ x, y });
      }
    }
  }
  return nodes;
}

/** Where a place is, as seen from outdoors (inside a building: its front door). */
function outside(p: Pt): Pt {
  const a = areaAt(p.x, p.y);
  if (!a || a.kind === "outdoor") return p;
  const door = DOORS.find((d) => d.area === a.id && areaAt(d.x, d.y)?.kind === "outdoor");
  return door ?? p;
}

function nearest(from: Pt, list: Pt[]): Pt | null {
  const f = outside(from);
  let best: Pt | null = null, bd = Infinity;
  for (const p of list) {
    const o = outside(p);
    const d = (o.x - f.x) ** 2 + (o.y - f.y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

const STATION_FOR: Partial<Record<SkillId, string>> = {
  cooking: "stove", smelting: "furnace", smithing: "anvil", handicraft: "workbench", alchemy: "alchemy_table", enchanting: "altar",
};
const npcAt = (id: string): Pt | null => { const n = NPCS.find((m) => m.id === id); return n ? { x: n.x, y: n.y } : null; };

/**
 * The places a step sends you to (empty if it's done in your bag, like eating or equipping).
 * `levelOf` is your level in a skill, so you're sent to trees and rocks you can actually use.
 */
export function stepSpots(step: QuestStep, me: Pt, levelOf: (s: SkillId) => number, monsters: { kind: string; x: number; y: number; alive: boolean }[], have: (item: ItemId) => number): Spot[] {
  const g = step.goal as { kind: string; skill?: SkillId; resource?: ResourceId; monster?: string; items?: Partial<Record<ItemId, number>>; tool?: string };
  const gatherSpot = (skill: SkillId, resource?: ResourceId): Spot | null => {
    const n = allNodes();
    if (skill === "fishing") {
      const list = resource && resource !== "minnow" ? (n.byResource.get(resource) ?? []).filter((p) => isFishingSpot(p.x, p.y)) : n.fishing;
      const at = nearest(me, list.length ? list : n.fishing);
      return at && { ...at, label: resource && resource !== "minnow" ? RESOURCES[resource].node : "Fish here" };
    }
    if (skill === "foraging") { const at = nearest(me, n.dig); return at && { ...at, label: "Dig patch" }; }
    const ids = resource ? [resource] : (Object.keys(RESOURCES) as ResourceId[]).filter((r) => RESOURCES[r].skill === skill && !RESOURCES[r].gem && RESOURCES[r].level <= Math.max(1, levelOf(skill)));
    const at = nearest(me, ids.flatMap((r) => n.byResource.get(r) ?? []));
    if (!at) return null;
    const r = MAP_NODES[at.y][at.x] as ResourceId;
    return { ...at, label: RESOURCES[r]?.node ?? "" };
  };
  const station = (skill: SkillId): Spot | null => {
    const id = STATION_FOR[skill];
    const at = id && npcAt(id);
    const n = id && NPCS.find((m) => m.id === id);
    return at && n ? { ...at, label: n.name } : null;
  };
  const person = (id: string, label: string): Spot | null => { const at = npcAt(id); return at && { ...at, label }; };
  let s: Spot | null = null;
  switch (g.kind) {
    case "gather": s = gatherSpot(g.skill ?? "fishing", g.resource); break;
    case "toolBreaks": s = g.tool === "rod" ? gatherSpot("fishing") : g.tool === "axe" ? gatherSpot("woodcutting") : g.tool === "pickaxe" ? gatherSpot("mining") : null; break;
    case "skillLevel":
      s = g.skill && STATION_FOR[g.skill] ? station(g.skill) : g.skill && ["fishing", "woodcutting", "mining", "foraging"].includes(g.skill) ? gatherSpot(g.skill) : null;
      break;
    case "craft": s = g.skill ? station(g.skill) : null; break;
    case "enchant": s = station("enchanting"); break;
    case "sell": case "buy": s = person("tam", "Shopkeeper Tam"); break;
    case "repair": s = person("repairer", "Repairer Oswin"); break;
    case "plot": case "plant": case "harvest": s = person("odo", "Farmer Odo's fields"); break;
    case "track": case "bounty": s = person("board", "Bounty board"); break;
    case "have": {
      // The first thing you're still short of: where it comes from.
      const want = Object.entries(g.items ?? {}).find(([it, n]) => have(it as ItemId) < (n ?? 0));
      const r = want && RESOURCE_FOR_ITEM[want[0] as ItemId];
      if (r) s = gatherSpot(RESOURCES[r].skill, r);
      break;
    }
    case "kill": {
      const live = monsters.filter((m) => m.alive && m.kind === g.monster);
      const at = nearest(me, live);
      if (at) s = { x: at.x, y: at.y, label: "" };
      break;
    }
  }
  return s ? [s] : [];
}
