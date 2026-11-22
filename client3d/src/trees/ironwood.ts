// Ironwood: a grey, faintly metal tree with sharp, crystal-like leaves
// (Woodcutting level 50). "Rusted" grows where the ground is full of iron.
import * as THREE from "three";
import { Rng, TreeShape, between, branch, leafShard, limb } from "./common";

export const IRONWOOD_VARIANTS = ["Steel", "Rusted"] as const;

export function buildIronwood(rng: Rng, variant = 0): TreeShape {
  const top = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  const rusted = variant === 1;
  const bark = rusted ? 0x6e5446 : 0x56636b;
  const barkMat = { metalness: 0.45, roughness: 0.5 };
  const leafColors = rusted ? [0xb06a3a, 0x8f5a3a, 0xc98a4a] : [0x6f8f8a, 0x8fa9a8, 0x5b7a78];
  const cut = 0.5;
  const r = 0.32;

  const trunk = limb(rng, { r0: r, r1: 0.16, length: between(rng, 2.6, 3.0), color: bark, sides: 5, lumpy: 0.2, mat: barkMat });
  top.add(trunk.mesh);
  // Branches stick out at hard angles, in two rings.
  for (let ring = 0; ring < 2; ring++) {
    const n = ring === 0 ? 4 : 3;
    const y = trunk.tip.y * (ring === 0 ? 0.55 : 0.85);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.7 + rng() * 0.3;
      const b = branch(rng, new THREE.Vector3(0, y, 0), a, between(rng, 0.8, 1.0), {
        r0: 0.1, r1: 0.04, length: ring === 0 ? 1.4 : 1.0, color: bark, sides: 4, bend: -0.25, mat: barkMat,
      });
      top.add(b.mesh);
      // A cluster of shards at each tip.
      const cluster = new THREE.Group();
      cluster.position.copy(b.tip);
      for (let k = 0; k < 3; k++) {
        const s = leafShard(rng, between(rng, 0.4, 0.6) * (ring === 0 ? 1 : 0.85), leafColors[(i + k) % 3], { metalness: 0.3, roughness: 0.4 });
        s.position.set(between(rng, -0.35, 0.35), between(rng, -0.1, 0.45), between(rng, -0.35, 0.35));
        s.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        cluster.add(s);
      }
      top.add(cluster);
      leaves.push(cluster);
    }
  }
  const crown = leafShard(rng, 0.7, leafColors[0], { metalness: 0.3, roughness: 0.4 });
  crown.position.copy(trunk.tip).add(new THREE.Vector3(0, 0.4, 0));
  crown.scale.y = 1.5;
  top.add(crown);
  leaves.push(crown);
  return { top, leaves, cutHeight: cut, trunkRadius: r, bark, barkMat, heartwood: rusted ? 0xc9a184 : 0xb7c0c4, sway: 0.3 };
}
