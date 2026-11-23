// Gathering and crafting tools: axe, pickaxe, shovel, fishing rod, hammer,
// tongs and the cooking pot. Every one is built from its head metal
// (bronze, iron, steel, mithril; bronze is the level 1 start, there's no
// stone tier) and its handle wood, the same way shared/tools.ts makes the
// items, so "Iron axe (Oak)" looks iron and oak.
//
// The handle points up the Y axis and `grip` is where the hand goes. Tools
// you swing don't move by themselves: their `heldMove` (chop, dig, cast)
// tells whoever holds them how to move the arm, and `follow` lets the tool
// react (the fishing rod bends as you cast).
import * as THREE from "three";
import type { ToolType, Wood } from "../../../shared/tools";
import { HeldMove, ItemShape, METAL_LOOK, Rng, ball, barkMat, box, ease, glowMat, lathe, mat, mesh, metalMat, rod, slab, tween, woodMat } from "./kit";

/** The metals a tool head can be made of. */
export type ToolMetal = "bronze" | "iron" | "steel" | "mithril";
export const TOOL_METALS: ToolMetal[] = ["bronze", "iron", "steel", "mithril"];

const headMat = (material: ToolMetal) => metalMat(material);

/** A plain wooden handle from y=0 up to `length`, with a little swell at the bottom so it doesn't slip. */
function handle(wood: Wood, length: number, r = 0.022): THREE.Group {
  const g = new THREE.Group();
  g.add(rod(r * 1.05, r * 0.92, length, woodMat(wood), 7));
  const knob = rod(r * 1.35, r * 1.05, 0.05, woodMat(wood), 7, -0.02);
  g.add(knob);
  // A dark grip wrap where the hand goes.
  g.add(rod(r * 1.18, r * 1.18, 0.16, barkMat(wood), 7, 0.05));
  return g;
}

/** A tool the arm swings: where the hand holds it, and how the arm moves. */
function held(model: THREE.Group, grip: THREE.Vector3, label: string, move: HeldMove, follow?: (f: number) => void): ItemShape {
  const object = new THREE.Group();
  object.add(model);
  return { object, grip, actLabel: label, heldMove: move, follow, groundPose: { rz: Math.PI / 2, y: 0.03 } };
}

function axe(material: ToolMetal, wood: Wood): ItemShape {
  const g = new THREE.Group();
  const L = 0.72;
  g.add(handle(wood, L));
  const top = L - 0.09;
  // The blade: narrow at the eye, flaring to a curved edge.
  const blade = slab([[0.0, -0.035], [0.1, -0.06], [0.155, -0.085], [0.165, 0], [0.155, 0.075], [0.1, 0.05], [0.0, 0.035]], 0.024, headMat(material), 0.004);
  blade.position.set(0.02, top, 0);
  g.add(blade);
  // A bright sharpened edge.
  g.add(box(0.012, 0.15, 0.012, mat(METAL_LOOK[material].color, { metalness: 0.9, roughness: 0.15 }), 0.18, top - 0.005, 0));
  // The eye (round the handle) and the poll at the back.
  g.add(box(0.06, 0.08, 0.05, metalMat(material, true), 0.0, top, 0));
  g.add(box(0.035, 0.06, 0.042, metalMat(material, true), -0.045, top, 0));
  return held(g, new THREE.Vector3(0, 0.1, 0), "Chop", "chop");
}

function pickaxe(material: ToolMetal, wood: Wood): ItemShape {
  const g = new THREE.Group();
  const L = 0.78;
  g.add(handle(wood, L));
  const top = L - 0.05;
  const hm = headMat(material);
  // A curved pick: one long point and one chisel end, drooping a little.
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const x = -0.24 + (i / 8) * 0.48;
    pts.push([x, -0.03 * (x / 0.24) ** 2 * 1.6 + 0.024 * (1 - Math.abs(x / 0.24) ** 1.5)]);
  }
  for (let i = 8; i >= 0; i--) {
    const x = -0.24 + (i / 8) * 0.48;
    pts.push([x, -0.03 * (x / 0.24) ** 2 * 1.6 - 0.024 * (1 - Math.abs(x / 0.24) ** 1.5) - 0.002]);
  }
  const head = slab(pts, 0.038, hm, 0.003);
  head.position.set(0, top, 0);
  g.add(head);
  g.add(box(0.055, 0.07, 0.052, metalMat(material, true), 0, top, 0));
  return held(g, new THREE.Vector3(0, 0.1, 0), "Swing", "chop");
}

function shovel(material: ToolMetal, wood: Wood): ItemShape {
  const g = new THREE.Group();
  const bladeH = 0.24;
  // Blade at the bottom, handle going up to a D-grip.
  const shape: [number, number][] = [[-0.09, bladeH], [0.09, bladeH], [0.1, 0.08], [0.06, 0.02], [0, 0], [-0.06, 0.02], [-0.1, 0.08]];
  const blade = slab(shape, 0.012, headMat(material), 0.003);
  blade.rotation.x = -0.12;
  g.add(blade);
  g.add(rod(0.03, 0.022, 0.08, metalMat(material, true), 6, bladeH - 0.02));
  const shaft = rod(0.022, 0.02, 0.72, woodMat(wood), 7, bladeH);
  g.add(shaft);
  // D-grip.
  const top = bladeH + 0.72;
  const d = mesh(new THREE.TorusGeometry(0.055, 0.014, 5, 10, Math.PI), woodMat(wood));
  d.position.y = top;
  g.add(d);
  g.add(box(0.13, 0.025, 0.025, barkMat(wood), 0, top + 0.055, 0));
  // Held by the D-grip at the top; the arm pushes the blade into the ground.
  return held(g, new THREE.Vector3(0, top + 0.03, 0), "Dig", "dig");
}

function fishingRod(wood: Wood): ItemShape {
  const g = new THREE.Group();
  const L = 1.7;
  // Tapered rod made in 3 pieces so it can bend when you cast.
  const pieces: THREE.Group[] = [];
  let parent: THREE.Object3D = g;
  const radii = [0.018, 0.012, 0.008, 0.004];
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    seg.position.y = i === 0 ? 0 : L / 3;
    seg.add(rod(radii[i], radii[i + 1], L / 3, woodMat(wood), 6));
    // A line guide ring on each piece.
    const ring = mesh(new THREE.TorusGeometry(0.012 - i * 0.002, 0.002, 4, 8), metalMat("steel"));
    ring.position.set(0.016 - i * 0.003, L / 3 - 0.06, 0);
    ring.rotation.y = Math.PI / 2;
    seg.add(ring);
    parent.add(seg);
    seg.name = `rod-seg${i}`;
    pieces.push(seg);
    parent = seg;
  }
  // The tip, for anything that needs to hang a line from it (the 3D game's fishing line).
  const tip = new THREE.Object3D();
  tip.name = "rod-tip";
  tip.position.y = L / 3;
  pieces[2].add(tip);
  // Grip and reel.
  g.add(rod(0.026, 0.024, 0.28, barkMat(wood), 7, 0.02));
  const reel = rod(0.035, 0.035, 0.025, metalMat("iron"), 10, -0.012);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.04, 0.33, 0);
  g.add(reel);
  // The line, hanging from the tip, with a red-and-white float.
  const line = rod(0.0015, 0.0015, 0.5, mat(0xf4f1e8), 3, -0.5);
  line.position.set(0, L / 3, 0);
  line.name = "rod-line";
  pieces[2].add(line);
  const bob = new THREE.Group();
  bob.add(ball(0.022, mat(0xd8382c), 0, 0, 0.012, 0), ball(0.021, mat(0xf4f1e8), 0, 0, -0.01, 0));
  bob.position.y = L / 3 - 0.5;
  bob.name = "rod-bob";
  pieces[2].add(bob);
  // As you cast, the tip whips back, then forward.
  const s = held(g, new THREE.Vector3(0, 0.14, 0), "Cast", "cast", (f) => {
    const bend = f < 0.35 ? ease.out(f / 0.35) : f < 0.6 ? 1 - 2 * ease.inOut((f - 0.35) / 0.25) : -1 + ease.inOut((f - 0.6) / 0.4);
    pieces[1].rotation.z = pieces[2].rotation.z = bend * 0.16;
  });
  // The float bobs gently all the time.
  s.tick = (_dt, t) => {
    bob.position.y = L / 3 - 0.5 + Math.sin(t * 2.4) * 0.01;
  };
  s.groundPose = { rz: Math.PI / 2, y: 0.03 };
  return s;
}

function hammer(material: ToolMetal, wood: Wood): ItemShape {
  const g = new THREE.Group();
  const L = 0.42;
  g.add(handle(wood, L, 0.018));
  const top = L - 0.04;
  const head = rod(0.034, 0.034, 0.16, headMat(material), 8, -0.08);
  head.rotation.z = Math.PI / 2;
  head.position.y = top;
  g.add(head);
  // Flat striking face on one end, a wedge on the other.
  const face = rod(0.04, 0.04, 0.02, metalMat(material, true), 8, -0.01);
  face.rotation.z = Math.PI / 2;
  face.position.set(0.085, top, 0);
  g.add(face);
  const wedge = slab([[0, -0.03], [0.05, -0.005], [0.05, 0.005], [0, 0.03]], 0.05, headMat(material));
  wedge.position.set(-0.13, top, 0);
  wedge.rotation.y = Math.PI;
  wedge.position.x = -0.08;
  g.add(wedge);
  return held(g, new THREE.Vector3(0, 0.08, 0), "Strike", "strike");
}

function tongs(material: ToolMetal): ItemShape {
  const object = new THREE.Group();
  const m = headMat(material);
  const arms: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const arm = new THREE.Group();
    // Long handle below the pivot, short curved jaw above it.
    const lower = box(0.016, 0.44, 0.012, m);
    lower.position.set(s * 0.025, -0.22, 0);
    lower.rotation.z = s * 0.06;
    const jaw = slab([[0, 0], [s * 0.035, 0.06], [s * 0.01, 0.13], [-s * 0.005, 0.125], [s * 0.015, 0.06], [-s * 0.01, 0.0]], 0.014, m);
    arm.add(lower, jaw);
    arms.push(arm);
    object.add(arm);
  }
  const pin = rod(0.012, 0.012, 0.04, metalMat(material, true), 8, -0.02);
  pin.rotation.x = Math.PI / 2;
  object.add(pin);
  // A hot little ingot in the jaws.
  const ingot = box(0.05, 0.025, 0.035, glowMat(0xff7a2a, 1.4), 0, 0.12, 0);
  ingot.visible = false;
  object.add(ingot);
  object.position.y = 0.46;
  const root = new THREE.Group();
  root.add(object);
  let anim: ReturnType<typeof tween> | null = null;
  return {
    object: root,
    grip: new THREE.Vector3(0, 0.12, 0),
    groundPose: { rz: Math.PI / 2, y: 0.03 },
    actLabel: "Grab",
    act: () =>
      (anim = tween(1.2, (f) => {
        const close = f < 0.3 ? ease.out(f / 0.3) : f > 0.8 ? 1 - ease.out((f - 0.8) / 0.2) : 1;
        arms[0].rotation.z = 0.12 * (1 - close) - 0.02;
        arms[1].rotation.z = -0.12 * (1 - close) + 0.02;
        ingot.visible = f > 0.15 && f < 0.9;
      })),
    tick: (dt) => {
      if (anim && !anim.step(dt)) anim = null;
      if (!anim) {
        arms[0].rotation.z = 0.12;
        arms[1].rotation.z = -0.12;
      }
    },
  };
}

function pot(material: ToolMetal, rng: Rng): ItemShape {
  const object = new THREE.Group();
  const m = headMat(material).clone();
  m.side = THREE.DoubleSide;
  m.userData.own = true;
  const outline: [number, number][] = [[0, 0], [0.12, 0.005], [0.17, 0.04], [0.18, 0.12], [0.165, 0.2], [0.175, 0.215]];
  const body = lathe(outline, m, 12);
  object.add(body);
  // Soup inside (a dark disc), with bubbles.
  const soup = mesh(new THREE.CircleGeometry(0.16, 12), mat(0xa8622a, { roughness: 0.4 }));
  soup.rotation.x = -Math.PI / 2;
  soup.position.y = 0.17;
  object.add(soup);
  const bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const b = ball(0.012, mat(0xd0884a), 0, (rng() - 0.5) * 0.2, 0.17, (rng() - 0.5) * 0.2);
    bubbles.push(b);
    object.add(b);
  }
  // Two side handles (loops) and three short legs.
  for (const s of [1, -1]) {
    const h = mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 8, Math.PI), metalMat(material, true));
    h.position.set(s * 0.18, 0.17, 0);
    h.rotation.z = -s * Math.PI / 2;
    object.add(h);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = rod(0.016, 0.01, 0.05, metalMat(material, true), 5, -0.04);
    leg.position.set(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
    object.add(leg);
  }
  object.position.y = 0.04;
  const root = new THREE.Group();
  root.add(object);
  let boil = 0;
  return {
    object: root,
    actLabel: "Boil",
    act: () => (boil = 3),
    tick: (dt, t) => {
      boil = Math.max(0, boil - dt);
      const k = boil > 0 ? 1 : 0.25;
      bubbles.forEach((b, i) => {
        const ph = (t * (0.8 + k * 1.6) + i * 0.37) % 1;
        b.position.y = 0.17 + ph * 0.02 * k;
        b.scale.setScalar(0.4 + Math.sin(ph * Math.PI) * (0.6 + k));
      });
      object.position.y = 0.04 + (boil > 0 ? Math.sin(t * 40) * 0.002 : 0);
    },
  };
}

/** Build any tool. Rods ignore the metal; tongs and the pot ignore the wood. */
export function buildTool(type: ToolType, material: ToolMetal, wood: Wood, rng: Rng): ItemShape {
  switch (type) {
    case "axe": return axe(material, wood);
    case "pickaxe": return pickaxe(material, wood);
    case "shovel": return shovel(material, wood);
    case "rod": return fishingRod(wood);
    case "hammer": return hammer(material, wood);
    case "tongs": return tongs(material);
    case "pot": return pot(material, rng);
  }
}
