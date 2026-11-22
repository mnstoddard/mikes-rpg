// The tree library: every tree type for the 3D game, in one list.
//
// How to use one in the game:
//   import { createTree } from "./trees";
//   const tree = createTree("oak", { seed: 42, variant: 0 });
//   scene.add(tree.object);
//   // every frame:  tree.update(dt, time, wind);
//   // chopping:     tree.hit();  then tree.fell() when it comes down
//   // respawn:      tree.regrow();
//
// "status" is Mike's review: only "approved" trees should go into the game.
// The Tree Gallery page is where Mike looks at each one and approves it.
import type { ResourceId } from "../../../shared/foraging";
import { makeRng, makeTree, Tree, TreeShape, Rng } from "./common";
import { PINE_VARIANTS, buildPine } from "./pine";
import { OAK_VARIANTS, buildOak } from "./oak";
import { BIRCH_VARIANTS, buildBirch } from "./birch";
import { MAPLE_VARIANTS, buildMaple } from "./maple";
import { YEW_VARIANTS, buildYew } from "./yew";
import { IRONWOOD_VARIANTS, buildIronwood } from "./ironwood";
import { ELDERWOOD_VARIANTS, buildElderwood } from "./elderwood";
import { DEAD_VARIANTS, buildDeadTree } from "./deadtree";
import { CROWNWOOD_VARIANTS, buildCrownwood } from "./crownwood";

export type { Tree, TreeState } from "./common";

export type TreeKind = "pine" | "oak" | "birch" | "maple" | "yew" | "ironwood" | "elderwood" | "dead" | "crownwood";

/** Mike's review of a tree. */
export type ReviewStatus = "waiting" | "approved" | "changes";

export interface TreeType {
  id: TreeKind;
  name: string;
  /** The woodcutting resource it gives (shared/foraging.ts), if you can chop it. */
  resource?: ResourceId;
  /** One line about it. */
  about: string;
  /** Where it grows in Elderra. */
  grows: string;
  variants: readonly string[];
  /** Mike's review. Updated from the Tree Gallery. */
  status: ReviewStatus;
  build: (rng: Rng, variant: number) => TreeShape;
}

export const TREE_TYPES: Record<TreeKind, TreeType> = {
  pine: {
    id: "pine", name: "Pine", resource: "pine", status: "waiting", variants: PINE_VARIANTS, build: buildPine,
    about: "The first tree every Kindled chops. Tall, stiff, stacked like a cone.",
    grows: "Everywhere, and the pine wood north of Trainer Row (Holt's first lesson). Snowy ones up north.",
  },
  oak: {
    id: "oak", name: "Oak", resource: "oak", status: "waiting", variants: OAK_VARIANTS, build: buildOak,
    about: "A thick trunk and a big round crown. Truffles grow underneath.",
    grows: "Heartvale's meadows, the farm and the edge of the Thornwood.",
  },
  birch: {
    id: "birch", name: "Birch", resource: "birch", status: "waiting", variants: BIRCH_VARIANTS, build: buildBirch,
    about: "Slim white trunk with dark marks and a light crown. Sways the most.",
    grows: "Along the river and in small groves near the farm.",
  },
  maple: {
    id: "maple", name: "Maple", resource: "maple", status: "waiting", variants: MAPLE_VARIANTS, build: buildMaple,
    about: "A bright red or orange round crown. Easy to spot from far away.",
    grows: "Hillsides around Heartvale and on the road to the coast.",
  },
  yew: {
    id: "yew", name: "Yew", resource: "yew", status: "waiting", variants: YEW_VARIANTS, build: buildYew,
    about: "Old, dark and dense, with a twisted reddish trunk and red berries.",
    grows: "Deep in the Thornwood and beside old shrines.",
  },
  ironwood: {
    id: "ironwood", name: "Ironwood", resource: "ironwood", status: "waiting", variants: IRONWOOD_VARIANTS, build: buildIronwood,
    about: "Grey, faintly metal bark and sharp crystal-like leaves. Hardly moves in the wind.",
    grows: "Rocky ground near the mines and mountains. Rusted ones where there's iron ore.",
  },
  elderwood: {
    id: "elderwood", name: "Elderwood", resource: "elderwood", status: "waiting", variants: ELDERWOOD_VARIANTS, build: buildElderwood,
    about: "The rarest tree. A twisted trunk, glowing leaves and drifting lights. Best seen at night.",
    grows: "Hidden spots where the Wellspring's magic is still strong.",
  },
  dead: {
    id: "dead", name: "Dead tree", status: "waiting", variants: DEAD_VARIANTS, build: buildDeadTree,
    about: "Scenery for now. The trees near shrines die first.",
    grows: "Around shrines (Forester Holt's quest, What Holt Saw).",
  },
  crownwood: {
    id: "crownwood", name: "Crownwood", status: "waiting", variants: CROWNWOOD_VARIANTS, build: buildCrownwood,
    about: "Planned endgame wood with gold grain: the best handles, bows and staffs.",
    grows: "The Sundered Crown (not in the game's rules yet).",
  },
};

export const TREE_KINDS = Object.keys(TREE_TYPES) as TreeKind[];

/** Make a tree. The same seed and variant always give the same tree. */
export function createTree(kind: TreeKind, opts: { seed?: number; variant?: number } = {}): Tree {
  const rng = makeRng(opts.seed ?? 1);
  const type = TREE_TYPES[kind];
  const variant = Math.max(0, Math.min(type.variants.length - 1, opts.variant ?? 0));
  return makeTree(type.build(rng, variant), rng);
}
