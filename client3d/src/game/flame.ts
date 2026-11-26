// Fire for the Emberhall (version 0.14): the Heart Shrine's tall flame and the
// braziers round the great hall. Made from code like everything else: a few
// glowing cones that flicker, a warm light, and embers drifting up.
import * as THREE from "three";

const FLAME_COLORS = [0xff5a14, 0xff9a26, 0xffd84a, 0xfff4c0];

/** Glowing cones (outer orange to inner white), flickering, plus embers that rise and fade. */
export function makeFlame(size = 1, seed = 1): { object: THREE.Group; update(dt: number, t: number): void; dispose(): void } {
  const object = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const cones: THREE.Mesh[] = [];
  FLAME_COLORS.forEach((color, i) => {
    const r = (0.42 - i * 0.09) * size, h = (1.25 - i * 0.22) * size;
    const g = new THREE.ConeGeometry(r, h, 7, 1, true);
    g.translate(0, h / 2, 0);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 + i * 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(g, m);
    cone.renderOrder = 3 + i;
    cone.userData.noShadow = true;
    geos.push(g);
    mats.push(m);
    cones.push(cone);
    object.add(cone);
  });
  // Embers: little sparks that float up and wink out.
  const N = Math.round(10 * size);
  const emberGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  emberGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const emberMat = new THREE.PointsMaterial({ color: 0xffb040, size: 0.09 * Math.max(1, size), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  object.add(embers);
  geos.push(emberGeo);
  mats.push(emberMat);
  const phase = Array.from({ length: N }, (_, i) => ((i * 0.618 + seed * 0.37) % 1));
  const light = new THREE.PointLight(0xff9a3a, 2.2 * size, 9 * Math.max(1, size), 1.6);
  light.position.y = 0.8 * size;
  object.add(light);
  return {
    object,
    update(_dt, t) {
      cones.forEach((c, i) => {
        const f = 1 + Math.sin(t * (9 + i * 2.3) + seed + i) * 0.08 + Math.sin(t * 17.1 + i * 1.7 + seed) * 0.05;
        c.scale.set(1 + Math.sin(t * 6.3 + i + seed) * 0.05, f, 1 + Math.cos(t * 5.7 + i) * 0.05);
        c.rotation.y = t * (0.6 + i * 0.25) + seed;
      });
      for (let i = 0; i < N; i++) {
        const k = (t * 0.45 + phase[i]) % 1;
        const a = phase[i] * Math.PI * 2 + t * 0.7;
        pos[i * 3] = Math.cos(a) * 0.25 * size * (1 - k * 0.5);
        pos[i * 3 + 1] = (0.3 + k * 1.9) * size;
        pos[i * 3 + 2] = Math.sin(a) * 0.25 * size * (1 - k * 0.5);
      }
      emberGeo.attributes.position.needsUpdate = true;
      emberMat.opacity = 0.9;
      light.intensity = 2.2 * size * (0.85 + Math.sin(t * 11 + seed) * 0.08 + Math.sin(t * 23 + seed * 2) * 0.07);
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

/** A brazier: an iron bowl of coals on three legs, with a flame. */
export function makeBrazier(seed = 1): { object: THREE.Group; update(dt: number, t: number): void; dispose(): void } {
  const object = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.6, metalness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a640, roughness: 0.4, metalness: 0.7 });
  const coal = new THREE.MeshStandardMaterial({ color: 0x2a1a12, emissive: 0xff4a10, emissiveIntensity: 0.9, roughness: 1, flatShading: true });
  const geos: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    object.add(mesh);
    return mesh;
  };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = add(new THREE.CylinderGeometry(0.05, 0.07, 1.0, 5), iron, Math.cos(a) * 0.32, 0.5, Math.sin(a) * 0.32);
    leg.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18);
  }
  add(new THREE.CylinderGeometry(0.55, 0.32, 0.32, 10, 1, true), iron, 0, 1.08, 0).material = iron;
  add(new THREE.TorusGeometry(0.55, 0.04, 5, 14), gold, 0, 1.24, 0).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10), coal, 0, 1.16, 0);
  const flame = makeFlame(0.8, seed);
  flame.object.position.y = 1.18;
  object.add(flame.object);
  return {
    object,
    update: (dt, t) => flame.update(dt, t),
    dispose() { geos.forEach((g) => g.dispose()); iron.dispose(); gold.dispose(); coal.dispose(); flame.dispose(); },
  };
}
