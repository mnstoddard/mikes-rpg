// The Tree Gallery: look at each tree type in 3D, try its variants, chop it
// down, and approve it (or ask for changes) before it goes into the game.
//
// Built into one HTML file by build-gallery.mjs. Reviews are saved with the
// page's shared database when it runs as a claude.ai artifact.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RESOURCES } from "../../../shared/foraging";
import { ITEMS } from "../../../shared/items";
import { TICK_MS } from "../../../shared/map";
import { ReviewStatus, TREE_KINDS, TREE_TYPES, Tree, TreeKind, createTree } from "../trees";
import { makeRng } from "../trees/common";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------

interface Review {
  status: ReviewStatus;
  note: string;
  seed?: number;
  variant?: number;
  updatedAt?: number;
}

let current: TreeKind = (location.hash.slice(1) as TreeKind) in TREE_TYPES ? (location.hash.slice(1) as TreeKind) : "pine";
const variantOf: Record<string, number> = {};
const seedOf: Record<string, number> = {};
let mode: "one" | "row" = "one";
let timeOfDay: "day" | "sunset" | "night" = "day";
let wind = 1;
let showPerson = true;
const reviews: Record<string, Review> = {};
let saveReview: ((kind: TreeKind, r: Review) => Promise<void>) | null = null;
let chops = 0;

for (const k of TREE_KINDS) {
  variantOf[k] = 0;
  seedOf[k] = 7 + TREE_KINDS.indexOf(k) * 101;
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
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
camera.position.set(9, 6, 11);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 2.4, 0);
controls.minDistance = 4;
controls.maxDistance = 95;
controls.maxPolarAngle = Math.PI * 0.49;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;
canvas.addEventListener("pointerdown", () => (controls.autoRotate = false));

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5b6b3a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -24;
sun.shadow.camera.right = 24;
sun.shadow.camera.top = 16;
sun.shadow.camera.bottom = -16;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.9);

// The sky: a soft gradient painted on a small canvas.
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
composer.addPass(bloom);
composer.addPass(new OutputPass());

// The ground: a low-poly grassy island floating in the sky.
const island = new THREE.Group();
scene.add(island);
function buildIsland(width: number) {
  island.clear();
  const rng = makeRng(99);
  const flat = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 });
  const rx = width / 2 + 3.2;
  const top = new THREE.CylinderGeometry(1, 1, 0.5, 14, 1);
  const grass = new THREE.Mesh(top, flat(0x7fb24a));
  grass.scale.set(rx, 1, 4.6);
  grass.position.y = -0.25;
  grass.receiveShadow = true;
  island.add(grass);
  const dirt = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 14, 1), flat(0x8a6a48));
  dirt.rotation.x = Math.PI;
  dirt.scale.set(rx * 0.97, 2.6, 4.4);
  dirt.position.y = -1.8;
  island.add(dirt);
  // Pebbles and grass tufts.
  for (let i = 0; i < 26 + width * 3; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.25 + rng() * 0.7;
    const x = Math.cos(a) * r * (rx - 0.5);
    const z = Math.sin(a) * r * 4.0;
    if (Math.abs(z) < 1.2 && rng() < 0.7) continue;
    const isRock = rng() < 0.35;
    const m = isRock
      ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + rng() * 0.12, 0), flat(0x9a9a92))
      : new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3 + rng() * 0.2, 3), flat(rng() < 0.5 ? 0x6a9e3c : 0x8cc055));
    m.position.set(x, isRock ? 0.04 : 0.12, z);
    m.rotation.y = rng() * 6;
    m.castShadow = true;
    island.add(m);
  }
}

// A plain stand-in person (1.8 m tall) so you can judge each tree's size.
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

// ---------- Trees on show ----------

let shown: { kind: TreeKind; tree: Tree; x: number }[] = [];

function clearTrees() {
  for (const s of shown) {
    scene.remove(s.tree.object);
    s.tree.dispose();
  }
  shown = [];
}

const SPACING = 4.4;

function rebuild(keepCamera = false) {
  clearTrees();
  chops = 0;
  if (mode === "one") {
    const tree = createTree(current, { seed: seedOf[current], variant: variantOf[current] });
    scene.add(tree.object);
    shown.push({ kind: current, tree, x: 0 });
    buildIsland(2);
    person.position.set(2.0, 0, 1.3);
    person.rotation.y = -0.6;
    if (!keepCamera) frame(0, 2.4, 13);
  } else {
    const n = TREE_KINDS.length;
    TREE_KINDS.forEach((k, i) => {
      const tree = createTree(k, { seed: seedOf[k], variant: variantOf[k] });
      const x = (i - (n - 1) / 2) * SPACING;
      tree.object.position.x = x;
      scene.add(tree.object);
      shown.push({ kind: k, tree, x });
    });
    buildIsland(n * SPACING - 2);
    person.position.set(-((n - 1) / 2) * SPACING - 2.2, 0, 1.4);
    person.rotation.y = 0.4;
    if (!keepCamera) {
      // Back off far enough that the whole row fits across the screen.
      const halfWidth = (n * SPACING) / 2 + 1.5;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      frame(0, 2.2, halfWidth / tanHalf, new THREE.Vector3(0.1, 0.28, 1));
    }
  }
  person.visible = showPerson;
  updateHud();
}

function frame(x: number, y: number, dist: number, dir = new THREE.Vector3(0.62, 0.34, 0.72)) {
  controls.target.set(x, y, 0);
  camera.position.copy(controls.target).addScaledVector(dir.normalize(), dist);
}

// ---------- Time of day ----------

const SKIES = {
  day: { top: "#8fc9ec", mid: "#cfe6ef", low: "#f4e7c9", hemi: [0xcfe8ff, 0x5b6b3a, 1.1], sun: [0xfff1d6, 2.4], pos: [8, 14, 6], exposure: 1.05, bloom: 0.3 },
  sunset: { top: "#6d7fb8", mid: "#e9a07a", low: "#f6c98a", hemi: [0xffd2b0, 0x5a4a48, 1.05], sun: [0xffa060, 2.4], pos: [-12, 4.5, 4], exposure: 1.0, bloom: 0.45 },
  night: { top: "#0b1430", mid: "#1b2950", low: "#2b3a5e", hemi: [0x5a6fae, 0x141824, 0.42], sun: [0xa9c1ff, 0.55], pos: [-5, 12, -6], exposure: 1.15, bloom: 0.95 },
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

let lastState = "";
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  for (const s of shown) s.tree.update(dt, t, wind);
  const st = shown.find((s) => s.kind === current)?.tree.state ?? "";
  if (st !== lastState) {
    lastState = st;
    updateHud();
  }
  controls.update();
  composer.render();
  requestAnimationFrame(loop);
}

// ---------- UI ----------

const STATUS_LABEL: Record<ReviewStatus, string> = { waiting: "Waiting for you", approved: "Approved", changes: "Needs changes" };

function reviewOf(k: TreeKind): Review {
  return reviews[k] ?? { status: "waiting", note: "" };
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";
  for (const k of TREE_KINDS) {
    const t = TREE_TYPES[k];
    const res = t.resource ? RESOURCES[t.resource] : null;
    const r = reviewOf(k);
    const b = document.createElement("button");
    b.className = "tree-row";
    b.setAttribute("aria-current", String(k === current));
    b.innerHTML = `<span class="swatch" style="--c:#${(res?.color ?? (k === "dead" ? 0x6e6258 : 0xe8b84a)).toString(16).padStart(6, "0")}"></span>
      <span class="tr-name"></span>
      <span class="tr-meta"></span>
      <span class="pill" data-s="${r.status}"></span>`;
    b.querySelector(".tr-name")!.textContent = t.name;
    b.querySelector(".tr-meta")!.textContent = res ? `Woodcutting ${res.level}` : k === "dead" ? "Scenery" : "Planned";
    b.querySelector(".pill")!.textContent = r.status === "waiting" ? "To review" : STATUS_LABEL[r.status];
    b.onclick = () => select(k);
    list.appendChild(b);
  }
  const approved = TREE_KINDS.filter((k) => reviewOf(k).status === "approved").length;
  $("tally").textContent = `${approved} of ${TREE_KINDS.length} approved`;
  ($("tally-bar") as HTMLElement).style.setProperty("--p", String(approved / TREE_KINDS.length));
}

function renderDetail() {
  const t = TREE_TYPES[current];
  const res = t.resource ? RESOURCES[t.resource] : null;
  $("d-name").textContent = t.name;
  $("d-about").textContent = t.about;
  $("d-grows").textContent = t.grows;
  const stats = $("d-stats");
  stats.innerHTML = "";
  const rows: [string, string][] = res
    ? [
        ["Woodcutting level", String(res.level)],
        ["XP per log", String(res.xp)],
        ["Gives", ITEMS[res.item]?.name ?? res.item],
        ["Grows back in", `${Math.round((res.respawnTicks * TICK_MS) / 1000)} s`],
      ]
    : [["In the game", current === "dead" ? "Scenery only" : "Not yet (planned)"]];
  for (const [k, v] of rows) {
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
    b.textContent = name;
    b.setAttribute("aria-pressed", String(i === variantOf[current]));
    b.onclick = () => {
      variantOf[current] = i;
      rebuild(true);
      renderDetail();
    };
    vs.appendChild(b);
  });
  $("d-seed").textContent = `Tree #${seedOf[current]}`;
  const r = reviewOf(current);
  document.querySelectorAll<HTMLButtonElement>("#verdict button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === r.status)));
  const note = $<HTMLTextAreaElement>("note");
  if (document.activeElement !== note) note.value = r.note ?? "";
  $("saved").textContent = r.updatedAt ? `Saved ${new Date(r.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
}

function updateHud() {
  const t = TREE_TYPES[current];
  $("np-name").textContent = mode === "one" ? `${t.name} · ${t.variants[variantOf[current]]}` : "All trees, side by side";
  const st = shown.find((s) => s.kind === current)?.tree.state;
  const chop = $<HTMLButtonElement>("chop");
  const label = st === "stump" ? "Grow back" : st === "falling" ? "Timber!" : st === "growing" ? "Growing…" : chops === 0 ? "Chop" : `Chop (${chops}/3)`;
  chop.querySelector("span")!.textContent = label;
  chop.disabled = st === "falling" || st === "growing";
  document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
}

function select(k: TreeKind) {
  current = k;
  if (location.hash.slice(1) !== k) history.replaceState(null, "", `#${k}`);
  chops = 0;
  if (mode === "one") rebuild();
  else {
    const x = shown.find((s) => s.kind === k)?.x ?? 0;
    controls.target.set(x, 2.6, 0);
    camera.position.set(x + 8.5, 5.5, 10);
  }
  renderList();
  renderDetail();
  updateHud();
}

$("chop").onclick = () => {
  const s = shown.find((x) => x.kind === current);
  if (!s) return;
  if (s.tree.state === "stump") {
    s.tree.regrow();
    chops = 0;
  } else if (s.tree.state === "standing") {
    s.tree.hit();
    chops++;
    if (chops >= 3) {
      setTimeout(() => s.tree.fell(), 220);
      chops = 0;
    }
  }
  updateHud();
};
$("reroll").onclick = () => {
  seedOf[current] = 1 + Math.floor(Math.random() * 9999);
  rebuild(true);
  renderDetail();
};
$<HTMLInputElement>("wind").oninput = (e) => {
  wind = Number((e.target as HTMLInputElement).value);
};
$<HTMLInputElement>("person").onchange = (e) => {
  showPerson = (e.target as HTMLInputElement).checked;
  person.visible = showPerson;
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

// Click a tree in the side-by-side view to pick it.
const ray = new THREE.Raycaster();
let downAt = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener("pointerup", (e) => {
  if (mode !== "row" || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hits = ray.intersectObjects(shown.map((s) => s.tree.object), true);
  if (!hits.length) return;
  let o: THREE.Object3D | null = hits[0].object;
  while (o && !shown.some((s) => s.tree.object === o)) o = o.parent;
  const s = shown.find((x) => x.tree.object === o);
  if (s) select(s.kind);
});

// Reviews.
async function setVerdict(status: ReviewStatus) {
  const note = $<HTMLTextAreaElement>("note").value.trim();
  const r: Review = { status, note, seed: seedOf[current], variant: variantOf[current], updatedAt: Date.now() };
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
  const k = location.hash.slice(1) as TreeKind;
  if (k in TREE_TYPES && k !== current) select(k);
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
  db.collection("reviews").onSnapshot(
    (snap: any) => {
      clearTimeout(timer);
      $("db-note").hidden = true;
      for (const d of snap.docs) {
        const data = d.data();
        if (data && d.id in TREE_TYPES) reviews[d.id] = data as Review;
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
renderList();
renderDetail();
loop();
connectDb();
(window as any).__gallery = { select, setTime: (t: typeof timeOfDay) => ((timeOfDay = t), applyTime()), setMode: (m: typeof mode) => ((mode = m), rebuild()) };
