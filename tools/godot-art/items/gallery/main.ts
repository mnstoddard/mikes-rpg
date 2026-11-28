// The Items Gallery: browse every Godot item model, spin it, swap its metal / wood / gem, and see it at real size.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { METALS, WOODS, JEWELS, GEMS } from "../kit";

interface Entry { id: string; name: string; cat: string; about: string; game: string[]; swaps?: string[]; held?: boolean; file: string; bytes: number; tris: number; materials: string[]; size: number[] }
const CATALOG: Entry[] = (window as any).CATALOG;
const $ = (s: string) => document.querySelector(s) as HTMLElement;

// ---------- 3D viewer ----------
const canvas = $("#view") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = env;
const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.6;
const sun = new THREE.DirectionalLight(0xfff1dc, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.radius = 4;
const hemi = new THREE.HemisphereLight(0xbfe2f7, 0xa9c79a, 0.5);
scene.add(sun, sun.target, hemi);
const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x8cc46a, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
// A simple 1.75 m figure for scale.
const figMat = new THREE.MeshStandardMaterial({ color: 0xc9d6e2, roughness: 0.8, transparent: true, opacity: 0.55 });
const person = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.95, 6, 16), figMat); body.position.y = 0.2 + 0.475 + 0.02;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), figMat); head.position.y = 1.62;
person.add(body, head);
scene.add(person);

const SKY = {
  noon: { top: 0x3f86db, hor: 0xbfe2f7, sun: 0xfff1dc, e: 2.0, amb: 0.5, env: 0.7, elev: 50 },
  dusk: { top: 0x46519c, hor: 0xf59a6b, sun: 0xff9e5e, e: 1.2, amb: 0.35, env: 0.45, elev: 14 },
  night: { top: 0x0e1736, hor: 0x2b3b6e, sun: 0xafc4ff, e: 0.45, amb: 0.2, env: 0.18, elev: 60 },
};
type Time = keyof typeof SKY;
function skyTex(top: number, hor: number) {
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#" + new THREE.Color(top).getHexString());
  g.addColorStop(1, "#" + new THREE.Color(hor).getHexString());
  x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let time: Time = "noon";
function setTime(t: Time) {
  time = t;
  const s = SKY[t];
  scene.background = skyTex(s.top, s.hor);
  sun.color.setHex(s.sun); sun.intensity = s.e;
  hemi.intensity = s.amb;
  scene.environmentIntensity = s.env;
  ground.material.color.setHex(t === "night" ? 0x3c5a3c : 0x8cc46a);
  placeSun();
  document.querySelectorAll<HTMLButtonElement>("[data-time]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.time === t)));
}
let radius = 1;
function placeSun() {
  const el = (SKY[time].elev * Math.PI) / 180;
  const d = radius * 4;
  sun.position.set(Math.cos(el) * d * 0.6, Math.sin(el) * d, Math.cos(el) * d * 0.8);
  sun.target.position.set(0, 0, 0);
  const cam = sun.shadow.camera as THREE.OrthographicCamera;
  cam.left = cam.bottom = -radius * 1.6; cam.right = cam.top = radius * 1.6; cam.near = 0.01; cam.far = d * 3;
  cam.updateProjectionMatrix();
}

function resize() {
  const r = canvas.parentElement!.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement!);

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();
let current: THREE.Object3D | null = null;
let currentEntry: Entry | null = null;
let showPerson = false;
const pick: Record<string, string> = { metal: "iron", wood: "oak", jewel: "gold", gem: "ruby" };

function frame() {
  if (!current || !currentEntry) return;
  const box = new THREE.Box3().setFromObject(current);
  if (showPerson) box.union(new THREE.Box3().setFromObject(person));
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  radius = Math.max(size.length() / 2, 0.05);
  controls.target.copy(c);
  const dir = new THREE.Vector3(0.9, 0.55, 1.2).normalize();
  camera.position.copy(c).addScaledVector(dir, (radius / Math.sin((16 * Math.PI) / 180)) * 1.0);
  camera.near = radius / 50; camera.far = radius * 40; camera.updateProjectionMatrix();
  ground.scale.setScalar(Math.max(radius * 3, 2.2));
  placeSun();
}

function place(obj: THREE.Object3D, e: Entry) {
  // held items are shown standing up on their lowest point, like on a weapon rack; others sit as built
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  obj.position.y = -box.min.y + 0.002;
  if (e.held) obj.position.x = 0;
  person.position.set(Math.max(0.45, (box.max.x - box.min.x) / 2 + 0.35), 0, -0.1);
}

function applySwaps(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !(o as THREE.Mesh).isMesh) return;
    const base = (m.userData.base ??= { color: m.color.getHex(), rough: m.roughness, metal: m.metalness, em: m.emissive.getHex(), ei: m.emissiveIntensity });
    void base;
    const name = m.name;
    if ((name === "metal" || name === "metal_dark") && currentEntry?.swaps?.includes("metal")) {
      const l = METALS[pick.metal as keyof typeof METALS];
      m.color.setHex(name === "metal" ? l.color : l.dark); m.roughness = l.rough + (name === "metal_dark" ? 0.1 : 0); m.metalness = l.metal;
      m.emissive.setHex(l.emissive ?? 0); m.emissiveIntensity = l.glow ?? 0;
    } else if ((name === "wood" || name === "bark") && currentEntry?.swaps?.includes("wood")) {
      const l = WOODS[pick.wood as keyof typeof WOODS];
      m.color.setHex(name === "wood" ? l.wood : l.bark); m.metalness = l.metal ?? 0;
      m.emissive.setHex(l.emissive ?? 0); m.emissiveIntensity = (l.glow ?? 0) * (name === "bark" ? 0.5 : 1);
    } else if (name === "jewel_metal" && currentEntry?.swaps?.includes("jewel")) {
      const l = JEWELS[pick.jewel as keyof typeof JEWELS];
      m.color.setHex(l.color); m.roughness = l.rough; m.metalness = l.metal;
    } else if (name === "gem" && currentEntry?.swaps?.includes("gem")) {
      const g = GEMS[pick.gem];
      m.color.setHex(g.color); m.emissive.setHex(g.color);
    }
  });
}

async function show(e: Entry) {
  currentEntry = e;
  document.querySelectorAll(".card").forEach((c) => c.setAttribute("aria-current", String((c as HTMLElement).dataset.id === e.id)));
  $("#v-name").textContent = e.name;
  $("#v-cat").textContent = e.cat;
  $("#v-about").textContent = e.about;
  $("#v-tris").textContent = e.tris.toLocaleString();
  $("#v-size").textContent = e.size.map((v) => (v < 1 ? `${Math.round(v * 100)} cm` : `${v.toFixed(2)} m`)).join(" × ");
  $("#v-kb").textContent = `${Math.round(e.bytes / 1024)} KB`;
  $("#v-file").textContent = "godot/assets/items/" + e.file;
  $("#v-game").textContent = e.game.join(", ");
  $("#v-held").textContent = e.held ? "Held: origin at the grip, points up +Y" : "Sits on the ground: origin at its base";
  buildSwaps(e);
  $("#loading").hidden = false;
  let g = cache.get(e.id);
  if (!g) {
    // the page host only serves web file types, so each .glb is published as base64 text
    const txt = await (await fetch("glb/" + e.file.replace(/\.glb$/, ".txt"))).text();
    const bin = Uint8Array.from(atob(txt.trim()), (ch) => ch.charCodeAt(0));
    const gltf = await loader.parseAsync(bin.buffer, "");
    g = gltf.scene;
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    cache.set(e.id, g);
  }
  if (currentEntry !== e) return;
  $("#loading").hidden = true;
  if (current) scene.remove(current);
  current = g;
  scene.add(g);
  place(g, e);
  applySwaps(g);
  frame();
}

function swatchRow(label: string, key: string, options: [string, { name: string; color?: number; wood?: number }][]) {
  const row = document.createElement("div");
  row.className = "swrow";
  const l = document.createElement("span"); l.className = "swlabel"; l.textContent = label; row.append(l);
  const wrap = document.createElement("div"); wrap.className = "swatches";
  for (const [id, v] of options) {
    const b = document.createElement("button");
    b.className = "sw";
    b.type = "button";
    b.title = v.name;
    b.setAttribute("aria-label", `${label}: ${v.name}`);
    b.setAttribute("aria-pressed", String(pick[key] === id));
    b.style.setProperty("--c", "#" + new THREE.Color(v.color ?? v.wood ?? 0).getHexString());
    b.innerHTML = `<i></i><span>${v.name}</span>`;
    b.onclick = () => { pick[key] = id; wrap.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); if (current) applySwaps(current); };
    wrap.append(b);
  }
  row.append(wrap);
  return row;
}
function buildSwaps(e: Entry) {
  const box = $("#swaps");
  box.replaceChildren();
  const s = e.swaps ?? [];
  if (s.includes("metal")) box.append(swatchRow("Metal", "metal", Object.entries(METALS)));
  if (s.includes("wood")) box.append(swatchRow("Wood", "wood", Object.entries(WOODS)));
  if (s.includes("jewel")) box.append(swatchRow("Jewel metal", "jewel", Object.entries(JEWELS)));
  if (s.includes("gem")) box.append(swatchRow("Gem", "gem", Object.entries(GEMS)));
  box.hidden = !s.length;
}

// ---------- Catalogue ----------
const cats = [...new Set(CATALOG.map((e) => e.cat))];
let activeCat = "All";
function renderChips() {
  const bar = $("#chips");
  bar.replaceChildren();
  for (const c of ["All", ...cats]) {
    const n = c === "All" ? CATALOG.length : CATALOG.filter((e) => e.cat === c).length;
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip";
    b.setAttribute("aria-pressed", String(c === activeCat));
    b.innerHTML = `${c}<b>${n}</b>`;
    b.onclick = () => { activeCat = c; renderChips(); renderGrid(); };
    bar.append(b);
  }
}
function renderGrid() {
  const grid = $("#grid");
  grid.replaceChildren();
  const groups = activeCat === "All" ? cats : [activeCat];
  for (const c of groups) {
    const sec = document.createElement("section");
    sec.className = "group";
    sec.innerHTML = `<h3>${c}</h3>`;
    const list = document.createElement("div");
    list.className = "cards";
    for (const e of CATALOG.filter((x) => x.cat === c)) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "card"; b.dataset.id = e.id;
      b.setAttribute("aria-current", String(currentEntry?.id === e.id));
      b.innerHTML = `<img src="thumbs/${e.id}.png" alt="" loading="lazy" width="192" height="192"><span class="cn">${e.name}</span><span class="ct">${e.tris.toLocaleString()} tris</span>`;
      b.onclick = () => { show(e); if (window.innerWidth < 900) $("#viewer").scrollIntoView({ behavior: "smooth", block: "start" }); };
      list.append(b);
    }
    sec.append(list);
    grid.append(sec);
  }
}

$("#count").textContent = `${CATALOG.length} models`;
document.querySelectorAll<HTMLButtonElement>("[data-time]").forEach((b) => (b.onclick = () => setTime(b.dataset.time as Time)));
const spin = $("#spin") as HTMLButtonElement;
spin.onclick = () => { controls.autoRotate = !controls.autoRotate; spin.setAttribute("aria-pressed", String(controls.autoRotate)); };
const per = $("#person") as HTMLButtonElement;
per.onclick = () => { showPerson = !showPerson; person.visible = showPerson; per.setAttribute("aria-pressed", String(showPerson)); frame(); };
person.visible = false;
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { controls.autoRotate = false; spin.setAttribute("aria-pressed", "false"); }

renderChips();
renderGrid();
setTime("noon");
resize();
show(CATALOG.find((e) => e.id === "sword") ?? CATALOG[0]);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
