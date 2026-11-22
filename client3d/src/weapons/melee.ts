// Melee weapons: dagger, sword, mace, spear and two-handed sword.
// Each is a metal (or stone) head on a wooden grip. Stone ones are thick and
// chipped like flint, tied on with leather instead of a metal guard.
import * as THREE from "three";
import { WeaponBuild, WeaponOptions } from "./types";
import {
  BladeStation, LEATHER, LEATHER_DARK, blade, box, grip, knob, metalMat, plainMat, pole, spike, straightBlade, woodMat,
} from "./parts";

const isStone = (o: WeaponOptions) => o.metal === "stone";

/** The guard: a metal bar, or a leather binding on stone weapons. */
function guard(o: WeaponOptions, w: number, h: number, d: number): THREE.Mesh {
  return isStone(o) ? box(w * 0.55, h * 1.6, d * 1.4, plainMat(LEATHER)) : box(w, h, d, metalMat(o.metal, true));
}

/** Stone blades are thicker and a little lumpy, like knapped flint. */
function stoneify(st: BladeStation[], o: WeaponOptions): BladeStation[] {
  if (!isStone(o)) return st;
  return st.map((s, i) => ({ ...s, w: s.w * (i % 2 ? 0.92 : 1.06) }));
}

// ---------- Dagger ----------

export const DAGGER_VARIANTS = ["Straight", "Curved", "Leaf"] as const;

export function buildDagger(o: WeaponOptions): WeaponBuild {
  const g = new THREE.Group();
  g.add(grip(0.11, 0.017, woodMat(o.wood), { wraps: 2 }));
  const gd = guard(o, 0.1, 0.02, 0.035);
  gd.position.y = 0.065;
  g.add(gd);
  const st: BladeStation[][] = [
    straightBlade(0.24, 0.022, 0.07, 0.006),
    [{ y: 0, w: 0.022 }, { y: 0.1, w: 0.022, x: 0.004 }, { y: 0.18, w: 0.018, x: 0.02 }, { y: 0.245, w: 0, x: 0.045 }],
    [{ y: 0, w: 0.014 }, { y: 0.08, w: 0.031 }, { y: 0.17, w: 0.024 }, { y: 0.25, w: 0 }],
  ];
  const b = blade(stoneify(st[o.variant], o), isStone(o) ? 0.012 : 0.006, metalMat(o.metal));
  b.position.y = 0.075;
  g.add(b);
  const p = knob(0.022, isStone(o) ? woodMat(o.wood, true) : metalMat(o.metal, true));
  p.position.y = -0.068;
  g.add(p);
  return { object: g, length: 0.4, tip: new THREE.Vector3(0, 0.32, 0) };
}

// ---------- Sword ----------

export const SWORD_VARIANTS = ["Arming", "Broad", "Leaf"] as const;

export function buildSword(o: WeaponOptions): WeaponBuild {
  const g = new THREE.Group();
  g.add(grip(0.18, 0.019, woodMat(o.wood), { wraps: 3 }));
  const wide = o.variant === 1;
  const gd = guard(o, wide ? 0.24 : 0.2, 0.028, 0.045);
  gd.position.y = 0.1;
  g.add(gd);
  const st: BladeStation[][] = [
    straightBlade(0.72, 0.03, 0.13, 0.008, 0.8),
    [{ y: 0, w: 0.045 }, { y: 0.6, w: 0.042 }, { y: 0.7, w: 0 }],
    [{ y: 0, w: 0.026 }, { y: 0.3, w: 0.03 }, { y: 0.55, w: 0.045 }, { y: 0.66, w: 0.03 }, { y: 0.74, w: 0 }],
  ];
  const b = blade(stoneify(st[o.variant], o), isStone(o) ? 0.016 : 0.008, metalMat(o.metal));
  b.position.y = 0.113;
  g.add(b);
  const p = knob(0.03, isStone(o) ? woodMat(o.wood, true) : metalMat(o.metal, true));
  p.position.y = -0.11;
  g.add(p);
  return { object: g, length: 0.95, tip: new THREE.Vector3(0, 0.84, 0) };
}

// ---------- Mace ----------

export const MACE_VARIANTS = ["Flanged", "Spiked", "Hammer"] as const;

export function buildMace(o: WeaponOptions): WeaponBuild {
  const g = new THREE.Group();
  const wood = woodMat(o.wood);
  g.add(pole(-0.12, 0.5, 0.019, 0.017, wood, 7));
  g.add(grip(0.16, 0.021, wood, { wraps: 3 }));
  const m = metalMat(o.metal);
  const dark = metalMat(o.metal, true);
  const head = new THREE.Group();
  head.position.y = 0.55;
  if (o.variant === 0) {
    head.add(pole(-0.08, 0.1, 0.03, 0.03, dark, 6));
    for (let i = 0; i < 6; i++) {
      const f = box(0.012, 0.15, 0.06, m);
      const a = (i / 6) * Math.PI * 2;
      f.position.set(Math.cos(a) * 0.045, 0, Math.sin(a) * 0.045);
      f.rotation.y = -a;
      head.add(f);
    }
    const cap = spike(0.03, 0.05, dark, 6);
    cap.position.y = 0.09;
    head.add(cap);
  } else if (o.variant === 1) {
    head.add(knob(0.07, m, 0));
    const dirs = new THREE.IcosahedronGeometry(1, 0).attributes.position as THREE.BufferAttribute;
    const seen = new Set<string>();
    for (let i = 0; i < dirs.count; i++) {
      const d = new THREE.Vector3().fromBufferAttribute(dirs, i).normalize();
      const k = d.toArray().map((v) => v.toFixed(2)).join();
      if (seen.has(k)) continue;
      seen.add(k);
      const s = spike(0.016, 0.06, dark, 4);
      s.position.copy(d).multiplyScalar(0.055);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      head.add(s);
    }
  } else {
    const h = box(0.2, 0.08, 0.08, m);
    head.add(h);
    const face = box(0.03, 0.095, 0.095, dark);
    face.position.x = 0.1;
    const back = spike(0.035, 0.08, dark, 4);
    back.rotation.z = Math.PI / 2;
    back.position.x = -0.1;
    head.add(face, back);
  }
  if (o.metal === "stone") head.scale.setScalar(1.1);
  g.add(head);
  return { object: g, length: 0.75, tip: new THREE.Vector3(0, 0.6, 0) };
}

// ---------- Spear ----------

export const SPEAR_VARIANTS = ["Leaf", "Winged", "Barbed"] as const;

export function buildSpear(o: WeaponOptions): WeaponBuild {
  // Held a third of the way up: the grip point (0,0,0) is near the back.
  const g = new THREE.Group();
  const wood = woodMat(o.wood);
  g.add(pole(-0.6, 1.4, 0.021, 0.018, wood, 7));
  g.add(grip(0.2, 0.023, wood, { wraps: 2 }));
  const butt = spike(0.022, 0.05, metalMat(o.metal, true), 6);
  butt.rotation.x = Math.PI;
  butt.position.y = -0.6;
  g.add(butt);
  const collar = pole(1.36, 1.44, 0.024, 0.02, isStoneOrLeather(o), 6);
  g.add(collar);
  const st: BladeStation[][] = [
    [{ y: 0, w: 0.016 }, { y: 0.08, w: 0.04 }, { y: 0.2, w: 0.026 }, { y: 0.3, w: 0 }],
    [{ y: 0, w: 0.016 }, { y: 0.12, w: 0.03 }, { y: 0.26, w: 0 }],
    [{ y: 0, w: 0.04 }, { y: 0.03, w: 0.012 }, { y: 0.1, w: 0.03 }, { y: 0.25, w: 0 }],
  ];
  const b = blade(stoneify(st[o.variant], o), isStone(o) ? 0.014 : 0.008, metalMat(o.metal));
  b.position.y = 1.43;
  g.add(b);
  if (o.variant === 1) {
    const wing = box(0.16, 0.02, 0.02, metalMat(o.metal, true));
    wing.position.y = 1.45;
    g.add(wing);
  }
  return { object: g, length: 2.1, tip: new THREE.Vector3(0, 1.72, 0) };
}
const isStoneOrLeather = (o: WeaponOptions) => (isStone(o) ? plainMat(LEATHER_DARK) : metalMat(o.metal, true));

// ---------- Two-handed sword ----------

export const GREATSWORD_VARIANTS = ["Classic", "Wide", "Flame"] as const;

export function buildGreatsword(o: WeaponOptions): WeaponBuild {
  const g = new THREE.Group();
  g.add(grip(0.36, 0.021, woodMat(o.wood), { wraps: 5 }));
  const gd = guard(o, o.variant === 1 ? 0.36 : 0.32, 0.034, 0.05);
  gd.position.y = 0.19;
  g.add(gd);
  if (!isStone(o)) {
    // The little hooks on a classic two-hander's guard.
    for (const s of [-1, 1]) {
      const hook = spike(0.012, 0.05, metalMat(o.metal, true), 4);
      hook.position.set(s * 0.16, 0.2, 0);
      g.add(hook);
    }
  }
  let st: BladeStation[];
  if (o.variant === 0) st = straightBlade(1.15, 0.04, 0.16, 0.01, 0.75);
  else if (o.variant === 1) st = [{ y: 0, w: 0.058 }, { y: 0.95, w: 0.055 }, { y: 1.1, w: 0.03 }, { y: 1.16, w: 0 }];
  else {
    // A wavy "flame" blade.
    st = [];
    for (let i = 0; i <= 12; i++) {
      const y = (i / 12) * 1.0;
      st.push({ y, w: 0.04 - i * 0.0012, x: i > 1 ? Math.sin(i * 1.6) * 0.008 : 0 });
    }
    st.push({ y: 1.16, w: 0 });
  }
  const b = blade(stoneify(st, o), isStone(o) ? 0.02 : 0.011, metalMat(o.metal));
  b.position.y = 0.205;
  g.add(b);
  const p = knob(0.038, isStone(o) ? woodMat(o.wood, true) : metalMat(o.metal, true));
  p.position.y = -0.2;
  g.add(p);
  return { object: g, length: 1.6, tip: new THREE.Vector3(0, 1.36, 0) };
}
