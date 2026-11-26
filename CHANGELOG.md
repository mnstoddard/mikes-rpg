# Mike's RPG updates

Each update gets a version number. The newest is at the top. The game shows its version at the
bottom of Settings, and every 🐞 report records which version it came from. The same list lives
in `shared/version.ts` (the game reads it from there), so update both together.
Each update adds 0.1 to the number. Version 1.0 is saved for the finished game on Steam
(see docs/VERSION-1.0-PLAN.md).

## 0.17 · 26 November 2026 · Emberhold, the walled city

- Emberhold, the walled capital, is built (on the dev test server first). A great stone wall with towers runs round the whole city, with four gates: the North Gate, the West Gate, the Saltmere Gate and the River Gate. The gates are shut for now, so the whole game happens inside the walls.
- The Emberhall now stands on Ember Hill in the middle of the city, with a spire and a flame you can see from everywhere. Below it is a plaza, then Market Square with stalls, the well, the bell tower, the General Store and the bounty board.
- The city has districts: Forge Row to the west (Holt, Greta, the smithy and Rook's workshop), the Glass River and its docks to the east (with a fish market), and the Lower Town to the south (the Hearthstone Inn, the Mages' Guild, Kael's lodge, Wren's hut and the allotments). Hundreds of houses fill the streets, light enough for an iPad.
- New: the Emberhall Training Ground, just east of the Emberhall behind a hedge. Every trainer teaches there: Old Maren by the pond, Holt by the practice trees, Greta by the practice rocks, Brann at the furnace and anvil, Rook, Wren, Moss, Archmage Ysolde, Kael by the chicken coop and rat pit, and Farmer Odo by his plots.
- A shorter prologue that takes you through every skill. Keeper Aldric sends you to the Training Ground, Old Maren's first lessons are shorter (no more selling a fish to Tam, and no Fishing 3 or Cooking 3 at the end), and the Oath of the Flame now opens once you've learned from every trainer. Holt asks for 5 logs instead of 10, and Kael's last lesson is the rat pit instead of a wolf outside.
- The townsfolk (Baker Hanna, little Pip, Guard Dunstan and the others) now walk the streets of Emberhold. The old village in Heartvale is still out there, past the closed gates.
- Saves from before move along: anyone in the middle of Maren's lessons keeps their place in the shorter list, and everyone starts in Emberhold's plaza.

## 0.16 · 26 November 2026 · A login log for the admin

- The server now keeps a login log: who logged in and when, new accounts, wrong passwords, what kind of device they used, and when they logged out (so you can see how long they played).
- Only the admin can see it, at /admin/logins on the game's address (the same password as the bug report page). It shows who's playing right now, every login newest first, and a By player view with each player's last login, number of logins and total time played.

## 0.15 · 26 November 2026 · Music for the whole world

- Music everywhere: Mike's song "Realm of Exploration" now plays softly anywhere that doesn't have its own music (out in Heartvale, in the houses, shops and caves). The Emberhall keeps its chant.
- The song repeats forever without a break: its last bar blends into its first, so you can't hear where it starts again.
- Walking into the Emberhall fades the world music out and the chant in, and walking out fades them back. ⚙️ Settings > 🎵 Music turns all music on or off and sets the volume.

## 0.14 · 26 November 2026 · The Emberhall comes alive

- A new opening: your character is formed lying on the floor by the Heart Shrine. Sister Celene hurries over, helps you up and starts talking (a Skip button skips the scene).
- Before the story goes on, you put on your robe. Celene gives it to you, and talking to Keeper Aldric or Celene walks you through it (open your 🎒 bag, click the robe, press Equip). You can't leave the Emberhall until it's on.
- Talking to Keeper Aldric at the start is now one conversation: he carries straight on into the next part instead of making you click him again and again.
- At the very start the hint now says to talk to Keeper Aldric, instead of "pick your next lesson". When nothing is going on it names the next person to see.
- Real doors instead of gaps in the walls. Click anywhere on a door, not just the bottom of it, to use it. Doors swing open as people walk up to them.
- The Emberhall has a makeover: burning braziers, the statues of the Extinguished line the walls of the great hall (the separate statue room is gone), a library through a door on one side, and an infirmary on the other with a bedroom for each patient. Warmer, ember-coloured light inside.
- The Heart Shrine is now a tall, flickering flame in a stone bowl, with embers rising from it. Lit shrines elsewhere show a small flame too.
- Townsfolk: 14 ordinary people now walk about town, the Emberhall and the Hearthstone Inn (Baker Hanna, little Pip, Guard Dunstan, Scholar Quill and more). They aren't part of any quest and don't get in your way. Click one and they'll say something.
- Music: Kevin MacLeod's "Gregorian Chant" plays softly inside the Emberhall. ⚙️ Settings has a 🎵 Music switch and volume, and a new 🎶 Credits section.
- Ember words instead of light words: Keeper Aldric says the Emberheart made you, and every bit of dialogue was checked for leftover "light" wording. The heroes of the past are now called the Extinguished everywhere (no more Radiants or Hall of Champions). Story chapter names changed to match: The Hall of Embers, A Flame in the Thornwood and Act 1: The First Trial.
- The 📜 Quests menu only shows quests you can do now or have done. Locked ones are hidden, with a short note saying how many more open up as you go.
- Everything people say to you now goes into the message log too, so you can read it again. The log (tap the message box) has filter buttons: 💬 Dialogue, 🚩 Chat, ⭐ Events and ⚠️ Warnings.

## 0.13 · 25 November 2026 · A faster, smoother game

- The game draws about half as much in town, so it runs smoother, especially on laptops and phones. Nothing looks different: roofs now skip the hidden sides of each roof tile, hair skips the part tucked inside the head, and the Emberhall's stone statues are shaped a little more simply (they look the same).
- On slower computers with very sharp screens, the game now draws a little softer when it starts to slow down, and goes back to full sharpness when there's time to spare. Computers that keep up see no change.

## 0.12 · 25 November 2026 · Training, the new quest menu and fixes

- Training: new players stay in town until Old Maren's lessons are done. Try to walk out past the lake, the river or the edges of town and you're turned back with a note saying what to do next.
- The 📜 Quests menu is new. At the top: what you're on now, then everything you can start right now (who to see, and where). Then 🎓 Training, a master quest with every skill's lesson, the skills each one teaches, and a bar for how many you've done. Then the story, side quests and bounties. Tap a heading to fold it away; finished story chapters fold into one line.
- Skill lessons now come in a sensible order: Miner Greta before Smith Brann, Forester Holt before Woodworker Rook, Herbalist Wren before Alchemist Moss, Huntmaster Kael before Archmage Rowan, and Shopkeeper Tam before Captain Bryn. Talk to a trainer too early and they tell you who to see first. A lesson you've already started carries on as normal.
- Brother Oren's tour now comes first in The Hall of Light: Keeper Aldric sends you straight to him, then you meet Lisette, Tomas and Wynne. (#26)
- Cooking has levels that matter: harder meals and better firewood (oak, birch, maple...) need a higher Cooking level, and meals well above your level burn more often. The stove tells you the level you need. (#25)
- Carrying too much now slows you down instead of stopping you: over your limit you walk at half speed, then a quarter, then an eighth (the 🐢 by your weight shows it). Past four times your limit you can't pick up any more, and you can't run while overloaded. (#31)
- Little paths now lead from house doors out to the nearest road. (#28)
- Other players show up as blue dots with their names on the minimap and the big map, and the big map names the key people (quest givers and the repairer) by their doors. (#29)
- The guide arrow and map marks now point at the next thing for every quest step: the nearest fishing spot, tree or rock you have the level for, the right stove, furnace or anvil, the shop, the board, or the nearest monster to fight. (#30)
- Every early quest was checked for ways to get stuck. Old Maren now hands you firewood and minnows if you've run out for her cooking lesson, Smith Brann won't let you sell or lose the platelegs he wants to see, and items you've equipped now count when a quest asks for them. (#32)
- Buttons and quest lines say Equip and Unequip everywhere now (no more Wear, Hold or Put on belt). (#22)
- Walking through a door shows a short loading sign so the new room doesn't pop in. (#27)
- Chopped trees fall and sink into the ground instead of shrinking, and the stump shows its rings. Catching a fish has a proper two-handed heave, and the rod bends toward the bobber. (#23, #24)

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
