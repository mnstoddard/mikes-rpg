// The item picture sheet (version 0.21): every item's real 3D model, drawn small,
// in one image. tools/make-icons.mjs runs this page in a headless browser and saves
// what it makes: client3d/public/icons/items.png and client/src/itemIconIndex.ts.
// Each picture's name comes from shared/iconKey.ts (items that look the same share one).
import * as THREE from "three";
import { ITEMS } from "../../../shared/items";
import { iconKey } from "../../../shared/iconKey";
import { DISHES, type DishId } from "../../../shared/cooking";
import { isWeapon, parseWeapon } from "../../../shared/gear";
import { ITEM_LIST, createItem } from "../items";
import { createWeapon, WEAPON_KINDS, type WeaponKind } from "../weapons";
import { ARMOR_BY_ID, coversOf, dressFor, wearArmor } from "../armor";
import { CHARACTER_PRESETS, createCharacter } from "../character";
import { FOOD_BY_ID, createFood } from "../food";

const CELL = 64; // each picture in the sheet
const DRAW = 160; // drawn this big, then shrunk (smooth edges)

/** Every picture to draw: its name, and how to build the model. */
const builders = new Map<string, () => { object: THREE.Object3D; dispose: () => void }>();
const add = (key: string, build: () => { object: THREE.Object3D; dispose: () => void }) => { if (!builders.has(key)) builders.set(key, build); };
const disposeTree = (o: THREE.Object3D) => () => o.traverse((m) => {
  const mesh = m as THREE.Mesh;
  if (!mesh.isMesh) return;
  mesh.geometry.dispose();
  for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mat.dispose();
});

// Weapons: one per kind and metal.
for (const id of Object.keys(ITEMS)) {
  if (!isWeapon(id)) continue;
  const { type, metal } = parseWeapon(id);
  if (!WEAPON_KINDS.includes(type as WeaponKind)) continue;
  add(iconKey(id), () => { const w = createWeapon(type as WeaponKind, { metal, wood: "oak" } as never); return { object: w.object, dispose: disposeTree(w.object) }; });
}
// The item library: tools, materials, finds, loot, potions, gems, quest items. Every choice it can make.
for (const t of ITEM_LIST) {
  if (!t.gameItem) continue;
  const sizes = t.options.map((o) => o.options.length);
  const total = sizes.reduce((a, b) => a * b, 1);
  for (let n = 0; n < total; n++) {
    let k = n;
    const choice = sizes.map((s) => { const c = k % s; k = Math.floor(k / s); return c; });
    const gid = t.gameItem(choice);
    if (!gid) continue;
    // Tools show oak handles (the first wood is pine, and pale).
    if (t.group === "tools" && /_(pine|birch|maple|yew|ironwood|elderwood)$/.test(String(gid))) continue;
    if (t.group === "tools" && String(gid).startsWith("rod_") && gid !== "rod_oak") continue;
    add(iconKey(String(gid)), () => { const it = createItem(t.id, { seed: 3, choice }); return { object: it.object, dispose: () => it.dispose() }; });
  }
}
// Armor, on an invisible body (the armor stays where it would be worn).
for (const id of Object.keys(ITEMS)) {
  const e = ARMOR_BY_ID[id];
  if (!e || e.planned) continue;
  add(id, () => {
    const d = dressFor(CHARACTER_PRESETS[0].recipe, coversOf(e));
    const c = createCharacter(d.recipe, { hideHair: true, anim: null });
    wearArmor(c, id, { variant: e.style });
    c.update(0.016, 0);
    c.object.traverse((o) => { if (o.userData.char && !o.userData.armor) o.visible = false; });
    return { object: c.object, dispose: disposeTree(c.object) };
  });
}
// Fish, food and meals.
for (const id of Object.keys(ITEMS)) {
  for (const f of [`fish-${id}`, `ingredient-${id}`]) if (FOOD_BY_ID[f]) add(id, () => { const s = createFood(f, { seed: 2 }); return { object: s.object, dispose: () => s.dispose() }; });
}
for (const dish of Object.keys(DISHES) as DishId[]) if (FOOD_BY_ID[`dish-${dish}`]) add(`meal_${dish}`, () => { const s = createFood(`dish-${dish}`, { seed: 2 }); return { object: s.object, dispose: () => s.dispose() }; });

// ---- Drawing ----

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(DRAW, DRAW);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
// Warm firelight from the top left, a cool fill, and a gold rim from behind: the Emberhall's light.
scene.add(new THREE.HemisphereLight(0xfff0d8, 0x3a2a20, 1.4));
const key = new THREE.DirectionalLight(0xffe2b0, 2.6);
key.position.set(-2, 4, 3);
const rim = new THREE.DirectionalLight(0xffb050, 1.6);
rim.position.set(2, 1.5, -3);
const fill = new THREE.DirectionalLight(0xb8c8ff, 0.5);
fill.position.set(3, 0, 2);
scene.add(key, rim, fill);
const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
const VIEW = new THREE.Vector3(0.5, 0.55, 1).normalize();

/** Is it really drawn (it and everything above it visible)? */
const shown = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };

function frame(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  object.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && shown(m)) box.expandByObject(m);
  });
  const size = box.getSize(new THREE.Vector3());
  // Long, thin things (swords, staffs, tools) lie corner to corner.
  if (size.y > size.x * 2.2 && size.y > size.z * 2.2) {
    object.rotation.z = -Math.PI / 4;
    object.updateMatrixWorld(true);
    box.makeEmpty();
    object.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && shown(m)) box.expandByObject(m); });
  }
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
  camera.position.copy(sphere.center).addScaledVector(VIEW, dist);
  camera.lookAt(sphere.center);
  camera.near = dist / 20;
  camera.far = dist * 4;
  camera.updateProjectionMatrix();
}

const keys = [...builders.keys()].sort();
const cols = Math.ceil(Math.sqrt(keys.length));
const sheet = document.createElement("canvas");
sheet.width = sheet.height = cols * CELL;
const ctx = sheet.getContext("2d")!;
const index: Record<string, number> = {};
const failed: string[] = [];
let n = 0;
for (const k of keys) {
  let made: { object: THREE.Object3D; dispose: () => void } | null = null;
  try {
    made = builders.get(k)!();
    const holder = new THREE.Group();
    holder.add(made.object);
    scene.add(holder);
    frame(made.object);
    renderer.render(scene, camera);
    scene.remove(holder);
    const x = (n % cols) * CELL, y = Math.floor(n / cols) * CELL;
    ctx.save();
    // A soft dark edge, so light things show on light slots and dark things on dark ones.
    ctx.shadowColor = "rgba(20, 10, 0, 0.75)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.drawImage(renderer.domElement, 0, 0, DRAW, DRAW, x + 2, y + 2, CELL - 4, CELL - 4);
    ctx.restore();
    index[k] = n++;
  } catch (err) {
    failed.push(`${k}: ${(err as Error).message}`);
  }
  try { made?.dispose(); } catch { /* already gone */ }
}

(window as unknown as { __icons: unknown }).__icons = { cols, cell: CELL, index, failed, png: sheet.toDataURL("image/png") };
