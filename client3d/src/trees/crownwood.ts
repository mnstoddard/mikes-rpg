// Crownwood: planned for the Sundered Crown endgame. Gold-grained trees that
// make the best handles, bows and staffs. Not in the game's rules yet.
import * as THREE from "three";
import { Rng, TreeShape, between, branch, leafBlob, limb, mat, motes } from "./common";

export const CROWNWOOD_VARIANTS = ["Gilded", "Sunset"] as const;

export function buildCrownwood(rng: Rng, variant = 0): TreeShape {
  const top = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  const sunset = variant === 1;
  const bark = 0x8a6a34;
  const barkMat = { metalness: 0.25, roughness: 0.55 };
  const leafColors = sunset ? [0xf08a3a, 0xf5a84a, 0xe0702e] : [0xe8b84a, 0xf2cf6a, 0xd9a43a];
  const cut = 0.5;
  const r = 0.34;

  const trunkLen = between(rng, 3.0, 3.4);
  const trunk = limb(rng, { r0: r, r1: 0.18, length: trunkLen, color: bark, sides: 7, lumpy: 0.15, mat: barkMat });
  top.add(trunk.mesh);
  // Gold veins running up the trunk.
  const vein = mat(0xffd36b, { emissive: 0xc98a1a, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng() * 0.3;
    const len = trunkLen * between(rng, 0.5, 0.85);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.03), vein);
    const rr = r - (r - 0.18) * 0.4 + 0.005;
    v.position.set(Math.cos(a) * rr, len / 2 + 0.05, Math.sin(a) * rr);
    v.rotation.y = -a;
    v.rotation.z = 0.04;
    top.add(v);
  }
  // Branches reaching up, like a crown's points.
  const arms = 5;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + rng() * 0.3;
    const b = branch(rng, trunk.tip.clone().setY(trunk.tip.y - 0.4), a, between(rng, 0.35, 0.55), {
      r0: 0.12, r1: 0.05, length: between(rng, 1.3, 1.6), color: bark, sides: 5, bend: 0.2, mat: barkMat,
    });
    top.add(b.mesh);
    const blob = leafBlob(rng, between(rng, 0.7, 0.85), leafColors[i % 3], { squash: 1.1, emissive: 0xb07a10, emissiveIntensity: 0.18, roughness: 0.55 });
    blob.position.copy(b.tip).add(new THREE.Vector3(0, 0.2, 0));
    top.add(blob);
    leaves.push(blob);
  }
  const extra = motes(rng, 18, 0xffe08a, 1.9, 3.5, 1.2);
  return { top, leaves, cutHeight: cut, trunkRadius: r, bark, barkMat, heartwood: 0xf3cf7a, sway: 0.6, extra };
}
