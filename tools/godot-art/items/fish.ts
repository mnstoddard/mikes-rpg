// Every fish in the game, as caught (upright, nose to +X, real size).
import * as THREE from "three";
import { ItemDef, at, group, lathe, mat, plain, sphere, paint, paintedMat, slab, rng, tube, cone } from "./kit";

interface FishLook {
  len: number; depth: number; thick?: number;
  back: string; side: string; belly: string; stripe?: string | null; spots?: string | null; bars?: string | null;
  fin: number; tail?: "fork" | "round" | "moon"; dorsal?: "small" | "sail" | "long"; bill?: boolean;
}

/** Markings painted round the body: u = round the body (0 = side, 0.25 = back, 0.75 = belly), v = nose to tail. */
function fishTex(key: string, f: FishLook) {
  return paint("fish_" + key, 256, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, f.side); g.addColorStop(0.25, f.back); g.addColorStop(0.5, f.side); g.addColorStop(0.62, f.belly);
    g.addColorStop(0.88, f.belly); g.addColorStop(1, f.side);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (f.stripe) {
      c.fillStyle = f.stripe; c.globalAlpha = 0.75;
      for (const u0 of [-0.035, 0.465, 0.965]) c.fillRect(u0 * w, h * 0.12, w * 0.07, h * 0.78);
      c.globalAlpha = 1;
    }
    if (f.bars) {
      // dark vertical bands over the back and sides
      c.fillStyle = f.bars; c.globalAlpha = 0.55;
      for (let i = 0; i < 6; i++) { const v = 0.2 + i * 0.11; c.fillRect(0, v * h, w * 0.56, h * 0.045); c.fillRect(w * 0.94, v * h, w * 0.06, h * 0.045); }
      c.globalAlpha = 1;
    }
    if (f.spots) {
      const r = rng(key.length * 13);
      c.fillStyle = f.spots;
      for (let i = 0; i < 140; i++) {
        const u = r(), v = 0.1 + r() * 0.85;
        if (Math.abs(u - 0.25) > 0.24) continue;
        c.beginPath(); c.ellipse(u * w, v * h, 1.4 + r() * 1.8, 1.2 + r() * 1.4, 0, 0, Math.PI * 2); c.fill();
      }
    }
  });
}

export function fish(key: string, f: FishLook) {
  const L = f.len, D = f.depth;
  const prof: [number, number][] = [[0, 0], [0.45, 0.02], [0.82, 0.08], [1, 0.25], [0.86, 0.55], [0.48, 0.82], [0.24, 0.95], [0.18, 1]];
  const body = lathe(prof.map(([r, y]) => [r * D * L, y * L]), paintedMat("fish_skin", fishTex(key, f), { rough: 0.3 }), 20);
  body.scale.set(1, 1, f.thick ?? 0.5);
  const finM = mat("fin", f.fin, { rough: 0.45, opacity: 0.9 });
  const H = D * L; // half height of the body
  const T = H * (f.thick ?? 0.5); // half thickness
  const tail = f.tail ?? "fork";
  const tailPts: [number, number][] = tail === "fork" ? [[0, 0], [L * 0.2, H * 1.0], [L * 0.15, 0], [L * 0.2, -H * 1.0]]
    : tail === "moon" ? [[0, 0], [L * 0.12, H * 1.6], [L * 0.07, H * 0.4], [L * 0.05, 0], [L * 0.07, -H * 0.4], [L * 0.12, -H * 1.6]]
    : [[0, -H * 0.2], [L * 0.1, -H * 0.8], [L * 0.17, -H * 0.4], [L * 0.17, H * 0.4], [L * 0.1, H * 0.8], [0, H * 0.2]];
  const dorsal = f.dorsal ?? "small";
  const dPts: [number, number][] = dorsal === "sail" ? [[0, 0], [L * 0.42, 0], [L * 0.32, H * 0.9], [L * 0.08, H * 1.15]]
    : dorsal === "long" ? [[0, 0], [L * 0.55, 0], [L * 0.5, H * 0.35], [L * 0.05, H * 0.45]]
    : [[0, 0], [L * 0.18, 0], [L * 0.04, H * 0.75]];
  const eyeW = plain("eye_white", 0xf2f0ea, 0.2), eyeB = plain("eye", 0x2a2420, 0.1);
  const g = group("fish",
    at(body, [0, 0, 0], [0, 0, 90]),
    at(slab(tailPts, Math.max(0.004, L * 0.015), finM, Math.max(0.0015, L * 0.006)), [-L * 0.97, 0, 0], [0, 180, 0]),
    at(slab(dPts, Math.max(0.004, L * 0.014), finM, Math.max(0.0015, L * 0.005)), [-L * (dorsal === "long" ? 0.75 : 0.5), H * 0.85, 0]),
    at(slab([[0, 0], [L * 0.12, 0], [L * 0.03, -H * 0.45]], Math.max(0.004, L * 0.012), finM, Math.max(0.0015, L * 0.005)), [-L * 0.68, -H * 0.7, 0]),
  );
  for (const s of [1, -1]) {
    g.add(at(slab([[0, 0], [L * 0.1, H * 0.15], [L * 0.11, -H * 0.25]], Math.max(0.003, L * 0.01), finM, Math.max(0.001, L * 0.004)), [-L * 0.2, -H * 0.3, s * T * 0.85], [0, s * 30, -20]));
    g.add(at(sphere(H * 0.2, eyeW, 10, 8), [-L * 0.09, H * 0.2, s * T * 0.62]));
    g.add(at(sphere(H * 0.12, eyeB, 8, 6), [-L * 0.09, H * 0.21, s * T * 0.8]));
  }
  if (f.bill) g.add(at(cone(H * 0.18, L * 0.35, mat("bill", 0x3a4a5c, { rough: 0.4 }), 10), [L * 0.16, H * 0.05, 0], [0, 0, -90]));
  return group(key, at(g, [L * 0.5, H * 1.05, 0]));
}

/** The eel: a long, round body that tapers to a fin, lying in an S curve. */
export function eel() {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([0.35 - t * 0.7, 0.03, Math.sin(t * Math.PI * 2) * 0.09]); }
  const skin = paintedMat("fish_skin", paint("fish_eel", 64, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#3e4e2c"); g.addColorStop(0.45, "#55663a"); g.addColorStop(0.7, "#c9b868"); g.addColorStop(0.85, "#55663a"); g.addColorStop(1, "#3e4e2c");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }), { rough: 0.25 });
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 64, 0.022, 10, false);
  // taper toward the tail
  const p = geo.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const seg = Math.floor(i / 11) / 64;
    curve.getPointAt(Math.min(1, seg), c);
    const k = seg < 0.08 ? 0.6 + seg * 5 : 1 - Math.max(0, seg - 0.5) * 1.7;
    p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k * 1.15, c.z + (p.getZ(i) - c.z) * k);
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, skin);
  const g = group("eel", body);
  // head end: eyes and a fin ridge along the back half
  g.add(at(sphere(0.006, plain("eye", 0x2a2420, 0.1), 8, 6), [0.345, 0.04, 0.012]));
  g.add(at(sphere(0.006, plain("eye", 0x2a2420, 0.1), 8, 6), [0.345, 0.04, -0.012]));
  g.add(tube(pts.slice(6).map(([x, y, z]) => [x, y + 0.018, z] as [number, number, number]), 0.004, mat("fin", 0x6a7a44, { rough: 0.45 }), 30, 5));
  return g;
}

const F = (id: string, name: string, about: string, f: FishLook): ItemDef => ({ id, name, cat: "Fish", game: [id], about, build: () => fish(id, f) });

export const FISH_DEFS: ItemDef[] = [
  F("minnow", "Minnow", "A tiny silver fish with a dark side line. The first catch.", { len: 0.09, depth: 0.12, back: "#6f8a86", side: "#c9d6d2", belly: "#f1f2ea", stripe: "#3c4a48", fin: 0xb8c4c0 }),
  F("trout", "Trout", "Olive back, a pink stripe and dark spots.", { len: 0.32, depth: 0.13, back: "#5d7a4a", side: "#b9c49a", belly: "#f1ead8", stripe: "#e98a8a", spots: "#3d4a30", fin: 0x9aa070 }),
  F("perch", "Perch", "Deep-bodied, golden green with dark bars and orange fins.", { len: 0.26, depth: 0.17, back: "#5f7a2e", side: "#c8c25a", belly: "#f2ecc8", bars: "#3a4a1c", fin: 0xf08a3a, dorsal: "sail" }),
  F("salmon", "Salmon", "Silver sides, a blue-grey back and a few dark spots.", { len: 0.62, depth: 0.14, back: "#4a6a86", side: "#d4dde4", belly: "#f6f2ee", spots: "#2e3e4e", fin: 0x8a9aa8 }),
  F("pike", "Pike", "Long and lean, green with pale spots, its fins set far back.", { len: 0.8, depth: 0.09, back: "#3e5a2a", side: "#86a050", belly: "#efe8c6", spots: "#d8e0a0", fin: 0x8a9a50, dorsal: "small", tail: "round" }),
  F("tuna", "Tuna", "A big, round, fast fish: dark blue back, silver belly, yellow finlets.", { len: 1.6, depth: 0.15, thick: 0.75, back: "#23406e", side: "#7d93ad", belly: "#eef2f4", fin: 0xf2c14e, tail: "moon" }),
  F("swordfish", "Swordfish", "A long bill, a tall sail fin and a crescent tail.", { len: 1.9, depth: 0.1, thick: 0.6, back: "#2e3f5e", side: "#8696ae", belly: "#e8ecf0", fin: 0x3a4a6a, tail: "moon", dorsal: "sail", bill: true }),
  { id: "eel", name: "Eel", cat: "Fish", game: ["eel"], about: "A long olive eel curled in an S, with a fin ridge down its back.", build: eel },
];
