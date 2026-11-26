// The townsfolk in 3D (shared/townsfolk.ts): people walking their loops round
// town and the Emberhall. Where each one is comes from the world clock, so
// every player sees them in the same spot. They're only for show: they don't
// block anyone, and clicking one just has them say something.
import * as THREE from "three";
import { findPath } from "../../../shared/pathfinding";
import { TOWNSFOLK, type TownsfolkDef, worldSpot } from "../../../shared/townsfolk";
import { makeRecipe, type CharacterRecipe } from "../character";
import { TILE } from "../environment";
import { Person } from "./actors";
import { tileCenter } from "./terrain";

const LOOKS: Record<string, Partial<CharacterRecipe>> = {
  hanna: { frame: 1, build: 0.65, hairStyle: "bun", hairColor: "#8b5b2c", top: "long", bottom: "skirt", shirtColor: "#e8d8b0", pantsColor: "#8a5a34", lashes: "on", blush: "on" },
  pip: { frame: 0, height: 0.7, hairStyle: "messy", hairColor: "#d9782b", top: "tshirt", shirtColor: "#3a8ad8", pantsColor: "#5c4636" },
  ada: { frame: 1, hairStyle: "ponytail", hairColor: "#d9782b", top: "tunic", bottom: "skirt", shirtColor: "#9a4a6a", pantsColor: "#5c4636", lashes: "on" },
  dunstan: { frame: 0, height: 1.06, muscle: 0.8, hairStyle: "buzz", hairColor: "#3b2a20", beard: "full", top: "tunic", shirtColor: "#6a7a8a", pantsColor: "#3b3f44", belt: "on" },
  lyle: { frame: 0, build: 0.6, hairStyle: "quiff", hairColor: "#1b1613", beard: "mustache", top: "long", shirtColor: "#2a7a7a", pantsColor: "#3a2517", hat: "headband" },
  pell: { frame: 0, height: 0.92, hairStyle: "bald", beard: "full", hairColor: "#e0e0e0", top: "long", shirtColor: "#7a6a5a", pantsColor: "#4a4038" },
  jory: { frame: 0, muscle: 0.6, hairStyle: "messy", hairColor: "#c8a060", top: "tank", shirtColor: "#c8b080", pantsColor: "#3a6ea5" },
  cole: { frame: 0, hairStyle: "short", hairColor: "#5e3a1f", beard: "stubble", top: "tunic", shirtColor: "#3a5a7a", pantsColor: "#5c4636" },
  bram: { frame: 0, height: 0.9, hairStyle: "short", hairColor: "#5e3a1f", top: "robe", shirtColor: "#efe4c8", pantsColor: "#efe4c8", accentColor: "#e8792b" },
  mira: { frame: 1, height: 0.95, hairStyle: "pigtails", hairColor: "#1b1613", top: "robe", bottom: "skirt", shirtColor: "#efe4c8", pantsColor: "#efe4c8", accentColor: "#e8792b", lashes: "on" },
  ennis: { frame: 0, hairStyle: "long", hairColor: "#8a8070", beard: "goatee", top: "long", shirtColor: "#5a6a4a", pantsColor: "#4a4038", hat: "headband" },
  quill: { frame: 0.5, hairStyle: "bob", hairColor: "#3b2a20", top: "robe", shirtColor: "#4a5a8a", pantsColor: "#4a5a8a", glasses: "round" },
  rosa: { frame: 1, hairStyle: "bun", hairColor: "#1b1613", top: "robe", bottom: "skirt", shirtColor: "#f4f4f4", pantsColor: "#f4f4f4", accentColor: "#c0392b", lashes: "on" },
  bess: { frame: 1, build: 0.7, hairStyle: "ponytail", hairColor: "#b2501f", top: "tunic", bottom: "skirt", shirtColor: "#7a3a2a", pantsColor: "#5c4636", lashes: "on", blush: "on" },
};

interface Walk {
  def: TownsfolkDef;
  person: Person;
  /** The loop as points (world metres), with the time to reach each one, and the whole loop's length in seconds. */
  points: THREE.Vector3[];
  times: number[];
  period: number;
  areaId: string;
}

export class Townsfolk {
  private walks: Walk[] = [];

  constructor(scene: THREE.Scene) {
    for (const def of TOWNSFOLK) {
      const spots = def.route.map((p) => worldSpot(def, p));
      const points: THREE.Vector3[] = [];
      const times: number[] = [];
      let t = 0;
      for (let i = 0; i < spots.length; i++) {
        const a = spots[i], b = spots[(i + 1) % spots.length];
        // Stop a moment at each spot.
        points.push(tileCenter(a.x, a.y)); times.push(t);
        t += def.pause;
        points.push(tileCenter(a.x, a.y)); times.push(t);
        let prev = tileCenter(a.x, a.y);
        for (const p of findPath(a, b)) {
          const at = tileCenter(p.x, p.y);
          t += prev.distanceTo(at) / TILE / def.speed;
          points.push(at); times.push(t);
          prev = at;
        }
      }
      const recipe = makeRecipe({ name: def.name, ...(LOOKS[def.id] ?? {}) });
      const person = new Person(recipe, { name: def.name, npc: true, badge: def.badge });
      person.name.el.classList.add("folk");
      person.root.userData.folk = def.id;
      person.place(spots[0].x, spots[0].y);
      scene.add(person.root);
      this.walks.push({ def, person, points, times, period: Math.max(1, t), areaId: def.area });
    }
  }

  /** Each frame: where everyone is at this moment of the world clock. Only the ones in your area are shown. */
  update(dt: number, time: number, worldMs: number, areaId: string) {
    const secs = worldMs / 1000;
    for (const w of this.walks) {
      const show = w.areaId === areaId;
      w.person.root.userData.show = show;
      if (!show) continue;
      const k = (secs + w.def.id.length * 13.7) % w.period;
      let i = 0;
      while (i < w.times.length - 1 && w.times[i + 1] <= k) i++;
      const a = w.points[i], b = w.points[i + 1] ?? w.points[0];
      const t0 = w.times[i], t1 = w.times[i + 1] ?? w.period;
      const f = t1 > t0 ? Math.min(1, (k - t0) / (t1 - t0)) : 1;
      const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
      w.person.glide(x / TILE, z / TILE);
      w.person.update(dt, time);
    }
  }

  /** Everyone (each frame decides who is drawn). */
  all(): THREE.Object3D[] { return this.walks.map((w) => w.person.root); }

  /** The people drawn now (for clicking, and for opening doors as they pass). */
  roots(): THREE.Object3D[] { return this.walks.filter((w) => w.person.root.visible).map((w) => w.person.root); }

  /** What one of them says when you click them: one line, picked by the clock. */
  lineFor(id: string, worldMs: number): { name: string; line: string } | null {
    const w = this.walks.find((x) => x.def.id === id);
    if (!w) return null;
    const lines = w.def.lines;
    return { name: w.def.name, line: lines[Math.floor(worldMs / 7000) % lines.length] };
  }
}
