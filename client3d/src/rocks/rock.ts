// Builds a mining rock: a lumpy low-poly boulder with ore stuck in it
// (nuggets, coal chunks or crystals). It can be hit, gets emptied, and refills.
//
// Each ore's look is a small "OreLook" recipe in index.ts; this file does the work.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Rng, between, mat, motes } from "../trees/common";

export type RockState = "full" | "emptying" | "empty" | "refilling";

/** How an ore looks. */
export interface OreLook {
  /** Colour of the plain rock around the ore. */
  host: number;
  /** What sticks out of the rock. "none" is plain stone. */
  deposit: "nugget" | "chunk" | "crystal" | "none";
  /** Ore colours (picked at random per piece). */
  colors: number[];
  metalness?: number;
  roughness?: number;
  /** Glow colour and strength (shows up best at night). */
  glow?: number;
  glowStrength?: number;
  /** How many pieces of ore on the rock (before size variants). */
  count?: number;
  /** Size of each piece. */
  size?: number;
  /** Little twinkling glints on shiny ores. */
  glints?: number;
  /** Floating lights (soul stone, Wellglass, Aurelite). */
  motes?: number;
  /** A second colour of small flecks on the rock (copper's green patina). */
  flecks?: number;
}

export interface Rock {
  /** Add this to your scene. */
  object: THREE.Group;
  readonly state: RockState;
  /** Call every frame. */
  update(dt: number, time: number, night?: number): void;
  /** One swing of the pickaxe: the rock shakes and a piece of ore pops off. */
  hit(): void;
  /** The rock runs out: the rest of its ore crumbles away. */
  deplete(): void;
  /** The ore grows back. */
  refill(): void;
  dispose(): void;
}

let oreEnv: THREE.Texture | null = null;
/** Give shiny ores something to reflect (a soft studio light map). The game calls this once. */
export function setRockEnvironment(tex: THREE.Texture) {
  oreEnv = tex;
}

export const ROCK_SHAPES = ["Boulder", "Cluster", "Outcrop"] as const;

function lump(rng: Rng, radius: number, detail: number, amount: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const merged = mergeVertices(g, 1e-4);
  const pos = merged.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const f = 1 + (rng() - 0.5) * amount;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  const flat = merged.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/** The plain rock pieces for each shape. [x, z, radius, squash (height)] */
function shapePieces(rng: Rng, shape: number): [number, number, number, number][] {
  if (shape === 1) {
    // Cluster: three or four medium rocks huddled together.
    const n = 3 + Math.floor(rng() * 2);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + rng() * 0.5;
      const d = i === 0 ? 0 : between(rng, 0.55, 0.8);
      return [Math.cos(a) * d, Math.sin(a) * d, i === 0 ? 0.75 : between(rng, 0.45, 0.6), between(rng, 0.7, 0.95)] as [number, number, number, number];
    });
  }
  if (shape === 2) {
    // Outcrop: one tall jagged rock and a couple of small ones.
    return [
      [0, 0, 0.7, 1.7],
      [between(rng, 0.5, 0.7), between(rng, -0.3, 0.3), 0.45, 0.8],
      [between(rng, -0.7, -0.5), between(rng, -0.3, 0.3), 0.35, 0.75],
    ];
  }
  // Boulder: one big round rock and a little one.
  return [
    [0, 0, 0.95, 0.72],
    [between(rng, 0.8, 1.0), between(rng, -0.4, 0.4), 0.35, 0.8],
  ];
}

function crystalGeo(radius: number, length: number): THREE.BufferGeometry {
  // A six-sided prism with a pointed tip, standing on the Y axis.
  const body = new THREE.CylinderGeometry(radius, radius * 1.05, length, 6, 1);
  body.translate(0, length / 2, 0);
  const tip = new THREE.ConeGeometry(radius, radius * 1.6, 6, 1);
  tip.translate(0, length + radius * 0.8, 0);
  const g = new THREE.BufferGeometry();
  const a = body.toNonIndexed().attributes.position.array as Float32Array;
  const b = tip.toNonIndexed().attributes.position.array as Float32Array;
  const all = new Float32Array(a.length + b.length);
  all.set(a);
  all.set(b, a.length);
  g.setAttribute("position", new THREE.BufferAttribute(all, 3));
  g.computeVertexNormals();
  return g;
}

export function buildRock(rng: Rng, look: OreLook, shape: number): Rock {
  const object = new THREE.Group();
  object.name = "rock";
  const shaker = new THREE.Group();
  object.add(shaker);

  // The rock's own material, so it can darken when emptied.
  const hostMat = new THREE.MeshStandardMaterial({ color: look.host, flatShading: true, roughness: 0.92 });
  const hostColor = new THREE.Color(look.host);
  const emptyColor = hostColor.clone().multiplyScalar(0.72);

  const pieces: THREE.Mesh[] = [];
  for (const [x, z, r, squash] of shapePieces(rng, shape)) {
    const m = new THREE.Mesh(lump(rng, r, 1, 0.35), hostMat);
    m.scale.y = squash;
    m.position.set(x, r * squash * 0.55, z);
    m.rotation.y = rng() * Math.PI * 2;
    m.castShadow = true;
    m.receiveShadow = true;
    shaker.add(m);
    pieces.push(m);
  }
  shaker.updateMatrixWorld(true);

  // Find spots on the rock's surface by shooting rays at it from outside.
  const ray = new THREE.Raycaster();
  function surfacePoint(minUp: number): { p: THREE.Vector3; n: THREE.Vector3 } | null {
    for (let tries = 0; tries < 12; tries++) {
      const target = pieces[Math.floor(rng() * pieces.length)];
      const dir = new THREE.Vector3(rng() - 0.5, between(rng, minUp, 1), rng() - 0.5).normalize();
      const center = target.position.clone();
      const from = center.clone().addScaledVector(dir, 4);
      ray.set(from, dir.clone().negate());
      const hit = ray.intersectObjects(pieces, false)[0];
      if (hit && hit.face) {
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
        if (n.y < -0.1) continue;
        return { p: hit.point, n };
      }
    }
    return null;
  }

  // The ore.
  const deposits: THREE.Object3D[] = [];
  const glintSpots: THREE.Vector3[] = [];
  const sizeMul = shape === 1 ? 0.9 : 1;
  const count = look.deposit === "none" ? 0 : Math.round((look.count ?? 7) * (shape === 0 ? 1.2 : 1.35));
  const materials = look.colors.map((c) =>
    new THREE.MeshStandardMaterial({
      color: c,
      flatShading: true,
      roughness: look.roughness ?? (look.deposit === "crystal" ? 0.15 : 0.4),
      metalness: look.metalness ?? (look.deposit === "crystal" ? 0.1 : 0.5),
      emissive: look.deposit === "crystal" ? look.glow ?? c : look.glow ?? 0x000000,
      emissiveIntensity: look.deposit === "crystal" ? look.glowStrength ?? 0.25 : look.glowStrength ?? 0,
      transparent: look.deposit === "crystal",
      opacity: look.deposit === "crystal" ? 0.9 : 1,
      envMap: oreEnv,
      envMapIntensity: look.deposit === "crystal" ? 0.35 : 0.6,
    }),
  );
  for (let i = 0; i < count; i++) {
    const spot = surfacePoint(look.deposit === "crystal" ? 0.25 : -0.05);
    if (!spot) continue;
    const m = materials[i % materials.length];
    const size = (look.size ?? 0.22) * between(rng, 0.7, 1.3) * sizeMul;
    let piece: THREE.Object3D;
    if (look.deposit === "crystal") {
      // A little group of crystals pointing outward.
      const g = new THREE.Group();
      const k = 1 + Math.floor(rng() * 3);
      for (let j = 0; j < k; j++) {
        const c = new THREE.Mesh(crystalGeo(size * between(rng, 0.45, 0.7), size * between(rng, 1.4, 3.0)), m);
        c.rotation.set(between(rng, -0.5, 0.5), rng() * 6.28, between(rng, -0.5, 0.5));
        c.castShadow = true;
        g.add(c);
      }
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), spot.n);
      g.position.copy(spot.p).addScaledVector(spot.n, -size * 0.3);
      piece = g;
    } else {
      const geo = lump(rng, size, 0, look.deposit === "chunk" ? 0.6 : 0.45);
      const nug = new THREE.Mesh(geo, m);
      nug.position.copy(spot.p).addScaledVector(spot.n, -size * 0.35);
      nug.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      if (look.deposit === "chunk") nug.scale.set(1.3, 0.8, 1.1);
      nug.castShadow = true;
      piece = nug;
    }
    shaker.add(piece);
    deposits.push(piece);
    glintSpots.push(spot.p.clone().addScaledVector(spot.n, size * 0.6));
  }
  // Flecks of a second colour (copper patina, etc).
  if (look.flecks !== undefined) {
    for (let i = 0; i < 10; i++) {
      const spot = surfacePoint(-0.1);
      if (!spot) continue;
      const f = new THREE.Mesh(new THREE.CircleGeometry(between(rng, 0.05, 0.1), 5), mat(look.flecks, { roughness: 0.8 }));
      f.position.copy(spot.p).addScaledVector(spot.n, 0.01);
      f.lookAt(spot.p.clone().add(spot.n));
      shaker.add(f);
    }
  }

  // Twinkling glints on shiny ore.
  let glints: { points: THREE.Points; phase: number[] } | null = null;
  if (look.glints && glintSpots.length) {
    const use = glintSpots.slice(0, look.glints);
    const geo = new THREE.BufferGeometry().setFromPoints(use);
    const colors = new Float32Array(use.length * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pm = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, pm);
    shaker.add(points);
    glints = { points, phase: use.map(() => rng() * 10) };
  }
  const floaters = look.motes ? motes(rng, look.motes, look.glow ?? look.colors[0], 1.3, 1.6, 0.4) : null;
  if (floaters) object.add(floaters.object);

  // ---- Behaviour ----
  let state: RockState = "full";
  let shake = 0;
  let t = 0;
  const removed = new Set<THREE.Object3D>();
  const restScale = deposits.map((d) => d.scale.clone());
  const pops: { obj: THREE.Object3D; t: number; dir: 1 | -1; delay: number; idx: number }[] = [];
  const debris: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  const chipColor = look.deposit === "none" ? look.host : look.colors[0];

  function chips(n: number, color: number, at: THREE.Vector3) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(between(rng, 0.04, 0.08), 0), mat(color, { metalness: 0.3, roughness: 0.5 }));
      m.position.copy(at);
      object.add(m);
      debris.push({ mesh: m, vel: new THREE.Vector3((rng() - 0.5) * 3, 1.5 + rng() * 2.5, (rng() - 0.5) * 3), life: 0.7 + rng() * 0.5 });
    }
  }
  function popOne(delay = 0) {
    const left = deposits.filter((d) => !removed.has(d));
    if (!left.length) return;
    const d = left[Math.floor(rng() * left.length)];
    removed.add(d);
    pops.push({ obj: d, t: 0, dir: -1, delay, idx: deposits.indexOf(d) });
    chips(4, chipColor, d.position.clone());
  }

  const rock: Rock = {
    object,
    get state() {
      return state;
    },
    update(dt, time, night = 0) {
      t = time;
      for (const m of materials) m.envMapIntensity = (look.deposit === "crystal" ? 0.35 : 0.6) * (1 - night * 0.75);
      shake = Math.max(0, shake - dt * 3);
      shaker.position.x = Math.sin(time * 60) * 0.04 * shake;
      shaker.position.z = Math.cos(time * 53) * 0.03 * shake;

      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        if (p.delay > 0) {
          p.delay -= dt;
          continue;
        }
        p.t = Math.min(1, p.t + dt / 0.3);
        const s = p.dir < 0 ? 1 - p.t : p.t < 1 ? Math.min(1.15, 1.7 * p.t - 0.55 * p.t * p.t) : 1;
        p.obj.scale.copy(restScale[p.idx]).multiplyScalar(Math.max(0.001, s));
        p.obj.visible = s > 0.002;
        if (p.t >= 1) pops.splice(i, 1);
      }
      if (state === "emptying" && pops.length === 0) state = "empty";
      if (state === "refilling" && pops.length === 0) state = "full";

      // Rock colour: darker while empty.
      const target = state === "empty" || state === "emptying" ? emptyColor : hostColor;
      hostMat.color.lerp(target, Math.min(1, dt * 3));

      if (glints) {
        const c = glints.points.geometry.attributes.color as THREE.BufferAttribute;
        glints.phase.forEach((ph, i) => {
          const on = removed.has(deposits[i]) ? 0 : Math.max(0, Math.sin(time * 2.2 + ph) - 0.6) * 2.5;
          c.setXYZ(i, on, on, on * 0.9);
        });
        c.needsUpdate = true;
      }
      if (floaters) {
        floaters.update(time, dt);
        floaters.object.visible = state === "full" || state === "refilling";
      }
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.life -= dt;
        d.vel.y -= 9 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.mesh.position.y < 0.03) {
          d.mesh.position.y = 0.03;
          d.vel.multiplyScalar(0.4);
        }
        d.mesh.rotation.x += dt * 9;
        d.mesh.scale.setScalar(Math.max(0, Math.min(1, d.life * 3)));
        if (d.life <= 0) {
          object.remove(d.mesh);
          d.mesh.geometry.dispose();
          debris.splice(i, 1);
        }
      }
    },
    hit() {
      if (state !== "full") return;
      shake = 1;
      // Bits of rock fly, and one piece of ore pops off.
      chips(3, look.host, new THREE.Vector3(0.6, 0.6, 0.5));
      popOne();
    },
    deplete() {
      if (state !== "full") return;
      state = "emptying";
      let delay = 0;
      while (deposits.some((d) => !removed.has(d))) {
        popOne(delay);
        delay += 0.06;
      }
      if (!deposits.length) state = "empty";
    },
    refill() {
      if (state !== "empty") return;
      state = "refilling";
      let delay = 0.2;
      for (const d of removed) {
        pops.push({ obj: d, t: 0, dir: 1, delay, idx: deposits.indexOf(d) });
        delay += 0.08;
      }
      removed.clear();
      if (!pops.length) state = "full";
    },
    dispose() {
      object.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      hostMat.dispose();
      materials.forEach((m) => m.dispose());
    },
  };
  void t;
  return rock;
}
