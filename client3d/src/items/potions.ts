// Potions (shared/alchemy.ts) and the empty vial they're made in.
// Each potion is a glass bottle with coloured liquid that glows softly and
// bubbles. Plain potions are round flasks; the "draughts" and "brews" are
// tall flasks with long necks, like the ⚗️ icon.
import * as THREE from "three";
import type { PotionType } from "../../../shared/alchemy";
import { ItemShape, Rng, ball, between, glassMat, lathe, mat, mesh, rod } from "./kit";

export const POTION_LOOK: Record<PotionType, { color: number; flask: "round" | "tall" | "vial" }> = {
  health:     { color: 0xe0303a, flask: "round" },
  stamina:    { color: 0x4ac850, flask: "round" },
  mana:       { color: 0x3a78f0, flask: "round" },
  restore:    { color: 0xd860c8, flask: "tall" },
  strength:   { color: 0xf07a20, flask: "round" },
  swift:      { color: 0xf0e040, flask: "vial" },
  hunter:     { color: 0x9a6a30, flask: "tall" },
  nightsight: { color: 0x6a5af0, flask: "vial" },
  tithe:      { color: 0xf8c848, flask: "vial" },
  soultrap:   { color: 0x6ae0b8, flask: "round" },
};
export const POTION_LIST = Object.keys(POTION_LOOK) as PotionType[];

/** The glass outline of each flask shape, as [radius, height] from the bottom up. */
const FLASKS: Record<"round" | "tall" | "vial", { glass: [number, number][]; fill: number; neck: number }> = {
  round: { glass: [[0, 0], [0.03, 0.002], [0.045, 0.02], [0.048, 0.045], [0.04, 0.07], [0.016, 0.085], [0.014, 0.11], [0.017, 0.115]], fill: 0.06, neck: 0.115 },
  tall: { glass: [[0, 0], [0.04, 0.002], [0.052, 0.03], [0.045, 0.06], [0.014, 0.08], [0.011, 0.15], [0.016, 0.155]], fill: 0.05, neck: 0.155 },
  vial: { glass: [[0, 0], [0.018, 0.002], [0.022, 0.01], [0.022, 0.11], [0.025, 0.115]], fill: 0.08, neck: 0.115 },
};

/** A bottle. Pass null for an empty one. */
export function makeBottle(shape: "round" | "tall" | "vial", liquid: number | null, rng: Rng): { g: THREE.Group; bubbles: THREE.Mesh[]; fill: THREE.Mesh | null } {
  const g = new THREE.Group();
  const f = FLASKS[shape];
  const glass = lathe(f.glass, glassMat(0xdff4ff, 0.32), 12);
  glass.castShadow = false;
  glass.renderOrder = 2;
  g.add(glass);
  let fill: THREE.Mesh | null = null;
  const bubbles: THREE.Mesh[] = [];
  if (liquid !== null) {
    // The liquid: the same outline, a bit smaller, cut off at the fill line.
    const inner = f.glass.filter(([, y]) => y <= f.fill).map(([r, y]) => [Math.max(0, r - 0.003), y + 0.002] as [number, number]);
    const last = f.glass.find(([, y]) => y > f.fill)!;
    const prev = f.glass.filter(([, y]) => y <= f.fill).pop()!;
    const k = (f.fill - prev[1]) / (last[1] - prev[1]);
    inner.push([prev[0] + (last[0] - prev[0]) * k - 0.003, f.fill], [0, f.fill]);
    const lm = mat(liquid, { roughness: 0.2, emissive: liquid, emissiveIntensity: 0.45 }).clone();
    lm.userData.own = true; // its own copy, so its glow can change
    fill = lathe(inner, lm, 12);
    fill.castShadow = false;
    g.add(fill);
    for (let i = 0; i < 4; i++) {
      const b = ball(0.004, mat(0xffffff, { emissive: liquid, emissiveIntensity: 0.6 }), 0, between(rng, -0.01, 0.01), 0.01, between(rng, -0.01, 0.01));
      b.castShadow = false;
      bubbles.push(b);
      g.add(b);
    }
  }
  // Cork, and a little string tie round the neck.
  const neckR = f.glass[f.glass.length - 2][0];
  g.add(rod(neckR * 0.95, neckR * 1.1, 0.022, mat(0xb88a5a, { roughness: 1 }), 7, f.neck - 0.008));
  const tie = mesh(new THREE.TorusGeometry(neckR + 0.002, 0.0018, 3, 10), mat(0xe8d8b0));
  tie.rotation.x = Math.PI / 2;
  tie.position.y = f.neck - 0.012;
  g.add(tie);
  return { g, bubbles, fill };
}

/** A potion of this type (or "vial" for an empty vial). */
export function buildPotion(type: PotionType | "vial", rng: Rng): ItemShape {
  const object = new THREE.Group();
  if (type === "vial") {
    object.add(makeBottle("vial", null, rng).g);
    return { object };
  }
  const look = POTION_LOOK[type];
  const { g, bubbles, fill } = makeBottle(look.flask, look.color, rng);
  object.add(g);
  const top = FLASKS[look.flask].fill;
  let shake = 0;
  return {
    object,
    actLabel: "Shake",
    act: () => (shake = 1.2),
    tick: (dt, t) => {
      shake = Math.max(0, shake - dt);
      g.rotation.z = shake > 0 ? Math.sin(t * 30) * 0.12 * shake : 0;
      bubbles.forEach((b, i) => {
        const speed = shake > 0 ? 2.5 : 0.5;
        const ph = (t * speed * 0.6 + i * 0.27) % 1;
        b.position.y = 0.01 + ph * (top - 0.012);
        b.scale.setScalar(0.6 + ph * 0.6);
      });
      if (fill) (fill.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.sin(t * 2) * 0.08 + shake * 0.4;
    },
  };
}
