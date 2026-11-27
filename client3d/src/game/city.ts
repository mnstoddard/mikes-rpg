// Emberhold, the walled capital (version 0.20), in 3D.
//
// The city has hundreds of buildings, so it's drawn the light way (Mike plays on
// an iPad): every backdrop building is made from the same few kit pieces (a
// block of wall per storey, a gable roof, a chimney, windows) and they're all
// merged into a handful of meshes for the whole city. Only the buildings you can
// go into (and the Emberhall) are drawn in full detail, by terrain.ts.
//
// Also here: cones on the wall towers, the bell tower, the Emberhall's spire,
// and embers drifting up from the Emberhall like on the title screen.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CITY_BUILDINGS, CITY_TOWERS, type CityBuilding } from "../../../shared/world";
import { areaAt, type AreaDef } from "../../../shared/map";
import { TILE } from "../environment";
import { hash2, makeRng, mix, painted } from "../environment/kit";

const vcol = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

/** Colours for each kind of wall and roof (a little different on every house). */
const WALL_COLORS: Record<CityBuilding["wall"], [number, number]> = {
  stone: [0xb9ad97, 0xd3c8b2], timber: [0xe8dcc0, 0xf2e6cc], plank: [0x9c6a42, 0xb07c50], marble: [0xf2efe8, 0xf6f3ec], guild: [0x6a4a9a, 0x7a58aa],
};
const HILL_STONE: [number, number] = [0xd3cab8, 0xe2dacb];
const ROOF_COLORS: Record<CityBuilding["roof"], [number, number]> = {
  slate: [0x55627a, 0x6f7d93], red: [0x9e4630, 0xbd5a3c], dark: [0x4a3c36, 0x5d4a42], thatch: [0xae8a4c, 0xc8a460], gold: [0xd9b44a, 0xe6c45c],
};
const FLOOR_H = 2.5;

/** A gable roof (a long triangle), ridge along x, sitting on y = 0. */
function gable(len: number, span: number, h: number): THREE.BufferGeometry {
  const L = len / 2, S = span / 2;
  const p = [
    // the two slopes
    -L, 0, -S, L, 0, -S, L, h, 0, -L, 0, -S, L, h, 0, -L, h, 0,
    L, 0, S, -L, 0, S, -L, h, 0, L, 0, S, -L, h, 0, L, h, 0,
    // the two ends
    -L, 0, S, -L, 0, -S, -L, h, 0,
    L, 0, -S, L, 0, S, L, h, 0,
  ];
  // Turn each triangle round (so its front faces outwards).
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) [p[i + 3 + k], p[i + 6 + k]] = [p[i + 6 + k], p[i + 3 + k]];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.deleteAttribute("uv");
  g.translate(x, y, z);
  return painted(g, color);
}

function quad(w: number, h: number, x: number, y: number, z: number, rotY: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
  g.deleteAttribute("uv");
  g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

/**
 * For a mesh that never changes and is never clicked: once its shape is on the graphics
 * card, the copy in the browser's memory isn't needed, so it's thrown away. This halves
 * what big merged meshes cost (iPads run out of memory otherwise).
 */
export function gpuOnly(g: THREE.BufferGeometry) {
  g.computeBoundingSphere();
  g.computeBoundingBox();
  const drop = function (this: THREE.BufferAttribute) {
    this.array = new (this.array.constructor as Float32ArrayConstructor)(0);
  };
  for (const a of Object.values(g.attributes)) (a as THREE.BufferAttribute).onUpload(drop);
  g.index?.onUpload(drop);
  return g;
}

/** Backdrop buildings are merged in squares this many tiles wide, so the ones off screen aren't drawn. */
const SECTOR = 24;

export interface CityPiece { object: THREE.Object3D; update: (dt: number, t: number, night: number) => void; dispose: () => void }

/**
 * Every backdrop building, the bell tower and the tower cones, merged.
 * `setHeight` tells the terrain how tall each tile is (so the camera stays out).
 */
export function cityBackdrop(area: AreaDef, setHeight: (x: number, y: number, h: number) => void): CityPiece {
  const solid: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  for (const b of CITY_BUILDINGS) {
    if (b.detail || areaAt(b.x, b.y) !== area) continue;
    const rng = makeRng(b.seed + 11);
    const W = b.w * TILE - 0.35, D = b.h * TILE - 0.35;
    const cx = (b.x + b.w / 2) * TILE, cz = (b.y + b.h / 2) * TILE;
    if (b.landmark === "belltower") {
      // A tall stone tower with a slate spire and a glowing belfry: you can see it from all over town.
      const H = 15;
      solid.push(box(W, H, D, cx, H / 2, cz, 0xc9bea8));
      solid.push(box(W + 0.4, 0.5, D + 0.4, cx, 0.25, cz, 0x8e8472));
      solid.push(box(W + 0.3, 0.3, D + 0.3, cx, H - 3.2, cz, 0x8e8472));
      const spire = new THREE.ConeGeometry(W * 0.78, 6, 4, 1).toNonIndexed();
      spire.deleteAttribute("uv");
      spire.rotateY(Math.PI / 4);
      spire.translate(cx, H + 3, cz);
      solid.push(painted(spire, 0x55627a));
      for (const [dx, dz, ry] of [[0, D / 2 + 0.02, 0], [0, -D / 2 - 0.02, Math.PI], [W / 2 + 0.02, 0, Math.PI / 2], [-W / 2 - 0.02, 0, -Math.PI / 2]] as const) {
        lit.push(quad(1.6, 2.2, cx + dx, H - 1.6, cz + dz, ry));
        for (let k = 0; k < 3; k++) dark.push(quad(0.6, 1.0, cx + dx * 1.001, 3 + k * 3.4, cz + dz * 1.001, ry));
      }
      for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) setHeight(xx, yy, H + 6);
      continue;
    }
    // The Emberhall stands on Ember Hill (version 0.22): lift it onto a stone terrace.
    const lift = b.landmark === "emberhall" ? 3 : 0;
    const marks = [solid.length, lit.length, dark.length];
    const wallPal = b.district === "hill" && b.wall === "stone" ? HILL_STONE : WALL_COLORS[b.wall];
    const wallCol = mix(wallPal[0], wallPal[1], rng());
    const roofCol = mix(ROOF_COLORS[b.roof][0], ROOF_COLORS[b.roof][1], rng());
    const H = b.floors * FLOOR_H;
    solid.push(box(W, H, D, cx, H / 2, cz, wallCol));
    // A darker footing, and a band between the storeys.
    solid.push(box(W + 0.12, 0.55, D + 0.12, cx, 0.27, cz, mix(wallCol, 0x4a3e32, 0.45)));
    const band = b.wall === "timber" || b.wall === "plank" ? 0x5c3a1a : mix(wallCol, 0x6a5e4e, 0.35);
    for (let k = 1; k < b.floors; k++) solid.push(box(W + 0.08, 0.2, D + 0.08, cx, k * FLOOR_H, cz, band));
    if (b.wall === "timber") {
      // Dark beams at the corners.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.push(box(0.22, H, 0.22, cx + sx * (W / 2 - 0.05), H / 2, cz + sz * (D / 2 - 0.05), 0x5c3a1a));
    }
    // The roof: ridge along the longer side, overhanging a little.
    const alongX = W >= D;
    const span = (alongX ? D : W) + 0.7, len = (alongX ? W : D) + 0.5;
    const rh = Math.min(span * 0.42, 4.2);
    const roof = gable(len, span, rh);
    if (!alongX) roof.rotateY(Math.PI / 2);
    roof.translate(cx, H, cz);
    solid.push(painted(roof, roofCol));
    if (b.chimney) {
      const off = (rng() - 0.5) * (alongX ? W : D) * 0.6;
      solid.push(box(0.7, rh + 0.9, 0.7, cx + (alongX ? off : span * 0.18), H + (rh + 0.9) / 2, cz + (alongX ? span * 0.18 : off), 0x7a6e62));
    }
    // Windows on every side, a few lit at night; a door on the front.
    const faces: [number, number, number, number][] = [
      [0, D / 2 + 0.03, 0, W], [0, -D / 2 - 0.03, Math.PI, W], [W / 2 + 0.03, 0, Math.PI / 2, D], [-W / 2 - 0.03, 0, -Math.PI / 2, D],
    ];
    for (const [fx, fz, ry, len2] of faces) {
      const n = Math.max(1, Math.floor(len2 / 2.4));
      for (let f = 0; f < b.floors; f++) for (let i = 0; i < n; i++) {
        const along = -len2 / 2 + (i + 0.5) * (len2 / n);
        const wx = cx + fx + (Math.abs(fz) > 0 ? along : 0), wz = cz + fz + (Math.abs(fx) > 0 ? along : 0);
        if (f === 0 && ry === 0 && i === Math.floor(n / 2) && W > 4) {
          solid.push(box(1.0, 1.9, 0.08, wx, 0.95, wz, 0x4a3020));
          continue;
        }
        (hash2(wx, wz + f, 41) < 0.35 ? lit : dark).push(quad(0.62, 0.9, wx, f * FLOOR_H + 1.5, wz, ry));
      }
    }
    if (lift) {
      [solid, lit, dark].forEach((list, i) => list.slice(marks[i]).forEach((g) => g.translate(0, lift, 0)));
      solid.push(box(W + 10, lift, D + 12, cx, lift / 2, cz + 1, 0xc9bfac));
      solid.push(box(W + 10.3, 0.3, D + 12.3, cx, lift, cz + 1, 0xe8e2d6));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const t = new THREE.CylinderGeometry(1.6, 1.6, H + 4, 10).toNonIndexed();
        t.deleteAttribute("uv");
        t.translate(cx + sx * W / 2, lift + (H + 4) / 2, cz + sz * D / 2);
        solid.push(painted(t, 0xf2efe8));
        const c2 = new THREE.ConeGeometry(1.7, 3, 10).toNonIndexed();
        c2.deleteAttribute("uv");
        c2.translate(cx + sx * W / 2, lift + H + 5.5, cz + sz * D / 2);
        solid.push(painted(c2, 0xd9b44a));
      }
    }
    // The camera only steers round the walls (it may brush a roof's peak), so the narrow streets don't push it right up to you.
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) setHeight(xx, yy, H + 0.4 + lift);
  }
  // Slate cones on the wall towers.
  for (const t of CITY_TOWERS) {
    if (areaAt(t.x, t.y) !== area) continue;
    const cone = new THREE.ConeGeometry(3.6, 4.2, 8, 1).toNonIndexed();
    cone.deleteAttribute("uv");
    cone.translate((t.x + 0.5) * TILE, 8.3 + 2.1, (t.y + 0.5) * TILE);
    solid.push(painted(cone, 0x55627a));
  }

  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const add = (all: THREE.BufferGeometry[], mat: THREE.Material, shadow: boolean) => {
    // One mesh per square of the city, so the camera only draws the squares it can see.
    const sectors = new Map<string, THREE.BufferGeometry[]>();
    const c = new THREE.Vector3();
    for (const geo of all) {
      geo.computeBoundingBox();
      geo.boundingBox!.getCenter(c);
      const k = `${Math.floor(c.x / TILE / SECTOR)},${Math.floor(c.z / TILE / SECTOR)}`;
      (sectors.get(k) ?? sectors.set(k, []).get(k)!).push(geo);
    }
    for (const list of sectors.values()) {
      const g = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      if (!g) continue;
      const m = new THREE.Mesh(gpuOnly(g), mat);
      m.castShadow = shadow;
      m.receiveShadow = shadow;
      group.add(m);
      meshes.push(m);
    }
  };
  const litMat = new THREE.MeshStandardMaterial({ color: 0x2c3440, emissive: 0xffbf6a, emissiveIntensity: 0, roughness: 0.35, metalness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c3440, roughness: 0.35, metalness: 0.1 });
  add(solid, vcol, true);
  add(lit, litMat, false);
  add(dark, darkMat, false);
  return {
    object: group,
    update: (_dt, _t, night) => { litMat.emissiveIntensity = night * 1.5; },
    dispose: () => { meshes.forEach((m) => m.geometry.dispose()); litMat.dispose(); darkMat.dispose(); },
  };
}

/** The Emberhall's spire with its flame on top, and embers drifting up into the sky. */
export function emberhallCrown(b: CityBuilding, roofTop: number): CityPiece {
  const group = new THREE.Group();
  const cx = (b.x + b.w / 2) * TILE, cz = (b.y + b.h / 2) * TILE;
  const stone = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.7 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b44a, roughness: 0.35, metalness: 0.5 });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 1.6 });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 9, 2.4), stone);
  tower.position.set(cx, roofTop + 2.5, cz);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.4, 4), gold);
  cap.rotation.y = Math.PI / 4;
  cap.position.set(cx, roofTop + 8.7, cz);
  const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), flameMat);
  flame.position.set(cx, roofTop + 11.2, cz);
  for (const m of [tower, cap]) { m.castShadow = true; group.add(m); }
  group.add(flame);
  // Embers: little sparks rising from the spire and drifting away.
  const N = 70;
  const rng = makeRng(5);
  const pos = new Float32Array(N * 3);
  const seeds = Array.from({ length: N }, () => ({ a: rng() * Math.PI * 2, r: rng() * 6, s: 0.6 + rng() * 0.9, o: rng() * 30 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb04a, size: 0.35, transparent: true, opacity: 0.85, depthWrite: false }));
  sparks.frustumCulled = false;
  group.add(sparks);
  return {
    object: group,
    update: (_dt, t) => {
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        const k = ((t * s.s + s.o) % 30) / 30; // 0 to 1 as it rises
        pos[i * 3] = cx + Math.cos(s.a + k * 2) * (s.r + k * 8);
        pos[i * 3 + 1] = roofTop + 9 + k * 26;
        pos[i * 3 + 2] = cz + Math.sin(s.a + k * 2) * (s.r + k * 8);
      }
      geo.attributes.position.needsUpdate = true;
      flame.scale.setScalar(1 + Math.sin(t * 6) * 0.12);
      flame.rotation.y = t;
    },
    dispose: () => { group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); stone.dispose(); gold.dispose(); flameMat.dispose(); },
  };
}

/** Grassy land all round the city (it sits on an island of its own on the map). */
export function cityLand(x0: number, z0: number, w: number, d: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 900, d + 900), new THREE.MeshStandardMaterial({ color: 0x6f9e45, roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x0 + w / 2, -0.3, z0 + d / 2);
  m.receiveShadow = true;
  return m;
}

/** Rampart, tower and gate blocks for one tile (merged by the terrain's chunk builder). */
export function rampartBlock(kind: "rampart" | "tower" | "citygate" | "gateway", x: number, y: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const h = kind === "tower" ? 7.4 : 4.8;
  const stoneCol = mix(0x9a917f, 0xb3a994, hash2(x, y, 51));
  const cx = (x + 0.5) * TILE, cz = (y + 0.5) * TILE;
  if (kind === "gateway") {
    // An open gate (version 0.20): the wall's top as a lintel high over the road, with the great doors swung open.
    out.push(box(TILE, 1.2, TILE, cx, h - 0.6, cz, stoneCol));
    out.push(box(TILE, 0.25, TILE, cx, h - 1.3, cz, mix(stoneCol, 0x4a4238, 0.35)));
  } else if (kind === "citygate") {
    // A closed gate: the wall's top as a lintel over two great wooden doors.
    out.push(box(TILE, 1.4, TILE, cx, h - 0.7, cz, stoneCol));
    out.push(box(TILE, h - 1.4, TILE * 0.4, cx, (h - 1.4) / 2, cz, mix(0x5a3a22, 0x6e4a2c, hash2(x, y, 52))));
    out.push(box(TILE * 0.98, 0.14, TILE * 0.46, cx, 1.0, cz, 0x2e2a28));
    out.push(box(TILE * 0.98, 0.14, TILE * 0.46, cx, 2.4, cz, 0x2e2a28));
  } else {
    out.push(box(TILE, h, TILE, cx, h / 2, cz, stoneCol));
  }
  // Battlements: a merlon on every other tile.
  if ((x + y) % 2 === 0) out.push(box(TILE * 0.6, 0.9, TILE * 0.6, cx, h + 0.45, cz, mix(stoneCol, 0x6a6252, 0.2)));
  return out;
}
export const RAMPART_H = { rampart: 4.8, tower: 7.4, citygate: 4.8, gateway: 4.8 } as const;

/**
 * Ember Hill's retaining wall, one tile (version 0.22): rough stone up to the terrace, a coping, and
 * battlements on top. Beside the stairway the wall is lower, white, and carries the lanterns.
 */
export function terraceBlock(x: number, y: number, top: number, stairSide: boolean): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const cx = (x + 0.5) * TILE, cz = (y + 0.5) * TILE;
  if (stairSide) {
    out.push(box(TILE, top - 0.15, TILE, cx, (top - 0.15) / 2, cz, mix(0xd9d2c4, 0xe6e0d4, hash2(x, y, 71))));
    out.push(box(TILE + 0.1, 0.15, TILE + 0.1, cx, top - 0.075, cz, 0xf4f0e8));
    return out;
  }
  const ground = top - 0.7;
  const low = ground * 0.55;
  out.push(box(TILE, low, TILE, cx, low / 2, cz, mix(0x8a8072, 0x7a7266, hash2(x, y, 72))));
  out.push(box(TILE, ground - low, TILE, cx, low + (ground - low) / 2, cz, mix(0xc9bfac, 0xd6cdbb, hash2(x, y, 73))));
  out.push(box(TILE + 0.12, 0.16, TILE + 0.12, cx, ground + 0.08, cz, 0xe8e2d6));
  // The parapet, with a merlon on every other tile.
  out.push(box(TILE * 0.7, 0.45, TILE * 0.7, cx, ground + 0.38, cz, mix(0xd3cab8, 0xe2dacb, hash2(x, y, 74))));
  if ((x + y) % 2 === 0) out.push(box(TILE * 0.7, 0.5, TILE * 0.7, cx, ground + 0.85, cz, mix(0xd3cab8, 0xe2dacb, hash2(x, y, 75))));
  return out;
}

/**
 * The Emberhall as a castle (version 0.22, Mike's note): round towers at the four corners with gold
 * caps, two gate towers either side of the great doors, and battlements along the walls. One mesh.
 */
export function emberhallCastle(b: CityBuilding, wallTop: number): CityPiece {
  const parts: THREE.BufferGeometry[] = [];
  const x0 = b.x * TILE, x1 = (b.x + b.w) * TILE, z0 = b.y * TILE, z1 = (b.y + b.h - 0.5) * TILE;
  const marble = 0xf2efe8, trim = 0xd9d2c4, gold = 0xd9b44a;
  const cyl = (r: number, h: number, x: number, y: number, z: number, color: number, seg = 14) => {
    const g = new THREE.CylinderGeometry(r, r, h, seg).toNonIndexed();
    g.deleteAttribute("uv");
    g.translate(x, y, z);
    return painted(g, color);
  };
  const cone = (r: number, h: number, x: number, y: number, z: number, color: number, seg = 14) => {
    const g = new THREE.ConeGeometry(r, h, seg).toNonIndexed();
    g.deleteAttribute("uv");
    g.translate(x, y, z);
    return painted(g, color);
  };
  // Corner towers.
  const TH = wallTop + 5, R = 1.9;
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    parts.push(cyl(R, TH, x, TH / 2, z, marble));
    parts.push(cyl(R + 0.2, 0.5, x, 0.25, z, trim));
    parts.push(cyl(R + 0.25, 0.3, x, TH - 0.15, z, trim));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      parts.push(box(0.6, 0.7, 0.45, x + Math.cos(a) * (R - 0.1), TH + 0.35, z + Math.sin(a) * (R - 0.1), marble));
    }
    parts.push(cone(R + 0.1, 3.4, x, TH + 2.4, z, gold));
    // Arrow slits.
    for (let f = 1; f <= 3; f++) for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const sx = x + Math.cos(a) * (R + 0.02), sz = z + Math.sin(a) * (R + 0.02);
      const slit = new THREE.BoxGeometry(0.18, 0.9, 0.05).toNonIndexed();
      slit.deleteAttribute("uv");
      slit.rotateY(-a + Math.PI / 2);
      slit.translate(sx, f * (TH / 4.2), sz);
      parts.push(painted(slit, 0x2a2420));
    }
  }
  // Battlements along the tops of the walls (just outside them, under the roof's eaves).
  const merlons = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 1.4);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (i % 2 === 0) parts.push(box(0.7, 0.8, 0.7, x, wallTop + 0.4, z, marble));
    }
  };
  const o = 0.35;
  parts.push(box(x1 - x0 + 0.9, 0.3, 0.9, (x0 + x1) / 2, wallTop - 0.15, z1 + o, trim));
  parts.push(box(x1 - x0 + 0.9, 0.3, 0.9, (x0 + x1) / 2, wallTop - 0.15, z0 - o, trim));
  parts.push(box(0.9, 0.3, z1 - z0 + 0.9, x0 - o, wallTop - 0.15, (z0 + z1) / 2, trim));
  parts.push(box(0.9, 0.3, z1 - z0 + 0.9, x1 + o, wallTop - 0.15, (z0 + z1) / 2, trim));
  merlons(x0 + R, z1 + o, x1 - R, z1 + o);
  merlons(x0 + R, z0 - o, x1 - R, z0 - o);
  merlons(x0 - o, z0 + R, x0 - o, z1 - R);
  merlons(x1 + o, z0 + R, x1 + o, z1 - R);
  // Gate towers either side of the great doors (square, a little taller than the walls).
  const doorX = (b.x + Math.floor(b.w / 2) + 0.5) * TILE;
  const GH = wallTop + 2.2;
  for (const sx of [-1, 1]) {
    const gx = doorX + sx * 3.1;
    parts.push(box(2.2, GH, 2.0, gx, GH / 2, z1 + 0.6, marble));
    parts.push(box(2.5, 0.3, 2.3, gx, GH - 0.15, z1 + 0.6, trim));
    for (const [dx, dz] of [[-0.8, -0.7], [0.8, -0.7], [-0.8, 0.7], [0.8, 0.7]]) parts.push(box(0.55, 0.7, 0.55, gx + dx, GH + 0.35, z1 + 0.6 + dz, marble));
    parts.push(box(0.2, 1.0, 0.05, gx, GH - 2.2, z1 + 1.62, 0x2a2420));
    // Gold banner of the Emberguard hanging on the gate tower.
    parts.push(box(1.0, 2.4, 0.05, gx, wallTop - 2.6, z1 + 1.64, 0xb8342a));
    parts.push(box(1.05, 0.12, 0.08, gx, wallTop - 1.35, z1 + 1.66, gold));
    parts.push(box(0.35, 0.35, 0.06, gx, wallTop - 2.4, z1 + 1.68, gold));
  }
  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(gpuOnly(geo!), vcol);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return { object: group, update: () => {}, dispose: () => mesh.geometry.dispose() };
}

/**
 * The Emberhall's great double doors (version 0.22, Mike's note): tall, arched, oak with gold bands
 * and studs, in a carved stone arch. They swing open as someone walks up. Front faces +z.
 */
export function grandDoors(walkers: THREE.Vector3[]): CityPiece {
  const group = new THREE.Group();
  const W = 3.4, H = 4.4;
  const stone = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.75 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6e4424, roughness: 0.8 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd9b44a, roughness: 0.35, metalness: 0.6 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x140e08 });
  const geos: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number) => {
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  // The dark hall behind, seen when the doors open.
  add(new THREE.PlaneGeometry(W, H + W / 2 - 0.2), dark, group, 0, (H + W / 2 - 0.2) / 2, -0.02);
  // The stone surround: pillars and a round arch.
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.55, H, 0.6), stone, group, sx * (W / 2 + 0.27), H / 2, 0.1);
  const arch = new THREE.TorusGeometry(W / 2 + 0.27, 0.3, 6, 16, Math.PI);
  add(arch, stone, group, 0, H, 0.1);
  add(new THREE.BoxGeometry(0.5, 0.6, 0.4, 1, 1, 1), goldM, group, 0, H + W / 2 + 0.2, 0.25); // the keystone
  add(new THREE.BoxGeometry(W + 1.6, 0.25, 1.2), stone, group, 0, 0.12, 0.5); // the threshold step
  // Two leaves, hinged at the sides; each has an arched top half.
  const leaves: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(sx * W / 2, 0, 0.05);
    const lw = W / 2 - 0.02;
    const cx = -sx * lw / 2;
    add(new THREE.BoxGeometry(lw, H, 0.14), wood, hinge, cx, H / 2, 0);
    // The arched top: a quarter disc over each leaf.
    const top = new THREE.CircleGeometry(W / 2, 10, sx < 0 ? 0 : Math.PI / 2, Math.PI / 2);
    add(top, wood, hinge, -sx * W / 2, H, 0.071);
    for (const y of [0.5, H * 0.5, H - 0.4]) add(new THREE.BoxGeometry(lw - 0.08, 0.14, 0.04), goldM, hinge, cx, y, 0.09);
    for (const y of [0.5, H * 0.5, H - 0.4]) for (let k = 0; k < 4; k++) add(new THREE.SphereGeometry(0.05, 5, 4), goldM, hinge, cx - lw / 2 + 0.2 + k * (lw - 0.4) / 3, y + 0.16, 0.1);
    add(new THREE.TorusGeometry(0.16, 0.035, 5, 10), goldM, hinge, -sx * (lw - 0.25), H * 0.45, 0.12); // a ring handle
    group.add(hinge);
    leaves.push(hinge);
  }
  let open = 0;
  const here = new THREE.Vector3();
  return {
    object: group,
    update: (dt) => {
      group.getWorldPosition(here);
      const near = walkers.some((w) => Math.hypot(w.x - here.x, w.z - here.z) < 4);
      open += ((near ? 1 : 0) - open) * Math.min(1, dt * 3);
      leaves[0].rotation.y = open * 1.3;
      leaves[1].rotation.y = -open * 1.3;
    },
    dispose: () => { geos.forEach((g) => g.dispose()); [stone, wood, goldM, dark].forEach((m) => m.dispose()); },
  };
}
