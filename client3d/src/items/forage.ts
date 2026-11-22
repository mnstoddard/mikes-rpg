// Things you dig up with Foraging (shared/foraging.ts FORAGE_FINDS): herbs,
// mushrooms, roots, honeycomb, bones, flowers, truffles and worms.
import * as THREE from "three";
import { ItemShape, Rng, ball, between, glowMat, lathe, lump, mat, mesh, rod, rough, slab } from "./kit";

export type ForageKind = "sage" | "red_cap" | "mushroom" | "wild_root" | "ginseng" | "honey" | "old_bone" | "blue_lotus" | "moonpetal" | "truffle" | "worm";

/** A leaf: a pointed oval, a little cupped. */
function leaf(len: number, wid: number, color: number): THREE.Mesh {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push([Math.sin(t * Math.PI) * wid, t * len]);
  }
  for (let i = 5; i >= 1; i--) {
    const t = i / 6;
    pts.push([-Math.sin(t * Math.PI) * wid, t * len]);
  }
  return slab(pts, 0.004, mat(color, { roughness: 0.8 }));
}

function sage(rng: Rng): THREE.Group {
  // A small bunch of soft grey-green leaves tied with string.
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const stem = new THREE.Group();
    stem.add(rod(0.004, 0.003, 0.2, mat(0x6f7f56), 4));
    for (let j = 0; j < 4; j++) {
      const l = leaf(0.06, 0.018, j % 2 ? 0x9bb08a : 0x8aa07c);
      l.position.y = 0.06 + j * 0.035;
      l.rotation.z = (j % 2 ? 1 : -1) * 0.9;
      l.rotation.y = rng() * 6;
      stem.add(l);
    }
    stem.rotation.set(Math.PI / 2 - 0.15, 0, (i - 1.5) * 0.18);
    g.add(stem);
  }
  const tie = rod(0.012, 0.012, 0.012, mat(0xd8c49a), 6, -0.006);
  tie.rotation.x = Math.PI / 2;
  tie.position.z = 0.04;
  g.add(tie);
  g.position.y = 0.015;
  return g;
}

function toadstool(capColor: number, spots: boolean, rng: Rng, tall = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(rod(0.018, 0.014, 0.07 * tall, mat(0xf0e8d6), 6));
  const cap = mesh(new THREE.SphereGeometry(0.045, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(capColor, { roughness: 0.6 }));
  cap.scale.y = 0.75;
  cap.position.y = 0.065 * tall;
  g.add(cap);
  if (spots) {
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2, up = between(rng, 0.25, 1.1);
      const s = ball(0.007, mat(0xfaf6ea), 0, Math.cos(a) * Math.cos(up) * 0.045, 0.065 * tall + Math.sin(up) * 0.034, Math.sin(a) * Math.cos(up) * 0.045);
      g.add(s);
    }
  }
  return g;
}

function root(color: number, rng: Rng, knobbly: boolean): THREE.Group {
  // A twisty root lying on its side, with hair-thin rootlets.
  const g = new THREE.Group();
  const main = mesh(rough(new THREE.CylinderGeometry(0.012, 0.03, 0.2, 6, 4), rng, 0.01), mat(color));
  main.rotation.z = Math.PI / 2 - 0.1;
  main.position.y = 0.03;
  g.add(main);
  if (knobbly) {
    // Ginseng: little "arms and legs".
    for (const [x, a] of [[-0.03, 0.7], [0.0, -0.8], [0.05, 0.6]] as [number, number][]) {
      const arm = rod(0.01, 0.004, 0.08, mat(color), 5);
      arm.position.set(x, 0.03, 0);
      arm.rotation.set(Math.PI / 2, 0, a);
      g.add(arm);
    }
  }
  for (let i = 0; i < 4; i++) {
    const r = rod(0.002, 0.001, 0.05, mat(color), 3);
    r.position.set(-0.09 + rng() * 0.04, 0.03, 0);
    r.rotation.set(rng() * 3, 0, Math.PI / 2 + between(rng, -0.6, 0.6));
    g.add(r);
  }
  // A green tuft at the top end.
  for (let i = 0; i < 3; i++) {
    const l = leaf(0.07, 0.012, 0x6a9e3c);
    l.position.set(0.1, 0.035, 0);
    l.rotation.set(0, i * 1.1, -1.2 + i * 0.2);
    g.add(l);
  }
  return g;
}

function honeycomb(): THREE.Group {
  const g = new THREE.Group();
  const wax = mat(0xe8a83a, { roughness: 0.35, emissive: 0x6a3a00, emissiveIntensity: 0.15 });
  const cells = new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6, 1);
  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      if (row !== 0 && col === 1) continue;
      const cell = mesh(cells, wax);
      cell.position.set(col * 0.038 + (row !== 0 ? 0.019 : 0), 0.025, row * 0.033);
      g.add(cell);
      const honey = mesh(new THREE.CircleGeometry(0.016, 6), mat(0xf6c24a, { roughness: 0.1, emissive: 0xa06000, emissiveIntensity: 0.3 }));
      honey.rotation.x = -Math.PI / 2;
      honey.position.set(cell.position.x, 0.051, cell.position.z);
      g.add(honey);
    }
  }
  // A drip down one side.
  g.add(ball(0.01, mat(0xf6c24a, { roughness: 0.1 }), 0, 0.06, 0.012, 0.03));
  return g;
}

function bone(): THREE.Group {
  const g = new THREE.Group();
  const ivory = mat(0xe8dfc6, { roughness: 0.7 });
  const shaft = rod(0.014, 0.014, 0.2, ivory, 6, -0.1);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  for (const x of [-0.1, 0.1]) for (const z of [-0.014, 0.014]) g.add(ball(0.022, ivory, 0, x, 0, z));
  g.position.y = 0.022;
  g.rotation.y = 0.4;
  return g;
}

function flower(petal: number, centre: number, petals: number, glow: boolean): THREE.Group {
  const g = new THREE.Group();
  const pm = glow ? glowMat(petal, 0.7) : mat(petal, { roughness: 0.5 });
  // Two rings of petals, opening upward, on a lily pad (lotus) or a stem (moonpetal).
  for (let ring = 0; ring < 2; ring++) {
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + ring * (Math.PI / petals);
      const p = new THREE.Group();
      const l = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07 - ring * 0.015, 4), pm);
      l.castShadow = true;
      l.position.y = 0.035;
      l.scale.z = 0.35;
      p.add(l);
      p.rotation.set(0, -a, 0);
      p.rotateX(0.9 - ring * 0.45);
      g.add(p);
    }
  }
  g.add(ball(0.016, glow ? glowMat(centre, 1.4) : mat(centre), 0, 0, 0.012, 0));
  return g;
}

function blueLotus(): THREE.Group {
  const g = new THREE.Group();
  const pad = mesh(new THREE.CircleGeometry(0.1, 12, 0.3, Math.PI * 2 - 0.3), mat(0x3f8a4a, { roughness: 0.6 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.004;
  g.add(pad);
  const f = flower(0x5a8af0, 0xf6d04a, 7, false);
  f.position.y = 0.01;
  g.add(f);
  return g;
}

function moonpetal(): { g: THREE.Group; light: THREE.PointLight } {
  const g = new THREE.Group();
  const stem = rod(0.004, 0.003, 0.12, mat(0x5a8a6a), 4);
  stem.rotation.z = Math.PI / 2 - 0.2;
  stem.position.set(-0.1, 0.008, 0);
  g.add(stem);
  const f = flower(0xd8e6ff, 0x9ad0ff, 5, true);
  f.position.set(0.03, 0.03, 0);
  f.rotation.z = -0.5;
  g.add(f);
  const light = new THREE.PointLight(0xa8d0ff, 0.25, 1.2, 2);
  light.position.set(0.03, 0.08, 0);
  g.add(light);
  return { g, light };
}

function truffle(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const t = lump(rng, i ? 0.028 : 0.04, mat(0x3e2c22, { roughness: 1 }), 0.45, 1);
    t.position.set(i * 0.06, i ? 0.026 : 0.036, i * 0.02);
    g.add(t);
  }
  return g;
}

function worm(): { g: THREE.Group; segs: THREE.Mesh[] } {
  const g = new THREE.Group();
  const segs: THREE.Mesh[] = [];
  const m = mat(0xd88a8a, { roughness: 0.5 });
  for (let i = 0; i < 9; i++) {
    const s = ball(0.012 - Math.abs(i - 4) * 0.0008, m, 1);
    segs.push(s);
    g.add(s);
  }
  // A darker band (the "saddle").
  segs[3].material = mat(0xc06868, { roughness: 0.5 });
  return { g, segs };
}

/** Build a forage find. */
export function buildForage(kind: ForageKind, rng: Rng): ItemShape {
  const object = new THREE.Group();
  switch (kind) {
    case "sage": object.add(sage(rng)); break;
    case "red_cap": {
      object.add(toadstool(0xd8382c, true, rng));
      const small = toadstool(0xd8382c, true, rng, 0.7);
      small.scale.setScalar(0.65);
      small.position.set(0.06, 0, 0.03);
      object.add(small);
      break;
    }
    case "mushroom": {
      for (let i = 0; i < 3; i++) {
        const m = toadstool(0xb89a72, false, rng, between(rng, 0.8, 1.2));
        m.scale.setScalar(between(rng, 0.7, 1));
        m.position.set((i - 1) * 0.05, 0, (i % 2) * 0.03);
        m.rotation.z = (i - 1) * 0.15;
        object.add(m);
      }
      break;
    }
    case "wild_root": object.add(root(0xa87a4a, rng, false)); break;
    case "ginseng": object.add(root(0xe6cf9e, rng, true)); break;
    case "honey": object.add(honeycomb()); break;
    case "old_bone": object.add(bone()); break;
    case "blue_lotus": object.add(blueLotus()); break;
    case "moonpetal": {
      const { g, light } = moonpetal();
      object.add(g);
      return { object, tick: (_dt, t) => (light.intensity = 0.22 + Math.sin(t * 1.7) * 0.06) };
    }
    case "truffle": object.add(truffle(rng)); break;
    case "worm": {
      const { g, segs } = worm();
      object.add(g);
      return {
        object,
        tick: (_dt, t) =>
          segs.forEach((s, i) => s.position.set((i - 4) * 0.016, 0.011 + Math.max(0, Math.sin(t * 3 - i * 0.7)) * 0.006, Math.sin(t * 2.2 - i * 0.6) * 0.012)),
      };
    }
  }
  return { object };
}


/** A little cloth seed pouch, tied at the top, with a few seeds spilled out. Colour shows the crop. */
export function buildSeeds(color: number, rng: Rng): ItemShape {
  const object = new THREE.Group();
  const sack = lathe([[0, 0], [0.04, 0.005], [0.05, 0.03], [0.045, 0.06], [0.02, 0.075], [0.012, 0.08], [0.025, 0.1], [0, 0.1]], mat(0xd8c49a, { roughness: 1 }), 8);
  object.add(sack);
  const tie = mesh(new THREE.TorusGeometry(0.014, 0.004, 3, 8), mat(color));
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.078;
  object.add(tie);
  for (let i = 0; i < 6; i++) {
    const s = ball(0.006, mat(color, { roughness: 0.6 }), 0, 0.05 + rng() * 0.05, 0.005, between(rng, -0.04, 0.04));
    s.scale.set(1, 0.7, 1.4);
    object.add(s);
  }
  return { object };
}
