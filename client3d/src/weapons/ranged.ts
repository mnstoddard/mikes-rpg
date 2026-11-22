// Ranged weapons: sling, darts, bow, and the arrows a bow shoots.
import * as THREE from "three";
import { WeaponBuild, WeaponOptions } from "./types";
import { LEATHER, LEATHER_DARK, WeaponMetal, fin, knob, metalMat, plainMat, pole, spike, tube, woodMat } from "./parts";

// ---------- Sling ----------

export const SLING_VARIANTS = ["Leather", "Rope"] as const;

/** The shot a sling throws: a pebble, or a ball of metal. */
function slingShot(metal: WeaponMetal): THREE.Mesh {
  const s = knob(metal === "stone" ? 0.03 : 0.025, metalMat(metal), metal === "stone" ? 0 : 1);
  return s;
}

export function buildSling(o: WeaponOptions): WeaponBuild {
  // Held by the loop at the top (0,0,0); the pouch hangs below.
  const g = new THREE.Group();
  const cord = plainMat(o.variant === 0 ? LEATHER_DARK : 0xcdb98f);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 5, 10), cord);
  g.add(loop);
  for (const s of [-1, 1]) {
    g.add(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.02, -0.25, 0.01), new THREE.Vector3(s * 0.05, -0.5, 0)], 0.005, cord, 10, 4));
  }
  const pouchMat = plainMat(o.variant === 0 ? LEATHER : 0xb89a68).clone();
  pouchMat.side = THREE.DoubleSide;
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 5, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), pouchMat);
  pouch.scale.set(1, 0.7, 0.8);
  pouch.position.y = -0.5;
  g.add(pouch);
  const shot = slingShot(o.metal);
  shot.position.y = -0.53;
  g.add(shot);
  return { object: g, length: 0.6, tip: new THREE.Vector3(0, -0.52, 0), projectile: () => slingShot(o.metal) };
}

// ---------- Darts ----------

export const DART_VARIANTS = ["Feathered", "Finned"] as const;

function dart(o: WeaponOptions): THREE.Group {
  // Pinched between the fingers at (0,0,0); the point goes up +Y.
  const g = new THREE.Group();
  g.add(pole(-0.08, 0.06, 0.006, 0.008, woodMat(o.wood), 5));
  const point = spike(0.01, 0.07, metalMat(o.metal), 4);
  point.position.y = 0.06;
  g.add(point);
  const flight = o.variant === 0 ? 0xf2efe6 : 0xc8473a;
  for (let i = 0; i < 3; i++) {
    const f = fin(0.06, o.variant === 0 ? 0.022 : 0.03, flight);
    f.position.y = -0.085;
    f.rotation.y = (i / 3) * Math.PI * 2;
    g.add(f);
  }
  return g;
}

export function buildDarts(o: WeaponOptions): WeaponBuild {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const d = dart(o);
    d.rotation.z = (i - 1) * 0.35;
    d.position.x = (i - 1) * 0.015;
    g.add(d);
  }
  return { object: g, held: dart(o), length: 0.22, tip: new THREE.Vector3(0, 0.13, 0), projectile: () => dart(o) };
}

// ---------- Arrows ----------

export const ARROW_VARIANTS = ["Grey goose", "Bright"] as const;

/** One arrow, pointing up +Y, with its nock (the back end) at (0,0,0). */
export function arrow(metal: WeaponMetal, variant = 0, wood: THREE.Material = woodMat("pine")): THREE.Group {
  const g = new THREE.Group();
  g.add(pole(0, 0.7, 0.006, 0.006, wood, 5));
  const tip = spike(metal === "stone" ? 0.017 : 0.014, 0.07, metalMat(metal), metal === "stone" ? 3 : 4);
  tip.position.y = 0.69;
  g.add(tip);
  const colors = variant === 0 ? [0xd8d3c6, 0xa29b8c] : [0xe85a3c, 0x3a8fd8];
  for (let i = 0; i < 3; i++) {
    const f = fin(0.12, 0.02, colors[i === 0 ? 1 : 0]);
    f.position.y = 0.03;
    f.rotation.y = (i / 3) * Math.PI * 2;
    g.add(f);
  }
  return g;
}

export function buildArrows(o: WeaponOptions): WeaponBuild {
  // On show: a quiver of them. In the hand: a plain pine bow, shooting these.
  const g = new THREE.Group();
  const quiver = pole(-0.32, 0.12, 0.07, 0.08, plainMat(LEATHER), 8);
  g.add(quiver);
  const band = pole(0.02, 0.06, 0.085, 0.085, plainMat(LEATHER_DARK), 8);
  g.add(band);
  for (let i = 0; i < 7; i++) {
    const a = arrow(o.metal, o.variant);
    const ang = (i / 7) * Math.PI * 2;
    a.position.set(Math.cos(ang) * 0.035, -0.28, Math.sin(ang) * 0.035);
    a.rotation.set(Math.sin(ang) * 0.08, ang, Math.cos(ang) * 0.08);
    // Points up, so you can see the tips.
    g.add(a);
  }
  const bow = buildBow({ ...o, variant: 0, wood: "pine" }, o.metal, o.variant);
  return { ...bow, object: g, held: bow.object, length: 0.75 };
}

// ---------- Bow ----------

export const BOW_VARIANTS = ["Short", "Recurve", "Long"] as const;

/**
 * A bow, held at the middle. It stands up the Y axis; the string is behind
 * (toward -Z, the archer). draw(0..1) pulls the string back with an arrow on it.
 */
export function buildBow(o: WeaponOptions, arrowMetal: WeaponMetal = "stone", arrowVariant = 0): WeaponBuild & { draw: (amount: number) => void } {
  const g = new THREE.Group();
  const wood = woodMat(o.wood);
  const L = [1.05, 1.2, 1.6][o.variant];
  const half = L / 2;
  const limbPts = (s: 1 | -1) =>
    o.variant === 1
      ? [new THREE.Vector3(0, s * 0.07, 0), new THREE.Vector3(0, s * half * 0.45, -0.1), new THREE.Vector3(0, s * half * 0.85, -0.13), new THREE.Vector3(0, s * half, -0.07)]
      : [new THREE.Vector3(0, s * 0.07, 0), new THREE.Vector3(0, s * half * 0.5, -0.07), new THREE.Vector3(0, s * half, -0.15)];
  for (const s of [1, -1] as const) {
    const pts = limbPts(s);
    g.add(tube(pts, o.variant === 2 ? 0.016 : 0.018, wood, 14, 6));
  }
  g.add(pole(-0.08, 0.08, 0.024, 0.024, plainMat(LEATHER), 7));
  const tipZ = o.variant === 1 ? -0.07 : -0.15;
  // The string: top tip, nock point, bottom tip.
  const stringGeo = new THREE.BufferGeometry();
  const sp = new Float32Array([0, half, tipZ, 0, 0, tipZ, 0, -half, tipZ]);
  stringGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xf3ead8 }));
  g.add(string);
  // The arrow waiting on the string (shown while drawing).
  const nocked = arrow(arrowMetal, arrowVariant);
  nocked.rotation.x = Math.PI / 2; // point it forward (+Z)
  nocked.position.set(0.02, 0.02, tipZ);
  nocked.visible = false;
  g.add(nocked);
  const draw = (amount: number) => {
    const z = tipZ - amount * 0.55;
    sp[5] = z;
    stringGeo.attributes.position.needsUpdate = true;
    nocked.visible = amount > 0.02;
    nocked.position.z = z;
  };
  return {
    object: g, length: L, tip: new THREE.Vector3(0, 0.02, 0.2), draw,
    projectile: () => arrow(arrowMetal, arrowVariant),
  };
}

/** Bows ignore the metal: the wood is everything. */
export function buildBowWeapon(o: WeaponOptions): WeaponBuild {
  return buildBow(o);
}

