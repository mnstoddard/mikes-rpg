// The Tree Gallery: every tree type, with its variants and a dead version.
import { RESOURCES } from "../../../shared/foraging";
import { ITEMS } from "../../../shared/items";
import { TICK_MS } from "../../../shared/map";
import { TREE_KINDS, TREE_TYPES, Tree, createTree } from "../trees";
import { runGallery } from "./app";

runGallery({
  kinds: TREE_KINDS,
  info(k) {
    const t = TREE_TYPES[k];
    const res = t.resource ? RESOURCES[t.resource] : null;
    return {
      name: t.name,
      meta: res ? `Woodcutting ${res.level}` : "Planned",
      swatch: res?.color ?? 0xe8b84a,
      about: t.about,
      whereLabel: "Where it grows",
      where: t.grows,
      stats: res
        ? [
            ["Woodcutting level", String(res.level)],
            ["XP per log", String(res.xp)],
            ["Gives", ITEMS[res.item]?.name ?? res.item],
            ["Grows back in", `${Math.round((res.respawnTicks * TICK_MS) / 1000)} s`],
          ]
        : [["In the game", "Not yet (planned)"]],
      variants: t.variants,
    };
  },
  create: (k, seed, variant, dead) => createTree(k, { seed, variant, dead }),
  verb: "Chop",
  hitsToFinish: 3,
  hit: (t) => (t as Tree).hit(),
  finish: (t) => (t as Tree).fell(),
  restore: (t) => (t as Tree).regrow(),
  readyState: "standing",
  doneState: "stump",
  busyLabel: { falling: "Timber!", growing: "Growing…" },
  restoreLabel: "Grow back",
  spacing: 4.4,
  focusY: 2.4,
  oneDistance: 13,
  flag: { label: "Dead version" },
  person: [2.0, 1.3],
  wind: true,
  notePlaceholder: "e.g. make it taller, leaves a bit darker, love the Snowy one",
});
