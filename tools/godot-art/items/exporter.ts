// Runs in a headless browser: builds each item, exports it as .glb and draws a thumbnail.
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ITEMS } from "./catalog";

const SIZE = 384;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

function stats(o: THREE.Object3D) {
  let tris = 0;
  const mats = new Set<string>();
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x.name));
  });
  return { tris: Math.round(tris), materials: [...mats] };
}

function thumb(obj: THREE.Object3D, held: boolean) {
  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.environmentIntensity = 0.7;
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.0);
  sun.position.set(2, 3, 2.5);
  scene.add(sun, new THREE.HemisphereLight(0xbfe2f7, 0xa9c79a, 0.45));
  const pivot = new THREE.Group();
  pivot.add(obj);
  if (held) pivot.rotation.z = -Math.PI / 4; // long items lie diagonally, like inventory icons
  scene.add(pivot);
  const box = new THREE.Box3().setFromObject(pivot);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  pivot.position.sub(c);
  const r = held ? Math.max(s.x, s.y) * 0.5 : s.length() * 0.5;
  const cam = new THREE.PerspectiveCamera(30, 1, r * 0.1, r * 50);
  const dir = held ? new THREE.Vector3(0.0, 0.15, 1) : new THREE.Vector3(0.8, 0.75, 1.1);
  const d = r / Math.sin((15 * Math.PI) / 180) * (held ? 0.98 : 0.95);
  cam.position.copy(dir.normalize().multiplyScalar(d));
  cam.lookAt(0, 0, 0);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, cam);
  pivot.remove(obj);
  return renderer.domElement.toDataURL("image/png");
}

function b64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

(window as any).listItems = () => ITEMS.map(({ build, ...rest }) => rest);
(window as any).exportItem = async (id: string) => {
  const def = ITEMS.find((d) => d.id === id)!;
  const obj = def.build();
  obj.name = def.id;
  obj.updateMatrixWorld(true);
  const st = stats(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3));
  const glb = (await new GLTFExporter().parseAsync(obj, { binary: true, onlyVisible: true })) as ArrayBuffer;
  const png = thumb(obj, !!def.held);
  return { glb: b64(glb), png, ...st, size };
};
(window as any).ready = true;
