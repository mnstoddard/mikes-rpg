// Shared building blocks for every tree: random numbers, low-poly shapes,
// materials, and the Tree object that handles swaying, chopping, falling
// into a stump and growing back.
//
// Each tree type (pine.ts, oak.ts, ...) only describes its shape. It returns
// a "TreeShape": the part above the cut (trunk top, branches, leaves) plus
// the colours of its wood. makeTree() here turns that into a full Tree.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---------- Random numbers you can repeat ----------

/** A random number maker. The same seed always gives the same tree. */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random number between lo and hi. */
export const between = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();

// ---------- Materials ----------

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export interface MatOptions {
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
}

/** A flat-shaded material (each face one colour: the low-poly look). Shared between trees. */
export function mat(color: number, o: MatOptions = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.roughness ?? 0.85}|${o.metalness ?? 0}|${o.emissive ?? 0}|${o.emissiveIntensity ?? 0}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: o.roughness ?? 0.85,
      metalness: o.metalness ?? 0,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 0,
    });
    materialCache.set(key, m);
  }
  return m;
}

// ---------- Low-poly shapes ----------

/** Push every corner of a shape a little in a random direction, so it looks hand-made. */
function jitter(geo: THREE.BufferGeometry, rng: Rng, amount: number): THREE.BufferGeometry {
  // Join the corners first, so faces stay stuck together when they move.
  const g = geo.clone();
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const merged = mergeVertices(g, 1e-4);
  const pos = merged.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + (rng() - 0.5) * amount, pos.getY(i) + (rng() - 0.5) * amount, pos.getZ(i) + (rng() - 0.5) * amount);
  }
  const flat = merged.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/** A lumpy ball of leaves. */
export function leafBlob(rng: Rng, radius: number, color: number, o: MatOptions & { detail?: number; squash?: number; lumpy?: number } = {}): THREE.Mesh {
  const geo = jitter(new THREE.IcosahedronGeometry(radius, o.detail ?? 1), rng, radius * (o.lumpy ?? 0.28));
  const mesh = new THREE.Mesh(geo, mat(color, o));
  mesh.scale.y = o.squash ?? 0.85;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A cone (pine layers, yew tops). */
export function leafCone(rng: Rng, radius: number, height: number, color: number, o: MatOptions & { sides?: number; lumpy?: number } = {}): THREE.Mesh {
  const geo = jitter(new THREE.ConeGeometry(radius, height, o.sides ?? 7, 1), rng, radius * (o.lumpy ?? 0.12));
  const mesh = new THREE.Mesh(geo, mat(color, o));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A spiky crystal-like shape (ironwood leaves). */
export function leafShard(rng: Rng, radius: number, color: number, o: MatOptions = {}): THREE.Mesh {
  const geo = jitter(new THREE.OctahedronGeometry(radius, 0), rng, radius * 0.35);
  const mesh = new THREE.Mesh(geo, mat(color, o));
  mesh.castShadow = true;
  return mesh;
}

export interface LimbOptions {
  /** Radius at the bottom and the top. */
  r0: number;
  r1: number;
  length: number;
  color: number;
  sides?: number;
  /** How far the top drifts sideways (a gentle curve). */
  bend?: number;
  /** Which way it bends, in radians around the trunk. */
  bendDir?: number;
  lumpy?: number;
  mat?: MatOptions;
}

/**
 * A trunk or branch piece. It starts at (0,0,0) and goes up the Y axis,
 * so you can rotate it to point anywhere. Returns the mesh and where its tip ends up.
 */
export function limb(rng: Rng, o: LimbOptions): { mesh: THREE.Mesh; tip: THREE.Vector3 } {
  const segs = Math.max(2, Math.round(o.length / 0.5));
  const geo = new THREE.CylinderGeometry(o.r1, o.r0, o.length, o.sides ?? 6, segs, false);
  geo.translate(0, o.length / 2, 0);
  // Bend: push each ring sideways more the higher it is.
  const bend = o.bend ?? 0;
  const dir = o.bendDir ?? 0;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / o.length;
    const push = bend * t * t;
    pos.setX(i, pos.getX(i) + Math.cos(dir) * push);
    pos.setZ(i, pos.getZ(i) + Math.sin(dir) * push);
  }
  const shaped = jitter(geo, rng, Math.min(o.r0, o.r1 + 0.05) * (o.lumpy ?? 0.25));
  const mesh = new THREE.Mesh(shaped, mat(o.color, o.mat));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const tip = new THREE.Vector3(Math.cos(dir) * bend, o.length, Math.sin(dir) * bend);
  return { mesh, tip };
}

/**
 * A branch growing out of a point: it leans `tilt` radians away from straight
 * up, toward `angleAround` (radians around the trunk), and curves a little
 * further outward. Returns the mesh and where its tip ends up.
 */
export function branch(rng: Rng, from: THREE.Vector3, angleAround: number, tilt: number, o: LimbOptions): { mesh: THREE.Mesh; tip: THREE.Vector3 } {
  const { mesh, tip } = limb(rng, { ...o, bendDir: 0 });
  const m = new THREE.Matrix4()
    .makeTranslation(from.x, from.y, from.z)
    .multiply(new THREE.Matrix4().makeRotationY(-angleAround))
    .multiply(new THREE.Matrix4().makeRotationZ(-tilt));
  mesh.geometry.applyMatrix4(m);
  return { mesh, tip: tip.applyMatrix4(m) };
}

// ---------- The Tree object ----------

export type TreeState = "standing" | "falling" | "stump" | "growing";

/** What each tree type's code returns: its look, split at the cut. */
export interface TreeShape {
  /** Everything above the cut: trunk, branches, leaves. Its (0,0,0) is the middle of the cut. */
  top: THREE.Group;
  /** The leafy parts that flutter in the wind (inside `top`). */
  leaves: THREE.Object3D[];
  /** Height of the cut above the ground (the stump's height). */
  cutHeight: number;
  /** Trunk radius at the cut. */
  trunkRadius: number;
  /** Bark (outside) and heartwood (inside) colours for the stump. */
  bark: number;
  heartwood: number;
  /** Extra stump material settings (shiny ironwood, glowing elderwood...). */
  barkMat?: MatOptions;
  /** How much it moves in the wind: 1 is normal, 0.4 a stiff pine, 1.5 a bendy birch. */
  sway: number;
  /** Optional per-frame extra (glowing motes, sparkles). */
  extra?: { object: THREE.Object3D; update: (time: number, dt: number) => void };
  /** For trees whose leaves sit right on the trunk (pine): where bare branches go on the dead version. */
  bareWhorls?: { y: number; r: number }[];
  /** Extra things at ground level that stay after felling (roots, mushrooms). */
  base?: THREE.Object3D[];
}

export interface Tree {
  /** Add this to your scene. */
  object: THREE.Group;
  state: TreeState;
  /** Call every frame. `wind` is 0 (still) to about 2 (stormy). */
  update(dt: number, time: number, wind?: number): void;
  /** One chop: the tree shakes. */
  hit(): void;
  /** The tree falls and leaves a stump. */
  fell(): void;
  /** A stump grows back into a tree. */
  regrow(): void;
  /** Free the GPU memory when you're done with it. */
  dispose(): void;
}

/** Turns a tree type's shape into a Tree that sways, shakes, falls and regrows. */
export function makeTree(shape: TreeShape, rng: Rng): Tree {
  const object = new THREE.Group();
  object.name = "tree";

  // The trunk's bottom ring sits exactly on the stump's top ring (version 0.22): the trunk was a little wider and
  // lumpy there, so a standing tree showed a line where it would be cut (Mike's note).
  const ring: number[] = [];
  shape.top.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), x = pos.getX(i), z = pos.getZ(i), rr = Math.hypot(x, z);
      if (Math.abs(y) > 0.02 || rr > shape.trunkRadius * 1.5 || rr < 1e-4) continue;
      const k = (shape.trunkRadius * 0.95) / rr;
      pos.setXYZ(i, x * k, 0, z * k);
      ring.push(Math.atan2(z, x));
      changed = true;
    }
    if (changed) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); }
  });
  // The stump: always there. The top sits on it.
  // How far out the trunk's bottom (a polygon) reaches at each angle: the stump's top follows it exactly.
  const angles = [...new Set(ring.map((a) => Math.round(a * 1000) / 1000))].sort((a, b) => a - b);
  const R = shape.trunkRadius * 0.95;
  const edgeAt = (a: number) => {
    if (angles.length < 3) return R;
    for (let i = 0; i < angles.length; i++) {
      const a0 = angles[i], a1 = i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI * 2;
      let t = a;
      while (t < a0) t += Math.PI * 2;
      if (t <= a1) { const mid = (a0 + a1) / 2, half = (a1 - a0) / 2; return (R * Math.cos(half)) / Math.cos(t - mid); }
    }
    return R;
  };
  const stump = makeStump(rng, shape, edgeAt);
  object.add(stump);
  const cutFace = stump.getObjectByName("cut")!;
  for (const b of shape.base ?? []) object.add(b);

  // pivot: where the tree hinges when it falls (the cut).
  const pivot = new THREE.Group();
  pivot.position.y = shape.cutHeight;
  object.add(pivot);
  const swayer = new THREE.Group(); // wind and chop shake
  pivot.add(swayer);
  swayer.add(shape.top);
  if (shape.extra) swayer.add(shape.extra.object);
  // The underside of the falling trunk: cut wood, so it isn't hollow as it tips over.
  const underside = new THREE.Mesh(new THREE.CircleGeometry(shape.trunkRadius * 0.98, 7), mat(shape.heartwood));
  underside.rotation.x = Math.PI / 2;
  underside.position.y = 0.004;
  underside.visible = false;
  swayer.add(underside);

  const phase = rng() * Math.PI * 2;
  const leafPhase = shape.leaves.map(() => rng() * Math.PI * 2);
  const leafRest = shape.leaves.map((l) => l.rotation.clone());

  let state: TreeState = "standing";
  let shake = 0; // chop wobble left, fades out
  let fallT = 0;
  let fallDir = rng() * Math.PI * 2;
  let growT = 0;
  // How far down the fallen tree has to go to be out of sight: its widest reach, lying on its side.
  const sinkDepth = (() => {
    const b = new THREE.Box3().setFromObject(shape.top);
    return Math.max(1.5, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.6 + 0.5);
  })();
  const debris: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number }[] = [];

  function puff(count: number, color: number, at: THREE.Vector3) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.09 + rng() * 0.07, 0), mat(color));
      m.position.copy(at).add(new THREE.Vector3((rng() - 0.5) * 1.2, rng() * 0.8, (rng() - 0.5) * 1.2));
      object.add(m);
      debris.push({
        mesh: m,
        vel: new THREE.Vector3((rng() - 0.5) * 2.4, 1 + rng() * 2, (rng() - 0.5) * 2.4),
        spin: new THREE.Vector3(rng() * 8, rng() * 8, rng() * 8),
        life: 1.1 + rng() * 0.6,
      });
    }
  }

  // The first leaf colour, for leaf puffs.
  const leafColor = (() => {
    const first = shape.leaves[0] as THREE.Mesh | undefined;
    const m = first?.material as THREE.MeshStandardMaterial | undefined;
    return m?.color?.getHex?.() ?? 0x5f8f3a;
  })();

  const tree: Tree = {
    object,
    get state() {
      return state;
    },
    set state(s: TreeState) {
      state = s;
    },
    update(dt, time, wind = 1) {
      // Wind sway: the whole top leans a little, slowly.
      const w = wind * shape.sway;
      const sx = Math.sin(time * 0.9 + phase) * 0.025 * w + Math.sin(time * 2.3 + phase * 2) * 0.006 * w;
      const sz = Math.cos(time * 0.7 + phase) * 0.018 * w;
      // Chop wobble: a quick shiver that dies away.
      shake = Math.max(0, shake - dt * 2.2);
      const sh = Math.sin(time * 38) * 0.05 * shake * shake;
      swayer.rotation.set(sx + sh, 0, sz + sh * 0.6);
      // Leaves flutter a bit on their own.
      shape.leaves.forEach((l, i) => {
        const r = leafRest[i];
        l.rotation.set(
          r.x + Math.sin(time * 2.1 + leafPhase[i]) * 0.03 * w,
          r.y + Math.sin(time * 1.3 + leafPhase[i]) * 0.02 * w,
          r.z + Math.cos(time * 1.8 + leafPhase[i]) * 0.03 * w,
        );
      });
      shape.extra?.update(time, dt);

      if (state === "falling") {
        fallT += dt;
        // Speeds up as it tips, like a real tree, then a little bounce on landing.
        const T = 1.5;
        const t = Math.min(1, fallT / T);
        let angle = (Math.PI / 2) * 0.96 * t * t * t;
        if (t >= 1) {
          const after = fallT - T;
          angle = (Math.PI / 2) * 0.96 - Math.abs(Math.sin(after * 9)) * Math.exp(-after * 6) * 0.08;
          if (after < 0.02 && debris.length === 0) {
            const land = new THREE.Vector3(Math.cos(fallDir), 0, Math.sin(fallDir)).multiplyScalar(2.2);
            puff(16, leafColor, land);
          }
          // Then it sinks slowly into the ground and is gone (shrinking it back into the stump looked fake).
          if (after > 1.4) {
            const k = Math.min(1, (after - 1.4) / 1.8);
            const e = k * k * (3 - 2 * k); // smooth start and end
            pivot.position.y = shape.cutHeight - e * (sinkDepth + shape.cutHeight);
            pivot.scale.setScalar(1 - e * 0.35);
            if (k >= 1) {
              pivot.visible = false;
              pivot.position.y = shape.cutHeight;
              underside.visible = false;
              state = "stump";
            }
          }
        }
        pivot.rotation.set(0, 0, 0);
        pivot.rotateOnAxis(new THREE.Vector3(Math.sin(fallDir), 0, -Math.cos(fallDir)), -angle);
      } else if (state === "growing") {
        growT += dt;
        const t = Math.min(1, growT / 1.6);
        // Grows with a little springy overshoot.
        pivot.scale.setScalar(t < 1 ? Math.max(0.001, easeOutBack(t)) : 1);
        if (t >= 1) { state = "standing"; cutFace.visible = false; }
      }

      // Bits of leaves and wood chips flying.
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.life -= dt;
        d.vel.y -= 6 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.mesh.position.y < 0.05) {
          d.mesh.position.y = 0.05;
          d.vel.multiplyScalar(0.5);
        }
        d.mesh.rotation.x += d.spin.x * dt;
        d.mesh.rotation.y += d.spin.y * dt;
        d.mesh.scale.setScalar(Math.max(0, Math.min(1, d.life * 2)));
        if (d.life <= 0) {
          object.remove(d.mesh);
          d.mesh.geometry.dispose();
          debris.splice(i, 1);
        }
      }
    },
    hit() {
      if (state !== "standing") return;
      shake = 1;
      // Wood chips fly from the cut.
      const at = new THREE.Vector3(shape.trunkRadius, shape.cutHeight + 0.35, 0);
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.12), mat(shape.heartwood));
        m.position.copy(at);
        object.add(m);
        debris.push({
          mesh: m,
          vel: new THREE.Vector3(1 + rng() * 2, 1.5 + rng() * 2, (rng() - 0.5) * 3),
          spin: new THREE.Vector3(rng() * 12, rng() * 12, rng() * 12),
          life: 0.8 + rng() * 0.4,
        });
      }
      // A few leaves drop.
      puff(3, leafColor, new THREE.Vector3(0, shape.cutHeight + 3, 0));
    },
    fell() {
      if (state !== "standing") return;
      state = "falling";
      cutFace.visible = true;
      underside.visible = true;
      fallT = 0;
      fallDir = rng() * Math.PI * 2;
    },
    regrow() {
      if (state !== "stump") return;
      pivot.visible = true;
      pivot.rotation.set(0, 0, 0);
      pivot.scale.setScalar(0.001);
      growT = 0;
      state = "growing";
    },
    dispose() {
      object.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
        if ((o as THREE.Points).isPoints) (o as THREE.Points).geometry.dispose();
      });
    },
  };
  return tree;
}

function easeOutBack(t: number) {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** The stump: a short trunk with a pale cut top and rings, plus little root flares. */
function makeStump(rng: Rng, shape: TreeShape, edgeAt: (a: number) => number = () => shape.trunkRadius * 0.95): THREE.Group {
  const g = new THREE.Group();
  const r = shape.trunkRadius;
  const h = shape.cutHeight;
  const sides = 14;
  // A touch narrower at the top than the trunk above it, so the standing tree shows no seam there.
  const side = new THREE.CylinderGeometry(r * 0.95, r * 1.18, h, sides, 1, true);
  side.translate(0, h / 2, 0);
  const jittered = jitterSafe(side, rng, r * 0.12);
  // Keep the top ring round (no jitter), tucked inside the trunk.
  const sp = jittered.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) {
    if (sp.getY(i) < h - 1e-3) continue;
    const a = Math.atan2(sp.getZ(i), sp.getX(i));
    const er = edgeAt(a) * 0.995;
    sp.setXYZ(i, Math.cos(a) * er, h, Math.sin(a) * er);
  }
  jittered.computeVertexNormals();
  const sideMesh = new THREE.Mesh(jittered, mat(shape.bark, shape.barkMat));
  sideMesh.castShadow = true;
  sideMesh.receiveShadow = true;
  g.add(sideMesh);

  // The cut face: pale wood with a darker ring and a dot in the middle.
  // The cut face only shows once the tree is chopped down (it looked like a cut ring on standing trees).
  const cut = new THREE.Group();
  cut.name = "cut";
  cut.visible = false;
  g.add(cut);
  const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, sides), mat(shape.heartwood));
  top.rotation.x = -Math.PI / 2;
  top.position.y = h + 0.002;
  top.receiveShadow = true;
  cut.add(top);
  const ringColor = new THREE.Color(shape.heartwood).multiplyScalar(0.82).getHex();
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.45, r * 0.55, sides), mat(ringColor));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = h + 0.004;
  cut.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(r * 0.14, 5), mat(ringColor));
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = h + 0.006;
  cut.add(dot);

  // Roots poking out at the base.
  const roots = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + rng() * 0.6;
    const len = r * (1.3 + rng() * 0.9);
    const geo = new THREE.ConeGeometry(r * 0.38, len, 4);
    geo.rotateZ(-Math.PI / 2);
    geo.translate(len / 2 + r * 0.6, r * 0.12, 0);
    const m = new THREE.Mesh(geo, mat(shape.bark, shape.barkMat));
    m.rotation.y = -a;
    m.scale.y = 0.6;
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function jitterSafe(geo: THREE.BufferGeometry, rng: Rng, amount: number) {
  // Open cylinders have a seam; keep the jitter sideways only so it can't split.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const seen = new Map<string, [number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let off = seen.get(key);
    if (!off) {
      off = [(rng() - 0.5) * amount, (rng() - 0.5) * amount];
      seen.set(key, off);
    }
    pos.setX(i, pos.getX(i) + off[0]);
    pos.setZ(i, pos.getZ(i) + off[1]);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Twinkling floating lights (elderwood, crownwood). */
export function motes(rng: Rng, count: number, color: number, radius: number, height: number, y0: number): { object: THREE.Object3D; update: (time: number, dt: number) => void } {
  const geo = new THREE.BufferGeometry();
  const base: number[] = [];
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = radius * (0.4 + rng() * 0.7);
    base.push(a, r, y0 + rng() * height, rng() * 10);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size: 0.16, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, m);
  points.frustumCulled = false;
  return {
    object: points,
    update(time) {
      for (let i = 0; i < count; i++) {
        const [a, r, y, p] = base.slice(i * 4, i * 4 + 4);
        const aa = a + time * 0.25 + Math.sin(time * 0.5 + p) * 0.3;
        pos[i * 3] = Math.cos(aa) * r;
        pos[i * 3 + 1] = y + Math.sin(time * 0.8 + p) * 0.3;
        pos[i * 3 + 2] = Math.sin(aa) * r;
      }
      geo.attributes.position.needsUpdate = true;
      m.opacity = 0.7 + Math.sin(time * 3) * 0.25;
    },
  };
}
