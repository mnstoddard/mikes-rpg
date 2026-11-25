# Mike's RPG updates

Each update gets a version number. The newest is at the top. The game shows its version at the
bottom of Settings, and every 🐞 report records which version it came from. The same list lives
in `shared/version.ts` (the game reads it from there), so update both together.
Each update adds 0.1 to the number. Version 1.0 is saved for the finished game on Steam
(see docs/VERSION-1.0-PLAN.md).

## 0.11 · 25 November 2026 · Smooth movement

- Walking is smooth now, not tile by tile. You can stand anywhere and walk in any direction, and you glide instead of hopping from square to square.
- Clicking the ground walks you straight to the exact spot you clicked. The path cuts the corners, so you head straight there instead of zig-zagging.
- W A S D walks the way the camera faces at any angle, not just 8 directions. Turn the camera while you walk and you turn with it.
- Walking into a wall at an angle slides you along it, and walking at the edge of a doorway or a gap between trees eases you into it instead of getting stuck.
- Other players glide smoothly too, and footsteps keep an even beat whichever way you walk.

## 0.10 · 25 November 2026 · The Emberguard, Embervale and the Emberheart

- New names, to match the Emberfall story: the Lighthall is now the Emberhall, the Lightkeepers are the Emberguard, the Kindled are the Emberborn, and the land is Embervale. Its heart, deep under Heartvale, is the Emberheart.
- Soul gems are now refined emberstones, the Soul trap spell (and its potion) is now Ember trap, and Soul Debt is now Ember Debt. Gems you already have keep working and keep their ember; only the names changed.
- The town is called Emberhold. Archmage Ysolde is now Archmage Rowan, Ysra of the Saltmere is now Ida, and the Archmage of old is Vale.
- New players start as Hopefuls, and earn the Ember and Flame ranks from there.
- A new book in the Emberhall library tells the Emberfall as every child learns it, and Brother Oren's tour now starts with it. Someone has left a note in the back of the book.
- Books about the Emberheart now agree that it burns under Heartvale.

## 0.9 · 25 November 2026 · Sound effects

- Sound effects! Chopping, mining, smithing, smelting, cooking and fighting each have their own sounds: a swoosh as you swing, a thunk when the tool lands, and a little reward sound when something goes into your bag.
- Cooking makes stirring and chopping sounds, picked at random from three so it never sounds like a loop.
- Footsteps change with the ground: grass, dirt paths, wooden floors and bridges, stone, and carpet.
- Level ups play a 16-bit treasure fanfare (once, even when a skill and its mastery go up together), and finishing a quest plays a victory tune.
- Hitting a monster, a monster getting hurt, a monster going down, and a monster hitting you all have sounds.
- Settings has a new 🔔 Sound effects switch and a volume slider. The game remembers both.

## 0.8 · 25 November 2026 · Soul stone is now called emberstone

- Soul stone has a new name: emberstone. The rocks in the crystal cave, the raw stones in your bag, and everything people and books say about it all use the new name. Stones you already have keep working; only the name changed. Soul gems keep their name.

## 0.7 · 25 November 2026 · An Emberfall login screen

- The login screen matches the title screen: the same night sky with rising embers and falling stars, and an ember-glow login box.
- The health bars, bag, buttons and the rest of the game stay hidden until you've logged in.

## 0.6 · 25 November 2026 · Emberfall: the game's name and title screen

- The game has a name: Emberfall. It's on the title screen, the login box and the browser tab.
- A title screen: the glowing Emberfall logo over a night sky, with embers rising from a burning glow and stars falling across it. Tap it (or press any key) to start.
- That first tap also starts Mike's song straight away, so the music is already playing when the login box appears.

## 0.5 · 25 November 2026 · Title music: Mike's own song

- The login screen now plays Mike's own song, on a loop. It starts on your first click, tap or key press (browsers don't allow sound before that), and fades out when you log in.
- Tap 🔊 at the top right of the login box to turn the music off (🔇) or back on. The game remembers your choice.

## 0.4 · 24 November 2026 · Play by listening: read-aloud and quest pictures

- Read aloud: tap 🔊 next to anything people say, books, your quest, the 📜 Quests list and the chat to hear it spoken. Tap it again to stop.
- Turn on 🔊 Read everything out loud for me in ⚙️ Settings, and the game reads what people say, books, gifts, warnings and each new quest step as soon as they appear.
- A gold arrow on the ground by your feet points the way to your quest's next ❗ person or 📍 place (or the door that leads there). It goes away when you're close.
- The quest box shows pictures of what you need, with how many you have (like 🐟 1 / 3, then ✓ once you have them all), so you can follow a quest without reading.

## 0.3 · 23 November 2026 · The Lighthall tour, running, and a minimap

- The Lighthall carpet is one even, symmetrical rug. (Report #3)
- The Lighthall library has proper rows of bookshelves, with books on both sides. (Report #4)
- Click a bookshelf to take down a book and read it: the history of Elderra, the shrines, the towns and the people. None of it is needed for a quest; it's there if you're curious. (Report #5)
- Brother Oren now gives you a tour of the Hall of Champions: each Radiant's statue, and the empty plinth. It tells the story of the Sundering War and who the Lightkeepers are. (Report #6)
- A minimap in the top left, turned the way you're facing. It shows ❗ and 📍 quest targets, and an arrow on its edge points the way to ones further off. Tap it for the big map. (Report #7)
- Sister Wynne's dormitory has beds instead of crates, and she explains what happens when you fall and what it costs. (Report #8)
- When someone gives you something, the chat says exactly what it was and that it's in your 🎒 bag. (Report #9)
- The camera no longer goes inside buildings and walls: it moves in closer instead. (Report #10)
- Clicking anywhere on a door works, not just the tile in front of it. (Report #11)
- Walls no longer poke through doors. (Report #12)
- Old Maren now lives in her own cottage by the lake, with her stove inside, instead of cooking out in the square. (Report #13)
- Hedges and bushes are rounder, tighter clumps, with no green box showing. (Report #14)
- Trees no longer look cut through; the stump only shows once a tree is chopped down. (Report #15)
- The fishing line comes from the tip of the rod. (Report #16)
- When a fish bites, the rod bends and you pull the fish out of the water. (Report #17)
- No fighting until Huntmaster Kael has taught you combat. With no weapon you fight with your fists. (Report #18)
- Running: tap 🏃 or hold Shift. It uses up your breath while you run, and your breath comes back a few seconds after you stop. (Report #19)
- Meals that give a lot of stamina are harder to cook without burning. (Report #20)
- The General Store has goods on its shelves and things for sale on its tables. (Report #21)

## 0.2 · 23 November 2026 · Robes that move, and phones that fit

- Robes and long skirts now stretch around the legs when you walk, so legs no longer poke out through the cloth. (Report #1)
- Making your character works on phones: the options scroll, and Start my adventure always stays on screen. (Report #2)
- Phones held sideways: the bag scrolls instead of running off the top of the screen. (Report #2)
- The game's version now shows at the bottom of Settings, and every bug report records it.

## 0.1 · 23 November 2026 · Where we start counting

- Everything built so far: the 3D world, skills, quests, shops, armor and the 🐞 report button.
