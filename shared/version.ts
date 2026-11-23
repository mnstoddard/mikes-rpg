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
    version: "0.3",
    date: "2026-11-23",
    title: "The Lighthall tour, running, and a minimap",
    changes: [
      { text: "The Lighthall carpet is one even, symmetrical rug.", reports: [3] },
      { text: "The Lighthall library has proper rows of bookshelves, with books on both sides.", reports: [4] },
      { text: "Click a bookshelf to take down a book and read it: the history of Elderra, the shrines, the towns and the people. None of it is needed for a quest; it's there if you're curious.", reports: [5] },
      { text: "Brother Oren now gives you a tour of the Hall of Champions: each Radiant's statue, and the empty plinth. It tells the story of the Sundering War and who the Lightkeepers are.", reports: [6] },
      { text: "A minimap in the top left, turned the way you're facing. It shows ❗ and 📍 quest targets, and an arrow on its edge points the way to ones further off. Tap it for the big map.", reports: [7] },
      { text: "Sister Wynne's dormitory has beds instead of crates, and she explains what happens when you fall and what it costs.", reports: [8] },
      { text: "When someone gives you something, the chat says exactly what it was and that it's in your 🎒 bag.", reports: [9] },
      { text: "The camera no longer goes inside buildings and walls: it moves in closer instead.", reports: [10] },
      { text: "Clicking anywhere on a door works, not just the tile in front of it.", reports: [11] },
      { text: "Walls no longer poke through doors.", reports: [12] },
      { text: "Old Maren now lives in her own cottage by the lake, with her stove inside, instead of cooking out in the square.", reports: [13] },
      { text: "Hedges and bushes are rounder, tighter clumps, with no green box showing.", reports: [14] },
      { text: "Trees no longer look cut through; the stump only shows once a tree is chopped down.", reports: [15] },
      { text: "The fishing line comes from the tip of the rod.", reports: [16] },
      { text: "When a fish bites, the rod bends and you pull the fish out of the water.", reports: [17] },
      { text: "No fighting until Huntmaster Kael has taught you combat. With no weapon you fight with your fists.", reports: [18] },
      { text: "Running: tap 🏃 or hold Shift. It uses up your breath while you run, and your breath comes back a few seconds after you stop.", reports: [19] },
      { text: "Meals that give a lot of stamina are harder to cook without burning.", reports: [20] },
      { text: "The General Store has goods on its shelves and things for sale on its tables.", reports: [21] },
    ],
  },
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
