// The game's version and its update history.
//
// Every update that goes live gets a new entry at the TOP of UPDATES, and GAME_VERSION
// moves to match. Each update adds 0.1 (0.2, 0.3, ... 0.10, 0.11): version 1.0 is saved
// for the finished game on Steam (docs/VERSION-1.0-PLAN.md). CHANGELOG.md says the same
// in words for people.
//
// `reports` lists the bug report / change idea numbers (from the 🐞 button, #1, #2...)
// that the change came from, so the Report Review can show what got fixed where.

export interface UpdateChange { text: string; reports?: number[] }
export interface GameUpdate { version: string; date: string; title: string; changes: UpdateChange[] }

export const UPDATES: GameUpdate[] = [
  {
    version: "0.2",
    date: "2026-11-23",
    title: "Robes that move, and phones that fit",
    changes: [
      { text: "Robes and long skirts now stretch around the legs when you walk, so legs no longer poke out through the cloth.", reports: [1] },
      { text: "Making your character works on phones: the options scroll, and Start my adventure always stays on screen.", reports: [2] },
      { text: "Phones held sideways: the bag scrolls instead of running off the top of the screen.", reports: [2] },
      { text: "The game's version now shows at the bottom of Settings, and every bug report records it." },
    ],
  },
  {
    version: "0.1",
    date: "2026-11-23",
    title: "Where we start counting",
    changes: [{ text: "Everything built so far: the 3D world, skills, quests, shops, armor and the 🐞 report button." }],
  },
];

export const GAME_VERSION = UPDATES[0].version;
