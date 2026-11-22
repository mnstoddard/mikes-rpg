// Monsters that walk on two legs: goblins, the Ashbound (scouts and raiders),
// grave ghouls, and the story's two big foes, Sable and Vael. They're built
// from the smooth character (src/character), dressed with the armor library
// and handed weapons from the weapon library, so they match the player.
import * as THREE from "three";
import { CharacterRecipe, createCharacter } from "../character";
import type { ArmorLook } from "../armor";
import { PieceKind, wearPiece } from "../armor/pieces";
import { WeaponKind, WeaponOptions, createWeapon } from "../weapons";
import { BLIGHT_GLOW } from "./beasts";
import { Body, Kit, PoseCtx, bump, ease, finish } from "./kit";

type Move = "slash" | "stab" | "claw" | "cast";

interface FolkSpec {
  recipe: Partial<CharacterRecipe>;
  scale?: number;
  hideHair?: boolean;
  armor?: [PieceKind, ArmorLook, number][];
  weapon?: { kind: WeaponKind; opts: Partial<WeaponOptions> };
  move: Move;
  /** Lean forward (radians): ghouls and goblins hunch. */
  hunch?: number;
  /** Threads of stolen light round Vael. */
  threads?: number;
  /** A glow round the hands or staff tip when attacking. */
  castColor?: number;
  extras?: (k: Kit, c: ReturnType<typeof createCharacter>) => void;
}

const look = (name: string, kind: ArmorLook["kind"], main: string, trim: string, accent: string, lining: string, o: Partial<ArmorLook> = {}): ArmorLook =>
  ({ name, kind, main, trim, accent, lining, metalness: kind === "metal" ? 0.8 : 0, roughness: kind === "metal" ? 0.35 : 0.85, ...o });

// The Ashbound wear ash-grey and soot, patched with ember orange.
const ASH_LEATHER = look("Ashbound leather", "leather", "#8a7c6a", "#4e463c", "#d8843c", "#5a5046");
const ASH_CLOTH = look("Ashbound cloth", "cloth", "#9a948a", "#5e5a52", "#d8843c", "#4a4640");
const GOBLIN_RAGS = look("Goblin rags", "leather", "#6a5236", "#3e2e1e", "#b8a060", "#4a3a26");
const GOBLIN_TIN = look("Goblin tin", "metal", "#8a8478", "#5a544a", "#a85a2a", "#3a2a1c", { roughness: 0.6 });
const GHOUL_RAGS = look("Grave rags", "cloth", "#5a5e52", "#3a3e36", "#7a7e66", "#2e322a");
const SABLE_CLOAK = look("Thread-cut", "cloth", "#2c2833", "#7fe3d6", "#c9b98a", "#17141c", { trimGlow: 1.2 });
const SABLE_LEATHER = look("Sable's leather", "leather", "#3a3238", "#1e1a1e", "#c8742c", "#2a2428");
const RADIANT = look("Radiant", "cloth", "#f6f1e4", "#f2c14e", "#ffd76a", "#e9dcc0", { roughness: 0.6, trimGlow: 0.9 });

function buildFolk(S: FolkSpec) {
  const k = new Kit();
  const c = createCharacter(S.recipe, { anim: null, hideHair: S.hideHair });
  for (const [piece, lk, v] of S.armor ?? []) wearPiece(c, piece, lk, v);
  const J = c.joints;
  let tip: THREE.Object3D | null = null;
  if (S.weapon) {
    const w = createWeapon(S.weapon.kind, S.weapon.opts);
    const mount = new THREE.Group();
    mount.rotation.x = Math.PI / 2;
    const inner = new THREE.Group();
    inner.rotation.y = Math.PI / 2;
    inner.add(w.held ?? w.object);
    mount.add(inner);
    J.handR.add(mount);
    mount.traverse((o) => (o.userData.noFlash = true));
    tip = new THREE.Object3D();
    tip.position.copy(w.tip);
    (w.held ?? w.object).add(tip);
  }
  S.extras?.(k, c);

  const scene = new THREE.Group();
  const root = k.joint(scene, 0, 0, 0, "root");
  const fall = k.joint(root, 0, 0, 0, "fall");
  fall.add(c.object);
  const sc = S.scale ?? 1;
  c.object.scale.setScalar(sc);
  for (const j of [J.hips, J.spine, J.head, J.shL, J.shR, J.elL, J.elR, J.hipL, J.hipR, J.kneeL, J.kneeR, J.ankL, J.ankR, J.handR]) k.rig.add(j);

  // Threads of light (Vael).
  const threads: THREE.Mesh[] = [];
  if (S.threads) {
    const m = k.mat(0xffe7a0, { glow: 0xffc84a, glowStrength: 1.6, opacity: 0.85 });
    for (let i = 0; i < S.threads; i++) {
      const a = (i / S.threads) * Math.PI * 2;
      const pts = [];
      for (let j = 0; j <= 12; j++) {
        const t = j / 12;
        pts.push(new THREE.Vector3(Math.cos(a + t * 2.5) * (0.35 + t * 0.6), 0.3 + t * 2.2, Math.sin(a + t * 2.5) * (0.35 + t * 0.6)));
      }
      const mesh = k.mesh(scene, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 5, false), m, 0, 0, 0, false);
      threads.push(mesh);
    }
  }
  const castGlow = S.castColor !== undefined ? k.glowSprite(S.castColor, 0.9, 0) : null;
  if (castGlow) (tip ?? J.handR).add(castGlow);

  const held = !!S.weapon;
  const body: Body = {
    durations: { attack: S.move === "cast" ? 1.2 : 0.85, hit: 0.5, death: 1.3 },
    follow: 14,
    pose: (ctx) => {
      poseFolk(ctx, J, S, held);
      if (ctx.anim === "death") {
        // Topple over backwards, from the feet.
        const f = ease(ctx.p, 0.25, 0.7);
        const bounce = bump(ctx.p, 0.7, 0.78, 0.88);
        ctx.rig.r(fall, -1.5 * f + 0.06 * bounce, 0, 0);
        ctx.rig.p(fall, 0, 0.14 * sc * f, -0.05 * sc * f);
      }
    },
    fx(ctx) {
      if (castGlow) {
        const g = ctx.anim === "attack" ? bump(ctx.p, 0.15, 0.5, 0.95) : 0;
        (castGlow.material as THREE.SpriteMaterial).opacity = 0.9 * g;
        castGlow.scale.setScalar((0.5 + 1.2 * g) / sc);
      }
      threads.forEach((t, i) => {
        t.rotation.y = ctx.time * 0.25 + i;
        const mm = t.material as THREE.MeshStandardMaterial;
        mm.opacity = ctx.anim === "death" ? 0.85 * (1 - ease(ctx.p, 0, 0.6)) : 0.55 + 0.3 * Math.sin(ctx.time * 2 + i);
      });
    },
    after(dt, time, ctx) {
      c.update(dt, time);
      const shut = ctx.anim === "death" || (ctx.anim === "hit" && ctx.p < 0.7);
      if (shut) for (const e of J.eyes) {
        if (e.m.map !== e.shut) {
          e.m.map = e.shut;
          e.m.emissiveMap = e.shut;
        }
      }
    },
    dispose: () => c.dispose(),
  };
  return finish(k, scene, body, 1.85 * sc * (S.recipe.height ?? 1));
}

function poseFolk(c: PoseCtx, J: ReturnType<typeof createCharacter>["joints"], S: FolkSpec, held: boolean) {
  const R = c.rig, time = c.time;
  const rest = J.rest;
  const hunch = S.hunch ?? 0;
  // Standing pose: arms at the sides, the weapon held ready.
  R.r(J.shL, 0, 0, rest);
  R.r(J.shR, 0, 0, -rest);
  R.r(J.elL, -0.14, 0, 0);
  R.r(J.elR, -0.14, 0, 0);
  if (held) {
    R.r(J.shR, -0.25, 0, -0.05);
    R.r(J.elR, -0.85, 0, 0);
    R.r(J.handR, S.move === "cast" ? -0.5 : 0.45, 0, 0);
  }
  if (S.move === "claw") {
    R.r(J.shL, -0.5, 0, 0.1);
    R.r(J.shR, -0.5, 0, -0.1);
    R.r(J.elL, -0.6, 0, 0);
    R.r(J.elR, -0.6, 0, 0);
  }
  R.r(J.spine, hunch, 0, 0);
  R.r(J.head, -hunch * 0.8, 0, 0);
  if (hunch) {
    R.r(J.hipL, -hunch * 0.4, 0, 0);
    R.r(J.hipR, -hunch * 0.4, 0, 0);
    R.r(J.kneeL, hunch * 0.8, 0, 0);
    R.r(J.kneeR, hunch * 0.8, 0, 0);
    R.r(J.ankL, -hunch * 0.4, 0, 0);
    R.r(J.ankR, -hunch * 0.4, 0, 0);
    R.p(J.hips, 0, -hunch * 0.06, 0);
  }

  if (c.anim === "idle") {
    const br = Math.sin(time * 1.8);
    R.r(J.spine, 0.02 * br, 0, -0.03 * Math.sin(time * 0.6));
    R.r(J.shL, 0, 0, 0.025 * br);
    R.r(J.shR, 0, 0, -0.025 * br);
    R.r(J.head, 0.04 * Math.sin(time * 0.7), 0.3 * Math.sin(time * 0.45) * Math.sin(time * 0.21), 0);
    R.r(J.hips, 0, 0, 0.02 * Math.sin(time * 0.6));
    R.p(J.hips, 0, -0.003 * (1 + br), 0);
  }
  if (c.anim === "walk") {
    const w = c.t * 5.4, s = Math.sin(w), cc = Math.cos(w);
    R.r(J.hipL, -0.55 * s, 0, 0);
    R.r(J.hipR, 0.55 * s, 0, 0);
    R.r(J.kneeL, 0.1 + 0.85 * Math.max(0, cc), 0, 0);
    R.r(J.kneeR, 0.1 + 0.85 * Math.max(0, -cc), 0, 0);
    R.r(J.ankL, -(-0.55 * s + 0.1 + 0.85 * Math.max(0, cc)) * 0.55, 0, 0);
    R.r(J.ankR, -(0.55 * s + 0.1 + 0.85 * Math.max(0, -cc)) * 0.55, 0, 0);
    R.r(J.shL, 0.5 * s, 0, 0);
    if (!held) R.r(J.shR, -0.5 * s, 0, 0);
    else R.r(J.shR, -0.12 * s, 0, 0);
    R.r(J.elL, -0.25 - 0.2 * Math.max(0, -s), 0, 0);
    R.p(J.hips, 0, -0.03 * s * s, 0);
    R.r(J.spine, 0.05, 0.12 * s, 0);
    R.r(J.head, 0, -0.1 * s, 0);
    R.r(J.hips, 0, -0.08 * s, 0);
  }
  if (c.anim === "attack") {
    const p = c.p;
    const w = ease(p, 0, 0.35) * (1 - ease(p, 0.35, 0.5));
    const s = ease(p, 0.35, 0.5) * (1 - ease(p, 0.68, 1));
    if (S.move === "slash") {
      R.r(J.shR, -2.3 * w - 1.05 * s, 0, -0.45 * w + 0.45 * s);
      R.r(J.elR, -0.4 * w + 0.75 * s, 0, 0);
      R.r(J.handR, -0.6 * w + 0.5 * s, 0, 0);
      R.r(J.spine, -0.05 * w + 0.2 * s, -0.4 * w + 0.45 * s, 0);
      R.r(J.shL, 0.25 * s - 0.3 * w, 0, 0.2 * w);
    } else if (S.move === "stab") {
      R.r(J.shR, 0.35 * w - 1.25 * s, 0, 0);
      R.r(J.elR, -0.7 * w + 0.8 * s, 0, 0);
      R.r(J.handR, 0.6 * s, 0, 0);
      R.r(J.spine, 0.28 * s, -0.25 * w + 0.2 * s, 0);
      R.r(J.shL, -0.4 * w, 0, 0.3 * s);
    } else if (S.move === "claw") {
      R.r(J.shL, -2.3 * w - 0.6 * s, 0, 0.3 * w - 0.2 * s);
      R.r(J.shR, -2.3 * w - 0.6 * s, 0, -0.3 * w + 0.2 * s);
      R.r(J.elL, 0.4 * w + 0.4 * s, 0, 0);
      R.r(J.elR, 0.4 * w + 0.4 * s, 0, 0);
      R.r(J.spine, -0.2 * w + 0.35 * s, 0, 0);
      R.r(J.head, 0.2 * w - 0.2 * s, 0, 0);
    } else {
      // Cast: raise the staff, then thrust it forward.
      const up = ease(p, 0, 0.3) * (1 - ease(p, 0.4, 0.55));
      const push = ease(p, 0.4, 0.55) * (1 - ease(p, 0.8, 1));
      R.r(J.shR, -2.2 * up - 1.1 * push, 0, -0.2 * up);
      R.r(J.elR, 0.4 * up + 0.7 * push, 0, 0);
      R.r(J.shL, -1.9 * up - 1.2 * push, 0, 0.2 * up - 0.2 * push);
      R.r(J.elL, -0.4 * up, 0, 0);
      R.r(J.spine, -0.15 * up + 0.15 * push, 0, 0);
      R.r(J.head, -0.15 * up, 0, 0);
    }
    // A step into the swing.
    R.r(J.hipL, -0.45 * s, 0, 0);
    R.r(J.kneeL, 0.35 * s, 0, 0);
    R.r(J.hipR, 0.25 * s, 0, 0);
    R.p(J.hips, 0, -0.04 * s, 0.06 * s);
  }
  if (c.anim === "hit") {
    const h = c.p < 0.14 ? ease(c.p, 0, 0.14) : 1 - ease(c.p, 0.14, 1);
    R.r(J.spine, -0.35 * h, 0.15 * h, 0);
    R.r(J.head, -0.35 * h, 0, 0.1 * h);
    R.r(J.shL, -0.3 * h, 0, 0.5 * h);
    R.r(J.shR, -0.3 * h, 0, -0.5 * h);
    R.r(J.hipR, 0.3 * h, 0, 0);
    R.r(J.kneeL, 0.3 * h, 0, 0);
    R.p(J.hips, 0, -0.02 * h, -0.08 * h);
  }
  if (c.anim === "death") {
    const buckle = ease(c.p, 0, 0.3);
    const f = ease(c.p, 0.25, 0.7);
    R.r(J.kneeL, 0.8 * buckle * (1 - f), 0, 0);
    R.r(J.kneeR, 0.8 * buckle * (1 - f), 0, 0);
    R.r(J.hipL, -0.5 * buckle * (1 - f), 0, 0);
    R.r(J.hipR, -0.5 * buckle * (1 - f), 0, 0);
    R.p(J.hips, 0, -0.12 * buckle * (1 - f), 0);
    R.r(J.spine, 0.3 * buckle * (1 - f) - hunch * f, 0, 0);
    R.r(J.shL, -0.2 * f, 0, 1.1 * f);
    R.r(J.shR, -0.2 * f, 0, -1.1 * f);
    R.r(J.head, 0.25 * f, 0.4 * f, 0);
  }
}

const folk = buildFolk;

export function goblin(variant: number, seed: number) {
  void seed;
  const skins = ["#7fae4e", "#5f8a46", "#8a9a8e"];
  const tunnel = variant === 2;
  return folk({
    recipe: {
      name: "Goblin", frame: 0.25, height: 0.82, build: 0.35, muscle: 0.3, head: 1.38, legs: 0.85, shoulders: 0.9, skin: skins[variant] ?? skins[0],
      faceWidth: 1.1, jaw: 0.95, chin: 0.85, nose: "long", noseSize: 1.35, mouth: "grin", mouthWidth: 1.25,
      ears: "elf", earSize: 1.6, eyeStyle: "big", eyeSize: 1.15, eyeColor: "#e0a21b", browThick: 1.5, browTilt: 1,
      hairStyle: variant === 1 ? "mohawk" : "bald", hairColor: "#2a2a1e", beard: "none",
      top: "tank", bottom: "shorts", shoes: "bare", belt: "on", hat: "none",
      shirtColor: "#6a5236", pantsColor: "#4a3a26", accentColor: "#b8a060",
    },
    scale: 0.9,
    hideHair: tunnel,
    armor: tunnel ? [["helmet", GOBLIN_TIN, 0], ["platebody", GOBLIN_RAGS, 0]] : [["platebody", GOBLIN_RAGS, variant === 1 ? 1 : 0]],
    weapon: { kind: "goblin_dagger", opts: { metal: "bronze", wood: "pine", variant: variant === 1 ? 1 : 0 } },
    move: "stab",
    hunch: 0.18,
  });
}

export function ashboundScout(variant: number, seed: number) {
  void seed;
  return folk({
    recipe: {
      name: "Scout", frame: variant === 0 ? 0.85 : 0.2, height: 0.98, build: 0.15, muscle: 0.4, skin: variant === 0 ? "#d9a07a" : "#a0704a",
      eyeStyle: "classic", eyeColor: "#c8742c", browTilt: 0.6, mouth: "neutral", hairStyle: "short", hairColor: "#2a2420",
      top: "long", bottom: "pants", shoes: "boots", belt: "on", shirtColor: "#4a4842", pantsColor: "#3a3630", shoeColor: "#2a2622", accentColor: "#c8742c",
    },
    hideHair: true,
    armor: [["helmet", ASH_LEATHER, 1], ["platebody", ASH_LEATHER, 0], ["cloak", ASH_CLOTH, 0]],
    weapon: { kind: "dagger", opts: { metal: "iron", wood: "oak", variant: 0 } },
    move: "stab",
  });
}

export function ashboundRaider(variant: number, seed: number) {
  void seed;
  return folk({
    recipe: {
      name: "Raider", frame: variant === 0 ? 0 : 0.8, height: 1.06, build: 0.55, muscle: 0.8, shoulders: 1.12, skin: variant === 0 ? "#c88a5e" : "#8a5a3a",
      eyeStyle: "classic", eyeColor: "#5a3a1e", browThick: 1.6, browTilt: 0.9, mouth: "frown", hairStyle: "short", hairColor: "#1b1613", beard: variant === 0 ? "stubble" : "none",
      top: "long", bottom: "pants", shoes: "boots", belt: "on", shirtColor: "#3a3630", pantsColor: "#2e2a26", shoeColor: "#1e1c1a", accentColor: "#c8742c",
    },
    hideHair: true,
    armor: [["helmet", ASH_LEATHER, 0], ["platebody", ASH_LEATHER, 1], ["platelegs", ASH_LEATHER, 1], ["boots", ASH_LEATHER, 1], ["cloak", ASH_CLOTH, 0], ...(variant === 1 ? [["shield", ASH_LEATHER, 1] as [PieceKind, ArmorLook, number]] : [])],
    weapon: variant === 0 ? { kind: "greatsword", opts: { metal: "iron", wood: "oak", variant: 0 } } : { kind: "sword", opts: { metal: "steel", wood: "oak", variant: 1 } },
    move: "slash",
  });
}

export function graveGhoul(variant: number, seed: number) {
  void seed;
  return folk({
    recipe: {
      name: "Ghoul", frame: 0.1, height: 0.98, build: 0.0, muscle: 0.0, head: 1.12, skin: variant === 0 ? "#a8b4a0" : "#9aa8b8",
      cheeks: 0, jaw: 0.85, nose: "small", mouth: "frown", ears: "pointy", earSize: 1.2,
      eyeStyle: "big", eyeColor: variant === 0 ? "#c8ff9a" : "#9adfff", eyeSize: 1.1, browThick: 0.6, browTilt: 0.8,
      hairStyle: "messy", hairColor: "#5a5e58", hairLength: 0.7, beard: "none",
      top: "tunic", bottom: "pants", shoes: "bare", belt: "off", shirtColor: "#5a5e52", pantsColor: "#3a3e36", accentColor: "#7a7e66",
    },
    armor: [["platebody", GHOUL_RAGS, 1]],
    move: "claw",
    hunch: 0.35,
    extras: (k, c) => {
      // Long claws on each hand.
      const claw = k.mat(0xe8e2cc, { roughness: 0.4 });
      for (const hand of [c.joints.handL, c.joints.handR]) {
        for (let i = -1; i <= 1; i++) {
          const t = k.horn(hand, 0.07, 0.01, claw, 0.4, i * 0.018, -0.05, 0.02);
          t.rotation.x = Math.PI;
        }
      }
    },
  });
}

export function sable(variant: number, seed: number) {
  void seed;
  return folk({
    recipe: {
      name: "Sable", frame: 1, height: 1.06, build: 0.3, muscle: 0.6, skin: "#b9805a", faceLength: 1.05, jaw: 0.85, chin: 1.05,
      eyeStyle: "classic", eyeColor: "#7fe3d6", lashes: "on", browThick: 1.2, browTilt: 0.5, mouth: "neutral",
      hairStyle: variant === 0 ? "ponytail" : "long", hairColor: "#e8e4dc", hairLength: 0.8,
      top: "long", bottom: "pants", shoes: "boots", belt: "on", shirtColor: "#3a3238", pantsColor: "#2a2428", shoeColor: "#1e1a1e", accentColor: "#c8742c",
    },
    armor: [["platebody", SABLE_LEATHER, 1], ["platelegs", SABLE_LEATHER, 1], ["boots", SABLE_LEATHER, 1], ["gauntlets", SABLE_LEATHER, 0], ["cloak", SABLE_CLOAK, 0]],
    weapon: variant === 0 ? { kind: "sword", opts: { metal: "mithril", wood: "yew", variant: 2 } } : { kind: "severing_blade", opts: { metal: "mithril", wood: "elderwood" } },
    move: "slash",
    castColor: 0x7fe3d6,
  });
}

export function vael(variant: number, seed: number) {
  void seed;
  const shade = variant === 1;
  return folk({
    recipe: {
      name: "Vael", frame: 0.1, height: 1.1, build: 0.15, muscle: 0.3, skin: shade ? "#c9c4d8" : "#e9c8a8", faceLength: 1.1, jaw: 0.85, chin: 1.1, cheeks: 0.2,
      eyeStyle: "classic", eyeColor: shade ? "#ffe08a" : "#d8a43a", browThick: 0.9, browTilt: 0.4, mouth: "smirk",
      hairStyle: "long", hairColor: shade ? "#f6f1e4" : "#d9d2c4", hairLength: 0.9, beard: "wizard",
      top: "robe", bottom: "skirt", shoes: "shoes", belt: "on", hat: "crown", shirtColor: "#f6f1e4", pantsColor: "#f6f1e4", shoeColor: "#e2b33c", accentColor: "#f2c14e",
    },
    armor: [["platebody", RADIANT, 0], ["cloak", RADIANT, 0]],
    weapon: { kind: "staff", opts: { wood: "crownwood", gem: "topaz", variant: 2 } },
    move: "cast",
    threads: shade ? 9 : 6,
    castColor: 0xffd76a,
  });
}

export { BLIGHT_GLOW };
