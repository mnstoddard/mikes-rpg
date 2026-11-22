// Workshop props and stations: things that stand in the world and that you
// use, not carry. Storage chest, anvil, furnace, workbench, spinning wheel,
// tanning rack, cooking stove, alchemy table, enchanting altar and the
// guild board. Each has an action (open the chest, light the furnace...).
import * as THREE from "three";
import { ItemShape, Rng, ball, between, box, ease, glowMat, lump, mat, mesh, metalMat, rod, rough, slab, tween } from "./kit";
import { makeBottle } from "./potions";
import { makeBar } from "./materials";

export type PropKind = "chest" | "anvil" | "furnace" | "workbench" | "spinning_wheel" | "tanning_rack" | "stove" | "alchemy_table" | "altar" | "guild_board";

const PLANK = 0x9a6a3e;
const PLANK_DARK = 0x6e4a2a;
const IRON = () => metalMat("iron", true);

/** A flickering fire: a few glowing cones and a light. strength 0 = out, 1 = normal, 2 = roaring. */
function fire(scale: number): { g: THREE.Group; set: (t: number, strength: number) => void } {
  const g = new THREE.Group();
  const flames: THREE.Mesh[] = [];
  const colors = [0xff5a1a, 0xff9a2a, 0xffd04a];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale * (1 - i * 0.12), 0.22 * scale * (1 - i * 0.1), 5), glowMat(colors[i % 3], 2.2));
    const a = (i / 5) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.04 * scale * (i ? 1 : 0), 0.1 * scale, Math.sin(a) * 0.04 * scale * (i ? 1 : 0));
    flames.push(f);
    g.add(f);
  }
  const light = new THREE.PointLight(0xff8a3a, 1.2 * scale, 4 * scale, 2);
  light.position.y = 0.2 * scale;
  g.add(light);
  return {
    g,
    set: (t, s) => {
      flames.forEach((f, i) => {
        const k = s * (0.85 + Math.sin(t * (9 + i * 2.3) + i) * 0.15);
        f.scale.set(Math.max(0.01, Math.min(1.4, s)), Math.max(0.01, k), Math.max(0.01, Math.min(1.4, s)));
        f.visible = s > 0.02;
      });
      light.intensity = 1.2 * scale * s * (0.9 + Math.sin(t * 17) * 0.1);
    },
  };
}

/** A shower of sparks for the anvil. */
function sparks(): { g: THREE.Group; burst: () => void; step: (dt: number) => void } {
  const g = new THREE.Group();
  const list: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  const m = glowMat(0xffc04a, 3);
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), m);
    s.visible = false;
    g.add(s);
    list.push({ m: s, v: new THREE.Vector3(), life: 0 });
  }
  return {
    g,
    burst: () =>
      list.forEach((p) => {
        p.m.position.set(0, 0, 0);
        p.v.set((Math.random() - 0.5) * 2.2, 1 + Math.random() * 1.6, (Math.random() - 0.5) * 2.2);
        p.life = 0.4 + Math.random() * 0.4;
        p.m.visible = true;
      }),
    step: (dt) =>
      list.forEach((p) => {
        if (p.life <= 0) return;
        p.life -= dt;
        p.v.y -= 6 * dt;
        p.m.position.addScaledVector(p.v, dt);
        p.m.visible = p.life > 0;
      }),
  };
}

function chest(rng: Rng): ItemShape {
  const object = new THREE.Group();
  const W = 0.9, D = 0.55, H = 0.45;
  const wood = mat(PLANK), dark = mat(PLANK_DARK);
  // Planked body.
  for (let i = 0; i < 3; i++) object.add(box(W, H / 3 - 0.008, D, i % 2 ? wood : mat(0xa8744a), 0, H / 6 + (i * H) / 3, 0));
  // Inside (dark) so the open chest looks hollow, and some treasure.
  object.add(box(W - 0.06, 0.01, D - 0.06, dark, 0, H - 0.02, 0));
  for (let i = 0; i < 9; i++) object.add(ball(0.03, metalMat("gold"), 0, between(rng, -0.3, 0.3), H - 0.01, between(rng, -0.15, 0.15)));
  // Iron bands and corners.
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) object.add(box(0.05, H + 0.01, D + 0.012, IRON(), x, H / 2, 0));
  // The lid: a half-round top that hinges at the back.
  const hinge = new THREE.Group();
  hinge.position.set(0, H, -D / 2);
  const lidGeo = new THREE.CylinderGeometry(D / 2, D / 2, W, 8, 1, false, 0, Math.PI);
  lidGeo.rotateZ(Math.PI / 2); // lie along X, with the round side up
  const lid = mesh(lidGeo, wood);
  lid.position.set(0, 0, D / 2);
  hinge.add(lid);
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) {
    const band = mesh(new THREE.TorusGeometry(D / 2 + 0.006, 0.02, 3, 10, Math.PI), IRON());
    band.rotation.y = Math.PI / 2;
    band.position.set(x, 0, D / 2);
    hinge.add(band);
  }
  // The lock plate on the front.
  const lock = box(0.1, 0.12, 0.03, metalMat("bronze"), 0, -0.02, D + 0.005);
  hinge.add(lock);
  object.add(hinge);
  let open = false, anim: ReturnType<typeof tween> | null = null, a = 0;
  return {
    object,
    actLabel: "Open",
    act() {
      open = !open;
      const from = a, to = open ? -1.9 : 0;
      anim = tween(0.6, (f) => (a = from + (to - from) * ease.inOut(f)));
      this.actLabel = open ? "Close" : "Open";
    },
    tick: (dt) => {
      if (anim && !anim.step(dt)) anim = null;
      hinge.rotation.x = a;
    },
  };
}

function anvil(): ItemShape {
  const object = new THREE.Group();
  // A tree-stump base, then the iron anvil with a horn.
  const stump = rod(0.24, 0.27, 0.45, mat(0x6e4a2a), 8, 0);
  object.add(stump);
  const ring = mesh(new THREE.CircleGeometry(0.235, 8), mat(0xc89a62));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.451;
  object.add(ring);
  const iron = metalMat("iron");
  object.add(box(0.26, 0.06, 0.2, iron, 0, 0.48, 0)); // foot
  object.add(box(0.14, 0.14, 0.12, iron, 0, 0.58, 0)); // waist
  object.add(box(0.46, 0.08, 0.17, metalMat("steel"), -0.02, 0.69, 0)); // face
  const horn = mesh(new THREE.ConeGeometry(0.06, 0.26, 6), iron);
  horn.rotation.z = Math.PI / 2;
  horn.position.set(0.33, 0.69, 0);
  horn.scale.z = 0.8;
  object.add(horn);
  // A hammer resting on the stump and a glowing bar on the face.
  const bar = makeBar("iron");
  bar.position.set(-0.05, 0.73, 0);
  const barGlow = glowMat(0xff7a2a, 1.6);
  bar.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material = barGlow) : null));
  object.add(bar);
  const sp = sparks();
  sp.g.position.set(-0.05, 0.76, 0);
  object.add(sp.g);
  return { object, actLabel: "Strike", act: sp.burst, tick: (dt) => sp.step(dt) };
}

function furnace(rng: Rng): ItemShape {
  const object = new THREE.Group();
  // A stone dome with a glowing mouth and a chimney.
  const stone = mat(0x8a847a, { roughness: 1 });
  const body = mesh(rough(new THREE.CylinderGeometry(0.55, 0.65, 1.0, 9, 3), rng, 0.05), stone);
  body.position.y = 0.5;
  object.add(body);
  const dome = mesh(rough(new THREE.SphereGeometry(0.56, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), rng, 0.05), stone);
  dome.position.y = 0.98;
  object.add(dome);
  const chimney = mesh(rough(new THREE.CylinderGeometry(0.15, 0.18, 0.7, 6, 2), rng, 0.03), mat(0x6e6a64));
  chimney.position.set(0, 1.75, -0.05);
  object.add(chimney);
  // The mouth: a dark arch with the fire inside.
  const mouth = slab([[-0.22, 0], [0.22, 0], [0.22, 0.25], [0.12, 0.36], [0, 0.39], [-0.12, 0.36], [-0.22, 0.25]], 0.2, mat(0x1a1410));
  mouth.position.set(0, 0.2, 0.52);
  object.add(mouth);
  const coals = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const c = lump(rng, 0.05, glowMat(i % 2 ? 0xff5a1a : 0xff8a2a, 1.4), 0.4);
    c.position.set(between(rng, -0.15, 0.15), 0.24, 0.58 + between(rng, -0.03, 0.05));
    coals.add(c);
  }
  object.add(coals);
  const f = fire(1.3);
  f.g.position.set(0, 0.24, 0.6);
  object.add(f.g);
  // A stone ledge with a bar cooling on it.
  object.add(box(0.5, 0.08, 0.2, stone, 0, 0.16, 0.7));
  const bar = makeBar("bronze");
  bar.position.set(0.12, 0.2, 0.7);
  object.add(bar);
  // Smoke puffs from the chimney.
  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.5, flatShading: true, depthWrite: false }));
    p.position.set(0, 2.1, -0.05);
    puffs.push(p);
    object.add(p);
  }
  let roar = 0;
  return {
    object,
    actLabel: "Stoke",
    act: () => (roar = 2.5),
    tick: (dt, t) => {
      roar = Math.max(0, roar - dt);
      const s = 1 + Math.min(1, roar) * 0.8;
      f.set(t, s);
      puffs.forEach((p, i) => {
        const ph = (t * (0.25 + roar * 0.1) + i / puffs.length) % 1;
        p.position.set(Math.sin(ph * 3 + i) * 0.1, 2.1 + ph * 1.2, -0.05);
        p.scale.setScalar(0.5 + ph * 1.4);
        (p.material as THREE.MeshStandardMaterial).opacity = 0.45 * (1 - ph);
      });
    },
  };
}

function legsTable(w: number, d: number, h: number, top: THREE.Material, leg: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.06, d, top, 0, h - 0.03, 0));
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) g.add(box(0.07, h - 0.06, 0.07, leg, x, (h - 0.06) / 2, z));
  g.add(box(w - 0.12, 0.05, 0.04, leg, 0, 0.18, -d / 2 + 0.06));
  return g;
}

function workbench(rng: Rng): ItemShape {
  const object = legsTable(1.4, 0.6, 0.85, mat(0xb8885a), mat(PLANK_DARK));
  // A vice, a saw, shavings and a half-carved bow.
  object.add(box(0.12, 0.12, 0.14, IRON(), 0.62, 0.9, 0.2));
  const saw = slab([[0, 0], [0.4, 0.02], [0.4, 0.1], [0, 0.06]], 0.006, metalMat("steel"));
  saw.rotation.x = -Math.PI / 2;
  saw.position.set(-0.55, 0.865, 0.15);
  object.add(saw, box(0.1, 0.03, 0.06, mat(PLANK_DARK), -0.6, 0.87, 0.12));
  for (let i = 0; i < 10; i++) {
    const s = mesh(new THREE.TorusGeometry(0.02, 0.004, 3, 6, Math.PI * 1.5), mat(0xe6c58f));
    s.position.set(between(rng, -0.3, 0.3), 0.865, between(rng, -0.2, 0.2));
    s.rotation.set(between(rng, 0, 3), between(rng, 0, 3), 0);
    object.add(s);
  }
  const bow = mesh(new THREE.TorusGeometry(0.5, 0.012, 4, 16, 1.6), mat(0xc0704a));
  bow.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - 0.8);
  bow.position.set(-0.05, 0.875, 0.3);
  object.add(bow);
  return { object };
}

function spinningWheel(): ItemShape {
  const object = new THREE.Group();
  const wood = mat(0xa8744a), dark = mat(PLANK_DARK);
  // A slanted bench with three legs, the big wheel, and the spindle.
  const bench = box(0.9, 0.06, 0.22, wood, 0, 0.42, 0);
  bench.rotation.z = 0.12;
  object.add(bench);
  for (const [x, z] of [[-0.38, -0.08], [-0.38, 0.08], [0.38, 0]] as [number, number][]) object.add(box(0.05, 0.42, 0.05, dark, x, 0.21, z));
  for (const z of [-0.08, 0.08]) object.add(box(0.05, 0.55, 0.04, dark, -0.15, 0.7, z));
  const wheel = new THREE.Group();
  wheel.position.set(-0.15, 0.95, 0);
  const rim = mesh(new THREE.TorusGeometry(0.38, 0.025, 4, 18), wood);
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const s = rod(0.012, 0.012, 0.38, dark, 4, 0);
    s.rotation.z = (i / 8) * Math.PI * 2;
    wheel.add(s);
  }
  wheel.add(rod(0.05, 0.05, 0.1, dark, 8, -0.05).rotateX(Math.PI / 2));
  object.add(wheel);
  // The spindle with a cone of thread, and the drive band.
  object.add(box(0.05, 0.25, 0.04, dark, 0.32, 0.6, 0));
  const spool = rod(0.05, 0.02, 0.14, mat(0xf2eee6), 8, 0);
  spool.rotation.z = Math.PI / 2;
  spool.position.set(0.28, 0.73, 0);
  object.add(spool);
  let spin = 0;
  return { object, actLabel: "Spin", act: () => (spin = 3), tick: (dt) => {
    spin = Math.max(0, spin - dt);
    const speed = spin > 0 ? 6 * Math.min(1, spin) : 0.2;
    wheel.rotation.z -= speed * dt;
    spool.rotation.x += speed * 4 * dt;
  } };
}

function tanningRack(rng: Rng): ItemShape {
  const object = new THREE.Group();
  const pole = mat(0x7a5434);
  // An A-frame of poles with a hide laced in the middle.
  for (const x of [-0.7, 0.7]) {
    for (const s of [1, -1]) {
      const p = rod(0.035, 0.03, 1.7, pole, 5, 0);
      p.position.set(x, 0, s * 0.25);
      p.rotation.x = -s * 0.15;
      object.add(p);
    }
  }
  const top = rod(0.035, 0.035, 1.5, pole, 5, -0.75);
  top.rotation.z = Math.PI / 2;
  top.position.y = 1.6;
  object.add(top);
  const bottom = rod(0.03, 0.03, 1.4, pole, 5, -0.7);
  bottom.rotation.z = Math.PI / 2;
  bottom.position.y = 0.35;
  object.add(bottom);
  const pts: [number, number][] = [[-0.45, -0.5], [-0.55, -0.3], [-0.45, 0], [-0.55, 0.35], [-0.35, 0.5], [0.35, 0.5], [0.55, 0.35], [0.45, 0], [0.55, -0.3], [0.45, -0.5], [0, -0.45]];
  const hide = mesh(rough(new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.02, bevelEnabled: false }), rng, 0.02), mat(0xb88a5a, { roughness: 1 }));
  hide.position.set(0, 0.97, -0.01);
  object.add(hide);
  // Lacing: little cords from the hide to the frame.
  for (let i = 0; i < 6; i++) {
    const y = 0.55 + i * 0.16;
    for (const s of [1, -1]) {
      const c = rod(0.004, 0.004, 0.18, mat(0xd8c49a), 3, 0);
      c.rotation.z = (s * Math.PI) / 2;
      c.position.set(s * 0.5, y, 0);
      object.add(c);
    }
  }
  return { object };
}

function stove(rng: Rng): ItemShape {
  const object = new THREE.Group();
  // A brick cooking range with a fire box and an iron top with a pot.
  const brick = mat(0xa8583a, { roughness: 1 });
  object.add(box(1.0, 0.8, 0.6, brick, 0, 0.4, 0));
  for (let row = 0; row < 5; row++) object.add(box(1.01, 0.012, 0.61, mat(0xd8c8b0), 0, 0.16 * row + 0.08, 0));
  object.add(box(1.06, 0.05, 0.66, IRON(), 0, 0.825, 0));
  const mouth = box(0.4, 0.3, 0.02, mat(0x1a1410), 0, 0.3, 0.3);
  object.add(mouth);
  const f = fire(0.9);
  f.g.position.set(0, 0.17, 0.25);
  object.add(f.g);
  for (let i = 0; i < 3; i++) {
    const log = rod(0.04, 0.04, 0.35, mat(0x7a5434), 6, -0.175);
    log.rotation.set(0, between(rng, -0.4, 0.4), Math.PI / 2);
    log.position.set(0, 0.19, 0.22);
    object.add(log);
  }
  // A pot on top with steam.
  const pot = rod(0.16, 0.14, 0.2, IRON(), 10, 0.85);
  pot.position.x = -0.2;
  object.add(pot);
  const steam: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, flatShading: true, depthWrite: false }));
    steam.push(p);
    object.add(p);
  }
  let heat = 0;
  return {
    object,
    actLabel: "Cook",
    act: () => (heat = 2.5),
    tick: (dt, t) => {
      heat = Math.max(0, heat - dt);
      f.set(t, 1 + Math.min(1, heat) * 0.6);
      steam.forEach((p, i) => {
        const ph = (t * (0.4 + heat * 0.2) + i / steam.length) % 1;
        p.position.set(-0.2 + Math.sin(ph * 4 + i) * 0.05, 1.08 + ph * 0.6, 0);
        p.scale.setScalar(0.5 + ph);
        (p.material as THREE.MeshStandardMaterial).opacity = 0.45 * (1 - ph);
      });
    },
  };
}

function alchemyTable(rng: Rng): ItemShape {
  const object = legsTable(1.2, 0.6, 0.85, mat(0x5a4a3a), mat(0x3a2a20));
  // Bottles, a mortar and pestle, and a flask bubbling over a small flame.
  const colors = [0xe0303a, 0x3a78f0, 0x4ac850, 0xf0e040];
  colors.forEach((c, i) => {
    const b = makeBottle(i % 2 ? "vial" : "round", c, rng).g;
    b.position.set(-0.48 + i * 0.1, 0.85, -0.18 + (i % 2) * 0.06);
    b.scale.setScalar(1.3);
    object.add(b);
  });
  const mortar = mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.07, 8, 1, true), mat(0xb8b0a0));
  mortar.position.set(0.05, 0.885, 0.12);
  object.add(mortar);
  const pestle = rod(0.012, 0.018, 0.14, mat(0xb8b0a0), 6, 0);
  pestle.position.set(0.07, 0.87, 0.12);
  pestle.rotation.z = -0.5;
  object.add(pestle);
  // The stand: a ring on three legs, the flask, and a tiny flame.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = rod(0.006, 0.006, 0.16, IRON(), 4, 0);
    leg.position.set(0.4 + Math.cos(a) * 0.07, 0.85, Math.sin(a) * 0.07);
    object.add(leg);
  }
  const big = makeBottle("tall", 0x6ae0b8, rng);
  big.g.scale.setScalar(1.8);
  big.g.position.set(0.4, 1.0, 0);
  object.add(big.g);
  const flame = ball(0.02, glowMat(0x5aa0ff, 2.5), 0, 0.4, 0.9, 0);
  flame.scale.y = 1.8;
  object.add(flame);
  let boil = 0;
  return {
    object,
    actLabel: "Brew",
    act: () => (boil = 2.5),
    tick: (dt, t) => {
      boil = Math.max(0, boil - dt);
      const k = boil > 0 ? 3 : 0.6;
      big.bubbles.forEach((b, i) => {
        const ph = (t * k * 0.6 + i * 0.27) % 1;
        b.position.y = 0.01 + ph * 0.04;
      });
      flame.scale.set(1 + boil * 0.3, 1.8 + boil * 0.6 + Math.sin(t * 20) * 0.2, 1 + boil * 0.3);
    },
  };
}

function altar(rng: Rng): ItemShape {
  const object = new THREE.Group();
  // A pale stone altar with a floating crystal and rune stones circling it.
  const stone = mat(0xd8d4cc, { roughness: 0.9 });
  object.add(box(0.9, 0.12, 0.6, stone, 0, 0.06, 0));
  object.add(box(0.7, 0.7, 0.45, stone, 0, 0.47, 0));
  object.add(box(0.95, 0.1, 0.65, stone, 0, 0.87, 0));
  const runeMat = glowMat(0x9a7aff, 1.4).clone();
  runeMat.userData.own = true;
  const front = slab([[0, -0.12], [0.08, 0], [0, 0.12], [-0.08, 0]], 0.01, runeMat);
  front.position.set(0, 0.47, 0.23);
  object.add(front);
  const crystal = mesh(rough(new THREE.OctahedronGeometry(0.13, 0), rng, 0.02), glowMat(0xb89aff, 0.9));
  crystal.scale.y = 1.6;
  crystal.position.y = 1.3;
  object.add(crystal);
  const orbit = new THREE.Group();
  orbit.position.y = 1.15;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const r = box(0.07, 0.1, 0.03, runeMat, Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
    r.rotation.y = -a;
    orbit.add(r);
  }
  object.add(orbit);
  const light = new THREE.PointLight(0xa080ff, 0.8, 4, 2);
  light.position.y = 1.3;
  object.add(light);
  let charge = 0;
  return {
    object,
    actLabel: "Enchant",
    act: () => (charge = 2.5),
    tick: (dt, t) => {
      charge = Math.max(0, charge - dt);
      crystal.position.y = 1.3 + Math.sin(t * 1.5) * 0.05;
      crystal.rotation.y += dt * (0.5 + charge * 2);
      orbit.rotation.y -= dt * (0.4 + charge * 3);
      runeMat.emissiveIntensity = 1.2 + Math.sin(t * 2) * 0.3 + charge * 1.2;
      light.intensity = 0.8 + charge * 1.2;
    },
  };
}

function guildBoard(rng: Rng): ItemShape {
  const object = new THREE.Group();
  const post = mat(0x6e4a2a);
  for (const x of [-0.65, 0.65]) object.add(box(0.1, 1.9, 0.1, post, x, 0.95, 0));
  object.add(box(1.3, 0.9, 0.06, mat(0xa8744a), 0, 1.25, 0));
  // A little roof.
  const roof = box(1.55, 0.06, 0.35, mat(0x7a3a2a), 0, 1.82, 0.05);
  roof.rotation.x = 0.25;
  object.add(roof);
  // Pinned notices.
  for (let i = 0; i < 6; i++) {
    const w = between(rng, 0.18, 0.26), h = between(rng, 0.2, 0.3);
    const p = box(w, h, 0.006, mat(i === 2 ? 0xf0d8a0 : PAPER2), -0.42 + (i % 3) * 0.42 + between(rng, -0.04, 0.04), 1.45 - Math.floor(i / 3) * 0.38, 0.035);
    p.rotation.z = between(rng, -0.12, 0.12);
    object.add(p);
    object.add(ball(0.012, mat(0xc03030), 0, p.position.x, p.position.y + h / 2 - 0.03, 0.04));
  }
  return { object };
}
const PAPER2 = 0xf2e6c8;

/** Build a prop. Ones with nothing to do get "Turn around", so you can see the back. */
export function buildProp(kind: PropKind, rng: Rng): ItemShape {
  const shape = propShape(kind, rng);
  if (shape.act) return shape;
  let anim: ReturnType<typeof tween> | null = null;
  const o = shape.object;
  return {
    ...shape,
    actLabel: "Turn around",
    act: () => (anim = tween(2.2, (f) => (o.rotation.y = ease.inOut(f) * Math.PI * 2))),
    tick: (dt, t) => {
      shape.tick?.(dt, t);
      if (anim && !anim.step(dt)) anim = null;
    },
  };
}

function propShape(kind: PropKind, rng: Rng): ItemShape {
  switch (kind) {
    case "chest": return chest(rng);
    case "anvil": return anvil();
    case "furnace": return furnace(rng);
    case "workbench": return workbench(rng);
    case "spinning_wheel": return spinningWheel();
    case "tanning_rack": return tanningRack(rng);
    case "stove": return stove(rng);
    case "alchemy_table": return alchemyTable(rng);
    case "altar": return altar(rng);
    case "guild_board": return guildBoard(rng);
  }
}
