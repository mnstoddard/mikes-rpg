// Dead tree: scenery, not a woodcutting tree yet. The trees near shrines that
// die first (Forester Holt's quest, "What Holt Saw").
import * as THREE from "three";
import { Rng, TreeShape, between, branch, leafBlob, limb } from "./common";

export const DEAD_VARIANTS = ["Bare", "Mossy"] as const;

export function buildDeadTree(rng: Rng, variant = 0): TreeShape {
  const top = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  const bark = 0x6e6258;
  const cut = 0.45;
  const r = 0.28;

  const trunk = limb(rng, { r0: r, r1: 0.1, length: between(rng, 2.6, 3.1), color: bark, sides: 5, bend: 0.4, bendDir: rng() * 6.28, lumpy: 0.3 });
  top.add(trunk.mesh);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 * 1.6 + rng() * 0.8;
    const y = trunk.tip.y * between(rng, 0.45, 0.85);
    const b = branch(rng, new THREE.Vector3(trunk.tip.x * (y / trunk.tip.y) ** 2, y, trunk.tip.z * (y / trunk.tip.y) ** 2), a, between(rng, 0.6, 1.0), {
      r0: 0.08, r1: 0.025, length: between(rng, 1.0, 1.6), color: bark, sides: 4, bend: 0.3,
    });
    top.add(b.mesh);
    // A twig off each branch.
    const twig = branch(rng, b.tip.clone().lerp(new THREE.Vector3(0, y, 0), 0.4), a + between(rng, -0.9, 0.9), between(rng, 0.3, 0.6), {
      r0: 0.035, r1: 0.015, length: 0.5, color: bark, sides: 3,
    });
    top.add(twig.mesh);
    leaves.push(b.mesh);
    if (variant === 1 && rng() < 0.8) {
      const moss = leafBlob(rng, 0.22, 0x6b7d3a, { squash: 0.6, detail: 0 });
      moss.position.copy(b.tip).lerp(new THREE.Vector3(0, y, 0), 0.5);
      top.add(moss);
    }
  }
  return { top, leaves, cutHeight: cut, trunkRadius: r, bark, heartwood: 0xb8a58a, sway: 0.25 };
}
