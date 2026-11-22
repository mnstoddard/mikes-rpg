// The Food Gallery: look at every fish (raw and cooked), ingredient, crop,
// cooked dish and fishing spot in 3D, try its variants, poke it, and approve
// it (or ask for changes) before it goes into the game.
//
// Built into one HTML file by:  node build-gallery.mjs food
// Reviews are saved with the page's shared database when it runs as a claude.ai artifact.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CATEGORIES, FOOD_BY_ID, FOOD_TYPES, FoodCategory, ReviewStatus, Showpiece, Stage, createFood } from "../food";
import { makeRng } from "../food/common";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------

interface Review {
  status: ReviewStatus;
  note: string;
  seed?: number;
  variant?: number;
  updatedAt?: number;
}

const firstId = FOOD_TYPES[0].id;
let current: string = location.hash.slice(1) in FOOD_BY_ID ? location.hash.slice(1) : firstId;
let filter: FoodCategory | "all" = "all";
const variantOf: Record<string, number> = {};
const seedOf: Record<string, number> = {};
let mode: "one" | "row" = "one";
let timeOfDay: "day" | "sunset" | "night" = "day";
let showPerson = true;
let turntable = true;
const reviews: Record<string, Review> = {};
let saveReview: ((id: string, r: Review) => Promise<void>) | null = null;

FOOD_TYPES.forEach((t, i) => {
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
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 90;
controls.maxPolarAngle = Math.PI * 0.49;
canvas.addEventListener("pointerdown", () => setTurntable(false));

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5b6b3a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 16, bottom: -16 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

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

const flat = (c: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9, ...o });

// The ground: a low-poly grassy island floating in the sky.
const island = new THREE.Group();
scene.add(island);
function buildIsland(width: number, depth = 4.6) {
  island.clear();
  const rng = makeRng(99);
  const rx = width / 2 + 3.2;
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 16, 1), flat(0x7fb24a));
  grass.scale.set(rx, 1, depth);
  grass.position.y = -0.25;
  grass.receiveShadow = true;
  island.add(grass);
  const dirt = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 16, 1), flat(0x8a6a48));
  dirt.rotation.x = Math.PI;
  dirt.scale.set(rx * 0.97, 2.6, depth * 0.96);
  dirt.position.y = -1.8;
  island.add(dirt);
  for (let i = 0; i < 22 + width * 3; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.45 + rng() * 0.5;
    const x = Math.cos(a) * r * (rx - 0.5);
    const z = Math.sin(a) * r * (depth - 0.6);
    const isRock = rng() < 0.35;
    const m = isRock
      ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + rng() * 0.12, 0), flat(0x9a9a92))
      : new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3 + rng() * 0.2, 3), flat(rng() < 0.5 ? 0x6a9e3c : 0x8cc055));
    m.position.set(x, isRock ? 0.04 : 0.12, z);
    m.castShadow = true;
    island.add(m);
  }
}

// A plain stand-in person (1.8 m tall), to judge the size of fishing spots.
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

// ---------- Display stands ----------
// Food is tiny next to the island, so it's shown enlarged on a wooden stand,
// on whatever suits it: a water tank, a chopping board, a plate or some soil.
// Fishing spots are shown at their real size on the grass.

const STAND_TOP = 0.8;
const FIT = 1.35; // how big food is shown, in world units

function makeStand(stage: Stage, rng: () => number): { group: THREE.Group; top: number } {
  const g = new THREE.Group();
  const wood = flat(0x9a6b42);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, STAND_TOP, 9), wood);
  post.position.y = STAND_TOP / 2;
  post.castShadow = post.receiveShadow = true;
  g.add(post);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.0, 0.08, 9), flat(0x7e5633));
  lip.position.y = STAND_TOP;
  lip.receiveShadow = true;
  g.add(lip);
  let top = STAND_TOP + 0.04;
  if (stage === "board") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 1.05), flat(0xd2a26a));
    b.position.y = top + 0.035;
    b.receiveShadow = b.castShadow = true;
    g.add(b);
    top += 0.07;
  } else if (stage === "plate") {
    const pts = [[0, 0], [0.55, 0], [0.62, 0.03], [0.92, 0.09], [0.94, 0.1], [0.9, 0.105], [0.62, 0.045], [0, 0.045]].map(([x, y]) => new THREE.Vector2(x, y));
    const p = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), flat(0xf3eee4, { roughness: 0.35, side: THREE.DoubleSide }));
    p.position.y = top;
    p.receiveShadow = p.castShadow = true;
    g.add(p);
    // A slice of lemon.
    const lemon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), flat(0xf2d23a, { roughness: 0.5 }));
    lemon.position.set(0.5, top + 0.06, 0.42);
    const pulp = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.032, 10), flat(0xf6e88a, { roughness: 0.4 }));
    pulp.position.copy(lemon.position);
    g.add(lemon, pulp);
    top += 0.045;
  } else if (stage === "soil") {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.14, 10), flat(0x5e4330));
    s.position.y = top + 0.07;
    s.receiveShadow = true;
    g.add(s);
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05 + rng() * 0.05, 0), flat(0x4e3826));
      const a = rng() * 6.3, r = rng() * 0.75;
      c.position.set(Math.cos(a) * r, top + 0.14, Math.sin(a) * r);
      g.add(c);
    }
    top += 0.14;
  } else if (stage === "tank") {
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 1.3, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xbfe8f2, transparent: true, opacity: 0.08, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    );
    glass.position.y = top + 0.65;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.98, 0.98, 1.15, 14),
      new THREE.MeshStandardMaterial({ color: 0x5fb8d6, transparent: true, opacity: 0.1, roughness: 0.1, depthWrite: false }),
    );
    water.position.y = top + 0.575;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.03, 4, 14).rotateX(Math.PI / 2), flat(0x6f8890));
    rim.position.y = top + 1.3;
    const gravel = new THREE.Mesh(new THREE.CylinderGeometry(0.97, 0.97, 0.06, 14), flat(0xc8b48a));
    gravel.position.y = top + 0.03;
    g.add(gravel, water, glass, rim);
    // A couple of water plants.
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5 + rng() * 0.4, 4), flat(0x4f9a4a));
      const a = rng() * 6.3;
      w.position.set(Math.cos(a) * 0.75, top + 0.3, Math.sin(a) * 0.75);
      g.add(w);
    }
  }
  return { group: g, top };
}

/** Rising bubbles for the tank. */
function tankBubbles(top: number) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, roughness: 0.1 });
  const list: { b: THREE.Mesh; p: number; x: number; z: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025 + (i % 3) * 0.01, 0), m);
    g.add(b);
    list.push({ b, p: i / 12, x: -0.6 + (i % 4) * 0.08, z: 0.3 - (i % 3) * 0.1 });
  }
  return {
    group: g,
    update(time: number) {
      for (const l of list) {
        const t = (time * 0.35 + l.p) % 1;
        l.b.position.set(l.x + Math.sin(time * 2 + l.p * 20) * 0.03, top + 0.1 + t * 1.05, l.z);
      }
    },
  };
}

// ---------- Models on show ----------

interface Shown {
  id: string;
  piece: Showpiece;
  holder: THREE.Group; // the whole display (stand + model)
  spinner: THREE.Group; // turns on the turntable
  x: number;
  extra?: (time: number) => void;
  spinTo?: number;
}
let shown: Shown[] = [];

function clearShown() {
  for (const s of shown) {
    scene.remove(s.holder);
    s.piece.dispose();
    s.holder.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.dispose());
  }
  shown = [];
}

function display(id: string, x: number): Shown {
  const piece = createFood(id, { seed: seedOf[id], variant: variantOf[id] });
  piece.update(0, 0);
  const holder = new THREE.Group();
  const spinner = new THREE.Group();
  holder.position.x = x;
  scene.add(holder);
  const s: Shown = { id, piece, holder, spinner, x };
  if (piece.stage === "pond") {
    holder.add(spinner);
    spinner.add(piece.object);
    return s;
  }
  const stand = makeStand(piece.stage, makeRng(seedOf[id]));
  holder.add(stand.group);
  // Scale the model so it fits the stand nicely.
  const box = solidBox(piece.object);
  const size = box.getSize(new THREE.Vector3());
  const big = Math.max(size.x, size.z, size.y * 1.2, 1e-4);
  const k = (piece.stage === "tank" ? FIT * 1.15 : piece.stage === "soil" ? FIT * 1.05 : FIT) / big;
  piece.object.scale.multiplyScalar(k);
  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
  piece.object.position.x -= center.x;
  piece.object.position.z -= center.z;
  spinner.position.y = piece.stage === "tank" ? stand.top + 0.62 : stand.top + 0.006 - (piece.stage === "soil" ? 0 : box.min.y * k);
  if (piece.stage === "tank") piece.object.position.y -= center.y;
  spinner.add(piece.object);
  holder.add(spinner);
  if (piece.stage === "tank") {
    const b = tankBubbles(stand.top);
    holder.add(b.group);
    s.extra = b.update;
  }
  return s;
}

/** The size of a model, leaving out see-through bits like steam. */
function solidBox(o: THREE.Object3D): THREE.Box3 {
  o.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const b = new THREE.Box3();
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || (m.material as THREE.Material).transparent) return;
    m.geometry.computeBoundingBox();
    box.union(b.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld));
  });
  return box.isEmpty() ? new THREE.Box3(new THREE.Vector3(-0.1, 0, -0.1), new THREE.Vector3(0.1, 0.1, 0.1)) : box;
}

const isPond = () => FOOD_BY_ID[current].category === "spot";

function groupIds(): string[] {
  const cat = FOOD_BY_ID[current].category;
  return FOOD_TYPES.filter((t) => t.category === cat).map((t) => t.id);
}

function spacing() {
  return isPond() ? 4.6 : 2.6;
}

function rebuild(keepCamera = false) {
  clearShown();
  const pond = isPond();
  if (mode === "one") {
    shown.push(display(current, 0));
    buildIsland(pond ? 4 : 2, pond ? 4.6 : 3.6);
    person.position.set(pond ? 2.3 : 1.7, 0, pond ? -1.7 : 1.2);
    person.rotation.y = -0.6;
    if (!keepCamera) pond ? frame(0, 0.4, 7.5) : frame(0, STAND_TOP + 0.45, 3.3);
  } else {
    const ids = groupIds();
    const n = ids.length;
    const sp = spacing();
    ids.forEach((id, i) => shown.push(display(id, (i - (n - 1) / 2) * sp)));
    buildIsland(n * sp - 2, pond ? 4.6 : 3.6);
    person.position.set(-((n - 1) / 2) * sp - (pond ? 3 : 1.9), 0, 1.4);
    person.rotation.y = 0.4;
    if (!keepCamera) {
      const halfWidth = (n * sp) / 2 + 0.6;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      frame(0, pond ? 0.3 : STAND_TOP + 0.4, halfWidth / tanHalf, new THREE.Vector3(0.05, 0.3, 1));
    }
  }
  person.visible = showPerson && pond;
  $("person-ctl").style.display = pond ? "" : "none";
  updateHud();
}

function frame(x: number, y: number, dist: number, dir = new THREE.Vector3(0.55, 0.42, 0.75)) {
  controls.target.set(x, y, 0);
  camera.position.copy(controls.target).addScaledVector(dir.normalize(), dist);
}

// ---------- Time of day ----------

const SKIES = {
  day: { top: "#8fc9ec", mid: "#cfe6ef", low: "#f4e7c9", hemi: [0xcfe8ff, 0x5b6b3a, 1.1], sun: [0xfff1d6, 2.4], pos: [6, 12, 8], exposure: 1.05, bloom: 0.2 },
  sunset: { top: "#6d7fb8", mid: "#e9a07a", low: "#f6c98a", hemi: [0xffd2b0, 0x5a4a48, 1.05], sun: [0xffa060, 2.4], pos: [-12, 4.5, 4], exposure: 1.0, bloom: 0.35 },
  night: { top: "#0b1430", mid: "#1b2950", low: "#2b3a5e", hemi: [0x5a6fae, 0x141824, 0.5], sun: [0xa9c1ff, 0.6], pos: [-5, 12, -6], exposure: 1.15, bloom: 0.9 },
} as const;

function applyTime() {
  const s = SKIES[timeOfDay];
  paintSky(s.top, s.mid, s.low);
  hemi.color.setHex(s.hemi[0]);
  hemi.groundColor.setHex(s.hemi[1]);
  hemi.intensity = s.hemi[2];
  sun.color.setHex(s.sun[0]);
  sun.intensity = s.sun[1];
  sun.position.set(s.pos[0], s.pos[1], s.pos[2]);
  renderer.toneMappingExposure = s.exposure;
  bloom.strength = s.bloom;
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
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  for (const s of shown) {
    s.piece.update(dt, t);
    s.extra?.(t);
    if (s.spinTo !== undefined) {
      s.spinner.rotation.y += (s.spinTo - s.spinner.rotation.y) * Math.min(1, dt * 5);
      if (Math.abs(s.spinTo - s.spinner.rotation.y) < 0.002) s.spinTo = undefined;
    } else if (turntable && s.piece.stage !== "pond") s.spinner.rotation.y += dt * 0.35;
  }
  controls.update();
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
  const opts: [FoodCategory | "all", string][] = [["all", "All"], ...(Object.keys(CATEGORIES) as FoodCategory[]).map((c) => [c, CATEGORIES[c].name] as [FoodCategory, string])];
  for (const [c, name] of opts) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.setAttribute("aria-pressed", String(filter === c));
    b.onclick = () => {
      filter = c;
      renderCats();
      renderList();
      if (c !== "all" && FOOD_BY_ID[current].category !== c) select(FOOD_TYPES.find((t) => t.category === c)!.id);
    };
    el.appendChild(b);
  }
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";
  let lastCat = "";
  for (const t of FOOD_TYPES) {
    if (filter !== "all" && t.category !== filter) continue;
    if (t.category !== lastCat) {
      lastCat = t.category;
      const h = document.createElement("p");
      h.className = "group-head";
      const done = FOOD_TYPES.filter((x) => x.category === t.category);
      h.textContent = `${CATEGORIES[t.category].name} · ${done.filter((x) => reviewOf(x.id).status === "approved").length} of ${done.length} approved`;
      list.appendChild(h);
    }
    const r = reviewOf(t.id);
    const b = document.createElement("button");
    b.className = "tree-row";
    b.setAttribute("aria-current", String(t.id === current));
    b.innerHTML = `<span class="swatch" style="--c:${hexColor(t.color)}"></span><span class="tr-name"></span><span class="tr-meta"></span><span class="pill" data-s="${r.status}"></span>`;
    b.querySelector(".tr-name")!.textContent = t.name;
    b.querySelector(".tr-meta")!.textContent = t.stats()[0]?.join(" ") ?? "";
    b.querySelector(".pill")!.textContent = r.status === "waiting" ? "To review" : STATUS_LABEL[r.status];
    b.onclick = () => select(t.id);
    list.appendChild(b);
  }
  const approved = FOOD_TYPES.filter((t) => reviewOf(t.id).status === "approved").length;
  $("tally").textContent = `${approved} of ${FOOD_TYPES.length} approved`;
  ($("tally-bar") as HTMLElement).style.setProperty("--p", String(approved / FOOD_TYPES.length));
}

function renderDetail() {
  const t = FOOD_BY_ID[current];
  $("d-name").textContent = t.name;
  $("d-cat").textContent = `${CATEGORIES[t.category].name} · ${t.size}`;
  $("d-about").textContent = t.about;
  $("d-grows").textContent = t.where;
  const stats = $("d-stats");
  stats.innerHTML = "";
  for (const [k, v] of t.stats()) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    stats.append(dt, dd);
  }
  const vs = $("d-variants");
  vs.innerHTML = "";
  t.variants.forEach((name, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.setAttribute("aria-pressed", String(i === variantOf[current]));
    b.onclick = () => {
      variantOf[current] = i;
      rebuild(true);
      renderDetail();
    };
    vs.appendChild(b);
  });
  $("d-seed").textContent = `Model #${seedOf[current]}`;
  const r = reviewOf(current);
  document.querySelectorAll<HTMLButtonElement>("#verdict button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === r.status)));
  const note = $<HTMLTextAreaElement>("note");
  if (document.activeElement !== note) note.value = r.note ?? "";
  $("saved").textContent = r.updatedAt ? `Saved ${new Date(r.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
}

function actionLabel() {
  const t = FOOD_BY_ID[current];
  if (t.category === "fish") return variantOf[current] === 1 ? "Flop" : "Splash";
  if (t.category === "spot") return t.id === "spot-minnow" ? "Scare them" : "Make one jump";
  return "Turn it round";
}

function updateHud() {
  const t = FOOD_BY_ID[current];
  $("np-name").textContent = mode === "one" ? `${t.name} · ${t.variants[variantOf[current]]}` : CATEGORIES[t.category].name;
  $("act").querySelector("span")!.textContent = actionLabel();
  document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
}

function select(id: string) {
  const sameGroup = mode === "row" && shown.some((s) => s.id === id);
  current = id;
  if (location.hash.slice(1) !== id) history.replaceState(null, "", `#${id}`);
  if (sameGroup) {
    const x = shown.find((s) => s.id === id)!.x;
    const pond = isPond();
    frame(x, pond ? 0.3 : STAND_TOP + 0.45, pond ? 7 : 3.3);
  } else rebuild();
  renderList();
  renderDetail();
  updateHud();
}

function setTurntable(on: boolean) {
  turntable = on;
  $("spin").setAttribute("aria-pressed", String(on));
  $("spin").textContent = on ? "Turntable: on" : "Turntable: off";
}
$("spin").onclick = () => setTurntable(!turntable);
setTurntable(true);

$("act").onclick = () => {
  const s = shown.find((x) => x.id === current);
  if (!s) return;
  if (s.piece.poke && (FOOD_BY_ID[current].category === "fish" || FOOD_BY_ID[current].category === "spot")) s.piece.poke();
  else s.spinTo = s.spinner.rotation.y + Math.PI;
};
$("reroll").onclick = () => {
  seedOf[current] = 1 + Math.floor(Math.random() * 9999);
  rebuild(true);
  renderDetail();
};
$<HTMLInputElement>("person").onchange = (e) => {
  showPerson = (e.target as HTMLInputElement).checked;
  person.visible = showPerson && isPond();
};
document.querySelectorAll<HTMLButtonElement>("#time button").forEach((b) => {
  b.onclick = () => {
    timeOfDay = b.dataset.time as typeof timeOfDay;
    applyTime();
  };
});
document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => {
  b.onclick = () => {
    mode = b.dataset.mode as typeof mode;
    rebuild();
  };
});

// Click a model in the group view to pick it.
const ray = new THREE.Raycaster();
let downAt = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener("pointerup", (e) => {
  if (mode !== "row" || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hits = ray.intersectObjects(shown.map((s) => s.holder), true);
  if (!hits.length) return;
  let o: THREE.Object3D | null = hits[0].object;
  while (o && !shown.some((s) => s.holder === o)) o = o.parent;
  const s = shown.find((x) => x.holder === o);
  if (s && s.id !== current) select(s.id);
});

// Reviews.
async function setVerdict(status: ReviewStatus) {
  const id = current;
  const note = $<HTMLTextAreaElement>("note").value.trim();
  const r: Review = { status, note, seed: seedOf[id], variant: variantOf[id], updatedAt: Date.now() };
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
  if (id in FOOD_BY_ID && id !== current) select(id);
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
      for (const d of snap.docs) {
        const data = d.data();
        if (data && d.id in FOOD_BY_ID) reviews[d.id] = data as Review;
      }
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
renderCats();
renderList();
renderDetail();
loop();
connectDb();
(window as any).__gallery = {
  select,
  ids: FOOD_TYPES.map((t) => t.id),
  setTime: (t: typeof timeOfDay) => ((timeOfDay = t), applyTime()),
  setMode: (m: typeof mode) => ((mode = m), rebuild()),
  setVariant: (v: number) => ((variantOf[current] = v), rebuild(true), renderDetail()),
  setTurntable,
  poke: () => $("act").click(),
};
