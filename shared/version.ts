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
    version: "0.9",
    date: "2026-11-25",
    title: "Sound effects",
    changes: [
      { text: "Sound effects! Chopping, mining, smithing, smelting, cooking and fighting each have their own sounds: a swoosh as you swing, a thunk when the tool lands, and a little reward sound when something goes into your bag." },
      { text: "Cooking makes stirring and chopping sounds, picked at random from three so it never sounds like a loop." },
      { text: "Footsteps change with the ground: grass, dirt paths, wooden floors and bridges, stone, and carpet." },
      { text: "Level ups play a 16-bit treasure fanfare (once, even when a skill and its mastery go up together), and finishing a quest plays a victory tune." },
      { text: "Hitting a monster, a monster getting hurt, a monster going down, and a monster hitting you all have sounds." },
      { text: "Settings has a new 🔔 Sound effects switch and a volume slider. The game remembers both." },
    ],
  },
  {
    version: "0.8",
    date: "2026-11-25",
    title: "Soul stone is now called emberstone",
    changes: [
      { text: "Soul stone has a new name: emberstone. The rocks in the crystal cave, the raw stones in your bag, and everything people and books say about it all use the new name. Stones you already have keep working; only the name changed. Soul gems keep their name." },
    ],
  },
  {
    version: "0.7",
    date: "2026-11-25",
    title: "An Emberfall login screen",
    changes: [
      { text: "The login screen matches the title screen: the same night sky with rising embers and falling stars, and an ember-glow login box." },
      { text: "The health bars, bag, buttons and the rest of the game stay hidden until you've logged in." },
    ],
  },
  {
    version: "0.6",
    date: "2026-11-25",
    title: "Emberfall: the game's name and title screen",
    changes: [
      { text: "The game has a name: Emberfall. It's on the title screen, the login box and the browser tab." },
      { text: "A title screen: the glowing Emberfall logo over a night sky, with embers rising from a burning glow and stars falling across it. Tap it (or press any key) to start." },
      { text: "That first tap also starts Mike's song straight away, so the music is already playing when the login box appears." },
    ],
  },
  {
    version: "0.5",
    date: "2026-11-25",
    title: "Title music: Mike's own song",
    changes: [
      { text: "The login screen now plays Mike's own song, on a loop. It starts on your first click, tap or key press (browsers don't allow sound before that), and fades out when you log in." },
      { text: "Tap 🔊 at the top right of the login box to turn the music off (🔇) or back on. The game remembers your choice." },
    ],
  },
  {
    version: "0.4",
    date: "2026-11-24",
    title: "Play by listening: read-aloud and quest pictures",
    changes: [
      { text: "Read aloud: tap 🔊 next to anything people say, books, your quest, the 📜 Quests list and the chat to hear it spoken. Tap it again to stop." },
      { text: "Turn on 🔊 Read everything out loud for me in ⚙️ Settings, and the game reads what people say, books, gifts, warnings and each new quest step as soon as they appear." },
      { text: "A gold arrow on the ground by your feet points the way to your quest's next ❗ person or 📍 place (or the door that leads there). It goes away when you're close." },
      { text: "The quest box shows pictures of what you need, with how many you have (like 🐟 1 / 3, then ✓ once you have them all), so you can follow a quest without reading." },
    ],
  },
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
