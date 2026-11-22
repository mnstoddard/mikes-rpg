// The Weapon Gallery: look at each weapon in 3D, try its designs, metals and
// woods, watch a character swing it at a training dummy, and approve it (or
// ask for changes) before it goes into the game.
//
// Built into one HTML file by:  node build-gallery.mjs weapon
// Reviews are saved with the page's shared database when it runs as a claude.ai artifact.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { METAL_DAMAGE, WEAPONS } from "../../../shared/gear";
import { MATERIALS, Material, Wood } from "../../../shared/tools";
import { ARROW_LEVEL, WOOD_DAMAGE, WOOD_LEVEL } from "../../../shared/handicraft";
import { GEMS, GEM_IDS, GemId } from "../../../shared/jewelry";
import {
  METAL_LOOKS, WEAPON_KINDS, WEAPON_METALS, WEAPON_MODELS, WEAPON_WOODS, WOOD_LOOKS,
  AttackMove, Hold, ReviewStatus, WeaponBuild, WeaponKind, WeaponMetal, WeaponOptions, WeaponWood, GEM_COLORS,
  createWeapon, holdOf, moveOf,
} from "../weapons";
import { makeRng } from "../trees/common";
import { Attack, Rig, applyPose, attackFor, idlePose, makeHero, poseAt } from "./hero";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------

interface Review {
  status: ReviewStatus;
  note: string;
  variant?: number;
  metal?: WeaponMetal;
  wood?: WeaponWood;
  gem?: GemId | null;
  updatedAt?: number;
}

type Mode = "hand" | "close" | "all";
let current: WeaponKind = (location.hash.slice(1) as WeaponKind) in WEAPON_MODELS ? (location.hash.slice(1) as WeaponKind) : "sword";
const optsOf: Record<string, WeaponOptions> = {};
let mode: Mode = "hand";
let timeOfDay: "day" | "sunset" | "night" = "day";
let showPerson = true;
let slow = false;
const reviews: Record<string, Review> = {};
let saveReview: ((kind: WeaponKind, r: Review) => Promise<void>) | null = null;

for (const k of WEAPON_KINDS) {
  const m = WEAPON_MODELS[k];
  optsOf[k] = { variant: 0, metal: m.uses.metal ? "iron" : "stone", wood: k === "bow" || k === "staff" ? "yew" : "oak", gem: null };
}

// ---------- Scene ----------

const canvas = $<HTMLCanvasElement>("cv");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
// A soft room of light for metal to reflect, so steel looks like steel.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 300);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 0.6;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.49;
canvas.addEventListener("pointerdown", () => (controls.autoRotate = false));

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5b6b3a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
// A lantern by the hero, lit at night.
const lantern = new THREE.PointLight(0xffb565, 0, 9, 1.6);
lantern.position.set(-1.2, 2.0, 1.2);
scene.add(lantern);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const skyCanvas = document.createElement("canvas");
skyCanvas.width = 4;
skyCanvas.height = 256;
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
function paintSky(top: string, mid: string, low: string) {
  const g = skyCanvas.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, low);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  skyTex.needsUpdate = true;
}

// The ground: a low-poly grassy island floating in the sky (like the Tree Gallery).
const island = new THREE.Group();
scene.add(island);
const flat = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 });
function buildIsland(halfX: number, halfZ: number, cx = 0, cz = 0) {
  island.clear();
  island.position.set(cx, 0, cz);
  const rng = makeRng(99);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 16, 1), flat(0x7fb24a));
  grass.scale.set(halfX, 1, halfZ);
  grass.position.y = -0.25;
  grass.receiveShadow = true;
  island.add(grass);
  const dirt = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 16, 1), flat(0x8a6a48));
  dirt.rotation.x = Math.PI;
  dirt.scale.set(halfX * 0.97, 2.4, halfZ * 0.96);
  dirt.position.y = -1.7;
  island.add(dirt);
  for (let i = 0; i < 30 + halfX * 4; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.45 + rng() * 0.5;
    const isRock = rng() < 0.35;
    const m = isRock
      ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + rng() * 0.1, 0), flat(0x9a9a92))
      : new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22 + rng() * 0.15, 3), flat(rng() < 0.5 ? 0x6a9e3c : 0x8cc055));
    m.position.set(Math.cos(a) * r * (halfX - 0.4), isRock ? 0.03 : 0.09, Math.sin(a) * r * (halfZ - 0.4));
    m.rotation.y = rng() * 6;
    m.castShadow = true;
    island.add(m);
  }
}

// ---------- The training dummy ----------

function makeDummy() {
  const g = new THREE.Group();
  const wood = flat(0x8a6240);
  const straw = flat(0xd8b85a);
  const sack = flat(0xcdb48a);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 6), wood);
  post.position.y = 0.65;
  const body = new THREE.Group();
  body.position.y = 0.25;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.75, 8), straw);
  torso.position.y = 1.0;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.07), wood);
  bar.position.y = 1.25;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), sack);
  head.position.y = 1.55;
  for (const s of [-1, 1]) {
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 4, 10), flat(0x7a5a38));
    tie.rotation.x = Math.PI / 2;
    tie.position.y = 1.0 + s * 0.25;
    body.add(tie);
  }
  // A painted target on the chest.
  const ring = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), flat(0xc8473a));
  ring.position.set(0, 1.02, -0.18);
  ring.rotation.y = Math.PI;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), flat(0xf3ead8));
  dot.position.set(0, 1.02, -0.185);
  dot.rotation.y = Math.PI;
  body.add(torso, bar, head, ring, dot);
  body.position.y = -0.25;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 8), flat(0x7d7a72));
  base.position.y = 0.06;
  g.add(post, body, base);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = (o as THREE.Mesh).receiveShadow = true));
  return { object: g, body, chest: new THREE.Vector3(0, 1.02, 0) };
}
const dummy = makeDummy();
scene.add(dummy.object);
let wobble = 0;
let wobbleV = 0;

// ---------- The hero ----------

const hero: Rig = makeHero();
scene.add(hero.object);

// ---------- Weapons on show ----------

interface Shown {
  kind: WeaponKind;
  build: WeaponBuild;
  holder: THREE.Group;
}
let shown: Shown[] = [];
/** The weapon in the hero's hand. */
let inHand: { build: WeaponBuild; mount: THREE.Group; hand: THREE.Object3D; move: AttackMove; hold: Hold } | null = null;
let attack: { a: Attack; t: number; fired: boolean } | null = null;
let restPose = idlePose("slash", "right");

function disposeTree(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}

function clearShown() {
  for (const s of shown) {
    s.holder.parent?.remove(s.holder);
    disposeTree(s.holder);
  }
  shown = [];
  if (inHand) {
    inHand.hand.remove(inHand.mount);
    disposeTree(inHand.mount);
    inHand = null;
  }
  attack = null;
  clearProjectiles();
  trail.reset();
}

/** How far the dummy stands: in reach for melee, further for ranged. */
function dummyDistance(kind: WeaponKind, variant: number): number {
  const move = moveOf(kind, variant);
  if (move === "shoot" || move === "cast" || move === "sling") return 6;
  if (move === "throw") return 4.5;
  const reach: Partial<Record<WeaponKind, number>> = { dagger: 0.95, goblin_dagger: 0.95, sword: 1.35, mace: 1.2, spear: 2.25, greatsword: 1.75, severing_blade: 1.4, warden: 1.35, lightforged: 1.3 };
  return reach[kind] ?? 1.3;
}

function rebuild(keepCamera = false) {
  clearShown();
  const o = optsOf[current];
  if (mode === "hand") {
    const build = createWeapon(current, o);
    const move = moveOf(current, o.variant);
    const hold = holdOf(current, o.variant);
    const hand = hold === "left" ? hero.handL : hero.handR;
    const mount = new THREE.Group();
    // The hand's +Y runs up the forearm; turn the weapon so it points out past the fingers.
    // A sling hangs straight down from the hand instead.
    mount.rotation.x = move === "sling" ? 0 : Math.PI / 2;
    // Turn blades so their flat side faces out to the side (the camera sees the blade, not its edge).
    const inner = new THREE.Group();
    if (move !== "shoot" && move !== "sling") inner.rotation.y = Math.PI / 2;
    inner.add(build.held ?? build.object);
    mount.add(inner);
    hand.add(mount);
    inHand = { build, mount, hand, move, hold };
    restPose = idlePose(move, hold);
    applyPose(hero, restPose);
    hero.object.visible = true;
    hero.object.position.set(0, 0, 0);
    hero.object.rotation.y = 0;
    const d = dummyDistance(current, o.variant);
    dummy.object.visible = true;
    dummy.object.position.set(0, 0, d);
    dummy.object.rotation.y = 0;
    buildIsland(Math.max(2.6, d * 0.45 + 1.6), Math.max(2.8, d * 0.5 + 2.2), 0, d / 2);
    if (!keepCamera) {
      if (d > 3) frame(new THREE.Vector3(0, 1.0, d * 0.4), d * 0.9 + 2.4, new THREE.Vector3(-0.85, 0.35, -0.7));
      else frame(new THREE.Vector3(0, 1.05, d / 2 + 0.1), Math.max(4.6, d * 1.25 + 2.5), new THREE.Vector3(-0.95, 0.3, 0.35));
    }
  } else if (mode === "close") {
    const build = createWeapon(current, o);
    const holder = new THREE.Group();
    holder.add(build.object);
    // Lie it on its side, turning slowly, at chest height.
    const box = new THREE.Box3().setFromObject(build.object);
    const centre = box.getCenter(new THREE.Vector3());
    build.object.position.sub(centre);
    holder.position.set(0, 1.25, 0);
    holder.rotation.z = Math.PI / 2 - 0.35;
    const spin = new THREE.Group();
    spin.add(holder);
    scene.add(spin);
    shown.push({ kind: current, build, holder: spin });
    hero.object.visible = showPerson;
    hero.object.position.set(-Math.max(1.1, build.length * 0.5 + 0.9), 0, -0.9);
    hero.object.rotation.y = 0.5;
    applyPose(hero, idlePose("slash", "right"));
    dummy.object.visible = false;
    buildIsland(2.6, 2.4);
    const dist = Math.max(1.6, build.length * 1.55 + 0.6);
    if (!keepCamera) frame(new THREE.Vector3(0, 1.2, 0), dist, new THREE.Vector3(0.15, 0.22, 1));
  } else {
    // Every weapon standing in a row, on its butt, the tallest at the back.
    const kinds = WEAPON_KINDS;
    const gap = 0.62;
    const n = kinds.length;
    kinds.forEach((k, i) => {
      const build = createWeapon(k, optsOf[k]);
      const holder = new THREE.Group();
      holder.add(build.object);
      const box = new THREE.Box3().setFromObject(build.object);
      build.object.position.y = -box.min.y + 0.02;
      build.object.position.x = -(box.min.x + box.max.x) / 2;
      const x = (i - (n - 1) / 2) * gap;
      holder.position.set(x, 0, 0);
      holder.rotation.y = 0.5;
      scene.add(holder);
      shown.push({ kind: k, build, holder });
    });
    hero.object.visible = showPerson;
    hero.object.position.set(-((n - 1) / 2) * gap - 0.9, 0, 0.2);
    hero.object.rotation.y = 0.35;
    applyPose(hero, idlePose("slash", "right"));
    dummy.object.visible = false;
    buildIsland((n * gap) / 2 + 1.6, 1.8);
    if (!keepCamera) {
      const halfWidth = (n * gap) / 2 + 0.7;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      frame(new THREE.Vector3(-0.3, 0.8, 0), Math.max(4, halfWidth / tanHalf), new THREE.Vector3(0.0, 0.12, 1));
    }
  }
  if (mode !== "hand" && !showPerson) hero.object.visible = false;
  sun.target.position.copy(controls.target);
  updateHud();
}

function frame(target: THREE.Vector3, dist: number, dir: THREE.Vector3) {
  controls.target.copy(target);
  camera.position.copy(target).addScaledVector(dir.normalize(), dist);
}

// ---------- Attacks: trail, projectiles, hits ----------

/** A fading ribbon behind the weapon's tip while it swings. */
const trail = (() => {
  const N = 18;
  const pos = new Float32Array(N * 2 * 3);
  const col = new Float32Array(N * 2 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const idx: number[] = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  const samples: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
  let tint = new THREE.Color(0xffffff);
  return {
    reset() {
      samples.length = 0;
      mesh.visible = false;
    },
    setColor(c: number) {
      tint = new THREE.Color(c);
    },
    push(a: THREE.Vector3, b: THREE.Vector3) {
      samples.unshift({ a: a.clone(), b: b.clone() });
      if (samples.length > N) samples.pop();
    },
    fade() {
      if (samples.length) samples.pop();
    },
    draw() {
      mesh.visible = samples.length > 1;
      for (let i = 0; i < N; i++) {
        const s = samples[Math.min(i, samples.length - 1)];
        if (!s) break;
        s.a.toArray(pos, i * 6);
        s.b.toArray(pos, i * 6 + 3);
        const f = samples.length > 1 ? Math.max(0, 1 - i / (samples.length - 1)) * 0.55 : 0;
        for (let k = 0; k < 2; k++) {
          col[i * 6 + k * 3] = tint.r * f;
          col[i * 6 + k * 3 + 1] = tint.g * f;
          col[i * 6 + k * 3 + 2] = tint.b * f;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
})();

interface Flying {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  time: number;
  arc: number;
  spin: boolean;
  stick: boolean;
  stuck?: number;
  sparkColor: number;
}
let flying: Flying[] = [];
interface Spark { m: THREE.Mesh; v: THREE.Vector3; life: number }
let sparks: Spark[] = [];

function clearProjectiles() {
  for (const f of flying) scene.remove(f.obj);
  for (const s of sparks) scene.remove(s.m);
  flying = [];
  sparks = [];
}

function burst(at: THREE.Vector3, color: number, n = 10) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.025 + Math.random() * 0.02), m);
    s.position.copy(at);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.1, Math.random() - 0.9).normalize().multiplyScalar(1.5 + Math.random() * 2);
    scene.add(s);
    sparks.push({ m: s, v, life: 0.45 + Math.random() * 0.25 });
  }
}

function hitDummy(at: THREE.Vector3, color = 0xfff1c0) {
  wobbleV += 3.2;
  burst(at, color);
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

function weaponTipWorld(out: THREE.Vector3, frac = 1) {
  if (!inHand) return out.set(0, 1, 0);
  const tip = inHand.build.tip;
  return (inHand.build.held ?? inHand.build.object).localToWorld(out.set(tip.x * frac, tip.y * frac, tip.z * frac));
}

function launch() {
  if (!inHand?.build.projectile) return;
  const obj = inHand.build.projectile();
  const move = inHand.move;
  const from = weaponTipWorld(new THREE.Vector3());
  if (move === "shoot") from.copy(inHand.hand.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0.02, 0.2));
  const to = dummy.object.position.clone().add(dummy.chest).add(new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.15, -0.2));
  const dist = from.distanceTo(to);
  const speed = move === "shoot" ? 22 : move === "cast" ? 9 : move === "sling" ? 14 : 11;
  obj.position.copy(from);
  scene.add(obj);
  flying.push({
    obj, from, to, t: 0, time: dist / speed, arc: move === "throw" || move === "sling" ? dist * 0.06 : move === "shoot" ? dist * 0.02 : 0,
    spin: move === "sling", stick: move === "shoot" || move === "throw", sparkColor: inHand.build.boltColor ?? 0xfff1c0,
  });
}

function startAttack() {
  if (!inHand || attack) return;
  attack = { a: attackFor(inHand.move, inHand.hold), t: 0, fired: false };
  const metal = optsOf[current].metal;
  trail.setColor(current === "severing_blade" ? 0xffe39a : current === "lightforged" ? 0xfff0c0 : metal === "mithril" ? 0x9ad8ff : metal === "aurelite" ? 0xffd36a : 0xe6eef5);
  trail.reset();
}

function updateAttack(dt: number) {
  if (!inHand) return;
  if (!attack) {
    trail.fade();
    trail.draw();
    return;
  }
  attack.t += dt / attack.a.duration;
  const p = Math.min(1, attack.t);
  const pose = poseAt(attack.a, p);
  applyPose(hero, pose);
  inHand.build.draw?.(pose.draw);
  hero.object.updateMatrixWorld(true);
  if (attack.a.trail && p > 0.2 && p < 0.75) {
    weaponTipWorld(tmpA, 1);
    weaponTipWorld(tmpB, 0.55);
    trail.push(tmpA, tmpB);
  } else trail.fade();
  trail.draw();
  if (!attack.fired && p >= attack.a.hitAt) {
    attack.fired = true;
    if (inHand.build.projectile && inHand.move !== "slash" && inHand.move !== "stab" && inHand.move !== "smash" && inHand.move !== "sweep") launch();
    else hitDummy(weaponTipWorld(new THREE.Vector3(), 0.85));
  }
  if (p >= 1) {
    attack = null;
    applyPose(hero, restPose);
    inHand.build.draw?.(0);
  }
}

function updateFlying(dt: number) {
  for (const f of flying) {
    if (f.stuck !== undefined) {
      f.stuck += dt;
      if (f.stuck > 1.6) f.obj.visible = false;
      continue;
    }
    f.t += dt / f.time;
    const t = Math.min(1, f.t);
    const prev = f.obj.position.clone();
    f.obj.position.lerpVectors(f.from, f.to, t);
    f.obj.position.y += Math.sin(t * Math.PI) * f.arc;
    const dir = f.obj.position.clone().sub(prev);
    if (f.spin) f.obj.rotation.x += dt * 20;
    else if (dir.lengthSq() > 1e-8) f.obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    if (t >= 1) {
      hitDummy(f.obj.position, f.sparkColor);
      if (f.stick) {
        f.stuck = 0;
        // Sink the point into the straw.
        f.obj.position.add(dir.multiplyScalar(0.08));
      } else f.obj.visible = false;
    }
  }
  flying = flying.filter((f) => {
    if (f.obj.visible) return true;
    scene.remove(f.obj);
    return false;
  });
  for (const s of sparks) {
    s.life -= dt;
    s.v.y -= 6 * dt;
    s.m.position.addScaledVector(s.v, dt);
    s.m.rotation.x += dt * 8;
  }
  sparks = sparks.filter((s) => {
    if (s.life > 0) return true;
    scene.remove(s.m);
    s.m.geometry.dispose();
    return false;
  });
  // The dummy rocks back and settles.
  wobbleV += (-wobble * 40 - wobbleV * 5) * dt;
  wobble += wobbleV * dt;
  dummy.body.rotation.x = wobble * 0.12;
}

// ---------- Time of day ----------

const SKIES = {
  day: { top: "#8fc9ec", mid: "#cfe6ef", low: "#f4e7c9", hemi: [0xcfe8ff, 0x5b6b3a, 1.0], sun: [0xfff1d6, 2.3], pos: [6, 10, 7], exposure: 1.0, bloom: 0.22, env: 0.55, lamp: 0 },
  sunset: { top: "#6d7fb8", mid: "#e9a07a", low: "#f6c98a", hemi: [0xffd2b0, 0x5a4a48, 0.95], sun: [0xffa060, 2.3], pos: [-9, 4, 6], exposure: 1.0, bloom: 0.4, env: 0.45, lamp: 0 },
  night: { top: "#0b1430", mid: "#1b2950", low: "#2b3a5e", hemi: [0x5a6fae, 0x141824, 0.4], sun: [0xa9c1ff, 0.5], pos: [-5, 10, -6], exposure: 1.15, bloom: 0.95, env: 0.12, lamp: 5 },
} as const;

function applyTime() {
  const s = SKIES[timeOfDay];
  paintSky(s.top, s.mid, s.low);
  hemi.color.setHex(s.hemi[0]);
  hemi.groundColor.setHex(s.hemi[1]);
  hemi.intensity = s.hemi[2];
  sun.color.setHex(s.sun[0]);
  sun.intensity = s.sun[1];
  sun.position.set(s.pos[0], s.pos[1], s.pos[2]).add(controls.target);
  renderer.toneMappingExposure = s.exposure;
  bloom.strength = s.bloom;
  scene.environmentIntensity = s.env;
  lantern.intensity = s.lamp;
  document.querySelectorAll<HTMLButtonElement>("#time button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.time === timeOfDay)));
}

// ---------- Loop ----------

const clock = new THREE.Clock();
function resize() {
  const r = canvas.parentElement!.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  composer.setSize(r.width, r.height);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement!);
resize();

function loop() {
  const realDt = Math.min(0.05, clock.getDelta());
  const dt = realDt * (slow ? 0.25 : 1);
  const t = clock.elapsedTime;
  hero.character.update(realDt, t);
  updateAttack(dt);
  updateFlying(dt);
  if (mode === "close") for (const s of shown) s.holder.rotation.y += realDt * 0.5;
  // Keep the lantern by the hero.
  lantern.position.copy(hero.object.position).add(new THREE.Vector3(-1.1, 2.0, 0.9));
  controls.update();
  composer.render();
  requestAnimationFrame(loop);
}

// ---------- Stats ----------

const STYLE_NAMES = { melee: "Melee", ranged: "Ranged", magic: "Magic" } as const;

function statRows(k: WeaponKind, o: WeaponOptions): [string, string][] {
  const m = WEAPON_MODELS[k];
  if (!m.inGame || !m.game) {
    return [
      ["In the game", "Not yet (story reward)"],
      ["Fights like", m.game ? WEAPONS[m.game].name : "-"],
      ["Design", m.variants[o.variant]],
    ];
  }
  const def = WEAPONS[m.game];
  const planned = METAL_LOOKS[o.metal].planned || WOOD_LOOKS[o.wood].planned;
  const rows: [string, string][] = [[`${STYLE_NAMES[def.style]} level`, String(def.level)]];
  if (k === "arrows") {
    const tip = o.metal as Material;
    rows.push(["Handicraft level", planned ? "Planned" : String(ARROW_LEVEL[tip])]);
    rows.push(["Adds to a bow's hit", planned ? "Planned" : `+${METAL_DAMAGE[tip]}`]);
    return rows;
  }
  const wooden = k === "bow" || k === "staff";
  if (wooden) rows.push(["Handicraft level", planned ? "Planned" : String(WOOD_LEVEL[o.wood as Wood])]);
  else rows.push(["Smithing level", METAL_LOOKS[o.metal].planned ? "Planned" : String(MATERIALS[o.metal as Material].level)]);
  if (k === "staff") rows.push(["Spells hit harder by", planned ? "Planned" : `+${WOOD_DAMAGE[o.wood as Wood]}`]);
  else {
    const extra = wooden ? WOOD_DAMAGE[o.wood as Wood] : METAL_DAMAGE[o.metal as Material];
    rows.push(["Biggest hit", planned ? "Planned" : `${def.maxHit + extra}${k === "bow" ? " + the arrow's tip" : ""}`]);
  }
  rows.push(["Attacks every", `${(def.speed * 0.6).toFixed(1)} s`]);
  rows.push(["Reach", def.range === 1 ? "Next to it" : `${def.range} tiles`]);
  rows.push(["Hands", def.twoHanded ? "Two (no shield)" : "One"]);
  if (k === "staff" && o.gem) rows.push(["Enchanted with", `${GEMS[o.gem].name} (${GEM_EFFECT[o.gem]})`]);
  return rows;
}
const GEM_EFFECT: Record<GemId, string> = { ruby: "fire", sapphire: "frost", emerald: "poison", topaz: "lightning", amethyst: "life steal" };

// ---------- UI ----------

const STATUS_LABEL: Record<ReviewStatus, string> = { waiting: "Waiting for you", approved: "Approved", changes: "Needs changes" };
const MOVE_LABEL: Record<AttackMove, string> = { slash: "Swing", stab: "Stab", smash: "Smash", sweep: "Sweep", throw: "Throw", sling: "Sling", shoot: "Shoot", cast: "Cast" };

const reviewOf = (k: WeaponKind): Review => reviews[k] ?? { status: "waiting", note: "" };
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

function swatchColor(k: WeaponKind): number {
  const o = optsOf[k];
  const m = WEAPON_MODELS[k];
  if (k === "severing_blade") return 0x9fd6f5;
  if (k === "lightforged") return 0xf6e2a8;
  if (k === "warden") return 0x3f6b3a;
  if (k === "goblin_dagger") return 0x8a4a2a;
  if (k === "staff" && o.gem) return GEM_COLORS[o.gem];
  return m.uses.metal ? METAL_LOOKS[o.metal].color : WOOD_LOOKS[o.wood].color;
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";
  const groups: [string, WeaponKind[]][] = [
    ["In the game", WEAPON_KINDS.filter((k) => WEAPON_MODELS[k].inGame)],
    ["From the story (planned)", WEAPON_KINDS.filter((k) => !WEAPON_MODELS[k].inGame)],
  ];
  for (const [title, kinds] of groups) {
    const h = document.createElement("p");
    h.className = "label group";
    h.textContent = title;
    list.appendChild(h);
    for (const k of kinds) {
      const t = WEAPON_MODELS[k];
      const r = reviewOf(k);
      const b = document.createElement("button");
      b.className = "tree-row";
      b.setAttribute("aria-current", String(k === current));
      b.innerHTML = `<span class="swatch" style="--c:${hex(swatchColor(k))}"></span><span class="tr-name"></span><span class="tr-meta"></span><span class="pill" data-s="${r.status}"></span>`;
      b.querySelector(".tr-name")!.textContent = t.name;
      const def = t.game ? WEAPONS[t.game] : null;
      b.querySelector(".tr-meta")!.textContent = t.inGame && def ? `${STYLE_NAMES[def.style]} ${def.level} · ${t.variants.length} designs` : `${t.variants.length} designs`;
      b.querySelector(".pill")!.textContent = r.status === "waiting" ? "To review" : STATUS_LABEL[r.status];
      b.onclick = () => select(k);
      list.appendChild(b);
    }
  }
  const approved = WEAPON_KINDS.filter((k) => reviewOf(k).status === "approved").length;
  $("tally").textContent = `${approved} of ${WEAPON_KINDS.length} approved`;
  $("tally-bar").style.setProperty("--p", String(approved / WEAPON_KINDS.length));
}

function chips<T extends string | number | null>(el: HTMLElement, items: { v: T; label: string; color?: number; planned?: boolean }[], selected: T, onPick: (v: T) => void) {
  el.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button";
    if (it.color !== undefined) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.setProperty("--c", hex(it.color));
      b.appendChild(dot);
    }
    b.append(it.label);
    if (it.planned) {
      const p = document.createElement("small");
      p.textContent = "planned";
      b.appendChild(p);
    }
    b.setAttribute("aria-pressed", String(it.v === selected));
    b.onclick = () => onPick(it.v);
    el.appendChild(b);
  }
}

function renderDetail() {
  const t = WEAPON_MODELS[current];
  const o = optsOf[current];
  $("d-name").textContent = t.name;
  $("d-about").textContent = t.about;
  $("d-from").textContent = t.from;
  const stats = $("d-stats");
  stats.innerHTML = "";
  for (const [k, v] of statRows(current, o)) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    stats.append(dt, dd);
  }
  const pick = (change: Partial<WeaponOptions>) => {
    Object.assign(optsOf[current], change);
    rebuild(true);
    renderDetail();
    renderList();
  };
  chips($("d-variants"), t.variants.map((name, i) => ({ v: i, label: name })), o.variant, (v) => pick({ variant: v }));
  $("f-metal").hidden = !t.uses.metal;
  $("f-metal-label").textContent = current === "arrows" ? "Tip" : current === "sling" ? "Shot" : "Metal";
  if (t.uses.metal) chips($("d-metal"), WEAPON_METALS.map((m) => ({ v: m, label: METAL_LOOKS[m].name, color: METAL_LOOKS[m].color, planned: METAL_LOOKS[m].planned })), o.metal, (v) => pick({ metal: v }));
  $("f-wood").hidden = !t.uses.wood;
  $("f-wood-label").textContent = current === "bow" || current === "staff" ? "Wood" : "Handle";
  if (t.uses.wood) chips($("d-wood"), WEAPON_WOODS.map((w) => ({ v: w, label: WOOD_LOOKS[w].name, color: WOOD_LOOKS[w].color, planned: WOOD_LOOKS[w].planned })), o.wood, (v) => pick({ wood: v }));
  $("f-gem").hidden = !t.uses.gem;
  if (t.uses.gem) chips<GemId | null>($("d-gem"), [{ v: null, label: "Plain" }, ...GEM_IDS.map((g) => ({ v: g, label: GEMS[g].name, color: GEM_COLORS[g] }))], o.gem, (v) => pick({ gem: v }));
  const r = reviewOf(current);
  document.querySelectorAll<HTMLButtonElement>("#verdict button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === r.status)));
  const note = $<HTMLTextAreaElement>("note");
  if (document.activeElement !== note) note.value = r.note ?? "";
  $("saved").textContent = r.updatedAt ? `Saved ${new Date(r.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
}

function updateHud() {
  const t = WEAPON_MODELS[current];
  const o = optsOf[current];
  const parts = [t.variants[o.variant]];
  if (t.uses.metal) parts.push(METAL_LOOKS[o.metal].name);
  if (t.uses.wood) parts.push(WOOD_LOOKS[o.wood].name);
  if (t.uses.gem && o.gem) parts.push(GEMS[o.gem].name);
  $("np-name").textContent = mode === "all" ? "Every weapon, side by side" : `${t.name} · ${parts.join(" · ")}`;
  const btn = $<HTMLButtonElement>("attack");
  btn.querySelector("span")!.textContent = mode === "hand" ? MOVE_LABEL[moveOf(current, o.variant)] : "Try it in hand";
  document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
}

function select(k: WeaponKind) {
  current = k;
  if (location.hash.slice(1) !== k) history.replaceState(null, "", `#${k}`);
  if (mode === "all") {
    const s = shown.find((x) => x.kind === k);
    if (s) {
      controls.target.set(s.holder.position.x, 0.9, 0);
      camera.position.set(s.holder.position.x + 0.6, 1.5, 3.2);
    }
  } else rebuild();
  renderList();
  renderDetail();
  updateHud();
}

$("attack").onclick = () => {
  if (mode !== "hand") {
    mode = "hand";
    rebuild();
    return;
  }
  startAttack();
};
$<HTMLInputElement>("person").onchange = (e) => {
  showPerson = (e.target as HTMLInputElement).checked;
  if (mode !== "hand") hero.object.visible = showPerson;
};
$<HTMLInputElement>("slow").onchange = (e) => {
  slow = (e.target as HTMLInputElement).checked;
};
document.querySelectorAll<HTMLButtonElement>("#time button").forEach((b) => {
  b.onclick = () => {
    timeOfDay = b.dataset.time as typeof timeOfDay;
    applyTime();
  };
});
document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => {
  b.onclick = () => {
    mode = b.dataset.mode as Mode;
    rebuild();
    applyTime();
  };
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && (e.target as HTMLElement).tagName !== "TEXTAREA" && (e.target as HTMLElement).tagName !== "BUTTON") {
    e.preventDefault();
    if (mode === "hand") startAttack();
  }
});

// Click a weapon in the side-by-side view to pick it; click the stage in hand view to attack.
const ray = new THREE.Raycaster();
let downAt = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener("pointerup", (e) => {
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  if (mode === "hand") return startAttack();
  if (mode !== "all") return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hits = ray.intersectObjects(shown.map((s) => s.holder), true);
  if (!hits.length) return;
  let ob: THREE.Object3D | null = hits[0].object;
  while (ob && !shown.some((s) => s.holder === ob)) ob = ob.parent;
  const s = shown.find((x) => x.holder === ob);
  if (s) select(s.kind);
});

// Reviews.
async function setVerdict(status: ReviewStatus) {
  const note = $<HTMLTextAreaElement>("note").value.trim();
  const o = optsOf[current];
  const r: Review = { status, note, variant: o.variant, metal: o.metal, wood: o.wood, gem: o.gem, updatedAt: Date.now() };
  reviews[current] = r;
  renderList();
  renderDetail();
  if (!saveReview) {
    $("saved").textContent = "Can't save here: open this page on claude.ai to keep reviews.";
    return;
  }
  $("saved").textContent = "Saving…";
  try {
    await saveReview(current, r);
    $("saved").textContent = "Saved";
  } catch (err: any) {
    $("saved").textContent = err?.code === "not_granted" || err?.code === "permission_denied" ? "You can look, but only Mike can save reviews." : "Couldn't save. Try again in a moment.";
  }
}
document.querySelectorAll<HTMLButtonElement>("#verdict button").forEach((b) => {
  b.onclick = () => setVerdict(b.dataset.s as ReviewStatus);
});
$("save-note").onclick = () => setVerdict(reviewOf(current).status);

window.addEventListener("hashchange", () => {
  const k = location.hash.slice(1) as WeaponKind;
  if (k in WEAPON_MODELS && k !== current) select(k);
});

async function connectDb() {
  const c = (window as any).claude;
  if (!c?.use) {
    $("saved").textContent = "";
    return;
  }
  const timer = setTimeout(() => ($("db-note").hidden = false), 10000);
  const db = await c.use("db");
  if (!db) {
    clearTimeout(timer);
    $("db-note").hidden = false;
    return;
  }
  saveReview = (kind, r) => db.doc(`reviews/${kind}`).set(r as unknown as Record<string, unknown>);
  let first = true;
  db.collection("reviews").onSnapshot(
    (snap: any) => {
      clearTimeout(timer);
      $("db-note").hidden = true;
      for (const d of snap.docs) {
        const data = d.data() as Review;
        if (!data || !(d.id in WEAPON_MODELS)) continue;
        reviews[d.id] = data;
        // Open each weapon the way Mike last reviewed it.
        if (first) {
          const o = optsOf[d.id];
          if (typeof data.variant === "number") o.variant = data.variant;
          if (data.metal && data.metal in METAL_LOOKS) o.metal = data.metal;
          if (data.wood && data.wood in WOOD_LOOKS) o.wood = data.wood;
          if (data.gem === null || (data.gem && data.gem in GEMS)) o.gem = data.gem ?? null;
        }
      }
      if (first) rebuild(true);
      first = false;
      renderList();
      renderDetail();
    },
    () => {
      clearTimeout(timer);
      $("db-note").hidden = false;
    },
  );
}

applyTime();
rebuild();
renderList();
renderDetail();
loop();
connectDb();
(window as any).__gallery = {
  select, attack: startAttack,
  setTime: (t: typeof timeOfDay) => ((timeOfDay = t), applyTime()),
  setMode: (m: Mode) => ((mode = m), rebuild(), applyTime()),
  setOpts: (o: Partial<WeaponOptions>) => (Object.assign(optsOf[current], o), rebuild(true), renderDetail()),
  setSlow: (s: boolean) => (slow = s),
  state: () => ({ attacking: !!attack, flying: flying.length, sparks: sparks.length }),
  pose: (p: number) => {
    if (!inHand) return;
    const a = attackFor(inHand.move, inHand.hold);
    const ps = poseAt(a, p);
    applyPose(hero, ps);
    inHand.build.draw?.(ps.draw);
  },
};
