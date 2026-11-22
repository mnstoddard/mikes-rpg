// The review gallery, shared by every kind of game element (trees, ores...).
// It shows one element on a floating island (or all of them side by side),
// lets you try variants, use it (chop, mine), switch day/sunset/night, and
// approve it or ask for changes. Reviews are saved in the page's shared
// database when it runs as a claude.ai artifact.
//
// Each gallery (trees.ts, ores.ts) only describes its elements with a GalleryConfig.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeRng } from "../trees/common";

export type ReviewStatus = "waiting" | "approved" | "changes";

/** Anything the gallery can show: a tree, a rock... */
export interface GalleryThing {
  object: THREE.Object3D;
  readonly state: string;
  update(dt: number, time: number, wind: number, night: number): void;
  dispose(): void;
}

export interface ItemInfo {
  name: string;
  /** Small line under the name in the list, e.g. "Woodcutting 5". */
  meta: string;
  swatch: number;
  about: string;
  whereLabel: string;
  where: string;
  stats: [string, string][];
  variants: readonly string[];
  /** Heading the item is listed under, if the list has sections. */
  group?: string;
}

export interface GalleryConfig<K extends string> {
  kinds: K[];
  info(kind: K): ItemInfo;
  create(kind: K, seed: number, variant: number, flag: boolean): GalleryThing;
  /** The use button: what it says and does in each state. */
  verb: string; // "Chop", "Mine"
  hitsToFinish: number;
  hit(t: GalleryThing): void;
  finish(t: GalleryThing): void;
  restore(t: GalleryThing): void;
  /** States: ready to use, finished (stump / empty), and the busy in-between ones. */
  readyState: string;
  doneState: string;
  busyLabel: Record<string, string>; // e.g. { falling: "Timber!", growing: "Growing…" }
  restoreLabel: string; // "Grow back", "Refill"
  /** Layout. */
  spacing: number;
  focusY: number;
  oneDistance: number;
  /** An optional checkbox, e.g. "Dead version". */
  flag?: { label: string };
  /** Where the stand-in person stands, in single view: [x, z]. */
  person: [number, number];
  /** Gets a soft studio reflection map, for shiny things (makes metal look like metal). */
  useEnvironment?: (tex: THREE.Texture) => void;
  /** Show the wind slider. */
  wind: boolean;
  /** Example of a note, for the notes box. */
  notePlaceholder: string;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

interface Review {
  status: ReviewStatus;
  note: string;
  seed?: number;
  variant?: number;
  flag?: boolean;
  updatedAt?: number;
}

export function runGallery<K extends string>(cfg: GalleryConfig<K>) {
  const KINDS = cfg.kinds;
  const fromHash = location.hash.slice(1) as K;
  let current: K = KINDS.includes(fromHash) ? fromHash : KINDS[0];
  const variantOf = {} as Record<K, number>;
  const seedOf = {} as Record<K, number>;
  let mode: "one" | "row" = "one";
  let timeOfDay: "day" | "sunset" | "night" = "day";
  let wind = 1;
  let showPerson = true;
  let flag = false;
  const reviews: Partial<Record<K, Review>> = {};
  let saveReview: ((kind: K, r: Review) => Promise<void>) | null = null;
  let hits = 0;
  /** 0 by day, 1 at night: things can dim their reflections. */
  let nightness = 0;
  KINDS.forEach((k, i) => {
    variantOf[k] = 0;
    seedOf[k] = 7 + i * 101;
  });

  // ---------- Scene ----------
  const canvas = $<HTMLCanvasElement>("cv");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  camera.position.set(9, 6, 11);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 2.5;
  controls.maxDistance = 95;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  canvas.addEventListener("pointerdown", () => (controls.autoRotate = false));

  if (cfg.useEnvironment) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    cfg.useEnvironment(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  }
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5b6b3a, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 16, bottom: -16 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

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

  // The ground: a low-poly grassy island floating in the sky.
  const island = new THREE.Group();
  scene.add(island);
  function buildIsland(width: number) {
    island.clear();
    const rng = makeRng(99);
    const flat = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 });
    const rx = width / 2 + 3.2;
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 14, 1), flat(0x7fb24a));
    grass.scale.set(rx, 1, 4.6);
    grass.position.y = -0.25;
    grass.receiveShadow = true;
    island.add(grass);
    const dirt = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 14, 1), flat(0x8a6a48));
    dirt.rotation.x = Math.PI;
    dirt.scale.set(rx * 0.97, 2.6, 4.4);
    dirt.position.y = -1.8;
    island.add(dirt);
    for (let i = 0; i < 26 + width * 3; i++) {
      const a = rng() * Math.PI * 2;
      const r = 0.25 + rng() * 0.7;
      const x = Math.cos(a) * r * (rx - 0.5);
      const z = Math.sin(a) * r * 4.0;
      if (Math.abs(z) < 1.4 && rng() < 0.8) continue;
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

  // A plain stand-in person (1.8 m tall) to judge sizes by.
  const person = new THREE.Group();
  {
    const m = new THREE.MeshStandardMaterial({ color: 0xe9e1d3, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.75, 4, 12), m);
    body.position.y = 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), m);
    head.position.y = 1.58;
    body.castShadow = head.castShadow = true;
    person.add(body, head);
  }
  scene.add(person);

  // ---------- What's on show ----------
  let shown: { kind: K; thing: GalleryThing; x: number }[] = [];

  function frame(x: number, y: number, dist: number, dir = new THREE.Vector3(0.62, 0.34, 0.72)) {
    controls.target.set(x, y, 0);
    camera.position.copy(controls.target).addScaledVector(dir.normalize(), dist);
  }

  function rebuild(keepCamera = false) {
    for (const s of shown) {
      scene.remove(s.thing.object);
      s.thing.dispose();
    }
    shown = [];
    hits = 0;
    if (mode === "one") {
      const thing = cfg.create(current, seedOf[current], variantOf[current], flag);
      scene.add(thing.object);
      shown.push({ kind: current, thing, x: 0 });
      buildIsland(2);
      person.position.set(cfg.person[0], 0, cfg.person[1]);
      person.rotation.y = -0.6;
      if (!keepCamera) frame(0, cfg.focusY, cfg.oneDistance);
    } else {
      const n = KINDS.length;
      KINDS.forEach((k, i) => {
        const thing = cfg.create(k, seedOf[k], variantOf[k], flag);
        const x = (i - (n - 1) / 2) * cfg.spacing;
        thing.object.position.x = x;
        scene.add(thing.object);
        shown.push({ kind: k, thing, x });
      });
      buildIsland(n * cfg.spacing - 2);
      person.position.set(-((n - 1) / 2) * cfg.spacing - 2.2, 0, 1.4);
      person.rotation.y = 0.4;
      if (!keepCamera) {
        // Back off far enough that the whole row fits across the screen.
        const halfWidth = (n * cfg.spacing) / 2 + 1.5;
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
        frame(0, cfg.focusY * 0.9, halfWidth / tanHalf, new THREE.Vector3(0.1, 0.28, 1));
      }
    }
    person.visible = showPerson;
    updateHud();
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
    nightness = timeOfDay === "night" ? 1 : timeOfDay === "sunset" ? 0.4 : 0;
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
    for (const s of shown) s.thing.update(dt, t, wind, nightness);
    const st = shown.find((s) => s.kind === current)?.thing.state ?? "";
    if (st !== lastState) {
      lastState = st;
      updateHud();
    }
    controls.update();
    composer.render();
    requestAnimationFrame(loop);
  }

  // ---------- UI ----------
  const reviewOf = (k: K): Review => reviews[k] ?? { status: "waiting", note: "" };
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

  function renderList() {
    const list = $("list");
    list.innerHTML = "";
    let lastGroup: string | undefined;
    for (const k of KINDS) {
      const info = cfg.info(k);
      if (info.group && info.group !== lastGroup) {
        const h = document.createElement("p");
        h.className = "label list-group";
        h.textContent = info.group;
        list.appendChild(h);
        lastGroup = info.group;
      }
      const r = reviewOf(k);
      const b = document.createElement("button");
      b.className = "tree-row";
      b.setAttribute("aria-current", String(k === current));
      b.innerHTML = `<span class="swatch"></span><span class="tr-name"></span><span class="tr-meta"></span><span class="pill" data-s="${r.status}"></span>`;
      (b.querySelector(".swatch") as HTMLElement).style.setProperty("--c", hex(info.swatch));
      b.querySelector(".tr-name")!.textContent = info.name;
      b.querySelector(".tr-meta")!.textContent = info.meta;
      b.querySelector(".pill")!.textContent = r.status === "waiting" ? "To review" : r.status === "approved" ? "Approved" : "Needs changes";
      b.onclick = () => select(k);
      list.appendChild(b);
    }
    const approved = KINDS.filter((k) => reviewOf(k).status === "approved").length;
    $("tally").textContent = `${approved} of ${KINDS.length} approved`;
    $("tally-bar").style.setProperty("--p", String(approved / KINDS.length));
  }

  function renderDetail() {
    const info = cfg.info(current);
    $("d-name").textContent = info.name;
    $("d-about").textContent = info.about;
    $("d-where-label").textContent = info.whereLabel;
    $("d-where").textContent = info.where;
    const stats = $("d-stats");
    stats.innerHTML = "";
    for (const [k, v] of info.stats) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      stats.append(dt, dd);
    }
    const vs = $("d-variants");
    vs.innerHTML = "";
    info.variants.forEach((name, i) => {
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
    $("d-seed").textContent = `${info.name} #${seedOf[current]}`;
    const r = reviewOf(current);
    document.querySelectorAll<HTMLButtonElement>("#verdict button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === r.status)));
    const note = $<HTMLTextAreaElement>("note");
    if (document.activeElement !== note) note.value = r.note ?? "";
    $("saved").textContent = r.updatedAt ? `Saved ${new Date(r.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
  }

  function updateHud() {
    const info = cfg.info(current);
    $("np-name").textContent = mode === "one" ? `${info.name} · ${info.variants[variantOf[current]]}${flag && cfg.flag ? ` · ${cfg.flag.label}` : ""}` : "All of them, side by side";
    const st = shown.find((s) => s.kind === current)?.thing.state ?? cfg.readyState;
    const btn = $<HTMLButtonElement>("act");
    const label = st === cfg.doneState ? cfg.restoreLabel : cfg.busyLabel[st] ?? (hits === 0 ? cfg.verb : `${cfg.verb} (${hits}/${cfg.hitsToFinish})`);
    btn.querySelector("span")!.textContent = label;
    btn.disabled = st !== cfg.readyState && st !== cfg.doneState;
    document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  }

  function select(k: K) {
    current = k;
    if (location.hash.slice(1) !== k) history.replaceState(null, "", `#${k}`);
    hits = 0;
    if (mode === "one") rebuild();
    else {
      const x = shown.find((s) => s.kind === k)?.x ?? 0;
      frame(x, cfg.focusY, cfg.oneDistance * 0.9);
    }
    renderList();
    renderDetail();
    updateHud();
  }

  $("act").onclick = () => {
    const s = shown.find((x) => x.kind === current);
    if (!s) return;
    if (s.thing.state === cfg.doneState) {
      cfg.restore(s.thing);
      hits = 0;
    } else if (s.thing.state === cfg.readyState) {
      cfg.hit(s.thing);
      hits++;
      if (hits >= cfg.hitsToFinish) {
        const thing = s.thing;
        setTimeout(() => cfg.finish(thing), 220);
        hits = 0;
      }
    }
    updateHud();
  };
  $("reroll").onclick = () => {
    seedOf[current] = 1 + Math.floor(Math.random() * 9999);
    rebuild(true);
    renderDetail();
  };
  if (cfg.wind) {
    $<HTMLInputElement>("wind").oninput = (e) => (wind = Number((e.target as HTMLInputElement).value));
  } else {
    $("wind-wrap").hidden = true;
  }
  if (cfg.flag) {
    $("flag-label").textContent = cfg.flag.label;
    $<HTMLInputElement>("flag").onchange = (e) => {
      flag = (e.target as HTMLInputElement).checked;
      rebuild(true);
    };
  } else {
    $("flag-wrap").hidden = true;
  }
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
  $<HTMLTextAreaElement>("note").placeholder = cfg.notePlaceholder;

  // Click something in the side-by-side view to pick it.
  const ray = new THREE.Raycaster();
  let downAt = { x: 0, y: 0 };
  canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("pointerup", (e) => {
    if (mode !== "row" || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(shown.map((s) => s.thing.object), true)[0];
    if (!hit) return;
    let o: THREE.Object3D | null = hit.object;
    while (o && !shown.some((s) => s.thing.object === o)) o = o.parent;
    const s = shown.find((x) => x.thing.object === o);
    if (s) select(s.kind);
  });

  // ---------- Reviews ----------
  async function setVerdict(status: ReviewStatus) {
    const note = $<HTMLTextAreaElement>("note").value.trim();
    const r: Review = { status, note, seed: seedOf[current], variant: variantOf[current], flag, updatedAt: Date.now() };
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
    const k = location.hash.slice(1) as K;
    if (KINDS.includes(k) && k !== current) select(k);
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
    saveReview = (kind, r) => db.doc(`reviews/${kind}`).set(r as unknown as Record<string, unknown>);
    db.collection("reviews").onSnapshot(
      (snap: any) => {
        clearTimeout(timer);
        $("db-note").hidden = true;
        for (const d of snap.docs) {
          const data = d.data();
          if (data && KINDS.includes(d.id)) reviews[d.id as K] = data as Review;
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
  // For automated screenshots.
  (window as any).__gallery = {
    select,
    setTime: (t: typeof timeOfDay) => ((timeOfDay = t), applyTime()),
    setMode: (m: typeof mode) => ((mode = m), rebuild()),
    setVariant: (v: number) => ((variantOf[current] = v), rebuild(true), renderDetail()),
    setFlag: (f: boolean) => ((flag = f), rebuild(true)),
  };
}
