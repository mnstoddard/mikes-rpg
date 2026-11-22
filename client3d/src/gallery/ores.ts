// The Ore Gallery: every rock you can mine, plus the ores the story plans.
import { RESOURCES } from "../../../shared/foraging";
import { ITEMS } from "../../../shared/items";
import { TICK_MS } from "../../../shared/map";
import { ROCK_KINDS, ROCK_SHAPES, ROCK_TYPES, Rock, createRock, setRockEnvironment } from "../rocks";
import { runGallery } from "./app";

const GROUP = { metal: "Ores and stone", gem: "Gems", planned: "Planned for the Sundered Crown" } as const;

runGallery({
  kinds: ROCK_KINDS,
  info(k) {
    const t = ROCK_TYPES[k];
    const res = t.resource ? RESOURCES[t.resource] : null;
    const gives = res ? (res.gem ? (res.gem === "soul" ? "Soul stones (sizes vary)" : `Rough ${t.name.toLowerCase()}s (sizes vary)`) : ITEMS[res.item]?.name ?? res.item) : "";
    return {
      name: t.name,
      meta: res ? `Mining ${res.level}` : "Planned",
      swatch: t.look.colors[0],
      about: t.about,
      whereLabel: "Where you find it",
      where: t.found,
      stats: res
        ? [
            ["Mining level", String(res.level)],
            ["XP per ore", String(res.xp)],
            ["Gives", gives],
            ["Refills in", `${Math.round((res.respawnTicks * TICK_MS) / 1000)} s`],
          ]
        : [["In the game", "Not yet (planned)"]],
      variants: ROCK_SHAPES,
      group: GROUP[t.group],
    };
  },
  create: (k, seed, variant) => {
    const r = createRock(k, { seed, variant });
    return { object: r.object, get state() { return r.state; }, update: (dt: number, t: number, _w: number, night: number) => r.update(dt, t, night), dispose: () => r.dispose(), rock: r } as any;
  },
  verb: "Mine",
  hitsToFinish: 3,
  hit: (t) => ((t as any).rock as Rock).hit(),
  finish: (t) => ((t as any).rock as Rock).deplete(),
  restore: (t) => ((t as any).rock as Rock).refill(),
  readyState: "full",
  doneState: "empty",
  busyLabel: { emptying: "Empty!", refilling: "Refilling…" },
  restoreLabel: "Refill",
  spacing: 2.9,
  focusY: 0.7,
  oneDistance: 5.5,
  person: [-1.9, -0.9],
  useEnvironment: setRockEnvironment,
  wind: false,
  notePlaceholder: "e.g. bigger nuggets, rock a bit darker, crystals should glow more",
});
