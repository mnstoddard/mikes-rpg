// The story on screen: the opening scene, guided tours, areas, books and shelves.
// Part of the 3D game (client3d/src/game/world.ts), split out to keep each file to one job.
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { AreaDef, TICK_MS, areaAt, isWalkable } from "../../../../shared/map";
import { PLACES } from "../../../../shared/world";
import { bookAt } from "../../../../shared/lore";
import { NPCS, npcAt } from "../../../../shared/npcs";
import type { QuestView } from "../../../../shared/quests";
import { LOTS } from "../../../../shared/farming";
import { crumb } from "../../../../client/src/crash";
import { openDialog, showMessage } from "../../../../client/src/ui";
import { TILE } from "../../environment";
import { tileUp } from "../terrain";
import { Person, label } from "../actors";
import { INTRO_TALK } from "./common";
import type { World3D } from "../world";

export const storyMethods = {
  // ---------------------------------------------------------------- the opening scene

  /** A new character's first moments: wait for the character maker to close, then play the scene. */
  startIntro(this: World3D, name: string, lines: string[]) {
    if (this.intro) return;
    this.intro = { t: -1, name, lines, talked: false, cam: { yaw: this.yaw, pitch: this.pitch, dist: this.dist } };
  },
  updateIntro(this: World3D, dt: number, me: Person | undefined) {
    const it = this.intro;
    if (!it || !me) return;
    const celene = this.npcs.get("celene");
    const home = NPCS.find((n) => n.id === "celene")!;
    const wake = { x: Math.floor(me.root.position.x / TILE), y: Math.floor(me.root.position.z / TILE) };
    // Lying still while the character maker is open.
    if (it.t < 0) {
      me.stage = 0;
      me.faceYaw(0, true);
      // (A brand-new character makes their look first: the character maker opens a moment after logging in.)
      const mine = this.room?.state.players.get(this.room.sessionId);
      it.wait = (it.wait ?? 0) + dt;
      if (document.getElementById("creator") || (!mine?.look && it.wait < 3)) return;
      it.t = 0;
      document.body.classList.add("intro-on"); // the messages and quest box would give the scene away
      // A wide shot of the Heart Shrine first.
      this.yaw = 0.2; this.pitch = 0.85; this.dist = 24;
      const skip = document.createElement("button");
      skip.id = "intro-skip";
      skip.className = "shop-btn";
      skip.textContent = "Skip ▸";
      skip.onclick = () => { if (this.intro) this.intro.t = Math.max(this.intro.t, INTRO_TALK); };
      document.body.append(skip);
      it.skip = skip;
      // Lots of embers: they burst out of the shrine's flame, then circle the place the new hero will be.
      const n = 240, pos = new Float32Array(n * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      it.sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb048, size: 0.3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      it.sparks.frustumCulled = false;
      this.scene.add(it.sparks);
      me.setFaded(0);
      me.setGlow(1);
    }
    const before = it.t;
    it.t += dt;
    const t = it.t;
    const passed = (s: number) => before < s && t >= s;
    const ramp = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    const ease = (k: number) => k * k * (3 - 2 * k);
    // The camera comes slowly down from the wide shot to you.
    if (t < INTRO_TALK) {
      const k = ease(ramp(1.5, 8.5));
      this.dist = 24 + (10 - 24) * k; this.pitch = 0.85 + (0.55 - 0.85) * k; this.yaw = 0.2 + (0.35 - 0.2) * k;
    }
    // 0.4 - 2.4 s: the embers burst out of the flame and fly wide. 2.4 - 3.8 s: they gather into a ring round you.
    // Then they circle, faster and tighter, and fade away by about 6 s.
    if (it.sparks) {
      const shrine = NPCS.find((n) => n.id === "heart_shrine")!;
      const sx = (shrine.x + 0.5) * TILE, sz = (shrine.y + 0.5) * TILE;
      const wx = me.root.position.x, wz = me.root.position.z;
      const pos = it.sparks.geometry.attributes.position as THREE.BufferAttribute;
      const burst = ease(ramp(0.4, 2.4)), gather = ease(ramp(2.4, 3.8));
      for (let i = 0; i < pos.count; i++) {
        const h1 = (i * 0.6180339) % 1, h2 = (i * 0.4142135) % 1, h3 = (i * 0.7320508) % 1;
        // Out of the flame: up, then out and down in an arc.
        const ang = h1 * Math.PI * 2, far = 2.5 + h2 * 4.5;
        const bx = sx + Math.cos(ang) * far * burst, bz = sz + Math.sin(ang) * far * burst * 0.8;
        const by = 2.2 + Math.sin(burst * Math.PI) * (1.5 + h3 * 2.5) + burst * (h3 * 1.2 - 0.6);
        // Into the ring: round and round where you lie.
        const spin = t * (1.6 + h2 * 1.2) * (1 + ramp(3.8, 5.8)) + ang;
        const r = (1.15 + h3 * 0.5) * (1 - 0.45 * ramp(3.8, 5.8));
        const rx = wx + Math.cos(spin) * r, rz = wz + Math.sin(spin) * r * 0.85;
        const ry = 0.25 + h1 * 1.7 + Math.sin(t * 3 + i) * 0.08;
        pos.setXYZ(i, bx + (rx - bx) * gather, by + (ry - by) * gather, bz + (rz - bz) * gather);
      }
      pos.needsUpdate = true;
      (it.sparks.material as THREE.PointsMaterial).opacity = ramp(0.2, 0.6) * (1 - ramp(4.8, 6.2));
      if (t > 6.3) { this.scene.remove(it.sparks); it.sparks.geometry.dispose(); (it.sparks.material as THREE.Material).dispose(); it.sparks = undefined; }
    }
    // 4.2 s: as the embers fade, a body of light forms in the ring, then slowly turns from glowing gold into you.
    me.setFaded(ramp(4.2, 5.6));
    me.setGlow(1 - ease(ramp(6.0, 8.6)));
    // 7.6 s: Keeper Celene walks up close, reaches out her hand, and helps you up.
    if (celene) {
      if (passed(7.6)) celene.walkTo(home.x + 1, home.y - 1, 700);
      if (passed(8.3)) celene.walkTo(wake.x - 1, wake.y, 700);
      if (t > 9.0 && t < INTRO_TALK) celene.faceYaw(Math.PI / 2);
      celene.stage = 3 - 0.35 * (ramp(9.0, 9.5) - ramp(11.0, 11.8)); // she leans down to you, then straightens with you
      celene.reach = Math.min(ramp(9.1, 9.6), 1 - ramp(11.2, 11.9));
    }
    // You sit up, take her hand, get up onto one knee, then stand.
    me.stage = ramp(9.5, 10.3) + ramp(10.4, 11.0) + ramp(11.0, 11.8);
    // She talks.
    if (t >= INTRO_TALK && !it.talked) {
      it.talked = true;
      if (celene && t - before > 0.5) celene.walkTo(wake.x - 1, wake.y, 10); // skipped: be there already
      if (celene) { celene.stage = 3; celene.reach = 0; }
      me.faceYaw(-Math.PI / 2);
      me.stage = 3;
      me.setFaded(1);
      me.setGlow(0);
      if (it.sparks) { this.scene.remove(it.sparks); it.sparks.geometry.dispose(); (it.sparks.material as THREE.Material).dispose(); it.sparks = undefined; }
      it.skip?.remove();
      openDialog(it.name, it.lines);
    }
    // Once you've read what she says, she goes back to her place by the shrine and the game is yours.
    if (it.talked && !document.body.classList.contains("dialog-open")) {
      if (celene) {
        celene.walkTo(home.x + 1, home.y - 1, 650);
        setTimeout(() => celene.walkTo(home.x, home.y, 650), 700);
      }
      this.yaw = it.cam.yaw; this.pitch = it.cam.pitch; this.dist = it.cam.dist;
      document.body.classList.remove("intro-on");
      this.intro = null;
    }
  },
  // ---------------------------------------------------------------- areas, NPCs and lighting

  showArea(this: World3D, a: AreaDef, x: number, y: number) {
    if (this.here !== a) crumb(`entered ${a.name ?? a.id}`);
    this.here = a;
    this.terrain.setArea(a);
    this.terrain.setCenter(x, y);
    for (const s of this.signLabels) { s.parent?.remove(s); s.element.remove(); }
    this.signLabels = [];
    for (const s of this.terrain.signs) {
      const l = label("sign3d", s.text);
      l.obj.position.copy(s.at);
      this.scene.add(l.obj);
      this.signLabels.push(l.obj);
    }
    const inArea = (px: number, py: number) => areaAt(px, py) === a;
    this.npcs.forEach((p, id) => { const n = NPCS.find((d) => d.id === id)!; p.root.userData.show = inArea(n.x, n.y); });
    this.stations.forEach((s, id) => { const n = NPCS.find((d) => d.id === id)!; s.root.userData.show = inArea(n.x, n.y); });
    this.room?.state.players.forEach((pl: any, id: string) => { const v = this.players.get(id); if (v) v.root.userData.show = inArea(pl.x, pl.y) || id === this.room!.sessionId; });
    this.room?.state.monsters?.forEach((m: any, id: string) => { const v = this.monsters.get(id); if (v) v.root.userData.show = m.alive && inArea(m.x, m.y); });
    this.plotViews.forEach((v, key) => { const lot = LOTS[Number(key)]; v.group.visible = !!lot && a === areaAt(lot.x, lot.y); });
    this.setHallEmbers(a.id === "lighthall");
    this.sky.object.visible = a.kind === "outdoor";
    this.scene.background = a.kind === "outdoor" ? null : new THREE.Color(0x000000);
    this.updateDaylight();
  },
  updateTour(this: World3D, dt: number) {
    const t = this.tour;
    if (!t || !this.room) return;
    const guide = this.npcs.get(t.guide);
    const me = this.players.get(this.room.sessionId);
    // The guide keeps beside you (a step behind and to the side), walking at your pace.
    if (guide && me && (t.follow -= dt) <= 0) {
      t.follow = 0.4;
      const px = Math.round(me.root.position.x / TILE - 0.5), py = Math.round(me.root.position.z / TILE - 0.5);
      const spots = [[1, 1], [-1, 1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1]].map(([dx, dy]) => ({ x: px + dx, y: py + dy })).filter((c) => isWalkable(c.x, c.y) && !npcAt(c.x, c.y));
      const g = { x: guide.root.position.x / TILE - 0.5, y: guide.root.position.z / TILE - 0.5 };
      const best = spots.sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
      if (best && Math.hypot(best.x - g.x, best.y - g.y) > 0.5) guide.walkTo(best.x, best.y, TICK_MS);
    }
    if (document.body.classList.contains("dialog-open")) return;
    if ((t.wait -= dt) > 0) return;
    if (!t.stops.length) return this.endTour();
    if (!t.sent) { t.sent = true; this.room.send("talk", { id: t.stops[0] }); }
  },
  /** The tour's over (or you walked off): the guide goes back to their spot. */
  endTour(this: World3D) {
    const t = this.tour;
    this.tour = null;
    const def = t && NPCS.find((n) => n.id === t.guide);
    if (def) this.npcs.get(def.id)?.walkTo(def.x, def.y, TICK_MS * 1.5);
  },
  /** Lit lanterns and shrines, and 📍 where your quest sends you. */
  showStory(this: World3D, q: QuestView) {
    const lit = new Set<string>(q.lit ?? []);
    this.stations.forEach((s, id) => s.setLit?.(lit.has(id)));
    for (const o of this.spotMarks) { o.parent?.remove(o); if (o instanceof CSS2DObject) o.element.remove(); }
    this.spotMarks = [];
    for (const s of q.spots ?? []) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(tileUp(s.x, s.y, 0.1));
      const pin = label("pin3d", "📍");
      pin.obj.position.copy(tileUp(s.x, s.y, 2));
      this.scene.add(ring, pin.obj);
      this.spotMarks.push(ring, pin.obj);
    }
  },
  /** Click a bookshelf: walk up to it, then take a book down and read it. */
  readShelf(this: World3D, x: number, y: number) {
    const me = this.room && this.room.state.players.get(this.room.sessionId);
    if (!me) return;
    // The restricted section's shelves (version 0.21): behind the grille, out of reach.
    const g = PLACES["lighthall.grille"];
    if (this.here.id === "lighthall" && g && y > g.y + 1 && x < g.x + 6) { showMessage("Those shelves are behind the restricted section's iron grille. It's locked."); return; }
    if (Math.max(Math.abs(me.x - x), Math.abs(me.y - y)) <= 1) { this.openBook(x, y); return; }
    // The free tile next to the shelf that's closest to us.
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!isWalkable(nx, ny) || areaAt(nx, ny) !== this.here) continue;
      const d = Math.hypot(nx - me.x, ny - me.y);
      if (d < bd) { bd = d; best = { x: nx, y: ny }; }
    }
    if (!best) { this.openBook(x, y); return; }
    this.pendingBook = { x, y };
    this.room!.send("move", best);
    this.marker.position.copy(tileUp(best.x, best.y, 0.08));
    this.marker.visible = true;
  },
  openBook(this: World3D, x: number, y: number) {
    const book = bookAt(this.here.id, x, y);
    this.marker.visible = false;
    openDialog(`📖 ${book.title}`, book.pages);
  },
};
