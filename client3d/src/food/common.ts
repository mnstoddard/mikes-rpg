// Shared building blocks for fish, food and fishing spots: materials, lumpy
// low-poly shapes, steam, and the Showpiece that every model returns.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeRng, between, Rng } from "../trees/common";

export { makeRng, between };
export type { Rng };

/**
 * What the gallery should put under a model:
 * tank (water, for a swimming fish), board (a wooden chopping board),
 * plate, table (a bare tabletop: bowls and pans bring their own dish),
 * soil (a little patch of farm earth) or pond (a fishing spot, real size, on the ground).
 */
export type Stage = "tank" | "board" | "plate" | "table" | "soil" | "pond";

/** One model on show: add `object` to the scene and call `update` every frame. */
export interface Showpiece {
  object: THREE.Group;
  stage: Stage;
  /** Call every frame. */
  update(dt: number, time: number): void;
  /** The gallery's action button (a fish darts or flops, a spot splashes...). */
  poke?(): void;
  /** Free the GPU memory when you're done with it. */
  dispose(): void;
}

// ---------- Materials ----------

export interface MatOptions {
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  /** Draw both sides (flat fins, petals, leaves). */
  double?: boolean;
  /** Use the shape's own per-face colours (fish bodies). */
  vertexColors?: boolean;
  opacity?: number;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** A flat-shaded (low-poly) material, shared between models. */
export function mat(color: number, o: MatOptions = {}): THREE.MeshStandardMaterial {
  const key = JSON.stringify([color, o]);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: o.vertexColors ? 0xffffff : color,
      flatShading: true,
      roughness: o.roughness ?? 0.8,
      metalness: o.metalness ?? 0,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 0,
      side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      vertexColors: !!o.vertexColors,
      transparent: o.opacity !== undefined,
      opacity: o.opacity ?? 1,
      depthWrite: o.opacity === undefined,
    });
    cache.set(key, m);
  }
  return m;
}

/** Mix two colours: t = 0 gives a, 1 gives b. */
export function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}
/** Darker (f < 1) or lighter (f > 1). */
export function shade(c: number, f: number): number {
  const col = new THREE.Color(c);
  return f < 1 ? col.multiplyScalar(f).getHex() : col.lerp(new THREE.Color(0xffffff), Math.min(1, f - 1)).getHex();
}

// ---------- Shapes ----------

/** Push every corner a little in a random direction, so it looks hand-made. */
export function jitter(geo: THREE.BufferGeometry, rng: Rng, amount: number, squashY = 1): THREE.BufferGeometry {
  const g = geo.clone();
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const merged = mergeVertices(g, 1e-4);
  const pos = merged.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + (rng() - 0.5) * amount, pos.getY(i) + (rng() - 0.5) * amount * squashY, pos.getZ(i) + (rng() - 0.5) * amount);
  }
  const flat = merged.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** A lumpy ball, stretched to sx × sy × sz (potatoes, truffles, chunks of meat). */
export function lump(rng: Rng, sx: number, sy: number, sz: number, color: number, o: MatOptions & { detail?: number; lumpy?: number } = {}): THREE.Mesh {
  const geo = jitter(new THREE.IcosahedronGeometry(1, o.detail ?? 1), rng, o.lumpy ?? 0.25);
  geo.scale(sx, sy, sz);
  return mesh(geo, mat(color, o));
}

/** A bowl, pot or plate turned on a lathe: pass the outline from the middle of the base outward. */
export function lathe(points: [number, number][], color: number, o: MatOptions & { sides?: number } = {}): THREE.Mesh {
  const geo = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), o.sides ?? 18);
  return mesh(geo, mat(color, { ...o, double: true }));
}

/** A flat leaf or petal shape lying along +X, `len` long and `wide` wide. */
export function leafGeo(len: number, wide: number, curl = 0.15): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(len * 0.45, wide, len, 0);
  s.quadraticCurveTo(len * 0.45, -wide, 0, 0);
  const g = new THREE.ShapeGeometry(s, 3);
  g.rotateX(-Math.PI / 2);
  // Curl the edges up a little, like a real leaf.
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    p.setY(i, p.getY(i) + ((z * z) / Math.max(1e-6, wide * wide)) * wide * curl * 4);
  }
  g.computeVertexNormals();
  return g;
}

// ---------- Steam ----------

/** Soft puffs of steam rising from hot food. `area` is the radius they rise from. */
export function steam(rng: Rng, area: number, y0: number, count = 7, size = 1): { object: THREE.Group; update: (time: number) => void } {
  const g = new THREE.Group();
  const puffs: { m: THREE.Mesh; x: number; z: number; p: number; s: number }[] = [];
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, flatShading: true, roughness: 1 });
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 * size, 0), material.clone());
    g.add(m);
    puffs.push({ m, x: (rng() - 0.5) * area * 1.4, z: (rng() - 0.5) * area * 1.4, p: rng(), s: 0.7 + rng() * 0.6 });
  }
  return {
    object: g,
    update(time) {
      for (const pf of puffs) {
        const t = (time * 0.35 * pf.s + pf.p) % 1;
        pf.m.position.set(pf.x + Math.sin(time * 1.3 + pf.p * 9) * 0.05 * size, y0 + t * 0.7 * size, pf.z);
        pf.m.scale.setScalar((0.6 + t * 1.8) * pf.s);
        (pf.m.material as THREE.MeshStandardMaterial).opacity = 0.38 * Math.sin(t * Math.PI);
      }
    },
  };
}

/** Free every geometry under an object (materials are shared, so they stay). */
export function disposeAll(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
}

/** A showpiece that just sits there (with an optional per-frame extra). */
export function still(object: THREE.Group, stage: Stage, update: (dt: number, time: number) => void = () => {}, poke?: () => void): Showpiece {
  return { object, stage, update, poke, dispose: () => disposeAll(object) };
}
