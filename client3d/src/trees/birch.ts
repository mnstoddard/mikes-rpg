// Birch: a slim white trunk with dark marks and a light, airy crown
// (Woodcutting level 10). Bends the most in the wind.
import * as THREE from "three";
import { Rng, TreeShape, between, leafBlob, limb, mat } from "./common";

export const BIRCH_VARIANTS = ["Single", "Twin", "Golden"] as const;

export function buildBirch(rng: Rng, variant = 0): TreeShape {
  const top = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  const greens = variant === 2 ? [0xe8c43a, 0xf0d25a, 0xd9b22e] : [0x9acd32, 0xaed84a, 0x86b82c];
  const bark = 0xeeeae0;
  const cut = 0.4;
  const r = 0.17;
  const stems = variant === 1 ? [-0.14, 0.16] : [0];

  stems.forEach((lean, s) => {
    const dir = rng() * 6.28;
    const len = between(rng, 4.0, 4.6) - s * 0.5;
    const stem = limb(rng, { r0: variant === 1 ? 0.13 : r, r1: 0.06, length: len, color: bark, sides: 6, bend: 0.25, bendDir: dir, lumpy: 0.12 });
    const holder = new THREE.Group();
    holder.rotation.z = lean;
    holder.add(stem.mesh);
    top.add(holder);
    // Dark birch marks.
    for (let i = 0; i < 9; i++) {
      const y = between(rng, 0.2, len * 0.75);
      const t = y / len;
      const rad = (variant === 1 ? 0.13 : r) * (1 - t) + 0.06 * t;
      const a = rng() * Math.PI * 2;
      const mark = new THREE.Mesh(new THREE.BoxGeometry(rad * 0.9, 0.05, 0.04), mat(0x2b2724));
      const bendPush = 0.25 * t * t;
      mark.position.set(Math.cos(a) * rad + Math.cos(dir) * bendPush, y, Math.sin(a) * rad + Math.sin(dir) * bendPush);
      mark.rotation.y = -a + Math.PI / 2;
      holder.add(mark);
    }
    // Small leafy clumps up the top half.
    const clumps = variant === 1 ? 4 : 6;
    for (let i = 0; i < clumps; i++) {
      const t = 0.45 + (i / clumps) * 0.5;
      const y = len * t + 0.3;
      const a = rng() * Math.PI * 2;
      const out = (1 - t) * 0.9 + 0.2;
      const bendPush = 0.25 * t * t;
      const blob = leafBlob(rng, between(rng, 0.6, 0.8) * (1.2 - t * 0.5), greens[i % greens.length], { squash: 1.1, lumpy: 0.35 });
      blob.position.set(Math.cos(a) * out + Math.cos(dir) * bendPush, y, Math.sin(a) * out + Math.sin(dir) * bendPush);
      holder.add(blob);
      leaves.push(blob);
    }
  });
  return { top, leaves, cutHeight: cut, trunkRadius: variant === 1 ? 0.24 : r, bark, heartwood: 0xf1e2c2, sway: 1.4 };
}
