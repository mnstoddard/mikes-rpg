// The Armor Gallery: look at every armor piece in 3D, worn by the smooth
// character or on a stand, try its styles, and approve it (or ask for
// changes) before it goes into the game.
//
// Built into one HTML file by build-gallery.mjs ("node build-gallery.mjs armor").
// Reviews are saved with the page's shared database when it runs as a claude.ai artifact.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CHARACTER_PRESETS, Character, CharacterAnim, createCharacter } from "../character";
import { ARMOR_BY_ID, ARMOR_ENTRIES, ARMOR_SETS, ArmorEntry, ArmorSetId, LOOKS, ReviewStatus, coversOf, dressFor, variantsOf, wearArmor } from "../armor";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------

interface Review {
  status: ReviewStatus;
  note: string;
  variant?: number;
  variantName?: string;
  updatedAt?: number;
}

type Mode = "worn" | "set" | "stand" | "row";
const hashId = decodeURIComponent(location.hash.slice(1));
let current: string = hashId in ARMOR_BY_ID ? hashId : ARMOR_ENTRIES[0].id;
const variantOf: Record<string, number> = {};
let mode: Mode = "worn";
let timeOfDay: "day" | "sunset" | "night" = "day";
let anim: CharacterAnim = "idle";
let who = 0;
const reviews: Record<string, Review> = {};
let saveReview: ((id: string, r: Review) => Promise<void>) | null = null;
for (const e of ARMOR_ENTRIES) variantOf[e.id] = e.style;

// ---------- Scene ----------

const canvas = $<HTMLCanvasElement>("cv");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
// Metal needs something to reflect: a soft studio room.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 0.8;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.53;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
canvas.addEventListener("pointerdown", () => {
  controls.autoRotate = false;
  $<HTMLInputElement>("spin").checked = false;
});

const hemi = new THREE.HemisphereLight(0xe2f0ff, 0x6a8452, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 4;
sun.shadow.camera.bottom = -1;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xbcd6ff, 0.6);
rim.position.set(-3, 2.6, -3);
scene.add(rim);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.97);
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

// A floating grassy island to stand on (wider for the row of sets).
const island = new THREE.Group();
scene.add(island);
function buildIsland(width: number) {
  island.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  island.clear();
  const flat = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 });
  const rx = width / 2 + 0.9;
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.03, 0.1, 18), flat(0x79a85a));
  grass.scale.set(rx, 1, 1.1);
  grass.position.y = -0.05;
  grass.receiveShadow = true;
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(1.03, 0.85, 0.2, 18), flat(0x8a6a48));
  dirt.scale.set(rx, 1, 1.1);
  dirt.position.y = -0.2;
  const rock = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1, 14), flat(0x7d7569));
  rock.rotation.x = Math.PI;
  rock.scale.set(rx, 1.1, 1.1);
  rock.position.y = -0.85;
  island.add(grass, dirt, rock);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 18 + width * 5; i++) {
    const a = rnd() * Math.PI * 2, r = 0.55 + rnd() * 0.4;
    const x = Math.cos(a) * r * rx, z = Math.sin(a) * r * 1.05;
    const isRock = rnd() < 0.3;
    const m = isRock ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.05 + rnd() * 0.04, 0), flat(0xa19b8f)) : new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1 + rnd() * 0.06, 4), flat(rnd() < 0.5 ? 0x5f9447 : 0x7fb24a));
    m.position.set(x, isRock ? 0.02 : 0.05, z);
    m.castShadow = true;
    island.add(m);
  }
}

// An armor stand: a wooden post with a cross-bar for the shoulders.
function makeStand(c: Character) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.8, flatShading: true });
  const top = c.joints.hipsY + 0.12 + c.fit.T * 0.98;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, top, 8), wood);
  post.position.y = top / 2;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(c.fit.shW * 1.7, 0.035, 0.035), wood);
  bar.position.y = top - c.fit.T * 0.16;
  const hipBar = new THREE.Mesh(new THREE.BoxGeometry(c.fit.hipW * 1.4, 0.03, 0.03), wood);
  hipBar.position.y = c.joints.hipsY;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 10), wood);
  base.position.y = 0.025;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), wood);
  knob.position.y = top + 0.13;
  knob.scale.set(0.85, 1.05, 0.9);
  for (const m of [post, bar, hipBar, base, knob]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

// ---------- Characters on show ----------

interface Shown { c: Character; set: ArmorSetId | null; extra?: THREE.Object3D }
let shown: Shown[] = [];

function clearShown() {
  for (const s of shown) {
    scene.remove(s.c.object);
    s.c.dispose();
    if (s.extra) scene.remove(s.extra);
  }
  shown = [];
}

/** The entries one character wears in the current view. */
function outfitFor(e: ArmorEntry, m: Mode): ArmorEntry[] {
  if (m === "worn" || m === "stand" || e.set === "honours") return [e];
  return ARMOR_ENTRIES.filter((x) => x.set === e.set);
}

function dress(entries: ArmorEntry[], presetIndex: number, a: CharacterAnim | null): Character {
  const covers = entries.flatMap(coversOf);
  const d = dressFor(CHARACTER_PRESETS[presetIndex].recipe, covers);
  const c = createCharacter(d.recipe, { hideHair: d.hideHair, anim: a });
  for (const x of entries) wearArmor(c, x.id, { variant: variantOf[x.id] });
  return c;
}

function rebuild(keepCamera = false) {
  clearShown();
  const e = ARMOR_BY_ID[current];
  if (mode === "row") {
    const sets = ARMOR_SETS.filter((s) => s.id !== "honours");
    const gap = 0.85;
    sets.forEach((s, i) => {
      const es = ARMOR_ENTRIES.filter((x) => x.set === s.id);
      const c = dress(es, who, anim);
      c.object.position.x = (i - (sets.length - 1) / 2) * gap;
      scene.add(c.object);
      shown.push({ c, set: s.id });
    });
    buildIsland(sets.length * gap);
    if (!keepCamera) {
      const halfWidth = (sets.length * gap) / 2 + 0.3;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      frame(0, 0.85, Math.max(halfWidth / tanHalf, 3), new THREE.Vector3(0, 0.16, 1));
    }
  } else {
    const es = outfitFor(e, mode);
    const c = dress(es, who, mode === "stand" ? null : anim);
    if (mode === "stand") {
      // Hide the body: the armor stays where it would be worn.
      c.update(0.016, 0);
      c.object.traverse((o) => {
        if (o.userData.char && !o.userData.armor) o.visible = false;
      });
      const stand = makeStand(c);
      scene.add(stand);
      shown.push({ c, set: e.set, extra: stand });
    } else shown.push({ c, set: e.set });
    scene.add(c.object);
    buildIsland(0.8);
    if (!keepCamera) {
      const focus = focusOf(e, mode);
      // Cloaks are best seen from behind.
      frame(0, focus.y, focus.dist, e.piece === "cloak" && mode === "worn" ? new THREE.Vector3(0.7, 0.22, -1) : undefined);
    }
  }
  updateHud();
}

/** Where to look for each kind of piece. */
function focusOf(e: ArmorEntry, m: Mode) {
  if (m !== "worn") return { y: 0.95, dist: 4.6 };
  switch (e.piece) {
    case "helmet": return { y: 1.5, dist: 2.3 };
    case "boots": return { y: 0.35, dist: 2.4 };
    case "platelegs": return { y: e.with ? 0.95 : 0.6, dist: e.with ? 4.2 : 3.0 };
    case "gauntlets": return { y: 0.85, dist: 2.4 };
    case "platebody": return { y: e.with ? 0.95 : 1.15, dist: e.with ? 4.2 : 2.8 };
    case "cloak": return { y: 0.95, dist: 4.2 };
    default: return { y: 1.0, dist: 3.2 };
  }
}

function frame(x: number, y: number, dist: number, dir = new THREE.Vector3(0.55, 0.22, 1)) {
  controls.target.set(x, y, 0);
  camera.position.copy(controls.target).addScaledVector(dir.normalize(), dist);
}

// ---------- Time of day ----------

const SKIES = {
  day: { top: "#8fc9ec", mid: "#cfe6ef", low: "#f4e7c9", hemi: [0xe2f0ff, 0x6a8452, 0.9], sun: [0xfff1d6, 2.0], pos: [3, 6, 4], exposure: 1.05, bloom: 0.08, env: 0.55 },
  sunset: { top: "#6d7fb8", mid: "#e9a07a", low: "#f6c98a", hemi: [0xffd2b0, 0x5a4a48, 0.85], sun: [0xffa060, 2.2], pos: [-6, 2.2, 3], exposure: 1.0, bloom: 0.2, env: 0.4 },
  night: { top: "#0b1430", mid: "#1b2950", low: "#2b3a5e", hemi: [0x5a6fae, 0x141824, 0.4], sun: [0xa9c1ff, 0.6], pos: [-3, 6, -3], exposure: 1.2, bloom: 0.8, env: 0.18 },
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
  scene.environmentIntensity = s.env;
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
  for (const s of shown) s.c.update(dt, t);
  controls.update();
  composer.render();
  requestAnimationFrame(loop);
}

// ---------- UI ----------

const STATUS_LABEL: Record<ReviewStatus, string> = { waiting: "To review", approved: "Approved", changes: "Needs changes" };
const reviewOf = (id: string): Review => reviews[id] ?? { status: "waiting", note: "" };

function renderList() {
  const list = $("list");
  list.innerHTML = "";
  for (const s of ARMOR_SETS) {
    const es = ARMOR_ENTRIES.filter((e) => e.set === s.id);
    const ok = es.filter((e) => reviewOf(e.id).status === "approved").length;
    const h = document.createElement("div");
    h.className = "set-head";
    h.innerHTML = `<span><span class="sn"></span>${s.planned ? '<span class="tag">Planned</span>' : ""}</span><small></small>`;
    h.querySelector(".sn")!.textContent = s.name;
    h.querySelector("small")!.textContent = `${ok} of ${es.length} approved`;
    list.appendChild(h);
    for (const e of es) {
      const r = reviewOf(e.id);
      const b = document.createElement("button");
      b.className = "tree-row";
      b.setAttribute("aria-current", String(e.id === current));
      b.innerHTML = `<span class="swatch"></span><span class="tr-name"></span><span class="tr-meta"></span><span class="pill" data-s="${r.status}"></span>`;
      (b.querySelector(".swatch") as HTMLElement).style.setProperty("--c", lookColor(e));
      b.querySelector(".tr-name")!.textContent = e.name;
      b.querySelector(".tr-meta")!.textContent = r.variantName && r.status !== "waiting" ? `Style: ${r.variantName}` : variantsOf(e).length > 1 ? `${variantsOf(e).length} styles` : "1 style";
      b.querySelector(".pill")!.textContent = STATUS_LABEL[r.status];
      b.onclick = () => select(e.id);
      list.appendChild(b);
    }
  }
  const approved = ARMOR_ENTRIES.filter((e) => reviewOf(e.id).status === "approved").length;
  $("tally").textContent = `${approved} of ${ARMOR_ENTRIES.length} approved`;
  ($("tally-bar") as HTMLElement).style.setProperty("--p", String(approved / ARMOR_ENTRIES.length));
}

const lookColor = (e: ArmorEntry) => LOOKS[e.look].main;

function renderDetail() {
  const e = ARMOR_BY_ID[current];
  const set = ARMOR_SETS.find((s) => s.id === e.set)!;
  $("d-name").textContent = e.name;
  $("d-about").textContent = e.about ?? set.about;
  const stats = $("d-stats");
  stats.innerHTML = "";
  for (const [k, v] of [["Set", set.name + (set.planned ? " (planned)" : "")], ...e.facts] as [string, string][]) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    stats.append(dt, dd);
  }
  const vs = $("d-variants");
  vs.innerHTML = "";
  variantsOf(e).forEach((name, i) => {
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
  const ws = $("d-who");
  ws.innerHTML = "";
  CHARACTER_PRESETS.forEach((p, i) => {
    const b = document.createElement("button");
    b.textContent = p.role;
    b.setAttribute("aria-pressed", String(i === who));
    b.onclick = () => {
      who = i;
      rebuild(true);
      renderDetail();
    };
    ws.appendChild(b);
  });
  const r = reviewOf(current);
  document.querySelectorAll<HTMLButtonElement>("#verdict button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === r.status)));
  const note = $<HTMLTextAreaElement>("note");
  if (document.activeElement !== note) note.value = r.note ?? "";
  $("saved").textContent = r.updatedAt ? `Saved ${new Date(r.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${r.variantName ? ` · style: ${r.variantName}` : ""}` : "";
}

function updateHud() {
  const e = ARMOR_BY_ID[current];
  const set = ARMOR_SETS.find((s) => s.id === e.set)!;
  $("np-kicker").textContent = mode === "row" ? "Armor Gallery" : set.name + (set.planned ? " · planned" : "");
  $("np-name").textContent =
    mode === "row" ? "Every set, side by side" : mode === "set" && e.set !== "honours" ? `Full ${set.name.toLowerCase()} set` : `${e.name} · ${variantsOf(e)[variantOf[current]]}`;
  document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  document.querySelectorAll<HTMLButtonElement>("#anim button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.anim === anim)));
}

function select(id: string) {
  const prevSet = ARMOR_BY_ID[current].set;
  current = id;
  if (decodeURIComponent(location.hash.slice(1)) !== id) history.replaceState(null, "", `#${id}`);
  if (mode === "row") {
    const s = shown.find((x) => x.set === ARMOR_BY_ID[id].set);
    if (s) {
      controls.target.set(s.c.object.position.x, 0.95, 0);
      camera.position.set(s.c.object.position.x + 1.2, 1.5, 3.6);
    }
  } else rebuild(mode === "set" && prevSet === ARMOR_BY_ID[id].set);
  renderList();
  renderDetail();
  updateHud();
}

$("next").onclick = () => {
  const i = ARMOR_ENTRIES.findIndex((e) => e.id === current);
  select(ARMOR_ENTRIES[(i + 1) % ARMOR_ENTRIES.length].id);
};
$<HTMLInputElement>("spin").onchange = (ev) => {
  controls.autoRotate = (ev.target as HTMLInputElement).checked;
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
  };
});
document.querySelectorAll<HTMLButtonElement>("#anim button").forEach((b) => {
  b.onclick = () => {
    anim = b.dataset.anim as CharacterAnim;
    if (mode !== "stand") for (const s of shown) s.c.setAnim(anim);
    updateHud();
  };
});

// Click a character in the row to pick its set.
const ray = new THREE.Raycaster();
let downAt = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", (ev) => (downAt = { x: ev.clientX, y: ev.clientY }));
canvas.addEventListener("pointerup", (ev) => {
  if (mode !== "row" || Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 5) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
  const hits = ray.intersectObjects(shown.map((s) => s.c.object), true);
  if (!hits.length) return;
  let o: THREE.Object3D | null = hits[0].object;
  while (o && !shown.some((s) => s.c.object === o)) o = o.parent;
  const s = shown.find((x) => x.c.object === o);
  if (s?.set) {
    const first = ARMOR_ENTRIES.find((e) => e.set === s.set)!;
    select(ARMOR_BY_ID[current].set === s.set ? current : first.id);
  }
});

// Reviews.
async function setVerdict(status: ReviewStatus) {
  const note = $<HTMLTextAreaElement>("note").value.trim();
  const e = ARMOR_BY_ID[current];
  const v = variantOf[current];
  const r: Review = { status, note, variant: v, variantName: variantsOf(e)[v], updatedAt: Date.now() };
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
    $("saved").textContent = `Saved · style: ${r.variantName}`;
  } catch (err: any) {
    $("saved").textContent = err?.code === "not_granted" || err?.code === "permission_denied" ? "You can look, but only Mike can save reviews." : "Couldn't save. Try again in a moment.";
  }
}
document.querySelectorAll<HTMLButtonElement>("#verdict button").forEach((b) => {
  b.onclick = () => setVerdict(b.dataset.s as ReviewStatus);
});
$("save-note").onclick = () => setVerdict(reviewOf(current).status);

window.addEventListener("hashchange", () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id in ARMOR_BY_ID && id !== current) select(id);
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
        if (data && d.id in ARMOR_BY_ID) {
          reviews[d.id] = data as Review;
          // Show each piece in the style Mike last reviewed.
          if (typeof data.variant === "number" && !touched.has(d.id)) variantOf[d.id] = data.variant;
        }
      }
      renderList();
      renderDetail();
      if (!firstSnap) {
        firstSnap = true;
        rebuild(true);
      }
    },
    () => {
      clearTimeout(timer);
      $("db-note").hidden = false;
    },
  );
}
const touched = new Set<string>();
let firstSnap = false;
$("d-variants").addEventListener("click", () => touched.add(current));

applyTime();
rebuild();
renderList();
renderDetail();
loop();
connectDb();
(window as any).__gallery = {
  select,
  setTime: (t: typeof timeOfDay) => ((timeOfDay = t), applyTime()),
  setMode: (m: Mode) => ((mode = m), rebuild()),
  setVariant: (v: number) => ((variantOf[current] = v), rebuild(true), renderDetail()),
  setWho: (i: number) => ((who = i), rebuild(true), renderDetail()),
  setAnim: (a: CharacterAnim) => ((anim = a), shown.forEach((s) => s.c.setAnim(a))),
  stopSpin: () => (controls.autoRotate = false),
};
