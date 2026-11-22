// Gems, soul stones and jewelry (shared/jewelry.ts): rough gems from the
// crystal cave, cut gems from the anvil, soul stones and soul gems, and
// rings and amulets in bronze, silver, gold, platinum or iridium.
import * as THREE from "three";
import type { GemId } from "../../../shared/jewelry";
import { ItemShape, MetalLook, Rng, ball, between, gem, glowMat, lump, mat, mesh, metalMat, rough } from "./kit";

export const GEM_COLOR: Record<GemId, number> = {
  amethyst: 0x9a5ad8,
  topaz: 0xf0b030,
  emerald: 0x2ab85a,
  sapphire: 0x2a5ae0,
  ruby: 0xe02a4a,
};
export const GEM_LIST: GemId[] = ["amethyst", "topaz", "emerald", "sapphire", "ruby"];
export type JewelMetalLook = Extract<MetalLook, "bronze" | "silver" | "gold" | "platinum" | "iridium">;
export const JEWEL_METAL_LIST: JewelMetalLook[] = ["bronze", "silver", "gold", "platinum", "iridium"];

/** A rough gem: a lump of grey rock with crystals poking out. Size is in carats (0.1 to 10). */
export function makeRoughGem(id: GemId, carats: number, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const s = 0.7 + Math.cbrt(carats) * 0.35;
  const rock = lump(rng, 0.035 * s, mat(0x8a8680, { roughness: 0.95 }), 0.4);
  rock.position.y = 0.025 * s;
  g.add(rock);
  for (let i = 0; i < 4; i++) {
    const c = mesh(rough(new THREE.ConeGeometry(0.012 * s, 0.05 * s, 5), rng, 0.004 * s), mat(GEM_COLOR[id], { roughness: 0.2, emissive: GEM_COLOR[id], emissiveIntensity: 0.25 }));
    const a = rng() * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.015 * s, 0.045 * s, Math.sin(a) * 0.015 * s);
    c.rotation.set(between(rng, -0.6, 0.6), 0, between(rng, -0.6, 0.6));
    g.add(c);
  }
  return g;
}

/** A cut gem, lying on its side so you can see the sparkle. Bigger carats, bigger gem. */
export function makeCutGem(id: GemId, carats: number): THREE.Group {
  const g = new THREE.Group();
  const r = 0.012 + Math.cbrt(carats) * 0.012;
  const stone = gem(r, GEM_COLOR[id], 8, 0.3);
  stone.position.y = r * 0.9;
  g.add(stone);
  return g;
}

/** A soul stone (raw: dark rock with a pale vein) or soul gem (cut: dark crystal; souls make it glow). */
export function makeSoul(cut: boolean, souls: number, rng: Rng): { g: THREE.Group; glow?: THREE.Mesh } {
  const g = new THREE.Group();
  if (!cut) {
    const rock = lump(rng, 0.045, mat(0x3a3448, { roughness: 0.9 }), 0.35);
    rock.position.y = 0.035;
    g.add(rock);
    for (let i = 0; i < 3; i++) g.add(ball(0.008, glowMat(0xc8b8ff, 0.6), 0, between(rng, -0.03, 0.03), 0.05 + rng() * 0.02, between(rng, -0.03, 0.03)));
    return { g };
  }
  const shell = gem(0.045, 0x4a3a6a, 6, 0.05);
  shell.material = mat(0x4a3a6a, { roughness: 0.15, metalness: 0.2 });
  shell.position.y = 0.04;
  g.add(shell);
  if (souls > 0) {
    const core = ball(0.016, glowMat(0xb8a0ff, 2), 1, 0, 0.042, 0);
    g.add(core);
    return { g, glow: core };
  }
  return { g };
}

/** A ring, standing up on its edge, with an optional gem on top. */
export function makeRing(metal: JewelMetalLook, gemId: GemId | null, _rng?: Rng): THREE.Group {
  const g = new THREE.Group();
  const band = mesh(new THREE.TorusGeometry(0.02, 0.0045, 6, 16), metalMat(metal));
  band.position.y = 0.0245;
  g.add(band);
  if (gemId) {
    const setting = mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.006, 6), metalMat(metal, true));
    setting.position.y = 0.047;
    g.add(setting);
    const stone = gem(0.008, GEM_COLOR[gemId], 8, 0.35);
    stone.position.y = 0.053;
    g.add(stone);
  }
  return g;
}

/** An amulet lying flat: a chain loop and a pendant (with a gem, if it has one). */
export function makeAmulet(metal: JewelMetalLook, gemId: GemId | null): THREE.Group {
  const g = new THREE.Group();
  // The chain: little links around an oval.
  const link = new THREE.TorusGeometry(0.006, 0.0015, 3, 6);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const l = mesh(link, metalMat(metal));
    l.position.set(Math.cos(a) * 0.07, 0.003, Math.sin(a) * 0.09 - 0.03);
    l.rotation.set(Math.PI / 2, 0, a + (i % 2 ? Math.PI / 2 : 0));
    g.add(l);
  }
  const pendant = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.006, 8), metalMat(metal));
  pendant.position.set(0, 0.004, 0.08);
  g.add(pendant);
  const rim = mesh(new THREE.TorusGeometry(0.026, 0.003, 4, 16), metalMat(metal, true));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.007, 0.08);
  g.add(rim);
  if (gemId) {
    const stone = gem(0.014, GEM_COLOR[gemId], 8, 0.35);
    stone.position.set(0, 0.012, 0.08);
    g.add(stone);
  }
  return g;
}

export type GemKind = "rough_gem" | "cut_gem" | "soul_stone" | "ring" | "amulet";

/**
 * Build a gem or jewelry piece. `choice` is [gem or metal, second option]:
 *  - rough_gem / cut_gem: [gem, size: 0 small, 1 medium, 2 big]
 *  - soul_stone: [0 soul stone, 1 empty soul gem, 2 filled soul gem]
 *  - ring / amulet: [metal, gem (0 = none, 1.. = GEM_LIST)]
 */
export function buildGem(kind: GemKind, choice: number[], rng: Rng): ItemShape {
  const object = new THREE.Group();
  const sizes = [0.5, 2.4, 8];
  switch (kind) {
    case "rough_gem": object.add(makeRoughGem(GEM_LIST[choice[0]], sizes[choice[1] ?? 1], rng)); break;
    case "cut_gem": {
      object.add(makeCutGem(GEM_LIST[choice[0]], sizes[choice[1] ?? 1]));
      return { object, tick: (_dt, t) => (object.children[0].rotation.y = t * 0.8) };
    }
    case "soul_stone": {
      const { g, glow } = makeSoul(choice[0] > 0, choice[0] === 2 ? 3 : 0, rng);
      object.add(g);
      if (glow) return { object, tick: (_dt, t) => glow.scale.setScalar(1 + Math.sin(t * 2) * 0.15) };
      break;
    }
    case "ring": {
      const gemId = choice[1] ? GEM_LIST[choice[1] - 1] : null;
      object.add(makeRing(JEWEL_METAL_LIST[choice[0]], gemId));
      return { object, tick: (_dt, t) => (object.children[0].rotation.y = t * 0.6) };
    }
    case "amulet": object.add(makeAmulet(JEWEL_METAL_LIST[choice[0]], choice[1] ? GEM_LIST[choice[1] - 1] : null)); break;
  }
  return { object };
}
