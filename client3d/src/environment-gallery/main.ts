// The Environment Gallery: look at every ground, floor, wall, roof, wall
// ornament, ground decoration, water and sky piece in 3D, try its variants,
// see them together in sample scenes, and approve each one (or ask for
// changes) before it goes into the game.
//
// Built into one HTML file by:  node build-gallery.mjs environment
// Reviews are saved with the page's shared database when it runs as a claude.ai artifact.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  CATEGORIES, ENV_BY_ID, ENV_TYPES, EnvCategory, EnvPiece, EnvState, ReviewStatus, SCENES, SKY_TIMES, SceneId, TILE, TimeOfDay, WALL_H, createEnv, createSkyDome, house,
} from "../environment";
import { buildScene } from "./scenes";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------

interface Review {
  status: ReviewStatus;
  note: string;
  variant?: number;
  seed?: number;
  updatedAt?: number;
}

type Mode = "one" | "all" | "scene";
const firstId = ENV_TYPES[0].id;
let current: string = location.hash.slice(1) in ENV_BY_ID ? location.hash.slice(1) : firstId;
let filter: EnvCategory | "all" = "all";
const variantOf: Record<string, number> = {};
const seedOf: Record<string, number> = {};
let mode: Mode = "one";
let sceneId: SceneId = "town";
let timeOfDay: TimeOfDay = "day";
let wind = 0.3;
let showPerson = true;
let showGrid = false;
const reviews: Record<string, Review> = {};
let saveReview: ((id: string, r: Review) => Promise<void>) | null = null;

ENV_TYPES.forEach((t, i) => {
  variantOf[t.id] = 0;
  seedOf[t.id] = 7 + i * 37;
});

// ---------- Scene ----------

const canvas = $<HTMLCanvasElement>("cv");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 800);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 120;
controls.autoRotateSpeed = 0.6;

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5b6b3a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const sky = createSkyDome();
scene.add(sky.object);
scene.fog = new THREE.Fog(0xcfe4ee, 60, 260);

// A plain stand-in person (1.8 m tall) for size.
function makePerson() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xe9e1d3, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.75, 4, 12), m);
  body.position.y = 0.62;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), m);
  head.position.y = 1.58;
  body.castShadow = head.castShadow = true;
  g.add(body, head);
  return g;
}
const person = makePerson();
scene.add(person);

// A tile grid (one square per 2D map tile) to show sizes.
const grid = new THREE.GridHelper(40, 20, 0xffffff, 0xffffff);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.35;
grid.position.y = 0.12;
scene.add(grid);

// ---------- What's on show ----------

interface Shown {
  id: string;
  piece: EnvPiece;
  holder: THREE.Group;
  x: number;
  extra?: EnvPiece[];
}
let shown: Shown[] = [];
let sceneParts: EnvPiece[] = [];
let sceneGroup: THREE.Group | null = null;
let inside: "cave" | "room" | undefined;
let weatherFog: { color: number; near: number; far: number } | undefined;

/** The earth slab under a display, so it floats like the other galleries' islands. */
function slab(w: number, d: number, color = 0x7a5a3c) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.8, d + 0.3), new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }));
  m.position.y = -0.42;
  m.receiveShadow = true;
  (m.material as any).__own = true;
  return m;
}

/** What the ground under a wall, ornament or decoration should be. */
function groundFor(id: string): string {
  if (/cave|torch/.test(id) || id === "wall-cave") return "floor-cave";
  if (/marble|guild|statue|banner/.test(id)) return "floor-marble";
  if (/beach/.test(id)) return "ground-sand";
  if (/bramble|grave|barricade/.test(id)) return "ground-withered";
  if (/lamp|wall-timber|wall-stone|wall-door|orn-|barrels|well/.test(id)) return "ground-cobble";
  return "ground-grass";
}
/** What wall an ornament hangs on. */
function wallFor(id: string): string {
  if (id === "orn-torch") return "wall-cave";
  if (id === "orn-banner") return "wall-marble";
  if (id === "orn-vines") return "wall-stone";
  return "wall-timber";
}

/** One display: the piece, with whatever it needs round it, centred at x. */
function display(id: string, x: number, variant = variantOf[id]): Shown {
  const t = ENV_BY_ID[id];
  const holder = new THREE.Group();
  holder.position.x = x;
  scene.add(holder);
  const seed = seedOf[id];
  const extra: EnvPiece[] = [];
  const add = (p: EnvPiece) => {
    holder.add(p.object);
    extra.push(p);
    return p;
  };
  let piece: EnvPiece;
  if (t.kind === "patch") {
    // Three tiles by three, so you can see how it repeats.
    const S = TILE * 3;
    piece = createEnv(id, { variant, seed, x0: -S / 2 + x, z0: -S / 2, w: S, d: S });
    piece.object.position.x = -x; // built in world space; the holder moves it back
    holder.add(slab(S, S, id.startsWith("floor") ? 0x5e5248 : 0x7a5a3c));
  } else if (t.kind === "wall" || t.kind === "door") {
    const L = id === "wall-bridge" ? 0 : t.kind === "door" ? 3 : TILE * 2;
    const g = add(createEnv(groundFor(id), { variant: variantOf[groundFor(id)], x0: -3.5 + x, z0: -2.5, w: 7, d: 5 }));
    g.object.position.x = -x;
    if (id !== "wall-bridge") holder.add(slab(7, 5, groundFor(id).startsWith("floor") ? 0x5e5248 : 0x7a5a3c));
    if (id === "wall-door") {
      // The door sits in a short timber wall.
      for (const sx of [-1, 1]) {
        const w = add(createEnv("wall-timber", { variant: variantOf["wall-timber"], length: 1.6, seed: 3 }));
        w.object.position.set(sx * 1.4, 0, -0.15);
      }
      const top = add(createEnv("wall-timber", { variant: variantOf["wall-timber"], length: 1.2, seed: 4 }));
      top.object.position.set(0, 0, -0.15);
      top.object.scale.y = 1;
      top.object.children.forEach((c) => (c.position.y = 0));
      top.object.position.y = 2.25;
      top.object.scale.y = (WALL_H - 2.25) / WALL_H;
    }
    if (id === "wall-gate") {
      for (const sx of [-1, 1]) add(createEnv("wall-fence", { variant: variantOf["wall-fence"], length: 2 })).object.position.set(sx * 2, 0, 0);
    }
    piece = createEnv(id, { variant, seed, length: L || TILE * 2 });
    if (id === "wall-bridge") {
      // Over a river.
      g.object.visible = false;
      add(createEnv("water-river", { variant: 0, seed: 3 }));
      const s = slab(19.7, 8.7);
      s.position.y = -1.6;
      s.scale.y = 2;
      holder.add(s);
    }
  } else if (t.kind === "roof") {
    piece = createEnv(id, { variant, seed });
    const g = add(createEnv("ground-grass", { variant: 2, x0: -4.5 + x, z0: -3.5, w: 9, d: 7 }));
    g.object.position.x = -x;
    holder.add(slab(9, 7));
  } else if (t.kind === "ornament") {
    const gid = groundFor(id);
    const g = add(createEnv(gid, { variant: variantOf[gid], x0: -2.5 + x, z0: -1.5, w: 5, d: 4 }));
    g.object.position.x = -x;
    holder.add(slab(5, 4, gid.startsWith("floor") ? 0x5e5248 : 0x7a5a3c));
    const wid = wallFor(id);
    const w = add(createEnv(wid, { variant: variantOf[wid], length: 4, seed: 5 }));
    w.object.position.z = -1.5;
    piece = createEnv(id, { variant, seed });
    piece.object.position.set(0, (piece as any).mountY ?? 1.5, -1.5 + 0.15);
    if (id === "orn-flowerbox") {
      // Show it under a window, the way it's used.
      const win = add(createEnv("orn-window", { variant: variantOf["orn-window"] }));
      win.object.position.set(0, 1.7, -1.35);
    }
  } else if (t.kind === "decor") {
    const gid = groundFor(id);
    const S = id === "decor-statue" || id === "decor-well" ? 5 : 4;
    const g = add(createEnv(gid, { variant: variantOf[gid], x0: -S / 2 + x, z0: -S / 2, w: S, d: S }));
    g.object.position.x = -x;
    holder.add(slab(S, S, gid.startsWith("floor") ? 0x5e5248 : 0x7a5a3c));
    piece = createEnv(id, { variant, seed });
  } else if (t.kind === "water") {
    piece = createEnv(id, { variant, seed });
    const box = new THREE.Box3().setFromObject(piece.object);
    const size = box.getSize(new THREE.Vector3());
    const s = slab(size.x - 0.3, size.z - 0.3);
    s.position.set((box.min.x + box.max.x) / 2, -1.6, (box.min.z + box.max.z) / 2);
    s.scale.y = 2;
    holder.add(s);
  } else {
    // The sky: a grassy patch to stand on, and the sky piece itself.
    piece = createEnv(id, { variant, seed });
    const g = add(createEnv("ground-grass", { variant: 1, x0: -6 + x, z0: -6, w: 12, d: 12 }));
    g.object.position.x = -x;
    holder.add(slab(12, 12));
    for (const [dx, dz, v] of [[-3, -2, 0], [2.5, 1, 1], [-1, 3, 3]] as const) {
      const f = add(createEnv(v === 0 ? "decor-tufts" : "decor-flowers", { variant: v, seed: dx * 10 }));
      f.object.position.set(dx, 0, dz);
    }
  }
  holder.add(piece.object);
  return { id, piece, holder, x, extra };
}

function clearShown() {
  for (const s of shown) {
    scene.remove(s.holder);
    s.piece.dispose();
    s.extra?.forEach((p) => p.dispose());
    s.holder.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
  shown = [];
  if (sceneGroup) {
    scene.remove(sceneGroup);
    sceneParts.forEach((p) => p.dispose());
    sceneGroup = null;
    sceneParts = [];
  }
  inside = undefined;
  weatherFog = undefined;
}

function spacing(id: string) {
  const k = ENV_BY_ID[id].kind;
  return k === "water" ? 22 : k === "roof" ? 11 : k === "wall" || k === "door" ? 8 : k === "patch" ? 7.2 : k === "ornament" ? 5.8 : k === "decor" ? 5.5 : 14;
}

function frame(x: number, y: number, dist: number, dir = new THREE.Vector3(0.5, 0.45, 0.8), z = 0) {
  controls.target.set(x, y, z);
  camera.position.copy(controls.target).addScaledVector(dir.normalize(), dist);
}

function frameOne(id: string) {
  const t = ENV_BY_ID[id];
  if (t.kind === "patch") frame(0, 0, 10, new THREE.Vector3(0.5, 0.75, 0.8));
  else if (t.kind === "wall" || t.kind === "door") frame(0, 1.4, id === "wall-cliff" ? 15 : id === "wall-bridge" ? 13 : 10);
  else if (t.kind === "roof") frame(0, 2.6, 15, new THREE.Vector3(0.6, 0.45, 0.8));
  else if (t.kind === "ornament") frame(0, (shown[0]?.piece as any)?.mountY ?? 1.5, 5.2, new THREE.Vector3(0.35, 0.2, 1));
  else if (t.kind === "decor") {
    const tall = id === "decor-lamp" || id === "decor-statue" || id === "decor-well";
    const small = /beach|mushrooms|tufts|flowers/.test(id);
    frame(0, tall ? 1.6 : small ? 0.2 : 0.5, tall ? 8 : small ? 3 : 4.6, new THREE.Vector3(0.5, 0.55, 0.8));
  }
  else if (t.kind === "water") frame(0, 0, id === "water-fall" ? 17 : id === "water-river" ? 19 : 15, new THREE.Vector3(0.35, 0.55, 1), id === "water-fall" ? 1 : 0);
  else frame(0, 26, 30, new THREE.Vector3(0.1, -0.75, 1));
}

function rebuild(keepCamera = false) {
  clearShown();
  const t = ENV_BY_ID[current];
  if (mode === "scene") {
    const built = buildScene(sceneId, (id) => ({ variant: variantOf[id], seed: seedOf[id] }));
    sceneGroup = built.group;
    sceneParts = built.pieces;
    scene.add(sceneGroup);
    inside = built.inside;
    weatherFog = built.fog;
    person.position.set(built.personAt?.[0] ?? built.target.x + 1.2, 0, built.personAt?.[1] ?? built.target.z + 2);
    person.rotation.y = 0.4;
    if (!keepCamera) frame(built.target.x, built.target.y, built.dist, built.dir, built.target.z);
  } else if (mode === "one" || t.variants.length < 2 || t.kind === "dome") {
    shown.push(display(current, 0));
    const k = t.kind;
    person.position.set(k === "patch" ? 2.2 : k === "ornament" ? 1.6 : k === "roof" ? 4.2 : k === "water" ? 3.5 : k === "decor" ? -1.7 : 2.2, 0, k === "ornament" ? 0.2 : k === "water" ? 3 : k === "decor" ? -1.8 : 1.4);
    person.rotation.y = -0.6;
    if (!keepCamera) frameOne(current);
    weatherFog = shown[0].piece.fog;
  } else {
    // Every variant side by side.
    const n = t.variants.length;
    const sp = spacing(current);
    for (let v = 0; v < n; v++) shown.push(display(current, (v - (n - 1) / 2) * sp, v));
    person.position.set(-((n - 1) / 2) * sp - sp * 0.45, 0, 1.4);
    person.rotation.y = 0.4;
    weatherFog = shown[0].piece.fog;
    if (!keepCamera) {
      const halfWidth = (n * sp) / 2 + 0.6;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const y = t.kind === "ornament" ? 1.8 : t.kind === "roof" ? 2.5 : t.kind === "wall" || t.kind === "door" ? 1.4 : 0.5;
      frame(0, y, Math.max(8, halfWidth / tanHalf), new THREE.Vector3(0.05, t.kind === "patch" || t.kind === "water" ? 0.6 : 0.3, 1));
    }
  }
  // The sky's own entry changes the dome's style; everything else uses the picked style.
  sky.setStyle(mode !== "scene" && current === "sky-dome" ? variantOf["sky-dome"] : variantOf["sky-dome"]);
  person.visible = showPerson && t.kind !== "clouds" && t.kind !== "dome";
  grid.visible = showGrid && mode !== "scene";
  applyTime();
  updateHud();
}

// ---------- Time of day ----------

function applyTime() {
  const s = SKY_TIMES[timeOfDay];
  sky.setTime(timeOfDay);
  sky.object.visible = inside !== "room" && inside !== "cave";
  hemi.color.setHex(s.hemi[0]);
  hemi.groundColor.setHex(s.hemi[1]);
  hemi.intensity = s.hemi[2];
  sun.color.setHex(s.sun[0]);
  sun.intensity = s.sun[1];
  const d = new THREE.Vector3(...s.dir).normalize().multiplyScalar(40);
  sun.position.copy(controls.target).add(d);
  sun.target.position.copy(controls.target);
  renderer.toneMappingExposure = s.exposure;
  bloom.strength = s.bloom;
  let fogColor = s.fog as number, near = 60, far = 260;
  if (weatherFog) {
    fogColor = timeOfDay === "night" ? 0x2a3450 : weatherFog.color;
    near = weatherFog.near;
    far = weatherFog.far;
  }
  if (inside === "cave") {
    hemi.color.setHex(0x6a7088);
    hemi.groundColor.setHex(0x1a1814);
    hemi.intensity = 0.7;
    sun.intensity = 0.4;
    sun.color.setHex(0x8a9ab8);
    bloom.strength = 0.8;
    fogColor = 0x0e0d0c;
    near = 14;
    far = 46;
    scene.background = new THREE.Color(0x0e0d0c);
  } else if (inside === "room") {
    hemi.color.setHex(timeOfDay === "night" ? 0x8a7a9a : 0xfff0dc);
    hemi.groundColor.setHex(0x4a3a2a);
    hemi.intensity = timeOfDay === "night" ? 0.55 : 1.0;
    sun.intensity = timeOfDay === "night" ? 0.3 : 1.4;
    bloom.strength = 0.6;
    fogColor = 0x1a1612;
    near = 40;
    far = 120;
    scene.background = new THREE.Color(0x1a1612);
  } else {
    scene.background = null;
  }
  const fogObj = scene.fog as THREE.Fog;
  fogObj.color.setHex(fogColor);
  fogObj.near = near;
  fogObj.far = far;
  document.querySelectorAll<HTMLButtonElement>("#time button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.time === timeOfDay)));
  const stage = $("stage");
  stage.style.setProperty("--sky-top", `#${s.top.toString(16).padStart(6, "0")}`);
}

function envState(): EnvState {
  let night: number = SKY_TIMES[timeOfDay].night;
  // Lamps are lit indoors and in caves even in the day.
  if (inside) night = Math.max(night, inside === "cave" ? 1 : 0.6);
  return { night, wind };
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
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const env = envState();
  for (const s of shown) {
    s.piece.update(dt, t, env);
    s.extra?.forEach((p) => p.update(dt, t, env));
  }
  sceneParts.forEach((p) => p.update(dt, t, env));
  sky.update(dt, t);
  sky.object.position.copy(camera.position);
  controls.update();
  // Keep the sun's shadow box round what you're looking at.
  const d = new THREE.Vector3(...SKY_TIMES[timeOfDay].dir).normalize().multiplyScalar(40);
  sun.position.copy(controls.target).add(d);
  sun.target.position.copy(controls.target);
  composer.render();
  requestAnimationFrame(loop);
}

// ---------- UI ----------

const STATUS_LABEL: Record<ReviewStatus, string> = { waiting: "Waiting for you", approved: "Approved", changes: "Needs changes" };
const reviewOf = (id: string): Review => reviews[id] ?? { status: "waiting", note: "" };
const hexColor = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

function renderCats() {
  const el = $("cats");
  el.innerHTML = "";
  const opts: [EnvCategory | "all", string][] = [["all", "All"], ...(Object.keys(CATEGORIES) as EnvCategory[]).map((c) => [c, CATEGORIES[c].name] as [EnvCategory, string])];
  for (const [c, name] of opts) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.setAttribute("aria-pressed", String(filter === c));
    b.onclick = () => {
      filter = c;
      renderCats();
      renderList();
      if (c !== "all" && ENV_BY_ID[current].category !== c) select(ENV_TYPES.find((t) => t.category === c)!.id);
    };
    el.appendChild(b);
  }
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";
  let lastCat = "";
  for (const t of ENV_TYPES) {
    if (filter !== "all" && t.category !== filter) continue;
    if (t.category !== lastCat) {
      lastCat = t.category;
      const h = document.createElement("p");
      h.className = "group-head";
      const all = ENV_TYPES.filter((x) => x.category === t.category);
      h.textContent = `${CATEGORIES[t.category].name} · ${all.filter((x) => reviewOf(x.id).status === "approved").length} of ${all.length} approved`;
      list.appendChild(h);
    }
    const r = reviewOf(t.id);
    const b = document.createElement("button");
    b.className = "tree-row";
    b.setAttribute("aria-current", String(t.id === current));
    b.innerHTML = `<span class="swatch" style="--c:${hexColor(t.color)}"></span><span class="tr-name"></span><span class="tr-meta"></span><span class="pill" data-s="${r.status}"></span>`;
    b.querySelector(".tr-name")!.textContent = t.name;
    b.querySelector(".tr-meta")!.textContent = `${t.variants.length} ${t.variants.length === 1 ? "style" : "styles"}`;
    b.querySelector(".pill")!.textContent = r.status === "waiting" ? "To review" : STATUS_LABEL[r.status];
    b.onclick = () => select(t.id);
    list.appendChild(b);
  }
  const approved = ENV_TYPES.filter((t) => reviewOf(t.id).status === "approved").length;
  $("tally").textContent = `${approved} of ${ENV_TYPES.length} approved`;
  ($("tally-bar") as HTMLElement).style.setProperty("--p", String(approved / ENV_TYPES.length));
}

function renderDetail() {
  const t = ENV_BY_ID[current];
  $("d-name").textContent = t.name;
  $("d-cat").textContent = CATEGORIES[t.category].name;
  $("d-about").textContent = t.about;
  $("d-grows").textContent = t.where;
  const vs = $("d-variants");
  vs.innerHTML = "";
  t.variants.forEach((name, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.setAttribute("aria-pressed", String(i === variantOf[current]));
    b.onclick = () => {
      variantOf[current] = i;
      if (mode === "all") mode = "one";
      rebuild(true);
      renderDetail();
    };
    vs.appendChild(b);
  });
  const sc = $("d-scenes");
  sc.innerHTML = "";
  const ids = t.scenes.length ? t.scenes : [];
  for (const s of ids) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = SCENES[s].name;
    b.setAttribute("aria-pressed", String(mode === "scene" && sceneId === s));
    b.onclick = () => openScene(s);
    sc.appendChild(b);
  }
  $("d-scenes-wrap").hidden = !ids.length;
  $("d-seed").textContent = `Pattern #${seedOf[current]}`;
  const r = reviewOf(current);
  document.querySelectorAll<HTMLButtonElement>("#verdict button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === r.status)));
  const note = $<HTMLTextAreaElement>("note");
  if (document.activeElement !== note) note.value = r.note ?? "";
  $("saved").textContent = r.updatedAt ? `Saved ${new Date(r.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
}

const ACTION: Partial<Record<string, string>> = {
  "wall-door": "Open / close", "wall-gate": "Open / close", "orn-window": "Shutters", "orn-sign": "Give it a push", "orn-lantern": "Give it a push",
  "orn-torch": "Blow on it", "decor-well": "Lower the bucket", "water-pond": "Throw a stone", "water-river": "Rush of water", "water-sea": "Big wave",
  "water-fall": "Gush", "sky-clouds": "Blow them along", "sky-weather": "Heavier", "floor-glow": "Make it pulse", "decor-lamp": "Flicker", "decor-mushrooms": "Flicker",
};
function actionLabel() {
  return ACTION[current] ?? "Gust of wind";
}

function updateHud() {
  const t = ENV_BY_ID[current];
  $("np-name").textContent = mode === "scene" ? SCENES[sceneId].name : mode === "all" && t.variants.length > 1 ? `${t.name} · every style` : `${t.name} · ${t.variants[variantOf[current]]}`;
  $("np-kicker").textContent = mode === "scene" ? "Sample scene" : "Environment Gallery";
  $("act").querySelector("span")!.textContent = mode === "scene" ? "Gust of wind" : actionLabel();
  document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  const sel = $<HTMLSelectElement>("scene");
  sel.value = sceneId;
  $("scene-ctl").hidden = mode !== "scene";
  $("grid-ctl").hidden = mode === "scene";
  $("scene-about").textContent = mode === "scene" ? `${SCENES[sceneId].about} Click anything in the scene to review it.` : "";
}

function openScene(s: SceneId) {
  sceneId = s;
  mode = "scene";
  rebuild();
  renderDetail();
}

function select(id: string) {
  const sameRow = mode === "all" && shown.some((s) => s.id === id);
  current = id;
  if (location.hash.slice(1) !== id) history.replaceState(null, "", `#${id}`);
  if (mode === "scene") {
    // Stay in the scene, unless this piece isn't in it.
    if (!ENV_BY_ID[id].scenes.includes(sceneId)) {
      if (ENV_BY_ID[id].scenes.length) sceneId = ENV_BY_ID[id].scenes[0];
      else mode = "one";
      rebuild();
    }
  } else if (!sameRow) rebuild();
  renderList();
  renderDetail();
  updateHud();
}

document.querySelectorAll<HTMLButtonElement>("#time button").forEach((b) => {
  b.onclick = () => {
    timeOfDay = b.dataset.time as TimeOfDay;
    applyTime();
  };
});
document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => {
  b.onclick = () => {
    const m = b.dataset.mode as Mode;
    if (m === "scene") {
      const t = ENV_BY_ID[current];
      if (!t.scenes.includes(sceneId) && t.scenes.length) sceneId = t.scenes[0];
    }
    mode = m;
    rebuild();
    renderDetail();
  };
});
const sceneSel = $<HTMLSelectElement>("scene");
for (const [id, s] of Object.entries(SCENES)) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = s.name;
  sceneSel.appendChild(o);
}
sceneSel.onchange = () => openScene(sceneSel.value as SceneId);

$("act").onclick = () => {
  if (mode === "scene") {
    sceneParts.forEach((p) => p.poke?.());
    return;
  }
  for (const s of shown) {
    if (s.piece.poke) s.piece.poke();
    else s.extra?.forEach((p) => p.poke?.());
  }
};
$("reroll").onclick = () => {
  seedOf[current] = 1 + Math.floor(Math.random() * 9999);
  rebuild(true);
  renderDetail();
};
$<HTMLInputElement>("wind").oninput = (e) => (wind = Number((e.target as HTMLInputElement).value));
$<HTMLInputElement>("person").onchange = (e) => {
  showPerson = (e.target as HTMLInputElement).checked;
  rebuild(true);
};
$<HTMLInputElement>("grid").onchange = (e) => {
  showGrid = (e.target as HTMLInputElement).checked;
  grid.visible = showGrid && mode !== "scene";
};
$("spin").onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  $("spin").setAttribute("aria-pressed", String(controls.autoRotate));
  $("spin").textContent = controls.autoRotate ? "Spin: on" : "Spin: off";
};
canvas.addEventListener("pointerdown", () => {
  if (controls.autoRotate) $("spin").click();
});

// Click a piece (in a scene or a side-by-side row) to pick it.
const ray = new THREE.Raycaster();
let downAt = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener("pointerup", (e) => {
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  if (mode === "scene" && sceneGroup) {
    const hits = ray.intersectObject(sceneGroup, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.envId) o = o.parent;
      if (o?.userData.envId && o.userData.envId !== current) {
        select(o.userData.envId);
        return;
      }
      if (o?.userData.envId) return;
    }
    return;
  }
  if (mode === "all") {
    const hits = ray.intersectObjects(shown.map((s) => s.holder), true);
    if (!hits.length) return;
    let o: THREE.Object3D | null = hits[0].object;
    while (o && !shown.some((s) => s.holder === o)) o = o.parent;
    const idx = shown.findIndex((x) => x.holder === o);
    if (idx >= 0) {
      variantOf[current] = idx;
      renderDetail();
      updateHud();
      frame(shown[idx].x, controls.target.y, camera.position.distanceTo(controls.target) * 0.45);
    }
  }
});

// Reviews.
async function setVerdict(status: ReviewStatus) {
  const id = current;
  const note = $<HTMLTextAreaElement>("note").value.trim();
  const r: Review = { status, note, variant: variantOf[id], seed: seedOf[id], updatedAt: Date.now() };
  reviews[id] = r;
  renderList();
  renderDetail();
  if (!saveReview) {
    $("saved").textContent = "Can't save here: open this page on claude.ai to keep reviews.";
    return;
  }
  $("saved").textContent = "Saving…";
  try {
    await saveReview(id, r);
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
  const id = location.hash.slice(1);
  if (id in ENV_BY_ID && id !== current) select(id);
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
  saveReview = (id, r) => db.doc(`reviews/${id}`).set(r as unknown as Record<string, unknown>);
  db.collection("reviews").onSnapshot(
    (snap: any) => {
      clearTimeout(timer);
      $("db-note").hidden = true;
      let changed = false;
      for (const d of snap.docs) {
        const data = d.data() as Review;
        if (data && d.id in ENV_BY_ID) {
          reviews[d.id] = data;
          // Show the style Mike picked when he reviewed it.
          if (typeof data.variant === "number" && data.variant !== variantOf[d.id]) {
            variantOf[d.id] = data.variant;
            changed = true;
          }
        }
      }
      if (changed) rebuild(true);
      renderList();
      renderDetail();
    },
    () => {
      clearTimeout(timer);
      $("db-note").hidden = false;
    },
  );
}

rebuild();
renderCats();
renderList();
renderDetail();
loop();
connectDb();
void house;
(window as any).__gallery = {
  select,
  ids: ENV_TYPES.map((t) => t.id),
  setTime: (t: TimeOfDay) => ((timeOfDay = t), applyTime()),
  setMode: (m: Mode) => ((mode = m), rebuild(), renderDetail()),
  setScene: (s: SceneId) => openScene(s),
  setVariant: (v: number) => ((variantOf[current] = v), rebuild(true), renderDetail()),
  poke: () => $("act").click(),
};
