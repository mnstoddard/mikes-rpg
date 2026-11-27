// The 🗺️ world map: a picture of the outdoors with the names of places, where
// you are, and who has something for you (❗). Opened with the 🗺️ button.
import { AreaDef, DOORS, MAP, MAP_NODES, OUTDOORS, areaAt, areaById, isDanger } from "../../shared/map";
import { CITY_SIGNS, MAP_LABELS, outdoorAreaOf } from "../../shared/world";
import { TILE_COLORS } from "./mapDraw";
import { NPCS } from "../../shared/npcs";
import { CHAPTERS } from "../../shared/quests";

const PX = 3; // pixels per tile
let base: HTMLCanvasElement | null = null;
/** The outdoor area the map shows (Heartvale, or Emberhold): the one you are in, or whose door you came in by. */
let shown: AreaDef = OUTDOORS;
let me: { x: number; y: number } | null = null;
let here: AreaDef = OUTDOORS;
let marks: string[] = [];
let spots: { x: number; y: number; label: string }[] = [];
let open = false;
let players: { x: number; y: number; name: string }[] = [];

/** Who to name on the map: everyone who gives lessons or story chapters, plus the repairer. */
function keyPeople(): { x: number; y: number; names: string[] }[] {
  const ids = new Set<string>([...CHAPTERS.map((c) => c.giver as string), "repairer"]);
  const at = new Map<string, { x: number; y: number; names: string[] }>();
  for (const n of NPCS) {
    if (!ids.has(n.id) || n.kind !== "person") continue;
    const o = outdoorSpot(n);
    if (!o || areaAt(o.x, o.y) !== shown) continue;
    const k = `${o.x},${o.y}`;
    if (!at.has(k)) at.set(k, { x: o.x, y: o.y, names: [] });
    at.get(k)!.names.push(n.name.split(" ").slice(-1)[0]); // "Shopkeeper Tam" -> "Tam"
  }
  return [...at.values()];
}

const panel = document.getElementById("worldmap");
const canvas = document.getElementById("worldmap-canvas") as HTMLCanvasElement | null;
const caption = document.getElementById("worldmap-where");

/** Map x and y on the picture (the area's top left is 0, 0). */
const mx = (x: number) => (x - shown.x) * PX;
const my = (y: number) => (y - shown.y) * PX;
const onMap = (p: { x: number; y: number } | null) => !!p && areaAt(p.x, p.y) === shown;

/** Draw the outdoors once. */
function drawBase(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = shown.w * PX;
  c.height = shown.h * PX;
  const g = c.getContext("2d")!;
  for (let yy = 0; yy < shown.h; yy++) {
    for (let xx = 0; xx < shown.w; xx++) {
      const x = shown.x + xx, y = shown.y + yy;
      const t = MAP[y][x];
      let col = TILE_COLORS[t];
      if (t === "tree") col = isDanger(x, y) ? 0x16331a : 0x2a5a22;
      else if (t === "rock") col = 0xb07a4c;
      else if (t === "grass" && isDanger(x, y)) col = 0x23432a;
      else if (t === "door") col = 0xffd84a;
      g.fillStyle = `#${col.toString(16).padStart(6, "0")}`;
      g.fillRect(xx * PX, yy * PX, PX, PX);
    }
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  const labels = shown === OUTDOORS ? MAP_LABELS : CITY_SIGNS.filter((l) => areaAt(l.x, l.y) === shown);
  for (const l of labels) {
    g.font = l.big ? "bold 15px sans-serif" : "12px sans-serif";
    g.lineWidth = 3;
    g.strokeStyle = "rgba(0,0,0,.85)";
    g.fillStyle = l.big ? "#ffe9a8" : "#ffffff";
    g.strokeText(l.text, mx(l.x), my(l.y));
    g.fillText(l.text, mx(l.x), my(l.y));
  }
  // Key people, at their door (or where they stand outside).
  g.font = "10px sans-serif";
  g.textBaseline = "top";
  for (const k of keyPeople()) {
    g.fillStyle = "#7fe0ff";
    g.beginPath();
    g.arc(mx(k.x) + 1, my(k.y) + 1, 2.5, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = "rgba(0,0,0,.85)";
    const text = k.names.join(", ");
    g.strokeText(text, mx(k.x) + 1, my(k.y) + 5);
    g.fillText(text, mx(k.x) + 1, my(k.y) + 5);
  }
  return c;
}

/** Where a spot inside a building shows on the outdoor map: at the building's door. */
export function outdoorSpot(p: { x: number; y: number }): { x: number; y: number } | null {
  const a = areaAt(p.x, p.y);
  if (!a) return null;
  if (a.kind === "outdoor") return p;
  // The door out of this area, then the door that leads into it from outside.
  const inDoor = DOORS.find((d) => d.area === a.id && areaAt(d.x, d.y)?.kind === "outdoor");
  if (inDoor) return inDoor;
  // A cave inside a cave (the crystal cave): use the door of the place that leads there.
  const via = DOORS.find((d) => d.area === a.id);
  return via ? outdoorSpot(via) : null;
}

function render(scroll = true) {
  if (!open || !canvas) return;
  const want = here.kind === "outdoor" ? here : areaById(outdoorAreaOf(here.id)?.id ?? "") ?? OUTDOORS;
  if (want !== shown) { shown = want; base = null; }
  base ??= drawBase();
  canvas.width = base.width;
  canvas.height = base.height;
  const g = canvas.getContext("2d")!;
  g.drawImage(base, 0, 0);
  // People with something for you.
  g.font = "16px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "bottom";
  for (const id of marks) {
    const npc = NPCS.find((n) => n.id === id);
    const at = npc && outdoorSpot(npc);
    if (at && onMap(at)) g.fillText("❗", mx(at.x) + 1, my(at.y));
  }
  // Places your quest sends you.
  for (const s of spots) {
    if (!onMap(s)) continue;
    g.fillText("📍", mx(s.x) + 1, my(s.y));
    if (s.label) {
      g.font = "11px sans-serif";
      g.lineWidth = 3;
      g.strokeStyle = "rgba(0,0,0,.85)";
      g.fillStyle = "#ffd84a";
      g.textBaseline = "top";
      g.strokeText(s.label, mx(s.x), my(s.y) + 2);
      g.fillText(s.label, mx(s.x), my(s.y) + 2);
      g.font = "16px sans-serif";
      g.textBaseline = "bottom";
    }
  }
  // Other players: blue dots with their names.
  g.font = "10px sans-serif";
  g.textBaseline = "bottom";
  for (const pl of players) {
    const o = outdoorSpot(pl);
    if (!o || !onMap(o)) continue;
    g.fillStyle = "#5fb8ff";
    g.strokeStyle = "#000";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(mx(o.x) + 1, my(o.y) + 1, 4, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = "rgba(0,0,0,.85)";
    g.fillStyle = "#cfe9ff";
    g.strokeText(pl.name, mx(o.x) + 1, my(o.y) - 4);
    g.fillText(pl.name, mx(o.x) + 1, my(o.y) - 4);
  }
  const at = me && outdoorSpot(me);
  if (at && onMap(at)) {
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#000";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(mx(at.x) + 1, my(at.y) + 1, 6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = "#e74c3c";
    g.beginPath();
    g.arc(mx(at.x) + 1, my(at.y) + 1, 3, 0, Math.PI * 2);
    g.fill();
  }
  if (caption) caption.textContent = here.kind === "outdoor" ? "You are the white and red dot. Blue dots are other players. ❗ = someone (or something) has something for you. 📍 = a place your quest sends you." : `You're inside: ${here.name} (the dot is its door).`;
  // Keep you in view on small screens.
  if (at && panel && scroll) {
    const box = canvas.parentElement!;
    box.scrollLeft = mx(at.x) - box.clientWidth / 2;
    box.scrollTop = my(at.y) - box.clientHeight / 2;
  }
}

export function updateWorldMap(pos: { x: number; y: number } | null, area: AreaDef) {
  me = pos;
  here = area;
  render();
}

export function setWorldMapMarks(list: string[], places: { x: number; y: number; label: string }[] = []) {
  marks = list;
  spots = places;
  render();
}

/** What the 🗺️ map marks now (for the 3D game's minimap): people with something for you, and quest spots. */
export function worldMapMarks() {
  return { marks, spots };
}

/** Where everyone else is (the 3D game tells us every second; drawn only while the map is open). */
export function setWorldMapPlayers(list: { x: number; y: number; name: string }[]) {
  players = list;
  if (open) render(false);
}

export function toggleWorldMap(show = !open) {
  open = show;
  document.body.classList.toggle("map-open", open);
  render();
}

export function setWorldMapActions() {
  const btn = document.getElementById("map-btn");
  if (btn) btn.onclick = () => toggleWorldMap();
  const close = document.getElementById("worldmap-close");
  if (close) close.onclick = () => toggleWorldMap(false);
}
