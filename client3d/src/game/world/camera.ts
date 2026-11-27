// The camera: orbiting round you, zoom, the way-finding arrow and window size.
// Part of the 3D game (client3d/src/game/world.ts), split out to keep each file to one job.
import * as THREE from "three";
import { wallCut } from "../wallcut";
import { OUTDOORS, areaAt } from "../../../../shared/map";
import { nextGoal } from "../minimap";
import { TILE } from "../../environment";
import { tileCenter } from "../terrain";
import { MIN_DIST, MAX_DIST, CAM_KEY } from "./common";
import type { World3D } from "../world";

export const cameraMethods = {
  /** Point the camera at a tile without being logged in (the ?at= preview, and tests). */
  lookAt(this: World3D, x: number, y: number, hour?: "day" | "sunset" | "night") {
    const a = areaAt(x, y) ?? OUTDOORS;
    this.showArea(a, x, y);
    this.focus.copy(tileCenter(x, y));
    if (hour) {
      // Shift our clock so it's that time of day (only on this screen).
      const want = hour === "day" ? 10 * 60_000 : hour === "sunset" ? 29 * 60_000 : 35 * 60_000;
      const now = Date.now();
      this.clockOffset = want - (now % (40 * 60_000));
      this.updateDaylight();
    }
  },
  /** Point the guide arrow at the nearest ❗ or 📍 (or the door that leads there). It hides once you're close, or while a box is open. */
  updateGuide(this: World3D, me: { root: THREE.Object3D } | undefined) {
    const busy = document.body.classList.contains("dialog-open") || document.body.classList.contains("shop-open") || document.body.classList.contains("craft-open");
    const goal = me && !busy ? nextGoal(me.root.position.x / TILE, me.root.position.z / TILE, this.here) : null;
    if (!me || !goal) { this.guide.visible = false; return; }
    const to = tileCenter(goal.x, goal.y);
    const dx = to.x - me.root.position.x, dz = to.z - me.root.position.z;
    const d = Math.hypot(dx, dz);
    if (d < TILE * 2.5) { this.guide.visible = false; return; }
    this.guide.visible = true;
    const bob = 1.5 + Math.sin(this.time * 4) * 0.2;
    this.guide.position.set(me.root.position.x + (dx / d) * bob, me.root.position.y + 0.15, me.root.position.z + (dz / d) * bob);
    this.guide.rotation.y = Math.atan2(-dz, dx);
  },
  placeCamera(this: World3D, dt = 0) {
    const f = this.focus;
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // Don't go through buildings or walls: come in closer, in front of the first one in the way.
    const free = this.freeDist(dir);
    this.camDist = dt ? Math.min(free, this.camDist + (free - this.camDist) * Math.min(1, dt * 4)) : free;
    const off = dir.multiplyScalar(this.camDist);
    this.camera.position.copy(f).add(off);
    this.camera.lookAt(f.x, f.y + 1, f.z);
    // Inside, walls between the camera and you are cut away instead (wallcut.ts).
    wallCut.uCam.value.copy(this.camera.position);
    wallCut.uFocus.value.set(f.x, f.y + 1, f.z);
    wallCut.uCutOn.value = this.here.kind === "outdoor" ? 0 : 1;
    // The sun's shadow box follows you.
    this.sun.target.position.copy(f);
  },
  /** How far the camera can sit from you along this direction before a wall or building is in the way. */
  freeDist(this: World3D, dir: THREE.Vector3): number {
    const f = this.focus;
    const fx = Math.floor(f.x / TILE), fy = Math.floor(f.z / TILE);
    const step = 0.25;
    for (let d = 1; d < this.dist; d += step) {
      const x = f.x + dir.x * d, y = f.y + 1 + dir.y * d, z = f.z + dir.z * d;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (tx === fx && ty === fy) continue;
      if (this.terrain.blockHeight(tx, ty) > y - 0.3) return Math.max(MIN_DIST * 0.5, d - 0.6);
    }
    return this.dist;
  },
  resize(this: World3D) {
    const w = this.host.clientWidth || window.innerWidth, h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  },
  saveCamera(this: World3D) {
    try { localStorage.setItem(CAM_KEY, JSON.stringify({ yaw: this.yaw, dist: this.dist, pitch: this.pitch })); } catch { /* ignore */ }
  },
  setDist(this: World3D, d: number) {
    this.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, d));
    this.saveCamera();
  },
};
