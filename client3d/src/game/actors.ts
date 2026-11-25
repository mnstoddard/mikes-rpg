// People, monsters and stations in the 3D world: players (built from their
// character look), Old Maren and the other NPCs, monsters from the monster
// library, and the furnace, anvil, chests and shrines from the item library.
//
// Names, health bars and the ❗ over people float above them as HTML labels
// (CSS2DObject), so they stay crisp at any zoom.
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { TICK_MS } from "../../../shared/map";
import type { NpcDef } from "../../../shared/npcs";
import { RANK_CLOAK } from "../../../shared/story";
import { createCharacter, makeRecipe, type Character, type CharacterRecipe } from "../character";
import { createMonster, MONSTER_BY_ID, type Monster } from "../monsters";
import { createItem, type Item } from "../items";
import { createWeapon } from "../weapons";
import { createFood } from "../food";
import { isWeapon, parseWeapon } from "../../../shared/gear";
import { createEnv, type EnvPiece } from "../environment";
import { tileCenter } from "./terrain";
import { TILE } from "../environment";

/** How far behind the server we show people walking (ms): just enough to always have the next position. */
const GLIDE_MS = 90;
import { lookToRecipe } from "./look";

const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- labels

export function label(className: string, html = ""): { obj: CSS2DObject; el: HTMLDivElement } {
  const el = document.createElement("div");
  el.className = className;
  el.innerHTML = html;
  const obj = new CSS2DObject(el);
  return { obj, el };
}

function healthBar(): { el: HTMLDivElement; set: (hp: number, max: number) => void } {
  const el = document.createElement("div");
  el.className = "hp3d";
  const fill = document.createElement("div");
  el.appendChild(fill);
  return {
    el,
    set(hp, max) {
      el.style.display = !max || hp >= max ? "none" : "block";
      fill.style.width = `${Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100))}%`;
    },
  };
}

// ---------------------------------------------------------------- arm swings

type Move = "chop" | "strike" | "dig" | "cast" | "hold" | "punch";
/** Right shoulder and elbow angles through each move: [time 0-1, shoulder, elbow] (the Items Gallery's swings). */
const ARM: Record<Move, { seconds: number; keys: [number, number, number][] }> = {
  hold: { seconds: 1, keys: [[0, -0.9, -0.6], [1, -0.9, -0.6]] },
  // Bare fists: a quick jab straight forward (the left fist takes turns, see update).
  punch: { seconds: 0.55, keys: [[0, -1.0, -1.9], [0.3, -1.25, -2.1], [0.5, -1.55, -0.15], [0.62, -1.5, -0.2], [1, -1.0, -1.9]] },
  chop: { seconds: 0.95, keys: [[0, -0.9, -0.6], [0.4, -2.9, -1.0], [0.58, -0.35, -0.05], [0.7, -0.4, -0.1], [1, -0.9, -0.6]] },
  strike: { seconds: 0.6, keys: [[0, -0.9, -0.6], [0.35, -1.8, -1.3], [0.55, -0.6, -0.15], [1, -0.9, -0.6]] },
  dig: { seconds: 1.2, keys: [[0, -0.7, -0.1], [0.35, -0.4, 0], [0.5, -0.4, 0], [0.8, -1.3, -0.7], [1, -0.7, -0.1]] },
  cast: { seconds: 1.2, keys: [[0, -1.0, -0.5], [0.35, -2.9, -0.7], [0.6, -1.0, -0.1], [1, -1.0, -0.5]] },
};
function armAngles(move: Move, f: number): [number, number] {
  const keys = ARM[move].keys;
  let i = 0;
  while (i < keys.length - 2 && f > keys[i + 1][0]) i++;
  const [t0, s0, e0] = keys[i];
  const [t1, s1, e1] = keys[i + 1];
  const k = Math.min(1, Math.max(0, (f - t0) / Math.max(1e-6, t1 - t0)));
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  return [s0 + (s1 - s0) * e, e0 + (e1 - e0) * e];
}

/** What a player holds and how they move for each action the server reports. */
const ACTIONS: Record<string, { tool?: string; weapon?: boolean; move: Move; hits?: boolean }> = {
  chopping: { tool: "axe", move: "chop", hits: true },
  mining: { tool: "pickaxe", move: "chop", hits: true },
  digging: { tool: "shovel", move: "dig" },
  farming: { tool: "shovel", move: "dig" },
  fishing: { tool: "rod", move: "hold" },
  smithing: { tool: "hammer", move: "strike" },
  smelting: { tool: "tongs", move: "strike" },
  cooking: { move: "strike" },
  fighting: { weapon: true, move: "strike" },
};

// ---------------------------------------------------------------- people (players and NPCs)

export class Person {
  readonly root = new THREE.Group();
  hero: Character;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private t = 1;
  private dur = TICK_MS / 1000;
  private yaw = 0;
  private wantYaw = 0;
  /** Positions from the server (smooth movement), shown a moment late so we can glide between them. */
  private snaps: { t: number; x: number; z: number }[] = [];
  private glidingUntil = 0;
  action = "idle";
  private face = new THREE.Vector3();
  private held?: { obj: THREE.Object3D; dispose: () => void };
  private swingT = 0;
  private bobber?: { group: THREE.Group; line: THREE.Line };
  readonly name: { obj: CSS2DObject; el: HTMLDivElement };
  readonly title: HTMLDivElement;
  readonly bar = healthBar();
  readonly alert?: { obj: CSS2DObject; el: HTMLDivElement };
  private cloak?: THREE.Mesh;
  /** Called at the moment a chop or pick lands (to shake the tree or rock). */
  onHit?: (x: number, y: number) => void;
  /** Called as the arm starts down ("swing") and as it lands ("hit"), for sound effects. */
  onBeat?: (phase: "swing" | "hit", action: string) => void;
  private faceTile = { x: 0, y: 0 };
  private recipeText = "";
  /** The weapon in their hand ("" = bare fists). */
  private weapon = "";
  /** Running (they move faster and the legs go quicker). */
  running = false;
  /** A fish being pulled out of the water (fishing). */
  private catching?: { fish: THREE.Object3D; t: number; from: THREE.Vector3; dispose: () => void };
  private rodTip?: THREE.Object3D;
  private rodSegs: THREE.Object3D[] = [];

  constructor(recipe: CharacterRecipe, opts: { name: string; me?: boolean; npc?: boolean; badge?: string }) {
    this.hero = createCharacter(recipe);
    this.prepHero();
    this.root.add(this.hero.object);
    this.name = label("name3d" + (opts.me ? " me" : "") + (opts.npc ? " npc" : ""));
    this.title = document.createElement("div");
    this.title.className = "title3d";
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = opts.name + (opts.badge ? ` ${opts.badge}` : "");
    this.name.el.append(this.title, nm, this.bar.el);
    this.name.obj.position.y = this.hero.fit ? 2.25 : 2.2;
    this.root.add(this.name.obj);
    this.bar.set(1, 1);
    if (opts.npc) {
      this.alert = label("alert3d", "❗");
      this.alert.obj.position.y = 2.9;
      this.alert.obj.visible = false;
      this.root.add(this.alert.obj);
    }
  }

  private prepHero() {
    this.hero.object.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.hero.setAnim("idle");
  }

  setName(name: string) { (this.name.el.querySelector(".nm") as HTMLElement).textContent = name; }
  setTitle(t: string) { this.title.textContent = t ? `« ${t} »` : ""; }
  setNameColor(color: string | null) { (this.name.el.querySelector(".nm") as HTMLElement).style.color = color ?? ""; }

  /** Rebuild the body from a new look (the character creator). */
  setLook(recipe: CharacterRecipe) {
    const text = JSON.stringify(recipe);
    if (text === this.recipeText) return;
    this.recipeText = text;
    this.dropHeld();
    this.root.remove(this.hero.object);
    this.hero.dispose();
    this.hero = createCharacter(recipe);
    this.prepHero();
    this.root.add(this.hero.object);
    const a = this.action;
    this.action = "";
    this.setAction(a, this.faceTile.x, this.faceTile.y);
  }

  /** An Emberguard's cloak (Ember orange, Flame gold) on the back. */
  setRank(rank: number) {
    const col = RANK_CLOAK[rank] ?? 0;
    if (this.cloak) { this.cloak.parent?.remove(this.cloak); this.cloak.geometry.dispose(); this.cloak = undefined; }
    if (!col) return;
    const g = new THREE.ConeGeometry(0.42, 1.15, 5, 1, true, Math.PI * 0.6, Math.PI * 0.8);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, side: THREE.DoubleSide }));
    m.position.set(0, -0.45, -0.12);
    m.castShadow = true;
    this.hero.joints.spine.add(m);
    this.cloak = m;
  }

  /** Stand on a tile straight away. */
  place(x: number, y: number) {
    this.snaps = [];
    this.to.copy(tileCenter(x, y));
    this.from.copy(this.to);
    this.t = 1;
    this.root.position.copy(this.to);
  }

  /** Walk to a tile over one step (stepMs). Far jumps (doors, waking up) snap. */
  walkTo(x: number, y: number, stepMs = TICK_MS) {
    const dest = tileCenter(x, y);
    if (dest.distanceTo(this.root.position) > 4.5) { this.place(x, y); return; }
    this.from.copy(this.root.position);
    this.to.copy(dest);
    this.t = 0;
    this.dur = Math.max(0.1, stepMs / 1000);
    const d = this.to.clone().sub(this.from);
    if (d.lengthSq() > 0.01) this.wantYaw = Math.atan2(d.x, d.z);
  }

  get moving() { return this.t < 1 || performance.now() < this.glidingUntil; }

  /**
   * Smooth movement: where the server says they are now (in tiles, with
   * fractions). Updates come about 20 times a second; we show them GLIDE_MS
   * late and slide evenly between them, so walking never looks jumpy.
   */
  glide(fx: number, fy: number) {
    const now = performance.now();
    const x = fx * TILE, z = fy * TILE;
    const last = this.snaps[this.snaps.length - 1];
    if (Math.hypot(x - this.root.position.x, z - this.root.position.z) > TILE * 3) {
      // A far jump (a door, waking up): just be there.
      this.snaps = [{ t: now, x, z }];
      this.root.position.set(x, this.root.position.y, z);
      this.t = 1;
      return;
    }
    if (last && now - last.t < 8) { last.x = x; last.z = z; return; } // the other half of the same update
    // Setting off after standing still: start from where we stand, one update ago.
    if (!last || now - last.t > 150) this.snaps = [{ t: now - 50, x: this.root.position.x, z: this.root.position.z }];
    this.snaps.push({ t: now, x, z });
    if (this.snaps.length > 30) this.snaps.splice(0, this.snaps.length - 30);
    this.t = 1;
  }

  /** Each frame: where to stand between the last two updates from the server. */
  private updateGlide() {
    const s = this.snaps;
    if (!s.length) return;
    const now = performance.now();
    const rt = now - GLIDE_MS;
    while (s.length >= 2 && s[1].t <= rt) s.shift();
    const a = s[0], b = s[1];
    let x = a.x, z = a.z;
    if (b && rt > a.t) {
      const k = Math.min(1, (rt - a.t) / Math.max(1, b.t - a.t));
      x = a.x + (b.x - a.x) * k;
      z = a.z + (b.z - a.z) * k;
    }
    const dx = x - this.root.position.x, dz = z - this.root.position.z;
    if (dx * dx + dz * dz > 1e-6) {
      this.wantYaw = Math.atan2(dx, dz);
      this.glidingUntil = now + 90;
    }
    this.root.position.x = x;
    this.root.position.z = z;
  }

  /** The weapon they hold now (item id, or "" for fists). Shows next time they fight. */
  setWeapon(item: string) {
    if (item === this.weapon) return;
    this.weapon = item;
    if (this.action === "fighting") { const a = this.action; this.action = ""; this.setAction(a, this.faceTile.x, this.faceTile.y); }
  }

  /** A fish bites: the rod bends hard and they pull it up out of the water, into their hand. */
  catchFish(item: string) {
    if (this.action !== "fishing" || !this.bobber) return;
    this.catching?.dispose();
    let fish: THREE.Object3D;
    let dispose: () => void;
    try {
      const f = createFood(`fish-${item}`, { seed: 2 });
      fish = f.object;
      dispose = () => { fish.parent?.remove(fish); f.dispose(); };
    } catch {
      fish = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshStandardMaterial({ color: 0xc0c8d0 }));
      dispose = () => { fish.parent?.remove(fish); (fish as THREE.Mesh).geometry.dispose(); };
    }
    // Fish models are life size; make sure even a minnow shows.
    const b = new THREE.Box3().setFromObject(fish);
    const len = Math.max(0.05, b.max.x - b.min.x, b.max.z - b.min.z);
    fish.scale.setScalar(Math.max(1, 0.35 / len));
    fish.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.root.parent?.add(fish);
    this.catching = { fish, t: 0, from: this.bobber.group.position.clone(), dispose };
  }

  setAction(action: string, faceX: number, faceY: number) {
    this.faceTile = { x: faceX, y: faceY };
    if (action === this.action) return;
    this.action = action;
    this.dropHeld();
    this.swingT = 0;
    const a = ACTIONS[action];
    if (!a) return;
    this.face.copy(tileCenter(faceX, faceY));
    const d = this.face.clone().sub(this.root.position);
    if (d.lengthSq() > 0.01) this.wantYaw = Math.atan2(d.x, d.z);
    if (a.weapon && isWeapon(this.weapon)) {
      // What they really hold (a dagger, a sword, a staff...).
      const { type, metal, wood } = parseWeapon(this.weapon);
      const w = createWeapon(type, { metal, wood } as never);
      const mount = new THREE.Group();
      mount.rotation.x = Math.PI / 2;
      const inner = new THREE.Group();
      inner.rotation.y = Math.PI / 2;
      inner.add(w.held ?? w.object);
      mount.add(inner);
      this.hero.joints.handR.add(mount);
      this.held = { obj: mount, dispose: () => { mount.parent?.remove(mount); mount.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); } };
    } else if (a.tool) {
      const item: Item = createItem(a.tool, { seed: 7 });
      const holder = new THREE.Group();
      holder.add(item.object);
      if (item.heldMove === "dig") holder.quaternion.identity();
      else holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
      holder.position.copy(item.grip ?? new THREE.Vector3()).applyQuaternion(holder.quaternion).multiplyScalar(-1);
      this.hero.joints.handR.add(holder);
      holder.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      this.held = { obj: holder, dispose: () => { holder.parent?.remove(holder); item.dispose(); } };
      if (action === "fishing") {
        // The line hangs from the rod's real tip (not from somewhere above the hand).
        this.rodTip = item.object.getObjectByName("rod-tip") ?? undefined;
        this.rodSegs = [item.object.getObjectByName("rod-seg1"), item.object.getObjectByName("rod-seg2")].filter((o): o is THREE.Object3D => !!o);
        for (const n of ["rod-line", "rod-bob"]) { const o = item.object.getObjectByName(n); if (o) o.visible = false; }
      }
    }
    if (action === "fishing") {
      const group = new THREE.Group();
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3b3b }));
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      top.position.y = 0.02;
      group.add(bob, top);
      group.position.copy(this.face).setY(-0.1);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
      line.frustumCulled = false;
      this.root.parent?.add(group, line);
      this.bobber = { group, line };
    }
  }

  private dropHeld() {
    this.held?.dispose();
    this.held = undefined;
    this.rodTip = undefined;
    this.rodSegs = [];
    this.catching?.dispose();
    this.catching = undefined;
    if (this.bobber) {
      this.bobber.group.parent?.remove(this.bobber.group);
      this.bobber.line.parent?.remove(this.bobber.line);
      this.bobber.line.geometry.dispose();
      this.bobber = undefined;
    }
  }

  update(dt: number, time: number) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.dur);
      this.root.position.lerpVectors(this.from, this.to, this.t);
    } else this.updateGlide();
    // Turn smoothly toward where we're going.
    let dy = this.wantYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 12);
    this.hero.object.rotation.y = this.yaw;
    const walking = this.moving;
    this.hero.setAnim(walking ? (this.running ? "run" : "walk") : "idle");
    this.hero.update(dt, time);
    const fists = this.action === "fighting" && !isWeapon(this.weapon);
    const a = fists ? { move: "punch" as Move, hits: false } : ACTIONS[this.action];
    if (a && !walking) {
      const secs = Math.max(ARM[a.move].seconds, a.hits ? TICK_MS / 1000 * 1.5 : 0);
      const before = this.swingT;
      this.swingT = (this.swingT + dt / secs) % 1;
      const [sh, el] = armAngles(a.move, this.swingT);
      const J = this.hero.joints;
      J.shoulderR.rotation.set(sh, 0, -0.2);
      J.elbowR.rotation.set(el, 0, 0);
      if (fists) {
        // Fists up, guarding; the left jabs half a beat after the right.
        const [sl, elL] = armAngles("punch", (this.swingT + 0.5) % 1);
        J.shoulderL.rotation.set(sl, 0, 0.2);
        J.elbowL.rotation.set(elL, 0, 0);
      }
      if (a.hits && before < 0.55 && this.swingT >= 0.55) this.onHit?.(this.faceTile.x, this.faceTile.y);
      if (before < 0.42 && this.swingT >= 0.42) this.onBeat?.("swing", this.action);
      if (before < 0.55 && this.swingT >= 0.55) this.onBeat?.("hit", this.action);
    }
    if (this.bobber) {
      const b = this.bobber.group;
      b.position.y = -0.1 + Math.sin(time * 3) * 0.03;
      // A fish on the line: the float dips, the rod bends hard, then the fish comes up out of the water to you.
      let bend = 0;
      const c = this.catching;
      if (c) {
        c.t += dt;
        const T = 1.3;
        const f = Math.min(1, c.t / T);
        bend = f < 0.35 ? f / 0.35 : f < 0.75 ? 1 : 1 - (f - 0.75) / 0.25;
        if (f < 0.35) { b.position.y = -0.1 - 0.12 * (f / 0.35); c.fish.visible = false; }
        else {
          // Up out of the water in an arc, wriggling, toward the hand.
          const k = Math.min(1, (f - 0.35) / 0.55);
          const hand = new THREE.Vector3();
          this.hero.joints.handR.getWorldPosition(hand);
          c.fish.visible = true;
          c.fish.position.lerpVectors(c.from, hand, k);
          c.fish.position.y += Math.sin(k * Math.PI) * 1.4;
          c.fish.rotation.set(Math.sin(time * 30) * 0.4, k * 3, Math.PI / 2 * (1 - k));
          b.position.lerpVectors(c.from, hand, k * 0.95);
        }
        if (f >= 1) { c.dispose(); this.catching = undefined; b.position.copy(c.from); }
      }
      this.rodSegs.forEach((sg) => { sg.rotation.z = bend * 0.45; });
      const tip = new THREE.Vector3();
      if (this.rodTip) this.rodTip.getWorldPosition(tip);
      else { this.hero.joints.handR.getWorldPosition(tip); tip.y += 1.2; }
      const pos = this.bobber.line.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, tip.x, tip.y, tip.z);
      pos.setXYZ(1, b.position.x, b.position.y + 0.05, b.position.z);
      pos.needsUpdate = true;
    }
  }

  setFaded(alpha: number) {
    this.hero.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) { mat.transparent = alpha < 1; mat.opacity = alpha; }
    });
    this.name.obj.visible = alpha > 0.2;
  }

  dispose() {
    this.dropHeld();
    this.root.parent?.remove(this.root);
    this.name.obj.element.remove();
    this.alert?.obj.element.remove();
    this.hero.dispose();
  }
}

/** A player's character: their saved look, or one made up from their name until they make their own. */
export function playerRecipe(look: string, name: string, color: number): CharacterRecipe {
  if (look) {
    const r = lookToRecipe(look);
    if (r) return r;
  }
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hair = ["short", "messy", "ponytail", "bob", "spiky", "long", "bun", "quiff"] as const;
  const hairColors = ["#5e3a1f", "#1b1613", "#8b5b2c", "#d9782b", "#f2e4b8", "#3b2a20"];
  const skins = ["#e9b48a", "#f6cfae", "#b97b4c", "#714528", "#d9a07a"];
  return makeRecipe({
    name,
    frame: h % 2 ? 1 : 0,
    hairStyle: hair[h % hair.length],
    hairColor: hairColors[(h >> 3) % hairColors.length],
    skin: skins[(h >> 6) % skins.length],
    lashes: h % 2 ? "on" : "off",
    shirtColor: "#" + color.toString(16).padStart(6, "0"),
  });
}

// ---------------------------------------------------------------- NPC looks

/** Each NPC as a Character Workshop recipe. */
const NPC_LOOKS: Record<string, Partial<CharacterRecipe>> = {
  maren: { frame: 1, height: 0.94, hairStyle: "bun", hairColor: "#d9d4c7", skin: "#e2a982", top: "long", bottom: "skirt", shirtColor: "#2e86c1", pantsColor: "#5c4636", hat: "none", mouth: "smile", eyeStyle: "sleepy", lashes: "on" },
  bryn: { frame: 0, height: 1.05, build: 0.5, muscle: 0.8, hairStyle: "buzz", hairColor: "#3b2a20", beard: "stubble", top: "tunic", shirtColor: "#7f8c8d", pantsColor: "#3b3f44", belt: "on" },
  tam: { frame: 0, build: 0.6, hairStyle: "short", hairColor: "#1b1613", beard: "mustache", top: "tunic", shirtColor: "#8e44ad", pantsColor: "#5c4636" },
  holt: { frame: 0, build: 0.55, muscle: 0.7, hairStyle: "messy", hairColor: "#6b4a2b", beard: "full", top: "long", shirtColor: "#27ae60", pantsColor: "#5c4636" },
  greta: { frame: 1, muscle: 0.6, hairStyle: "ponytail", hairColor: "#b2501f", top: "tank", shirtColor: "#95a5a6", pantsColor: "#3b3f44", lashes: "on" },
  brann: { frame: 0, height: 1.02, build: 0.65, muscle: 0.95, shoulders: 1.15, skin: "#b97b4c", hairStyle: "buzz", hairColor: "#1b1613", beard: "full", top: "tank", shirtColor: "#c0392b", pantsColor: "#3b3f44" },
  odo: { frame: 0, build: 0.7, hairStyle: "messy", hairColor: "#c8a060", beard: "stubble", top: "tshirt", shirtColor: "#7a8c3a", pantsColor: "#3a6ea5", hat: "headband" },
  rook: { frame: 0, hairStyle: "quiff", hairColor: "#5e3a1f", top: "tunic", shirtColor: "#a0522d", pantsColor: "#5c4636", glasses: "round" },
  kael: { frame: 0, muscle: 0.8, hairStyle: "long", hairColor: "#1b1613", beard: "goatee", top: "long", shirtColor: "#6e2c00", pantsColor: "#3a2517", ears: "pointy" },
  wren: { frame: 1, hairStyle: "pigtails", hairColor: "#8b5b2c", top: "tunic", bottom: "skirt", shirtColor: "#3d8b37", pantsColor: "#5c4636", lashes: "on", blush: "on" },
  archmage: { frame: 1, height: 1.05, hairStyle: "long", hairColor: "#efefef", top: "robe", bottom: "skirt", hat: "wizard", shirtColor: "#5b2c9f", pantsColor: "#5b2c9f", accentColor: "#e8c547", lashes: "on" },
  moss: { frame: 0, hairStyle: "messy", hairColor: "#3a5a2a", top: "robe", shirtColor: "#1e8449", pantsColor: "#1e8449", glasses: "square" },
  repairer: { frame: 0, build: 0.6, hairStyle: "bald", beard: "full", hairColor: "#9a9a9a", top: "tunic", shirtColor: "#7d6608", pantsColor: "#3b3f44" },
  aldric: { frame: 0, height: 1.04, hairStyle: "short", hairColor: "#d9d4c7", beard: "wizard", top: "robe", shirtColor: "#f4e3b0", pantsColor: "#f4e3b0", accentColor: "#d4a640" },
  celene: { frame: 1, hairStyle: "long", hairColor: "#f2e4b8", top: "robe", bottom: "skirt", shirtColor: "#fdfdfd", pantsColor: "#fdfdfd", accentColor: "#d4a640", lashes: "on" },
  vale: { frame: 0.6, hairStyle: "bob", hairColor: "#2a1f3a", top: "robe", shirtColor: "#3b2a6a", pantsColor: "#3b2a6a", accentColor: "#bfe8ff" },
  oren: { frame: 0, hairStyle: "buzz", hairColor: "#5e3a1f", top: "robe", shirtColor: "#eadcb5", pantsColor: "#eadcb5", accentColor: "#d4a640" },
  lisette: { frame: 1, hairStyle: "bun", hairColor: "#5e3a1f", top: "robe", bottom: "skirt", shirtColor: "#eadcb5", pantsColor: "#eadcb5", glasses: "round", lashes: "on" },
  tomas: { frame: 0, hairStyle: "short", hairColor: "#1b1613", beard: "stubble", top: "robe", shirtColor: "#eadcb5", pantsColor: "#eadcb5" },
  wynne: { frame: 1, hairStyle: "ponytail", hairColor: "#d9782b", top: "robe", bottom: "skirt", shirtColor: "#eadcb5", pantsColor: "#eadcb5", lashes: "on" },
  rhys: { frame: 0, height: 0.95, hairStyle: "spiky", hairColor: "#d9782b", top: "tshirt", shirtColor: "#e67e22", pantsColor: "#3a6ea5" },
};

export function npcRecipe(npc: NpcDef): CharacterRecipe {
  return makeRecipe({ name: npc.name, shirtColor: "#" + npc.color.toString(16).padStart(6, "0"), ...(NPC_LOOKS[npc.id] ?? {}) });
}

// ---------------------------------------------------------------- monsters

export class MonsterView {
  readonly root = new THREE.Group();
  readonly m: Monster;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private t = 1;
  private yaw = 0;
  readonly bar = healthBar();
  readonly tag: { obj: CSS2DObject; el: HTMLDivElement };
  private glow: THREE.Mesh;
  private status: HTMLSpanElement;
  private dyingT = -1;
  alive = true;

  constructor(kind: string, seed: number, name: string, aggressive: boolean) {
    const id = MONSTER_BY_ID[kind] ? kind : "slime";
    this.m = createMonster(id, { variant: 0, seed });
    this.m.object.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.root.add(this.m.object);
    this.m.play("idle");
    this.tag = label("name3d mon" + (aggressive ? " danger" : ""));
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = aggressive ? name : "";
    this.status = document.createElement("span");
    this.status.className = "st";
    this.tag.el.append(nm, this.status, this.bar.el);
    this.tag.obj.position.y = Math.max(0.9, this.m.height + 0.4);
    this.root.add(this.tag.obj);
    this.bar.set(1, 1);
    // Ember trap's purple glow.
    this.glow = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 24), new THREE.MeshBasicMaterial({ color: 0xc39bff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.05;
    this.glow.visible = false;
    this.root.add(this.glow);
  }

  place(x: number, y: number) { this.to.copy(tileCenter(x, y)); this.from.copy(this.to); this.t = 1; this.root.position.copy(this.to); }

  walkTo(x: number, y: number) {
    const dest = tileCenter(x, y);
    if (!this.root.visible || dest.distanceTo(this.root.position) > 4.5) { this.place(x, y); return; }
    this.from.copy(this.root.position);
    this.to.copy(dest);
    this.t = 0;
    const d = this.to.clone().sub(this.from);
    if (d.lengthSq() > 0.01) this.yaw = Math.atan2(d.x, d.z);
  }

  setStatus(st: string) { this.status.textContent = st === "asleep" ? "💤" : st === "frozen" ? "❄️" : ""; }
  setTrapped(on: boolean) { this.glow.visible = on; }
  hit() { if (this.alive) this.m.play("hit"); }
  attack() { if (this.alive) this.m.play("attack"); }

  setAlive(alive: boolean) {
    if (alive === this.alive) return;
    this.alive = alive;
    if (!alive) { this.m.play("death"); this.dyingT = 0; this.tag.obj.visible = false; }
    else { this.root.userData.show = true; this.tag.obj.visible = true; this.dyingT = -1; this.m.play("idle"); this.root.scale.setScalar(1); }
  }

  update(dt: number, time: number) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / (TICK_MS / 1000));
      this.root.position.lerpVectors(this.from, this.to, this.t);
      if (this.m.anim === "idle") this.m.play("walk");
    } else if (this.m.anim === "walk") this.m.play("idle");
    let d = this.yaw - this.m.object.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.m.object.rotation.y += d * Math.min(1, dt * 10);
    if (this.dyingT >= 0) {
      this.dyingT += dt;
      if (this.dyingT > 1.1) this.root.userData.show = false;
    }
    this.m.update(dt, time);
    if (this.glow.visible) this.glow.rotation.z = time;
  }

  dispose() {
    this.root.parent?.remove(this.root);
    this.tag.obj.element.remove();
    this.m.dispose();
  }
}

// ---------------------------------------------------------------- stations

const PROP_FOR: Record<string, string> = {
  stove: "stove", furnace: "furnace", anvil: "anvil", workbench: "workbench", spinning_wheel: "spinning_wheel",
  tanning_rack: "tanning_rack", alchemy_table: "alchemy_table", altar: "altar", board: "guild_board", guildboard: "guild_board",
};

export interface StationView {
  root: THREE.Group;
  update(dt: number, time: number, night: number): void;
  setLit?(lit: boolean): void;
  dispose(): void;
  alert?: { obj: CSS2DObject; el: HTMLDivElement };
}

export function makeStation(npc: NpcDef): StationView {
  const root = new THREE.Group();
  root.position.copy(tileCenter(npc.x, npc.y));
  root.userData.tile = { x: npc.x, y: npc.y };
  const tag = label("name3d station", `<span class="nm">${npc.name}</span>`);
  root.add(tag.obj);
  const parts: { update: (dt: number, t: number, night: number) => void; dispose: () => void }[] = [];
  let setLit: ((lit: boolean) => void) | undefined;
  const prop = PROP_FOR[npc.id] ?? (npc.id.startsWith("chest") ? "chest" : null);
  if (prop) {
    const item = createItem(prop, { seed: 3 });
    // Stations face south, toward the camera.
    root.add(item.object);
    parts.push({ update: (dt, t) => item.update(dt, t), dispose: () => item.dispose() });
    const box = new THREE.Box3().setFromObject(item.object);
    tag.obj.position.y = box.max.y + 0.4;
  } else if (npc.id.startsWith("radiant_")) {
    // The Radiants' statues are part of the hall already: just their name.
    tag.obj.position.y = 3.4;
  } else if (npc.id.startsWith("lantern_") || npc.id.startsWith("round_")) {
    const lamp: EnvPiece = createEnv("decor-lamp", { variant: npc.id.startsWith("round_") ? 0 : 1, seed: 4 });
    root.add(lamp.object);
    let lit = false;
    setLit = (l) => { lit = l; };
    parts.push({ update: (dt, t) => lamp.update(dt, t, { night: lit ? 1 : 0, wind: 0.2 }), dispose: () => lamp.dispose() });
    tag.obj.position.y = 3.6;
  } else {
    // Shrines and the plinth: white stone, with a golden crystal when lit.
    const stone = new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.7 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.5, 8), stone);
    base.position.y = 0.25;
    root.add(base);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffd84a, emissiveIntensity: 1.4, flatShading: true }));
    crystal.scale.y = 1.8;
    crystal.position.y = 1.6;
    const light = new THREE.PointLight(0xffe27a, npc.id === "heart_shrine" ? 3 : 2, 9, 1.6);
    light.position.y = 1.6;
    const rubble = createEnv("decor-rocks", { variant: 0, seed: 9 });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 8), stone);
    pillar.position.y = 0.9;
    if (npc.id === "plinth") {
      root.add(pillar);
    } else {
      root.add(crystal, light);
      if (npc.id !== "heart_shrine") {
        root.add(pillar, rubble.object);
        setLit = (lit) => { crystal.visible = light.visible = pillar.visible = lit; base.visible = lit; rubble.object.visible = !lit; };
        setLit(false);
      } else root.add(pillar);
    }
    parts.push({ update: (_dt, t) => { crystal.rotation.y = t * 0.6; crystal.position.y = 1.6 + Math.sin(t * 1.5) * 0.08; }, dispose: () => rubble.dispose() });
    tag.obj.position.y = 3;
  }
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // A ❗ over it when your quest wants you here.
  const alert = label("alert3d", "❗");
  alert.obj.position.y = tag.obj.position.y + 0.5;
  alert.obj.visible = false;
  root.add(alert.obj);
  return {
    root,
    alert,
    update: (dt, t, night) => parts.forEach((p) => p.update(dt, t, night)),
    setLit,
    dispose: () => { tag.obj.element.remove(); alert.obj.element.remove(); parts.forEach((p) => p.dispose()); },
  };
}

export { UP };
