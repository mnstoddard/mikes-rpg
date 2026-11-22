// The item toolkit: colours for every metal and wood, plus small low-poly
// building blocks (boxes, rods, gems, glowing bits) that every item file uses.
//
// Items are made from code, like the trees: no model files. Sizes are in
// metres, so a hand axe is about 0.7 m long and a furnace is taller than you.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mat, makeRng, between, MatOptions, Rng } from "../trees/common";
import type { Material, Wood } from "../../../shared/tools";

export { mat, makeRng, between };
export type { MatOptions, Rng };

// ---------- Colours ----------

/** Every metal (tool metals and jewelry metals) and stone: colour and how shiny it is. */
export type MetalLook = Material | "silver" | "gold" | "platinum" | "iridium";

export const METAL_LOOK: Record<MetalLook, { color: number; dark: number; m: MatOptions }> = {
  stone:    { color: 0x8f8a82, dark: 0x6b6760, m: { roughness: 0.95 } },
  bronze:   { color: 0xc07a3c, dark: 0x8a5428, m: { metalness: 0.6, roughness: 0.42 } },
  iron:     { color: 0x7a7c80, dark: 0x55575b, m: { metalness: 0.65, roughness: 0.5 } },
  steel:    { color: 0xc6ced6, dark: 0x8d969f, m: { metalness: 0.8, roughness: 0.3 } },
  mithril:  { color: 0x6fc6e0, dark: 0x3f8ea8, m: { metalness: 0.75, roughness: 0.28, emissive: 0x1d5a70, emissiveIntensity: 0.25 } },
  silver:   { color: 0xe4e7ec, dark: 0xaeb4bc, m: { metalness: 0.85, roughness: 0.25 } },
  gold:     { color: 0xf0c14a, dark: 0xb88a22, m: { metalness: 0.85, roughness: 0.3 } },
  platinum: { color: 0xd6e0e4, dark: 0x9fb0b6, m: { metalness: 0.9, roughness: 0.22 } },
  iridium:  { color: 0x9a86e0, dark: 0x6650b0, m: { metalness: 0.8, roughness: 0.28, emissive: 0x3a2a80, emissiveIntensity: 0.2 } },
};

/** Every wood: bark on the outside, the pale wood inside (matches the trees). */
export const WOOD_LOOK: Record<Wood, { bark: number; wood: number; m?: MatOptions }> = {
  pine:      { bark: 0x7a5434, wood: 0xe6c58f },
  oak:       { bark: 0x5e4630, wood: 0xc79a62 },
  birch:     { bark: 0xeeeae0, wood: 0xf1e2c2 },
  maple:     { bark: 0x6e4a36, wood: 0xd99a6a },
  yew:       { bark: 0x7a3a2a, wood: 0xc0704a },
  ironwood:  { bark: 0x56636b, wood: 0xb7c0c4, m: { metalness: 0.4, roughness: 0.5 } },
  elderwood: { bark: 0x3b2a4f, wood: 0xc6a8ef, m: { emissive: 0x8a5cff, emissiveIntensity: 0.18 } },
};

/** The metal's material. */
export const metalMat = (m: MetalLook, dark = false) => mat(dark ? METAL_LOOK[m].dark : METAL_LOOK[m].color, METAL_LOOK[m].m);
/** A handle in this wood (the pale inner wood, smoothed by hands). */
export const woodMat = (w: Wood) => mat(WOOD_LOOK[w].wood, { roughness: 0.75, ...WOOD_LOOK[w].m });
export const barkMat = (w: Wood) => mat(WOOD_LOOK[w].bark, WOOD_LOOK[w].m);

// ---------- Shapes ----------

function finish(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Push corners a little so it looks hand-made. Faces stay joined. */
export function rough(geo: THREE.BufferGeometry, rng: Rng, amount: number): THREE.BufferGeometry {
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

/** A box, centred on (x, y, z). */
export function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = finish(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
  mesh.position.set(x, y, z);
  return mesh;
}

/** A rod (cylinder) along Y, from y0 up to y0 + length. r1 is the top radius. */
export function rod(r0: number, r1: number, length: number, m: THREE.Material, sides = 6, y0 = 0): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r1, r0, length, sides, 1);
  geo.translate(0, y0 + length / 2, 0);
  return finish(new THREE.Mesh(geo, m));
}

/** A ball (low-poly). */
export function ball(r: number, m: THREE.Material, detail = 0, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = finish(new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), m));
  mesh.position.set(x, y, z);
  return mesh;
}

/** A lumpy ball (rocks, mushrooms, roots). */
export function lump(rng: Rng, r: number, m: THREE.Material, amount = 0.3, detail = 0): THREE.Mesh {
  return finish(new THREE.Mesh(rough(new THREE.IcosahedronGeometry(r, detail), rng, r * amount), m));
}

/** Any geometry as a finished mesh. */
export function mesh(geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  return finish(new THREE.Mesh(geo, m));
}

/** A cut gem: a pointed bottom and a flat-topped crown. */
export function gem(r: number, color: number, sides = 8, glow = 0.15): THREE.Mesh {
  const pts = [new THREE.Vector2(0, -r * 0.9), new THREE.Vector2(r, 0), new THREE.Vector2(r * 0.62, r * 0.45), new THREE.Vector2(0, r * 0.45)];
  const geo = new THREE.LatheGeometry(pts, sides);
  return finish(new THREE.Mesh(geo, mat(color, { roughness: 0.15, metalness: 0.1, emissive: color, emissiveIntensity: glow })));
}

/** A round-ish outline turned around Y (bottles, pots, bowls). Points go bottom to top, as [radius, height]. */
export function lathe(points: [number, number][], m: THREE.Material, sides = 10): THREE.Mesh {
  return finish(new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), sides), m));
}

/** A flat shape cut from a 2D outline and given thickness (blades, leaves, labels). Points go round the edge, in X/Y. */
export function slab(points: [number, number][], depth: number, m: THREE.Material, bevel = 0): THREE.Mesh {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return finish(new THREE.Mesh(geo, m));
}

/** A soft light glow that ignores the sun (fire, potions, magic). */
export function glowMat(color: number, strength = 1.6) {
  return mat(color, { emissive: color, emissiveIntensity: strength, roughness: 0.6 });
}

/** A see-through material (glass, water). Not shared, so it can fade. */
export function glassMat(color: number, opacity = 0.45) {
  return new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.08, metalness: 0.1, flatShading: true, depthWrite: false });
}

// ---------- The Item object ----------

/** A built item, ready to put in the scene. */
export interface Item {
  object: THREE.Group;
  /** Call every frame: flickering fire, bubbling potions, glowing petals. */
  update(dt: number, time: number): void;
  /** What its action button says (Swing, Open, Stoke... or Drop). */
  readonly actLabel: string;
  /** Do the action: swing the tool, open the chest, drop it on the ground... */
  act(): void;
  dispose(): void;
}

/** What each item file builds: the model, plus optional animation and action. */
export interface ItemShape {
  object: THREE.Group;
  /** How it sits when lying on the ground (default: as built, standing up). */
  groundPose?: { rx?: number; rz?: number; y?: number };
  /** Where a hand holds it (a point on the model). Only items you hold. */
  grip?: THREE.Vector3;
  tick?: (dt: number, time: number) => void;
  actLabel?: string;
  act?: (this: ItemShape) => void;
}

/**
 * Turn a shape into an Item. Things with no action of their own get "Drop":
 * they fall from above, bounce and settle, like loot hitting the ground.
 */
export function makeItem(shape: ItemShape): Item {
  const object = new THREE.Group();
  object.add(shape.object);
  let drop: ReturnType<typeof tween> | null = null;
  const inner = shape.object;
  const act = shape.act ? () => shape.act!.call(shape) : (() => {
    drop = tween(1.1, (f) => {
      const fall = 0.32;
      if (f < fall) inner.position.y = 0.6 * (1 - (f / fall) ** 2);
      else {
        const g = (f - fall) / (1 - fall);
        inner.position.y = Math.abs(Math.sin(g * Math.PI * 2)) * 0.08 * (1 - g);
      }
      inner.rotation.y = (1 - ease.out(f)) * 1.4;
    });
  });
  return {
    object,
    update: (dt, t) => {
      shape.tick?.(dt, t);
      if (drop && !drop.step(dt)) drop = null;
    },
    // A getter, so a chest's button can say "Open" then "Close".
    get actLabel() {
      return shape.actLabel ?? "Drop";
    },
    act,
    dispose() {
      // Materials are shared (see mat()), so only geometry and own materials go.
      object.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mm = m.material as THREE.Material;
          if (mm.transparent || mm.userData.own) mm.dispose();
        }
      });
    },
  };
}

/** A simple timed animation: run(f) with f going 0 to 1 over `seconds`. */
export function tween(seconds: number, run: (f: number) => void): { step: (dt: number) => boolean } {
  let t = 0;
  return {
    step(dt) {
      t = Math.min(seconds, t + dt);
      run(t / seconds);
      return t < seconds;
    },
  };
}

/** Eases for tweens. */
export const ease = {
  out: (f: number) => 1 - (1 - f) * (1 - f),
  inOut: (f: number) => (f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2),
  /** Up and back down: 0 -> 1 -> 0. */
  bump: (f: number) => Math.sin(f * Math.PI),
};
