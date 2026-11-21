# Mike's RPG: the big expansion design

This is the plan for the next big round of the game: new disciplines and skills,
magic and enchanting, potions, farming, parties, a bigger town with a trainer
for every skill, and a day and night cycle.

Nothing here is built yet. Read it, change anything you like, and say **GO**
when you want a stage built. The last two sections are the build order
(stages) and the questions that are still open.

Quick words used in this doc:

- **Discipline**: a big area you level up, like Strength. Each one raises one of
  your stats (health, stamina, mana, speed, prices).
- **Skill**: a thing you actually do, like Mining. Every skill sits inside one
  discipline, and its XP also goes into that discipline.
- **Mastery**: your experience with one type of thing (Oak, Trout, Wolf, Fire
  bolt). Mastery levels earn Mastery points for the skill trees. This already
  exists and stays as it is.

---

## 1. Disciplines and skills

Today the game has three disciplines: Foraging, Crafting and Combat. They
become five, and existing skills move to their new homes.

**Everyone starts fresh.** When the five disciplines go in (stage 2), every
character is reset to level 1, the same way characters were reset when Old
Maren's quests arrived. Nobody's old XP, items or coins carry over.

| Discipline | What it raises | Skills in it |
|---|---|---|
| 💪 **Strength** | Max **health** | Melee, Ranged, Defense |
| 🌿 **Endurance** (was Foraging) | Max **stamina** | Fishing, Woodcutting, Mining, Foraging *(new)*, Farming *(new)*, Hunting *(new)* |
| 🔮 **Wisdom** | Max **mana** | Spellcasting *(replaces Magic)*, Enchanting *(new)*, Alchemy *(new)* |
| 🤲 **Dexterity** (was Crafting) | **Weight limit** and **walking speed** | Cooking, Handicraft, Smithing, Smelting |
| 🤝 **Charisma** | Better **shop prices** and bigger **party size** | Trading *(new)*, Renown *(new)*, Leadership *(new)* |

How a discipline levels (decided): **a discipline's level is the average of
its skills' levels**, rounded down. For example, Endurance with Fishing 20,
Woodcutting 10, Mining 6, Foraging 1, Farming 1 and Hunting 4 is
(20 + 10 + 6 + 1 + 1 + 4) / 6 = level 7. The discipline has no XP bar of its
own any more; it goes up as its skills go up. Only skills you've **learned**
count: a skill you haven't been taught yet doesn't pull the average down.
Training all of a discipline's learned skills raises it fastest. With no skills
learned yet, a discipline is level 1.

### Where the old skills went (my placement, easy to change)

- **Fishing, Woodcutting, Mining** stay together under Endurance, which is what
  Foraging is renamed to. Gathering is hard work, so stamina fits.
- **Cooking** stays with the other making skills in Dexterity (decided).
- **Melee, Ranged, Defense** go to Strength. (Ranged covers bows, slings and
  darts; there's no separate Archery skill.)
  There's no Athletics skill either.
- **Tailoring and Fletching** are not separate skills: both fold into
  **Handicraft**. **Jewelcrafting** is not a separate skill: it folds into
  **Smithing**.
- **Defense** no longer raises health by itself; Strength does. Defense still makes monsters miss more and lets you wear
  better armor.
- **Magic** becomes **Spellcasting** under Wisdom.
- **Mages' Guild rank** (from the guild's magic bounties) folds into **Renown**.
  See section 8.

### What each discipline gives (starting numbers)

These are first guesses, picked to feel close to today's numbers at level 1.

- **Health** = 45 + 5 per Strength level (50 at level 1, 540 at 99).
- **Stamina** = 95 + 5 per Endurance level (100 at level 1, 590 at 99).
- **Mana** = 45 + 5 per Wisdom level (50 at level 1, 540 at 99). The mana bar
  shows all the time from stage 2, next to health and stamina.
- **Weight limit** = 44 kg + 1 kg per Dexterity level (45 kg at level 1, 143 kg
  at 99).
- **Walking speed** = +1% per Dexterity level, **capped at +30%** (reached at
  Dexterity 31). Only walking gets faster; gathering and crafting speed come
  from tools, Mastery and skill trees as they do today. The cap keeps players
  from zipping across the screen faster than the server can follow.

Mike's call: these are best guesses to start with, and they'll be balanced
after playing.
- **Prices** = Charisma raises what shops pay you by 0.3% per level and cuts
  what you pay by the same, up to about 30% at 99.
- **Party size** = 4, rising to 5 at Charisma 50 and 6 at Charisma 90.

How skills unlock (decided, built in stage 2): **skills unlock through quests,
not by level.** A skill opens when someone teaches it to you. For now that's
Old Maren's lessons: talking to her about a skill teaches it (Fishing first,
then Trading, Cooking, Woodcutting, Smithing and Handicraft, Mining, Smelting,
Melee and Defense, Spellcasting, Ranged, and Renown at the bounty board).
Characters who already finished her lessons know every skill. Later, each
trainer's quest chapter (stage 3 onward) teaches the new skills that live in
their building.

---

## 2. Endurance: gathering

### Fishing and Woodcutting
No changes, apart from moving to Endurance.

### Mining: gems and soul stone
New rock nodes join the ore rocks:

- **Gem rocks**: ruby, sapphire, emerald, topaz and amethyst. Each rock gives
  one type of gem.
- **Soul stone rock**: gives raw soul stone, which becomes empty soul gems.

**Gem size is a number, not a name.** Every gem you mine has a size in carats,
for example "Ruby, 2.7 ct". There are no tiers like Small or Grand. Size can be
anywhere from 0.1 up to about 10. Your Mining level and your Mastery of that
rock push the odds toward bigger finds:

- A beginner mostly finds 0.1 to 1 ct gems.
- Each Mining level and each Mastery level of that rock nudges the average up.
- There is always a small chance of a surprisingly big one.

Soul stone works the same way: a bigger soul stone holds more soul energy.

Gems show their size in the item name, and gems of different sizes take
separate bag slots (you can't stack a 1 ct ruby with a 5 ct ruby).

### Foraging (new, uses a shovel)
*Built in stage 5 (decided with Mike):* Herbalist Wren, in a little hut by
the lake east of the Mages' Guild, teaches Foraging in a 4-step chapter and
gives you a stone shovel. Shovels come in every metal like axes (stone from
Wren, the rest at the anvil). You dig **glinting dig patches** (a mound with a
twinkle) scattered over the meadows, by the lake and a couple in the forest;
each find has a 1 in 3 chance of digging the patch out, and it glints again
about 40 seconds later. What you find is rolled from everything your level can
find: worms and wild roots (1), red cap mushrooms (2), mushrooms (3), sage (5),
ginseng (6), wild honeycomb and old bones (8), blue lotus and, **at night
only**, moonpetal (10), and truffles (15). The XP comes from the find. Wren
buys everything you dig up, and sells stone shovels and roots. Wild roots and
truffles cook as vegetables; the rest wait for Alchemy (stage 6). Glowcap,
iron root and fairy moss are still for later.

Foraging is now its own skill, inside the Endurance discipline. You need a
**shovel** on your tool belt (made at the anvil like other tools). You dig at
**forage spots**: little patches of disturbed earth, mushrooms or flowers on the
map that come back after a while.

What you can find (more types unlock with Foraging level):

| Find | Where | Used for |
|---|---|---|
| Worms | Grass near water | Bait, cooking |
| Red cap mushroom | Forest floor | Health potion |
| Ginseng root | Meadows | Stamina potion |
| Blue lotus | Lake shore | Mana potion |
| Wild honey (from a hive) | Old trees | Stamina potion, cooking |
| Glowcap mushroom (night only) | Dark Forest | Night vision potion |
| Moonpetal (night only) | Hills | Soul trap duration potion |
| Truffle | Under oak trees | Cooking, sells well |
| Old bones | Ruins, graveyard | Strength potion, bait |
| Iron root | Rocky ground | Strength potion |
| Fairy moss | Riverbanks | Speed potion |

Mushrooms you find now and then while chopping trees still drop too.

### Farming (new)
See section 7.

### Hunting (new)
*Built in stage 5:* Huntmaster Kael teaches Hunting at the end of his
chapter (characters who already finished it have it). Every defeated monster
gives Hunting XP (its kill XP plus its level) to **everyone who hurt it**,
shared by how much of its health each one took (at least 1 each). Each Hunting
level makes drops 1% more likely, on top of monster Mastery. The skinning knife
is still to come.

Hunting is general monster hunting. You earn Hunting XP for every monster you
defeat, on top of the Melee, Ranged or Spellcasting XP from the hits. Higher
Hunting means **more drops** and better odds on rare drops. The Hunting trainer
also sells a skinning knife that gives a small extra chance of hides and pelts.

---

## 3. Monsters and what they drop

New monsters, so every potion and crafting ingredient has a source. Existing
monsters stay.

*Built in stage 5:* slimes in the wet meadow by the lake (slime goo); boars in
the meadow south-east of the square (raw boar and tusks; they bite back); wolves
now run in packs of 2 or 3 (when one goes for you the others nearby join in) and
also drop wolf fangs; giant bats come out only at night (they vanish at sunrise)
over the meadows, where they only bite back, and in the forest, where they
attack; cave spiders live in a small dark cave just east of the quarry (silk and
venom sacs). The cave counts as danger like the forest, so you need Kael's gate
lesson to go in. Kael buys all the new drops. Raw boar cooks as meat, and there
is a new **Steak** dish (Cooking 4: meat, with a little veg). Beetles, wisps,
the dire wolf and ghouls are still to come.

| Monster | Level | Where | Drops |
|---|---|---|---|
| Slime | 2 | Wet meadow | Slime goo (health potion) |
| Giant bat | 6 | Cave, and anywhere at night | Bat wing (mana potion) |
| Wild boar | 7 | Forest edge | Boar hide (tailoring), raw pork, tusk |
| Wolf *(exists)* | 8 | Dark Forest, Wolf Hollow | Wolf pelt, wolf fang |
| Fire beetle | 10 | Quarry | Beetle shell (fire resist potion), glowing gland |
| Cave spider | 14 | Cave | Spider silk (tailoring, bowstrings), venom sac (poison) |
| Will-o'-wisp (night only) | 16 | Dark Forest | Wisp essence (big soul value) |
| Dire wolf (group quest boss) | 20 | Wolf Hollow | Dire wolf pelt, big fang |
| Grave ghoul (night only) | 22 | Graveyard | Bone dust, ghoul eye |

Monster strength also sets how much **soul energy** it gives when soul trapped
(section 5).

---

## 4. Dexterity: making things

### Smithing, Smelting, Cooking, Handicraft
Same as today, now under Dexterity, except for how Smithing unlocks things
(below). Smithing also makes the **shovel** and the **inlays** used in
Enchanting.

### Smithing: one item at a time
Instead of a whole metal unlocking at once, **each item unlocks at its own
Smithing level**, so there's always something new coming up. Weapons, armor,
tools and jewellery are all mixed into one ladder. For example:

| Smithing level | Unlocks |
|---|---|
| 1 | Bronze dagger, stone tools |
| 2 | Bronze short sword, bronze ring |
| 3 | Bronze helmet, bronze tools |
| 4 | Bronze mace, bronze amulet |
| 5 | Bronze shield, bronze boots |
| 7 | Bronze platelegs, bronze inlay |
| 9 | Bronze platebody, bronze spear |
| 12 | Silver ring |
| 15 | Iron dagger, iron tools |
| 16 to 28 | The rest of the iron items, one or two per level, plus silver amulets and silver inlays |
| 30 | Steel dagger, then steel items up the levels, with gold jewellery mixed in from about 35 |
| 50 | Platinum jewellery starts |
| 60 | Mithril dagger, then mithril items up the levels |
| 80 | Iridium jewellery starts, up to iridium inlays near 95 |

(Exact levels get tuned when it's built.)

### Two metal ladders
- **Fighting and tool metals** (Strength gear and tools): stone, bronze, iron,
  steel, mithril, as today.
- **Jewellery metals** (rings, amulets and inlays): **bronze** (low quality,
  available right away, the same bronze bars as weapons), then **silver**, **gold**, **platinum**, and
  **iridium** at very high levels. Better jewellery metal means a stronger
  ring or amulet and a higher enchanting cap on an inlay. Platinum and iridium
  need new ore rocks (in the Quarry and deep in the Cave).

### Coins use the same metals
Money follows the jewellery ladder: **bronze, silver, gold, platinum and
iridium coins**, each worth 100 of the one below. Bronze, silver and gold
coins work as they do today; platinum and iridium are added on top.

### Handicraft: bows, staffs, cloth and leather (no Fletching or Tailoring skill)
Handicraft already makes fishing bait at the workbench. It also takes over
what Fletching and Tailoring skills would have done, so neither is a separate
skill:

- **Woodwork**: fishing rods, bows (a log, plus spider silk or sinew for the
  string), arrows (feathers and metal tips), and the **plain staffs** that
  Enchanting turns into magic staffs. The wood type sets a staff's base strength
  (pine is weakest, elderwood is strongest).
- **Sewing**: cloth and leather armor from hides, pelts and spider silk.
  Cloth and leather are lighter than metal, so they suit spellcasters and
  Ranged fighters (and leave more weight for gathering).

**How stage 10 was built** (decided with Mike's stage 10 notes). Woodworker
Rook teaches it all, and things unlock one by one as your Handicraft level goes up:

- **The workbench** has tabs: Bait, Bows, Staffs, Arrows, Leather and Cloth.
- **Bows and staffs** take 2 logs (a bow also takes 1 thread). The **wood sets
  their strength**: pine adds nothing, then oak +1, birch +2, maple +3, yew +4,
  ironwood +6 and elderwood +8 (bows hit harder, staffs make spells stronger).
  Pine is level 1, elderwood 65; bows need 2 levels more than staffs. Bows and
  staffs are no longer made at the anvil (old ones still work).
- **Arrows**: a pine log, a tip (stone or a metal bar) and 2 feathers make 10.
  The tip sets the damage: stone +0, bronze +1 and so on, like metal weapons.
  A bow shoots your best arrows first, and each shot uses one, but about **1 in
  3 is picked up again**. No arrows, no shooting. Kael sells a pine bow and
  stone arrows; Rook sells feathers and thread.
- **The tanning rack** (outside the workshop's east wall) turns one hide into
  one leather: cowhide (level 3), boar hide (6, boars now drop them) and wolf
  pelts (10).
- **The spinning wheel** (inside the workshop) spins spider silk into thread
  (level 6) and weaves 2 thread into cloth (level 10). Wool comes with Farming.
- **Leather armor** (boots 5, cap 7, chaps 9, jerkin 12, hide buckler 14) is a
  bit tougher than bronze, light, and **doesn't slow you down**.
- **Cloth robes** (shoes 12, hood 14, skirt 16, robe top 20; no shield) are
  thin, but each piece adds **+5 max mana per cloth** in it and makes spells
  **3% stronger**.
- **Metal armor** is still the toughest, but now **slows walking by 1% per bar**
  in what you wear (a full iron set is about 9% slower).
- Leather and cloth sit in their own bag slots, apart from metal armor. Mend
  and the Repairer fix them with leather or cloth, and wooden bows and staffs
  with a log.

### Smithing: jewellery and gems (no Jewelcrafting skill)
Smithing also does what a Jewelcrafting skill would have done. At the anvil
(or a jeweller's bench next to it) you:

- **Cut** raw gems. Cutting keeps the size; cut gems are worth more and are
  needed for enchanting.
- **Make settings**: rings, amulets and inlays in bronze, silver, gold, platinum
  or iridium (each unlocks at its own Smithing level).
- **Set gems** into rings and amulets.
- **Shape soul gems** from raw soul stone.

**How stage 7 was built:**

- **The Crystal Cave** is past the spider cave (walk through it and out its
  east side). It has amethyst (Mining 10), topaz (20), soul stone (25), emerald
  (30), sapphire (40) and ruby (50) rocks, plus platinum (75) and iridium (85)
  ore deep inside. Cave spiders can follow you in.
- **Gem sizes**: rolled from your Mining level, the rock's level and your
  Mastery of that rock, roughly 0.1 to 10 ct, with a 3% chance of a big one
  ("💎 A big one!").
- **Cutting** happens at the anvil (Cut gems tab). Amethyst needs Smithing 5,
  topaz 10, emerald 15, sapphire 20, ruby 25 and soul stone 10. A cut can be
  flawless (keeps all of it), good (85%), clumsy (60%) or shatter (gone). Higher
  Smithing means better cuts. Soul stone always cuts cleanly into an empty soul
  gem of the same size.
- **Rings** (1 bar) and **amulets** (2 bars) are made at the anvil in bronze
  (Smithing 5), silver (15), gold (25), platinum (45) or iridium (65), with or
  without a cut gem. A failed try loses the bars but keeps the gem. Better metal
  multiplies the gem's bonus (bronze x1 up to iridium x4) and an amulet gives
  1.5 times a ring.
- **Gem bonuses**: ruby gives max health, sapphire max mana, emerald max
  stamina, topaz hit chance and amethyst armor. Bigger gems give more.
- **You wear 2 rings and 1 amulet** (the Jewelry row under Gear). New max
  health from a ring starts empty and fills up over time, so swapping rings
  can't heal you.
- **Bars**: silver, gold, platinum and iridium bars are smelted at the furnace
  (Smelting 15, 25, 45 and 65).
- **Coins**: bronze, silver, gold, platinum and iridium, each worth 100 of the
  one below. Platinum and iridium only show once you have some.
- **Selling**: gems sell well at Tam's. A cut gem is worth about 3 times a rough
  one, and price climbs faster than size.
- **Not built yet**: inlays (they come with Enchanting in stage 9).

---

## 5. Wisdom: magic

### Spellcasting (replaces Magic)
Spells are no longer tied to holding a staff. You cast them from a **spell bar**
and they use mana. There are three kinds:

- **Attack**: Fire bolt, Frost bolt (slows), Lightning (chains to a second
  monster).
- **Defense**: Stone skin (less damage taken), Heal, Ward (blocks the next hit).
- **Utility**: **Invisibility** (walk through danger zones without being
  attacked; it breaks if you attack), Light (see at night), Soul trap, Sleep,
  Detect (shows forage spots and gem rocks nearby).

How you learn spells:

- Most spells unlock as your **Spellcasting level** goes up (pick them up from
  the Spellcasting trainer for free once you reach the level).
- Some come only from **spell books**: found as rare drops, bought from the
  Mages' Guild, or given as **quest rewards**.

Mastery of each spell lowers its mana cost and raises its duration or strength.
For example, Invisibility might start at 10 seconds for 20 mana, and reach 40
seconds for 10 mana at high Mastery.

Mana comes back slowly over time, online and offline (it already does today),
and mana potions top it up fast.

### Soul trap
Soul trap is a spell you cast on a monster. It lasts **60 seconds**:

- The monster gets a clear **purple glow** while it's trapped.
- In the last 10 seconds the glow **starts blinking** so you know it's wearing
  off.
- If the monster dies while trapped (by anyone in your party, or you), its soul
  energy goes into the **emptiest soul gem in your bag that still has room**.

A soul gem is **not one monster per gem**. Each monster gives soul energy based
on its strength (a slime gives a little, a dire wolf a lot). A gem's capacity
comes from its size, so a 0.5 ct soul gem fills from a few slimes, and a 6 ct
gem needs many strong monsters. Bigger, fuller gems power stronger enchantments.
A gem shows how full it is, like "Soul gem, 3.2 ct, 140 / 320 souls".

A Moonpetal potion makes soul trap last longer.

**How stage 8 was built:**

- **Spell bar**: under your gear, 4 slots to start, plus 1 for each spell you
  raise to Mastery 10 (up to 8). Click a slot or press its number key (1 to 8)
  to cast. Press ✎ to arrange it: pick a slot, then a spell.
- **Spells by level** (Spellcasting): Firebolt 1, Ward 3, Frost bolt 5, Soul
  trap 6, Heal 8, Sleep 10. A new spell goes on the bar by itself if there's room.
- **Spell books**: Haste (Spellcasting 12), Invisibility (15) and Frost nova
  (20). Read a book from your bag to learn it. Moss sells Haste and Frost nova
  books; goblins (Haste), giant spiders (Frost nova) and bandits (Invisibility)
  rarely drop them; reaching guild rank Adept earns the Invisibility book.
- **Bolts still need a staff** for now: Firebolt, Frost bolt and Sleep fly from
  the staff in your hand, and clicking one on the bar picks it. Enchanting
  (stage 9) changes staffs. The other spells need no staff.
- **Ward** soaks up damage (8 plus half your level) for 2 minutes. **Heal**
  heals 12 plus half your level. **Haste**: 20% faster for 60 seconds.
  **Invisibility**: 15 seconds where monsters ignore you; attacking, gathering
  or casting at a monster breaks it. **Frost nova** hits and freezes every
  monster within 2 tiles.
- **Mastery** of a spell: -1% mana a level (down to half), +2% strength or
  length a level.
- **Soul trap** works on the monster you're fighting, or the closest one within
  6 tiles. It glows purple for 60 seconds and blinks in the last 10. If it dies
  trapped, its souls (4 per monster level plus half its health) go to the
  caster's best soul gem: the smallest one it fits in whole, or else the one with
  the most room. Only the caster's gem fills.
- **Soul gems** hold 50 souls per carat and show how full they are ("Soul gem,
  3.1 ct (45% full)"). A slime fills about half of a 0.5 ct gem.

### Enchanting (new)
Enchanting adds magic effects to gear at an **enchanting altar** in the Mages'
Guild. Every enchantment uses:

1. **The item** to enchant (a staff, a piece of armor, or a tool).
2. **A filled soul gem**: the power. It's used up.
3. **A cut gem**: the effect. Gem type picks the effect, and gem size sets how
   strong it is. It's used up.
4. **Optional metal inlay** (bronze, silver, gold, platinum or iridium): raises
   the cap on how strong the enchantment can be. Bronze raises it a little,
   iridium the most.

What each gem does:

| Gem | On a staff | On armor | On a tool |
|---|---|---|---|
| Ruby | Fire bolts | Fire resistance | More XP |
| Sapphire | Frost bolts (slow) | Mana regen | Lower stamina cost |
| Emerald | Poison bolts | Health regen | Double-yield chance |
| Topaz | Lightning bolts | +Max health | Faster gathering |
| Amethyst | Life-steal bolts | Thorns (hurts attackers) | Rare find chance |

Plus damage reduction on armor from any gem with a gold inlay (to be balanced).

**Enchanted staffs**: a plain staff (from Handicraft) plus a soul gem plus a gem
makes a magic staff that fires bolts. Its strength comes from the wood type and
the soul gem's size and fullness. Each bolt uses a **tiny bit of mana** (about 1),
so staves are a cheap way to fight, while spells are stronger but cost more.

**The skill tree**: Enchanting starts with just basic items (tools and simple
staffs). Harder and better things unlock in the Enchanting Mastery tree:
enchanting armor, using gold inlays, two effects on one item, and repairing
enchanted items.

**How stage 9 was built** (simpler than the plan above, and decided with Mike's
stage 9 notes):

- **Learning it**: Archmage Ysolde's chapter goes on after her first lesson.
  Ask her about the altar, and she teaches Enchanting (a Wisdom skill) and gives
  you a small full soul gem to try it with. The altar stands by the guild door.
- **Every enchantment uses up a soul gem with souls in it.** Power grows with
  the square root of its souls (a full 0.5 ct gem is about 10, a full 3.1 ct one
  about 25), +1% per Enchanting level. Enchanting XP is 10 plus half the souls.
- **Staffs** (any staff) also take a **cut gem**, which picks the effect:
  ruby fire (extra damage), sapphire frost (slows), emerald poison (4 hits over
  time), topaz lightning (jumps to a second monster) and amethyst life steal.
  A bigger gem is stronger, capped at 2 ct, 4 ct with a **silver inlay** or 7 ct
  with a **gold inlay** (1 bar, used up). An enchanted staff's bolts cost just
  **1 mana**, hit harder by a sixth of the power, and wear the staff as before.
- **Armor** picks one: Vitality (+max health), Mana flow (mana comes back
  faster), Guard (less damage, up to 50% from all armor) or Thorns (monsters
  that hit you get hurt back).
- **Tools** pick one: Swiftness (faster gathering, gathering tools only),
  Bounty (extra finds, or extra makes for crafting tools), Tireless (less
  stamina) or Wisdom (more XP).
- **One enchantment per item.** Taking it off is free, but the magic (and its
  soul gem) is lost, and the item is "spent": it won't take another.
- **Enchanting tree**: Second slot (items hold 2 different enchantments),
  Potency (+10% power a rank) and Re-enchant (enchant a spent item again).
- **Mend** (Spellcasting 18, 20 mana): fixes your most worn tool or piece of
  gear good as new, using 1 of what it's made of (its metal bar, stone, or a log
  for a fishing rod).
- **Not built yet**: enchanting other weapons, bronze/platinum/iridium inlays,
  and plain staffs from Handicraft (stage 10, now built).

### Wear and repair
*Built in stage 4 (decided with Mike):*
- Tools wear per use, weapons per hit, armor as you take hits. Everything works
  at **full strength until 0 uses**.
- At 10% left you get a warning, and the bar turns red.
- At 0 it's **Broken**: it goes back in your bag (💔) and can't be put on your
  belt, held or worn until it's repaired.
- **Repairer Oswin** at the Mages' Guild fixes things, one at a time or with
  **Repair all**. Anyone can use him, not just guild members.
- Cost: about **1 bronze coin per 10% worn** for stone or pine. Bronze costs ×2,
  iron ×4, steel ×8 and mithril ×16. Rods scale with their wood (balance later).
- **Broken things sell for half price.** Worn things sell for between half and
  full price, depending on how worn they are.
- Old Maren's rod lesson: the rod breaks and stays broken, and she sends you to
  the Repairer. That first repair is free, and it shows you where the guild is.

The original plan, for later stages:

- **Weapons** wear with each attack; **armor** wears as you take damage (the
  piece that's hit, or all worn pieces a little); **tools** wear with each use.
  Enchanted staves wear with each bolt.
- When something wears out it **isn't destroyed**. It stays in your bag or slot
  as "Broken", and you can't use it until it's repaired.
- **Repair** is part of Enchanting. Before you learn it, pay the **Repairer at
  the Mages' Guild**. The cost scales with how worn the item is and how strong
  it is (a mithril sword with an enchantment costs much more than a stone axe).
- Once you learn the **Mend** spell (Enchanting tree), you repair things
  yourself for mana and a bit of soul energy. Mend starts with basic items;
  repairing enchanted items is a later tree unlock.

### Alchemy (new)
*Built in stage 6 (decided with Mike):* **Alchemist Moss** stands in the
Mages' Guild (the hall is one row bigger now) next to the **alchemy table**.
Moss teaches Alchemy (Wisdom) in a 4-step chapter and sells **empty vials**;
every potion uses one (a spoiled brew loses the ingredients but keeps the
vial). At the table you tap 2 ingredients from your bag into the mix (things
alchemy can't use are grayed out); a third from a short list adds a bonus:
sage (30% stronger), moonpetal (60% stronger), honey (+15 stamina), mushroom
(+10 health) or old bones (buffs last 1.5 times as long). Potions stack 10 to a
slot and are drunk from the bag, with a **10-second wait** between potions
(the shop health potion too). Strength is worked out when you drink: +3% per
Alchemy level, times the bonus. Each potion kind has its own Mastery (fewer
spoiled brews).

| Potion | Ingredients | Level | Effect |
|---|---|---|---|
| Health | Red cap + slime goo | 1 | Heals 30 |
| Stamina | Ginseng + wild honeycomb | 3 | +40 stamina |
| Mana | Blue lotus + bat wing | 5 | +30 mana |
| *Restoration draught (hidden)* | Slime goo + blue lotus | 8 | Some health and some mana |
| Strength | Wolf fang + sage | 10 | +10% weapon damage, 5 minutes |
| Swiftness | Boar tusk + ginseng | 15 | Walk 15% faster, 5 minutes |
| *Hunter's brew (hidden)* | Wolf fang + boar tusk | 18 | A little of both, 5 minutes |
| Night sight | Moonpetal + blue lotus | 20 | No darkness at night, 5 minutes |
| Soul trap | Venom sac + moonpetal | 25 | Soul trap lasts 50% longer (for stage 8) |

Hidden recipes show as ❓ until you brew one; the table hints "something
stirs" when your mix makes one. Running buffs show under the mana bar with
the minutes left. Farm crops, glass vials from sand and fire resistance are
still for later.

*The original plan:*
Brew potions at an alchemy table from foraged herbs, farm crops and monster
parts. A potion needs 2 or 3 ingredients plus a vial (bought from the alchemist,
or made later by Smelting sand into glass).

| Potion | Ingredients | Effect |
|---|---|---|
| Health | Red cap mushroom + slime goo | Restore health |
| Stamina | Ginseng root + wild honey | Restore stamina |
| Mana | Blue lotus + bat wing | Restore mana |
| Strength | Iron root + old bones | Hit harder for 5 minutes |
| Speed | Fairy moss + boar tusk | Move and work faster for 5 minutes |
| Night vision | Glowcap + ghoul eye | See clearly at night |
| Soul trap | Moonpetal + wisp essence | Soul trap lasts twice as long |
| Fire resistance | Beetle shell + red cap | Take less fire damage |

Alchemy level and potion Mastery make stronger potions and fewer failed brews.
The health potion the Merchant sells today stays, as a weak shop version.

---

## 6. Charisma

### Trading (new)
*Stage 2 built the Trading and Renown skills with simple XP (selling gives
Trading XP, bounties give Renown XP). The tiers, deals and gated quests below
come in stage 12.*

You earn Trading XP **only when you sell** to a shop (buying gives none). XP
is based on the value of what you sell. Trading level unlocks better shop deals and, later,
special stock that shopkeepers only show to good customers.

### Renown (new)
You earn Renown XP by **finishing bounties** (both the town bounty board and the
Mages' Guild board).

- **Bounties scale with Renown.** Low Renown gives simple fetch jobs. Higher
  Renown adds harder jobs (rarer items, bigger amounts, tougher monsters) with
  better rewards.
- **Bounty tiers**: Townsfolk (Renown 1), Trusted (10), Notable (25), Famous
  (50), Legendary (80). Each tier adds harder bounties and better pay.
- **Quests unlock at higher Renown.** Some side quests only appear once you're
  known in town.
- The Mages' Guild board gives magic bounties. Its old "guild rank" becomes a
  Renown requirement for chest upgrades (see open questions).

### Leadership (new)
You earn Leadership XP by **leading a party** that finishes quests or defeats
monsters together. Higher Leadership gives the whole party a small bonus (for
example +1% XP per 10 Leadership levels, up to +10%), and unlocks group quests.

---

## 7. Farming

- At the **Farm** (east of town, just past the trainers) you **buy a small plot**
  from the Farmer.
- **Starting plot**: 2 x 2 tiles for **2 gold**.
- **Expand** a row or column at a time, up to 6 x 6: 3 gold, then 5, 8, 12, 18,
  25 gold (each step costs more, like the enchanted chest).
- Seeds come from the Farmer's shop. Plant, then **come back to harvest**. No
  watering or tending for now.
- **Crops grow in real time, even when you're offline.** A potato takes about 10
  minutes; better crops take longer (up to a few hours) and are worth more.
- Crops: potato, carrot, cabbage, wheat (for bread later), onion, pumpkin, and
  herbs like ginseng and fairy moss (a farmed source for potions).
- Your plot is **just yours**. Nobody else can harvest it.

**How stage 11 was built** (decided with Mike's stage 11 notes):

- **The farm** is its own little island east of the east island: follow the
  path across the east island and over the second bridge. Farmer Odo lives in
  the farmhouse at its west end, with the farm chest outside his door.
- **Odo's lesson** ("Something to grow") teaches Farming (an Endurance skill)
  and gives 4 seed potatoes. Odo pays for your first plot, then you plant them,
  harvest them about 10 minutes later, and get 200 coins.
- **Plots**: there are 7 lots, each 6 × 6. A plot starts 2 × 2 (2 gold, free in
  the lesson) and grows 3 × 2, 3 × 3, 4 × 4, 5 × 5, 6 × 5, 6 × 6 for 3, 5, 8, 12,
  18 and 25 gold (buy it in Odo's shop, Buy tab). One plot each. If every lot
  is taken, more lots can be added to the map.
- **Planting and harvesting**: click your plot. You walk over and work tile by
  tile, planting every empty one (the seed you picked with "Plant these first"
  on a seed's card, or the first seed in your bag) and harvesting everything
  ripe. 2 stamina a tile. No watering.
- **Crops** (Farming level, time to ripen, harvest): potatoes (1, 10 min, 3 to 5),
  carrots (4, 15 min, 3 to 5), onions (8, 25 min, 2 to 4), wheat (12, 40 min,
  3 to 5), ginseng (20, 2 hours, 1 or 2) and blue lotus (30, 3 hours, 1 or 2).
  A harvest gives a seed back 30% of the time (+0.5% per Farming level). Odo
  sells every seed and buys seeds and crops.
- **Mastery** per crop: +2% chance of an extra one per level. The Farming tree
  has Green thumb (crops ripen 5% sooner a rank), Bumper crop and Light work.
- **Growing in real time**: crops are stored with when they were planted and
  when they'll be ripe, so they keep growing while you're logged out (and while
  the server restarts). Everyone sees everyone's farm, with its owner's name
  on a sign, but only the owner can plant or harvest.
- **Farm chest**: for 5 gold Odo links the chest outside to your enchanted
  chest (you need to rent space in it from Ysolde first).
- **Offline health** already came back 1 a minute while logged out.
- **Saved in the world**: plots are kept in a "world" table (or
  server/data/world.json when playing locally), not in a character's save, so
  they're there to see even when their owner is offline.
- **Not built yet**: animals, wool, cabbages and pumpkins, and cooking with
  onions and wheat.

Offline rules: health, stamina and mana all come back while you're offline, and
crops keep growing. Nothing can hurt you or touch your stuff while you're
offline, because you're not in the game.

---

## 8. Combat and XP sharing

- **Kill XP is split by damage share.** If you did 60% of a monster's damage,
  you get 60% of its XP. This is true whether you're in a party or not, so a
  passer-by who helps gets their fair share.
- **Drops** go to whoever did the most damage. (A share-based roll is possible
  later.)
- **Defense XP** still comes from being attacked.

---

## 9. Parties and group quests

- Start a party by inviting someone nearby. **Max 4 people** (Charisma can raise
  it, see section 1).
- **Quest XP** goes to every member **in full** (it's not split).
- **Quest loot**: every member gets their own full reward.
- **Quests have level gates**, for example "needs Strength 10" or "needs
  Spellcasting 15". You can join any party, but you can't take or get credit
  for a quest you're below the gate for. So a level 1 can't skip the main quest
  by joining a strong friend.
- Party members see each other's health bars and are shown on the map.

**First group quest: The Howling Hollow.** Wolves are attacking the farm. The
Farmer asks a party (2 to 4 players, everyone Strength 8+) to clear wolves from
Wolf Hollow and defeat the **Dire wolf** pack leader. Everyone gets the full XP,
a wolf-fang amulet setting and coins. It can also be done alone, but it's built
to be much easier together.

---

## 10. The main quest line

The opening is part of the main quest, not a "tutorial". It's still guided by
**Old Maren**, but now she acts as a hub: after the first few lessons she
**sends you to a trainer for each skill**, in any order you like (as long as
you're the right level).

Each trainer gives a short chapter that teaches their skill and ends with a
reward, usually a starter tool. Maren's ❗ shows which trainers are ready for
you. Your 📜 Quests tab shows all chapters, done and open.

**Built in stage 3** (for the skills that exist now): Maren's chapter
("Living off the land": fishing, cooking, eating, selling a fish to Tam, then
Fishing 3 and Cooking 3), then chapters from Tam (Trading), Holt
(Woodcutting), Greta (Mining), Brann (Smithing and Smelting), Rook
(Handicraft), Kael (Melee, Defense, Ranged, and the gate), Ysolde
(Spellcasting, and guild membership) and Bryn (Renown and the bounty board).
After Maren's, they can be done in any order, with no level needed. One
chapter is "active" at a time: talking to another trainer switches to theirs,
and the first one keeps its place. Characters from before stage 3 kept every
skill they had learned (and the gate, if it was open), and can do the trainers'
chapters for the rewards.

Planned chapters (the full list, as more skills arrive):

| Trainer | Skill | Chapter |
|---|---|---|
| Old Maren | Fishing, Cooking, Eating | "Living off the land" (as today) |
| Forester Holt | Woodcutting | Chop, make a stone axe, sell logs |
| Miner Greta | Mining | Stone, ore, then find your first gem |
| Smith Brann | Smithing, Smelting | Bars, tools, armor (today's lessons), then cut a gem and make a bronze ring |
| Herbalist Wren | Foraging | Get a shovel, dig 5 finds, find a night herb |
| Farmer Odo | Farming | Buy a plot (Odo pays for the first), plant, harvest |
| Huntmaster Kael | Hunting, Melee, Ranged, Defense | Today's combat lesson, then the wolf |
| Woodworker Rook | Handicraft | Make bait, a bow, a plain staff and leather boots |
| Archmage Ysolde | Spellcasting | Learn spells, cast Soul trap and fill a gem |
| Enchanter Vale | Enchanting | Enchant your plain staff; see the Repairer |
| Alchemist Moss | Alchemy | Brew a health potion |
| Shopkeeper Tam | Trading | Buy, sell, use the sell slider |
| Captain Bryn (bounty board) | Renown | Finish 3 bounties |
| Farmer Odo again | Leadership | The Howling Hollow group quest |

**Spending Mastery points becomes a quest step** (in Maren's early chapter):
"Open a skill tree and spend your first Mastery point."

---

## 11. The world map

The map grows, but not by a lot. Everything new is close to town.

- **Trainer Row** (built in stage 3): a row of wooden buildings just north of
  the main road, with the woods and the quarry behind them: Forester Holt, Miner
  Greta, and Smith Brann's smithy (the furnace and anvil moved inside). The town
  square below the road has Tam's General Store, Rook's workshop (with the
  workbench), and an open corner with Old Maren, the stove, the bounty board and
  Captain Bryn. Kael's lodge is south of the road, by the gate. Buildings are
  walk-in rooms on the same map.
- **The Mages' Guild** (already south-west of town) gains the enchanting altar,
  the alchemy table, the Repairer and the spell trainer.
- **The Farm**: fields east of town, with plots for players.
- **The Quarry**: a small rocky area to the north with gem rocks and a soul stone
  rock, plus fire beetles.
- **The Cave**: a small cave entrance in the hills, with bats and cave spiders,
  and rarer gem rocks deeper in.
- **Wolf Hollow**: a clearing at the edge of the Dark Forest, for the group
  quest.
- **The Graveyard**: a small spooky area for night monsters and night herbs.
- **Forage spots** scattered through meadows, forest edges and lake shores.

### Shops
*Built in stage 3. Tam pays the same as the trainers for now (balance later).*

The Merchant splits up. Each trainer sells the starter gear and recipes for
their own skill (shovels from the Herbalist, seeds from the Farmer, vials from
the Alchemist and so on), and buys back what their skill makes.

A **General Store** (Shopkeeper Tam) stays in the town square. It buys anything,
so it's where you sell junk, and sells basics like food.

**No player-to-player trading.** You trade only with shops.

### Day and night
*Built in stage 3: the 40-minute cycle, a gentle dark at night, and a ☀️/🌙
button by the zoom buttons that says how long until it changes. Night monsters
and herbs came in stage 5 (giant bats, and moonpetal from dig patches).*

- A full day lasts about **40 minutes** (30 day, 10 night), the same for
  everyone.
- The screen darkens at dusk and lightens at dawn. Light spells and night
  vision potions help you see.
- **Night-only monsters** (giant bats roam more widely, will-o'-wisps, grave
  ghouls) and **night-only herbs** (glowcap, moonpetal) appear only at night.

---

## 12. Small fixes on the list

These are small and can be built first:

1. **Phone layout**: the message box no longer covers the 📜 Quests button, and
   the whole screen adapts to the size of the phone or window.
2. **Sell part of a stack**: a slider and a number box to pick how many to sell,
   with the price shown per item and in total.
3. **Bag button shows weight and slots**: a small weight bar and a count like
   "3 / 12" on the bag button.
4. **Spending Mastery points becomes a quest step** (see section 10).

---

## 13. Build order (stages)

This is too big to build in one go safely. I recommend these stages. Each one
can be built, tested and played on its own, and each one adds its trainer's
quest chapter as it goes, so the main quest grows with the game.

| Stage | What gets built | Why this order |
|---|---|---|
| **1. Small fixes** ✅ built | Phone layout, sell slider, bag weight and slots, Mastery point quest step | Quick wins, nothing depends on them |
| **2. The five disciplines** ✅ built | Strength, Endurance, Wisdom, Dexterity, Charisma; skills move; health, stamina, mana, speed and price bonuses; every character reset to start fresh | Everything else plugs into this |
| **3. Bigger town and trainers** ✅ built | Trainer Row buildings, Merchant split into trainer shops plus General Store, Maren's hub quest for existing skills, day and night cycle | Gives new skills a place to live |
| **4. Wear and repair** ✅ built | Worn-out gear becomes Broken instead of vanishing, armor wears from damage, the paid Repairer | Needed before enchanting |
| **5. Foraging, Hunting and new monsters** ✅ built | Shovel, forage spots, ingredients, night herbs; slimes, bats, boars, beetles, spiders and night monsters; kill XP split by damage share; Hunting drop bonus | Ingredients for potions and crafting |
| **6. Alchemy** ✅ built | Alchemy table, vials, the potion list | Uses stage 5's ingredients |
| **7. Gems and soul stone** ✅ built | Gem and soul stone rocks with continuous sizes, and Smithing's gem cutting, rings, amulets, inlays and soul gems | Needed for enchanting |
| **8. Spellcasting** ✅ built | Spell bar, new spell list, learning by level and books, Invisibility, Soul trap with the glow and blink, filling soul gems | Needed for enchanting |
| **9. Enchanting** ✅ built | Enchanting altar, staffs, armor and tool enchants, the Mend spell, Enchanting tree unlocks | Needs stages 4, 7 and 8 |
| **10. More Handicraft** ✅ built | Cloth and leather armor, bows, arrows and plain staffs, all in Handicraft | Uses hides, silk and logs |
| **11. Farming** ✅ built | Farm area, buying and expanding plots, seeds, real-time growth | Independent, can move earlier |
| **12. Trading and Renown** | Trading XP, Renown XP, bounty tiers, Renown-gated quests | Builds on the existing boards |
| **13. Parties and Leadership** | Invites, party UI, shared quest XP and loot, quest level gates, Leadership bonus, The Howling Hollow | Biggest server change, best done last |

Stages 10, 11 and 12 can be done in any order once stage 3 is in.

---

## 14. Open questions

1. ~~Cooking: Dexterity or Endurance?~~ **Decided: Dexterity.**
2. ~~Keep or reset characters?~~ **Decided: everyone starts fresh** when stage 2
   goes in.
3. **Maren's first lesson** has you fish until the rod breaks. With gear now
   going to Broken instead of vanishing, should that lesson end with Maren
   sending you to the Repairer, or just giving you a new rod as now?
4. **Mages' Guild rank**: fold it into Renown (chest size depends on Renown), or
   keep a separate guild rank?
5. **Drops in a fight with several players**: most damage takes all (simple), or
   everyone who helped gets their own roll?
6. ~~Day length~~ **Decided: 40 minutes** (30 day, 10 night), and night is
   only gently dark for now.
7. **Land cost**: is 2 gold for the first plot a fair price for an early player?
8. ~~Trainer names~~ **Decided: keep them** (they can still be renamed any time).
9. **Spell books**: should some spells be shop-only, or only from drops and
   quests?
10. ~~Walking speed from Dexterity~~ **Decided: it has a cap** (+30% for now).
11. ~~How a discipline's level works~~ **Decided: the average of its skills'
    levels.**
12. ~~Unlocking skills with an average~~ **Decided: skills unlock through
    quests** (Maren's lessons now, trainers' quests later), and only learned
    skills count toward the average.
