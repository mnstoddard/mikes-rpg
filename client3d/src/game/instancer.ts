// Drawing thousands of trees, rocks and decorations cheaply.
//
// Each library object (a pine tree, a bush...) is built once as a "prototype".
// Its meshes are merged into one geometry per material, and every copy in the
// world is one instance of an InstancedMesh. So 3,000 pine trees cost a few
// draw calls instead of tens of thousands. Copies near the player can be
// hidden here and shown as a live, animated library object instead.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

interface ProtoPart { geo: THREE.BufferGeometry; mat: THREE.Material; cast: boolean }
interface Instance { id: string; matrix: THREE.Matrix4; hidden: boolean }
interface Proto {
  parts: ProtoPart[];
  instances: Instance[];
  meshes: THREE.InstancedMesh[];
  dirty: boolean;
}

/** Bake an object's visible meshes into one geometry per material (in the object's own space). */
export function bakeObject(root: THREE.Object3D, cast = true): ProtoPart[] {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.Points).isPoints) return;
    // Skip anything hidden (fallen tree tops, sparks...).
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) return;
    if (Array.isArray(m.material)) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const list = byMat.get(m.material) ?? [];
    list.push(g);
    byMat.set(m.material, list);
  });
  const parts: ProtoPart[] = [];
  for (const [mat, geos] of byMat) {
    const hasColor = geos.some((g) => g.attributes.color);
    const clean = geos.map((g) => {
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", g.attributes.position);
      if (!g.attributes.normal) g.computeVertexNormals();
      out.setAttribute("normal", g.attributes.normal);
      if (hasColor) {
        const c = g.attributes.color;
        if (c && c.itemSize === 3) out.setAttribute("color", c);
        else {
          const n = g.attributes.position.count;
          out.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
        }
      }
      return out;
    });
    const merged = mergeGeometries(clean, false);
    geos.forEach((g) => g.dispose());
    if (merged) {
      merged.computeBoundingSphere();
      parts.push({ geo: merged, mat, cast });
    }
  }
  return parts;
}

export class Instancer {
  private protos = new Map<string, Proto>();
  /** Which proto each instance id is in. */
  private where = new Map<string, Proto>();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(private parent: THREE.Object3D, private receiveShadow = true) {}

  /** Make sure a prototype exists (built once, the first time it's needed). */
  private proto(key: string, build: () => THREE.Object3D, cast: boolean): Proto {
    let p = this.protos.get(key);
    if (!p) {
      const obj = build();
      p = { parts: bakeObject(obj, cast), instances: [], meshes: [], dirty: true };
      this.protos.set(key, p);
    }
    return p;
  }

  has(id: string) { return this.where.has(id); }

  add(id: string, key: string, build: () => THREE.Object3D, matrix: THREE.Matrix4, cast = true) {
    if (this.where.has(id)) return;
    const p = this.proto(key, build, cast);
    p.instances.push({ id, matrix, hidden: false });
    p.dirty = true;
    this.where.set(id, p);
  }

  remove(id: string) {
    const p = this.where.get(id);
    if (!p) return;
    const i = p.instances.findIndex((x) => x.id === id);
    if (i >= 0) p.instances.splice(i, 1);
    p.dirty = true;
    this.where.delete(id);
  }

  /** Hide one copy (it's shown as a live object instead, or it's been chopped down). */
  setHidden(id: string, hidden: boolean) {
    const p = this.where.get(id);
    if (!p) return;
    const inst = p.instances.find((x) => x.id === id);
    if (!inst || inst.hidden === hidden) return;
    inst.hidden = hidden;
    const idx = p.instances.indexOf(inst);
    if (!p.dirty) {
      for (const m of p.meshes) {
        m.setMatrixAt(idx, hidden ? this.zero : inst.matrix);
        m.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /** The instance id under a raycast hit, if it hit one of ours. */
  idAt(hit: THREE.Intersection): string | null {
    const mesh = hit.object as THREE.InstancedMesh;
    const p = mesh.userData.proto as Proto | undefined;
    if (!p || hit.instanceId == null) return null;
    const inst = p.instances[hit.instanceId];
    return inst && !inst.hidden ? inst.id : null;
  }

  /** Every InstancedMesh, for raycasting. */
  meshes(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const p of this.protos.values()) out.push(...p.meshes);
    return out;
  }

  /** Rebuild the instanced meshes that changed. Call once a frame. */
  flush() {
    for (const p of this.protos.values()) {
      if (!p.dirty) continue;
      p.dirty = false;
      for (const m of p.meshes) { this.parent.remove(m); m.dispose(); }
      p.meshes = [];
      if (!p.instances.length) continue;
      for (const part of p.parts) {
        const m = new THREE.InstancedMesh(part.geo, part.mat, p.instances.length);
        p.instances.forEach((inst, i) => m.setMatrixAt(i, inst.hidden ? this.zero : inst.matrix));
        m.instanceMatrix.needsUpdate = true;
        m.castShadow = part.cast;
        m.receiveShadow = this.receiveShadow;
        m.computeBoundingSphere();
        m.userData.proto = p;
        this.parent.add(m);
        p.meshes.push(m);
      }
    }
  }
}
