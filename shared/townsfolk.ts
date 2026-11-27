// Townsfolk (version 0.14, Mike's note #7): ordinary people of Emberhold going
// about their day, so the town and the Emberhall feel lived in. They aren't part
// of any quest and don't block anyone's way. Each walks a loop between a few
// spots and stops a moment at each. Everyone sees them in the same place,
// because where they are depends only on the world clock.
//
// Click one and they say something (one of their lines, picked by the clock).
// The 3D game draws them (client3d/src/game/townsfolk.ts); the wiki lists them.
import { AREAS, type Point } from "./world";

export interface TownsfolkDef {
  id: string;
  name: string;
  /** A little emoji over their name. */
  badge: string;
  /** Who they are, for the wiki. */
  about: string;
  /** The place they walk in (an area id: "emberhold" is the city, "heartvale" the land outside). */
  area: string;
  /** The spots they walk between, in order, then back to the first (tiles inside their area). */
  route: Point[];
  /** Tiles a second (people walk about 1.5). */
  speed: number;
  /** Seconds they stop at each spot. */
  pause: number;
  /** What they say when you click them. */
  lines: string[];
}

export const TOWNSFOLK: TownsfolkDef[] = [
  // ---- The town square and the roads ----
  {
    id: "hanna", name: "Baker Hanna", badge: "🥖", about: "Bakes the town's bread, and walks it round the square every morning.",
    area: "emberhold", route: [{ x: 61, y: 54 }, { x: 84, y: 54 }, { x: 84, y: 64 }, { x: 61, y: 64 }], speed: 1.3, pause: 4,
    lines: ["Fresh loaves! Well, fresh this morning.", "The Emberguard buy half my bread. All those Hopefuls eat like wolves.", "If you smell burning, it's not the bakery. Probably."],
  },
  {
    id: "pip", name: "Pip", badge: "🪁", about: "A little boy who runs round the well all day. He wants to be an Emberborn when he grows up.",
    area: "emberhold", route: [{ x: 72, y: 56 }, { x: 76, y: 56 }, { x: 76, y: 60 }, { x: 72, y: 60 }], speed: 2.4, pause: 1,
    lines: ["Are you an Emberborn? Did you really come out of the fire? Does it hurt?", "When I grow up I'm going to have a statue in the Emberhall!", "Mum says I'm not allowed past the well."],
  },
  {
    id: "ada", name: "Mother Ada", badge: "🧺", about: "Pip's mother. She keeps one eye on her washing and one on Pip.",
    area: "emberhold", route: [{ x: 78, y: 61 }, { x: 88, y: 61 }], speed: 1.1, pause: 6,
    lines: ["Have you seen Pip? Small, loud, covered in mud?", "Every child in town wants to be an Emberborn. I'd rather he was a baker."],
  },
  {
    id: "dunstan", name: "Guard Dunstan", badge: "🛡️", about: "Walks the long street from the West Gate to the Saltmere Gate, keeping an eye out for trouble.",
    area: "emberhold", route: [{ x: 14, y: 57 }, { x: 133, y: 57 }], speed: 1.2, pause: 5,
    lines: ["Move along, nothing to see. Unless you've seen Ashbound. Have you?", "Quiet day. I like quiet days.", "Keep out of the Thornwood till Kael says you're ready."],
  },
  {
    id: "lyle", name: "Merchant Lyle", badge: "🧳", about: "A travelling trader, stuck in town since the roads west closed.",
    area: "emberhold", route: [{ x: 125, y: 48 }, { x: 125, y: 66 }], speed: 1.3, pause: 4,
    lines: ["I used to sell silk from the west. Now I sell... hope, mostly.", "The Barrens road's been shut for a year. A whole year!"],
  },
  {
    id: "pell", name: "Old Pell", badge: "🦯", about: "The oldest man in Emberhold. He walks slowly up and down outside the inn.",
    area: "emberhold", route: [{ x: 73, y: 70 }, { x: 73, y: 76 }], speed: 0.6, pause: 8,
    lines: ["In my day the Emberhall's flame was so bright you could read by it from the square.", "Eh? Speak up.", "I've seen a lot of you Emberborn come and go. Mostly go."],
  },
  {
    id: "jory", name: "Farmhand Jory", badge: "🌾", about: "Works for Farmer Odo, and walks between the training ground and the Lower Town allotments all day.",
    area: "emberhold", route: [{ x: 92, y: 58 }, { x: 92, y: 79 }], speed: 1.5, pause: 3,
    lines: ["Odo says the far fields, out past the shrine's warmth, are going grey first. The Emberguard say it's just tired soil.", "Off to market. Again."],
  },
  {
    id: "cole", name: "Fisher Cole", badge: "🎣", about: "Fishes off the docks, like Old Maren used to. He walks the wharf all day.",
    area: "emberhold", route: [{ x: 110, y: 30 }, { x: 110, y: 90 }], speed: 1.0, pause: 6,
    lines: ["Old Maren taught me to fish. Taught everyone, really.", "Trout are biting by the shore today."],
  },
  // ---- Inside the Emberhall ----
  {
    id: "bram", name: "Acolyte Bram", badge: "🧹", about: "A young Emberguard acolyte who sweeps the great hall of the Emberhall.",
    area: "lighthall", route: [{ x: 16, y: 22 }, { x: 16, y: 11 }, { x: 20, y: 11 }, { x: 20, y: 22 }], speed: 0.9, pause: 3,
    lines: ["Ash, ash, always ash. That flame never stops dropping it.", "Mind your feet, I've just swept there.", "One day I'll be a proper Brother, like Oren."],
  },
  {
    id: "mira", name: "Acolyte Mira", badge: "🕯️", about: "Tends the braziers in the great hall, so they never go out.",
    area: "lighthall", route: [{ x: 15, y: 5 }, { x: 15, y: 22 }, { x: 21, y: 22 }, { x: 21, y: 5 }], speed: 1.0, pause: 5,
    lines: ["Every brazier is lit from the Heart Shrine's flame. Never from a tinderbox. That's the rule.", "If a brazier goes out, Keeper Aldric gets very quiet. I don't like it when he's quiet."],
  },
  {
    id: "ennis", name: "Pilgrim Ennis", badge: "🙏", about: "Came all the way from the Saltmere coast to see the Heart Shrine.",
    area: "lighthall", route: [{ x: 18, y: 23 }, { x: 18, y: 10 }], speed: 0.7, pause: 10,
    lines: ["I walked here from the coast just to see the flame. It's even brighter than they said.", "My grandmother says Ida of the Saltmere lit our village's shrine. Her statue's right there!"],
  },
  {
    id: "quill", name: "Scholar Quill", badge: "📖", about: "Reads in the Emberhall's library from morning to night.",
    area: "lighthall", route: [{ x: 5, y: 5 }, { x: 8, y: 6 }, { x: 8, y: 9 }, { x: 5, y: 9 }], speed: 0.8, pause: 7,
    lines: ["Shh. Library.", "Have you read the one about the Emberfall? Someone's written in the back of it. Shocking."],
  },
  {
    id: "rosa", name: "Healer Rosa", badge: "🩹", about: "Helps Sister Wynne in the infirmary, going from room to room.",
    area: "lighthall", route: [{ x: 27, y: 2 }, { x: 28, y: 9 }, { x: 27, y: 16 }, { x: 28, y: 24 }], speed: 1.1, pause: 5,
    lines: ["Each patient gets their own room now. So much quieter than the old dormitory!", "Don't run in the infirmary, please."],
  },
  // ---- The Hearthstone Inn ----
  {
    id: "bess", name: "Innkeeper Bess", badge: "🍺", about: "Runs the Hearthstone Inn, and knows everyone's business.",
    area: "inn", route: [{ x: 3, y: 6 }, { x: 10, y: 6 }, { x: 10, y: 4 }, { x: 7, y: 2 }], speed: 1.2, pause: 4,
    lines: ["Welcome to the Hearthstone! Sit anywhere, mind the dog.", "Someone painted words on my wall last week. Red paint. The Emberguard scrubbed it off quick as you like."],
  },
];

/** A route spot on the whole-world grid (areas sit at different places on it). */
export function worldSpot(f: TownsfolkDef, p: Point): Point {
  const a = AREAS.find((ar) => ar.id === f.area);
  if (!a) throw new Error(`No area called ${f.area}`);
  return a.x === 0 && a.y === 0 ? p : { x: a.x + p.x, y: a.y + p.y };
}
