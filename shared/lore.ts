// Books on the shelves. Click a bookshelf and you take a book down and read a
// page or two: the history of Embervale, the shrines, the towns and the people.
// None of it is needed for any quest; it's there for anyone who likes to know
// more. Which book a shelf holds depends on the room (the Emberhall's library
// keeps the Emberguard's own histories, the Mages' Guild its magic) and on
// the shelf, so the same shelf always holds the same book.
//
// A few of them don't quite agree with each other. That's on purpose.

export interface Book { title: string; pages: string[] }

/** The Emberhall: the Emberguard's library. Their side of the story. */
const LIGHTHALL: Book[] = [
  {
    title: "The Emberfall",
    pages: [
      "Eight hundred years ago the land's fire burst up out of the earth under Heartvale. Embers rained down across Aldmera for a whole year, and the ground fell in where the valley is now. We count the years from it: this is the eight hundredth year After the Fall.",
      "King Aldemar went down into the fire himself and poured his own ember into it, holding it back like a door against a storm. It cost him his life, but it held for a year, and in that year the Ember Circle raised the shrines. When the king's strength gave out, the shrines held. The Emberguard have kept them lit ever since.",
      "Pressed between the last pages, a dry leaf and a note in an old hand: \"Fire does not burst up on its own. Ask what was dug.\"",
    ],
  },
  {
    title: "The Sundering War (a short history for new Emberborn)",
    pages: [
      "Before the Fall, Embervale was Aldmera: green from the Greyspine to the sea, ruled from Whitestone, the city of white stone in what is now the Barrens.",
      "Four hundred years after the Fall, Wick, who had stood beside the king and helped raise the shrines, turned half the Circle against the rest and tried to tear the shrines down. The war lasted a hundred years, and when it ended there were barely enough people left to bury the dead.",
      "The Archmage Vale won it, and died winning it. Wick was driven out, and his shrine in the north went cold. The Emberwardens carry the old Circle names as titles now, and the Emberguard keep the shrines lit.",
    ],
  },
  {
    title: "On the Shrines, by Keeper Aldric",
    pages: [
      "A shrine is a door the ember comes through. It finds a spark in the Emberheart, deep under Heartvale, and gives it a body.",
      "When an Emberborn falls, the shrine nearest them gathers up what's left of the spark and makes them again. We do not fully understand it. We tend it, as a gardener tends what he did not plant.",
      "Every shrine must be lit by hand, and kept lit. A dark shrine raises no one.",
    ],
  },
  {
    title: "The Order of the Emberguard: its Rule",
    pages: [
      "1. Welcome every Emberborn who wakes. 2. Keep every shrine lit. 3. Write down every deed, so the Emberheart remembers.",
      "4. Ask nothing of the Rooted (the ordinary folk) but their trust. 5. Honor the worthy with Radiance.",
      "6. The ledgers are for the Keepers alone. (Someone has underlined this one twice.)",
    ],
  },
  {
    title: "A Calendar of Radiance Ceremonies",
    pages: [
      "A long list of names and years, one every few decades. Halric. Ida. Tilda. Orla. Dozens more.",
      "Beside each name, in a neat hand: \"ember returned to the Heart Shrine\". Beside a few, in a different ink: \"spark flawed\".",
      "One line near the end has been cut out of the page with a very sharp knife.",
    ],
  },
  {
    title: "Halric the Dawnbringer: a Ballad",
    pages: [
      "Eleven times he fell upon the stone, / eleven times the morning brought him home...",
      "The rest is mostly about his shield, which seems to have been very large.",
    ],
  },
  {
    title: "The Withering: notes from the Barrens",
    pages: [
      "It begins at the far edges of things, wherever a place lies farthest from a shrine. Grass greys, then crumbles. Animals grow thin and angry. Wells taste of ash.",
      "The Ashbound are said to poison it. Whatever the cause, the shrines are the only warmth the Barrens have left.",
      "Note in the margin, in pencil: \"If the shrines keep the land alive, why does their warmth reach a little less far every year?\" It has been rubbed half out.",
    ],
  },
  {
    title: "An Emberborn's First Week (a guide)",
    pages: [
      "Do not be frightened that you remember nothing. None of you do. A new spark has no past, only a future.",
      "Learn a trade. Eat well. Light a lantern when you can. And when you fall, as you will, the shrine brings you home.",
    ],
  },
  {
    title: "The Grey Fever, and Orla the Kind",
    pages: [
      "Forty winters ago a fever came down the Westroad and emptied whole villages. Orla went from door to door with nothing but a basket and a kettle.",
      "She caught the fever nine times. Nine times the shrine sent her back, a little paler each time. Folk say that by the end she was almost see-through.",
    ],
  },
];

/** The Mages' Guild: magic, emberstone and the Emberheart. */
const GUILD: Book[] = [
  {
    title: "Emberstone: its Nature and Uses",
    pages: [
      "Emberstone grows only where the Emberheart's warmth runs close under the rock: the crystal caves above all.",
      "It holds power the way a sponge holds water. Cut into gems, it feeds enchantments. The Emberguard buy every cartload we can dig; what they do with it, they don't say.",
    ],
  },
  {
    title: "First Spells, by Archmage Rowan",
    pages: [
      "A spell is a shape you make with your mind, and mana is what you fill it with. Small shapes first: a spark, a bolt.",
      "Cloth helps. Nobody is sure why. Metal hinders. Everybody is sure why: try thinking clearly in a helmet.",
    ],
  },
  {
    title: "Vale: Archmage, Builder of Shrines",
    pages: [
      "The greatest mage Embervale ever had. He tapped the Emberheart itself to build the shrines, and saved what was left of the land.",
      "He is said to have died soon after the war. Oddly, no one knows where he is buried.",
    ],
  },
  {
    title: "On Enchanting",
    pages: [
      "An enchantment is a little piece of a refined emberstone's power, woven into a thing. Weapons take fire and frost; armor takes warding.",
      "Enchanter Vale of the Emberhall is the finest enchanter living. He is very old. Some say older than the Guild.",
    ],
  },
  {
    title: "The Emberheart",
    pages: [
      "Deep under Heartvale there is said to be a cavern where a great fire burns, beating as slow as a heart: the Emberheart, where every living thing's spark comes from.",
      "It is not endless. Old Guild records say it was brighter once. The records stop saying anything about it at all, about three hundred years ago.",
    ],
  },
];

/** Everywhere else: Emberhold's own books (shops, houses, cottages). */
const TOWN: Book[] = [
  {
    title: "Emberhold: a Town History",
    pages: [
      "Emberhold grew up around the Emberhall after the war: first tents, then timber, then stone. The square was a sheep market before it was a square.",
      "The well in the square has never run dry. Captain Bryn's grandfather swore he saw a fish in it once.",
    ],
  },
  {
    title: "The Fisher's Almanac",
    pages: [
      "Minnows in the shallows, trout by the town, perch to the south, pike out west. Salmon in the river, if you're patient.",
      "Never fish with a borrowed rod. Never whistle on the water. Always thank the lake.",
    ],
  },
  {
    title: "Herbs of the Valley",
    pages: [
      "Wild root: dig it near the lake. Red cap: find it under oaks. Moonpetal: only at night, and only if you're lucky.",
      "Herbalist Wren adds, in her own hand: the plants at the valley's edge, farthest from the shrines, are dying first. They never used to. Why?",
    ],
  },
  {
    title: "Tam's Ledger (old, for 'reference')",
    pages: [
      "Rods: 12. Pots: 8. Stew: 30 bowls (Maren's recipe). Potions: 6 (don't ask Moss where he gets the slime).",
      "Owed by Captain Bryn: one bottle, one favour, and an apology.",
    ],
  },
  {
    title: "A Child's Book of the Emberborn",
    pages: [
      "\"Where do heroes come from?\" asked little Pip. \"From the Emberheart,\" said his mother. \"And where do they go?\" \"Back to the Emberheart, when they're done.\"",
      "Pip thought about this for a long time. \"That's sad,\" he said. His mother didn't answer.",
    ],
  },
  {
    title: "Old Maren's Recipes",
    pages: [
      "Stew: anything you've got, a good fire, and patience. The more you put in, the easier it is to burn, so watch it close.",
      "On the last page, in a shaky hand: \"Some fires should go out. Remember that.\"",
    ],
  },
];

const BOOKS: Record<string, Book[]> = { lighthall: LIGHTHALL, guild: GUILD };
/** Every book, by where its shelves are (the wiki lists them all: wiki/build.ts). */
export const ALL_BOOKS: Record<"lighthall" | "guild" | "town", Book[]> = { lighthall: LIGHTHALL, guild: GUILD, town: TOWN };

/** The book on the shelf at tile (x, y), in the area with this id. */
export function bookAt(areaId: string, x: number, y: number): Book {
  const list = BOOKS[areaId] ?? TOWN;
  const h = Math.abs((x * 73856093) ^ (y * 19349663)) % list.length;
  return list[h];
}
