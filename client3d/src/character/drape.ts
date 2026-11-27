// Robes and skirts that move with the legs.
//
// A robe or skirt is a cone hung from the hips. On its own it stays still while the
// legs swing, so a striding leg pokes straight through the cloth. drape() bends the
// cloth every frame instead: wherever a leg would come out, that part of the cloth is
// pushed out around the leg, as if the cloth stretched over the knee and shin. Where the
// legs are inside, the cloth keeps its own shape.
//
// It works from the leg joints' real positions when the frame is drawn, so it follows
// any animation (walking, cheering, a monster's own poses) without being told about it.
import * as THREE from "three";

/** The joints a drape needs (a character's Joints has all of these). */
export interface DrapeJoints {
  hips: THREE.Object3D;
  hipL: THREE.Object3D; hipR: THREE.Object3D;
  kneeL: THREE.Object3D; kneeR: THREE.Object3D;
  ankL: THREE.Object3D; ankR: THREE.Object3D;
}
/** Leg sizes (a character's Fit has all of these). */
export interface DrapeFit { thighR: number; shinR: number; footH: number; footLen: number; footW: number }

/**
 * The cloth's resting shape, in the hips' space: a cone from `top` down to `bottom`
 * (heights), `rTop` / `rBottom` wide sideways, and `zs` times that front to back.
 */
export interface DrapeShape { top: number; bottom: number; rTop: number; rBottom: number; zs: number }

/** How far the cloth stands off a leg. */
const GAP = 0.02;
/** Softens the edge where the cloth starts to bend out, so there's no sharp crease. */
const SOFT = 0.03;

interface Seg { a: THREE.Vector3; b: THREE.Vector3; ra: number; rb: number }

const V = () => new THREE.Vector3();
const tmpM = new THREE.Matrix4();

/**
 * Make these meshes (all children of the hips) bend around the legs. The meshes' own
 * geometry is changed in place, so each needs a geometry of its own (not shared).
 */
export function drape(meshes: THREE.Mesh[], J: DrapeJoints, fit: DrapeFit, shape: DrapeShape) {
  // Where the legs are this frame, worked out once and shared by the meshes.
  const pts = Array.from({ length: 8 }, V);
  const segs: Seg[] = [];
  let legsFrame = -1;
  const legs = (frame: number) => {
    if (frame === legsFrame) return segs;
    legsFrame = frame;
    segs.length = 0;
    tmpM.copy(J.hips.matrixWorld).invert();
    let i = 0;
    for (const [hip, knee, ank] of [[J.hipL, J.kneeL, J.ankL], [J.hipR, J.kneeR, J.ankR]]) {
      const h = pts[i++].setFromMatrixPosition(hip.matrixWorld).applyMatrix4(tmpM);
      const k = pts[i++].setFromMatrixPosition(knee.matrixWorld).applyMatrix4(tmpM);
      const a = pts[i++].setFromMatrixPosition(ank.matrixWorld).applyMatrix4(tmpM);
      // The front of the foot: it swings forward under the hem when stepping.
      const toe = pts[i++].set(0, -fit.footH * 0.4, 0.035 + fit.footLen * 0.35).applyMatrix4(ank.matrixWorld).applyMatrix4(tmpM);
      segs.push({ a: h, b: k, ra: fit.thighR * 1.05, rb: fit.thighR * 0.85 });
      segs.push({ a: k, b: a, ra: fit.shinR * 1.2, rb: fit.shinR * 0.85 });
      segs.push({ a, b: toe, ra: fit.footW * 0.5, rb: fit.footW * 0.45 });
    }
    return segs;
  };

  const span = Math.max(1e-4, shape.top - shape.bottom);
  /** The cloth's own distance out from the middle, at height y, in direction (dx, dz). */
  const restRadius = (y: number, dx: number, dz: number) => {
    const t = Math.min(1, Math.max(0, (shape.top - y) / span));
    const r = shape.rTop + (shape.rBottom - shape.rTop) * t;
    return 1 / Math.hypot(dx / r, dz / (r * shape.zs));
  };
  /** How far out the legs reach at height y in direction (dx, dz). */
  // Each leg bone is treated as a row of balls along it (version 0.22): a thigh lifted forward lies almost flat,
  // and one slice through the middle of it (as before) missed the knee end, so it poked out of the robe (Mike's note).
  const SAMPLES = 7;
  const legReach = (S: Seg[], y: number, dx: number, dz: number) => {
    let best = -Infinity;
    for (const s of S) {
      const dy = s.b.y - s.a.y;
      const tc = Math.abs(dy) < 1e-5 ? 0.5 : (y - s.a.y) / dy;
      for (let k = 0; k <= SAMPLES; k++) {
        // The point where this height crosses the bone, and points spread along the rest of it.
        const t = k === SAMPLES ? Math.min(1, Math.max(0, tc)) : k / (SAMPLES - 1);
        const px = s.a.x + (s.b.x - s.a.x) * t, py = s.a.y + dy * t, pz = s.a.z + (s.b.z - s.a.z) * t;
        const r = s.ra + (s.rb - s.ra) * t + GAP;
        const off = Math.abs(py - y);
        if (off >= r) continue;
        // This height cuts that ball in a circle this wide.
        const reach = px * dx + pz * dz + Math.sqrt(r * r - off * off);
        if (reach > best) best = reach;
      }
    }
    return best;
  };

  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const rest = Float32Array.from(pos.array as Float32Array);
    const toHips = new THREE.Matrix4(), fromHips = new THREE.Matrix4();
    const p = V();
    let lastFrame = -1;
    // The cloth can now reach further out than its resting shape.
    mesh.geometry.computeBoundingSphere();
    if (mesh.geometry.boundingSphere) mesh.geometry.boundingSphere.radius *= 1.6;
    mesh.onBeforeRender = (renderer) => {
      // Drawn more than once a frame (shadows, then the picture): bend it once.
      const frame = renderer.info.render.frame;
      if (frame === lastFrame || !mesh.parent) return;
      lastFrame = frame;
      const S = legs(frame);
      mesh.updateMatrix();
      toHips.copy(mesh.matrix);
      fromHips.copy(mesh.matrix).invert();
      const arr = pos.array as Float32Array;
      let moved = false;
      for (let i = 0; i < rest.length; i += 3) {
        p.set(rest[i], rest[i + 1], rest[i + 2]).applyMatrix4(toHips);
        const rho = Math.hypot(p.x, p.z);
        let push = 0;
        if (rho > 1e-5 && p.y < shape.top) {
          const dx = p.x / rho, dz = p.z / rho;
          const y = Math.max(shape.bottom, p.y);
          const over = legReach(S, y, dx, dz) - restRadius(y, dx, dz);
          // A smooth ramp: nothing when the legs are well inside, then the full overlap.
          push = over <= -SOFT ? 0 : over >= SOFT ? over : ((over + SOFT) * (over + SOFT)) / (4 * SOFT);
          if (push > 0) {
            p.x += dx * push;
            p.z += dz * push;
            p.applyMatrix4(fromHips);
          }
        }
        if (push > 0) {
          arr[i] = p.x; arr[i + 1] = p.y; arr[i + 2] = p.z;
          moved = true;
        } else if (arr[i] !== rest[i] || arr[i + 2] !== rest[i + 2]) {
          arr[i] = rest[i]; arr[i + 1] = rest[i + 1]; arr[i + 2] = rest[i + 2];
          moved = true;
        }
      }
      if (moved) {
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
      }
    };
  }
}
