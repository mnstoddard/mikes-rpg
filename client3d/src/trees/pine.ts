// Pine: the first tree everyone chops (Woodcutting level 1). Tall and stiff,
// made of stacked cones. The "Snowy" variant is for cold places.
import * as THREE from "three";
import { Rng, TreeShape, between, leafCone, limb } from "./common";

export const PINE_VARIANTS = ["Classic", "Tall", "Snowy"] as const;

export function buildPine(rng: Rng, variant = 0): TreeShape {
  const top = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  const tall = variant === 1;
  const snowy = variant === 2;
  const layers = tall ? 5 : 4;
  const height = between(rng, 4.2, 4.8) + (tall ? 1.2 : 0);
  const cut = 0.45;
  const r = 0.22;

  const trunk = limb(rng, { r0: r, r1: 0.08, length: height - cut, color: 0x6b4a30, lumpy: 0.15 });
  top.add(trunk.mesh);

  const greens = [0x2e5e22, 0x376b29];
  const widest = (tall ? 1.3 : 1.55) * between(rng, 0.92, 1.08);
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const radius = widest * (1 - t * 0.62);
    const h = 1.55 - t * 0.35;
    const y = 0.75 + t * (height - cut - 1.9) + h / 2;
    const cone = leafCone(rng, radius, h, greens[i % 2], { sides: 7 });
    cone.position.set((rng() - 0.5) * 0.1, y, (rng() - 0.5) * 0.1);
    cone.rotation.y = rng() * Math.PI;
    top.add(cone);
    leaves.push(cone);
    if (snowy) {
      // A flatter white cone sharing the tip pokes out like a snow cap.
      const snow = leafCone(rng, radius * 0.8, h * 0.5, 0xf4f8fb, { sides: 7, roughness: 0.6, lumpy: 0.05 });
      snow.position.y = h / 2 - h * 0.25 + 0.03;
      cone.add(snow);
    }
  }
  return { top, leaves, cutHeight: cut, trunkRadius: r, bark: 0x6b4a30, heartwood: 0xe8cd98, sway: 0.5 };
}
