// The Deep One: a Blighted sea serpent that rises out of the harbour
// (Act 2C boss). A chain of joints makes its long neck; it sways, strikes,
// and sinks back under the water when defeated.
import * as THREE from "three";
import { BLIGHT_GLOW } from "./beasts";
import { Body, Kit, bump, ease, finish, makeRng, shade } from "./kit";

export function deepOne(variant: number, seed: number) {
  const k = new Kit();
  const abyss = variant === 1;
  const skin = abyss ? 0x2c4472 : 0x3a7a6a;
  const belly = abyss ? 0x9ab0d8 : 0xe0dcb0;
  const skinM = k.mat(skin, { roughness: 0.4 });
  const bellyM = k.mat(belly, { roughness: 0.5 });
  const finM = k.mat(abyss ? 0x5a8ad8 : 0x6ab89a, { roughness: 0.5, double: true, opacity: 0.9 });
  const glowM = k.mat(0xdffaf0, { glow: BLIGHT_GLOW, glowStrength: abyss ? 1.4 : 0.9, roughness: 0.3 });
  const rng = makeRng(seed);

  const scene = new THREE.Group();
  const root = k.joint(scene, 0, 0, 0, "root");
  // The water it rises from.
  const water = new THREE.Mesh(k.geo(new THREE.CircleGeometry(3.2, 48)), k.mat(0x3a8ab8, { roughness: 0.1, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.04;
  water.receiveShadow = true;
  water.userData.footprint = true;
  scene.add(water);
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(k.geo(new THREE.RingGeometry(0.9, 1.0, 40)), k.mat(0xdff4ff, { opacity: 0.5, double: true }));
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.05;
    scene.add(r);
    rings.push(r);
  }

  const rise = k.joint(root, 0, -0.4, -0.6, "rise");
  const N = 11, seg = 0.48;
  const chain: THREE.Group[] = [];
  let parent: THREE.Object3D = rise;
  for (let i = 0; i < N; i++) {
    const j = k.joint(parent, 0, i === 0 ? 0 : seg, 0);
    j.rotation.x = i < 4 ? 0.02 : 0.085;
    const t = i / N;
    const r = 0.62 - t * 0.28;
    k.ball(j, r, seg * 0.95, r * 0.95, skinM, 0, seg * 0.5, 0);
    k.ball(j, r * 0.7, seg * 0.7, r * 0.5, bellyM, 0, seg * 0.5, r * 0.55);
    // Fin ridge.
    const fin = k.horn(j, 0.32 - t * 0.1, 0.12, finM, -0.6, 0, seg * 0.5, -r * 0.85);
    fin.rotation.x = -1.3;
    if (rng() < 0.6) for (const s of [1, -1]) k.ball(j, 0.05, 0.08, 0.05, glowM, s * r * 0.93, seg * (0.3 + rng() * 0.4), (rng() - 0.3) * r * 0.5);
    chain.push(j);
    parent = j;
  }
  const head = k.joint(parent, 0, seg * 0.9, 0.05, "head");
  head.rotation.x = 0.9;
  k.ball(head, 0.42, 0.36, 0.52, skinM, 0, 0.1, 0.15);
  k.ball(head, 0.3, 0.2, 0.36, skinM, 0, 0.0, 0.55);
  const jaw = k.joint(head, 0, -0.12, 0.2, "jaw");
  k.ball(jaw, 0.28, 0.12, 0.42, bellyM, 0, -0.04, 0.3);
  k.ball(head, 0.24, 0.1, 0.34, k.mat(0x6a2a3a), 0, -0.12, 0.42);
  const fang = k.mat(0xfbf6e6, { roughness: 0.3 });
  for (const s of [1, -1]) for (const z of [0.62, 0.42]) {
    const f = k.horn(head, 0.1, 0.025, fang, 0, s * 0.16, -0.1, z);
    f.rotation.x = Math.PI;
  }
  k.eyes(head, [0.42, 0.36, 0.52], [0, 0.1, 0.15], { size: 0.11, iris: BLIGHT_GLOW, lid: skin, white: false, glow: true, spread: 0.65, up: 0.35, cross: true, pupil: 0.42 });
  // Fan fins like ears.
  const fins: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const f = k.joint(head, s * 0.38, 0.15, -0.1);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    for (let i = 0; i <= 4; i++) {
      const a = -0.3 + (i / 4) * 1.3;
      sh.lineTo(Math.cos(a) * 0.55, Math.sin(a) * 0.55);
      if (i < 4) sh.quadraticCurveTo(Math.cos(a + 0.16) * 0.38, Math.sin(a + 0.16) * 0.38, Math.cos(a + 0.33) * 0.55, Math.sin(a + 0.33) * 0.55);
    }
    sh.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(sh, 8);
    g.rotateY(-Math.PI / 2);
    g.scale(1, 1, 1);
    const m = k.mesh(f, g, finM);
    m.rotation.y = s === 1 ? 0 : Math.PI;
    f.rotation.set(0.2, s * 0.5, 0);
    fins.push(f);
  }
  // Humps of its body further back in the water.
  const humps: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.TorusGeometry(0.55, 0.42 - i * 0.08, 14, 24, Math.PI);
    const h = k.mesh(root, g, skinM, (i ? -1 : 1) * 0.9, 0, -1.6 - i * 0.9);
    h.rotation.y = Math.PI / 2;
    humps.push(h);
  }

  const b: Body = {
    durations: { attack: 1.1, hit: 0.6, death: 1.8 },
    follow: 10,
    pose(c) {
      const R = c.rig, time = c.time;
      const swim = c.anim === "walk" ? 2.2 : 1;
      chain.forEach((j, i) => {
        R.r(j, 0.03 * Math.sin(time * 1.1 - i * 0.35), 0, 0.05 * swim * Math.sin(time * 1.2 * swim - i * 0.45));
      });
      R.r(head, 0.06 * Math.sin(time * 0.9), 0.2 * Math.sin(time * 0.5), 0);
      fins.forEach((f, i) => R.r(f, 0, (i ? -1 : 1) * 0.15 * Math.sin(time * 3), 0));
      if (c.anim === "attack") {
        const back = ease(c.p, 0, 0.35) * (1 - ease(c.p, 0.35, 0.5));
        const strike = ease(c.p, 0.35, 0.5) * (1 - ease(c.p, 0.65, 1));
        chain.forEach((j, i) => R.r(j, (i > 3 ? 1 : 0.3) * (-0.09 * back + 0.13 * strike), 0, 0));
        R.r(head, 0.4 * strike - 0.2 * back, 0, 0);
        R.r(jaw, 0.8 * bump(c.p, 0.25, 0.45, 0.62), 0, 0);
        fins.forEach((f, i) => R.r(f, 0, (i ? -1 : 1) * 0.5 * back, 0));
      }
      if (c.anim === "hit") {
        const h = c.p < 0.15 ? ease(c.p, 0, 0.15) : 1 - ease(c.p, 0.15, 1);
        chain.forEach((j, i) => R.r(j, i > 4 ? -0.07 * h : 0, 0, 0.04 * h));
        R.r(head, -0.5 * h, 0.3 * h, 0);
        R.r(jaw, 0.4 * h, 0, 0);
      }
      if (c.anim === "death") {
        const f = ease(c.p, 0.1, 1);
        chain.forEach((j, i) => R.r(j, (i > 2 ? 0.1 : 0) * ease(c.p, 0, 0.4), 0, 0.05 * Math.sin(c.t * 8 - i) * (1 - f)));
        R.p(rise, 0, -6 * f, 0.5 * f);
        R.r(jaw, 0.4 * ease(c.p, 0, 0.3), 0, 0);
      }
    },
    fx(c) {
      rings.forEach((r, i) => {
        const t = (c.time * 0.35 + i / 3) % 1;
        r.scale.setScalar(0.6 + t * 2.2);
        (r.material as THREE.MeshStandardMaterial).opacity = 0.5 * (1 - t);
      });
      humps.forEach((h, i) => (h.position.y = -0.12 + 0.12 * Math.sin(c.time * (c.anim === "walk" ? 2.4 : 1.2) - i * 1.5)));
      glowM.emissiveIntensity = (abyss ? 1.4 : 0.9) + 0.4 * Math.sin(c.time * 2.4);
    },
  };
  void shade;
  return finish(k, scene, b, 5.6);
}
