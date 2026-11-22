// Story and quest items (shared/story.ts STORY_ITEMS) and spell books
// (shared/items.ts BOOKS).
import * as THREE from "three";
import { ItemShape, Rng, ball, between, box, glowMat, mat, mesh, metalMat, rod, rough, slab } from "./kit";

export type QuestKind = "blessing_scroll" | "lantern" | "shrine_totem" | "rooks_note" | "ashbound_note" | "marens_charm" | "holts_notes" | "spell_book";

const PAPER = 0xf2e6c8;

function scroll(): THREE.Group {
  const g = new THREE.Group();
  const paper = rod(0.022, 0.022, 0.2, mat(PAPER, { roughness: 0.9 }), 10, -0.1);
  paper.rotation.z = Math.PI / 2;
  g.add(paper);
  // Wooden end knobs and a gold ribbon with a wax seal.
  for (const s of [1, -1]) {
    const k = rod(0.01, 0.01, 0.03, mat(0x7a5434), 6, -0.015);
    k.rotation.z = Math.PI / 2;
    k.position.x = s * 0.112;
    g.add(k, ball(0.012, mat(0x7a5434), 0, s * 0.13, 0, 0));
  }
  const ribbon = mesh(new THREE.TorusGeometry(0.0235, 0.004, 3, 12), mat(0xe8b84a, { metalness: 0.4, roughness: 0.4 }));
  ribbon.rotation.y = Math.PI / 2;
  g.add(ribbon);
  const seal = rod(0.012, 0.012, 0.006, mat(0xc8a030, { emissive: 0xffd070, emissiveIntensity: 0.25 }), 8, 0);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, 0, 0.026);
  g.add(seal);
  g.position.y = 0.022;
  return g;
}

function lantern(): { g: THREE.Group; light: THREE.PointLight; flame: THREE.Mesh } {
  const g = new THREE.Group();
  const iron = metalMat("iron", true);
  g.add(rod(0.05, 0.05, 0.015, iron, 6, 0));
  // Four corner posts and glass panes glowing warm.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = rod(0.004, 0.004, 0.12, iron, 4, 0.015);
    p.position.set(Math.cos(a) * 0.045, 0, Math.sin(a) * 0.045);
    g.add(p);
  }
  const glass = rod(0.042, 0.042, 0.12, mat(0xffe0a0, { emissive: 0xffb050, emissiveIntensity: 0.6, roughness: 0.3 }), 6, 0.015);
  g.add(glass);
  const roof = mesh(new THREE.ConeGeometry(0.058, 0.05, 6), iron);
  roof.position.y = 0.16;
  g.add(roof);
  const ring = mesh(new THREE.TorusGeometry(0.018, 0.004, 4, 10), iron);
  ring.position.y = 0.2;
  g.add(ring);
  const flame = ball(0.014, glowMat(0xffc060, 3), 1, 0, 0.07, 0);
  flame.scale.y = 1.6;
  g.add(flame);
  const light = new THREE.PointLight(0xffb060, 0.6, 3, 2);
  light.position.y = 0.08;
  g.add(light);
  return { g, light, flame };
}

function totem(rng: Rng): THREE.Group {
  // A carved oak post with a flame on top: the Lightkeeper sign.
  const g = new THREE.Group();
  const oak = mat(0xc79a62);
  const post = mesh(rough(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 6, 3), rng, 0.008), oak);
  post.position.y = 0.11;
  g.add(post);
  // Carved bands and a face.
  for (const y of [0.04, 0.18]) {
    const b = rod(0.052, 0.052, 0.012, mat(0x9a7448), 6, y);
    g.add(b);
  }
  g.add(box(0.012, 0.012, 0.01, mat(0x3a2a1a), -0.017, 0.13, 0.045), box(0.012, 0.012, 0.01, mat(0x3a2a1a), 0.017, 0.13, 0.045));
  g.add(box(0.03, 0.006, 0.01, mat(0x3a2a1a), 0, 0.1, 0.046));
  const flame = slab([[0, 0], [0.03, 0.03], [0.018, 0.06], [0.006, 0.05], [0, 0.08], [-0.006, 0.05], [-0.018, 0.06], [-0.03, 0.03]], 0.02, mat(0xe8b84a, { emissive: 0xffa030, emissiveIntensity: 0.3 }));
  flame.position.y = 0.22;
  g.add(flame);
  return g;
}

function note(sealed: boolean, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  if (sealed) {
    // A neat folded letter with a red wax blob.
    g.add(box(0.14, 0.006, 0.09, mat(PAPER, { roughness: 0.9 }), 0, 0.003, 0));
    const flap = slab([[-0.07, 0], [0.07, 0], [0, -0.04]], 0.002, mat(0xe8dcc0, { roughness: 0.9 }));
    flap.rotation.x = -Math.PI / 2;
    flap.position.set(0, 0.007, -0.045);
    g.add(flap);
    const wax = rod(0.014, 0.012, 0.006, mat(0xa82a2a, { roughness: 0.4 }), 8, 0.006);
    wax.position.z = -0.005;
    g.add(wax);
  } else {
    // A crumpled scrap, scorched at the edge, with black scrawl.
    const paperMat = mat(0xd8c8a0, { roughness: 1 }).clone();
    paperMat.side = THREE.DoubleSide;
    paperMat.userData.own = true;
    const paper = mesh(rough(new THREE.PlaneGeometry(0.13, 0.1, 4, 3), rng, 0.012), paperMat);
    paper.rotation.x = -Math.PI / 2;
    paper.position.y = 0.008;
    g.add(paper);
    for (let i = 0; i < 4; i++) {
      const line = box(between(rng, 0.04, 0.09), 0.001, 0.004, mat(0x1a1410), between(rng, -0.01, 0.01), 0.016, -0.03 + i * 0.018);
      line.rotation.y = between(rng, -0.15, 0.15);
      g.add(line);
    }
    g.add(box(0.03, 0.002, 0.1, mat(0x3a2a1a, { roughness: 1 }), 0.06, 0.01, 0));
  }
  return g;
}

function charm(): THREE.Group {
  // Maren's charm: a small wooden flame worn smooth, on a leather cord.
  const g = new THREE.Group();
  const flame = slab([[0, 0], [0.025, 0.025], [0.015, 0.05], [0.005, 0.04], [0, 0.065], [-0.005, 0.04], [-0.015, 0.05], [-0.025, 0.025]], 0.012, mat(0xb8885a, { roughness: 0.4 }), 0.003);
  flame.rotation.x = -Math.PI / 2;
  flame.position.y = 0.01;
  g.add(flame);
  const cord = mesh(new THREE.TorusGeometry(0.05, 0.0025, 3, 14, Math.PI * 1.5), mat(0x5a3a22));
  cord.rotation.x = -Math.PI / 2;
  cord.position.set(0, 0.003, -0.11);
  g.add(cord);
  return g;
}

function book(cover: number, pages = 0xf2e6c8, clasp = 0xd8b04a, thick = 0.04): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.15, thick, 0.2, mat(cover, { roughness: 0.7 }), 0, thick / 2, 0));
  g.add(box(0.14, thick - 0.01, 0.19, mat(pages), 0.006, thick / 2, 0));
  // Spine and corner caps.
  g.add(box(0.012, thick + 0.004, 0.2, mat(new THREE.Color(cover).multiplyScalar(0.7).getHex()), -0.075, thick / 2, 0));
  for (const z of [-0.09, 0.09]) g.add(box(0.03, thick + 0.004, 0.02, mat(clasp, { metalness: 0.6, roughness: 0.4 }), 0.065, thick / 2, z));
  return g;
}

export const SPELL_BOOKS = [
  { name: "Haste", cover: 0x3a8a4a, rune: 0x9af07a },
  { name: "Invisibility", cover: 0x8a8a9a, rune: 0xeef4ff },
  { name: "Frost nova", cover: 0x2a5ab0, rune: 0x9ae0ff },
];

function spellBook(v: number): { g: THREE.Group; rune: THREE.Mesh } {
  const b = SPELL_BOOKS[v] ?? SPELL_BOOKS[0];
  const g = book(b.cover, PAPER, 0xd8b04a, 0.05);
  // A glowing rune on the cover: a diamond with a dot.
  const runeMat = glowMat(b.rune, 1.2).clone();
  runeMat.userData.own = true; // its own copy, so it can pulse
  const rune = slab([[0, -0.04], [0.03, 0], [0, 0.04], [-0.03, 0]], 0.003, runeMat);
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.052;
  g.add(rune);
  return { g, rune };
}

/** Build a quest item. `variant` picks which spell book. */
export function buildQuest(kind: QuestKind, variant: number, rng: Rng): ItemShape {
  const object = new THREE.Group();
  switch (kind) {
    case "blessing_scroll": object.add(scroll()); break;
    case "lantern": {
      const { g, light, flame } = lantern();
      object.add(g);
      return {
        object,
        tick: (_dt, t) => {
          const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
          light.intensity = 0.6 * f;
          flame.scale.set(f, 1.6 * f, f);
        },
      };
    }
    case "shrine_totem": object.add(totem(rng)); break;
    case "rooks_note": object.add(note(true, rng)); break;
    case "ashbound_note": object.add(note(false, rng)); break;
    case "marens_charm": object.add(charm()); break;
    case "holts_notes": {
      const b = book(0x6a4a2a, PAPER, 0x8a6a4a, 0.025);
      b.scale.setScalar(0.75);
      object.add(b);
      // A pencil on top.
      const pencil = rod(0.004, 0.004, 0.12, mat(0x3a6a3a), 6, -0.06);
      pencil.rotation.z = Math.PI / 2;
      pencil.position.set(0, 0.025, 0.02);
      object.add(pencil);
      break;
    }
    case "spell_book": {
      const { g, rune } = spellBook(variant);
      object.add(g);
      return { object, tick: (_dt, t) => ((rune.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + Math.sin(t * 2) * 0.4) };
    }
  }
  return { object };
}
