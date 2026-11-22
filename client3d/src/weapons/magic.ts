// Staffs: carved from 2 logs at Rook's workbench (Handicraft). A plain staff
// fires Firebolt; an enchanted one (a cut gem set in the top, see
// shared/enchanting.ts) fires its gem's bolt: ruby fire, sapphire frost,
// emerald poison, topaz lightning, amethyst life steal.
import * as THREE from "three";
import { WeaponBuild, WeaponOptions } from "./types";
import { GEM_COLORS, GOLD, LEATHER, gem, glowMat, knob, metalMat, plainMat, pole, tube, woodMat } from "./parts";
import { between, makeRng } from "./parts";

export const STAFF_VARIANTS = ["Crook", "Orb", "Branch"] as const;
/** A plain staff's bolt is Firebolt. */
export const FIREBOLT = 0xff7a2a;

/** A glowing bolt of magic, for staffs. */
export function bolt(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), glowMat(color, 3)));
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.13, 1),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  g.add(halo);
  return g;
}

export function buildStaff(o: WeaponOptions): WeaponBuild {
  const g = new THREE.Group();
  const wood = woodMat(o.wood);
  const dark = woodMat(o.wood, true);
  const rng = makeRng(31 + o.variant);
  const top = 1.0;
  g.add(pole(-0.75, top, 0.022, 0.026, wood, 7));
  g.add(pole(-0.1, 0.12, 0.03, 0.03, plainMat(LEATHER), 7));
  const gemColor = o.gem ? GEM_COLORS[o.gem] : null;
  let gemAt = new THREE.Vector3(0, top + 0.12, 0);

  if (o.variant === 0) {
    // A shepherd's crook curl.
    const pts = [
      new THREE.Vector3(0, top - 0.02, 0), new THREE.Vector3(0, top + 0.14, 0), new THREE.Vector3(0.07, top + 0.24, 0),
      new THREE.Vector3(0.15, top + 0.19, 0), new THREE.Vector3(0.14, top + 0.08, 0),
    ];
    g.add(tube(pts, 0.024, wood, 16, 6));
    gemAt = new THREE.Vector3(0.075, top + 0.13, 0);
  } else if (o.variant === 1) {
    // Three prongs holding an orb.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.add(tube([
        new THREE.Vector3(0, top - 0.02, 0),
        new THREE.Vector3(Math.cos(a) * 0.06, top + 0.08, Math.sin(a) * 0.06),
        new THREE.Vector3(Math.cos(a) * 0.035, top + 0.2, Math.sin(a) * 0.035),
      ], 0.011, dark, 8, 5));
    }
    gemAt = new THREE.Vector3(0, top + 0.12, 0);
    if (!gemColor) {
      // A plain staff holds a dull glass orb.
      const orb = knob(0.055, plainMat(0xcfe3e6, { roughness: 0.1, metalness: 0.1 }), 1);
      orb.position.copy(gemAt);
      g.add(orb);
    }
  } else {
    // A gnarled branch top with a few leaves.
    for (let i = 0; i < 4; i++) {
      const a = rng() * Math.PI * 2;
      const len = between(rng, 0.14, 0.24);
      g.add(tube([
        new THREE.Vector3(0, top - 0.05, 0),
        new THREE.Vector3(Math.cos(a) * 0.05, top + len * 0.5, Math.sin(a) * 0.05),
        new THREE.Vector3(Math.cos(a) * 0.1, top + len, Math.sin(a) * 0.1),
      ], 0.01, wood, 8, 5));
      const leaf = knob(0.025, plainMat(o.wood === "elderwood" ? 0xb78cf0 : 0x6b9a28));
      leaf.scale.set(1, 0.5, 1.6);
      leaf.position.set(Math.cos(a) * 0.1, top + len, Math.sin(a) * 0.1);
      g.add(leaf);
    }
    gemAt = new THREE.Vector3(0, top + 0.1, 0);
  }
  if (gemColor) {
    const gm = gem(0.045, gemColor, 1.4);
    gm.position.copy(gemAt);
    g.add(gm);
    // A thin gold ring holds the gem.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 4, 12), metalMat("aurelite"));
    ring.material = plainMat(GOLD, { metalness: 0.9, roughness: 0.3 });
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(gemAt).add(new THREE.Vector3(0, -0.035, 0));
    g.add(ring);
  }
  const color = gemColor ?? FIREBOLT;
  return { object: g, length: 1.95, tip: gemAt.clone(), boltColor: color, projectile: () => bolt(color) };
}
