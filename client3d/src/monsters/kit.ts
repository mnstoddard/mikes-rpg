// Shared building blocks for every monster: smooth materials, rounded shapes,
// painted cartoon eyes, the joint "rig" that animations move, and the player
// that runs the five animations (idle, walk, attack, hit, death).
//
// Monsters are smooth and cute (not faceted), so they read well against the
// low-poly world. Eyes are painted on a canvas, like the character's, with a
// big shine so they look friendly; hostile monsters get a slanted lid so you
// can still tell they mean business.
import * as THREE from "three";

export type Anim = "idle" | "walk" | "attack" | "hit" | "death";
export const ANIMS: [Anim, string][] = [["idle", "Idle"], ["walk", "Walk"], ["attack", "Attack"], ["hit", "Get hit"], ["death", "Defeat"]];

/** One monster, ready to show: add `object` to the scene and call `update` every frame. */
export interface Monster {
  object: THREE.Group;
  /** Roughly how tall it is (metres), for framing the camera. */
  height: number;
  /** Which animation is playing. */
  readonly anim: Anim;
  /** Play an animation. Attack and hit play once, then go back to idle or walk. Defeat lies down, then it comes back. */
  play(a: Anim): void;
  /** Every frame: dt and time in seconds. */
  update(dt: number, time: number): void;
  dispose(): void;
}

// ---------- Small maths ----------

export type Rng = () => number;
export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 0 to 1 over [a, b], eased in and out. */
export const ease = (x: number, a = 0, b = 1) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Goes up over [a, b] and back down over [b, c]. */
export const bump = (x: number, a: number, b: number, c: number) => (x < b ? ease(x, a, b) : 1 - ease(x, b, c));

export function shade(c: number, f: number): number {
  const col = new THREE.Color(c);
  return f < 1 ? col.multiplyScalar(f).getHex() : col.lerp(new THREE.Color(0xffffff), Math.min(1, f - 1)).getHex();
}
export function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

// ---------- The kit a builder uses ----------

export interface MatOpts {
  roughness?: number;
  metalness?: number;
  glow?: number; // emissive colour
  glowStrength?: number;
  opacity?: number;
  double?: boolean;
  additive?: boolean;
}

/** Everything a monster builder needs, collecting what it makes so it can be cleaned up. */
export class Kit {
  readonly mats: THREE.MeshStandardMaterial[] = [];
  readonly geos: THREE.BufferGeometry[] = [];
  readonly textures: THREE.Texture[] = [];
  readonly rig = new Rig();
  readonly eyeList: Eye[] = [];

  /** A smooth material (not flat shaded). */
  mat(color: number, o: MatOpts = {}): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.roughness ?? 0.72,
      metalness: o.metalness ?? 0,
      emissive: o.glow ?? 0x000000,
      emissiveIntensity: o.glowStrength ?? (o.glow !== undefined ? 1 : 0),
      transparent: o.opacity !== undefined,
      opacity: o.opacity ?? 1,
      depthWrite: o.opacity === undefined,
      side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mats.push(m);
    return m;
  }

  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  /** Add a mesh to a parent. */
  mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
    const m = new THREE.Mesh(this.geo(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    parent.add(m);
    return m;
  }

  /** A joint: an empty group that animations turn. */
  joint(parent: THREE.Object3D, x = 0, y = 0, z = 0, name = ""): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    this.rig.add(g);
    return g;
  }

  /** A smooth egg / ball (half sizes). */
  ball(parent: THREE.Object3D, rx: number, ry: number, rz: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 28): THREE.Mesh {
    const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
    g.scale(rx, ry, rz);
    return this.mesh(parent, g, mat, x, y, z);
  }

  /** A rounded limb hanging down from its joint: radius r1 at the top, r2 at the bottom. */
  bone(parent: THREE.Object3D, len: number, r1: number, r2: number, mat: THREE.Material, seg = 14): THREE.Mesh {
    return this.mesh(parent, roundBone(len, r1, r2, seg), mat);
  }

  /** A smooth horn / spike pointing up +Y from its base. */
  horn(parent: THREE.Object3D, len: number, r: number, mat: THREE.Material, bend = 0, x = 0, y = 0, z = 0): THREE.Mesh {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector3(0, t * len, bend * len * t * t));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 12, 1, 10, false);
    // Taper the tube to a point.
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = Math.min(1, Math.max(0, v.y / len));
      const c = curve.getPoint(t);
      const k = r * (1 - t * 0.94);
      pos.setXYZ(i, c.x + (v.x - c.x) * k, c.y + (v.y - c.y) * k, c.z + (v.z - c.z) * k);
    }
    g.computeVertexNormals();
    return this.mesh(parent, g, mat, x, y, z);
  }

  /** A pair of painted eyes on a head (an ellipsoid with half sizes h at centre c). */
  eyes(head: THREE.Object3D, h: [number, number, number], c: [number, number, number], spec: EyeSpec) {
    for (const s of [1, -1] as const) {
      const d = new THREE.Vector3(s * spec.spread, spec.up, 1).normalize();
      // Point on the ellipsoid in that direction.
      const p = new THREE.Vector3(d.x * h[0], d.y * h[1], d.z * h[2]);
      const k = 1 / Math.sqrt((p.x / h[0]) ** 2 + (p.y / h[1]) ** 2 + (p.z / h[2]) ** 2);
      p.multiplyScalar(k);
      const n = new THREE.Vector3(p.x / (h[0] * h[0]), p.y / (h[1] * h[1]), p.z / (h[2] * h[2])).normalize();
      n.lerp(new THREE.Vector3(0, 0, 1), spec.forward ?? 0.35).normalize();
      const e = this.eye(spec, s);
      e.mesh.position.set(c[0] + p.x - n.x * spec.size * 0.18, c[1] + p.y - n.y * spec.size * 0.18, c[2] + p.z - n.z * spec.size * 0.18);
      e.mesh.lookAt(e.mesh.position.clone().add(n));
      e.mesh.rotateZ(-s * (spec.tilt ?? 0));
      head.add(e.mesh);
    }
  }

  /** One painted eye (side +1 is the monster's left, at +X). */
  eye(spec: EyeSpec, side: 1 | -1): Eye {
    const open = this.tex(paintEye(spec, side, "open"));
    const shut = this.tex(paintEye(spec, side, "shut"));
    const hurt = this.tex(paintEye(spec, side, "hurt"));
    const g = this.geo(eyeGeometry());
    const m = new THREE.MeshStandardMaterial({
      map: open, roughness: 0.25, metalness: 0,
      emissive: 0xffffff, emissiveMap: open, emissiveIntensity: spec.glow ? 0.95 : 0.22,
    });
    this.mats.push(m);
    const mesh = new THREE.Mesh(g, m);
    const r = spec.size;
    mesh.scale.set(r, r * (spec.tall ?? 1.08), r * 0.42);
    const eye: Eye = { mesh, m, open, shut, hurt, glow: !!spec.glow };
    this.eyeList.push(eye);
    return eye;
  }

  tex(c: HTMLCanvasElement): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    this.textures.push(t);
    return t;
  }

  /** A soft glowing sprite (auras, sparks, wisp light). */
  glowSprite(color: number, size: number, opacity = 0.6, additive = true): THREE.Sprite {
    const tex = this.tex(radial(color));
    const m = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    (this.mats as THREE.Material[]).push(m);
    const s = new THREE.Sprite(m);
    s.scale.set(size, size, size);
    return s;
  }
}

/** A limb from y = 0 down to y = -len, rounded at both ends. */
export function roundBone(len: number, r1: number, r2: number, seg = 14): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r2 + 1e-4, -len + Math.sin(a) * r2));
  }
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r1 + 1e-4, Math.sin(a) * r1));
  }
  return new THREE.LatheGeometry(pts, seg);
}

// ---------- Eyes ----------

export interface EyeSpec {
  /** Eye radius (metres). */
  size: number;
  /** Iris colour. */
  iris: number;
  /** The colour of the skin or fur round the eye (the lid when it blinks). */
  lid: number;
  /** Whites round the iris (true) or a big dark animal eye (false). */
  white?: boolean;
  /** A slanted lid: this one wants to fight. */
  cross?: boolean;
  /** Glowing eyes (Blighted, wisps): they still have a pupil and shine, so they stay readable. */
  glow?: boolean;
  /** Where they sit on the head: how far apart (0.3 to 0.8) and how high (-0.3 to 0.5). */
  spread: number;
  up: number;
  /** Turn them to face more forward (0 to 1). */
  forward?: number;
  tilt?: number;
  /** Height / width. */
  tall?: number;
  /** Pupil size, 0 to 1. */
  pupil?: number;
}

export interface Eye {
  mesh: THREE.Mesh;
  m: THREE.MeshStandardMaterial;
  open: THREE.Texture;
  shut: THREE.Texture;
  hurt: THREE.Texture;
  glow: boolean;
}

/** A flattened ball whose front is mapped straight on (so a painted eye sits flat on it). */
function eyeGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 28, 18);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = z >= 0 ? 0.5 : 0.5 / Math.max(1e-3, Math.hypot(x, y)) ; // back half: the rim colour
    uv.setXY(i, 0.5 + x * k, 0.5 + y * k);
  }
  return g;
}

function paintEye(s: EyeSpec, side: 1 | -1, state: "open" | "shut" | "hurt"): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const lid = hex(s.lid);
  const rim = hex(shade(s.glow ? s.iris : 0x1b1416, s.glow ? 0.35 : 1));
  g.fillStyle = rim;
  g.fillRect(0, 0, 128, 128);
  if (state !== "open") {
    g.fillStyle = lid;
    g.beginPath();
    g.arc(64, 64, 64, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#1b1416";
    g.lineWidth = 9;
    g.lineCap = "round";
    g.beginPath();
    if (state === "shut") {
      g.moveTo(24, 58);
      g.quadraticCurveTo(64, 92, 104, 58);
    } else {
      // A squeezed-shut "> <".
      const d = side; // +1: the monster's left, on the viewer's right: "<"
      g.moveTo(64 + d * 30, 34);
      g.lineTo(64 - d * 26, 64);
      g.lineTo(64 + d * 30, 94);
    }
    g.stroke();
    return c;
  }
  const white = s.white !== false;
  // Whites.
  if (white) {
    g.fillStyle = "#fbfaf4";
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.fill();
  }
  // Iris (big for animals), centred a little toward the nose and down.
  const ir = white ? 40 : 56;
  const cx = 64 - side * (white ? 6 : 0), cy = white ? 70 : 66;
  const grd = g.createLinearGradient(0, cy - ir, 0, cy + ir);
  const irisCol = new THREE.Color(s.iris);
  grd.addColorStop(0, hex(shade(s.iris, s.glow ? 0.8 : 0.45)));
  grd.addColorStop(0.6, hex(s.iris));
  grd.addColorStop(1, hex(shade(s.iris, 1.35)));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(cx, cy, ir, 0, Math.PI * 2);
  g.fill();
  // Pupil.
  const pr = ir * (s.pupil ?? (white ? 0.55 : 0.6));
  g.fillStyle = s.glow ? hex(shade(irisCol.getHex(), 0.18)) : "#120d0e";
  g.beginPath();
  g.arc(cx, cy + 2, pr, 0, Math.PI * 2);
  g.fill();
  // Shine: one big, one small (always up-left, so both eyes match).
  g.fillStyle = "rgba(255,255,255,0.96)";
  g.beginPath();
  g.ellipse(cx - ir * 0.36, cy - ir * 0.38, ir * 0.3, ir * 0.26, -0.5, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(cx + ir * 0.34, cy + ir * 0.32, ir * 0.13, 0, Math.PI * 2);
  g.fill();
  // A cross lid: slanted down toward the nose.
  if (s.cross) {
    const inner = 64 - side * 64, outer = 64 + side * 64;
    g.fillStyle = lid;
    g.beginPath();
    g.moveTo(inner, -2);
    g.lineTo(inner, 54);
    g.lineTo(outer, 18);
    g.lineTo(outer, -2);
    g.closePath();
    g.fill();
    g.strokeStyle = "#1b1416";
    g.lineWidth = 8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(inner + side * 6, 52);
    g.lineTo(outer - side * 4, 18);
    g.stroke();
  }
  return c;
}

function radial(color: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const col = new THREE.Color(color);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `rgba(${rgb},1)`);
  grd.addColorStop(0.35, `rgba(${rgb},0.45)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

// ---------- The rig ----------

interface JointState { o: THREE.Object3D; r0: THREE.Euler; p0: THREE.Vector3; s0: THREE.Vector3; r: number[]; p: number[]; s: number[] }

/**
 * Joints remember their resting pose. Each frame an animation says how far to
 * turn, move or stretch each joint from rest; the rig then eases every joint
 * toward that, so switching animations blends smoothly.
 */
export class Rig {
  private list: JointState[] = [];
  private by = new Map<THREE.Object3D, JointState>();

  add(o: THREE.Object3D) {
    if (this.by.has(o)) return;
    const j: JointState = { o, r0: o.rotation.clone(), p0: o.position.clone(), s0: o.scale.clone(), r: [0, 0, 0], p: [0, 0, 0], s: [1, 1, 1] };
    this.list.push(j);
    this.by.set(o, j);
  }
  /** Note the joints' current pose as their rest (after building). */
  setRest() {
    for (const j of this.list) {
      j.r0.copy(j.o.rotation);
      j.p0.copy(j.o.position);
      j.s0.copy(j.o.scale);
    }
  }
  begin() {
    for (const j of this.list) {
      j.r[0] = j.r[1] = j.r[2] = 0;
      j.p[0] = j.p[1] = j.p[2] = 0;
      j.s[0] = j.s[1] = j.s[2] = 1;
    }
  }
  /** Turn a joint from rest (radians, added). */
  r(o: THREE.Object3D, x = 0, y = 0, z = 0) {
    const j = this.by.get(o);
    if (!j) return;
    j.r[0] += x;
    j.r[1] += y;
    j.r[2] += z;
  }
  /** Move a joint from rest (metres, added). */
  p(o: THREE.Object3D, x = 0, y = 0, z = 0) {
    const j = this.by.get(o);
    if (!j) return;
    j.p[0] += x;
    j.p[1] += y;
    j.p[2] += z;
  }
  /** Stretch a joint (multiplied). */
  s(o: THREE.Object3D, x = 1, y = x, z = x) {
    const j = this.by.get(o);
    if (!j) return;
    j.s[0] *= x;
    j.s[1] *= y;
    j.s[2] *= z;
  }
  /** Ease every joint toward its target (k = 1 snaps). */
  apply(k: number) {
    for (const j of this.list) {
      const o = j.o;
      o.rotation.x = lerp(o.rotation.x, j.r0.x + j.r[0], k);
      o.rotation.y = lerp(o.rotation.y, j.r0.y + j.r[1], k);
      o.rotation.z = lerp(o.rotation.z, j.r0.z + j.r[2], k);
      o.position.x = lerp(o.position.x, j.p0.x + j.p[0], k);
      o.position.y = lerp(o.position.y, j.p0.y + j.p[1], k);
      o.position.z = lerp(o.position.z, j.p0.z + j.p[2], k);
      o.scale.x = lerp(o.scale.x, j.s0.x * j.s[0], k);
      o.scale.y = lerp(o.scale.y, j.s0.y * j.s[1], k);
      o.scale.z = lerp(o.scale.z, j.s0.z * j.s[2], k);
    }
  }
}

// ---------- The animation player ----------

/** What an animation knows each frame. */
export interface PoseCtx {
  anim: Anim;
  /** Seconds since this animation started. */
  t: number;
  /** 0 to 1 through a one-shot animation (attack, hit, death); loops count seconds in t. */
  p: number;
  /** Seconds since the page opened (for idle breathing). */
  time: number;
  /** The loop the monster goes back to (idle or walk). */
  base: "idle" | "walk";
  rig: Rig;
}

export interface Body {
  /** Set this frame's targets on the rig. */
  pose(c: PoseCtx): void;
  /** How long each one-shot lasts (seconds). */
  durations?: Partial<Record<"attack" | "hit" | "death", number>>;
  /** Extra effects each frame (sparks, glow pulses, breath). */
  fx?(c: PoseCtx, dt: number): void;
  /** How quickly joints follow their targets (bigger is snappier). */
  follow?: number;
  /** Objects whose materials must not be copied (they're switched elsewhere). */
  keepMats?: Set<THREE.Material>;
  /** Called every frame after the pose (characters blink here). */
  after?(dt: number, time: number, c: PoseCtx): void;
  dispose?(): void;
}

const DEFAULT_DUR = { attack: 0.9, hit: 0.5, death: 1.0 };

/** Wrap a built monster so the gallery (and later the game) can play its animations. */
export function finish(kit: Kit, root: THREE.Group, body: Body, height: number): Monster {
  const object = new THREE.Group();
  object.add(root);
  kit.rig.setRest();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = m.castShadow !== false;
    }
  });
  // Every material this monster uses, for the red flash when it's hit.
  const flashMats = new Set<THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && !o.userData.noFlash &&(m as any).isMeshStandardMaterial && !(m.transparent && m.blending === THREE.AdditiveBlending)) flashMats.add(m);
  });
  const base = new Map<THREE.MeshStandardMaterial, { e: THREE.Color; i: number }>();
  for (const m of flashMats) base.set(m, { e: m.emissive.clone(), i: m.emissiveIntensity });

  const dur = { ...DEFAULT_DUR, ...body.durations };
  let anim: Anim = "idle";
  let baseAnim: "idle" | "walk" = "idle";
  let t = 0;
  let pop = 1; // grows back after a defeat
  let nextBlink = 1.5 + Math.random() * 2, blink = -1;
  let flashing = false;
  const ctx: PoseCtx = { anim, t: 0, p: 0, time: 0, base: baseAnim, rig: kit.rig };
  const flashCol = new THREE.Color(0xff7a66);

  function setEyes(state: "open" | "shut" | "hurt") {
    for (const e of kit.eyeList) {
      const tex = e[state];
      if (e.m.map !== tex) {
        e.m.map = tex;
        e.m.emissiveMap = tex;
        e.m.needsUpdate = true;
      }
    }
  }

  const monster: Monster = {
    object,
    height,
    get anim() {
      return anim;
    },
    play(a) {
      if (a === "idle" || a === "walk") baseAnim = a;
      if (anim === "death" && a !== "death") pop = Math.min(pop, 1);
      anim = a;
      t = 0;
    },
    update(dt, time) {
      t += dt;
      // One-shots end on their own.
      if ((anim === "attack" || anim === "hit") && t >= dur[anim]) {
        anim = baseAnim;
        t = 0;
      }
      if (anim === "death" && t >= dur.death + 2.2) {
        // Gone for a moment, then it comes back (like a respawn).
        anim = baseAnim;
        t = 0;
        pop = 0;
        kit.rig.begin();
        kit.rig.apply(1);
      }
      ctx.anim = anim;
      ctx.t = t;
      ctx.time = time;
      ctx.base = baseAnim;
      ctx.p = anim === "attack" || anim === "hit" || anim === "death" ? clamp01(t / dur[anim]) : t;
      kit.rig.begin();
      body.pose(ctx);
      const k = 1 - Math.exp(-dt * (body.follow ?? 16));
      kit.rig.apply(anim === "death" && t > dur.death ? Math.max(k, 0.2) : k);
      body.fx?.(ctx, dt);

      // Shrink away at the end of a defeat, and pop back in after.
      let sc = 1;
      if (anim === "death") sc = 1 - ease(t, dur.death + 1.6, dur.death + 2.2);
      else if (pop < 1) {
        pop = Math.min(1, pop + dt / 0.45);
        sc = pop < 1 ? Math.sin(pop * Math.PI * 0.5) * (1 + 0.12 * Math.sin(pop * Math.PI)) : 1;
      }
      object.scale.setScalar(Math.max(0.001, sc));

      // Eyes: blink, squeeze shut when hit, close when defeated.
      if (time > nextBlink) {
        blink = 0;
        nextBlink = time + 2.2 + Math.random() * 3;
      }
      let eyes: "open" | "shut" | "hurt" = "open";
      if (blink >= 0) {
        blink += dt;
        if (blink < 0.16) eyes = "shut";
        else blink = -1;
      }
      if (anim === "hit" && ctx.p < 0.75) eyes = "hurt";
      if (anim === "death") eyes = ctx.p < 0.35 ? "hurt" : "shut";
      setEyes(eyes);

      // A quick red flash when hit.
      const f = anim === "hit" ? Math.max(0, 1 - t / 0.28) : 0;
      if (f > 0 || flashing) {
        for (const [m, b] of base) {
          m.emissive.copy(b.e).lerp(flashCol, f);
          m.emissiveIntensity = Math.max(b.i, f * 0.5);
        }
        flashing = f > 0;
      }
      body.after?.(dt, time, ctx);
    },
    dispose() {
      body.dispose?.();
      for (const g of kit.geos) g.dispose();
      for (const m of kit.mats) m.dispose();
      for (const t of kit.textures) t.dispose();
    },
  };
  monster.update(0, 0);
  kit.rig.apply(1);
  return monster;
}
