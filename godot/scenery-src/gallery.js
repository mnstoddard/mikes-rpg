// The Scenery Gallery: look at every object, try its variants and seeds,
// see it at dawn, noon, dusk and night, and walk around a small sample scene.
import { THREE, triCount, drawCalls, rng } from "./lib.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CATALOG, GROUPS } from "./index.js";
import { buildSampleScene } from "./scene.js";

const $ = (id) => document.getElementById(id);
const canvas = $("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
camera.position.set(6, 4, 9);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;

// ---------- Light and sky (values from the Emberfall style guide) ----------
const TIMES = {
  dawn:  { sun: 0xffc9a0, e: 1.5, top: 0x6c8fd6, hor: 0xf7c9a8, el: 14, amb: 0.75, glow: 0.4 },
  noon:  { sun: 0xfff1dc, e: 2.8, top: 0x3f86db, hor: 0xbfe2f7, el: 50, amb: 0.6, glow: 0.25 },
  dusk:  { sun: 0xff9e5e, e: 1.4, top: 0x46519c, hor: 0xf59a6b, el: 10, amb: 0.65, glow: 0.45 },
  night: { sun: 0xafc4ff, e: 0.45, top: 0x0e1736, hor: 0x2b3b6e, el: 40, amb: 0.35, glow: 0.9 },
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
  vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float t = pow(clamp(vP.y,0.0,1.0),0.55); gl_FragColor = vec4(mix(hor, top, t),1.0); }",
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), skyMat);
scene.add(sky);
const hemi = new THREE.HemisphereLight(0xbfe2f7, 0x5e7a4c, 1);
// sky light for reflections and soft fill (Godot: sky as ambient source)
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), null);
envScene.add(envSky);
const envGroundMat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, gnd: { value: new THREE.Color(0x5e7a4c) } },
  vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; varying vec3 vP; void main(){ vec3 c = vP.y > 0.0 ? mix(hor, top, pow(vP.y,0.55)) : mix(hor, gnd, pow(-vP.y,0.4)); gl_FragColor = vec4(c,1.0); }" });
envSky.material = envGroundMat;
let envRT = null;
function updateEnv(t, night) {
  envGroundMat.uniforms.top.value.set(t.top); envGroundMat.uniforms.hor.value.set(t.hor);
  envGroundMat.uniforms.gnd.value.set(night ? 0x141c14 : 0x5e7a4c);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  scene.environmentIntensity = night ? 0.5 : 0.9;
}
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 4;
scene.add(sun, sun.target);
scene.fog = new THREE.Fog(0xcfe6f5, 60, 260);

// ground: a soft meadow
const groundGeo = new THREE.CircleGeometry(200, 64);
groundGeo.rotateX(-Math.PI / 2);
{
  const p = groundGeo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const n = 0.5 + 0.25 * Math.sin(x * 0.13) * Math.cos(z * 0.11) + 0.15 * Math.sin(x * 0.41 + z * 0.37);
    const col = new THREE.Color(0x5e9e36).lerp(new THREE.Color(0x8cc850), n);
    c.set([col.r, col.g, col.b], i * 3);
  }
  groundGeo.setAttribute("color", new THREE.BufferAttribute(c, 3));
}
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
ground.receiveShadow = true;
scene.add(ground);

// a 1.75 m person for scale (plain grey stand-in)
const person = new THREE.Group();
{
  const m = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 12), m); body.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), m); head.position.y = 1.6;
  for (const x of [body, head]) { x.castShadow = true; person.add(x); }
}
scene.add(person);

// ---------- Post effects: a soft glow (bloom) for emissive things ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let timeKey = "noon";
function setTime(k) {
  timeKey = k;
  const t = TIMES[k];
  skyMat.uniforms.top.value.set(t.top);
  skyMat.uniforms.hor.value.set(t.hor);
  scene.fog.color.set(t.hor);
  sun.color.set(t.sun);
  sun.intensity = t.e;
  hemi.intensity = t.amb;
  hemi.color.set(k === "night" ? 0x3b4c80 : t.hor);
  hemi.groundColor.set(k === "night" ? 0x1a2418 : 0x5e7a4c);
  bloom.strength = t.glow;
  updateEnv(t, k === "night");
  placeSun();
  for (const b of document.querySelectorAll("#time .chip")) b.setAttribute("aria-pressed", String(b.dataset.t === k));
}
let focusR = 5;
function placeSun() {
  const t = TIMES[timeKey];
  const el = THREE.MathUtils.degToRad(t.el), az = THREE.MathUtils.degToRad(-35);
  const d = Math.max(20, focusR * 3);
  sun.position.set(Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d).add(sun.target.position);
  const s = sun.shadow.camera;
  s.left = s.bottom = -focusR * 1.6; s.right = s.top = focusR * 1.6; s.near = 0.5; s.far = d * 3;
  s.updateProjectionMatrix();
}

// ---------- Wind: foliage sways in the gallery (Godot gets its own wind shader) ----------
const windU = { value: 0 };
const swayed = new WeakSet();
function addSway(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (swayed.has(m) || !/leaves|needles|grass|flowers|bush_leaves|fern|reeds/.test(m.name)) return;
    swayed.add(m);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = windU;
      sh.vertexShader = "uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float sway = smoothstep(0.0, 3.0, position.y);
        transformed.x += sin(uWind * 1.7 + wp.x * 0.6 + wp.z * 0.3) * 0.06 * sway + sin(uWind * 4.1 + wp.y * 2.0) * 0.015;
        transformed.z += cos(uWind * 1.3 + wp.z * 0.5) * 0.045 * sway;`);
    };
    m.customProgramCacheKey = () => "sway";
    m.needsUpdate = true;
  });
}

// ---------- The list ----------
const list = $("list");
const DOTS = { Trees: "#6db33f", Rocks: "#9c9a94", "Ore nodes": "#c87447", Plants: "#f28ab2", Buildings: "#d2b58a", "Crafting stations": "#ff8a3d", "Fences and bridges": "#9c6c3f", Props: "#7fb8f0" };
function renderList(filter = "") {
  list.innerHTML = "";
  const f = filter.trim().toLowerCase();
  for (const g of GROUPS) {
    const items = CATALOG.filter((c) => c.group === g && (!f || c.name.toLowerCase().includes(f)));
    if (!items.length) continue;
    const h = document.createElement("div");
    h.className = "group-h";
    h.innerHTML = `<span>${g}</span><span>${items.length}</span>`;
    list.append(h);
    for (const it of items) {
      const b = document.createElement("button");
      b.className = "item";
      b.dataset.id = it.id;
      b.innerHTML = `<span class="dot" style="background:${DOTS[g] ?? "#999"}"></span>${it.name}`;
      if (current && current.id === it.id && mode === "objects") b.setAttribute("aria-current", "true");
      b.onclick = () => { setMode("objects"); select(it.id); };
      list.append(b);
    }
  }
}
$("q").addEventListener("input", (e) => renderList(e.target.value));

// ---------- Showing one object ----------
let current = null, shown = null, variant = 0, seed = 7, mode = "objects", sceneGroup = null;
function clearShown() {
  if (shown) { scene.remove(shown); shown.traverse((o) => o.geometry?.dispose()); shown = null; }
}
function select(id, keepView = false) {
  current = CATALOG.find((c) => c.id === id);
  if (variant >= current.variants.length) variant = 0;
  clearShown();
  shown = current.make(seed, variant);
  addSway(shown);
  scene.add(shown);
  const box = new THREE.Box3().setFromObject(shown);
  const size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z, 2.2);
  focusR = r;
  person.visible = true;
  person.position.set(box.max.x + 0.6, 0, box.max.z * 0.2);
  if (!keepView) {
    const c = new THREE.Vector3(0.4, Math.max(size.y * 0.45, 0.7), 0);
    controls.target.copy(c);
    camera.position.set(r * 1.25, size.y * 0.55 + r * 0.35, r * 1.9);
  }
  sun.target.position.set(0, 0, 0);
  placeSun();
  for (const b of list.querySelectorAll(".item")) b.setAttribute("aria-current", String(b.dataset.id === id));
  renderCard(size);
}
function renderCard(size) {
  const c = current;
  $("card").innerHTML = `
    <div class="label">${c.group}</div>
    <h2>${c.name}</h2>
    <p class="note">${c.note}</p>
    ${c.variants.length > 1 ? `<div class="row" role="group" aria-label="Variant">${c.variants.map((v, i) => `<button class="chip" data-v="${i}" aria-pressed="${i === variant}">${v}</button>`).join("")}</div>` : ""}
    <div class="row">
      <button class="btn" id="reroll">Another one</button>
      <span class="stats">
        <span><b>${triCount(shown).toLocaleString()}</b> triangles</span>
        <span><b>${drawCalls(shown)}</b> draw calls</span>
        <span><b>${size.y.toFixed(1)} m</b> tall</span>
        <span>file <b>${c.id}.glb</b></span>
      </span>
    </div>`;
  for (const b of $("card").querySelectorAll("[data-v]")) b.onclick = () => { variant = +b.dataset.v; select(c.id, true); };
  $("reroll").onclick = () => { seed = (seed * 7 + 13) % 997; select(c.id, true); };
}

// ---------- Sample scene ----------
function setMode(m) {
  if (m === mode) return;
  mode = m;
  $("tab-objects").setAttribute("aria-pressed", String(m === "objects"));
  $("tab-scene").setAttribute("aria-pressed", String(m === "scene"));
  if (m === "scene") {
    clearShown();
    person.visible = true;
    if (!sceneGroup) { sceneGroup = buildSampleScene(); addSway(sceneGroup); }
    scene.add(sceneGroup);
    person.position.set(2, 0, 9);
    focusR = 22;
    sun.target.position.set(0, 0, 0);
    placeSun();
    controls.target.set(0, 1.5, 0);
    camera.position.set(24, 13, 34);
    const s = sceneGroup.userData.stats;
    $("card").innerHTML = `<div class="label">Sample scene</div><h2>A Heartvale meadow</h2>
      <p class="note">Built only from the objects in this gallery: a pond with reeds and lily pads, a grove of oak, birch, maple and pine, a cliff with copper, tin, iron and coal rocks, bushes, flowers and grass. Repeated things (grass, flowers) are drawn as instances, the way Godot's MultiMesh does it, to stay fast.</p>
      <div class="stats"><span><b>${s.objects}</b> objects</span><span><b>${s.tris.toLocaleString()}</b> triangles</span><span><b>${s.calls}</b> draw calls</span></div>`;
    for (const b of list.querySelectorAll(".item")) b.setAttribute("aria-current", "false");
  } else {
    if (sceneGroup) scene.remove(sceneGroup);
    select(current?.id ?? CATALOG[0].id);
  }
}
$("tab-objects").onclick = () => setMode("objects");
$("tab-scene").onclick = () => setMode("scene");

// ---------- Time of day ----------
$("time").innerHTML = Object.keys(TIMES).map((k) => `<button class="chip" data-t="${k}" aria-pressed="false">${k[0].toUpperCase() + k.slice(1)}</button>`).join("");
for (const b of document.querySelectorAll("#time .chip")) b.onclick = () => setTime(b.dataset.t);

// ---------- Run ----------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
renderList();
select(CATALOG[0].id);
setTime("noon");
resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  windU.value = clock.getElapsedTime();
  controls.update();
  composer.render();
});
window.__gallery = { select, setMode, setTime };
