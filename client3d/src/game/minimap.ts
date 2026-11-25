// The minimap: a small round map in the corner, turned the way the camera
// faces (up on the minimap is "forward"). It shows the tiles around you, ❗ for
// someone with something for you and 📍 for where your quest sends you. A
// target too far away to fit sits on the edge, pointing the way to go. Tap it
// to open the big 🗺️ map.
import { AreaDef, DOORS, MAP, OUTDOORS, areaAt, isDanger } from "../../../shared/map";
import { NPCS } from "../../../shared/npcs";
import { TILE_COLORS } from "../../../client/src/mapDraw";
import { outdoorSpot, toggleWorldMap, worldMapMarks } from "../../../client/src/worldmap";

const R = 13; // tiles from the middle to the edge

/** Where to head for a target: itself if it's in this area, otherwise the right door. */
export function wayTo(p: { x: number; y: number }, here: AreaDef): { x: number; y: number } | null {
  const there = areaAt(p.x, p.y);
  if (!there) return null;
  if (there === here) return p;
  if (here === OUTDOORS) return outdoorSpot(p);
  // Inside: the door to that place if there is one, otherwise the way out.
  const doors = DOORS.filter((d) => areaAt(d.x, d.y) === here);
  return doors.find((d) => d.area === there.id) ?? doors.find((d) => d.area === OUTDOORS.id) ?? doors[0] ?? null;
}

/** The nearest place your quest wants you (a ❗ person or a 📍 spot), as the way to walk from (fx, fy): for the guide arrow. */
export function nextGoal(fx: number, fy: number, here: AreaDef): { x: number; y: number } | null {
  const { marks, spots } = worldMapMarks();
  let best: { x: number; y: number } | null = null, bd = Infinity;
  const consider = (p: { x: number; y: number } | undefined) => {
    const at = p && wayTo(p, here);
    if (!at) return;
    const d = Math.hypot(at.x + 0.5 - fx, at.y + 0.5 - fy);
    if (d < bd) { bd = d; best = at; }
  };
  for (const id of marks) consider(NPCS.find((n) => n.id === id));
  for (const s of spots) consider(s);
  return best;
}

export class Minimap {
  private canvas: HTMLCanvasElement;
  private grid = document.createElement("canvas");
  private gridKey = "";
  private last = 0;
  private lastKey = "";

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "minimap";
    this.canvas.className = "panel";
    this.canvas.title = "Minimap: ❗ someone has something for you, 📍 where your quest sends you. Tap for the big map.";
    this.canvas.onclick = () => toggleWorldMap();
    document.body.appendChild(this.canvas);
    this.grid.width = this.grid.height = (2 * R + 1);
  }

  /** Each frame (it only redraws a few times a second, or when something changed). */
  update(me: { x: number; y: number } | null, fx: number, fy: number, here: AreaDef, yaw: number, others: { x: number; y: number }[] = []) {
    const now = performance.now();
    if (now - this.last < 120) return;
    this.last = now;
    this.place();
    if (!me) { this.canvas.style.display = "none"; return; }
    this.canvas.style.display = "";
    const { marks, spots } = worldMapMarks();
    const key = `${fx.toFixed(2)},${fy.toFixed(2)},${yaw.toFixed(3)},${here.id},${marks.join()},${spots.map((p) => p.x + ':' + p.y).join()},${others.map((o) => o.x.toFixed(1) + ':' + o.y.toFixed(1)).join()}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    // The tiles (one pixel each), redrawn when you step onto a new tile.
    const gx = Math.floor(fx), gy = Math.floor(fy);
    const gk = `${gx},${gy},${here.id}`;
    if (gk !== this.gridKey) { this.gridKey = gk; this.drawGrid(gx, gy, here); }

    const css = this.canvas.clientWidth || 120;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(css * dpr)) this.canvas.width = this.canvas.height = Math.round(css * dpr);
    const g = this.canvas.getContext("2d")!;
    const S = this.canvas.width, half = S / 2, px = half / R;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(half, half, half - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "#000";
    g.fillRect(0, 0, S, S);
    // Turn the map so the way the camera looks is up.
    g.translate(half, half);
    g.rotate(yaw);
    g.imageSmoothingEnabled = false;
    // The grid's middle tile is (gx, gy); we're at (fx, fy) inside it.
    g.drawImage(this.grid, (gx - R - fx) * px, (gy - R - fy) * px, (2 * R + 1) * px, (2 * R + 1) * px);
    g.restore();

    // Other players: small blue dots.
    {
      const s = Math.sin(yaw), c = Math.cos(yaw);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#5fb8ff";
      g.strokeStyle = "#000";
      g.lineWidth = 1 * dpr;
      for (const o of others) {
        const dx = o.x - fx, dy = o.y - fy;
        const sx = dx * c - dy * s, sy = dx * s + dy * c;
        if (Math.hypot(sx, sy) > R - 0.8) continue;
        g.beginPath();
        g.arc(half + sx * px, half + sy * px, 3.2 * dpr, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }

    // You: an arrow pointing up (the way you're looking).
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#fff";
    g.strokeStyle = "#000";
    g.lineWidth = 1.5 * dpr;
    g.beginPath();
    g.moveTo(half, half - 6 * dpr);
    g.lineTo(half + 4.5 * dpr, half + 5 * dpr);
    g.lineTo(half, half + 2.5 * dpr);
    g.lineTo(half - 4.5 * dpr, half + 5 * dpr);
    g.closePath();
    g.fill();
    g.stroke();

    // Targets: ❗ people with something for you, 📍 quest spots.
    const targets: { at: { x: number; y: number }; icon: string }[] = [];
    for (const id of marks) {
      const npc = NPCS.find((n) => n.id === id);
      const at = npc && wayTo(npc, here);
      if (at) targets.push({ at, icon: "❗" });
    }
    for (const s of spots) {
      const at = wayTo(s, here);
      if (at) targets.push({ at, icon: "📍" });
    }
    const s = Math.sin(yaw), c = Math.cos(yaw);
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of targets) {
      const dx = t.at.x + 0.5 - fx, dy = t.at.y + 0.5 - fy;
      // World (dx, dy) to the screen: right is (cos yaw, -sin yaw), forward is -(sin yaw, cos yaw).
      let sx = dx * c - dy * s, sy = dx * s + dy * c;
      const d = Math.hypot(sx, sy);
      const edge = R - 1.6;
      const far = d > edge;
      if (far) { sx *= edge / d; sy *= edge / d; }
      const x = half + sx * px, y = half + sy * px;
      if (far) {
        // A little gold arrow on the edge, pointing the way.
        const a = Math.atan2(sy, sx);
        g.save();
        g.translate(half + Math.cos(a) * (half - 5 * dpr), half + Math.sin(a) * (half - 5 * dpr));
        g.rotate(a);
        g.fillStyle = "#ffd84a";
        g.strokeStyle = "#000";
        g.beginPath();
        g.moveTo(4 * dpr, 0);
        g.lineTo(-3 * dpr, -4 * dpr);
        g.lineTo(-3 * dpr, 4 * dpr);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
      g.font = `${Math.round((far ? 12 : 14) * dpr)}px sans-serif`;
      g.fillText(t.icon, x, y);
    }
  }


  private drawGrid(gx: number, gy: number, here: AreaDef) {
    const g = this.grid.getContext("2d")!;
    const img = g.createImageData(2 * R + 1, 2 * R + 1);
    for (let j = 0; j <= 2 * R; j++) {
      for (let i = 0; i <= 2 * R; i++) {
        const x = gx - R + i, y = gy - R + j;
        const t = MAP[y]?.[x];
        let col = 0x000000;
        if (t && areaAt(x, y) === here) {
          col = TILE_COLORS[t] ?? 0x000000;
          if (t === "tree") col = isDanger(x, y) ? 0x16331a : 0x2a5a22;
          else if (t === "rock") col = 0xb07a4c;
          else if (t === "grass" && isDanger(x, y)) col = 0x23432a;
          else if (t === "door") col = 0xffd84a;
        }
        const k = (j * (2 * R + 1) + i) * 4;
        img.data[k] = (col >> 16) & 255;
        img.data[k + 1] = (col >> 8) & 255;
        img.data[k + 2] = col & 255;
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  /** Sit under the health and stamina bars (and the party list, when there is one). */
  private place() {
    let bottom = 0;
    for (const id of ["stamina", "party"]) {
      const el = document.getElementById(id);
      if (!el || getComputedStyle(el).display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.height) bottom = Math.max(bottom, r.bottom);
    }
    const top = `${Math.round(bottom + 6)}px`;
    if (this.canvas.style.top !== top) this.canvas.style.top = top;
  }
}
