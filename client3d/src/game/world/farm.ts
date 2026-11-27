// Farm plots drawn in the world.
// Part of the 3D game (client3d/src/game/world.ts), split out to keep each file to one job.
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { areaAt } from "../../../../shared/map";
import { ITEMS } from "../../../../shared/items";
import { CROPS, LOTS, LOT_SIZE, decodeCrop, growth, inPlot, tileOf } from "../../../../shared/farming";
import { serverNow } from "../../../../client/src/ui";
import { TILE } from "../../environment";
import { tileCenter, tileUp } from "../terrain";
import { label } from "../actors";
import type { World3D } from "../world";

export const farmMethods = {
  // ---------------------------------------------------------------- farm plots

  drawPlot(this: World3D, key: string) {
    const lot = LOTS[Number(key)];
    if (!lot) return;
    let view = this.plotViews.get(key);
    if (view) { this.scene.remove(view.group); view.sign.element.remove(); view.crops.forEach((c) => c.element.remove()); }
    const group = new THREE.Group();
    group.visible = this.here === areaAt(lot.x, lot.y);
    const plot = this.plots.get(key);
    const sign = label("sign3d small", plot ? `${plot.owner}'s farm` : "Free lot: ask Farmer Odo");
    sign.obj.position.copy(tileCenter(lot.x, lot.y)).add(new THREE.Vector3(LOT_SIZE * TILE / 2 - TILE / 2, 1.2, -TILE / 2));
    group.add(sign.obj);
    const crops: CSS2DObject[] = [];
    const now = serverNow();
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 });
    for (let i = 0; i < LOT_SIZE * LOT_SIZE; i++) {
      if (!plot || !inPlot(i, plot.w, plot.h)) continue;
      const t = tileOf(Number(key), i);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.92, 0.12, TILE * 0.92), soilMat);
      soil.position.copy(tileUp(t.x, t.y, 0.06));
      soil.receiveShadow = true;
      group.add(soil);
      const c = decodeCrop(plot.crops[i]);
      if (!c) continue;
      const g = growth(c, now);
      const l = label("crop3d", g >= 1 ? ITEMS[CROPS[c.crop].produce].icon : g < 0.34 ? "🌱" : "🌿");
      l.el.style.fontSize = `${Math.round(14 + g * 12)}px`;
      l.obj.position.copy(tileUp(t.x, t.y, 0.5));
      group.add(l.obj);
      crops.push(l.obj);
    }
    this.scene.add(group);
    view = { group, sign: sign.obj, crops };
    this.plotViews.set(key, view);
  },
  redrawPlots(this: World3D) { for (const key of this.plotViews.keys()) this.drawPlot(key); },
};
