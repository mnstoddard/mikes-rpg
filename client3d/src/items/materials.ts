// Crafting materials: logs, metal bars, leather, thread and cloth.
import * as THREE from "three";
import type { Wood } from "../../../shared/tools";
import { ItemShape, MetalLook, Rng, WOOD_LOOK, barkMat, between, box, mat, mesh, metalMat, rod, rough, slab } from "./kit";

/** One log: bark round the outside, pale cut ends with a ring. Lies along X. */
export function makeLog(wood: Wood, rng: Rng, length = 0.5, r = 0.07): THREE.Group {
  const g = new THREE.Group();
  const look = WOOD_LOOK[wood];
  const side = mesh(rough(new THREE.CylinderGeometry(r, r * 1.04, length, 7, 2, true), rng, r * 0.12), barkMat(wood));
  side.rotation.z = Math.PI / 2;
  g.add(side);
  const ringColor = new THREE.Color(look.wood).multiplyScalar(0.78).getHex();
  for (const s of [1, -1]) {
    const end = mesh(new THREE.CircleGeometry(r * 0.98, 7), mat(look.wood, look.m));
    end.rotation.y = s * Math.PI / 2;
    end.position.x = s * length / 2;
    const ring = mesh(new THREE.RingGeometry(r * 0.42, r * 0.52, 7), mat(ringColor));
    ring.rotation.y = s * Math.PI / 2;
    ring.position.x = s * (length / 2 + 0.002);
    g.add(end, ring);
  }
  // A stubby cut-off twig.
  if (rng() < 0.7) {
    const twig = rod(r * 0.3, r * 0.2, r * 0.8, barkMat(wood), 5, 0);
    twig.position.set(between(rng, -0.15, 0.15), r * 0.7, 0);
    twig.rotation.z = between(rng, -0.6, 0.6);
    g.add(twig);
  }
  g.position.y = r;
  return g;
}

/** Logs: one log, or a little stack of three. */
export function buildLogs(wood: Wood, stack: boolean, rng: Rng): ItemShape {
  const object = new THREE.Group();
  if (!stack) object.add(makeLog(wood, rng));
  else {
    const spots: [number, number, number][] = [[0, 0, -0.075], [0, 0, 0.075], [0.02, 0.125, 0]];
    for (const [x, y, z] of spots) {
      const l = makeLog(wood, rng, between(rng, 0.46, 0.54));
      l.position.x += x;
      l.position.y += y;
      l.position.z = z;
      l.rotation.y = between(rng, -0.08, 0.08);
      object.add(l);
    }
  }
  return { object };
}

/** A metal bar: an ingot, wider at the bottom, with a stamped mark on top. */
export function makeBar(metal: MetalLook): THREE.Group {
  const g = new THREE.Group();
  const w = 0.2, d = 0.085, h = 0.05;
  // A 4-sided cylinder turned 45 degrees is a box that's narrower at the top.
  const geo = new THREE.CylinderGeometry(1, 1.28, h, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.scale(w / 2 / 0.905, 1, d / 2 / 0.905);
  const bar = mesh(geo, metalMat(metal));
  bar.position.y = h / 2;
  g.add(bar);
  // The smith's mark: a small sunk diamond.
  const mark = slab([[0, -0.012], [0.018, 0], [0, 0.012], [-0.018, 0]], 0.004, metalMat(metal, true));
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = h + 0.001;
  g.add(mark);
  return g;
}

export function buildBars(metal: MetalLook, stack: boolean): ItemShape {
  const object = new THREE.Group();
  if (!stack) object.add(makeBar(metal));
  else {
    const layout: [number, number, number, number][] = [[-0.05, 0, 0, 0], [0.05, 0, 0, 0], [0, 0.05, 0, Math.PI / 2]];
    for (const [x, y, z, r] of layout) {
      const b = makeBar(metal);
      b.position.set(x, y, z);
      b.rotation.y = r + Math.PI / 2;
      object.add(b);
    }
  }
  return { object };
}

/** Leather: a folded, slightly curled square of tanned hide with stitched edges. */
export function buildLeather(rng: Rng): ItemShape {
  const object = new THREE.Group();
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 0.16 * (0.85 + rng() * 0.2);
    pts.push([Math.cos(a) * r * 1.2, Math.sin(a) * r]);
  }
  const hide = slab(pts, 0.012, mat(0x8a5a32, { roughness: 0.9 }));
  hide.rotation.x = -Math.PI / 2;
  hide.position.y = 0.006;
  const top = slab(pts.map(([x, y]) => [x * 0.8, y * 0.8]), 0.012, mat(0x9b6a3e, { roughness: 0.9 }));
  top.rotation.x = -Math.PI / 2;
  top.rotation.z = 0.4;
  top.position.y = 0.02;
  object.add(hide, top);
  return { object };
}

/** Thread: a wooden spool wound with pale spider-silk thread. */
export function buildThread(): ItemShape {
  const object = new THREE.Group();
  const wood = mat(0xc79a62);
  object.add(rod(0.045, 0.045, 0.014, wood, 10, 0));
  object.add(rod(0.032, 0.032, 0.08, mat(0xf2eee6, { roughness: 0.6 }), 12, 0.014));
  object.add(rod(0.045, 0.045, 0.014, wood, 10, 0.094));
  // A loose end.
  const end = rod(0.002, 0.002, 0.08, mat(0xf2eee6), 3, 0);
  end.position.set(0.032, 0.03, 0);
  end.rotation.z = -1.1;
  object.add(end);
  return { object };
}

/** Cloth: a folded stack of woven cloth (blue-grey, like the cloth armor). */
export function buildCloth(): ItemShape {
  const object = new THREE.Group();
  const colors = [0x6a7fa8, 0x7a8fb8, 0x6a7fa8];
  colors.forEach((c, i) => object.add(box(0.26 - i * 0.01, 0.022, 0.18 - i * 0.008, mat(c, { roughness: 1 }), 0, 0.011 + i * 0.022, 0)));
  // A hanging fold over the front.
  const fold = box(0.24, 0.012, 0.06, mat(0x7a8fb8, { roughness: 1 }), 0, 0.04, 0.1);
  fold.rotation.x = 1.1;
  object.add(fold);
  return { object };
}
