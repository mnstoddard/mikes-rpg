// Day, night and lamps.
// Part of the 3D game (client3d/src/game/world.ts), split out to keep each file to one job.
import * as THREE from "three";
import { darkness, isNight, minutesUntilChange } from "../../../../shared/daynight";
import { showMessage, nightSightOn, tickBuffs } from "../../../../client/src/ui";
import { SKY_TIMES } from "../../environment";
import { MAX_LAMPS } from "./common";
import type { World3D } from "../world";

export const daylightMethods = {
  /** Turn on only the nearest few lamps (every point light costs on every pixel). */
  pickLights(this: World3D) {
    const lights: THREE.PointLight[] = [];
    const p = new THREE.Vector3();
    this.scene.traverse((o) => { if ((o as THREE.PointLight).isPointLight) lights.push(o as THREE.PointLight); });
    const d = new Map<THREE.PointLight, number>();
    for (const l of lights) {
      let shown = true;
      for (let a: THREE.Object3D | null = l.parent; a; a = a.parent) if (a.userData.show === false) shown = false;
      l.getWorldPosition(p);
      d.set(l, shown ? p.distanceToSquared(this.focus) : Infinity);
    }
    lights.sort((a, b) => d.get(a)! - d.get(b)!);
    lights.forEach((l, i) => { l.visible = i < MAX_LAMPS; });
  },
  /** 0 in the day, 1 at night (what lanterns and windows light up with). */
  nightLevel(this: World3D): number {
    if (this.here.kind !== "outdoor") return this.here.kind === "cave" ? 1 : 0.6;
    return darkness(Date.now() + this.clockOffset);
  },
  updateDaylight(this: World3D) {
    const now = Date.now() + this.clockOffset;
    const fog = this.scene.fog as THREE.Fog;
    if (this.here.kind === "outdoor") {
      // Blend between the gallery's day, sunset and night lighting.
      let d = darkness(now) * (this.hasLantern ? 0.75 : 1);
      if (nightSightOn()) d = Math.min(d, 0.15);
      const a = d < 0.5 ? SKY_TIMES.day : SKY_TIMES.sunset, b = d < 0.5 ? SKY_TIMES.sunset : SKY_TIMES.night;
      const k = d < 0.5 ? d * 2 : (d - 0.5) * 2;
      const c = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), k);
      this.hemi.color.copy(c(a.hemi[0] as number, b.hemi[0] as number));
      this.hemi.groundColor.copy(c(a.hemi[1] as number, b.hemi[1] as number));
      this.hemi.intensity = (a.hemi[2] as number) * (1 - k) + (b.hemi[2] as number) * k;
      this.sun.color.copy(c(a.sun[0] as number, b.sun[0] as number));
      this.sun.intensity = (a.sun[1] as number) * (1 - k) + (b.sun[1] as number) * k;
      const dir = new THREE.Vector3(...(a.dir as unknown as [number, number, number])).lerp(new THREE.Vector3(...(b.dir as unknown as [number, number, number])), k).normalize();
      this.sun.position.copy(this.focus).addScaledVector(dir, 60);
      this.renderer.toneMappingExposure = a.exposure * (1 - k) + b.exposure * k;
      fog.color.copy(c(a.fog, b.fog));
      fog.near = 40; fog.far = 95;
      this.sky.setTime(d < 0.25 ? "day" : d < 0.75 ? "sunset" : "night");
    } else {
      const cave = this.here.kind === "cave";
      // The Emberhall glows warm, like firelight (version 0.14).
      const ember = this.here.id === "lighthall";
      this.hemi.color.setHex(cave ? 0x8a8ab0 : ember ? 0xffdcb0 : 0xfff0d8);
      this.hemi.groundColor.setHex(cave ? 0x1a1814 : ember ? 0x6a3a20 : 0x5a4a38);
      this.hemi.intensity = cave ? 0.7 : ember ? 1.15 : 1.3;
      this.sun.color.setHex(cave ? 0xffb070 : ember ? 0xffc890 : 0xfff1d6);
      this.sun.intensity = cave ? 0.7 : 1.4;
      this.sun.position.copy(this.focus).add(new THREE.Vector3(10, 40, 20));
      this.renderer.toneMappingExposure = 1.05;
      fog.color.setHex(0x000000);
      fog.near = 30; fog.far = 80;
    }
    tickBuffs();
    const night = isNight(now);
    if (this.wasNight !== null && night !== this.wasNight && this.room) showMessage(night ? "🌙 Night falls over the town." : "☀️ The sun comes up.");
    this.wasNight = night;
    const clock = document.getElementById("clock");
    if (clock) {
      const mins = minutesUntilChange(now);
      clock.textContent = night ? "🌙" : "☀️";
      clock.title = night ? `Night. The sun comes up in about ${mins} minute${mins === 1 ? "" : "s"}.` : `Day. Night falls in about ${mins} minute${mins === 1 ? "" : "s"}.`;
    }
  },
};
