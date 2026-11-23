// The character creator: the Character Workshop inside the game. Pick a
// ready-made character or set every slider and colour, watch your character
// turn on a stand, and save. The look is saved with your character on the
// server, and everyone sees it.
import * as THREE from "three";
import { CHARACTER_PRESETS, createCharacter, makeRecipe, type Character, type CharacterRecipe } from "../character";
import { recipeToLook } from "./look";

type Key = keyof CharacterRecipe;
type Range = { type: "range"; tab: string; group: string; key: Key; label: string; min: number; max: number; ends: [string, string] };
type Choice = { type: "choice"; tab: string; group: string; key: Key; label: string; opts: [string, string][] };
type Swatch = { type: "color"; tab: string; group: string; key: Key; label: string; pal: keyof typeof SW };
type Ctl = Range | Choice | Swatch;

/** The Workshop's colour swatches. */
const SW = {
  skin: ["#ffe3cc", "#f6cba6", "#e9b48a", "#d49a6a", "#b97b4c", "#965f3a", "#714528", "#4b2e1c", "#86b064", "#7aa3c8", "#a7a1b5", "#c9d6d0"],
  hair: ["#1b1613", "#3a2517", "#5e3a1f", "#8b5b2c", "#b2501f", "#d9782b", "#e2bf68", "#f2e4b8", "#9a9a9a", "#efefef", "#3d6fd1", "#e06aa8", "#49a86a", "#7b4fc9"],
  eye: ["#5a3a1e", "#8a6a2c", "#4f8a3a", "#3a78c2", "#7d8d99", "#d08d1a", "#7a4fc2", "#c23a3a", "#2a2a2a"],
  cloth: ["#c0392b", "#e07b39", "#e8c547", "#5a8f3c", "#2a7867", "#3a6ea5", "#2c3e66", "#6b4c9a", "#a44a6e", "#8e5a3c", "#5c4636", "#e9e2d0", "#9aa3a8", "#3b3f44", "#1f2124"],
};

const R = (tab: string, group: string, key: Key, label: string, min: number, max: number, ends: [string, string]): Range => ({ type: "range", tab, group, key, label, min, max, ends });
const C = (tab: string, group: string, key: Key, label: string, opts: [string, string][]): Choice => ({ type: "choice", tab, group, key, label, opts });
const K = (tab: string, group: string, key: Key, label: string, pal: keyof typeof SW): Swatch => ({ type: "color", tab, group, key, label, pal });

/** Every control, in the Workshop's order. */
const SCHEMA: Ctl[] = [
  R("Body", "Frame", "frame", "Body type", 0, 1, ["Masculine", "Feminine"]),
  R("Body", "Frame", "height", "Height", 0.85, 1.15, ["Short", "Tall"]),
  R("Body", "Frame", "build", "Build", 0, 1, ["Slim", "Heavy"]),
  R("Body", "Frame", "muscle", "Muscle", 0, 1, ["Soft", "Strong"]),
  R("Body", "Proportions", "shoulders", "Shoulders", 0.8, 1.2, ["Narrow", "Broad"]),
  R("Body", "Proportions", "hips", "Hips", 0.8, 1.2, ["Narrow", "Wide"]),
  R("Body", "Proportions", "head", "Head size", 0.85, 1.35, ["Small", "Big"]),
  R("Body", "Proportions", "legs", "Leg length", 0.85, 1.15, ["Short", "Long"]),
  K("Body", "Skin", "skin", "Skin color", "skin"),
  R("Face", "Face shape", "faceWidth", "Face width", 0.85, 1.15, ["Narrow", "Wide"]),
  R("Face", "Face shape", "faceLength", "Face length", 0.9, 1.15, ["Short", "Long"]),
  R("Face", "Face shape", "jaw", "Jaw", 0.7, 1.15, ["Pointed", "Wide"]),
  R("Face", "Face shape", "chin", "Chin", 0.9, 1.25, ["Short", "Long"]),
  R("Face", "Face shape", "cheeks", "Cheekbones", 0, 1, ["Soft", "High"]),
  R("Face", "Face shape", "square", "Squareness", 0, 1, ["Round", "Square"]),
  C("Face", "Nose", "nose", "Nose", [["button", "Button"], ["round", "Round"], ["small", "Small"], ["pointy", "Pointy"], ["long", "Long"]]),
  R("Face", "Nose", "noseSize", "Nose size", 0.7, 1.4, ["Small", "Big"]),
  C("Face", "Mouth", "mouth", "Expression", [["smile", "Smile"], ["grin", "Grin"], ["neutral", "Calm"], ["smirk", "Smirk"], ["oh", "Surprised"], ["frown", "Frown"]]),
  R("Face", "Mouth", "mouthWidth", "Mouth width", 0.7, 1.4, ["Narrow", "Wide"]),
  C("Face", "Ears", "ears", "Ears", [["round", "Round"], ["pointy", "Pointy"], ["elf", "Long elf"]]),
  R("Face", "Ears", "earSize", "Ear size", 0.7, 1.4, ["Small", "Big"]),
  C("Face", "Extras", "blush", "Rosy cheeks", [["off", "Off"], ["on", "On"]]),
  C("Eyes", "Eyes", "eyeStyle", "Eye shape", [["classic", "Round"], ["big", "Sparkle"], ["wide", "Wide"], ["almond", "Almond"], ["cat", "Cat"], ["gentle", "Gentle"], ["narrow", "Determined"], ["sleepy", "Sleepy"], ["happy", "Happy"], ["dots", "Dots"]]),
  K("Eyes", "Eyes", "eyeColor", "Eye color", "eye"),
  R("Eyes", "Eyes", "eyeSize", "Eye size", 0.7, 1.4, ["Small", "Big"]),
  R("Eyes", "Eyes", "eyeSpacing", "Eye spacing", 0.8, 1.2, ["Close", "Wide"]),
  R("Eyes", "Eyes", "eyeHeight", "Eye height", -1, 1, ["Low", "High"]),
  R("Eyes", "Eyes", "eyeTilt", "Eye tilt", -1, 1, ["Droopy", "Cat-like"]),
  C("Eyes", "Eyes", "lashes", "Lashes", [["off", "None"], ["on", "Lashes"]]),
  R("Eyes", "Eyebrows", "browThick", "Brow thickness", 0, 2, ["None", "Bushy"]),
  R("Eyes", "Eyebrows", "browTilt", "Brow angle", -1, 1, ["Worried", "Fierce"]),
  C("Hair", "Hair", "hairStyle", "Hair style", [["bald", "Bald"], ["buzz", "Buzz"], ["short", "Short"], ["messy", "Messy"], ["spiky", "Spiky"], ["quiff", "Quiff"], ["bob", "Bob"], ["long", "Long"], ["ponytail", "Ponytail"], ["bun", "Bun"], ["pigtails", "Pigtails"], ["mohawk", "Mohawk"], ["afro", "Afro"]]),
  K("Hair", "Hair", "hairColor", "Hair color", "hair"),
  R("Hair", "Hair", "bangs", "Bangs", 0, 1, ["Off the face", "Over the brow"]),
  R("Hair", "Hair", "hairLength", "Length", 0, 1, ["Shorter", "Longer"]),
  C("Hair", "Facial hair", "beard", "Facial hair", [["none", "None"], ["stubble", "Stubble"], ["mustache", "Mustache"], ["goatee", "Goatee"], ["full", "Full beard"], ["wizard", "Wizard beard"]]),
  C("Outfit", "Clothes", "top", "Top", [["tshirt", "T-shirt"], ["long", "Long sleeves"], ["tank", "Tank"], ["tunic", "Tunic"], ["robe", "Robe"]]),
  C("Outfit", "Clothes", "bottom", "Bottom", [["pants", "Pants"], ["shorts", "Shorts"], ["skirt", "Skirt"]]),
  C("Outfit", "Clothes", "shoes", "Feet", [["boots", "Boots"], ["shoes", "Shoes"], ["bare", "Bare"]]),
  C("Outfit", "Clothes", "belt", "Belt", [["off", "None"], ["on", "Belt"]]),
  C("Outfit", "Accessories", "hat", "Hat", [["none", "None"], ["beanie", "Beanie"], ["wizard", "Wizard hat"], ["headband", "Headband"], ["crown", "Crown"]]),
  C("Outfit", "Accessories", "glasses", "Glasses", [["none", "None"], ["round", "Round"], ["square", "Square"]]),
  K("Outfit", "Colors", "shirtColor", "Top color", "cloth"),
  K("Outfit", "Colors", "pantsColor", "Bottom color", "cloth"),
  K("Outfit", "Colors", "shoeColor", "Shoe color", "cloth"),
  K("Outfit", "Colors", "accentColor", "Belt and hat color", "cloth"),
];
const TABS = ["Body", "Face", "Eyes", "Hair", "Outfit"];

let open = false;

/** Open the creator. `onSave` gets the look (JSON text) to send to the server. */
export function openCreator(start: CharacterRecipe, mode: "new" | "edit", onSave: (look: string) => void) {
  if (open) return;
  open = true;
  let P: CharacterRecipe = { ...start };
  const box = document.createElement("div");
  box.id = "creator";
  box.innerHTML = `
    <div class="cr-panel panel">
      <div class="cr-stage"><canvas></canvas><div class="cr-hint">Drag to turn</div></div>
      <div class="cr-side">
        <h2>${mode === "new" ? "Make your character" : "Change your look"}</h2>
        <div class="cr-presets"></div>
        <div class="cr-tabs"></div>
        <div class="cr-controls"></div>
        <div class="cr-buttons">
          <button class="cr-random">🎲 Surprise me</button>
          ${mode === "edit" ? '<button class="cr-cancel">Cancel</button>' : ""}
          <button class="cr-save">${mode === "new" ? "Start my adventure" : "Save"}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(box);

  // ---- the turntable ----
  const canvas = box.querySelector("canvas")!;
  const stage = box.querySelector<HTMLElement>(".cr-stage")!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.25, 5.2);
  camera.lookAt(0, 0.95, 0);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x4a4038, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 4, 3);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ac8ff, 1.0);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const turn = new THREE.Group();
  scene.add(turn);
  let hero: Character | null = null;
  let spin = 0.4, dragX: number | null = null, idleSpin = true;
  // Face, Eyes and Hair zoom the camera in on the head, turned mostly to the front.
  let closeUp = false, zoom = 0;
  const camFar = { pos: new THREE.Vector3(0, 1.25, 5.2), look: new THREE.Vector3(0, 0.95, 0) };
  const camNear = { pos: new THREE.Vector3(0, 1.62, 2.1), look: new THREE.Vector3(0, 1.52, 0) };
  const camLook = new THREE.Vector3();
  const rebuild = () => {
    if (hero) { turn.remove(hero.object); hero.dispose(); }
    hero = createCharacter(P);
    hero.object.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    hero.setAnim("idle");
    turn.add(hero.object);
  };
  rebuild();
  let pending = 0;
  const rebuildSoon = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(rebuild); };
  const size = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(size);
  ro.observe(stage);
  stage.addEventListener("pointerdown", (e) => { dragX = e.clientX; idleSpin = false; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => { if (dragX == null) return; spin += (e.clientX - dragX) * 0.012; dragX = e.clientX; });
  stage.addEventListener("pointerup", () => { dragX = null; });
  const clock = new THREE.Clock();
  let t = 0, raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, clock.getDelta());
    t += dt;
    zoom += ((closeUp ? 1 : 0) - zoom) * Math.min(1, dt * 5);
    camera.position.lerpVectors(camFar.pos, camNear.pos, zoom);
    camera.lookAt(camLook.lerpVectors(camFar.look, camNear.look, zoom));
    if (idleSpin) {
      if (closeUp) {
        // Sway gently near the front instead of spinning, so the face stays in view.
        const want = Math.round(spin / (Math.PI * 2)) * Math.PI * 2 + Math.sin(t * 0.6) * 0.45;
        spin += (want - spin) * Math.min(1, dt * 2);
      } else spin += dt * 0.35;
    }
    turn.rotation.y = spin;
    hero?.update(dt, t);
    renderer.render(scene, camera);
  };
  frame();

  // ---- the controls ----
  const presets = box.querySelector<HTMLElement>(".cr-presets")!;
  for (const pr of CHARACTER_PRESETS) {
    const b = document.createElement("button");
    b.textContent = pr.role;
    b.onclick = () => { P = makeRecipe({ ...pr.recipe, name: P.name }); renderControls(); rebuildSoon(); };
    presets.appendChild(b);
  }
  let tab = TABS[0];
  const tabs = box.querySelector<HTMLElement>(".cr-tabs")!;
  const controls = box.querySelector<HTMLElement>(".cr-controls")!;
  const renderTabs = () => {
    tabs.innerHTML = "";
    for (const name of TABS) {
      const b = document.createElement("button");
      b.textContent = name;
      b.className = name === tab ? "on" : "";
      b.onclick = () => { tab = name; closeUp = name === "Face" || name === "Eyes" || name === "Hair"; idleSpin = true; renderTabs(); renderControls(); };
      tabs.appendChild(b);
    }
  };
  const set = (k: Key, v: string | number) => { (P as unknown as Record<string, unknown>)[k] = v; rebuildSoon(); };
  const renderControls = () => {
    controls.innerHTML = "";
    let group = "";
    for (const c of SCHEMA) {
      if (c.tab !== tab) continue;
      if (c.group !== group) {
        group = c.group;
        const h = document.createElement("h4");
        h.textContent = group;
        controls.appendChild(h);
      }
      const row = document.createElement("div");
      row.className = "cr-row";
      const lab = document.createElement("label");
      lab.textContent = c.label;
      row.appendChild(lab);
      const v = (P as unknown as Record<string, unknown>)[c.key];
      if (c.type === "range") {
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(c.min);
        input.max = String(c.max);
        input.step = String((c.max - c.min) / 100);
        input.value = String(v);
        input.oninput = () => set(c.key, Number(input.value));
        const ends = document.createElement("div");
        ends.className = "cr-ends";
        ends.innerHTML = `<span>${c.ends[0]}</span><span>${c.ends[1]}</span>`;
        row.append(input, ends);
      } else if (c.type === "choice") {
        const opts = document.createElement("div");
        opts.className = "cr-opts";
        for (const [val, name] of c.opts) {
          const b = document.createElement("button");
          b.textContent = name;
          b.className = val === v ? "on" : "";
          b.onclick = () => { set(c.key, val); opts.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); };
          opts.appendChild(b);
        }
        row.appendChild(opts);
      } else {
        const opts = document.createElement("div");
        opts.className = "cr-swatches";
        for (const col of SW[c.pal]) {
          const b = document.createElement("button");
          b.style.background = col;
          b.className = col === v ? "on" : "";
          b.title = col;
          b.onclick = () => { set(c.key, col); opts.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); };
          opts.appendChild(b);
        }
        row.appendChild(opts);
      }
      controls.appendChild(row);
    }
  };
  renderTabs();
  renderControls();

  const close = () => {
    open = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    if (hero) hero.dispose();
    renderer.dispose();
    box.remove();
  };
  box.querySelector<HTMLButtonElement>(".cr-random")!.onclick = () => {
    const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
    const next: Record<string, unknown> = { name: P.name };
    for (const c of SCHEMA) {
      if (c.type === "range") next[c.key] = Math.round((c.min + Math.random() * (c.max - c.min)) * 100) / 100;
      else if (c.type === "choice") next[c.key] = pick(c.opts)[0];
      else next[c.key] = pick(c.pal === "skin" ? SW.skin.slice(0, 8) : c.pal === "hair" ? SW.hair.slice(0, 10) : SW[c.pal]);
    }
    // Keep it sensible: no crowns and wizard beards on everyone.
    if (Math.random() < 0.7) next.hat = "none";
    if (Math.random() < 0.6) next.glasses = "none";
    if (Math.random() < 0.5) next.beard = "none";
    P = makeRecipe(next as Partial<CharacterRecipe>);
    renderControls();
    rebuildSoon();
  };
  box.querySelector<HTMLButtonElement>(".cr-cancel")?.addEventListener("click", close);
  box.querySelector<HTMLButtonElement>(".cr-save")!.onclick = () => { onSave(recipeToLook(P)); close(); };
}
