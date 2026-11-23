// Things monsters drop, and Handicraft scraps and bait.
import * as THREE from "three";
import { ItemShape, Rng, ball, between, glassMat, glowMat, lump, mat, mesh, metalMat, rod, rough, slab } from "./kit";
import { makeRing } from "./gems";

export type LootKind =
  | "feather" | "rat_tail" | "cowhide" | "wolf_pelt" | "boar_hide" | "goblin_charm" | "spider_silk" | "stolen_ring"
  | "slime_goo" | "boar_tusk" | "wolf_fang" | "bat_wing" | "venom_sac" | "food_scraps" | "bait";

function feather(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const quill = rod(0.003, 0.0015, 0.22, mat(0xf2ece0), 4);
  quill.rotation.z = Math.PI / 2;
  quill.position.x = 0.11;
  g.add(quill);
  // The vane: a long leaf shape with a couple of notches.
  const pts: [number, number][] = [[0.03, 0], [0.08, 0.022], [0.15, 0.026], [0.2, 0.012], [0.215, 0], [0.2, -0.01], [0.16, -0.02], [0.12, -0.012], [0.11, -0.022], [0.06, -0.018]];
  const vane = slab(pts, 0.002, mat(0xf6f2ea, { roughness: 0.9 }));
  vane.position.x = -0.1;
  vane.rotation.x = -Math.PI / 2 + 0.15;
  g.add(vane);
  g.position.y = 0.01;
  g.rotation.y = rng() * 0.5;
  return g;
}

function ratTail(): THREE.Group {
  // One smooth tail that tapers to a point, lying in a lazy S-curve on the ground.
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector3(-0.13 + t * 0.26, 0, Math.sin(t * Math.PI * 1.6) * 0.03));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = 40, radial = 7;
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  // Taper: thick at the base (where it was cut), thin at the tip.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / (radial + 1));
    const t = ring / segs;
    curve.getPointAt(t, c);
    const r = 0.009 * (1 - t) + 0.0012;
    pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * r, c.y + (pos.getY(i) - c.y) * r, c.z + (pos.getZ(i) - c.z) * r);
  }
  geo.computeVertexNormals();
  const tail = mesh(geo, mat(0xd8a0a0, { roughness: 0.55 }));
  tail.position.y = 0.009;
  g.add(tail);
  // A little tuft of grey fur at the cut end.
  const tuft = ball(0.012, mat(0x8a8078, { roughness: 1 }), 0, -0.132, 0.01, 0);
  tuft.scale.set(0.8, 0.9, 1);
  g.add(tuft);
  return g;
}

/** A hide lying flat: four leg flaps and a body shape. */
function hide(color: number, fur: boolean, rng: Rng, spots?: number): THREE.Group {
  const g = new THREE.Group();
  const pts: [number, number][] = [[-0.22, 0], [-0.26, 0.1], [-0.18, 0.12], [-0.12, 0.2], [0.1, 0.2], [0.16, 0.12], [0.26, 0.12], [0.22, 0], [0.26, -0.12], [0.16, -0.12], [0.1, -0.2], [-0.12, -0.2], [-0.18, -0.12], [-0.26, -0.1]];
  const m = mat(color, { roughness: 1 });
  const body = fur ? mesh(rough(new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.025, bevelEnabled: false }), rng, 0.012), m) : slab(pts, 0.008, m);
  body.rotation.x = -Math.PI / 2;
  body.position.y = 0.004;
  g.add(body);
  if (spots !== undefined) {
    for (let i = 0; i < 5; i++) {
      const s = mesh(new THREE.CircleGeometry(between(rng, 0.03, 0.05), 6), mat(spots));
      s.rotation.x = -Math.PI / 2;
      s.position.set(between(rng, -0.15, 0.15), 0.0095, between(rng, -0.12, 0.12));
      g.add(s);
    }
  }
  g.scale.setScalar(0.9);
  return g;
}

function charm(): THREE.Group {
  // A goblin charm: a carved bone disc with a glaring eye, on a cord.
  const g = new THREE.Group();
  const disc = rod(0.04, 0.04, 0.012, mat(0xc8b48a), 7, 0);
  g.add(disc);
  const eye = mesh(new THREE.CircleGeometry(0.02, 8), mat(0x2a6ad0, { roughness: 0.3 }));
  eye.rotation.x = -Math.PI / 2;
  eye.position.y = 0.013;
  const pupil = mesh(new THREE.CircleGeometry(0.008, 6), glowMat(0xffd04a, 0.8));
  pupil.rotation.x = -Math.PI / 2;
  pupil.position.y = 0.014;
  g.add(eye, pupil);
  const cord = mesh(new THREE.TorusGeometry(0.06, 0.003, 3, 14, Math.PI * 1.3), mat(0x5a3a22));
  cord.rotation.x = -Math.PI / 2;
  cord.position.set(0, 0.004, -0.06);
  g.add(cord);
  return g;
}

function silk(): THREE.Group {
  // A loose, shiny white skein.
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const t = mesh(new THREE.TorusGeometry(0.05, 0.006, 4, 12), mat(0xf6f6fa, { roughness: 0.25, metalness: 0.1 }));
    t.rotation.set(Math.PI / 2 + (i - 2) * 0.12, (i - 2) * 0.2, 0);
    t.position.y = 0.012;
    t.scale.set(1.5, 1, 1);
    g.add(t);
  }
  return g;
}

function tusk(len: number, color: number): THREE.Group {
  // A curved horn shape, built from shrinking pieces.
  const g = new THREE.Group();
  const m = mat(color, { roughness: 0.5 });
  let x = 0, y = 0.02;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const r0 = 0.018 * (1 - i / n) * (len / 0.15) + 0.002, r1 = 0.018 * (1 - (i + 1) / n) * (len / 0.15) + 0.001;
    const seg = rod(r0, r1, len / n + 0.004, m, 6);
    const a = Math.PI / 2 - i * 0.16;
    seg.rotation.z = -a;
    seg.position.set(x, y, 0);
    g.add(seg);
    x += Math.sin(a) * (len / n);
    y += Math.cos(a) * (len / n);
  }
  g.position.x = -len / 2;
  return g;
}

function batWing(): THREE.Group {
  const g = new THREE.Group();
  const pts: [number, number][] = [[0, 0], [0.06, 0.06], [0.12, 0.07], [0.2, 0.05], [0.18, 0.02], [0.15, 0.03], [0.13, -0.005], [0.09, 0.012], [0.06, -0.02], [0.03, 0.0]];
  const membrane = slab(pts, 0.003, mat(0x4a3a4a, { roughness: 0.8 }));
  membrane.rotation.x = -Math.PI / 2;
  membrane.position.y = 0.005;
  g.add(membrane);
  // Finger bones.
  for (const [x, z, a] of [[0.06, -0.03, 0.4], [0.09, -0.035, 0.1], [0.1, -0.025, -0.3]] as [number, number, number][]) {
    const b = rod(0.003, 0.002, 0.09, mat(0x3a2a3a), 3);
    b.rotation.set(0, a, Math.PI / 2);
    b.position.set(x - 0.03, 0.008, z + 0.02);
    g.add(b);
  }
  g.position.x = -0.1;
  return g;
}

function venomSac(): { g: THREE.Group; sac: THREE.Mesh } {
  const g = new THREE.Group();
  const sac = mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(0x7ad04a, { roughness: 0.25, emissive: 0x3a8a1a, emissiveIntensity: 0.35 }));
  sac.scale.set(1, 0.8, 1.2);
  sac.position.y = 0.032;
  g.add(sac);
  // The little stalk where it was cut off.
  const s = rod(0.008, 0.004, 0.03, mat(0x4a6a2a), 5);
  s.rotation.x = Math.PI / 2;
  s.position.set(0, 0.035, 0.045);
  g.add(s);
  return { g, sac };
}

function slime(): { g: THREE.Group; blob: THREE.Mesh } {
  const g = new THREE.Group();
  const blob = mesh(new THREE.SphereGeometry(0.055, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat(0x6ad05a, 0.7));
  (blob.material as THREE.MeshStandardMaterial).emissive.setHex(0x2a7a1a);
  (blob.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
  blob.scale.y = 0.6;
  g.add(blob);
  g.add(ball(0.01, mat(0xc8f0a0), 0, 0.015, 0.02, 0.01));
  return { g, blob };
}

function scraps(rng: Rng): THREE.Group {
  // A little heap: a bone, crusts and peel.
  const g = new THREE.Group();
  const b = rod(0.008, 0.008, 0.09, mat(0xe8dfc6), 5, -0.045);
  b.rotation.z = Math.PI / 2;
  b.position.set(0, 0.03, 0);
  g.add(b, ball(0.012, mat(0xe8dfc6), 0, 0.045, 0.03, 0), ball(0.012, mat(0xe8dfc6), 0, -0.045, 0.03, 0));
  for (let i = 0; i < 6; i++) {
    const p = lump(rng, between(rng, 0.015, 0.03), mat([0xc89a5a, 0x8a6a3a, 0xd8c050, 0x7a9a4a][i % 4], { roughness: 1 }), 0.5);
    p.position.set(between(rng, -0.05, 0.05), 0.015, between(rng, -0.04, 0.04));
    g.add(p);
  }
  return g;
}

export type BaitKind = "bait_worm" | "bait_chum" | "bait_glow";
export const BAIT_KINDS: BaitKind[] = ["bait_worm", "bait_chum", "bait_glow"];

function bait(kind: BaitKind, rng: Rng): THREE.Group {
  // A small tin with the lid off.
  const g = new THREE.Group();
  const tin = rod(0.05, 0.05, 0.04, metalMat("iron"), 12, 0);
  g.add(tin);
  const lid = rod(0.052, 0.052, 0.008, metalMat("steel"), 12, 0);
  lid.position.set(0.09, 0, 0.02);
  g.add(lid);
  if (kind === "bait_worm") {
    for (let i = 0; i < 4; i++) {
      const w = mesh(new THREE.TorusGeometry(0.018, 0.006, 4, 8, Math.PI * 1.4), mat(0xd88a8a));
      w.rotation.set(-Math.PI / 2 + between(rng, -0.4, 0.4), 0, rng() * 6);
      w.position.set(between(rng, -0.02, 0.02), 0.042, between(rng, -0.02, 0.02));
      g.add(w);
    }
  } else if (kind === "bait_chum") {
    const top = mesh(new THREE.CircleGeometry(0.046, 12), mat(0x8a5a4a, { roughness: 1 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.038;
    g.add(top);
    for (let i = 0; i < 5; i++) g.add(ball(0.008, mat(0xc89a8a), 0, between(rng, -0.03, 0.03), 0.04, between(rng, -0.03, 0.03)));
  } else {
    for (let i = 0; i < 6; i++) g.add(ball(0.01, glowMat(0x9af0ff, 1.5), 0, between(rng, -0.03, 0.03), 0.044, between(rng, -0.03, 0.03)));
  }
  return g;
}

/** Build a piece of loot. `variant` picks wolf / alpha pelt, or which bait. */
export function buildLoot(kind: LootKind, variant: number, rng: Rng): ItemShape {
  const object = new THREE.Group();
  switch (kind) {
    case "feather": object.add(feather(rng)); break;
    case "rat_tail": object.add(ratTail()); break;
    case "cowhide": object.add(hide(0xf2ede4, false, rng, 0x2a2420)); break;
    case "wolf_pelt": object.add(hide(variant ? 0xe6e8ee : 0x7a7a80, true, rng)); break;
    case "boar_hide": object.add(hide(0x6a4a32, true, rng)); break;
    case "goblin_charm": object.add(charm()); break;
    case "spider_silk": object.add(silk()); break;
    case "stolen_ring": object.add(makeRing("gold", "ruby", rng)); break;
    case "boar_tusk": object.add(tusk(0.15, 0xe8dcc0)); break;
    case "wolf_fang": object.add(tusk(0.07, 0xf2ece0)); break;
    case "bat_wing": object.add(batWing()); break;
    case "food_scraps": object.add(scraps(rng)); break;
    case "bait": object.add(bait(BAIT_KINDS[variant] ?? "bait_worm", rng)); break;
    case "venom_sac": {
      const { g, sac } = venomSac();
      object.add(g);
      return { object, tick: (_dt, t) => sac.scale.set(1 + Math.sin(t * 2.5) * 0.04, 0.8 - Math.sin(t * 2.5) * 0.03, 1.2) };
    }
    case "slime_goo": {
      const { g, blob } = slime();
      object.add(g);
      return { object, tick: (_dt, t) => blob.scale.set(1 + Math.sin(t * 3) * 0.06, 0.6 - Math.sin(t * 3) * 0.06, 1 + Math.cos(t * 3) * 0.05) };
    }
  }
  return { object };
}

