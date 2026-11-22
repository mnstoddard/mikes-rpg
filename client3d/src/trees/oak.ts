// Oak: a short, thick trunk and a big round crown (Woodcutting level 5).
// "Autumn" turns the leaves orange-brown.
import * as THREE from "three";
import { Rng, TreeShape, between, branch, leafBlob, limb } from "./common";

export const OAK_VARIANTS = ["Round", "Spreading", "Autumn"] as const;

export function buildOak(rng: Rng, variant = 0): TreeShape {
  const top = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  const spreading = variant === 1;
  const greens = variant === 2 ? [0xc07a2c, 0xd08f35, 0xa9622a] : [0x5f8a22, 0x6b9a28, 0x557d1e];
  const bark = 0x6b4a2f;
  const cut = 0.5;
  const r = 0.4;

  const trunkLen = between(rng, 1.3, 1.6);
  const trunk = limb(rng, { r0: r, r1: 0.28, length: trunkLen, color: bark, sides: 7, bend: 0.15, bendDir: rng() * 6.28 });
  top.add(trunk.mesh);

  const arms = spreading ? 4 : 3;
  const crownR = spreading ? 1.15 : 1.25;
  const start = rng() * Math.PI * 2;
  for (let i = 0; i < arms; i++) {
    const a = start + (i / arms) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const b = branch(rng, trunk.tip.clone().setY(trunk.tip.y - 0.15), a, spreading ? between(rng, 0.85, 1.05) : between(rng, 0.5, 0.75), {
      r0: 0.2, r1: 0.1, length: spreading ? between(rng, 1.5, 1.8) : between(rng, 1.1, 1.4), color: bark, sides: 5, bend: 0.25,
    });
    top.add(b.mesh);
    const blob = leafBlob(rng, crownR * between(rng, 0.85, 1.05), greens[i % greens.length], { squash: 0.8 });
    blob.position.copy(b.tip).add(new THREE.Vector3(0, 0.35, 0));
    top.add(blob);
    leaves.push(blob);
  }
  // One on top to fill the middle.
  const crown = leafBlob(rng, crownR * (spreading ? 1.0 : 1.2), greens[0], { squash: 0.75 });
  crown.position.copy(trunk.tip).add(new THREE.Vector3(0, spreading ? 1.2 : 1.45, 0));
  top.add(crown);
  leaves.push(crown);

  return { top, leaves, cutHeight: cut, trunkRadius: r, bark, heartwood: 0xd9b07a, sway: 0.7 };
}
