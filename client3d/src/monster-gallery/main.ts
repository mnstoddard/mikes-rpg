// The Monster Gallery: look at every monster in 3D, at its real size next to a
// person, try its variants, play its five animations (idle, walk, attack, get
// hit, defeat), and approve it (or ask for changes) before it goes into the game.
//
// Built into one HTML file by:  node build-gallery.mjs monster
// Reviews are saved with the page's shared database when it runs as a claude.ai artifact.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createCharacter } from "../character";
import { ANIMS, Anim, MONSTER_BY_ID, MONSTER_GROUPS, MONSTER_TYPES, Monster, MonsterGroup, ReviewStatus, createMonster } from "../monsters";
import { makeRng } from "../monsters/kit";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------

interface Review {
  status: ReviewStatus;
  note: string;
  seed?: number;
  variant?: number;
  updatedAt?: number;
}

const firstId = MONSTER_TYPES[0].id;
let current: string = location.hash.slice(1) in MONSTER_BY_ID ? location.hash.slice(1) : firstId;
let filter: MonsterGroup | "all" = "all";
const variantOf: Record<string, number> = {};
const seedOf: Record<string, number> = {};
let mode: "one" | "row" = "one";
let timeOfDay: "day" | "sunset" | "night" = "day";
let showPerson = true;
let turntable = true;
let slow = false;
let cycle = false;
let baseAnim: Anim = "idle";
const reviews: Record<string, Review> = {};
let saveReview: ((id: string, r: Review) => Promise<void>) | null = null;

MONSTER_TYPES.forEach((t, i) => {
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
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 0.8;
controls.maxDistance = 160;
controls.maxPolarAngle = Math.PI * 0.49;
canvas.addEventListener("pointerdown", () => setTurntable(false));

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5b6b3a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
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

const flat = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 });

// The ground: a low-poly grassy island floating in the sky (the world's style).
const island = new THREE.Group();
scene.add(island);
function buildIsland(width: number, depth: number) {
  island.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.dispose());
  island.clear();
  const rng = makeRng(99);
  const rx = width / 2 + 1.6;
  const rz = depth / 2 + 1.4;
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 18, 1), flat(0x7fb24a));
  grass.scale.set(rx, 1, rz);
  grass.position.y = -0.25;
  grass.receiveShadow = true;
  island.add(grass);
  const dirt = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 18, 1), flat(0x8a6a48));
  dirt.rotation.x = Math.PI;
  dirt.scale.set(rx * 0.97, Math.max(2.6, rx * 0.6), rz * 0.96);
  dirt.position.y = -0.5 - Math.max(2.6, rx * 0.6) / 2;
  island.add(dirt);
  const n = Math.min(160, Math.round(20 + rx * rz * 2));
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.5 + rng() * 0.45;
    const x = Math.cos(a) * r * (rx - 0.4);
    const z = Math.sin(a) * r * (rz - 0.4);
    const isRock = rng() < 0.3;
    const m = isRock
      ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + rng() * 0.14, 0), flat(0x9a9a92))
      : new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3 + rng() * 0.2, 3), flat(rng() < 0.5 ? 0x6a9e3c : 0x8cc055));
    m.position.set(x, isRock ? 0.04 : 0.12, z);
    m.castShadow = true;
    island.add(m);
  }
  const span = Math.max(rx, rz) + 2;
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: span * 6 });
  sun.shadow.camera.updateProjectionMatrix();
}

// The smooth character from the Workshop, about 1.8 m tall, to judge sizes.
const person = createCharacter({}, { anim: "idle" });
scene.add(person.object);

// ---------- Monsters on show ----------

interface Shown {
  id: string;
  m: Monster;
  holder: THREE.Group;
  spinner: THREE.Group;
  x: number;
  box: THREE.Box3;
}
let shown: Shown[] = [];

function clearShown() {
  for (const s of shown) {
    scene.remove(s.holder);
    s.m.dispose();
  }
  shown = [];
}

/** The size of a monster, leaving out glows, water and see-through bits. */
function solidBox(o: THREE.Object3D): THREE.Box3 {
  o.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const b = new THREE.Box3();
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || ((m.material as THREE.Material).transparent && !m.userData.footprint)) return;
    m.geometry.computeBoundingBox();
    box.union(b.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld));
  });
  return box.isEmpty() ? new THREE.Box3(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 1, 0.3)) : box;
}

function display(id: string): Shown {
  const m = createMonster(id, { variant: variantOf[id], seed: seedOf[id] });
  const holder = new THREE.Group();
  const spinner = new THREE.Group();
  holder.add(spinner);
  spinner.add(m.object);
  scene.add(holder);
  const box = solidBox(m.object);
  m.play(baseAnim === "walk" ? "walk" : "idle");
  return { id, m, holder, spinner, x: 0, box };
}

function groupIds(): string[] {
  const g = MONSTER_BY_ID[current].group;
  return MONSTER_TYPES.filter((t) => t.group === g).map((t) => t.id);
}

function rebuild(keepCamera = false) {
  clearShown();
  if (mode === "one") {
    const s = display(current);
    shown.push(s);
    const size = s.box.getSize(new THREE.Vector3());
    const reach = Math.max(size.x, size.z, 1);
    buildIsland(reach + 1.6, reach + 0.6);
    person.object.position.set(Math.min(s.box.min.x, -size.z * 0.3) - 0.8, 0, Math.max(0, s.box.max.z * 0.35));
    person.object.rotation.y = 0.6;
    if (!keepCamera) frameOn(s, 0);
  } else {
    const ids = groupIds();
    const list = ids.map((id) => display(id));
    const widths = list.map((s) => Math.max(s.box.max.x - s.box.min.x, s.box.max.z - s.box.min.z) * 0.85 + 0.5);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = -total / 2;
    list.forEach((s, i) => {
      s.x = x + widths[i] / 2;
      s.holder.position.x = s.x;
      x += widths[i];
      shown.push(s);
    });
    const deep = Math.max(...list.map((s) => s.box.max.z - s.box.min.z), 1);
    buildIsland(total + 1.4, deep + 0.6);
    person.object.position.set(-total / 2 - 0.9, 0, 0.4);
    person.object.rotation.y = 0.4;
    if (!keepCamera) {
      const h = Math.max(...list.map((s) => s.m.height));
      const halfWidth = total / 2 + 1.2;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      frame(0, Math.min(h * 0.45, 2), Math.max(halfWidth / tanHalf, h * 1.6), new THREE.Vector3(0.05, 0.35, 1));
    }
  }
  person.object.visible = showPerson;
  updateHud();
}

function frameOn(s: Shown, x: number) {
  const box = s.box.clone();
  box.min.x += x;
  box.max.x += x;
  if (mode === "one" && showPerson) box.union(new THREE.Box3(new THREE.Vector3(person.object.position.x - 0.3, 0, person.object.position.z - 0.3), new THREE.Vector3(person.object.position.x + 0.3, 1.85, person.object.position.z + 0.3)));
  const size = box.getSize(new THREE.Vector3());
  const h = Math.max(s.m.height, size.y);
  const reach = Math.max(size.x, size.z * 0.8, h * 0.9, 1.1);
  frame((box.min.x + box.max.x) / 2, h * 0.42, Math.max(3, reach * 1.45 + h * 0.5));
}

function frame(x: number, y: number, dist: number, dir = new THREE.Vector3(0.6, 0.36, 0.75)) {
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
  const k = Math.max(1, (sun.shadow.camera.right ?? 10) / 8);
  sun.position.set(s.pos[0] * k, s.pos[1] * k, s.pos[2] * k);
  renderer.toneMappingExposure = s.exposure;
  bloom.strength = s.bloom;
  document.querySelectorAll<HTMLButtonElement>("#time button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.time === timeOfDay)));
}

// ---------- Animations ----------

function play(a: Anim) {
  if (a === "idle" || a === "walk") baseAnim = a;
  for (const s of shown) s.m.play(a);
  renderAnims();
}

const CYCLE: [Anim, number][] = [["idle", 2.5], ["walk", 3], ["attack", 1.8], ["hit", 1.2], ["death", 4.2]];
let cycleAt = 0, cycleI = 0;

let lastPressed = "";
function renderAnims(force = false) {
  const playing = shown[0]?.m.anim ?? baseAnim;
  if (!force && playing === lastPressed) return;
  lastPressed = playing;
  document.querySelectorAll<HTMLButtonElement>("#anims button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.anim === playing)));
}

// ---------- Loop ----------

const clock = new THREE.Clock();
let time = 0;
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
  const raw = Math.min(0.05, clock.getDelta());
  const dt = slow ? raw * 0.25 : raw;
  time += dt;
  if (cycle) {
    cycleAt += dt;
    if (cycleAt >= CYCLE[cycleI][1]) {
      cycleAt = 0;
      cycleI = (cycleI + 1) % CYCLE.length;
      const a = CYCLE[cycleI][0];
      if (a === "idle" || a === "walk") baseAnim = a;
      for (const s of shown) s.m.play(a);
    }
  }
  for (const s of shown) {
    s.m.update(dt, time);
    if (turntable) s.spinner.rotation.y += dt * 0.3;
  }
  person.update(dt, time);
  renderAnims();
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
  const opts: [MonsterGroup | "all", string][] = [["all", "All"], ...(Object.keys(MONSTER_GROUPS) as MonsterGroup[]).map((c) => [c, MONSTER_GROUPS[c].name] as [MonsterGroup, string])];
  for (const [c, name] of opts) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.setAttribute("aria-pressed", String(filter === c));
    b.onclick = () => {
      filter = c;
      renderCats();
      renderList();
      if (c !== "all" && MONSTER_BY_ID[current].group !== c) select(MONSTER_TYPES.find((t) => t.group === c)!.id);
    };
    el.appendChild(b);
  }
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";
  let lastGroup = "";
  for (const t of MONSTER_TYPES) {
    if (filter !== "all" && t.group !== filter) continue;
    if (t.group !== lastGroup) {
      lastGroup = t.group;
      const h = document.createElement("p");
      h.className = "group-head";
      const all = MONSTER_TYPES.filter((x) => x.group === t.group);
      h.textContent = `${MONSTER_GROUPS[t.group].name} · ${all.filter((x) => reviewOf(x.id).status === "approved").length} of ${all.length} approved`;
      list.appendChild(h);
    }
    const r = reviewOf(t.id);
    const b = document.createElement("button");
    b.className = "tree-row";
    b.setAttribute("aria-current", String(t.id === current));
    b.innerHTML = `<span class="swatch" style="--c:${hexColor(t.color)}"></span><span class="tr-name"></span><span class="tr-meta"></span><span class="pill" data-s="${r.status}"></span>`;
    b.querySelector(".tr-name")!.textContent = t.name;
    const lvl = t.facts().find((f) => f[0] === "Level");
    b.querySelector(".tr-meta")!.textContent = `${lvl ? `Level ${lvl[1]} · ` : ""}${t.gameId ? "In the game" : "Planned"}`;
    b.querySelector(".pill")!.textContent = r.status === "waiting" ? "To review" : STATUS_LABEL[r.status];
    b.onclick = () => select(t.id);
    list.appendChild(b);
  }
  const approved = MONSTER_TYPES.filter((t) => reviewOf(t.id).status === "approved").length;
  $("tally").textContent = `${approved} of ${MONSTER_TYPES.length} approved`;
  ($("tally-bar") as HTMLElement).style.setProperty("--p", String(approved / MONSTER_TYPES.length));
}

function renderDetail() {
  const t = MONSTER_BY_ID[current];
  $("d-name").textContent = t.name;
  $("d-cat").textContent = `${MONSTER_GROUPS[t.group].name} · ${t.gameId ? "in the game" : "planned"}`;
  $("d-about").textContent = t.about;
  $("d-grows").textContent = t.where;
  const stats = $("d-stats");
  stats.innerHTML = "";
  for (const [k, v] of t.facts()) {
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

function updateHud() {
  const t = MONSTER_BY_ID[current];
  $("np-name").textContent = mode === "one" ? `${t.name} · ${t.variants[variantOf[current]]}` : MONSTER_GROUPS[t.group].name;
  document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
}

function select(id: string) {
  const sameGroup = mode === "row" && shown.some((s) => s.id === id);
  current = id;
  if (location.hash.slice(1) !== id) history.replaceState(null, "", `#${id}`);
  if (sameGroup) {
    const s = shown.find((x) => x.id === id)!;
    frameOn(s, s.x);
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

{
  const bar = $("anims");
  for (const [a, label] of ANIMS) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.anim = a;
    b.textContent = label;
    b.onclick = () => {
      if (cycle) setCycle(false);
      play(a);
    };
    bar.appendChild(b);
  }
  renderAnims(true);
}
function setCycle(on: boolean) {
  cycle = on;
  $<HTMLInputElement>("cycle").checked = on;
  if (on) {
    cycleI = 0;
    cycleAt = 0;
    play("idle");
  }
}
$<HTMLInputElement>("cycle").onchange = (e) => setCycle((e.target as HTMLInputElement).checked);
$<HTMLInputElement>("slow").onchange = (e) => (slow = (e.target as HTMLInputElement).checked);
$<HTMLInputElement>("person").onchange = (e) => {
  showPerson = (e.target as HTMLInputElement).checked;
  person.object.visible = showPerson;
};
$("reroll").onclick = () => {
  seedOf[current] = 1 + Math.floor(Math.random() * 9999);
  rebuild(true);
  renderDetail();
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

// Click a monster in the group view to pick it.
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
  if (id in MONSTER_BY_ID && id !== current) select(id);
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
        if (data && d.id in MONSTER_BY_ID) {
          reviews[d.id] = data as Review;
          // Show the variant Mike picked.
          if (typeof data.variant === "number" && d.id !== current) variantOf[d.id] = data.variant;
        }
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

rebuild();
applyTime();
renderCats();
renderList();
renderDetail();
loop();
connectDb();
(window as any).__gallery = {
  select,
  ids: MONSTER_TYPES.map((t) => t.id),
  setTime: (t: typeof timeOfDay) => ((timeOfDay = t), applyTime()),
  setMode: (m: typeof mode) => ((mode = m), rebuild()),
  setVariant: (v: number) => ((variantOf[current] = v), rebuild(true), renderDetail()),
  setTurntable,
  play,
};
