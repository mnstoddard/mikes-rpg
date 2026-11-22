// Fishing spots: a patch of water you click to fish (shared/foraging.ts).
// Real size, in metres. Each spot has rings of ripples tinted with its
// colour from the game, bubbles, and now and then its fish jumps out.
// Shallow water (Minnows) has a little school darting about instead.
import * as THREE from "three";
import type { FishId } from "../../../shared/cooking";
import { RESOURCES } from "../../../shared/foraging";
import { Rng, Showpiece, mat, mesh, lump, between, mix, leafGeo, disposeAll } from "./common";
import { createFish } from "./fish";
import { slab } from "./ingredients";

export const SPOT_VARIANTS = ["Calm", "Busy"] as const;

interface SpotLook {
  water: number;
  opacity: number;
  bed: number;
  reeds?: boolean;
  lilies?: boolean;
  rocks?: boolean;
  foam?: boolean;
  glow?: boolean;
}

const LOOKS: Record<FishId, SpotLook> = {
  minnow: { water: 0x7cccd0, opacity: 0.38, bed: 0xd6c496, reeds: true },
  trout: { water: 0x4ea4b6, opacity: 0.78, bed: 0x8a7a5a, reeds: true },
  perch: { water: 0x4a9c9c, opacity: 0.8, bed: 0x7a6e50, lilies: true },
  salmon: { water: 0x3f8db0, opacity: 0.84, bed: 0x6e6a60, rocks: true, foam: true },
  pike: { water: 0x3d7a68, opacity: 0.88, bed: 0x4e5a3e, reeds: true, lilies: true },
  tuna: { water: 0x245a96, opacity: 0.92, bed: 0x1e3550, foam: true },
  swordfish: { water: 0x1c4682, opacity: 0.94, bed: 0x152840, foam: true, rocks: true },
  eel: { water: 0x2a2442, opacity: 0.94, bed: 0x161222, glow: true },
};

const R = 1.6; // pond radius
const WATER_Y = 0.05;

export function createSpot(kind: FishId, rng: Rng, variant: number): Showpiece {
  const look = LOOKS[kind];
  const tint = RESOURCES[kind].color;
  const busy = variant === 1;
  const object = new THREE.Group();
  object.name = `spot-${kind}`;

  // Sandy shore with stones round the edge.
  const shore = mesh(new THREE.RingGeometry(R - 0.05, R + 0.45, 24, 1).rotateX(-Math.PI / 2), mat(0xcdb98a, { roughness: 1 }), false);
  shore.position.y = 0.012;
  object.add(shore);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.3;
    const s = lump(rng, between(rng, 0.08, 0.2), between(rng, 0.06, 0.12), between(rng, 0.08, 0.18), rng() < 0.5 ? 0x9a978c : 0x84827a, { detail: 0, lumpy: 0.3 });
    s.position.set(Math.cos(a) * (R + 0.2 + rng() * 0.2), 0.03, Math.sin(a) * (R + 0.2 + rng() * 0.2));
    s.rotation.y = rng() * 6;
    object.add(s);
  }
  const bed = mesh(new THREE.CircleGeometry(R, 24).rotateX(-Math.PI / 2), mat(look.bed, { roughness: 1 }), false);
  bed.position.y = 0.016;
  object.add(bed);
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * (R - 0.2);
    const p = lump(rng, 0.05, 0.02, 0.04, mix(look.bed, 0x888888, 0.4), { detail: 0 });
    p.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    object.add(p);
  }

  // The water: a grid of triangles that rise and fall in small waves.
  const waterGeo = new THREE.RingGeometry(0.001, R + 0.02, 28, 6).rotateX(-Math.PI / 2).toNonIndexed();
  const wpos = waterGeo.attributes.position as THREE.BufferAttribute;
  const wbase = Float32Array.from(wpos.array as Float32Array);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({ color: look.water, transparent: true, opacity: look.opacity, roughness: 0.12, metalness: 0.1, flatShading: true, depthWrite: false, emissive: look.glow ? 0x2a1050 : 0, emissiveIntensity: look.glow ? 0.6 : 0 }),
  );
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  object.add(water);

  // Reeds, lily pads, rocks and foam.
  const sway: { o: THREE.Object3D; p: number }[] = [];
  if (look.reeds) {
    for (let i = 0; i < 22; i++) {
      const a = between(rng, 0.4, 2.6) + (i % 2) * Math.PI;
      const r = R - 0.1 + rng() * 0.25;
      const reed = new THREE.Group();
      const h = between(rng, 0.5, 1.0);
      const stem = mesh(new THREE.ConeGeometry(0.018, h, 4), mat(i % 3 ? 0x6f9a3e : 0x5a8432));
      stem.position.y = h / 2;
      reed.add(stem);
      if (i % 3 === 0) {
        const head = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6), mat(0x6a4426));
        head.position.y = h * 0.8;
        reed.add(head);
      }
      reed.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      object.add(reed);
      sway.push({ o: reed, p: rng() * 6 });
    }
  }
  if (look.lilies) {
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2, r = between(rng, 0.7, R - 0.25);
      const pad = slab(rng, between(rng, 0.13, 0.2), between(rng, 0.13, 0.2), 0.012, i % 2 ? 0x4f8a34 : 0x5f9a3a, 0.05, 12);
      pad.position.set(Math.cos(a) * r, WATER_Y, Math.sin(a) * r);
      object.add(pad);
      if (i === 2) {
        const f = new THREE.Group();
        for (let k = 0; k < 7; k++) {
          const pt = mesh(leafGeo(0.07, 0.025), mat(0xf4d6e4, { double: true }));
          pt.rotation.set(0, (k / 7) * Math.PI * 2, 0.6);
          f.add(pt);
        }
        f.position.copy(pad.position).add(new THREE.Vector3(0, 0.015, 0));
        object.add(f);
      }
    }
  }
  if (look.rocks) {
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2, r = between(rng, 0.7, 1.2);
      const s = lump(rng, between(rng, 0.15, 0.25), 0.14, between(rng, 0.15, 0.22), 0x7a7870, { detail: 0, lumpy: 0.3 });
      s.position.set(Math.cos(a) * r, WATER_Y, Math.sin(a) * r);
      object.add(s);
    }
  }

  // Ripples: rings that spread out from the middle and fade, tinted with the spot's colour.
  const rippleColor = mix(0xffffff, tint, kind === "minnow" ? 0 : 0.45);
  const ripples: { m: THREE.Mesh; p: number }[] = [];
  const nRipples = busy ? 4 : 3;
  for (let i = 0; i < nRipples; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: rippleColor, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    m.position.y = WATER_Y + 0.012 + i * 0.001;
    object.add(m);
    ripples.push({ m, p: i / nRipples });
  }
  // Bubbles rising in the middle.
  const bubbles: { m: THREE.Mesh; p: number; x: number; z: number }[] = [];
  const bubbleMat = new THREE.MeshStandardMaterial({ color: look.glow ? 0xd0a8ff : 0xffffff, transparent: true, opacity: 0.8, roughness: 0.1, emissive: look.glow ? 0x7a3ad0 : 0, emissiveIntensity: look.glow ? 0.8 : 0 });
  for (let i = 0; i < (busy ? 10 : 6); i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0), bubbleMat);
    object.add(m);
    bubbles.push({ m, p: rng(), x: (rng() - 0.5) * 0.4, z: (rng() - 0.5) * 0.4 });
  }
  // Foam flecks on rough water.
  const foam: { m: THREE.Mesh; a: number; r: number; p: number }[] = [];
  if (look.foam) {
    for (let i = 0; i < 18; i++) {
      const m = mesh(new THREE.CircleGeometry(between(rng, 0.03, 0.07), 5).rotateX(-Math.PI / 2), mat(0xf2f6f8, { roughness: 0.5 }), false);
      object.add(m);
      foam.push({ m, a: rng() * Math.PI * 2, r: between(rng, 0.3, R - 0.15), p: rng() * 6 });
    }
  }

  // The fish: a jumper for deep spots, a little school for shallow water.
  const jumper = kind === "minnow" ? null : createFish(kind, { seed: Math.floor(rng() * 9999), state: "swim" });
  const school: { f: ReturnType<typeof createFish>; r: number; p: number; s: number }[] = [];
  if (jumper) {
    const fit = Math.min(1, 0.95 / jumper.length); // big fish are shown smaller so they fit the pond
    jumper.object.scale.setScalar(fit);
    jumper.object.visible = false;
    object.add(jumper.object);
  } else {
    for (let i = 0; i < (busy ? 7 : 4); i++) {
      const f = createFish("minnow", { seed: 50 + i, state: "swim" });
      f.object.scale.setScalar(3.2);
      object.add(f.object);
      school.push({ f, r: between(rng, 0.3, 1.0), p: rng() * 6, s: between(rng, 0.5, 0.9) * (i % 2 ? 1 : -1) });
    }
  }
  let jumpT = -1;
  let nextJump = busy ? 1 : 2.5;
  let jumpDir = 0;
  const drops: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  const dropMat = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.85, roughness: 0.1 });

  function splash(at: THREE.Vector3, n = 12) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.03, 0), dropMat);
      m.position.copy(at);
      object.add(m);
      const a = rng() * Math.PI * 2;
      const sp = between(rng, 0.4, 1.1);
      drops.push({ m, v: new THREE.Vector3(Math.cos(a) * sp, between(rng, 1.4, 2.6), Math.sin(a) * sp), life: 1 });
    }
  }
  let dartT = 0;

  return {
    object,
    stage: "pond",
    update(dt, time) {
      // Waves.
      const arr = wpos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = wbase[i], z = wbase[i + 2];
        const edge = Math.min(1, (R - Math.hypot(x, z)) / 0.3);
        arr[i + 1] = edge * (Math.sin(x * 3 + time * 1.6) * 0.012 + Math.cos(z * 2.6 + time * 1.3) * 0.01 + (look.foam ? Math.sin((x + z) * 5 + time * 3) * 0.008 : 0));
      }
      wpos.needsUpdate = true;
      // Ripples.
      const speed = busy ? 0.45 : 0.3;
      for (const r of ripples) {
        const t = (time * speed + r.p) % 1;
        r.m.scale.setScalar(0.12 + t * 0.85);
        (r.m.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - t);
      }
      for (const b of bubbles) {
        const t = (time * 0.5 + b.p) % 1;
        b.m.position.set(b.x + Math.sin(time * 3 + b.p * 9) * 0.02, WATER_Y - 0.05 + t * 0.09, b.z);
        b.m.scale.setScalar(t < 0.85 ? 0.6 + t : Math.max(0.01, (1 - t) * 8));
      }
      for (const f of foam) {
        const a = f.a + time * 0.05;
        f.m.position.set(Math.cos(a) * f.r, WATER_Y + 0.02 + Math.sin(time * 2 + f.p) * 0.006, Math.sin(a) * f.r);
      }
      for (const s of sway) s.o.rotation.z = Math.sin(time * 1.2 + s.p) * 0.05;

      // Minnows swim round in circles, and dart when poked.
      dartT = Math.max(0, dartT - dt);
      for (const m of school) {
        const a = m.p + time * m.s * (1 + dartT * 2.5);
        m.f.object.position.set(Math.cos(a) * m.r, WATER_Y - 0.02, Math.sin(a) * m.r);
        m.f.object.rotation.y = -a - (m.s > 0 ? Math.PI / 2 : -Math.PI / 2);
        m.f.update(dt, time);
      }

      // A fish jumps out and dives back in.
      if (jumper) {
        nextJump -= dt;
        if (jumpT < 0 && nextJump <= 0) {
          jumpT = 0;
          jumpDir = rng() * Math.PI * 2;
          jumper.object.visible = true;
          splash(new THREE.Vector3(Math.cos(jumpDir) * -0.5, WATER_Y, Math.sin(jumpDir) * 0.5));
        }
        if (jumpT >= 0) {
          jumpT += dt / 1.1;
          const s = Math.min(1, jumpT);
          const d = 0.5;
          const x = (s * 2 - 1) * d;
          const y = WATER_Y - 0.15 + Math.sin(Math.PI * s) * 0.9;
          // Point along the arc: nose up going out, nose down coming in.
          const slope = Math.atan2(Math.cos(Math.PI * s) * Math.PI * 0.9, 2 * d);
          jumper.object.position.set(Math.cos(jumpDir) * x, y, -Math.sin(jumpDir) * x);
          jumper.object.rotation.set(0, jumpDir, slope);
          jumper.update(dt, time);
          if (s >= 1) {
            splash(new THREE.Vector3(Math.cos(jumpDir) * d, WATER_Y, -Math.sin(jumpDir) * d), 16);
            jumpT = -1;
            jumper.object.visible = false;
            nextJump = busy ? between(rng, 1.5, 3.5) : between(rng, 5, 9);
          }
        }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.life -= dt * 1.4;
        d.v.y -= 7 * dt;
        d.m.position.addScaledVector(d.v, dt);
        d.m.scale.setScalar(Math.max(0.01, d.life));
        if (d.life <= 0 || d.m.position.y < WATER_Y - 0.05) {
          object.remove(d.m);
          d.m.geometry.dispose();
          drops.splice(i, 1);
        }
      }
    },
    poke() {
      if (jumper) nextJump = 0;
      else dartT = 2;
    },
    dispose() {
      disposeAll(object);
    },
  };
}
