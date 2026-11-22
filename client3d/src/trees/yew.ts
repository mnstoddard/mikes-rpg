// Yew: an old, dark, dense tree with a twisted reddish trunk and red berries
// (Woodcutting level 35).
import * as THREE from "three";
import { Rng, TreeShape, between, leafBlob, limb, mat } from "./common";

export const YEW_VARIANTS = ["Old", "Ancient", "Young"] as const;

export function buildYew(rng: Rng, variant = 0): TreeShape {
  const top = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  const size = variant === 1 ? 1.25 : variant === 2 ? 0.75 : 1;
  const bark = 0x7a3f2a;
  const cut = 0.5;
  const r = 0.42 * size;
  const greens = [0x14422a, 0x1c5433, 0x103a24];

  const trunk = limb(rng, { r0: r, r1: 0.25 * size, length: 1.4 * size, color: bark, sides: 8, lumpy: 0.45, bend: 0.2, bendDir: rng() * 6.28 });
  top.add(trunk.mesh);
  // Three tiers of dense, flattened foliage, getting smaller toward the top.
  const tiers = [
    { y: 1.3, r: 1.45, n: 4 },
    { y: 2.3, r: 1.15, n: 3 },
    { y: 3.15, r: 0.8, n: 1 },
  ];
  const berry = mat(0xd42a2a, { roughness: 0.4 });
  for (const t of tiers) {
    for (let i = 0; i < t.n; i++) {
      const a = (i / t.n) * Math.PI * 2 + rng();
      const out = t.n === 1 ? 0 : t.r * 0.45;
      const blob = leafBlob(rng, t.r * between(rng, 0.8, 0.95) * size, greens[i % 3], { squash: 0.7, lumpy: 0.22 });
      blob.position.set(Math.cos(a) * out * size, t.y * size, Math.sin(a) * out * size);
      top.add(blob);
      leaves.push(blob);
      // Berries on the outside of each clump.
      for (let k = 0; k < 4; k++) {
        const ba = rng() * Math.PI * 2;
        const be = between(rng, -0.3, 0.6);
        const rad = t.r * 0.85 * size;
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), berry);
        b.position.set(Math.cos(ba) * Math.cos(be) * rad, Math.sin(be) * rad * 0.7, Math.sin(ba) * Math.cos(be) * rad);
        blob.add(b);
      }
    }
  }
  return { top, leaves, cutHeight: cut, trunkRadius: r, bark, heartwood: 0xd98b5f, sway: 0.45 };
}
