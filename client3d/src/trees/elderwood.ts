// Elderwood: the rarest tree (Woodcutting level 70). A twisted dark trunk,
// glowing violet leaves and little lights drifting around it.
import * as THREE from "three";
import { Rng, TreeShape, between, branch, leafBlob, limb, mat, motes } from "./common";

export const ELDERWOOD_VARIANTS = ["Violet", "Moonlit"] as const;

export function buildElderwood(rng: Rng, variant = 0): TreeShape {
  const top = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  const moon = variant === 1;
  const bark = moon ? 0x2a3550 : 0x3b2a4f;
  const leafColors = moon ? [0x4f7fbf, 0x6a9be0, 0x3d6aa6] : [0x7b4fbf, 0x9a6ee0, 0x6a3fae];
  const glow = moon ? 0x2f5fa8 : 0x5a2fa0;
  const cut = 0.5;
  const r = 0.36;

  // A twisting trunk: three pieces, each leaning a different way.
  let at = new THREE.Vector3();
  let dir = rng() * 6.28;
  let rad = r;
  for (let i = 0; i < 3; i++) {
    const len = 1.1 - i * 0.1;
    const piece = limb(rng, { r0: rad, r1: rad * 0.72, length: len, color: bark, sides: 6, bend: 0.35, bendDir: dir, lumpy: 0.3 });
    piece.mesh.position.copy(at);
    top.add(piece.mesh);
    at = at.clone().add(piece.tip);
    rad *= 0.72;
    dir += 2.2;
  }
  // Drooping branches, like a willow, each ending in glowing leaves.
  const arms = 5;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + rng() * 0.4;
    const b = branch(rng, at.clone().setY(at.y - 0.2), a, between(rng, 0.9, 1.15), {
      r0: 0.1, r1: 0.05, length: between(rng, 1.2, 1.5), color: bark, sides: 4, bend: -0.5,
    });
    top.add(b.mesh);
    const blob = leafBlob(rng, between(rng, 0.65, 0.8), leafColors[i % 3], { squash: 1.25, emissive: glow, emissiveIntensity: 0.5, roughness: 0.6 });
    blob.position.copy(b.tip).add(new THREE.Vector3(0, -0.15, 0));
    top.add(blob);
    leaves.push(blob);
    // Glowing strands hanging down, like a willow.
    for (let k = 0; k < 3; k++) {
      const len = between(rng, 0.9, 1.6);
      const strand = new THREE.Mesh(new THREE.ConeGeometry(0.09, len, 4), mat(leafColors[(i + k) % 3], { emissive: glow, emissiveIntensity: 0.6, roughness: 0.6 }));
      strand.rotation.x = Math.PI;
      const sa = rng() * Math.PI * 2;
      strand.position.set(Math.cos(sa) * 0.45, -len / 2 - 0.2, Math.sin(sa) * 0.45);
      strand.castShadow = true;
      blob.add(strand);
    }
  }
  const crown = leafBlob(rng, 1.0, leafColors[1], { squash: 0.85, emissive: glow, emissiveIntensity: 0.5, roughness: 0.6 });
  crown.position.copy(at).add(new THREE.Vector3(0, 0.55, 0));
  top.add(crown);
  leaves.push(crown);

  const extra = motes(rng, 26, moon ? 0xbfe0ff : 0xe0c4ff, 2.0, 3.2, 0.3);
  return {
    top, leaves, cutHeight: cut, trunkRadius: r, bark, heartwood: moon ? 0xa8c6ef : 0xc6a8ef,
    barkMat: { emissive: glow, emissiveIntensity: 0.15 }, sway: 0.8, extra,
  };
}
