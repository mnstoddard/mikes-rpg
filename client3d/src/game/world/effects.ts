// Little effects: floating numbers, celebrations, hits, glowing rings and the hall embers.
// Part of the 3D game (client3d/src/game/world.ts), split out to keep each file to one job.
import * as THREE from "three";
import { TICK_MS, areaAt } from "../../../../shared/map";
import { PLACES } from "../../../../shared/world";
import { SpellId } from "../../../../shared/combat";
import { masteryName } from "../../../../shared/crafting";
import { DISCIPLINES, DisciplineId, SkillId, findSkill } from "../../../../shared/disciplines";
import { MasteryId } from "../../../../shared/mastery";
import { TRAP_BLINK_SECONDS } from "../../../../shared/spells";
import { flashDiscipline, flashMastery, flashSkillRow } from "../../../../client/src/ui";
import { TILE } from "../../environment";
import { tileCenter } from "../terrain";
import { MonsterView, Person, label } from "../actors";
import * as sfx from "../sfx";
import type { World3D } from "../world";

export const effectsMethods = {
  setHallEmbers(this: World3D, on: boolean) {
    if (!on) {
      if (this.hallEmbers) { this.scene.remove(this.hallEmbers); this.hallEmbers.geometry.dispose(); (this.hallEmbers.material as THREE.Material).dispose(); this.hallEmbers = null; }
      return;
    }
    if (this.hallEmbers) return;
    const shrine = PLACES["lighthall.heartShrine"];
    const n = 140, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) seed[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa040, size: 0.16, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false;
    // The great hall: 7 tiles either side of the shrine, from the north wall down to the doors.
    pts.userData = { x0: (shrine.x - 7) * TILE, x1: (shrine.x + 8) * TILE, z0: (shrine.y - 4) * TILE, z1: (shrine.y + 21) * TILE, seed };
    this.scene.add(pts);
    this.hallEmbers = pts;
  },
  updateHallEmbers(this: World3D) {
    const e = this.hallEmbers;
    if (!e) return;
    const { x0, x1, z0, z1, seed } = e.userData as { x0: number; x1: number; z0: number; z1: number; seed: Float32Array };
    const pos = e.geometry.attributes.position as THREE.BufferAttribute;
    const t = this.time;
    for (let i = 0; i < pos.count; i++) {
      const s = seed[i], s2 = (s * 7.31) % 1, s3 = (s * 13.7) % 1;
      // Each one rises slowly from the floor to the roof and starts again, wandering side to side as it goes.
      const life = (t * (0.035 + s3 * 0.03) + s) % 1;
      pos.setXYZ(i,
        x0 + s2 * (x1 - x0) + Math.sin(t * 0.6 + s * 40) * 0.6,
        0.3 + life * 6.5,
        z0 + s3 * (z1 - z0) + Math.cos(t * 0.5 + s * 23) * 0.6);
    }
    pos.needsUpdate = true;
    (e.material as THREE.PointsMaterial).size = 0.14 + 0.04 * Math.sin(t * 3);
  },
  /** A glowing ring and a soft beam of light on each place the quest wants you to walk to. */
  showSpotRings(this: World3D, spots: { x: number; y: number }[]) {
    for (const r of this.spotRings) { this.scene.remove(r); r.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); }
    this.spotRings = spots.map((s) => {
      const g = new THREE.Group();
      g.position.copy(tileCenter(s.x, s.y));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 40), new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 3.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.y = 1.6;
      g.add(ring, beam);
      g.userData.x = s.x; g.userData.y = s.y;
      this.scene.add(g);
      return g;
    });
  },
  updateSpotRings(this: World3D) {
    if (!this.spotRings.length) return;
    const t = performance.now() / 1000;
    for (const g of this.spotRings) {
      const a = this.here ? areaAt(g.userData.x, g.userData.y) === this.here : true;
      g.visible = a;
      const k = 1 + 0.12 * Math.sin(t * 3);
      g.children[0].scale.set(k, k, 1);
    }
  },
  /** A footstep for every tile's length you walk (in any direction), on whatever ground is under you. */
  footsteps(this: World3D, me: Person) {
    const p = me.root.position;
    const d = Math.hypot(p.x - this.lastStepAt.x, p.z - this.lastStepAt.z);
    if (d > TILE * 3) this.lastStepAt.copy(p); // through a door: no step
    else if (d >= TILE * 0.95) {
      this.lastStepAt.copy(p);
      sfx.onStep(Math.floor(p.x / TILE), Math.floor(p.z / TILE));
    }
  },
  // ---------------------------------------------------------------- floating text and effects

  floatText(this: World3D, text: string, color: string, big = false) {
    const me = this.room && this.players.get(this.room.sessionId);
    if (!me) return;
    const l = label("float3d" + (big ? " big" : ""), "");
    l.el.textContent = text;
    l.el.style.color = color;
    const start = me.root.position.clone().setY(2.6);
    l.obj.position.copy(start);
    this.scene.add(l.obj);
    this.effects.push({ obj: l.obj, t: 0, life: big ? 2.5 : 1.4, step: (f) => { l.obj.position.y = start.y + f * (big ? 2.2 : 1.4); l.el.style.opacity = String(1 - f * f); } });
  },
  celebrateLevelUp(this: World3D, discipline: DisciplineId) {
    setTimeout(() => this.floatText(`${DISCIPLINES[discipline].name} level up!`, "#ffd84a", true), 350);
    flashDiscipline(discipline);
    const me = this.room && this.players.get(this.room.sessionId);
    if (!me) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 32), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(me.root.position).setY(0.15);
    this.scene.add(ring);
    this.effects.push({ obj: ring, t: 0, life: 0.9, step: (f) => { ring.scale.setScalar(1 + f * 4); (ring.material as THREE.MeshBasicMaterial).opacity = 1 - f; } });
  },
  celebrateSkill(this: World3D, skill: SkillId, level: number) {
    setTimeout(() => this.floatText(`${findSkill(skill).def.name} level ${level}!`, "#ffd84a", true), 350);
    flashSkillRow(skill);
  },
  celebrateMastery(this: World3D, type: MasteryId, level: number) {
    setTimeout(() => this.floatText(`${masteryName(type)} Mastery ${level}!`, "#7fd0ff"), 700);
    flashMastery(type);
  },
  showHit(this: World3D, h: { on: "monster" | "player"; id: string; damage: number; miss: boolean; spell: SpellId | null; from: string }) {
    const target = h.on === "monster" ? this.monsters.get(h.id) : this.players.get(h.id);
    if (!target || !target.root.visible) return;
    if (h.on === "monster" && !h.miss) (target as MonsterView).hit();
    if (h.on === "player") this.monsters.get(h.from)?.attack();
    const icon = h.spell === "fire_blast" ? "🔥" : h.spell === "frost_bolt" ? "❄️" : h.spell === "sleep" ? "💤" : h.spell === "frost_nova" ? "🌨️" : (h.spell as string) === "poison" ? "☠️" : (h.spell as string) === "lightning" ? "⚡" : "";
    const at = target.root.position.clone().setY(1.4);
    if (icon && !h.miss) {
      const fx = label("splash3d", icon);
      fx.obj.position.copy(at);
      this.scene.add(fx.obj);
      this.effects.push({ obj: fx.obj, t: 0, life: 0.5, step: (f) => { fx.el.style.transform = `scale(${1 + f})`; fx.el.style.opacity = String(1 - f); } });
    }
    if (h.spell === "sleep" && !h.miss) return;
    const t = label("splat3d " + (h.miss ? "miss" : h.on === "player" ? "hurt" : "dmg"), h.miss ? "0" : String(h.damage));
    const start = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, 0));
    t.obj.position.copy(start);
    this.scene.add(t.obj);
    this.effects.push({ obj: t.obj, t: 0, life: 0.9, step: (f) => { t.obj.position.y = start.y + f * 0.9; t.el.style.opacity = String(1 - f * f); } });
  },
  showDeath(this: World3D) {
    const flash = document.getElementById("flash3d");
    if (flash) { flash.classList.remove("on"); void flash.offsetWidth; flash.classList.add("on"); }
    setTimeout(() => this.floatText("You were knocked out!", "#ff7a6a", true), 300);
  },
  updateTrapGlows(this: World3D) {
    const state = this.room?.state;
    if (!state?.monsters) return;
    const tick = state.tick as number;
    const blinkTicks = Math.round(TRAP_BLINK_SECONDS * 1000 / TICK_MS);
    const on = Math.floor(Date.now() / 200) % 2 === 0;
    state.monsters.forEach((m: any, id: string) => {
      const left = m.alive && m.trappedUntil ? m.trappedUntil - tick : 0;
      this.monsters.get(id)?.setTrapped(left > 0 && (left > blinkTicks || on));
    });
  },
};
