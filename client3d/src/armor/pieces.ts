// The armor shapes. Every piece is built to fit the character wearing it
// (from character.fit) and is hung on the character's joints, so it moves
// with the body: a helmet on the skull, a platebody on the spine and arms,
// platelegs on the hips and legs, boots on the shins and feet, a shield on the
// left forearm, a cloak on the back, gauntlets on the hands.
import * as THREE from "three";
import type { Character } from "../character";
import { shapes } from "../character";
import { ArmorLook } from "./looks";

const { ball, limbGeo, ringsGeo, shellGeo, headPoint, dirN, lerp, sm, V3, YV } = shapes;
type Ring = shapes.Ring;

export type PieceKind = "helmet" | "platebody" | "platelegs" | "boots" | "shield" | "cloak" | "gauntlets";

/** Style choices for each piece, by kind of material. */
export const PIECE_VARIANTS: Record<PieceKind, Record<ArmorLook["kind"], readonly string[]>> = {
  helmet: { metal: ["Open helm", "Full helm", "Crested"], leather: ["Cap", "Hood"], cloth: ["Pointed hood", "Cowl"] },
  platebody: { metal: ["Breastplate", "Heavy", "Ridged"], leather: ["Laced", "Studded"], cloth: ["Robe", "Mantle"] },
  platelegs: { metal: ["Plated", "Tassets"], leather: ["Plain", "Buckled"], cloth: ["Long", "Knee length"] },
  boots: { metal: ["Sabatons", "Tall greaves"], leather: ["Short", "Fur-topped"], cloth: ["Slippers", "Curled toes"] },
  shield: { metal: ["Round", "Kite", "Tower"], leather: ["Round", "Fur-rimmed"], cloth: ["Round"] },
  cloak: { metal: ["Long", "Short"], leather: ["Long", "Short"], cloth: ["Long", "Short"] },
  gauntlets: { metal: ["Plate", "Spiked"], leather: ["Plain"], cloth: ["Plain"] },
};

/** The materials one piece uses. Made per piece so each can be removed cleanly. */
interface Mats { main: THREE.MeshStandardMaterial; trim: THREE.MeshStandardMaterial; accent: THREE.MeshStandardMaterial; lining: THREE.MeshStandardMaterial }

function makeMats(look: ArmorLook): Mats {
  const metal = look.kind === "metal";
  const m = (color: string, o: { metal?: number; rough?: number; glow?: string; glowK?: number; side?: THREE.Side } = {}) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: o.metal ?? 0,
      roughness: o.rough ?? 0.8,
      emissive: new THREE.Color(o.glow ?? "#000000"),
      emissiveIntensity: o.glowK ?? 0,
      side: o.side ?? THREE.DoubleSide,
    });
  return {
    main: m(look.main, { metal: look.metalness, rough: look.roughness, glow: look.glow, glowK: look.glowStrength }),
    trim: m(look.trim, { metal: metal ? look.metalness : 0, rough: metal ? look.roughness + 0.05 : 0.7, glow: look.trimGlow ? look.trim : look.glow, glowK: look.trimGlow ?? look.glowStrength ?? 0 }),
    accent: m(look.accent, metal ? { rough: 0.85 } : { metal: 0.6, rough: 0.35 }),
    lining: m(look.lining, { rough: 0.95 }),
  };
}

/** What building a piece needs. */
interface Ctx {
  c: Character;
  look: ArmorLook;
  v: number;
  mats: Mats;
  parts: THREE.Object3D[];
  geos: THREE.BufferGeometry[];
  add: (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x?: number, y?: number, z?: number) => THREE.Mesh;
}

// ---------- Helpers ----------

/** Thickness for a head shell: g > 0 inside the covered area, X = how far it stands off the head. */
const edge = (g: number, X: number) => (g >= -0.03 ? X * sm(-0.03, 0.06, g) - 0.01 : (g + 0.03) * 1.5 - 0.01);

/** The torso's rings (from the character), grown by k and pad, from just below the waist up to the neck. */
function torsoRings(ctx: Ctx, k: number, pad: number, topK = 0.97): Ring[] {
  const F = ctx.c.fit, T = F.T;
  const e = (r: number) => r * k + pad;
  return [
    { y: -0.075, rx: e(F.hipW * 0.98), rz: e(F.hipD * 0.98) },
    { y: 0, rx: e(F.midW), rz: e(F.midD) },
    { y: T * 0.3, rx: e(F.waW), rz: e(F.waD) },
    { y: T * 0.62, rx: e(F.shW * 0.84), rz: e(F.chD), bf: F.bust * k },
    { y: T * 0.84, rx: e(F.shW * 0.95), rz: e(F.chD * 0.92) },
    { y: T * topK, rx: e(F.shW * 0.56), rz: e(F.chD * 0.68) },
  ];
}
/** How far forward the front of a ring body is at height y (for laces, ridges and rivets). */
function frontZ(rings: Ring[], y: number) {
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y || 1);
      return lerp(a.rz + (a.bf ?? 0), b.rz + (b.bf ?? 0), t);
    }
  }
  return rings[rings.length - 1].rz;
}
function ringAt(rings: Ring[], y: number): Ring {
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y || 1);
      return { y, rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t) };
    }
  }
  return rings[rings.length - 1];
}
/** A flat band (belt, rim) around a ring body at height y. */
function band(ctx: Ctx, parent: THREE.Object3D, r: Ring, h: number, mat: THREE.Material, grow = 1.04) {
  return ctx.add(parent, ringsGeo([{ y: r.y - h / 2, rx: r.rx * grow, rz: r.rz * grow }, { y: r.y + h / 2, rx: r.rx * grow, rz: r.rz * grow }], 32), mat);
}
/** A dome (half sphere, open at the bottom). */
const dome = (r: number, frac = 0.5) => new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI * frac);

// ---------- Helmets ----------

function buildHelmet(ctx: Ctx) {
  const { c, look, v, mats } = ctx;
  const F = c.fit, H = F.H, R = F.R, skull = c.joints.skull;
  const shell = (fn: (d: THREE.Vector3, off: THREE.Vector3) => number, mat = mats.main) => ctx.add(skull, shellGeo(H, 72, 54, fn), mat);

  if (look.kind === "metal") {
    const full = v === 1;
    const X = full ? 0.16 : 0.13;
    // Below the middle of the head the helmet comes straight down, like a
    // bucket, instead of curving in under the jaw and chin.
    const p = new V3(), p0 = new V3();
    const straight = (d: THREE.Vector3, off: THREE.Vector3, t: number) => {
      if (t <= 0 || d.y >= 0) return t;
      headPoint(d, H, p);
      headPoint(dirN(d.x, 0, d.z), H, p0);
      const k = 1 + X;
      off.x += p0.x * k - p.x * (1 + t);
      off.z += p0.z * k - p.z * (1 + t);
      return t;
    };
    shell((d, off) => {
      if (full) {
        // Covers the whole head and face, with an eye slit.
        if (d.z > 0.45 && Math.abs(d.y - 0.12) < 0.075 && Math.abs(d.x) < 0.62) return -1;
        return straight(d, off, edge(d.y + 0.72, X));
      }
      // Open at the face, with cheek guards at the sides and a neck guard at the back.
      const front = d.z > 0 ? lerp(-0.08, 0.36, sm(0, 0.8, d.z)) : lerp(-0.08, -0.6, sm(0, 0.8, -d.z));
      const cheek = sm(0.48, 0.66, Math.abs(d.x)) * (d.z < 0.62 ? 1 : 0);
      return straight(d, off, edge(d.y - lerp(front, -0.6, cheek * (v === 0 ? 1 : 0.5)), X));
    });
    // A ridge over the top, front to back.
    const rg = new THREE.TorusGeometry(H.ry * (1 + X) * 1.01, R * 0.045, 8, 40, Math.PI * 0.7);
    rg.rotateZ(Math.PI * 0.08);
    rg.rotateY(Math.PI / 2);
    rg.scale(1, 1, (H.rz / H.ry) * 1.02);
    ctx.add(skull, rg, mats.trim);
    // A rim round the bottom edge.
    if (!full) {
      const p = headPoint(dirN(0, 0.3, 1), H, new V3()).multiplyScalar(1 + X);
      const nasal = ctx.add(skull, new THREE.BoxGeometry(R * 0.09, R * 0.5, R * 0.05), mats.trim, 0, p.y - R * 0.2, p.z - R * 0.01);
      nasal.rotation.x = -0.18;
    } else {
      // Breathing holes: a few dark dots on the right cheek.
      for (let i = 0; i < 6; i++) {
        const p = headPoint(dirN(-0.42 - (i % 2) * 0.1, -0.22 - Math.floor(i / 2) * 0.12, 0.85), H, new V3()).multiplyScalar(1 + X + 0.005);
        ctx.add(skull, ball(R * 0.025, 6, 4), mats.lining, p.x, p.y, p.z);
      }
    }
    if (v === 2) {
      // A crest of plume along the top.
      const fin = ctx.add(skull, new THREE.CylinderGeometry(R * 0.95, R * 0.95, R * 0.12, 28, 1, false, 0, Math.PI), mats.accent, 0, H.ry * 0.78, -R * 0.12);
      fin.rotation.z = Math.PI / 2;
      fin.scale.set(1, 1, 1.15);
    }
    if (look.glow) {
      // A gem on the brow for the magic metals.
      const p = headPoint(dirN(0, 0.55, 1), H, new V3()).multiplyScalar(1 + X + 0.01);
      ctx.add(skull, new THREE.OctahedronGeometry(R * 0.09, 0), mats.accent, p.x, p.y, p.z).scale.set(1, 1.3, 0.6);
    }
    return;
  }
  if (look.kind === "leather") {
    if (v === 0) {
      shell((d) => edge(d.y - (d.z > 0 ? lerp(0.05, 0.4, sm(0, 0.8, d.z)) : lerp(0.05, -0.3, sm(0, 0.8, -d.z))), 0.08));
      const seam = ctx.add(skull, new THREE.TorusGeometry(H.ry * 1.075, R * 0.018, 6, 40, Math.PI * 0.9), mats.trim);
      seam.rotation.set(0, Math.PI / 2, 0.05 * Math.PI);
      seam.scale.set(1, 1, H.rz / H.ry);
    } else {
      shell((d) => {
        if (d.z > 0.4 && d.y < 0.38 && d.y > -0.62 && Math.abs(d.x) < 0.75) return -1;
        return edge(d.y + 0.85, 0.11);
      });
      ctx.add(c.joints.spine, ringsGeo([{ y: F.T * 0.88, rx: F.shW * 0.72, rz: F.chD * 1.05 }, { y: F.T * 1.02, rx: F.neckR * 2.3, rz: F.neckR * 2.2 }, { y: F.T * 1.08, rx: F.neckR * 1.9, rz: F.neckR * 1.8 }], 32), mats.lining);
    }
    return;
  }
  // Cloth hoods.
  shell((d) => {
    if (d.z > 0.42 && d.y < 0.42 && d.y > -0.66 && Math.abs(d.x) < 0.78) return -1;
    return edge(d.y + 0.9, 0.15);
  });
  ctx.add(c.joints.spine, ringsGeo([{ y: F.T * 0.82, rx: F.shW * 0.82, rz: F.chD * 1.12 }, { y: F.T * 0.98, rx: F.neckR * 2.6, rz: F.neckR * 2.5 }, { y: F.T * 1.06, rx: F.neckR * 2.1, rz: F.neckR * 2.0 }], 32), mats.main);
  if (v === 0) {
    const dir = dirN(0, 0.25, -1);
    const p = headPoint(dirN(0, 0.55, -0.8), H, new V3()).multiplyScalar(1.08);
    const cone = ctx.add(skull, new THREE.ConeGeometry(R * 0.38, R * 1.25, 20), mats.main, 0, 0, 0);
    cone.quaternion.setFromUnitVectors(YV, dir);
    cone.position.copy(p).addScaledVector(dir, R * 0.45);
  }
}

// ---------- Platebodies, jerkins and robe tops ----------

function buildBody(ctx: Ctx) {
  const { c, look, v, mats } = ctx;
  const F = c.fit, J = c.joints, T = F.T;
  const metal = look.kind === "metal", cloth = look.kind === "cloth";
  const rings = torsoRings(ctx, metal ? 1.1 : 1.05, metal ? 0.014 : 0.008);
  ctx.add(J.spine, ringsGeo(rings, 36), mats.main);
  // Bands at the neck and the bottom edge.
  band(ctx, J.spine, ringAt(rings, T * 0.95), 0.02, mats.trim, 1.02);
  band(ctx, J.spine, { y: -0.055, rx: rings[0].rx, rz: rings[0].rz }, 0.035, mats.trim, 1.03);

  for (const s of [1, -1]) {
    const sh = s > 0 ? J.shL : J.shR, el = s > 0 ? J.elL : J.elR;
    if (metal) {
      // Pauldrons: stacked domes over the shoulder.
      const big = v === 1 ? 1.35 : v === 2 ? 0.95 : 1.12;
      for (let i = 0; i < (v === 1 ? 3 : 2); i++) {
        const r = F.upR * 2.0 * big * (1 - i * 0.1);
        const d = ctx.add(sh, dome(r, 0.5), i === 0 ? mats.main : mats.trim, s * F.upR * 0.25, F.upR * 0.55 - i * r * 0.32, 0);
        d.scale.set(1.05, 0.75, 1.0);
        d.rotation.z = -s * 0.42;
      }
      // The arm is covered all the way: rerebrace (upper arm) from under the
      // pauldron to the elbow, a round couter over the elbow, and a vambrace
      // from the elbow to the wrist, so there are no gaps when the arm bends.
      const upR = F.upR * (v === 1 ? 1.3 : 1.22);
      ctx.add(sh, limbGeo(upR, F.upR * 1.12, F.upLen * 0.98), mats.main, 0, -F.upLen * 0.02, 0);
      const couter = ctx.add(el, ball(Math.max(F.upR * 1.2, F.foR * 1.45), 20, 14), mats.trim, 0, 0, 0);
      couter.scale.set(1, 1, 1.05);
      const wing = ctx.add(el, ball(F.upR * 0.75, 14, 10), mats.trim, s * F.upR * 0.5, 0, -F.upR * 0.55);
      wing.scale.set(0.5, 1, 1);
      ctx.add(el, limbGeo(F.foR * 1.36, F.foR * 1.14, F.foLen * 0.92), mats.main, 0, -F.foLen * 0.02, 0);
      ctx.add(el, new THREE.TorusGeometry(F.foR * 1.2, F.foR * 0.14, 6, 24), mats.trim, 0, -F.foLen * 0.93, 0).rotation.x = Math.PI / 2;
      ctx.add(sh, new THREE.TorusGeometry(F.upR * 1.14, F.upR * 0.12, 6, 24), mats.trim, 0, -F.upLen * 0.9, 0).rotation.x = Math.PI / 2;
    } else if (cloth) {
      ctx.add(sh, ball(F.upR * 1.4, 16, 12), mats.main);
      ctx.add(sh, limbGeo(F.upR * 1.14, F.upR * 1.12, F.upLen), mats.main);
      ctx.add(el, limbGeo(F.foR * 1.35, F.foR * 2.15, F.foLen * 0.84), mats.main, 0, -F.foLen * 0.08, 0);
      ctx.add(el, new THREE.TorusGeometry(F.foR * 2.1, F.foR * 0.18, 6, 28), mats.trim, 0, -F.foLen * 0.92 - F.foR * 0.4, 0).rotation.x = Math.PI / 2;
    } else {
      // Leather: small shoulder pads.
      const d = ctx.add(sh, dome(F.upR * 1.7, 0.5), v === 1 ? mats.main : mats.trim, s * F.upR * 0.2, F.upR * 0.45, 0);
      d.scale.set(1.05, 0.6, 1.0);
      d.rotation.z = -s * 0.4;
    }
  }

  if (metal) {
    // A collar that closes the gap between the breastplate and the neck.
    if (v !== 1) ctx.add(J.spine, ringsGeo([{ y: T * 0.9, rx: F.shW * 0.66, rz: F.chD * 0.9 }, { y: T * 0.99, rx: F.neckR * 1.75, rz: F.neckR * 1.65 }, { y: T * 1.03, rx: F.neckR * 1.55, rz: F.neckR * 1.45 }], 32), mats.trim);
    if (v === 1) {
      // Gorget at the neck and a fauld (plates over the hips).
      ctx.add(J.spine, ringsGeo([{ y: T * 0.9, rx: F.shW * 0.72, rz: F.chD * 0.95 }, { y: T * 1.02, rx: F.neckR * 2.0, rz: F.neckR * 1.9 }, { y: T * 1.06, rx: F.neckR * 1.8, rz: F.neckR * 1.7 }], 32), mats.trim);
      for (let i = 0; i < 2; i++) {
        const top = -0.07 - i * 0.055, w = F.hipW * (1.18 + i * 0.06);
        const f = ctx.add(J.hips, new THREE.CylinderGeometry(w, w * 1.06, 0.065, 36, 1, true), i ? mats.trim : mats.main, 0, top + 0.12 - 0.03, 0);
        f.scale.z = Math.max(0.8, (F.hipD / F.hipW) * 1.12);
      }
    }
    if (v === 2) {
      // A ridge down the middle, and rivets along the neckline.
      for (let i = 0; i < 9; i++) {
        const y = lerp(T * 0.08, T * 0.86, i / 8);
        ctx.add(J.spine, ball(0.012, 8, 6), mats.trim, 0, y, frontZ(rings, y) - 0.002).scale.set(1, 3.2, 1);
      }
      for (const s of [1, -1])
        for (let i = 0; i < 4; i++) {
          const y = T * (0.72 + i * 0.055), r = ringAt(rings, y), a = 0.35 + i * 0.22;
          ctx.add(J.spine, ball(0.008, 6, 4), mats.trim, s * Math.sin(a) * r.rx, y, Math.cos(a) * r.rz * 1.01);
        }
    }
    if (look.glow) {
      const y = T * 0.62;
      ctx.add(J.spine, new THREE.OctahedronGeometry(0.03, 0), mats.accent, 0, y, frontZ(rings, y) + 0.012).scale.set(1, 1.3, 0.6);
    }
  } else if (cloth) {
    // A sash and a collar.
    band(ctx, J.spine, ringAt(rings, T * 0.06), 0.05, mats.trim, 1.03);
    for (const s of [1, -1]) {
      const y0 = T * 0.96, y1 = T * 0.55;
      const z0 = frontZ(rings, y0), z1 = frontZ(rings, y1);
      const len = Math.hypot(F.shW * 0.3, y0 - y1, z0 - z1);
      const strip = ctx.add(J.spine, new THREE.BoxGeometry(0.03, len, 0.01), mats.trim, s * F.shW * 0.15, (y0 + y1) / 2, (z0 + z1) / 2 + 0.006);
      strip.rotation.z = s * Math.atan2(F.shW * 0.3, y0 - y1);
      strip.rotation.x = -Math.atan2(z0 - z1, y0 - y1) * 0.5;
    }
    if (v === 1) {
      // A short cape over the shoulders.
      const pts = [
        new THREE.Vector2(F.neckR * 2.1, T * 1.0),
        new THREE.Vector2(F.shW * 0.78, T * 0.93),
        new THREE.Vector2(F.shW * 1.12, T * 0.8),
        new THREE.Vector2(F.shW * 1.2, T * 0.6),
      ];
      const m = ctx.add(J.spine, new THREE.LatheGeometry(pts, 40), mats.trim);
      m.scale.z = Math.max(0.75, (F.chD / F.shW) * 1.9);
    }
  } else {
    // Leather: lacing or studs down the front.
    if (v === 0) {
      for (let i = 0; i < 6; i++) {
        const y = lerp(T * 0.12, T * 0.78, i / 5);
        const z = frontZ(rings, y) + 0.002;
        for (const s of [1, -1]) {
          const lace = ctx.add(J.spine, new THREE.BoxGeometry(0.05, 0.007, 0.006), mats.accent, 0, y, z);
          lace.rotation.z = s * 0.55;
        }
      }
    } else {
      for (let row = 0; row < 5; row++)
        for (let col = -2; col <= 2; col++) {
          const y = T * (0.15 + row * 0.13), r = ringAt(rings, y), a = col * 0.32;
          ctx.add(J.spine, ball(0.009, 8, 6), mats.accent, Math.sin(a) * r.rx, y, Math.cos(a) * (frontZ(rings, y)) * 1.0);
        }
    }
    band(ctx, J.spine, ringAt(rings, T * 0.05), 0.035, mats.trim, 1.03);
    ctx.add(J.spine, new THREE.BoxGeometry(0.05, 0.04, 0.012), mats.accent, 0, T * 0.05, frontZ(rings, T * 0.05) * 1.03 + 0.008);
  }
}

// ---------- Platelegs, chaps and robe skirts ----------

function buildLegs(ctx: Ctx) {
  const { c, look, v, mats } = ctx;
  const F = c.fit, J = c.joints;
  const zs = Math.max(0.8, (F.hipD / F.hipW) * 1.12);
  if (look.kind === "cloth") {
    const len = v === 0 ? 0.12 + J.hipsY - 0.09 : 0.12 + F.thighL * 1.05;
    const flare = v === 0 ? 1.95 : 1.55;
    const skirt = ctx.add(J.hips, new THREE.CylinderGeometry(F.hipW * 1.14, F.hipW * flare, len, 44, 3, true), mats.main, 0, 0.12 - len / 2, 0);
    skirt.scale.z = zs;
    const hem = ctx.add(J.hips, new THREE.TorusGeometry(F.hipW * flare, 0.012, 6, 44), mats.trim, 0, 0.12 - len, 0);
    hem.rotation.x = Math.PI / 2;
    hem.scale.y = zs;
    const belt = ctx.add(J.hips, new THREE.CylinderGeometry(F.hipW * 1.16, F.hipW * 1.16, 0.04, 40, 1, true), mats.trim, 0, 0.1, 0);
    belt.scale.z = zs;
    return;
  }
  const metal = look.kind === "metal";
  const k = metal ? 1.2 : 1.1;
  // A belt or hip band.
  const hb = ctx.add(J.hips, ringsGeo([{ y: -0.03, rx: F.hipW * k, rz: F.hipD * k }, { y: 0.12, rx: F.midW * k, rz: F.midD * k }], 36), metal ? mats.main : mats.trim);
  void hb;
  ctx.add(J.hips, new THREE.BoxGeometry(0.05, 0.045, 0.012), metal ? mats.trim : mats.accent, 0, 0.09, F.midD * k + 0.006);
  // Close the gap between the legs at the front.
  const crotch = ctx.add(J.hips, ball(F.hipW * 0.42, 16, 12), mats.main, 0, -0.045, F.hipD * 0.35);
  crotch.scale.set(1, 0.9, 1.1);
  for (const s of [1, -1]) {
    const hip = s > 0 ? J.hipL : J.hipR, knee = s > 0 ? J.kneeL : J.kneeR;
    ctx.add(hip, limbGeo(F.thighR * (metal ? 1.24 : 1.13), F.thighR * (metal ? 1.06 : 1.0), F.thighL * 0.82), mats.main, 0, -F.thighL * 0.06, 0);
    ctx.add(knee, limbGeo(F.shinR * (metal ? 1.42 : 1.2), F.shinR * (metal ? 1.15 : 1.02), F.shinL * (metal ? 0.8 : 0.55)), mats.main, 0, -F.shinL * 0.06, 0);
    if (metal) {
      const kc = ctx.add(knee, ball(F.thighR * 0.92, 16, 12), mats.trim, 0, 0, F.thighR * 0.22);
      kc.scale.set(1, 1.05, 0.85);
      // Little wing on the outside of the knee.
      const wing = ctx.add(knee, ball(F.thighR * 0.55, 12, 8), mats.trim, s * F.thighR * 0.75, 0, F.thighR * 0.1);
      wing.scale.set(0.3, 1, 1);
    } else if (v === 1) {
      for (const y of [-F.thighL * 0.3, -F.thighL * 0.7]) ctx.add(hip, new THREE.TorusGeometry(F.thighR * 1.14, 0.008, 6, 24), mats.trim, 0, y, 0).rotation.x = Math.PI / 2;
      ctx.add(hip, new THREE.BoxGeometry(0.02, 0.02, 0.01), mats.accent, s * 0, -F.thighL * 0.3, F.thighR * 1.15);
      ctx.add(hip, new THREE.BoxGeometry(0.02, 0.02, 0.01), mats.accent, 0, -F.thighL * 0.7, F.thighR * 1.12);
    }
  }
  if (metal && v === 1) {
    // Tassets: plates hanging over the front of the thighs.
    for (const s of [1, -1])
      for (let i = 0; i < 2; i++) {
        const w = F.hipW * (1.28 + i * 0.05), h = F.thighL * 0.24;
        const p = ctx.add(J.hips, new THREE.CylinderGeometry(w, w * 1.1, h, 12, 1, true, s > 0 ? 0.12 : -1.12, 1.0), i ? mats.trim : mats.main, 0, -0.02 - h / 2 - i * h * 0.8, 0);
        p.scale.z = zs * 1.05;
      }
  }
}

// ---------- Boots ----------

function buildBoots(ctx: Ctx) {
  const { c, look, v, mats } = ctx;
  const F = c.fit, J = c.joints;
  const metal = look.kind === "metal", cloth = look.kind === "cloth";
  for (const s of [1, -1]) {
    const knee = s > 0 ? J.kneeL : J.kneeR, ank = s > 0 ? J.ankL : J.ankR;
    if (metal) {
      metalBoot(ctx, s, knee, ank, v === 1);
      continue;
    }
    const g = cloth ? 1.12 : 1.22;
    const foot = ctx.add(ank, ball(0.5, 24, 16), mats.main, 0, -F.footH * (cloth ? 0.38 : 0.3), 0.04);
    foot.scale.set(F.footW * g, F.footH * (cloth ? 1.35 : 1.7), F.footLen * (cloth ? 1.08 : 1.16));
    if (cloth) {
      if (v === 1) {
        const curl = ctx.add(ank, new THREE.TorusGeometry(0.018, 0.008, 6, 16, Math.PI * 1.4), mats.trim, 0, F.footH * 0.05, 0.04 + F.footLen * 0.58);
        curl.rotation.y = Math.PI / 2;
      }
      ctx.add(ank, new THREE.TorusGeometry(F.shinR * 1.05, 0.006, 6, 24), mats.trim, 0, F.footH * 0.35, 0).rotation.x = Math.PI / 2;
      continue;
    }
    const tall = v === 1;
    const len = F.shinL * (tall ? 0.8 : 0.4);
    ctx.add(knee, limbGeo(F.shinR * 1.3, F.shinR * 1.18, len), mats.main, 0, -F.shinL + len, 0);
    const top = -F.shinL + len;
    {
      // Leather: a turned-over cuff, or fur.
      const cuff = ctx.add(knee, new THREE.TorusGeometry(F.shinR * (tall ? 1.4 : 1.3), F.shinR * (tall ? 0.42 : 0.2), 8, 24), tall ? mats.lining : mats.trim, 0, top, 0);
      cuff.rotation.x = Math.PI / 2;
      ctx.add(ank, new THREE.BoxGeometry(F.footW * 1.0, 0.01, F.footLen * 0.5), mats.trim, 0, -F.footH * 0.88, 0.04);
    }
  }
}

/**
 * A metal boot (sabaton): a rounded foot, overlapping plates over the top
 * that get smaller towards a pointed toe cap, a sole, round plates on the
 * ankles, and a shin guard that follows the leg and flares at the top.
 * Tall greaves go up to a knee plate.
 */
function metalBoot(ctx: Ctx, s: number, knee: THREE.Object3D, ank: THREE.Object3D, tall: boolean) {
  const { c, mats } = ctx;
  const F = c.fit;
  const W = F.footW * 1.22, Hh = F.footH * 1.55, L = F.footLen * 1.12;
  const cy = -F.footH * 0.32, cz = 0.04;
  // The foot underneath.
  const foot = ctx.add(ank, ball(0.5, 28, 18), mats.main, 0, cy, cz);
  foot.scale.set(W, Hh, L);
  // A sole, a little wider than the foot.
  const sole = ctx.add(ank, ball(0.5, 24, 10), mats.trim, 0, cy - Hh * 0.36, cz - L * 0.02);
  sole.scale.set(W * 1.04, Hh * 0.28, L * 1.03);
  // Plates over the top of the foot, each band a little bigger than the one in front of it,
  // so they overlap like a lobster's tail. (Spheres turned so their pole points at the toe.)
  const band = (t0: number, t1: number, k: number, mat: THREE.Material) => {
    const g = new THREE.SphereGeometry(0.5, 28, 6, Math.PI, Math.PI, t0, t1 - t0);
    g.rotateX(Math.PI / 2);
    const m = ctx.add(ank, g, mat, 0, cy, cz);
    m.scale.set(W * k, Hh * k, L * k);
    return m;
  };
  band(0, 0.42, 1.05, mats.trim); // toe cap
  band(0.38, 0.7, 1.07, mats.main);
  band(0.66, 0.98, 1.09, mats.main);
  band(0.94, 1.3, 1.11, mats.main);
  // A raised ridge down the middle of the foot, from the ankle to the toe.
  const ridge = new THREE.TorusGeometry(0.5, 0.045, 6, 24, Math.PI * 0.42);
  ridge.rotateZ(Math.PI * 0.08);
  ridge.rotateY(-Math.PI / 2);
  const rm = ctx.add(ank, ridge, mats.trim, 0, cy, cz);
  rm.scale.set(W * 0.4, Hh * 1.1, L * 1.1);
  // Round plates on both sides of the ankle.
  for (const side of [1, -1]) {
    const disc = ctx.add(ank, new THREE.CylinderGeometry(F.shinR * 0.36, F.shinR * 0.36, 0.01, 18), mats.trim, side * F.shinR * 0.95, F.footH * 0.35, -0.008);
    disc.rotation.z = Math.PI / 2;
  }
  // The shin guard, shaped to the leg: narrow at the ankle, wider at the top, then a rolled rim.
  const top = tall ? F.shinL * 0.9 : F.shinL * 0.48;
  // The leg narrows from 1.12 shinR at the knee to 0.75 at the ankle: follow it, just outside.
  const legR = (y: number) => F.shinR * lerp(0.75, 1.12, (y + F.shinL) / F.shinL);
  const at = (f: number, grow = 1.04) => new THREE.Vector2(legR(-F.shinL + top * f) * grow + 0.004, -F.shinL + top * f);
  const pts = [new THREE.Vector2(F.shinR * 0.88, -F.shinL - F.footH * 0.1), at(0.15), at(0.5), at(0.9), at(1, 1.08)];
  const r1 = pts[4].x;
  const shaft = ctx.add(knee, new THREE.LatheGeometry(pts, 32), mats.main);
  shaft.scale.z = 1.06;
  const rimTop = ctx.add(knee, new THREE.TorusGeometry(r1, F.shinR * 0.06, 6, 32), mats.trim, 0, -F.shinL + top, 0);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.scale.y = 1.06;
  if (tall) {
    const kc = ctx.add(knee, ball(F.thighR * 0.8, 16, 12), mats.trim, 0, -F.thighR * 0.1, F.thighR * 0.35);
    kc.scale.set(1.05, 0.95, 0.7);
  }
  void s;
}

// ---------- Shields ----------

function buildShield(ctx: Ctx) {
  const { c, look, v, mats } = ctx;
  const F = c.fit, el = c.joints.elL;
  const S = F.height;
  const g = new THREE.Group();
  // Hung on the outside of the left forearm, turned a little to the front.
  g.position.set(F.foR * 1.7, -F.foLen * 0.5, 0.05);
  g.rotation.set(0, Math.PI / 2 - 0.85, 0);
  el.add(g);
  ctx.parts.push(g);
  const t = 0.028;
  if (look.kind === "leather") {
    const r = 0.19 * S;
    ctx.add(g, new THREE.CylinderGeometry(r, r, t, 32), mats.main).rotation.x = Math.PI / 2;
    ctx.add(g, new THREE.TorusGeometry(r, v === 1 ? 0.03 : 0.012, 8, 40), v === 1 ? mats.lining : mats.trim);
    ctx.add(g, dome(r * 0.32, 0.5), mats.accent, 0, 0, t / 2).rotation.x = Math.PI / 2;
    // Stitches round the edge.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.add(g, new THREE.BoxGeometry(0.012, 0.004, 0.004), mats.trim, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, t / 2 + 0.002).rotation.z = a;
    }
    return;
  }
  if (v === 0 || look.kind === "cloth") {
    const r = 0.27 * S;
    ctx.add(g, new THREE.CylinderGeometry(r, r, t, 40), mats.main).rotation.x = Math.PI / 2;
    ctx.add(g, new THREE.TorusGeometry(r, 0.016, 8, 48), mats.trim);
    ctx.add(g, new THREE.TorusGeometry(r * 0.55, 0.008, 6, 40), mats.trim, 0, 0, t / 2);
    ctx.add(g, dome(r * 0.24, 0.5), mats.trim, 0, 0, t / 2).rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.add(g, ball(0.01, 8, 6), mats.trim, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, t / 2);
    }
  } else if (v === 1) {
    // Kite: wide at the top, pointed at the bottom.
    const w = 0.23 * S, h = 0.62 * S;
    const sh = new THREE.Shape();
    sh.moveTo(-w, h * 0.32);
    sh.quadraticCurveTo(0, h * 0.42, w, h * 0.32);
    sh.quadraticCurveTo(w * 1.05, -h * 0.1, 0, -h * 0.58);
    sh.quadraticCurveTo(-w * 1.05, -h * 0.1, -w, h * 0.32);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 });
    geo.translate(0, 0, -t / 2);
    ctx.add(g, geo, mats.main);
    // Emblem: a bar and a diamond.
    ctx.add(g, new THREE.BoxGeometry(w * 1.6, 0.035, 0.012), mats.accent, 0, h * 0.18, t / 2 + 0.01);
    ctx.add(g, new THREE.OctahedronGeometry(0.06 * S, 0), mats.accent, 0, -h * 0.08, t / 2 + 0.01).scale.set(0.8, 1.25, 0.25);
    const edgeLine = new THREE.Shape();
    edgeLine.copy(sh);
    const rimGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false, curveSegments: 24 });
    rimGeo.scale(1.06, 1.06, 1);
    rimGeo.translate(0, 0, -t / 2 - 0.006);
    ctx.add(g, rimGeo, mats.trim);
  } else {
    // Tower: tall and curved round the body.
    const h = 0.95 * S, R = 0.42 * S;
    const body = ctx.add(g, new THREE.CylinderGeometry(R, R, h, 16, 1, true, -0.62, 1.24), mats.main, 0, -0.08 * S, -R + 0.02);
    void body;
    for (const y of [h / 2 - 0.02, -h / 2 + 0.02, 0]) {
      ctx.add(g, new THREE.CylinderGeometry(R + 0.008, R + 0.008, 0.04, 16, 1, true, -0.62, 1.24), mats.trim, 0, -0.08 * S + y, -R + 0.02);
    }
    for (const s of [1, -1]) {
      const a = s * 0.62;
      ctx.add(g, new THREE.BoxGeometry(0.035, h, 0.035), mats.trim, Math.sin(a) * R, -0.08 * S, Math.cos(a) * R - R + 0.02);
    }
    ctx.add(g, new THREE.OctahedronGeometry(0.07 * S, 0), mats.accent, 0, 0.05 * S, 0.035).scale.set(0.8, 1.25, 0.3);
  }
}

// ---------- Cloaks ----------

function buildCloak(ctx: Ctx) {
  const { c, look, v, mats } = ctx;
  const F = c.fit, J = c.joints, T = F.T;
  const len = v === 0 ? T * 0.95 + J.hipsY * 0.82 : T * 0.95 + J.hipsY * 0.3;
  const W = 24, Hs = 20;
  const top = T * 0.94;
  const geo = new THREE.PlaneGeometry(1, 1, W, Hs);
  const p = geo.attributes.position;
  const frayed = look.trimGlow && look.trimGlow > 1;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, t = 0.5 - p.getY(i);
    // Wraps round the back: narrow at the neck, wider at the bottom.
    const span = lerp(2.9, 2.7, t);
    const rr = lerp(F.shW * 0.92, F.shW * 1.3, Math.sqrt(t));
    const a = (u - 0.5) * span;
    let y = top - t * len;
    if (frayed && t > 0.97) y -= ((Math.sin(u * 61) + 1) * 0.5) * 0.06;
    const fold = 0.012 * Math.sin(u * Math.PI * 9) * t;
    const back = lerp(F.chD * 0.95, F.chD * 1.3 + 0.03, sm(0, 0.35, t)) + t * 0.04;
    p.setXYZ(i, Math.sin(a) * rr, y, -Math.cos(a) * back - fold);
  }
  geo.computeVertexNormals();
  ctx.geos.push(geo);
  const outer = new THREE.Mesh(geo, mats.main);
  const inner = new THREE.Mesh(geo, mats.lining);
  mats.main.side = THREE.BackSide;
  mats.lining.side = THREE.FrontSide;
  for (const m of [outer, inner]) {
    m.castShadow = true;
    m.receiveShadow = true;
    J.spine.add(m);
    ctx.parts.push(m);
  }
  // Collar and clasp.
  ctx.add(J.spine, ringsGeo([{ y: T * 0.9, rx: F.shW * 0.66, rz: F.chD * 0.95 }, { y: T * 0.99, rx: F.neckR * 2.4, rz: F.neckR * 2.3 }, { y: T * 1.03, rx: F.neckR * 2.2, rz: F.neckR * 2.1 }], 32), mats.main);
  const fz = F.neckR * 2.3;
  for (const s of [1, -1]) ctx.add(J.spine, new THREE.CylinderGeometry(0.022, 0.022, 0.01, 16), mats.accent, s * 0.03, T * 0.94, fz).rotation.x = Math.PI / 2;
  ctx.add(J.spine, new THREE.BoxGeometry(0.05, 0.006, 0.006), mats.accent, 0, T * 0.94, fz + 0.004);
  // A trim line along the bottom.
  const hemPts: THREE.Vector3[] = [];
  for (let i = 0; i <= W; i++) {
    const idx = Hs * (W + 1) + i;
    hemPts.push(new V3(p.getX(idx), p.getY(idx) + 0.012, p.getZ(idx)));
  }
  ctx.add(J.spine, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPts), 48, 0.008, 6), mats.trim);
}

// ---------- Gauntlets ----------

function buildGauntlets(ctx: Ctx) {
  const { c, v, mats } = ctx;
  const F = c.fit, J = c.joints;
  for (const s of [1, -1]) {
    const el = s > 0 ? J.elL : J.elR;
    ctx.add(el, limbGeo(F.foR * 1.3, F.foR * 1.75, F.foLen * 0.34), mats.main, 0, -F.foLen * 0.66, 0);
    ctx.add(el, new THREE.TorusGeometry(F.foR * 1.75, F.foR * 0.16, 6, 24), mats.trim, 0, -F.foLen * 1.0, 0).rotation.x = Math.PI / 2;
    const hy = -F.foLen - F.handR * 0.55;
    const hand = ctx.add(el, ball(F.handR * 1.22, 16, 12), mats.main, 0, hy, 0);
    hand.scale.set(0.86, 1.18, 0.78);
    // Knuckle plates.
    for (let i = 0; i < 2; i++) {
      const k = ctx.add(el, ball(F.handR * 0.5, 12, 8), mats.trim, s * F.handR * 0.62, hy - F.handR * (0.15 + i * 0.4), 0);
      k.scale.set(0.45, 0.9, 1.4);
    }
    if (v === 1)
      for (let i = 0; i < 3; i++) {
        const spike = ctx.add(el, new THREE.ConeGeometry(F.handR * 0.14, F.handR * 0.45, 8), mats.accent, s * F.handR * 0.95, hy - F.handR * 0.1 + (i - 1) * F.handR * 0.32, 0);
        spike.rotation.z = -s * Math.PI / 2;
      }
    // A frost gem on the back of each hand (Halbrecht's).
    if (ctx.look.trimGlow) ctx.add(el, new THREE.OctahedronGeometry(F.handR * 0.25, 0), mats.trim, 0, -F.foLen * 0.8, F.foR * 1.55).scale.set(0.8, 1.2, 0.5);
  }
}

const BUILDERS: Record<PieceKind, (ctx: Ctx) => void> = {
  helmet: buildHelmet,
  platebody: buildBody,
  platelegs: buildLegs,
  boots: buildBoots,
  shield: buildShield,
  cloak: buildCloak,
  gauntlets: buildGauntlets,
};

/** A piece of armor being worn. remove() takes it off again. */
export interface WornPiece {
  parts: THREE.Object3D[];
  remove(): void;
}

/** Put one piece on a character. */
export function wearPiece(c: Character, piece: PieceKind, look: ArmorLook, variant = 0): WornPiece {
  const mats = makeMats(look);
  const parts: THREE.Object3D[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const ctx: Ctx = {
    c, look, v: Math.max(0, Math.min(PIECE_VARIANTS[piece][look.kind].length - 1, variant)), mats, parts, geos,
    add(parent, geo, mat, x = 0, y = 0, z = 0) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      if (!parts.includes(parent)) parts.push(m);
      geos.push(geo);
      return m;
    },
  };
  BUILDERS[piece](ctx);
  for (const p of parts) p.traverse((o) => (o.userData.armor = true));
  return {
    parts,
    remove() {
      for (const p of parts) p.removeFromParent();
      for (const g of geos) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
    },
  };
}
