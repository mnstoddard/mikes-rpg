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
import * as THREE from "three";
import { branch, makeRng, makeTree, mat, Tree, TreeShape, Rng } from "./common";
import { PINE_VARIANTS, buildPine } from "./pine";
import { OAK_VARIANTS, buildOak } from "./oak";
import { BIRCH_VARIANTS, buildBirch } from "./birch";
import { MAPLE_VARIANTS, buildMaple } from "./maple";
import { YEW_VARIANTS, buildYew } from "./yew";
import { IRONWOOD_VARIANTS, buildIronwood } from "./ironwood";
import { ELDERWOOD_VARIANTS, buildElderwood } from "./elderwood";
import { CROWNWOOD_VARIANTS, buildCrownwood } from "./crownwood";

export type { Tree, TreeState } from "./common";

export type TreeKind = "pine" | "oak" | "birch" | "maple" | "yew" | "ironwood" | "elderwood" | "crownwood";

/** Mike's review of a tree. */
export type ReviewStatus = "waiting" | "approved" | "changes";

export interface TreeType {
  id: TreeKind;
  name: string;
  /** The woodcutting resource it gives (shared/foraging.ts), if you can chop it. */
  resource?: ResourceId;
  /** One line about it. */
  about: string;
  /** Where it grows in Embervale. */
  grows: string;
  variants: readonly string[];
  /** Mike's review. Updated from the Tree Gallery. */
  status: ReviewStatus;
  build: (rng: Rng, variant: number) => TreeShape;
}

export const TREE_TYPES: Record<TreeKind, TreeType> = {
  pine: {
    id: "pine", name: "Pine", resource: "pine", status: "approved", variants: PINE_VARIANTS, build: buildPine,
    about: "The first tree every Emberborn chops. Tall, stiff, stacked like a cone.",
    grows: "Everywhere, and the pine wood north of Trainer Row (Holt's first lesson). Snowy ones up north.",
  },
  oak: {
    id: "oak", name: "Oak", resource: "oak", status: "approved", variants: OAK_VARIANTS, build: buildOak,
    about: "A thick trunk and a big round crown. Truffles grow underneath.",
    grows: "Heartvale's meadows, the farm and the edge of the Thornwood.",
  },
  birch: {
    id: "birch", name: "Birch", resource: "birch", status: "approved", variants: BIRCH_VARIANTS, build: buildBirch,
    about: "Slim white trunk with dark marks and a light crown. Sways the most.",
    grows: "Along the river and in small groves near the farm.",
  },
  maple: {
    id: "maple", name: "Maple", resource: "maple", status: "approved", variants: MAPLE_VARIANTS, build: buildMaple,
    about: "A bright red or orange round crown. Easy to spot from far away.",
    grows: "Hillsides around Heartvale and on the road to the coast.",
  },
  yew: {
    id: "yew", name: "Yew", resource: "yew", status: "approved", variants: YEW_VARIANTS, build: buildYew,
    about: "Old, dark and dense, with a twisted reddish trunk and red berries.",
    grows: "Deep in the Thornwood and beside old shrines.",
  },
  ironwood: {
    id: "ironwood", name: "Ironwood", resource: "ironwood", status: "approved", variants: IRONWOOD_VARIANTS, build: buildIronwood,
    about: "Grey, faintly metal bark and sharp crystal-like leaves. Hardly moves in the wind.",
    grows: "Rocky ground near the mines and mountains. Rusted ones where there's iron ore.",
  },
  elderwood: {
    id: "elderwood", name: "Elderwood", resource: "elderwood", status: "approved", variants: ELDERWOOD_VARIANTS, build: buildElderwood,
    about: "The rarest tree. A twisted trunk, glowing leaves and drifting lights. Best seen at night.",
    grows: "Hidden spots where the Emberheart's magic is still strong.",
  },
  crownwood: {
    id: "crownwood", name: "Crownwood", status: "approved", variants: CROWNWOOD_VARIANTS, build: buildCrownwood,
    about: "Planned endgame wood with gold grain: the best handles, bows and staffs.",
    grows: "The Sundered Crown (not in the game's rules yet).",
  },
};

export const TREE_KINDS = Object.keys(TREE_TYPES) as TreeKind[];

/** Make a tree. The same seed and variant always give the same tree. */
/**
 * Make a tree. The same seed and variant always give the same tree.
 * `dead: true` makes a dead version of any tree (grey bark, few dry leaves),
 * for places that need them, like around shrines (Forester Holt's quest).
 */
export function createTree(kind: TreeKind, opts: { seed?: number; variant?: number; dead?: boolean } = {}): Tree {
  const rng = makeRng(opts.seed ?? 1);
  const type = TREE_TYPES[kind];
  const variant = Math.max(0, Math.min(type.variants.length - 1, opts.variant ?? 0));
  const shape = type.build(rng, variant);
  if (opts.dead) killTree(shape, rng);
  return makeTree(shape, rng);
}

/** A ring of thin bare branches sticking out of the trunk. */
function addWhorl(top: THREE.Group, rng: Rng, y: number, r: number) {
  const n = 4 + Math.floor(rng() * 2);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rng() * 0.5;
    const b = branch(rng, new THREE.Vector3(0, y, 0), a, 1.2 + rng() * 0.3, { r0: 0.04, r1: 0.012, length: r * (0.7 + rng() * 0.3), color: 0x6b5a48, sides: 3, bend: -0.1 });
    top.add(b.mesh);
  }
}

const DRY_LEAF = new THREE.Color(0x8a7550);
const DEAD_BARK = new THREE.Color(0x7d756b);

/** Turns a living tree's shape into a dead one: most leaves drop, the rest go dry and brown, the bark goes grey. */
function killTree(shape: TreeShape, rng: Rng) {
  const recolor = (o: THREE.Object3D, toward: THREE.Color, amount: number) => {
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      const old = m.material as THREE.MeshStandardMaterial | undefined;
      if (!m.isMesh || !old?.color) return;
      m.material = mat(old.color.clone().lerp(toward, amount).getHex(), { roughness: 0.95, metalness: old.metalness * 0.5 });
    });
  };
  const leafSet = new Set(shape.leaves);
  const kept: THREE.Object3D[] = [];
  shape.leaves.forEach((leaf, i) => {
    // Keep about every other clump, so it still has a shape.
    if (i % 2 === 1 && rng() < 0.85) {
      leaf.parent?.remove(leaf);
      // Bare branches where the needles were (pine).
      const w = shape.bareWhorls?.[i];
      if (w) addWhorl(shape.top, rng, w.y, w.r);
    } else {
      recolor(leaf, DRY_LEAF, 0.75);
      leaf.scale.multiplyScalar(0.65);
      kept.push(leaf);
    }
  });
  // Everything that isn't a leaf is trunk or branch.
  const isInLeaf = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (leafSet.has(p)) return true;
    return false;
  };
  shape.top.traverse((c) => {
    if (!isInLeaf(c) && (c as THREE.Mesh).isMesh) recolor(c, DEAD_BARK, 0.6);
  });
  shape.leaves = kept;
  shape.bark = new THREE.Color(shape.bark).lerp(DEAD_BARK, 0.6).getHex();
  shape.heartwood = new THREE.Color(shape.heartwood).lerp(new THREE.Color(0xb8a58a), 0.5).getHex();
  shape.barkMat = undefined;
  shape.extra = undefined;
  shape.sway *= 0.4;
}
