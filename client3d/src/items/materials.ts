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

/** Leather: a whole tanned hide laid flat, with four legs, a neck and a tail. */
export function buildLeather(rng: Rng): ItemShape {
  const object = new THREE.Group();
  // Half the outline (nose to tail along x, one side in y); the other side is a mirror.
  const half: [number, number][] = [
    [0.19, 0.03], [0.14, 0.045], [0.125, 0.095], [0.15, 0.15], [0.122, 0.168], [0.088, 0.105],
    [0.02, 0.085], [-0.06, 0.09], [-0.095, 0.115], [-0.11, 0.172], [-0.145, 0.165], [-0.14, 0.095],
    [-0.17, 0.05], [-0.19, 0.014], [-0.25, 0.006],
  ];
  const j = (p: [number, number]): [number, number] => [p[0] + between(rng, -0.005, 0.005), p[1] + between(rng, -0.005, 0.005)];
  const outline: [number, number][] = [
    [0.21, 0], ...half.map(j), [-0.265, 0], ...half.slice().reverse().map(([x, y]) => j([x, -y])),
  ];
  // A darker rim underneath and the lighter tanned face on top.
  const rim = slab(outline, 0.004, mat(0x8a5a32, { roughness: 0.95 }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.002;
  const face = slab(outline.map(([x, y]) => [x * 0.95, y * 0.93]), 0.003, mat(0xb88452, { roughness: 0.9 }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0035;
  object.add(rim, face);
  object.rotation.y = 0.5;
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

/** Cloth: a length of woven cloth folded back and forth, the end draped over the front. */
export function buildCloth(): ItemShape {
  const object = new THREE.Group();
  // The side view of the folds: a zig-zag path with round bends at each end.
  // It is drawn in (z, y), then widened into a thick strip and stretched across x.
  const L = 0.09, h = 0.018, t = 0.011;
  const path: [number, number][] = [];
  const bend = (cz: number, cy: number, dir: number) => {
    for (let k = 1; k < 8; k++) {
      const a = -Math.PI / 2 + (k / 8) * Math.PI;
      path.push([cz + dir * Math.cos(a) * (h / 2), cy + Math.sin(a) * (h / 2)]);
    }
  };
  let y = t / 2;
  for (let layer = 0; layer < 3; layer++) {
    const dir = layer % 2 === 0 ? 1 : -1;
    path.push([-dir * L, y], [dir * L, y]);
    if (layer < 2) { bend(dir * L, y + h / 2, dir); y += h; }
  }
  // The end drapes over the front edge and hangs down.
  for (let k = 1; k <= 6; k++) {
    const a = (k / 6) * (Math.PI / 2);
    path.push([L + Math.sin(a) * 0.012, y - 0.012 + Math.cos(a) * 0.012]);
  }
  path.push([L + 0.015, y - 0.03], [L + 0.017, 0.006]);
  // Offset the path both ways to get a closed outline.
  const outer: [number, number][] = [], inner: [number, number][] = [];
  path.forEach((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    outer.push([p[0] + nx * t / 2, p[1] + ny * t / 2]);
    inner.push([p[0] - nx * t / 2, p[1] - ny * t / 2]);
  });
  const cloth = slab([...outer, ...inner.reverse()], 0.24, mat(0x6a7fa8, { roughness: 1 }));
  cloth.rotation.y = -Math.PI / 2;
  object.add(cloth);
  // A woven stripe near each edge, to read as cloth.
  for (const x of [-0.105, 0.105]) object.add(box(0.008, 0.001, 2 * L, mat(0x8a9fc8, { roughness: 1 }), x, y + t / 2 + 0.0004, 0));
  return { object };
}
