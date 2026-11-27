// Mouse, touch and keyboard: walking, running, clicking and what the pointer is over.
// Part of the 3D game (client3d/src/game/world.ts), split out to keep each file to one job.
import * as THREE from "three";
import { MAP, areaAt, doorAt, isWalkable } from "../../../../shared/map";
import { groundHeight, groundHeightAt } from "../../../../shared/world";
import { MONSTERS, MonsterId } from "../../../../shared/combat";
import { RESOURCES, ResourceId, fishAt, isFishingSpot, nodeAt, treeKey } from "../../../../shared/foraging";
import { ITEMS } from "../../../../shared/items";
import { npcAt } from "../../../../shared/npcs";
import { findSkill, isUnlocked, levelForXp } from "../../../../shared/disciplines";
import { CROPS, decodeCrop, inPlot, lotAt, timeLeft } from "../../../../shared/farming";
import { closeBounties, closeGuild, closeChest, closeRepair, closeDialog, openDialog, closeCraft, closeInfo, closeShop, setHoverText, castSlot, serverNow } from "../../../../client/src/ui";
import { TILE } from "../../environment";
import { tileUp } from "../terrain";
import { createJoystick } from "../joystick";
import { setupFullscreen } from "../fullscreen";
import { TAP_SLOP, WALK_KEYS } from "./common";
import type { World3D } from "../world";

export const inputMethods = {
  // ---------------------------------------------------------------- input

  setupInput(this: World3D) {
    this.stick = createJoystick(() => { this.walkPaused = false; if (this.tour) this.endTour(); });
    setupFullscreen();
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; button: number }>();
    let pinch = 0, pinchDist = 0, dragged = false;
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button });
      dragged = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        pinchDist = this.dist;
      }
    });
    el.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) { if (e.pointerType === "mouse") this.onHover(e.clientX, e.clientY); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_SLOP) dragged = true;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.setDist(pinchDist * pinch / Math.max(1, d));
        return;
      }
      // Drag (right or middle mouse, or one finger) turns the camera round you.
      const rotating = e.pointerType !== "mouse" || p.button !== 0 || e.shiftKey;
      if (rotating && dragged) {
        this.yaw -= dx * 0.008;
        this.pitch = Math.min(1.35, Math.max(0.35, this.pitch + dy * 0.005));
        this.saveCamera();
      }
    });
    const up = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (!p || dragged || pointers.size > 0) return;
      // A tap or a left click (without dragging) acts on the tile.
      if (e.pointerType === "mouse" && p.button !== 0) return;
      this.onClick(e.clientX, e.clientY);
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); pinch = 0; });
    el.addEventListener("pointerleave", () => setHoverText(null));
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.setDist(this.dist * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
    window.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // W A S D walk (forward is the way the camera faces).
      if (e.key === "Shift" && !this.runShift) { this.runShift = true; this.sendRun(); }
      if (WALK_KEYS.includes(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!this.keys.has(e.code)) { this.keys.add(e.code); this.walkPaused = false; if (this.tour) this.endTour(); }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "q" || e.key === "Q") { this.yaw += 0.12; this.saveCamera(); }
      else if (e.key === "ArrowRight" || e.key === "e" || e.key === "E") { this.yaw -= 0.12; this.saveCamera(); }
      else if (e.key === "ArrowUp") { this.pitch = Math.min(1.35, this.pitch + 0.06); this.saveCamera(); }
      else if (e.key === "ArrowDown") { this.pitch = Math.max(0.35, this.pitch - 0.06); this.saveCamera(); }
      // Number keys 1-8 cast the spell in that slot of the spell bar.
      else if (e.key >= "1" && e.key <= "8" && !e.ctrlKey && !e.metaKey && !e.altKey) castSlot(Number(e.key) - 1);
    });
    window.addEventListener("keyup", (e) => {
      if (this.keys.delete(e.code)) this.walkPaused = false;
      if (e.key === "Shift" && this.runShift) { this.runShift = false; this.sendRun(); }
    });
    // Switching to another window would miss the key being let go: stop walking.
    window.addEventListener("blur", () => { this.keys.clear(); if (this.runShift) { this.runShift = false; this.sendRun(); } });
    document.getElementById("zoom-in")!.onclick = () => this.setDist(this.dist / 1.25);
    document.getElementById("zoom-out")!.onclick = () => this.setDist(this.dist * 1.25);
    const rot = document.getElementById("rotate3d");
    if (rot) rot.onclick = () => { this.yaw += Math.PI / 4; this.saveCamera(); };
    const run = document.getElementById("run3d");
    if (run) run.onclick = () => { this.runToggle = !this.runToggle; this.sendRun(); };
  },
  /** Running: the 🏃 button turns it on and off, and holding Shift runs too. */
  sendRun(this: World3D) {
    const on = this.runToggle || this.runShift;
    this.showRun(on);
    this.room?.send("run", { on });
  },
  showRun(this: World3D, on: boolean) {
    document.getElementById("run3d")?.classList.toggle("on", on);
  },
  /** Which way (dx, dy) the held keys point, turned to match the camera: any angle, not just 8 ways. */
  keyDirection(this: World3D): { dx: number; dy: number } {
    const k = this.keys;
    const fwd = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0) + this.stick.fwd;
    const right = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + this.stick.right;
    // Not while making your character (its window covers the game).
    if (this.walkPaused || (!fwd && !right) || document.getElementById("creator") || this.intro) return { dx: 0, dy: 0 };
    // The camera sits at (sin yaw, cos yaw) from you, so it looks along -(sin yaw, cos yaw).
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const vx = -s * fwd + c * right, vz = -c * fwd - s * right;
    const len = Math.hypot(vx, vz) || 1;
    return { dx: vx / len, dy: vz / len };
  },
  /** Each frame: tell the server when the keyboard direction changes (or stops). */
  updateWalk(this: World3D) {
    if (!this.room) return;
    const { dx, dy } = this.keyDirection();
    const key = !dx && !dy ? "0,0" : `${dx.toFixed(3)},${dy.toFixed(3)}`;
    if (key === this.walkSent) return;
    if (key !== "0,0" && this.walkSent !== "0,0") {
      // Turning the camera while you walk: send the new way, but not every single frame.
      const [ox, oy] = this.walkSent.split(",").map(Number);
      if (ox * dx + oy * dy > 0.9995 || performance.now() - this.walkSentAt < 80) return;
    }
    this.walkSentAt = performance.now();
    if (this.walkSent === "0,0") { this.closePanels(); this.marker.visible = false; }
    this.walkSent = key;
    this.room.send("walk", { dx, dy });
  },
  closePanels(this: World3D) {
    closeShop();
    closeRepair();
    closeCraft();
    closeBounties();
    closeGuild();
    closeChest();
    closeInfo();
    closeDialog();
  },
  /** The tile under a point on the screen: trees, rocks and people first, then the ground. */
  tileAt(this: World3D, sx: number, sy: number): { x: number; y: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // People and monsters (their tile is where they stand).
    const actors: THREE.Object3D[] = [];
    for (const m of this.monsters.values()) if (m.root.visible) actors.push(m.root);
    for (const p of this.npcs.values()) actors.push(p.root);
    for (const s of this.stations.values()) actors.push(s.root);
    for (const [id, p] of this.players) if (id !== this.room?.sessionId) actors.push(p.root);
    const hits = this.raycaster.intersectObjects([...actors, ...this.terrain.pickables()], true);
    for (const h of hits) {
      const t = this.terrain.tileOfHit(h);
      if (t) return t;
      for (let o: THREE.Object3D | null = h.object; o; o = o.parent) {
        if (actors.includes(o)) {
          return { x: Math.floor(o.position.x / TILE), y: Math.floor(o.position.z / TILE) };
        }
      }
    }
    const p = this.groundHit();
    if (!p) return null;
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.z / TILE) };
  },
  /** Where the last click's ray meets the ground, Ember Hill's terrace and stairway included (version 0.22). */
  groundHit(this: World3D): THREE.Vector3 | null {
    const p = new THREE.Vector3();
    const ray = this.raycaster.ray;
    const top = new THREE.Plane(new THREE.Vector3(0, 1, 0), -4);
    if (this.here.kind !== "outdoor" || !ray.intersectPlane(top, p)) return ray.intersectPlane(this.ground, p);
    // Step down the ray from 4 m up until it's under the ground.
    for (let i = 0; i < 80; i++) {
      if (p.y <= groundHeightAt(p.x / TILE, p.z / TILE)) return p;
      p.addScaledVector(ray.direction, 0.25);
    }
    return ray.intersectPlane(this.ground, p);
  },
  /** Where the last click's ray meets the ground, if that's inside tile (x, y). */
  groundSpot(this: World3D, x: number, y: number): THREE.Vector3 | null {
    const p = this.groundHit();
    if (!p) return null;
    return Math.floor(p.x / TILE) === x && Math.floor(p.z / TILE) === y ? p : null;
  },
  onHover(this: World3D, sx: number, sy: number) {
    if (!this.room) return;
    const now = performance.now();
    if (now - this.lastHover < 60) return;
    this.lastHover = now;
    const t = this.tileAt(sx, sy);
    if (!t) { setHoverText(null); return; }
    this.hoverText(t.x, t.y, sx, sy);
  },
  onClick(this: World3D, sx: number, sy: number) {
    if (!this.room || this.intro) return;
    if (this.tour) this.endTour(); // walking off on your own ends the tour
    const t = this.tileAt(sx, sy);
    // Townsfolk: they just say something (they aren't part of any quest).
    const folkHit = this.raycaster.intersectObjects(this.folk.roots(), true)[0];
    if (folkHit) {
      for (let o: THREE.Object3D | null = folkHit.object; o; o = o.parent) {
        if (!o.userData.folk) continue;
        const said = this.folk.lineFor(o.userData.folk, Date.now() + this.clockOffset);
        if (said) { this.closePanels(); openDialog(said.name, [said.line]); }
        return;
      }
    }
    if (!t) return;
    const { x, y } = t;
    this.closePanels();
    this.pendingBook = null;
    // Clicking takes over from the keys (until you press or let go of one).
    if (this.walkSent !== "0,0") {
      this.room.send("walk", { dx: 0, dy: 0 });
      this.walkSent = "0,0";
      this.walkPaused = true;
    }
    if (areaAt(x, y) !== this.here) return;
    const npc = npcAt(x, y);
    const monster = this.monsterAt(x, y);
    const other = this.otherPlayerAt(x, y);
    if (monster) { this.room.send("attack", { id: monster }); return; }
    else if (other && !npc) { this.room.send("partyInvite", { id: other }); return; }
    else if (npc) this.room.send("talk", { id: npc.id });
    else if (MAP[y]?.[x] === "shelf") { this.readShelf(x, y); return; }
    else if (this.isStandingTree(x, y)) this.room.send("chop", { x, y });
    else if (this.isFullRock(x, y)) this.room.send("mine", { x, y });
    else if (this.isFullPatch(x, y)) this.room.send("dig", { x, y });
    else if (isFishingSpot(x, y)) this.room.send("fish", { x, y });
    else if (lotAt(x, y) && this.plots.has(String(lotAt(x, y)!.lot))) this.room.send("farm", { x, y });
    else if (isWalkable(x, y)) {
      // Walk right to the spot you clicked (not just the middle of its tile).
      const spot = this.groundSpot(x, y);
      this.room.send("move", spot ? { x, y, fx: spot.x / TILE, fy: spot.z / TILE } : { x, y });
      this.marker.position.copy(spot ? spot.clone().setY(groundHeight(x, y) + 0.08) : tileUp(x, y, 0.08));
      this.marker.visible = true;
      return;
    } else return;
    this.marker.position.copy(tileUp(x, y, 0.08));
    this.marker.visible = true;
  },
  monsterAt(this: World3D, x: number, y: number): string | null {
    let found: string | null = null;
    this.room?.state.monsters?.forEach((m: any, id: string) => { if (m.alive && m.x === x && m.y === y) found = id; });
    return found;
  },
  otherPlayerAt(this: World3D, x: number, y: number): string | null {
    const room = this.room;
    if (!room) return null;
    const me = room.state.players.get(room.sessionId);
    let found: string | null = null;
    room.state.players.forEach((pl: any, id: string) => {
      if (id !== room.sessionId && pl.x === x && pl.y === y && !pl.invisible && !(me?.party && pl.party === me.party)) found = id;
    });
    return found;
  },
  // ---------------------------------------------------------------- what's where (same rules as the 2D game)

  isStandingTree(this: World3D, x: number, y: number) { return MAP[y]?.[x] === "tree" && !this.terrain.isDepleted(treeKey(x, y)); },
  isFullRock(this: World3D, x: number, y: number) { return MAP[y]?.[x] === "rock" && !this.terrain.isDepleted(treeKey(x, y)); },
  isFullPatch(this: World3D, x: number, y: number) { return MAP[y]?.[x] === "dig" && !this.terrain.isDepleted(treeKey(x, y)); },
  lockNote(this: World3D, type: ResourceId) {
    const r = RESOURCES[type];
    const { def } = findSkill(r.skill);
    if (!isUnlocked(this.lastDisciplines?.unlocked ?? [], r.skill)) return ` (learn ${def.name} first)`;
    return levelForXp(this.skillXp[r.skill] ?? 0) < r.level ? ` (${def.name} level ${r.level})` : "";
  },
  hoverText(this: World3D, x: number, y: number, px: number, py: number) {
    const el = this.renderer.domElement;
    if (areaAt(x, y) !== this.here) { setHoverText(null); el.style.cursor = "default"; return; }
    const door = doorAt(x, y);
    const npc = npcAt(x, y);
    const monster = this.monsterAt(x, y);
    const other = this.otherPlayerAt(x, y);
    const t = MAP[y]?.[x];
    if (other && !monster && !npc) setHoverText("Invite", `${this.room!.state.players.get(other).name} to your party`, px, py);
    else if (monster) {
      const m = this.room!.state.monsters.get(monster);
      const def = MONSTERS[m.kind as MonsterId];
      setHoverText("Attack", `${def.name} (level ${def.level})${def.aggressive ? " ⚠" : ""}`, px, py);
    } else if (npc) setHoverText(npc.id.startsWith("lantern_") || npc.id.startsWith("round_") ? "Light" : npc.id === "board" || npc.id === "guildboard" ? "Read" : npc.name === "Enchanted chest" ? "Open" : npc.kind === "station" ? "Use" : "Talk-to", npc.name, px, py);
    else if (this.isStandingTree(x, y)) { const type = nodeAt(x, y)!; setHoverText("Chop down", RESOURCES[type].node + this.lockNote(type), px, py); }
    else if (t === "tree") setHoverText("Examine", `${RESOURCES[nodeAt(x, y)!].node} stump`, px, py);
    else if (this.isFullRock(x, y)) { const type = nodeAt(x, y)!; setHoverText("Mine", RESOURCES[type].node + this.lockNote(type), px, py); }
    else if (t === "rock") setHoverText("Examine", `Empty ${RESOURCES[nodeAt(x, y)!].node.toLowerCase()}`, px, py);
    else if (this.isFullPatch(x, y)) setHoverText("Dig", "Dig patch" + this.lockNote("dig"), px, py);
    else if (t === "dig") setHoverText("Examine", "Dug-out patch (it glints again soon)", px, py);
    else if (door) setHoverText(door.label.startsWith("Leave") || door.label.startsWith("Back") || door.label.startsWith("Go") ? door.label : "Enter", door.label.replace(/^Enter /, ""), px, py);
    else if (this.here.danger && (t === "cave" || t === "crystal")) setHoverText(`⚠ ${this.here.name}:`, "monsters here attack on sight!", px, py);
    else if (t === "lockeddoor") setHoverText("Locked", this.here.id === "lighthall" ? "the restricted section: barred" : "a heavy door with a gold lock", px, py);
    else if (t === "grille") setHoverText("Iron grille", "the restricted section, locked", px, py);
    else if (t === "barricade") setHoverText("Road closed:", "the Ashen Barrens lie beyond. The Watch has shut the road.", px, py);
    else if (lotAt(x, y)) {
      const at = lotAt(x, y)!;
      const plot = this.plots.get(String(at.lot));
      const c = plot && inPlot(at.index, plot.w, plot.h) ? decodeCrop(plot.crops[at.index]) : null;
      const now = serverNow();
      if (!plot) setHoverText("Walk here", "Free farm lot (Farmer Odo sells plots)", px, py);
      else if (!inPlot(at.index, plot.w, plot.h)) setHoverText("Examine", `${plot.owner}'s lot (not planted yet)`, px, py);
      else if (!c) setHoverText(plot.owner === this.myName() ? "Plant" : "Examine", `Empty soil in ${plot.owner}'s farm`, px, py);
      else if (now >= c.ripeAt) setHoverText(plot.owner === this.myName() ? "Harvest" : "Examine", `Ripe ${ITEMS[CROPS[c.crop].produce].name.toLowerCase()}`, px, py);
      else setHoverText("Examine", `${ITEMS[CROPS[c.crop].produce].name}, ripe in ${timeLeft(c.ripeAt - now)}`, px, py);
    } else if (isFishingSpot(x, y)) { const type = fishAt(x, y)!; setHoverText("Fish", RESOURCES[type].node + this.lockNote(type), px, py); }
    else if (t === "sign") {
      if (y < 90) setHoverText("⚠ Road closed:", "the Ashen Barrens lie beyond, where the Withering began.", px, py);
      else setHoverText("⚠ Danger:", "the Dark Forest. Monsters attack on sight!", px, py);
    } else if (t === "gate") setHoverText("Walk into", "the Dark Forest ⚠", px, py);
    else if (isWalkable(x, y)) setHoverText("Walk here", "", px, py);
    else setHoverText(null);
    el.style.cursor = npc || monster || door || this.isStandingTree(x, y) || this.isFullRock(x, y) || this.isFullPatch(x, y) || isFishingSpot(x, y) ? "pointer" : "default";
  },
};
