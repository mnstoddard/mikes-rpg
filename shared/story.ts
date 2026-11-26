// The story: the Prologue (Awakening) and Act 1 (The First Trial), from
// docs/QUESTLINE.md. These chapters go round the trainers'
// lessons in shared/quests.ts:
//
//   Awakening -> The Hall of Embers -> Light the Way -> The Training Ground
//   -> Old Maren's lessons and the trainers' lessons
//   -> A Blessing (after 4 lessons) -> Oath of the Flame (after Kael's lesson)
//   -> Act 1: twelve quests, mostly in any order, ending with
//      A Flame in the Thornwood (rank Flame).
//
// Also here: Emberguard ranks, Ember Debt (Tithe marks), blessings and the
// story's keepsake items. Only type imports, so quests.ts and items.ts can
// both use this.
import type { Chapter } from "./quests";
import type { ItemDef } from "./items";

// ---- Emberguard ranks ----

/** Hopeful (everyone), Ember (after the Oath), Flame (end of Act 1). */
export const RANKS = ["Hopeful", "Ember", "Flame"] as const;
export type Rank = 0 | 1 | 2;
/** The cloak colour each rank wears (Hopefuls wear none). */
export const RANK_CLOAK = [0, 0xe8792b, 0xffc93c] as const;

// ---- Ember Debt (Tithe marks) ----
// After the Oath, each time you're knocked out you get a Tithe mark (at most 5).
// While you have marks, a fifth of the XP you earn goes to the shrine instead.
// Each mark clears once the shrine has taken enough (more at higher levels).
// You never lose levels or items. A Tithe tonic clears one mark at once.

export const TITHE_MAX = 5;
export const TITHE_SHARE = 0.2;
/** XP the shrine takes to clear one mark, by your highest Discipline level. */
export const titheCost = (level: number) => 40 + 12 * level;

// ---- Blessings ----

/** A blessing: +50% XP for 30 minutes. */
export const BLESS_MINUTES = 30;
export const BLESS_POWER = 50;

// ---- Keepsakes and story items ----

export type StoryItemId = "blessing_scroll" | "lantern" | "shrine_totem" | "rooks_note" | "ashbound_note" | "marens_charm" | "holts_notes";
export interface StoryItemDef extends ItemDef {
  /** What the bag's button says ("Read", "Use"), if it does anything. */
  use?: string;
  /** Can be dropped (scrolls). Keepsakes can't be sold or dropped. */
  droppable?: boolean;
  description: string;
}
export const STORY_ITEMS: Record<StoryItemId, StoryItemDef> = {
  blessing_scroll: { name: "Blessing scrolls", single: "blessing scroll", icon: "📜", tint: "sepia(1) saturate(3) brightness(1.1)", sellPrice: 0, use: "Read", droppable: true,
    description: `Read it for an Emberguard blessing: +${BLESS_POWER}% XP for ${BLESS_MINUTES} minutes.` },
  lantern: { name: "Your lantern", single: "lantern", icon: "🏮", sellPrice: 0,
    description: "Keeper Aldric's gift. While it's in your bag, nights are less dark for you." },
  shrine_totem: { name: "Shrine totems", single: "shrine totem", icon: "🗿", tint: "sepia(1) saturate(1.5) brightness(.9)", sellPrice: 0,
    description: "Carved from oak by Woodworker Rook, for an Emberguard shrine. Something rattles inside." },
  rooks_note: { name: "Folded note", single: "folded note", icon: "✉️", sellPrice: 0, use: "Read",
    description: "It fell out of Rook's totem. It's sealed with a blob of wax." },
  ashbound_note: { name: "Scrawled note", single: "scrawled note", icon: "📝", sellPrice: 0, use: "Read",
    description: "Dropped by an Ashbound scout on the Westroad." },
  marens_charm: { name: "Maren's worn charm", single: "worn charm", icon: "🪬", sellPrice: 0, use: "Look at",
    description: "A little wooden flame, worn smooth by years of fingers. Maren gave it to you." },
  holts_notes: { name: "Holt's notes", single: "page of Holt's notes", icon: "📒", sellPrice: 0, use: "Read",
    description: "Forester Holt's count of dead trees, near shrines and far from them." },
};
export const STORY_ITEM_IDS = Object.keys(STORY_ITEMS) as StoryItemId[];
export const isStoryItem = (item: string | null | undefined): item is StoryItemId => !!item && item in STORY_ITEMS;

// ---- Places the story sends you (shared/world.ts puts them on the map) ----

export const SPOT_NAMES: Record<string, string> = {
  "spot.fieldNorth": "Odo's north field", "spot.fieldMid": "Odo's middle field", "spot.fieldSouth": "Odo's south field",
  "spot.nearLighthall": "the Emberhall's garden", "spot.nearWestShrine": "the trees by the Westroad shrine", "spot.nearGate": "the trees by the Thornwood gate",
  "spot.farLake": "the woods north of the lake", "spot.farPeaks": "the Greyspine foothills", "spot.farCoast": "the woods by the north coast",
  "spot.thornEdge": "the Thornwood shrine's clearing",
};

// ---- The chapters ----

const ALDRIC = "Keeper Aldric";
const CELENE = "Sister Celene";
const LIGHTHALL = "in the Emberhall, the great white temple on Ember Hill, in the middle of Emberhold";

/** Prologue chapters before Old Maren's lessons. */
export const PROLOGUE_START: Chapter[] = [
  {
    id: "awakening", act: "prologue", title: "Awakening", giver: "celene", name: CELENE, where: LIGHTHALL,
    steps: [
      {
        // New characters see this as the opening scene: they wake lying by the shrine, and Celene comes over and helps them up.
        task: `Talk to ${CELENE}, beside the Heart Shrine`, goal: { kind: "talk" },
        lines: [
          "Easy, easy. Take my hand. Up you come. There you are.",
          "You've just woken on the steps of the Heart Shrine. Its flame flared up, the embers gathered, and there you were. That's how all of you come to us: made by the Emberheart itself.",
          "Do you remember your name? Anything at all? No? Don't be frightened. None of you ever do.",
          "Now, you can't go about in nothing but your shirt. Here's a robe. Let's get it on you before anything else.",
        ],
        give: [{ item: "platebody_cloth" }],
      },
      {
        // Celene walks you through it; the story waits until the robe is on, and you can't leave the Emberhall without it.
        task: "Put on your robe: open your 🎒 bag, click the robe, then press Equip", goal: { kind: "gear", items: ["platebody_cloth"], names: "robe" },
        hint: "Let's get you dressed first. Open your 🎒 bag (the button at the bottom right), click the robe, then press Equip. I'll wait.",
        ensure: [{ item: "platebody_cloth" }],
        doneSpeaker: CELENE,
        doneLines: [
          "There! It suits you. Now you look like one of the Emberborn.",
          "Come and meet Keeper Aldric, just across the shrine from me. He'll want to welcome you himself.",
        ],
      },
      {
        task: `Talk to ${ALDRIC}, beside the Heart Shrine`, goal: { kind: "talk" }, who: "aldric",
        lines: [
          "Welcome, friend! Welcome to the Emberhall, and to Emberhold.",
          "The Emberheart made you for a reason. You won't remember anything; none of you do. We call you the Emberborn: heroes the shrines make from the land's own ember, when the land needs them. Until you've proven yourself, you're a Hopeful.",
          "And the land does need you. The Withering creeps out of the west, the Ashbound smash our shrines, and the Thornwood grows darker every year.",
          "But not today. Today you're safe, and everything here is yours to learn.",
        ],
      },
    ],
  },
  {
    id: "hall", act: "prologue", title: "The Hall of Embers", giver: "aldric", name: ALDRIC, where: LIGHTHALL, after: ["awakening"],
    steps: [
      {
        task: `Talk to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "Now, let me tell you about our home. The Emberhall is the Emberguard's temple, built round the Heart Shrine: the brightest flame in all Embervale.",
          "The statues along these walls are the Extinguished, the greatest heroes the shrines ever raised. Brother Oren keeps them, and he's waiting to show you round. He's just down the hall on the left.",
          "Then meet the rest of my brothers and sisters: Sister Lisette keeps the library, through the door on the west side, Brother Tomas the stores, through the other west door, and Sister Wynne the infirmary, through the east door. Come back to me when you've met them all.",
        ],
      },
      {
        // Brother Oren's tour of the great hall: he tells you about each of the Extinguished, and who the Emberguard are.
        task: "Take Brother Oren's tour of the statues: Oren, the 4 Extinguished and the empty plinth", goal: { kind: "visit", npcs: ["oren", "radiant_1", "radiant_2", "radiant_3", "radiant_4", "plinth"], names: "stops on Oren's tour" },
        hint: "Brother Oren is waiting by the statues on the west side of the great hall. Talk to him, then click each statue with a ❗ along both walls, and the empty plinth near the doors, and he'll tell you about it.",
        speaker: "Brother Oren",
        visitLines: {
          oren: [
            "Welcome, welcome! I'm Brother Oren. I keep the statues of the Extinguished, the greatest heroes the shrines ever raised. Every one of them woke where you woke.",
            "Come, I'll walk you round right now. Every new Emberborn ought to know whose footsteps they're following. Click each statue with a ❗ and I'll tell you about them.",
          ],
          radiant_1: [
            "Let's start at the beginning. Five hundred years ago came the Emberfall: the land's fire burst up out of the earth in anger, and embers rained down for a whole year. No one was to blame. That's why we count the years After the Fall.",
            "Then the lords fought over the glowing shards it left, and the Sundering War nearly ended Embervale. The Old Kingdom fell, and there was almost no one left to fight.",
            "So the Archmage Vale built the shrines, and the shrines raised the first Emberborn: heroes made of ember, who came back every time they fell.",
            "This is Halric the Dawnbringer, one of those very first. He held the Greyspine pass on his own for three days. He fell eleven times, and the shrine raised him eleven times. On the twelfth morning the enemy simply ran out of courage.",
          ],
          radiant_2: [
            "Ida of the Saltmere. When the war ended, the Archmage was gone, and someone had to look after his shrines. That someone is us: the Emberguard.",
            "We aren't soldiers. We keep the shrines lit, we welcome every Emberborn who wakes, and we write down every deed, so the Emberheart remembers you even when you can't.",
            "Ida rowed the whole Saltmere coast in a fishing boat, lighting shrines in villages that had been dark for a hundred years. The fisherfolk still leave shells at her feet.",
          ],
          radiant_3: [
            "Tilda Ashwalker. When the Withering first crept out of the Barrens, she walked straight into it and brought a whole village home. Two hundred people, on foot, through the dust.",
            "The Withering is still out there, friend. That's why the land needs heroes like you, and why the shrines raise more of you every year.",
          ],
          radiant_4: [
            "And Orla the Kind. A healer, not a fighter. Through the Grey Fever she went from house to house, and every time the fever took her, the shrine sent her back to keep working.",
            "When an Emberborn has done enough, we honor them with a Radiance Ceremony. They burn brighter than ever, and then their ember goes back into the Heart Shrine, to raise the heroes who come after. That's why we call them the Extinguished. There's no higher honor. Every statue in this hall is someone who was given it.",
            "None of them are with us now, of course. That's what it means. One flame goes out so a hundred can be lit.",
          ],
          plinth: [
            "(Brother Oren hurries you past the empty plinth. Someone has scratched the name off the stone, very carefully, letter by letter. You can just make out the first letter, under the dust. It might be an S.)",
            "That? An old mistake. A name that didn't deserve to be kept. Don't trouble yourself with it. Now go and meet the others: Sister Lisette in the library, Brother Tomas in the stores and Sister Wynne in the infirmary.",
          ],
        },
      },
      {
        task: "Meet three more Emberguard: Lisette, Tomas and Wynne", goal: { kind: "visit", npcs: ["lisette", "tomas", "wynne"], names: "Emberguard" },
        hint: "Sister Lisette is in the library (through the north-west door), Brother Tomas in the stores (the south-west door) and Sister Wynne in the infirmary (the east door).",
        visitLines: {
          lisette: ["Welcome to the library! Every Emberborn's deeds are written down here, so the Emberheart remembers them even if you don't.",
            "The oldest books are older than the town. The very oldest are in the ledger room, and only the Keepers read those."],
          tomas: ["The stores, yes, and that gold-locked door is the ledger room. Keepers only, I'm afraid. Just old accounts. Very dull.",
            "Now, if you ever need anything, you only have to ask. The Emberhall gives freely."],
          wynne: ["Welcome to the infirmary. Every patient gets a room of their own here, with a proper bed and a door that shuts. The Emberhall's doors never close to an Emberborn.",
            "Let me tell you what happens when you fall out there, so it doesn't frighten you. When your health runs out, the shrine's embers gather you up and make you again, on the shrine's steps.",
            "You'll wake up weak and dizzy, and we'll bring you in here and nurse you back onto your feet. Nobody is left alone on the cold stone.",
            "But it isn't free. Each time the Emberheart remakes you, it keeps a little piece back. Once you've taken the Oath, every fall leaves a Tithe mark, and a share of everything you learn goes to the shrine until it's paid. So try not to fall too often, hm?"],
        },
      },
      {
        task: `Go back to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "You've met everyone? Good, good. And you found the empty plinth, I see. Every family has its black sheep, friend.",
          "Here, a little something to start you off. The Emberhall pays its own.",
        ],
        coins: 30,
      },
    ],
  },
  {
    id: "lanterns", act: "prologue", title: "Light the Way", giver: "aldric", name: ALDRIC, where: LIGHTHALL, after: ["hall"],
    steps: [
      {
        task: `Talk to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "Now, a small job, but an important one. Every evening we light the lanterns on the Emberhall's steps and round the plaza below them, so no one in the city walks in the dark.",
          "Walk out through the great doors at the bottom of the hall and light all six: click each lantern. The ❗ marks show you which are still dark.",
        ],
      },
      {
        task: "Light the 6 lanterns on the steps and round the plaza", goal: { kind: "visit", npcs: ["lantern_1", "lantern_2", "lantern_3", "lantern_4", "lantern_5", "lantern_6"], names: "lanterns" },
        hint: "Go out through the great doors at the bottom of the hall. The lanterns stand on the steps and round the plaza: click each one with a ❗.",
        visitLines: {
          lantern_1: ["You light the lantern. Warm light spills across the white steps."],
          lantern_2: ["You light the lantern. Its glow catches the gold on the Emberhall's doors."],
          lantern_3: ["You light the lantern. A cat stretches out in the warm light under it."],
          lantern_4: ["You light the lantern. A guard on the plaza nods to you."],
          lantern_5: ["You light the lantern. Someone on the plaza claps."],
          lantern_6: ["You light the last lantern. The whole plaza glows gold."],
        },
      },
      {
        task: `Go back to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "I saw the plaza light up from here! Beautiful. A flame shared is a gift, friend, and you've just given some.",
          "Take this lantern for yourself. With it in your bag, the nights won't be so dark for you.",
        ],
        give: [{ item: "lantern" }],
      },
    ],
  },
  {
    id: "sweeper", act: "prologue", title: "The Training Ground", giver: "aldric", name: ALDRIC, where: LIGHTHALL, after: ["lanterns"],
    steps: [
      {
        task: `Talk to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "One more thing. You'll need to feed yourself, and earn your way. Old Maren can teach you that.",
          "You'll find her in the Emberhall Training Ground, just east of the hall, behind the green hedge. She's been here forever, and she teaches every new hero the basics.",
          "Every trainer in the city works there too: woodcutting, mining, smithing, cooking, fighting, magic, farming, all of it. The Emberguard pay them to teach the Emberborn, so every lesson is a gift from the Emberhall.",
          "Learn from all of them, then come back to me and swear the Oath. Off you go: out of the great doors, then east across the plaza. Your 🗺️ map shows Maren's ❗.",
        ],
      },
    ],
  },
];

/** The end of the Prologue: after Old Maren's and the trainers' lessons. */
export const PROLOGUE_END: Chapter[] = [
  {
    id: "blessing", act: "prologue", title: "A Blessing", giver: "celene", name: CELENE, where: LIGHTHALL, after: ["maren"], lessons: 4,
    steps: [
      {
        task: `Talk to ${CELENE}`, goal: { kind: "talk" }, bless: true,
        lines: [
          "Look at you! Trainers lining up to teach you already. Aldric is so proud, and so am I.",
          "Kneel a moment. There. That's a blessing of the Heart Shrine: for half an hour, everything you learn sticks better. You'll earn half as much XP again.",
          "Use it well! Gather 20 of anything: logs, ore, fish, herbs. I want to see you shine.",
        ],
      },
      {
        task: "Gather 20 of anything (logs, ore, fish, herbs...)", goal: { kind: "gather", count: 20 },
        hint: "Chop, mine, fish or dig: anything you gather counts. The blessing (✨ by your health) makes it go faster.",
      },
      {
        task: `Go back to ${CELENE}`, goal: { kind: "talk" },
        lines: [
          "Twenty! You see how the Heart Shrine's warmth helps you?",
          "Take these blessing scrolls. Read one whenever you want a blessing of your own. The Emberhall makes them for every Emberborn.",
          "Keeper Aldric wants to see you. I think it's time you swore the Oath.",
        ],
        give: [{ item: "blessing_scroll", count: 3 }],
      },
    ],
  },
  {
    id: "oath", act: "prologue", title: "Oath of the Flame", giver: "aldric", name: ALDRIC, where: LIGHTHALL, after: ["blessing", "maren", "tam", "holt", "greta", "brann", "rook", "kael", "wren", "ysolde", "moss", "bryn", "odo"],
    steps: [
      {
        task: `Talk to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "You've learned so much, friend. It's time.",
          "Every Emberborn who means to stay swears the Oath of the Flame at the Heart Shrine, so the shrine knows you, and can always bring you home.",
          "Go and stand before the shrine, and put your hand in its flame. Don't be afraid: it won't burn you.",
        ],
      },
      {
        task: "Swear the Oath at the Heart Shrine", goal: { kind: "visit", npcs: ["heart_shrine"], names: "Heart Shrine" },
        hint: "The Heart Shrine is at the top of the hall, on the golden floor. Click it.",
        visitLines: {
          heart_shrine: [
            "You put your hand in the flame. It's warm, not hot. \"I am Emberborn. I carry the flame. Where I fall, the Emberheart will raise me.\"",
            "The flame flares white. For a moment you feel a tug deep in your chest, like a thread pulled tight.",
            "Then it's gone, and you feel warm all over.",
          ],
        },
      },
      {
        task: `Go back to ${ALDRIC}`, goal: { kind: "talk" }, rank: 1,
        lines: [
          "It knows you now. Welcome, Ember of the Emberhall!",
          "Wear this cloak with pride: everyone in Emberhold will know you're one of us. And here's your first silver.",
          "Oh, one thing. Now that the shrine knows you, falling has a small cost: the shrine takes a little tithe to raise you. Nothing to worry about. I'll explain when it matters.",
          "Come and see me when you're ready for real work. There's a lot to do.",
        ],
        coins: 100,
      },
    ],
  },
];

/** Act 1: The First Trial. Opens after the Oath. */
export const ACT_ONE: Chapter[] = [
  {
    id: "rounds", act: "act1", title: "Lantern Rounds", giver: "aldric", name: ALDRIC, where: LIGHTHALL, after: ["oath"],
    steps: [
      {
        task: `Talk to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "Your first job as an Ember: the lantern rounds. There are six shrine lanterns round Heartvale, and they need lighting.",
          "By the quarry road up north, by the lake, by the Hearthstone Inn on Trainer Row, at the farm over the river, on the coast, and by Kael's gate. The 🗺️ map marks them.",
        ],
      },
      {
        task: "Light the 6 shrine lanterns round Heartvale", goal: { kind: "visit", npcs: ["round_1", "round_2", "round_3", "round_4", "round_5", "round_6"], names: "shrine lanterns" },
        hint: "Quarry road (north), the lake (west), the Hearthstone Inn (Trainer Row), the farm (east, over the river), the coast (far east) and Kael's gate (south). Open the 🗺️ map to see them.",
        visitLines: {
          round_1: ["You light the lantern by the quarry road. The miners wave."],
          round_2: ["You light the lantern by the lake. Its light shivers on the water."],
          round_3: ["You light the lantern by the inn. In its light you see red paint on the inn's wall, still wet:", "THE FLAME EATS", "You'd better tell Aldric."],
          round_4: ["You light the lantern at the farm. Farmer Odo watches you from his field, and doesn't wave."],
          round_5: ["You light the lantern on the coast. Far out at sea, a light answers."],
          round_6: ["You light the lantern by Kael's gate. The Thornwood looks darker beside it, not lighter."],
        },
      },
      {
        task: `Go back to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "All six! Well done. And... the inn wall. Yes. I've heard.",
          "The Ashbound, I expect. They hate the shrines. They hate anything that helps people. I've sent Brother Tomas to scrub it off.",
          "Don't let it trouble you, friend. Here: your pay, and a blessing scroll for your trouble.",
        ],
        give: [{ item: "blessing_scroll" }],
        coins: 80,
      },
    ],
  },
  {
    id: "first_tithe", act: "act1", title: "The First Tithe", giver: "aldric", name: ALDRIC, where: LIGHTHALL, after: ["rounds"],
    steps: [
      {
        task: `Talk to ${ALDRIC} about the Tithe`, goal: { kind: "talk" },
        lines: [
          "I promised I'd explain the tithe. Sit down a moment.",
          "When an Emberborn falls, the shrine raises them. That takes ember. So, after the Oath, each time you're knocked out the shrine puts a Tithe mark on you: a gold link by your health bar. You can have up to five.",
          "While you carry marks, a fifth of what you learn goes to the shrine, to keep it bright for the next hero. Once it's had enough, the mark fades on its own. You never lose a level, or a single thing you own.",
          "A small tithe, so the shrines can keep raising heroes. And if you're in a hurry, a Tithe tonic clears a mark at once. Here, take two.",
        ],
        give: [{ item: "potion_tithe", count: 2 }],
      },
    ],
  },
  {
    id: "bless_fields", act: "act1", title: "Blessing the Fields", giver: "celene", name: CELENE, where: LIGHTHALL, after: ["oath"],
    steps: [
      {
        task: `Talk to ${CELENE}`, goal: { kind: "talk" },
        lines: [
          "Will you walk with me? Every season I bless the farmers' fields, and I'd love the company.",
          "The fields are at Farmer Odo's farm, east along the road over the river. We'll bless the north, middle and south fields. The 🗺️ map shows where.",
        ],
      },
      {
        task: "Bless Odo's three fields with Celene", goal: { kind: "reach", spots: ["spot.fieldNorth", "spot.fieldMid", "spot.fieldSouth"], names: "fields" },
        hint: "Walk to each field at the farm (east, over the river). The 🗺️ map marks them.",
      },
      {
        task: "Speak to Farmer Odo", goal: { kind: "talk" }, who: "odo",
        lines: [
          "Oi! You! And you, Sister! Off my land!",
          "I've told you every season: no blessings on my fields. My grandmother never had one, my mother never had one, and our crops grew fine.",
          "Go on, the pair of you. Shoo!",
        ],
      },
      {
        task: `Go back to ${CELENE}`, goal: { kind: "talk" },
        lines: [
          "Poor Odo. He's been like that for years. Some people are frightened of anything they don't understand.",
          "Thank you for coming with me. Take these, and bless something of your own.",
        ],
        give: [{ item: "blessing_scroll", count: 2 }],
      },
    ],
  },
  {
    id: "tonics", act: "act1", title: "Tithe Tonics", giver: "moss", name: "Alchemist Moss", where: "at the Mages' Guild, south-west of town", after: ["oath", "moss"],
    steps: [
      {
        task: "Talk to Alchemist Moss", goal: { kind: "talk" },
        lines: [
          "Ah, an Ember! Just who I need. The Emberhall has ordered a mountain of Tithe tonics, and my hands are full.",
          "The recipe's a secret, but you're one of theirs, so: one red cap mushroom and one wild root, in a vial, at the alchemy table. You'll dig both up from the glinting patches.",
          "Brew me five. The Emberhall sells them to heroes, to clear their debt faster. Good business, eh? Here are some vials to start you off.",
        ],
      },
      {
        task: "Brew 5 Tithe tonics (red cap + wild root + a vial)", goal: { kind: "craft", skill: "alchemy", prefix: "potion_tithe", count: 5 },
        hint: "At the alchemy table in the Mages' Guild: a red cap mushroom + a wild root, and an empty vial. Dig both from the glinting patches. With me watching, every brew works.",
        ensure: [{ item: "vial", count: 5 }], guaranteed: true,
      },
      {
        task: "Bring the tonics to Alchemist Moss", goal: { kind: "talk" }, take: { potion_tithe: 5 },
        lines: [
          "Five! Lovely. The Emberhall pays well for these, and so do I.",
          "Keep the recipe: it's yours now. Funny, isn't it? They sell the cure for a debt they put on you. Still. Business is business.",
        ],
        coins: 50, xp: { alchemy: 60 },
      },
    ],
  },
  {
    id: "totem", act: "act1", title: "The Totem", giver: "rook", name: "Woodworker Rook", where: "in the workshop just west of the square", after: ["oath", "rook", "holt"],
    steps: [
      {
        task: "Talk to Woodworker Rook", goal: { kind: "talk" },
        lines: [
          "Ember, eh? Then you can fetch for the Emberhall same as I carve for it.",
          "They want a shrine totem. Oak, nothing less. Bring me 5 oak logs (the round trees: you need Woodcutting 5) and I'll carve it.",
        ],
      },
      {
        task: "Chop 5 oak logs (Woodcutting 5)", goal: { kind: "have", items: { oak_logs: 5 } },
        hint: "Oaks are the round trees. You need Woodcutting level 5 to chop them. There are some round the meadows north of town.",
      },
      {
        task: "Bring the oak logs to Woodworker Rook", goal: { kind: "talk" }, take: { oak_logs: 5 },
        lines: [
          "Good wood. Give me a moment.",
          "...There. A shrine totem. Take it to Keeper Aldric.",
          "Oh, and I've tucked a little note inside, for luck. Old carver's habit. Don't you go reading it, mind.",
        ],
        give: [{ item: "shrine_totem" }, { item: "rooks_note" }],
      },
      {
        task: `Deliver the totem to ${ALDRIC}`, goal: { kind: "talk" }, who: "aldric", take: { shrine_totem: 1 },
        lines: [
          "Rook's work! Lovely. He's carved for us for thirty years. This one will go up in a shrine on the Westroad, once we've dealt with the Ashbound.",
          "Go back to Rook and thank him for me, would you?",
        ],
      },
      {
        task: "Go back to Woodworker Rook", goal: { kind: "talk" },
        lines: [
          "Delivered, was it? Good.",
          "Here: I put an oak handle on a bronze axe for you. Oak's tougher than pine, and it shows.",
        ],
        give: [{ item: "axe_bronze_oak" }],
        xp: { handicraft: 40 },
      },
    ],
  },
  {
    id: "ash_road", act: "act1", title: "Ash on the Road", giver: "bryn", name: "Captain Bryn", where: "by the bounty board in the square", after: ["oath", "bryn"],
    steps: [
      {
        task: "Talk to Captain Bryn", goal: { kind: "talk" },
        lines: [
          "Ember! Good timing. The Emberhall's paying for this one.",
          "Ashbound scouts are smashing the old shrine on the Westroad, at the far west end of the main road, by the barricade. Drive them off: four of them should do it.",
          "Watch yourself. They're not much in a fight, but they don't stay down long.",
        ],
      },
      {
        task: "Defeat 4 Ashbound scouts at the Westroad shrine (far west)", goal: { kind: "kill", monster: "ashbound_scout", count: 4 },
        hint: "Follow the main road all the way west. The scouts are round the smashed shrine, near the barricade.",
        fightWith: "weapon",
      },
      {
        task: "Report to Captain Bryn", goal: { kind: "talk" },
        lines: [
          "Driven off? Good work. They'll be back, they always are.",
          "What's that? One of them dropped a note? \"They aren't what they seem.\" Who, I wonder. Ha! Ashbound nonsense. Keep it if you like.",
          "Here's your bounty pay, from the Emberhall's own purse.",
        ],
        give: [{ item: "ashbound_note" }],
        coins: 150, xp: { renown: 60 },
      },
    ],
  },
  {
    id: "rebuild", act: "act1", title: "Rebuild the Shrine", giver: "aldric", name: ALDRIC, where: LIGHTHALL, after: ["first_tithe", "totem", "ash_road", "greta", "brann"],
    steps: [
      {
        task: `Talk to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "The Westroad is clear, Rook's totem is ready, and you've learned to mine and smelt. Let's rebuild that shrine!",
          "The Emberguard have the stone cut already. Bring 6 oak logs for the frame and 2 bronze bars to bind it. I'll have Rook carve a second totem for the top: pick it up from him on your way.",
        ],
      },
      {
        task: "Get 6 oak logs and 2 bronze bars", goal: { kind: "have", items: { oak_logs: 6, bronze_bar: 2 } }, guaranteed: true,
        hint: "Chop oak trees (the round ones), mine copper and tin up at the quarry, and smelt bronze bars at Brann's furnace. Aldric's blessing steadies your hand: the two bars you need won't fail.",
      },
      {
        task: "Pick up the new totem from Woodworker Rook", goal: { kind: "talk" }, who: "rook",
        lines: ["Another totem for the Westroad? Already done. Here.", "No note in this one. Just wood."],
        give: [{ item: "shrine_totem" }],
      },
      {
        task: "Rebuild the Westroad shrine (far west, along the main road)", goal: { kind: "talk" }, who: "west_shrine",
        take: { oak_logs: 6, bronze_bar: 2, shrine_totem: 1 },
        lines: [
          "You raise the oak frame, the Emberguard stack their white stone around it, you bind it with bronze, and set Rook's totem on top. Two Emberguard arrive and say a prayer, and the shrine lights up gold.",
          "Then you notice the grass. All round the shrine, in a ring, it's turning brown.",
          "Maybe it was always like that.",
        ],
      },
      {
        task: `Go back to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "It's lit! I felt it from here. The Westroad shrine will raise heroes again: if you fall out west, you'll wake there now.",
          "Here: health potions, and the Emberhall's thanks.",
        ],
        give: [{ item: "health_potion", count: 3 }],
        coins: 120,
      },
    ],
  },
  {
    id: "holt_saw", act: "act1", title: "What Holt Saw", giver: "holt", name: "Forester Holt", where: "on Trainer Row, east of the square", after: ["oath", "holt"],
    steps: [
      {
        task: "Talk to Forester Holt", goal: { kind: "talk" },
        lines: [
          "You've got the Emberhall's ear now. Can I ask you something, quiet-like?",
          "I've been a forester forty years, and I swear the trees nearest the shrines die first. Nobody believes me.",
          "Count the dead trees in six places for me: three near shrines (the Emberhall's garden, the Westroad shrine and the Thornwood gate) and three far from any (north of the lake, the Greyspine foothills, and the north coast woods). The 🗺️ map marks them.",
        ],
      },
      {
        task: "Count dead trees in 6 places", goal: { kind: "reach", spots: ["spot.nearLighthall", "spot.nearWestShrine", "spot.nearGate", "spot.farLake", "spot.farPeaks", "spot.farCoast"], names: "places" },
        hint: "Three near shrines: the Emberhall's garden, the Westroad shrine, the Thornwood gate. Three far away: north of the lake, the Greyspine foothills, the north coast woods. The 🗺️ map marks them.",
        spotLines: {
          "spot.nearLighthall": "By the Emberhall: 9 dead trees out of 12.",
          "spot.nearWestShrine": "By the Westroad shrine: 11 dead trees out of 13.",
          "spot.nearGate": "By the Thornwood gate: 8 dead trees out of 10.",
          "spot.farLake": "North of the lake: 1 dead tree out of 14.",
          "spot.farPeaks": "In the foothills: none dead out of 9.",
          "spot.farCoast": "In the coast woods: 1 dead tree out of 11.",
        },
      },
      {
        task: "Go back to Forester Holt", goal: { kind: "talk" },
        lines: [
          "Twenty-eight dead near the shrines, and two far away? I knew it. I knew it!",
          "Now, it could be the Ashbound, poisoning the ground round the shrines to spite the Emberhall. That's what the Keepers would say.",
          "Keep those notes. And keep it under your hat, eh?",
        ],
        give: [{ item: "holts_notes" }],
        xp: { woodcutting: 150 },
      },
    ],
  },
  {
    id: "odo_field", act: "act1", title: "Odo's Stubborn Field", giver: "odo", name: "Farmer Odo", where: "at the farm: follow the road east, over the river bridge", after: ["oath", "odo"],
    steps: [
      {
        task: "Talk to Farmer Odo", goal: { kind: "talk" },
        lines: [
          "You again. Come to bless my turnips? No? Then what?",
          "Hm. You want to know why I won't take their blessings. I'll show you. Grow a crop on your plot, start to finish, with no blessing on you. Not one.",
          "Plant 4 seeds and harvest 4 crops, unblessed. If you read a scroll, it doesn't count.",
        ],
      },
      {
        task: "Plant 4 seeds on your plot", goal: { kind: "plant", count: 4 },
        hint: "Click your plot's soil with seeds in your bag. I sell seeds.",
      },
      {
        task: "Harvest 4 crops with no blessing on you", goal: { kind: "harvest", count: 4, unblessed: true },
        hint: "Wait till they're ripe, then click them. Not while you're blessed, mind!",
      },
      {
        task: "Go back to Farmer Odo", goal: { kind: "talk" },
        lines: [
          "Grew just fine, didn't they? No shrine needed.",
          "In the old days, before the Emberhall, every farm grew like this. Then the shrines came, and the blessings, and the ground got tired. Funny, that.",
          "Here: my grandmother's blue lotus seeds. Never been blessed in a hundred years. Look after them.",
        ],
        give: [{ item: "seed_blue_lotus", count: 5 }],
        xp: { farming: 80 },
      },
    ],
  },
  {
    id: "hollow_wolves", act: "act1", title: "The Hollow Wolves", giver: "kael", name: "Huntmaster Kael", where: "in his lodge in the Lower Town", after: ["oath", "kael"],
    steps: [
      {
        task: "Talk to Huntmaster Kael", goal: { kind: "talk" },
        lines: [
          "You've heard about the grey wolves? Blighted, the Emberguard call them. Hollow-eyed, glowing, and mean.",
          "There's a pack of them at Wolf Hollow, south-west through the Thornwood. Clear 5. Take a friend if you can.",
          "And here's a funny thing. The Blight is always worst downhill of a shrine. Always.",
        ],
      },
      {
        task: "Defeat 5 hollow wolves at Wolf Hollow (Thornwood, south-west)", goal: { kind: "kill", monster: "hollow_wolf", count: 5 },
        hint: "Wolf Hollow is south-west through the Thornwood: take the gate path south, then the west track. They run in a pack: fight them one at a time if you can.",
        fightWith: "weapon",
      },
      {
        task: "Go back to Huntmaster Kael", goal: { kind: "talk" }, warden: true,
        lines: [
          "Five! You've earned this. It was mine, when I was a Warden of the Thornwood, before the Emberhall took the Wardens over.",
          "Look after it. And keep your eyes open out there.",
        ],
        coins: 200,
      },
    ],
  },
  {
    id: "marens_question", act: "act1", title: "Maren's Question", giver: "maren", name: "Old Maren", where: "in her cottage on the lake shore, west along the road from the square", after: ["first_tithe"],
    steps: [
      {
        task: "Talk to Old Maren", goal: { kind: "talk" },
        lines: [
          "Come here, child. Closer. Quietly now.",
          "Have you died yet? Since the Oath, I mean. Have they put their gold on you?",
          "When you woke... did it feel like something was taken? Like you came back a little less?",
          "No. Don't answer. Not here, not even with the door shut. Just keep this, and remember I asked.",
        ],
        give: [{ item: "marens_charm" }],
      },
    ],
  },
  {
    id: "thorn_light", act: "act1", title: "A Flame in the Thornwood", giver: "aldric", name: ALDRIC, where: LIGHTHALL, after: ["rebuild", "hollow_wolves", "marens_question"],
    steps: [
      {
        task: `Talk to ${ALDRIC}`, goal: { kind: "talk" },
        lines: [
          "This is the day, friend. The Thornwood has never had a shrine. Today it gets one.",
          "Two of our Emberguard will go with you to the clearing just past Kael's gate. Keep them safe while they work, then light the shrine yourself.",
        ],
      },
      {
        task: "Lead the Emberguard to the clearing past Kael's gate", goal: { kind: "reach", spots: ["spot.thornEdge"], names: "clearing" },
        hint: "Go through Kael's gate and follow the path south to the clearing.",
        spotLines: { "spot.thornEdge": "The two Emberguard catch up, and start laying out the shrine stones. Wolves are circling." },
      },
      {
        task: "Keep the Emberguard safe: defeat 4 wolves", goal: { kind: "kill", monster: "wolf", count: 4 },
        hint: "Wolves prowl round the clearing past the gate. Keep them off the Emberguard.",
        fightWith: "weapon",
      },
      {
        task: "Light the Thornwood shrine", goal: { kind: "visit", npcs: ["thorn_shrine"], names: "Thornwood shrine" },
        hint: "The new shrine is in the clearing just past the gate. Click it.",
        visitLines: { thorn_shrine: ["You put your hand to the stone. Embers run up it, and a flame blazes up gold. The Thornwood's first shrine is lit.", "Someone is clapping behind you."] },
      },
      {
        task: "Meet the stranger by the shrine", goal: { kind: "talk" }, who: "rhys",
        lines: [
          "Nicely done! I'm Rhys. Emberborn, same as you: woke up at the Heart Shrine a few weeks before you did.",
          "They made me a Flame last week. I'm going all the way: one day I'll have a statue in the Emberhall, with the Extinguished. Brother Oren says I've got the spark for it.",
          "Race you there! Ha!",
        ],
      },
      {
        task: `Go back to ${ALDRIC}`, goal: { kind: "talk" }, rank: 2,
        lines: [
          "The Thornwood shrine is lit! You'll wake there now, if you fall in the forest. That's your work, friend.",
          "Kneel. By the flame of the Heart Shrine, I name you a Flame of the Emberhall.",
          "You've met Rhys, I hear? He's very keen. Between the two of you, the Thornwood won't know what hit it.",
          "Rest a while. Bigger things are coming.",
        ],
        coins: 300,
      },
    ],
  },
];

/** Story lines the trainers add to their lessons (the last thing they say). */
export const TRAINER_LINES: Record<string, string> = {
  tam: "Mind you, trade's not what it was. The routes west have all closed since the Barrens went bad.",
  holt: "Funny thing. The trees nearest the shrine always die first. Nobody listens to an old forester, though.",
  greta: "The emberstone veins in the quarry are dimmer every year. Used to light up the whole pit at night.",
  brann: "You Emberborn wear out my tools faster than anyone. Not that I'm complaining about the business.",
  rook: "I'm carving a shrine totem for the Emberguard next. Oak, always oak for them.",
  kael: "One more thing. A wolf came to the gate last night: grey, with eyes that glowed. Blighted, the Emberguard call it. Watch for them.",
  wren: "I've been marking the dying patches on my map. There are more every season, and they spread out from the shrines like spilled ink.",
  ysolde: "The Emberguard do such noble work. They fund half this guild, you know.",
  moss: "Now if you'll excuse me, I've a big order of Tithe tonics to brew for the Emberhall.",
  bryn: "You'll see Ashbound posters on the board now. The Emberhall pays for those bounties.",
  odo: "And another thing: the Emberguard will offer you their blessings. Never took one myself. Never will.",
  kael_hunt: "That alpha was Blighted, did you see? Grey, and glowing. I've never seen one that big.",
  bryn_bandits: "One of those Ashbound raiders shouted something as he ran: \"Every time you rise, the land falls!\" Madness.",
};
