// Story weapons from docs/QUESTLINE.md. None are in the game's rules yet:
//   - Warden's weapon: Huntmaster Kael's reward for The Hollow Wolves (1.10),
//     a blade, bow or staff depending on how you fight best.
//   - Goblin-forged dagger: from Goblin Trouble (2B.4).
//   - Severing Blade: forged by Smith Brann (4A.5) from mithril, the
//     Thornmother fang, a cut gem and an enchant from Ysolde. It cuts threads of light.
//   - Lightforged weapon: forged yourself at the undercroft forge (4L.5),
//     quenched in a filled soul gem.
import * as THREE from "three";
import { WeaponBuild, WeaponOptions } from "./types";
import { BladeStation, GEM_COLORS, GOLD, blade, box, gem, glowMat, grip, knob, plainMat, spike, tube } from "./parts";
import { buildSword, buildMace } from "./melee";
import { buildBow } from "./ranged";
import { bolt, buildStaff } from "./magic";

const WARDEN_GREEN = 0x3f6b3a;

// ---------- Warden's weapon ----------

export const WARDEN_VARIANTS = ["Blade", "Bow", "Staff"] as const;

export function buildWarden(o: WeaponOptions): WeaponBuild {
  if (o.variant === 1) {
    const b = buildBow({ ...o, variant: 1, wood: "yew" });
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.18, 7), plainMat(WARDEN_GREEN));
    b.object.add(wrap);
    return b;
  }
  if (o.variant === 2) {
    return buildStaff({ ...o, variant: 2, wood: "yew", gem: "emerald" });
  }
  const s = buildSword({ ...o, variant: 2, metal: "steel", wood: "yew" });
  // Green leather wraps and an emerald in the pommel: the Wardens' colours.
  const wraps = grip(0.17, 0.021, plainMat(WARDEN_GREEN), { wraps: 0 });
  s.object.add(wraps);
  const em = gem(0.022, GEM_COLORS.emerald, 0.8);
  em.position.y = -0.11;
  em.position.z = 0.02;
  s.object.add(em);
  const tassel = tube([new THREE.Vector3(0, -0.12, 0), new THREE.Vector3(0.02, -0.2, 0.01), new THREE.Vector3(0.01, -0.28, 0)], 0.008, plainMat(WARDEN_GREEN), 8, 4);
  s.object.add(tassel);
  return s;
}

// ---------- Goblin-forged dagger ----------

export const GOBLIN_VARIANTS = ["Jagged", "Cleaver"] as const;

export function buildGoblinDagger(o: WeaponOptions): WeaponBuild {
  const g = new THREE.Group();
  const bone = plainMat(0xe6dcc3);
  g.add(grip(0.12, 0.018, bone, { wraps: 2, wrapColor: 0x6b5a3a }));
  const iron = plainMat(0x5d5752, { metalness: 0.6, roughness: 0.7 });
  const rust = plainMat(0x8a4a2a, { roughness: 0.9 });
  const gd = box(0.07, 0.025, 0.03, rust);
  gd.position.y = 0.07;
  gd.rotation.z = 0.15;
  g.add(gd);
  let st: BladeStation[];
  if (o.variant === 0) {
    // A saw-toothed edge, hammered out by someone in a hurry.
    st = [];
    for (let i = 0; i <= 8; i++) st.push({ y: i * 0.032, w: (i % 2 ? 0.03 : 0.02) * (1 - i / 11), x: i % 2 ? 0.006 : 0 });
    st.push({ y: 0.3, w: 0, x: 0.015 });
  } else {
    st = [{ y: 0, w: 0.028, x: 0.01 }, { y: 0.12, w: 0.045, x: 0.02 }, { y: 0.22, w: 0.05, x: 0.025 }, { y: 0.26, w: 0, x: 0.06 }];
  }
  const b = blade(st, 0.009, iron);
  b.position.y = 0.08;
  g.add(b);
  // A tooth on a string for luck.
  const tooth = spike(0.008, 0.035, bone, 3);
  tooth.rotation.x = Math.PI;
  tooth.position.set(0.01, -0.09, 0.01);
  g.add(tooth);
  return { object: g, length: 0.42, tip: new THREE.Vector3(0, 0.36, 0) };
}

// ---------- Severing Blade ----------

export const SEVERING_VARIANTS = ["Fang spine", "Thread-cutter"] as const;

export function buildSevering(o: WeaponOptions): WeaponBuild {
  const g = new THREE.Group();
  const mithril = plainMat(0x9fd6f5, { metalness: 0.85, roughness: 0.2, emissive: 0x2a6fa8, emissiveIntensity: 0.4 });
  g.add(grip(0.2, 0.02, plainMat(0x2b2440), { wraps: 4, wrapColor: GOLD }));
  const gd = box(0.22, 0.03, 0.05, plainMat(GOLD, { metalness: 0.9, roughness: 0.3 }));
  gd.position.y = 0.11;
  g.add(gd);
  const gm = gem(0.026, GEM_COLORS.topaz, 1.6);
  gm.position.set(0, 0.11, 0.03);
  gm.rotation.x = Math.PI / 2;
  g.add(gm);
  const curved = o.variant === 1;
  const st: BladeStation[] = curved
    ? [{ y: 0, w: 0.03 }, { y: 0.3, w: 0.032, x: 0.01 }, { y: 0.6, w: 0.028, x: 0.04 }, { y: 0.8, w: 0, x: 0.09 }]
    : [{ y: 0, w: 0.034 }, { y: 0.62, w: 0.03 }, { y: 0.8, w: 0 }];
  const b = blade(st, 0.008, mithril);
  b.position.y = 0.125;
  g.add(b);
  // A glowing edge of light, just outside the blade, that cuts threads.
  const edge = blade(st.map((s) => ({ ...s, w: s.w * 1.18, t: 0.002 })), 0.002, glowMat(0xffe7a0, 2.2));
  edge.position.y = 0.125;
  g.add(edge);
  if (!curved) {
    // The Thornmother's fang, set along the spine.
    const fang = spike(0.018, 0.3, plainMat(0xeee3c8), 5);
    fang.rotation.z = -0.05;
    fang.position.set(0, 0.2, -0.012);
    fang.scale.z = 0.5;
    g.add(fang);
  }
  const p = knob(0.03, plainMat(GOLD, { metalness: 0.9, roughness: 0.3 }));
  p.position.y = -0.125;
  g.add(p);
  return { object: g, length: 1.05, tip: new THREE.Vector3(curved ? 0.09 : 0, 0.92, 0) };
}

// ---------- Lightforged weapon ----------

export const LIGHTFORGED_VARIANTS = ["Sword", "Mace", "Staff"] as const;

/** White-gold metal, faintly shining. */
const radiant = () => plainMat(0xfff3d6, { metalness: 0.8, roughness: 0.25, emissive: 0xffd77a, emissiveIntensity: 0.35 });

export function buildLightforged(o: WeaponOptions): WeaponBuild {
  let w: WeaponBuild;
  if (o.variant === 2) {
    w = buildStaff({ ...o, variant: 1, wood: "elderwood", gem: null });
  } else if (o.variant === 1) {
    w = buildMace({ ...o, variant: 0, metal: "steel", wood: "ironwood" });
  } else {
    w = buildSword({ ...o, variant: 0, metal: "steel", wood: "ironwood" });
  }
  // Re-skin every metal part white-gold.
  w.object.traverse((ob) => {
    const m = ob as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.MeshStandardMaterial).metalness > 0.5) m.material = radiant();
  });
  // The filled soul gem it was quenched in, glowing where the guard meets the blade.
  const soul = gem(o.variant === 2 ? 0.065 : 0.035, 0xcfefff, 1.2);
  if (o.variant === 0) soul.position.set(0, 0.1, 0.03);
  else if (o.variant === 1) soul.position.set(0, 0.68, 0);
  else soul.position.set(0, 1.12, 0);
  w.object.add(soul);
  return { ...w, boltColor: 0xfff0b0, projectile: o.variant === 2 ? () => bolt(0xfff0b0) : undefined };
}
