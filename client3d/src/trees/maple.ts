// Maple: a rounded crown in bright red or orange (Woodcutting level 20).
import * as THREE from "three";
import { Rng, TreeShape, between, branch, leafBlob, limb } from "./common";

export const MAPLE_VARIANTS = ["Red", "Orange", "Summer"] as const;

const PALETTES = [
  [0xd2531f, 0xe0662a, 0xb8431a],
  [0xe8862a, 0xf0a03a, 0xd06d22],
  [0x5e9a35, 0x6fae3f, 0x4f872c],
];

export function buildMaple(rng: Rng, variant = 0): TreeShape {
  const top = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  const colors = PALETTES[variant] ?? PALETTES[0];
  const bark = 0x5b4030;
  const cut = 0.45;
  const r = 0.3;

  const trunk = limb(rng, { r0: r, r1: 0.2, length: between(rng, 1.9, 2.2), color: bark, sides: 6, bend: 0.12, bendDir: rng() * 6.28 });
  top.add(trunk.mesh);
  const arms = 4;
  const start = rng() * Math.PI * 2;
  for (let i = 0; i < arms; i++) {
    const a = start + (i / arms) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const b = branch(rng, trunk.tip.clone().setY(trunk.tip.y - 0.3 - i * 0.12), a, between(rng, 0.45, 0.7), {
      r0: 0.13, r1: 0.06, length: between(rng, 1.0, 1.3), color: bark, sides: 5, bend: 0.2,
    });
    top.add(b.mesh);
    const blob = leafBlob(rng, between(rng, 0.85, 1.0), colors[i % 3], { squash: 0.9 });
    blob.position.copy(b.tip).add(new THREE.Vector3(0, 0.25, 0));
    top.add(blob);
    leaves.push(blob);
  }
  const crown = leafBlob(rng, 1.15, colors[0], { squash: 0.95 });
  crown.position.copy(trunk.tip).add(new THREE.Vector3(0, 1.15, 0));
  top.add(crown);
  leaves.push(crown);
  return { top, leaves, cutHeight: cut, trunkRadius: r, bark, heartwood: 0xe6c38f, sway: 0.85 };
}
