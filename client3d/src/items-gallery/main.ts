// The Items Gallery: look at every tool, material, find, loot drop, potion,
// gem, quest item and workshop prop in 3D, try its options (metal, wood,
// gem...), try its action, and approve it (or ask for changes) before it goes
// into the game.
//
// Built into one HTML file by build-gallery.mjs ("node build-gallery.mjs items").
// Reviews are saved with the page's shared database when it runs as a
// claude.ai artifact.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ITEMS } from "../../../shared/items";
import { GROUP_IDS, ITEM_GROUPS, ITEM_LIST, ITEM_TYPES, HeldMove, Item, ItemGroup, ReviewStatus, createItem } from "../items";
import { makeRng } from "../trees/common";
import { createCharacter } from "../character";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------

interface Review {
  status: ReviewStatus;
  note: string;
  choice?: number[];
  updatedAt?: number;
}

const fromHash = location.hash.slice(1);
let current: string = fromHash in ITEM_TYPES ? fromHash : ITEM_LIST[0].id;
let group: ItemGroup = ITEM_TYPES[current].group;
const choiceOf: Record<string, number[]> = {};
for (const t of ITEM_LIST) choiceOf[t.id] = t.options.map(() => 0);
// Start tools on something nicer than stone and pine.
// Start tools on iron (bronze is the first metal) with an oak handle.
for (const id of ["axe", "pickaxe", "shovel", "hammer"]) choiceOf[id] = [1, 1];
for (const id of ["tongs", "pot"]) choiceOf[id] = [1];
let mode: "one" | "row" = "one";
let timeOfDay: "day" | "sunset" | "night" = "day";
let showPerson = true;
let inHand = false;
let spin = true;
const reviews: Record<string, Review> = {};
let saveReview: ((id: string, r: Review) => Promise<void>) | null = null;

// ---------- Scene ----------

const canvas = $<HTMLCanvasElement>("cv");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
// Soft reflections, so metal looks like metal instead of black.
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(35, 1, 0.02, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 0.3;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.49;

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5b6b3a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 6;
sun.shadow.camera.bottom = -6;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.4, 1.6);
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

const flat = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 });

// The ground: a grassy island floating in the sky (like the Tree Gallery).
const island = new THREE.Group();
scene.add(island);
function buildIsland(width: number) {
  island.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  island.clear();
  const rng = makeRng(99);
  const rx = width / 2 + 2;
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.4, 14, 1), flat(0x7fb24a));
  grass.scale.set(rx, 1, 3);
  grass.position.y = -0.2;
  grass.receiveShadow = true;
  island.add(grass);
  const dirt = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 14, 1), flat(0x8a6a48));
  dirt.rotation.x = Math.PI;
  dirt.scale.set(rx * 0.97, 1.8, 2.9);
  dirt.position.y = -1.3;
  island.add(dirt);
  for (let i = 0; i < 20 + width * 3; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.45 + rng() * 0.5;
    const x = Math.cos(a) * r * (rx - 0.4);
    const z = Math.sin(a) * r * 2.7;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22 + rng() * 0.15, 3), flat(rng() < 0.5 ? 0x6a9e3c : 0x8cc055));
    tuft.position.set(x, 0.1, z);
    tuft.castShadow = true;
    island.add(tuft);
  }
}

// A display table for small things, with a cloth on top.
const TABLE_H = 0.78;
function makeTable(w: number, d = 0.7) {
  const g = new THREE.Group();
  const wood = flat(0x9a6a3e);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), wood);
  top.position.y = TABLE_H - 0.025;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.006, d - 0.14), flat(0x3f6e64));
  cloth.position.y = TABLE_H + 0.003;
  g.add(top, cloth);
  for (const x of [-w / 2 + 0.07, w / 2 - 0.07]) for (const z of [-d / 2 + 0.07, d / 2 - 0.07]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, TABLE_H - 0.05, 0.06), wood);
    leg.position.set(x, (TABLE_H - 0.05) / 2, z);
    leg.castShadow = true;
    g.add(leg);
  }
  top.castShadow = top.receiveShadow = cloth.receiveShadow = true;
  return g;
}
let table: THREE.Group | null = null;

// The person for size: the game's own character (1.7 m or so).
const person = createCharacter({}, { anim: "idle" });
scene.add(person.object);

// ---------- Items on show ----------

let shown: { id: string; item: Item; x: number; holder: THREE.Group }[] = [];

function clearItems() {
  for (const s of shown) {
    s.holder.removeFromParent();
    s.item.dispose();
  }
  shown = [];
  if (table) {
    scene.remove(table);
    table.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    table = null;
  }
}

/** Where an item sits: on the table (small), on the ground (big), or in the hand. */
function place(id: string, x: number): { item: Item; holder: THREE.Group } {
  const t = ITEM_TYPES[id];
  const item = createItem(id, { seed: 7, choice: choiceOf[id] });
  const holder = new THREE.Group();
  holder.add(item.object);
  if (t.size === "big") {
    holder.position.set(x, 0, 0);
    scene.add(holder);
  } else if (mode === "one" && inHand && t.size === "held") {
    person.joints.handR.add(holder);
    // The hand's +Y runs up the forearm and +Z is the back of the fist.
    // A shovel carries on past the fingers (blade facing forward). Everything
    // else sticks out of the fist like a hammer: handle along +Z, with the
    // blade or head (the tool's +X) facing the way it swings.
    if (item.heldMove === "dig") holder.quaternion.identity();
    else holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
    // Put the grip in the palm.
    holder.position.copy(item.grip ?? new THREE.Vector3()).applyQuaternion(holder.quaternion).multiplyScalar(-1);
  } else {
    // Held tools lie down on the table, so they fit.
    if (t.size === "held") {
      const box = new THREE.Box3().setFromObject(item.object);
      const len = box.max.y - box.min.y;
      item.object.rotation.z = Math.PI / 2;
      item.object.position.set(len / 2 - 0.05, 0.03, 0);
      const inner = new THREE.Group();
      holder.add(inner);
      inner.add(item.object);
    }
    holder.position.set(x, TABLE_H + 0.006, 0);
    scene.add(holder);
  }
  return { item, holder };
}

const SPACING = 0.55;
const BIG_SPACING = 2.0;

function rebuild(keepCamera = false) {
  clearItems();
  armMove = null;
  const t = ITEM_TYPES[current];
  if (mode === "one") {
    const { item, holder } = place(current, 0);
    shown.push({ id: current, item, x: 0, holder });
    const held = inHand && t.size === "held";
    if (t.size !== "big" && !held) {
      table = makeTable(t.size === "held" ? 2.0 : 1.0);
      scene.add(table);
    }
    buildIsland(t.size === "big" ? 3 : 2);
    // Stand behind and beside the table (or the prop), looking at it.
    person.object.position.set(held ? 0 : t.size === "big" ? 1.5 : t.size === "held" ? 1.25 : 0.75, 0, held ? 0 : -0.75);
    person.object.rotation.y = held ? 0.5 : -0.35;
    person.setAnim(held ? null : "idle");
    if (held) poseHolding();
  } else {
    const ids = ITEM_LIST.filter((x) => x.group === group).map((x) => x.id);
    const big = ITEM_TYPES[ids[0]].size === "big";
    const gap = big ? BIG_SPACING : ITEM_LIST.find((x) => x.id === ids[0])!.size === "held" ? 0.32 : SPACING;
    // Small things go in a grid on the table, so they're big enough to see; tools and props in one row.
    const grid = !big && ITEM_TYPES[ids[0]].size === "small";
    const cols = grid ? Math.min(ids.length, Math.ceil(Math.sqrt(ids.length * 2.2))) : ids.length;
    const rows = Math.ceil(ids.length / cols);
    const width = (cols - 1) * gap;
    const depth = grid ? 0.34 : 0;
    ids.forEach((id, i) => {
      const x = (i % cols) * gap - width / 2;
      const z = (Math.floor(i / cols) - (rows - 1) / 2) * depth;
      const { item, holder } = place(id, x);
      holder.position.z = z;
      // Tools lie across the table, side by side.
      if (ITEM_TYPES[id].size === "held") holder.rotation.y = Math.PI / 2;
      shown.push({ id, item, x, holder });
    });
    if (!big) {
      table = makeTable(width + 1.0, Math.max(0.7, rows * depth + 0.3));
      scene.add(table);
    }
    buildIsland(width + (big ? 2 : 1));
    person.object.position.set(width / 2 + (big ? 2 : 0.9), 0, -0.4 - rows * depth / 2);
    person.object.rotation.y = -0.35;
    person.setAnim("idle");
  }
  person.object.visible = showPerson || (inHand && t.size === "held" && mode === "one");
  if (!keepCamera) frameShown();
  updateHud();
}

// ---------- Swinging a tool in the hand ----------

/** Right shoulder and elbow angles (rotation.x) through each move: [time 0-1, shoulder, elbow]. */
const ARM_MOVES: Record<HeldMove | "hold", { seconds: number; keys: [number, number, number][] }> = {
  hold: { seconds: 1, keys: [[0, -0.9, -0.6], [1, -0.9, -0.6]] },
  // Lift it high over the shoulder, bring it down hard in front, come back.
  chop: { seconds: 0.95, keys: [[0, -0.9, -0.6], [0.4, -2.9, -1.0], [0.58, -0.35, -0.05], [0.7, -0.4, -0.1], [1, -0.9, -0.6]] },
  // A short, quick hammer blow.
  strike: { seconds: 0.6, keys: [[0, -0.9, -0.6], [0.35, -1.8, -1.3], [0.55, -0.6, -0.15], [1, -0.9, -0.6]] },
  // Push the blade down into the ground, then lift the scoop.
  dig: { seconds: 1.2, keys: [[0, -0.7, -0.1], [0.35, -0.4, 0], [0.5, -0.4, 0], [0.8, -1.3, -0.7], [1, -0.7, -0.1]] },
  // Back over the shoulder, then flick forward.
  cast: { seconds: 1.2, keys: [[0, -1.0, -0.5], [0.35, -2.9, -0.7], [0.6, -1.0, -0.1], [1, -1.0, -0.5]] },
};
let armMove: { move: HeldMove; t: number; frozen?: boolean } | null = null;

function armAngles(move: HeldMove | "hold", f: number): [number, number] {
  const keys = ARM_MOVES[move].keys;
  let i = 0;
  while (i < keys.length - 2 && f > keys[i + 1][0]) i++;
  const [t0, s0, e0] = keys[i];
  const [t1, s1, e1] = keys[i + 1];
  const k = Math.min(1, Math.max(0, (f - t0) / Math.max(1e-6, t1 - t0)));
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  return [s0 + (s1 - s0) * e, e0 + (e1 - e0) * e];
}

/** Hold the tool out in front, or move the arm through its swing. */
function poseHolding(dt = 0) {
  const J = person.joints;
  const s = shown[0];
  const rest = (s?.item.heldMove ?? "hold") === "dig" ? "dig" : s?.item.heldMove === "cast" ? "cast" : "hold";
  let sh: number, el: number;
  if (armMove) {
    if (!armMove.frozen) armMove.t += dt / ARM_MOVES[armMove.move].seconds;
    const f = Math.min(1, armMove.t);
    [sh, el] = armAngles(armMove.move, f);
    s?.item.follow?.(f);
    if (f >= 1) armMove = null;
  } else [sh, el] = armAngles(rest, 0);
  J.shR.rotation.set(sh, 0, -0.2);
  J.elR.rotation.set(el, 0, 0);
  J.shL.rotation.set(0, 0, 0.12);
  J.elL.rotation.set(-0.14, 0, 0);
}

/** Point the camera so everything on show fits. */
function frameShown() {
  const box = new THREE.Box3();
  if (mode === "one" && inHand && ITEM_TYPES[current].size === "held") box.setFromObject(person.object);
  for (const s of shown) box.expandByObject(s.holder);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(0.08, size.length() / 2);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fit = Math.max(radius / Math.sin(fov / 2), (size.x / 2 + 0.1) / Math.tan(fov / 2) / Math.max(0.5, camera.aspect));
  const dir = mode === "row" ? new THREE.Vector3(0, 0.75, 1) : new THREE.Vector3(0.55, 0.55, 0.75);
  controls.target.copy(centre);
  camera.position.copy(centre).addScaledVector(dir.normalize(), fit * (mode === "row" ? 1.05 : 1.7));
  controls.minDistance = Math.max(0.15, radius * 0.6);
}

// ---------- Time of day ----------

const SKIES = {
  day: { top: "#8fc9ec", mid: "#cfe6ef", low: "#f4e7c9", hemi: [0xcfe8ff, 0x5b6b3a, 1.1], sun: [0xfff1d6, 2.4], pos: [4, 7, 5], exposure: 1.05, bloom: 0.25 },
  sunset: { top: "#6d7fb8", mid: "#e9a07a", low: "#f6c98a", hemi: [0xffd2b0, 0x5a4a48, 1.05], sun: [0xffa060, 2.4], pos: [-6, 2.5, 3], exposure: 1.0, bloom: 0.4 },
  night: { top: "#0b1430", mid: "#1b2950", low: "#2b3a5e", hemi: [0x5a6fae, 0x141824, 0.42], sun: [0xa9c1ff, 0.55], pos: [-3, 6, -3], exposure: 1.15, bloom: 0.9 },
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

let lastLabel = "";
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  for (const s of shown) {
    s.item.update(dt, t);
    // Small things on the table slowly turn so you see every side.
    if (spin && mode === "one" && s.holder.parent === scene && ITEM_TYPES[s.id].size !== "big") s.holder.rotation.y += dt * 0.35;
  }
  person.update(dt, t);
  if (mode === "one" && inHand && ITEM_TYPES[current].size === "held") poseHolding(dt);
  const label = shown.find((s) => s.id === current)?.item.actLabel ?? "";
  if (label !== lastLabel) {
    lastLabel = label;
    updateHud();
  }
  controls.update();
  composer.render();
  requestAnimationFrame(loop);
}

// ---------- UI ----------

const STATUS_LABEL: Record<ReviewStatus, string> = { waiting: "To review", approved: "Approved", changes: "Needs changes" };
const reviewOf = (id: string): Review => reviews[id] ?? { status: "waiting", note: "" };

function renderGroups() {
  const box = $("groups");
  box.innerHTML = "";
  for (const g of GROUP_IDS) {
    const ids = ITEM_LIST.filter((t) => t.group === g).map((t) => t.id);
    const ok = ids.filter((id) => reviewOf(id).status === "approved").length;
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-pressed", String(g === group));
    b.innerHTML = `<span></span><span class="n"></span>`;
    b.children[0].textContent = ITEM_GROUPS[g].name;
    b.children[1].textContent = `${ok}/${ids.length}`;
    b.onclick = () => {
      group = g;
      const first = ITEM_LIST.find((t) => t.group === g)!.id;
      select(first);
    };
    box.appendChild(b);
  }
  $("group-about").textContent = ITEM_GROUPS[group].about;
}

function renderList() {
  renderGroups();
  const list = $("list");
  list.innerHTML = "";
  for (const t of ITEM_LIST.filter((x) => x.group === group)) {
    const r = reviewOf(t.id);
    const b = document.createElement("button");
    b.className = "item-row";
    b.type = "button";
    b.setAttribute("aria-current", String(t.id === current));
    b.innerHTML = `<span class="swatch"></span><span class="tr-name"></span><span class="tr-meta"></span><span class="pill" data-s="${r.status}"></span>`;
    (b.querySelector(".swatch") as HTMLElement).style.setProperty("--c", r.status === "approved" ? "var(--ok)" : r.status === "changes" ? "var(--warn)" : "var(--line)");
    b.querySelector(".tr-name")!.textContent = t.name;
    b.querySelector(".tr-meta")!.textContent = t.options.length ? t.options.map((o) => `${o.options.length} ${o.label.toLowerCase()}`).join(" · ") : t.size === "big" ? "Stands in the world" : "One look";
    b.querySelector(".pill")!.textContent = STATUS_LABEL[r.status];
    b.onclick = () => select(t.id);
    list.appendChild(b);
  }
  const approved = ITEM_LIST.filter((t) => reviewOf(t.id).status === "approved").length;
  $("tally").textContent = `${approved} of ${ITEM_LIST.length} approved`;
  $("tally-bar").style.setProperty("--p", String(approved / ITEM_LIST.length));
}

function renderDetail() {
  const t = ITEM_TYPES[current];
  $("d-name").textContent = t.name;
  $("d-about").textContent = t.about;
  const stats = $("d-stats");
  stats.innerHTML = "";
  const gid = t.gameItem?.(choiceOf[current]);
  const def = gid && gid in ITEMS ? ITEMS[gid as keyof typeof ITEMS] : undefined;
  const rows: [string, string][] = def ? [["In the game", def.name], ["Shop pays", `${def.sellPrice} bronze`]] : [["In the game", t.size === "big" ? "A station in the world" : "Not an item yet"]];
  for (const [k, v] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    stats.append(dt, dd);
  }
  const box = $("d-options");
  box.innerHTML = "";
  t.options.forEach((o, oi) => {
    const wrap = document.createElement("div");
    wrap.className = "opt";
    const lab = document.createElement("p");
    lab.className = "label";
    lab.style.margin = "0";
    lab.textContent = o.label;
    const chips = document.createElement("div");
    chips.className = "chips";
    o.options.forEach((name, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.setAttribute("aria-pressed", String(choiceOf[current][oi] === i));
      b.onclick = () => {
        choiceOf[current][oi] = i;
        rebuild(true);
        renderDetail();
      };
      chips.appendChild(b);
    });
    wrap.append(lab, chips);
    box.appendChild(wrap);
  });
  const r = reviewOf(current);
  document.querySelectorAll<HTMLButtonElement>("#verdict button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === r.status)));
  const note = $<HTMLTextAreaElement>("note");
  if (document.activeElement !== note) note.value = r.note ?? "";
  $("saved").textContent = r.updatedAt ? `Saved ${new Date(r.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
}

function choiceName(id: string) {
  const t = ITEM_TYPES[id];
  return t.options.map((o, i) => o.options[choiceOf[id][i]]).join(" · ");
}

function updateHud() {
  const t = ITEM_TYPES[current];
  $("np-kicker").textContent = ITEM_GROUPS[t.group].name;
  const extra = choiceName(current);
  $("np-name").textContent = mode === "one" ? (extra ? `${t.name} · ${extra}` : t.name) : `All ${ITEM_GROUPS[group].name.toLowerCase()}`;
  const act = $<HTMLButtonElement>("act");
  const s = shown.find((x) => x.id === current);
  act.querySelector("span")!.textContent = s?.item.actLabel ?? "Drop";
  act.disabled = !s;
  $("hold-wrap").hidden = t.size !== "held" || mode !== "one";
  document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
}

function select(id: string) {
  current = id;
  group = ITEM_TYPES[id].group;
  if (location.hash.slice(1) !== id) history.replaceState(null, "", `#${id}`);
  if (mode === "one" || !shown.some((s) => s.id === id)) rebuild();
  else {
    const s = shown.find((x) => x.id === id)!;
    const p = new THREE.Vector3();
    s.holder.getWorldPosition(p);
    const big = ITEM_TYPES[id].size === "big";
    controls.target.set(p.x, big ? 0.8 : TABLE_H + 0.1, 0);
    camera.position.set(p.x + (big ? 2.2 : 0.5), big ? 2.0 : TABLE_H + 0.55, big ? 3.2 : 0.8);
  }
  renderList();
  renderDetail();
  updateHud();
}

/** The action button. Tools you swing are swung by the character, so they go into the hand first. */
function doAction() {
  let s = shown.find((x) => x.id === current);
  if (s?.item.heldMove) {
    if (mode !== "one" || !inHand) {
      mode = "one";
      inHand = true;
      $<HTMLInputElement>("hold").checked = true;
      rebuild();
      s = shown.find((x) => x.id === current);
    }
    if (s?.item.heldMove && !armMove) armMove = { move: s.item.heldMove, t: 0 };
  } else s?.item.act();
  updateHud();
}
$("act").onclick = doAction;
$<HTMLInputElement>("person").onchange = (e) => {
  showPerson = (e.target as HTMLInputElement).checked;
  rebuild(true);
};
$<HTMLInputElement>("hold").onchange = (e) => {
  inHand = (e.target as HTMLInputElement).checked;
  rebuild();
};
$<HTMLInputElement>("spin").onchange = (e) => {
  spin = (e.target as HTMLInputElement).checked;
  controls.autoRotate = false;
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

// Click an item in the whole-group view to pick it.
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
  if (s) select(s.id);
});

// Reviews.
async function setVerdict(status: ReviewStatus) {
  const note = $<HTMLTextAreaElement>("note").value.trim();
  const r: Review = { status, note, choice: [...choiceOf[current]], updatedAt: Date.now() };
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
  const k = location.hash.slice(1);
  if (k in ITEM_TYPES && k !== current) select(k);
});

async function connectDb() {
  const c = (window as any).claude;
  if (!c?.use) return;
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
        if (data && d.id in ITEM_TYPES) reviews[d.id] = data as Review;
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
(window as any).__gallery = {
  select,
  setTime: (t: typeof timeOfDay) => ((timeOfDay = t), applyTime()),
  setMode: (m: typeof mode) => ((mode = m), rebuild()),
  setHold: (h: boolean) => ((inHand = h), rebuild()),
  setChoice: (c: number[]) => ((choiceOf[current] = c), rebuild(true), renderDetail()),
  act: doAction,
  /** For testing: hold the arm still partway (0-1) through the current tool's move. */
  armAt: (f: number) => {
    const m = shown[0]?.item.heldMove;
    armMove = m ? { move: m, t: f, frozen: true } : null;
  },
  camera,
  controls,
  ids: ITEM_LIST.map((t) => t.id),
};
