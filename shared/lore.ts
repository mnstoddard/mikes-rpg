// Books on the shelves. Click a bookshelf and you take a book down and read a
// page or two: the history of Elderra, the shrines, the towns and the people.
// None of it is needed for any quest; it's there for anyone who likes to know
// more. Which book a shelf holds depends on the room (the Lighthall's library
// keeps the Lightkeepers' own histories, the Mages' Guild its magic) and on
// the shelf, so the same shelf always holds the same book.
//
// A few of them don't quite agree with each other. That's on purpose.

export interface Book { title: string; pages: string[] }

/** The Lighthall: the Lightkeepers' library. Their side of the story. */
const LIGHTHALL: Book[] = [
  {
    title: "The Sundering War (a short history for new Kindled)",
    pages: [
      "Before the war, Elderra was the kingdom of Aurel: green from the Greyspine to the sea, ruled from a city of white stone in what is now the Barrens.",
      "No one now living remembers how the war began. It ended with Aurel's crown lost, its city in ruins, and barely enough people left to bury the dead.",
      "It was then that the Archmage Vael built the first shrines, and the first Kindled woke. The Lightkeepers have kept his shrines lit ever since.",
    ],
  },
  {
    title: "On the Shrines, by Keeper Aldric",
    pages: [
      "A shrine is a door the light comes through. It finds a spark in the Wellspring, deep under the mountains, and gives it a body.",
      "When a Kindled falls, the shrine nearest them gathers up what's left of the spark and makes them again. We do not fully understand it. We tend it, as a gardener tends what he did not plant.",
      "Every shrine must be lit by hand, and kept lit. A dark shrine raises no one.",
    ],
  },
  {
    title: "The Order of the Lightkeepers: its Rule",
    pages: [
      "1. Welcome every Kindled who wakes. 2. Keep every shrine lit. 3. Write down every deed, so the light remembers.",
      "4. Ask nothing of the Rooted (the ordinary folk) but their trust. 5. Honor the worthy with Radiance.",
      "6. The ledgers are for the Keepers alone. (Someone has underlined this one twice.)",
    ],
  },
  {
    title: "A Calendar of Radiance Ceremonies",
    pages: [
      "A long list of names and years, one every few decades. Halric. Ysra. Tilda. Orla. Dozens more.",
      "Beside each name, in a neat hand: \"light returned to the Heart Shrine\". Beside a few, in a different ink: \"spark flawed\".",
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
      "It began in the far west, where Aurel's city stood. Grass greys, then crumbles. Animals grow thin and angry. Wells taste of ash.",
      "The Ashbound blame the shrines. This is, of course, nonsense. The shrines are the only light the Barrens have left.",
      "Note in the margin, in pencil: \"Then why is it worst where the shrines are brightest?\" It has been rubbed half out.",
    ],
  },
  {
    title: "A Kindled's First Week (a guide)",
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

/** The Mages' Guild: magic, soul stone and the Wellspring. */
const GUILD: Book[] = [
  {
    title: "Soul Stone: its Nature and Uses",
    pages: [
      "Soul stone grows only where the Wellspring's light runs close under the rock: the crystal caves above all.",
      "It holds power the way a sponge holds water. Cut into gems, it feeds enchantments. The Lightkeepers buy every cartload we can dig; what they do with it, they don't say.",
    ],
  },
  {
    title: "First Spells, by Archmage Ysolde",
    pages: [
      "A spell is a shape you make with your mind, and mana is what you fill it with. Small shapes first: a spark, a bolt.",
      "Cloth helps. Nobody is sure why. Metal hinders. Everybody is sure why: try thinking clearly in a helmet.",
    ],
  },
  {
    title: "Vael: Archmage, Builder of Shrines",
    pages: [
      "The greatest mage Elderra ever had. He tapped the Wellspring itself to build the shrines, and saved what was left of the land.",
      "He is said to have died soon after the war. Oddly, no one knows where he is buried.",
    ],
  },
  {
    title: "On Enchanting",
    pages: [
      "An enchantment is a little piece of a soul gem's power, woven into a thing. Weapons take fire and frost; armor takes warding.",
      "Enchanter Vale of the Lighthall is the finest enchanter living. He is very old. Some say older than the Guild.",
    ],
  },
  {
    title: "The Wellspring",
    pages: [
      "Under the Greyspine there is said to be a cavern full of light: the Wellspring, where every living thing's spark comes from.",
      "It is not endless. Old Guild records say it was brighter once. The records stop saying anything about it at all, about three hundred years ago.",
    ],
  },
];

/** Everywhere else: Heartvale's own books (shops, houses, cottages). */
const TOWN: Book[] = [
  {
    title: "Heartvale: a Town History",
    pages: [
      "Heartvale grew up around the Lighthall after the war: first tents, then timber, then stone. The square was a sheep market before it was a square.",
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
      "Herbalist Wren adds, in her own hand: the plants by the shrines are dying first. Why?",
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
    title: "A Child's Book of the Kindled",
    pages: [
      "\"Where do heroes come from?\" asked little Pip. \"From the light,\" said his mother. \"And where do they go?\" \"Back to the light, when they're done.\"",
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

/** The book on the shelf at tile (x, y), in the area with this id. */
export function bookAt(areaId: string, x: number, y: number): Book {
  const list = BOOKS[areaId] ?? TOWN;
  const h = Math.abs((x * 73856093) ^ (y * 19349663)) % list.length;
  return list[h];
}
