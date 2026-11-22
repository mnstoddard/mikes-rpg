// The environment library: everything in the world that isn't an item, a
// tree, a rock or a creature. Ground, floors, building parts, wall ornaments,
// ground decorations, water and sky, all in one list.
//
// How to use one in the game:
//   import { createEnv } from "./environment";
//   const grass = createEnv("ground-grass", { variant: 0, x0: 0, z0: 0, w: 20, d: 20 });
//   scene.add(grass.object);
//   // every frame:  grass.update(dt, time, { night, wind });
//
// Sizes are real, in metres; one 2D map tile is 2 m (TILE). "status" is Mike's
// review: only "approved" pieces should go into the game. The Environment
// Gallery page is where Mike approves each one.
import * as THREE from "three";
import { EnvPiece, TILE, disposeGroup } from "./kit";
import * as G from "./ground";
import * as B from "./building";
import * as O from "./ornaments";
import * as D from "./decor";
import * as W from "./water";
import { clouds, weather } from "./sky";

export { TILE, WALL_H, WALL_T } from "./kit";
export type { EnvPiece, EnvState } from "./kit";
export { createSkyDome, SKY_TIMES, type TimeOfDay, type SkyDome } from "./sky";
export { house, chimney } from "./building";

/** Mike's review of a piece. */
export type ReviewStatus = "waiting" | "approved" | "changes";

export type EnvCategory = "ground" | "floor" | "building" | "ornament" | "decor" | "water" | "sky";

export const CATEGORIES: Record<EnvCategory, { name: string }> = {
  ground: { name: "Ground" },
  floor: { name: "Floors" },
  building: { name: "Walls and roofs" },
  ornament: { name: "On the walls" },
  decor: { name: "Ground decorations" },
  water: { name: "Water" },
  sky: { name: "Sky" },
};

/** The sample scenes in the gallery, one for each kind of place in Elderra. */
export type SceneId = "town" | "farm" | "coast" | "thornwood" | "cave" | "house" | "hall" | "river";
export const SCENES: Record<SceneId, { name: string; about: string }> = {
  town: { name: "Town street", about: "Heartvale's cobbled streets, shops and lamps." },
  farm: { name: "The farm", about: "Fields, fences and the farmhouse." },
  coast: { name: "Saltmere Coast", about: "Sand, sea, rocks and shells." },
  thornwood: { name: "The Thornwood", about: "The Dark Forest: withered ground, brambles, the graveyard." },
  cave: { name: "Caves and the old mine", about: "Cave floor and walls, torches and crystals." },
  house: { name: "Inside a house", about: "Floorboards, wooden walls, a window and a lantern." },
  hall: { name: "The Lighthall", about: "White stone, gold, the glowing floor and the Mages' Guild colours." },
  river: { name: "River and lake", about: "The river, a bridge, the lake and a waterfall." },
};

export type EnvKind = "patch" | "wall" | "roof" | "door" | "ornament" | "decor" | "water" | "dome" | "clouds" | "weather";

export interface EnvType {
  /** "ground-grass", "wall-timber", "orn-lantern", "decor-well", "water-sea", "sky-clouds"... */
  id: string;
  name: string;
  category: EnvCategory;
  kind: EnvKind;
  /** One line about it. */
  about: string;
  /** Where it's used in Elderra. */
  where: string;
  variants: readonly string[];
  /** Its colour (list swatch). */
  color: number;
  /** Which sample scenes show it. */
  scenes: SceneId[];
  /** Mike's review. Updated from the Environment Gallery. */
  status: ReviewStatus;
}

export interface EnvOptions {
  variant?: number;
  seed?: number;
  /** Ground and floors: the patch of world to cover (defaults to one tile at 0,0). */
  x0?: number;
  z0?: number;
  w?: number;
  d?: number;
  /** Walls: how long (defaults to one tile). */
  length?: number;
}

type Build = (o: Required<EnvOptions>) => EnvPiece;

interface Entry extends Omit<EnvType, "status"> {
  build: Build;
}

const patch = (f: (o: G.PatchOptions) => EnvPiece): Build => (o) => f(o);
const wall = (f: (o: B.WallOptions) => EnvPiece): Build => (o) => f({ length: o.length, variant: o.variant, seed: o.seed });
const simple = (f: (o: { variant: number; seed: number }) => EnvPiece): Build => (o) => f({ variant: o.variant, seed: o.seed });
const roof = (r: B.RoofKind): Build => (o) => B.house({ tw: 3, td: 2, wall: "timber", wallVariant: 0, roof: r, roofVariant: o.variant, seed: o.seed }).piece;

const ENTRIES: Entry[] = [
  // ---------- Ground
  { id: "ground-grass", name: "Grass", category: "ground", kind: "patch", about: "The green grass that covers most of Heartvale.", where: "Everywhere outdoors: meadows, the pasture, round town.", variants: ["Soft", "Tufty", "Trimmed lawn"], color: 0x7fb24a, scenes: ["town", "farm", "river", "coast"], build: patch(G.grass) },
  { id: "ground-path", name: "Dirt path", category: "ground", kind: "patch", about: "Packed earth roads between places, with little stones.", where: "The roads out of town, to the farm, the quarry and the Thornwood.", variants: ["Packed", "Cart ruts", "Muddy"], color: 0xb89068, scenes: ["farm", "thornwood", "river"], build: patch(G.path) },
  { id: "ground-cobble", name: "Cobblestones", category: "ground", kind: "patch", about: "Rounded stones set in mortar, for the town's streets.", where: "Heartvale's streets and the square by the Lighthall.", variants: ["Grey town", "Warm sandstone", "Mossy"], color: 0x9c9a94, scenes: ["town", "hall"], build: patch(G.cobble) },
  { id: "ground-sand", name: "Sand", category: "ground", kind: "patch", about: "Pale sand with wind ripples.", where: "The Saltmere Coast's beaches.", variants: ["Dry", "Wet", "Dunes"], color: 0xead29a, scenes: ["coast"], build: patch(G.sand) },
  { id: "ground-withered", name: "Withered grass", category: "ground", kind: "patch", about: "Dry, grey grass where the blight has been.", where: "The Thornwood (Dark Forest) and the Barrens.", variants: ["Withered", "Blighted (glowing cracks)"], color: 0x7d7458, scenes: ["thornwood"], build: patch(G.withered) },
  { id: "ground-gravel", name: "Stony ground", category: "ground", kind: "patch", about: "Gravel and loose stones.", where: "The quarry, mountain paths and the graveyard.", variants: ["Gravel"], color: 0x9c988e, scenes: ["thornwood", "river"], build: patch(G.gravel) },
  { id: "ground-field", name: "Farm soil", category: "ground", kind: "patch", about: "Tilled rows of earth, ready for planting.", where: "The farm lots.", variants: ["Tilled", "Watered", "Sprouting"], color: 0x8a6442, scenes: ["farm"], build: patch(G.field) },
  { id: "ground-snow", name: "Snow", category: "ground", kind: "patch", about: "Lumpy snow with a few rocks poking through.", where: "The tops of the Greyspine Peaks.", variants: ["Fresh", "Icy"], color: 0xe8eef4, scenes: [], build: patch(G.snow) },
  // ---------- Floors
  { id: "floor-boards", name: "Floorboards", category: "floor", kind: "patch", about: "Wooden planks with nail heads.", where: "Inside houses, shops, the inn and trainers' places.", variants: ["Oak", "Dark walnut", "Worn pine"], color: 0xb07a48, scenes: ["house"], build: patch(G.boards) },
  { id: "floor-marble", name: "White stone floor", category: "floor", kind: "patch", about: "Polished stone tiles.", where: "The Lighthall.", variants: ["White", "Checkered", "Gold lines"], color: 0xf1eee6, scenes: ["hall"], build: patch(G.marble) },
  { id: "floor-rug", name: "Rugs and carpets", category: "floor", kind: "patch", about: "A woven rug with a border and diamonds.", where: "The Mages' Guild (purple), the Lighthall (gold carpet), the inn.", variants: ["Mages' purple", "Lighthall gold", "Inn red"], color: 0x5b3c8c, scenes: ["hall", "house"], build: patch(G.rug) },
  { id: "floor-glow", name: "Glowing floor", category: "floor", kind: "patch", about: "White stone with glowing rings and runes.", where: "In front of the Lighthall's great lantern.", variants: ["Golden", "Sky blue", "Violet"], color: 0xffe9a0, scenes: ["hall"], build: patch(G.glowFloor) },
  { id: "floor-cave", name: "Cave floor", category: "floor", kind: "patch", about: "Bumpy dark rock and pebbles.", where: "The spider cave, the wolf den and the old mine.", variants: ["Rocky", "Damp", "Mine track"], color: 0x5e5850, scenes: ["cave"], build: patch(G.caveFloor) },
  { id: "floor-crystal", name: "Crystal floor", category: "floor", kind: "patch", about: "Cave floor with glowing crystals growing out of it.", where: "The crystal cave.", variants: ["Amethyst", "Sapphire", "Mixed gems"], color: 0xb07ae8, scenes: ["cave"], build: patch(G.crystalFloor) },
  // ---------- Walls and roofs
  { id: "wall-timber", name: "Timber-frame wall", category: "building", kind: "wall", about: "Plaster between dark wooden beams, on a stone footing.", where: "Most houses and shops in Heartvale.", variants: ["Cream and brown", "White and black", "Ochre"], color: 0xeee0c0, scenes: ["town"], build: wall(B.timberWall) },
  { id: "wall-plank", name: "Wooden wall", category: "building", kind: "wall", about: "Walls of logs or boards.", where: "Forester Holt's house, Kael's lodge, the farm, and inside most buildings.", variants: ["Logs", "Boards", "Painted boards"], color: 0x9c6a42, scenes: ["farm", "house"], build: wall(B.plankWall) },
  { id: "wall-stone", name: "Stone wall", category: "building", kind: "wall", about: "Stone blocks laid in rows.", where: "The smithy, the inn's ground floor, town walls.", variants: ["Grey", "Sandstone", "Mossy"], color: 0x8e8c86, scenes: ["town", "thornwood"], build: wall(B.stoneWall) },
  { id: "wall-marble", name: "White stone wall", category: "building", kind: "wall", about: "Smooth white blocks with gold trim.", where: "The Lighthall.", variants: ["Plain", "Columns"], color: 0xf2efe8, scenes: ["hall"], build: wall(B.marbleWall) },
  { id: "wall-guild", name: "Mages' Guild wall", category: "building", kind: "wall", about: "Purple stone with a gold band and painted stars.", where: "The Mages' Guild.", variants: ["Starry", "Plain"], color: 0x6a4a9a, scenes: ["hall"], build: wall(B.guildWall) },
  { id: "wall-cave", name: "Cave wall", category: "building", kind: "wall", about: "A rough wall of big lumpy rocks.", where: "Every cave; the old mine has wooden supports.", variants: ["Grey", "Mine supports", "Crystal veins"], color: 0x5a554e, scenes: ["cave"], build: wall(B.caveWall) },
  { id: "wall-cliff", name: "Cliff", category: "building", kind: "wall", about: "A tall rock face in layers, with grass on top.", where: "The edges of the Greyspine Peaks and the quarry.", variants: ["Grassy top", "Snowy top"], color: 0x8a8072, scenes: ["river"], build: wall(B.cliff) },
  { id: "wall-hedge", name: "Hedge", category: "building", kind: "wall", about: "A leafy hedge you can't walk through.", where: "Round gardens, the pasture and the farm.", variants: ["Trimmed", "Wild", "Flowering"], color: 0x5a9a3c, scenes: ["farm", "town"], build: wall(B.hedge) },
  { id: "wall-fence", name: "Fence", category: "building", kind: "wall", about: "Posts and rails along a field or the Thornwood's edge.", where: "The farm, the pasture, the fence line above the Thornwood.", variants: ["Rail fence", "White picket", "Dry-stone wall"], color: 0x8a5c36, scenes: ["farm", "thornwood"], build: wall(B.fence) },
  { id: "wall-gate", name: "Gate", category: "building", kind: "door", about: "A two-door gate. Press the button to open it.", where: "The gate into the Thornwood, the farm and the pasture.", variants: ["Farm gate", "Town gate"], color: 0x6e4a2c, scenes: ["farm", "thornwood"], build: wall(B.gate) },
  { id: "wall-barricade", name: "Barricade", category: "building", kind: "wall", about: "Sharpened stakes tied together, to keep people out.", where: "The closed road to the Barrens, the goblin and Ashbound camps.", variants: ["Stakes"], color: 0x6e5034, scenes: ["thornwood"], build: wall(B.barricade) },
  { id: "wall-door", name: "Door", category: "building", kind: "door", about: "A door in its frame. Press the button to open it.", where: "Every building. The locked doors are iron-bound.", variants: ["Wooden", "Arched", "Iron-bound (locked)"], color: 0x8a5a34, scenes: ["town", "house"], build: wall(B.door) },
  { id: "wall-bridge", name: "Bridge", category: "building", kind: "wall", about: "A way over the river.", where: "The river crossings.", variants: ["Wooden planks", "Stone arch"], color: 0x9c6a42, scenes: ["river"], build: (o) => B.bridge({ length: 6, variant: o.variant, seed: o.seed }) },
  { id: "roof-tile", name: "Tiled roof", category: "building", kind: "roof", about: "Rows of overlapping clay or slate tiles.", where: "Shops and houses in town.", variants: ["Red clay", "Brown", "Blue slate"], color: 0xb8503a, scenes: ["town"], build: roof("tile") },
  { id: "roof-thatch", name: "Thatched roof", category: "building", kind: "roof", about: "Thick bundles of straw.", where: "The farm, Wren's hut and the cottages.", variants: ["Golden straw", "Pale straw"], color: 0xb8954e, scenes: ["farm"], build: roof("thatch") },
  { id: "roof-gold", name: "Gold roof", category: "building", kind: "roof", about: "Shining gold tiles.", where: "The Lighthall, in the middle of town.", variants: ["Plain", "With lantern tower"], color: 0xd9b44a, scenes: ["hall"], build: roof("gold") },
  // ---------- On the walls
  { id: "orn-lantern", name: "Wall lantern", category: "ornament", kind: "ornament", about: "A lantern on an iron arm. It lights up at night.", where: "Beside doors in town, the inn, the Mages' Guild (glass orb).", variants: ["Iron", "Brass", "Mage's glass orb"], color: 0xffc670, scenes: ["town", "house", "hall"], build: simple(O.wallLantern) },
  { id: "orn-window", name: "Window", category: "ornament", kind: "ornament", about: "Glass that glows warm at night. Shutters open and close.", where: "Every house and shop.", variants: ["Shuttered", "Round", "Leaded diamonds"], color: 0x9cc4d8, scenes: ["town", "farm", "house"], build: simple(O.windowPiece) },
  { id: "orn-sign", name: "Shop sign", category: "ornament", kind: "ornament", about: "A hanging board that swings in the wind.", where: "Over every shop and trainer's door.", variants: ["Smithy", "Inn", "General store"], color: 0x7a5232, scenes: ["town"], build: simple(O.shopSign) },
  { id: "orn-vines", name: "Climbing vines", category: "ornament", kind: "ornament", about: "Plants growing up a wall.", where: "Old houses (ivy), Wren's hut (flowering), the Thornwood (thorny).", variants: ["Ivy", "Flowering", "Thorny"], color: 0x3e7a2e, scenes: ["town", "thornwood"], build: simple(O.vines) },
  { id: "orn-flowerbox", name: "Flower box", category: "ornament", kind: "ornament", about: "A window box full of flowers.", where: "Under windows in town.", variants: ["Red geraniums", "Mixed", "Herbs"], color: 0xe04a4a, scenes: ["town", "farm"], build: simple(O.flowerBox) },
  { id: "orn-banner", name: "Banner", category: "ornament", kind: "ornament", about: "A cloth banner that ripples in the breeze.", where: "The Lighthall (gold), the Mages' Guild (purple), the town hall (green).", variants: ["Lighthall gold", "Mages' purple", "Heartvale green"], color: 0xe0b23a, scenes: ["hall", "town"], build: simple(O.banner) },
  { id: "orn-torch", name: "Wall torch", category: "ornament", kind: "ornament", about: "A burning torch in a holder. Always lit.", where: "Caves, the old mine and the camps.", variants: ["Iron holder", "Wooden holder"], color: 0xff8a20, scenes: ["cave"], build: simple(O.wallTorch) },
  { id: "orn-awning", name: "Awning", category: "ornament", kind: "ornament", about: "A striped cloth shade over a shop front.", where: "The General Store and market stalls.", variants: ["Red", "Blue", "Green"], color: 0xc84a3a, scenes: ["town"], build: simple(O.awning) },
  // ---------- Ground decorations
  { id: "decor-tufts", name: "Grass tufts", category: "decor", kind: "decor", about: "Clumps of longer grass that sway in the wind.", where: "Meadows, path edges and the pasture.", variants: ["Green", "Tall meadow", "Dry"], color: 0x76b24a, scenes: ["town", "farm", "river", "coast", "thornwood"], build: simple(D.grassTufts) },
  { id: "decor-flowers", name: "Wildflowers", category: "decor", kind: "decor", about: "Little patches of flowers.", where: "Meadows round town and the lake.", variants: ["Daisies", "Poppies", "Bluebells", "Mixed"], color: 0xf2d24a, scenes: ["town", "farm", "river"], build: simple(D.wildflowers) },
  { id: "decor-rocks", name: "Rocks", category: "decor", kind: "decor", about: "Boulders and stones (not the kind you can mine).", where: "Everywhere: fields, the coast, the Thornwood, caves.", variants: ["Grey", "Mossy", "Sandy pebbles"], color: 0x8e8a82, scenes: ["coast", "thornwood", "cave", "river"], build: simple(D.rocks) },
  { id: "decor-bush", name: "Bush", category: "decor", kind: "decor", about: "A round leafy bush.", where: "Gardens, fields and the edge of the woods.", variants: ["Leafy", "Berries", "Flowering"], color: 0x4e8e34, scenes: ["town", "farm", "river"], build: simple(D.bush) },
  { id: "decor-mushrooms", name: "Mushrooms", category: "decor", kind: "decor", about: "A little cluster of toadstools.", where: "The woods; the glowing ones grow in the Thornwood.", variants: ["Red caps", "Brown", "Glowing blue"], color: 0xd83a2a, scenes: ["thornwood", "cave"], build: simple(D.mushrooms) },
  { id: "decor-reeds", name: "Reeds", category: "decor", kind: "decor", about: "Tall water plants that grow at the edge.", where: "The lake shore and the river banks.", variants: ["Cattails", "Tall reeds"], color: 0x6a9a3a, scenes: ["river", "coast"], build: simple(D.reeds) },
  { id: "decor-log", name: "Fallen log", category: "decor", kind: "decor", about: "An old log or a stump.", where: "The woods and the Thornwood.", variants: ["Log", "Mossy log", "Stump"], color: 0x6e4a2c, scenes: ["thornwood", "river"], build: simple(D.fallenLog) },
  { id: "decor-bramble", name: "Brambles", category: "decor", kind: "decor", about: "A tangle of thorny stems.", where: "The Thornwood.", variants: ["Thorny", "Blighted (glowing)"], color: 0x3e3a2a, scenes: ["thornwood"], build: simple(D.bramble) },
  { id: "decor-beach", name: "Shells and driftwood", category: "decor", kind: "decor", about: "Things washed up on the beach.", where: "The Saltmere Coast.", variants: ["Shells", "Driftwood"], color: 0xf2c8b0, scenes: ["coast"], build: simple(D.beachBits) },
  { id: "decor-lamp", name: "Street lamp", category: "decor", kind: "decor", about: "A lamp post that lights up at night.", where: "Heartvale's streets and the Lighthall square.", variants: ["Iron", "Wooden post"], color: 0xffb050, scenes: ["town", "hall"], build: simple(D.streetLamp) },
  { id: "decor-well", name: "Well", category: "decor", kind: "decor", about: "A well with a bucket on a rope. Press the button to lower it.", where: "The town square and the farm.", variants: ["Stone", "Wooden"], color: 0x9a968c, scenes: ["town", "farm"], build: simple(D.well) },
  { id: "decor-grave", name: "Gravestone", category: "decor", kind: "decor", about: "A headstone with a grassy mound.", where: "The graveyard in the Thornwood.", variants: ["Rounded", "Cross", "Old and leaning"], color: 0x8e8c88, scenes: ["thornwood"], build: simple(D.gravestone) },
  { id: "decor-barrels", name: "Barrels and crates", category: "decor", kind: "decor", about: "Stacks of barrels, crates or sacks.", where: "Shops, the inn, the docks and the camps.", variants: ["Barrels", "Crates", "Sacks"], color: 0xa87a4c, scenes: ["town", "house", "cave", "farm"], build: simple(D.barrels) },
  { id: "decor-signpost", name: "Signpost", category: "decor", kind: "decor", about: "A post with a sign on it.", where: "The warning sign at the Thornwood gate; signposts at crossroads.", variants: ["Warning sign", "Direction arrows"], color: 0xd83a2a, scenes: ["thornwood", "farm"], build: simple(D.signpost) },
  { id: "decor-statue", name: "Statue", category: "decor", kind: "decor", about: "A white stone figure on a plinth.", where: "The Lighthall and its square.", variants: ["Lantern-bearer", "Scholar"], color: 0xeeeae2, scenes: ["hall"], build: simple(D.statue) },
  // ---------- Water
  { id: "water-pond", name: "Lake and ponds", category: "water", kind: "water", about: "Still water that ripples. Press the button to throw a stone in.", where: "The lake near town; ponds; the swamp in the Thornwood.", variants: ["Clear lake", "Lily pond", "Murky swamp"], color: 0x4a9ac8, scenes: ["river", "thornwood"], build: simple(W.pond) },
  { id: "water-river", name: "River", category: "water", kind: "water", about: "Flowing water with foam drifting downstream.", where: "The river down from the Greyspine Peaks.", variants: ["Gentle", "Rapids", "Mountain stream"], color: 0x3a84b0, scenes: ["river"], build: simple(W.river) },
  { id: "water-sea", name: "Sea", category: "water", kind: "water", about: "Waves rolling onto the beach, with foam on the sand.", where: "All round Elderra; the Saltmere Coast.", variants: ["Calm", "Choppy", "Bright turquoise"], color: 0x1e5a8a, scenes: ["coast"], build: simple(W.sea) },
  { id: "water-fall", name: "Waterfall", category: "water", kind: "water", about: "Water pouring off a cliff into a pool, with spray and mist.", where: "Where the river comes down from the mountains.", variants: ["Tall", "Wide", "Cascade"], color: 0x9ad8f0, scenes: ["river"], build: simple(W.waterfall) },
  // ---------- Sky
  { id: "sky-dome", name: "Sky", category: "sky", kind: "dome", about: "The sky all round the world, with the sun, moon and stars. Try Day, Sunset and Night.", where: "Over everything outdoors.", variants: ["Smooth", "Low-poly bands"], color: 0x4f9ee0, scenes: [], build: () => ({ object: new THREE.Group(), update() {}, dispose() {} }) },
  { id: "sky-clouds", name: "Clouds", category: "sky", kind: "clouds", about: "Low-poly clouds drifting slowly round the sky.", where: "Over everything outdoors.", variants: ["Puffy", "Flat-bottomed", "Storm"], color: 0xf2f4f6, scenes: ["town", "farm", "coast", "river"], build: simple(clouds) },
  { id: "sky-weather", name: "Weather", category: "sky", kind: "weather", about: "Rain, fog, snow and fireflies.", where: "Rain anywhere; fog in the Thornwood; snow on the peaks; fireflies by the lake at night.", variants: ["Rain", "Fog", "Snow", "Fireflies"], color: 0xb8c8d8, scenes: ["thornwood"], build: simple(weather) },
];

export const ENV_TYPES: EnvType[] = ENTRIES.map(({ build: _b, ...t }) => ({ ...t, status: "waiting" as ReviewStatus }));
export const ENV_BY_ID: Record<string, EnvType> = Object.fromEntries(ENV_TYPES.map((t) => [t.id, t]));
const BUILD: Record<string, Build> = Object.fromEntries(ENTRIES.map((e) => [e.id, e.build]));

/** Build one environment piece. */
export function createEnv(id: string, o: EnvOptions = {}): EnvPiece {
  const b = BUILD[id];
  if (!b) throw new Error(`No environment piece called ${id}`);
  return b({ variant: o.variant ?? 0, seed: o.seed ?? 1, x0: o.x0 ?? 0, z0: o.z0 ?? 0, w: o.w ?? TILE, d: o.d ?? TILE, length: o.length ?? TILE });
}

export { disposeGroup };
