// Tool icons, drawn so you can see what each one is made of: the head is the
// colour of its stone or metal, and the handle the colour of its wood.
// Items name them like "svg:tool/axe/bronze/oak" (shared/items.ts).
import type { Material, ToolType, Wood } from "../../shared/tools";

/** Light, middle and dark shades of each head material. */
const HEADS: Record<Material, [string, string, string]> = {
  stone:   ["#c3c5c4", "#8f918f", "#5c5e5d"],
  bronze:  ["#f0c27a", "#c98a3c", "#7f5320"],
  iron:    ["#a4a7ad", "#6f7279", "#43464c"],
  steel:   ["#f1f5f9", "#c3ccd5", "#7d8893"],
  mithril: ["#9fd0ff", "#4f8fd6", "#255a99"],
};

/** Light and dark shades of each handle wood. */
const HANDLES: Record<Wood, [string, string]> = {
  pine:      ["#e8c88a", "#b48a4a"],
  oak:       ["#b07a45", "#704622"],
  birch:     ["#f4efe3", "#b9b2a0"],
  maple:     ["#d2774a", "#8c3f1f"],
  yew:       ["#a89048", "#6b5a22"],
  ironwood:  ["#6b6a6f", "#38373b"],
  elderwood: ["#8f6cc4", "#553586"],
};

const LINE = "#2b2f33"; // outlines

/** The SVG for one tool. Unknown materials fall back to plain grey wood and stone. */
export function toolSvg(type: ToolType, material: Material | null, wood: Wood | null): string {
  const [hl, hm, hd] = HEADS[material ?? "stone"] ?? HEADS.stone;
  const [wl, wd] = HANDLES[wood ?? "pine"] ?? HANDLES.pine;
  // A wooden handle, drawn upright from (16, top) to (16, 29), then the whole tool is tilted.
  const handle = (top: number, w = 3.4) =>
    `<path d="M16 ${top} V29" stroke="${LINE}" stroke-width="${w + 1.8}" stroke-linecap="round"/>` +
    `<path d="M16 ${top} V29" stroke="${wl}" stroke-width="${w}" stroke-linecap="round"/>` +
    `<path d="M${16 + w / 4} ${top + 1} V28" stroke="${wd}" stroke-width="${w / 3}" stroke-linecap="round"/>`;
  let body = "";
  switch (type) {
    case "axe":
      body = handle(4) +
        `<path d="M14.5 6 L7 3.5 Q2.5 9.5 7 16 L14.5 12.5 Z" fill="${hm}" stroke="${LINE}" stroke-width="1.3" stroke-linejoin="round"/>` +
        `<path d="M7 3.5 Q2.5 9.5 7 16" fill="none" stroke="${hl}" stroke-width="1.6"/>` +
        `<path d="M12.5 7 L14.5 7.5 V11.5 L12.5 12 Z" fill="${hd}"/>` +
        `<rect x="17" y="6" width="3.2" height="5.5" rx="1" fill="${hd}" stroke="${LINE}" stroke-width="1.1"/>`;
      return wrap(body, -35);
    case "pickaxe":
      body = handle(7) +
        `<path d="M2.5 13 Q16 1 29.5 13 L28 14.5 Q16 6 4 14.5 Z" fill="${hm}" stroke="${LINE}" stroke-width="1.3" stroke-linejoin="round"/>` +
        `<path d="M5 12 Q16 3.5 27 12" fill="none" stroke="${hl}" stroke-width="1.2"/>` +
        `<rect x="13.5" y="6" width="5" height="4.5" rx="1" fill="${hd}" stroke="${LINE}" stroke-width="1.1"/>`;
      return wrap(body, -35);
    case "hammer":
      body = handle(9) +
        `<rect x="7" y="3.5" width="18" height="8" rx="1.5" fill="${hm}" stroke="${LINE}" stroke-width="1.3"/>` +
        `<rect x="8.5" y="4.8" width="15" height="2" rx="1" fill="${hl}"/>` +
        `<rect x="7" y="9.5" width="18" height="2" rx="1" fill="${hd}"/>`;
      return wrap(body, -35);
    case "rod":
      // All wood: a long thin rod with a thicker grip, a reel and a line.
      return svg(
        `<path d="M5 29 L27 3" stroke="${LINE}" stroke-width="3.6" stroke-linecap="round"/>` +
        `<path d="M5 29 L27 3" stroke="${wl}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M5 29 L11 22" stroke="${LINE}" stroke-width="5.6" stroke-linecap="round"/>` +
        `<path d="M5 29 L11 22" stroke="${wd}" stroke-width="3.8" stroke-linecap="round"/>` +
        `<path d="M27 3 Q29.5 12 27.5 21" fill="none" stroke="#e8edf2" stroke-width="0.9"/>` +
        `<circle cx="27.5" cy="22" r="1.6" fill="#d9443a" stroke="${LINE}" stroke-width="0.8"/>` +
        `<circle cx="12.5" cy="24" r="2.6" fill="#9aa1a8" stroke="${LINE}" stroke-width="1"/>`);
    case "tongs":
      return svg(
        `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="M3 30 L15 15 Q19 9 22 4 L26 3" stroke="${LINE}" stroke-width="4.5"/>` +
        `<path d="M9 31 L15 15 Q22 11 27 9 L29 6" stroke="${LINE}" stroke-width="4.5"/>` +
        `<path d="M3 30 L15 15 Q19 9 22 4 L26 3" stroke="${hm}" stroke-width="2.5"/>` +
        `<path d="M9 31 L15 15 Q22 11 27 9 L29 6" stroke="${hm}" stroke-width="2.5"/></g>` +
        `<circle cx="15" cy="15" r="2.6" fill="${hd}" stroke="${LINE}" stroke-width="1"/>`);
    case "pot":
      return svg(
        `<g stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round">` +
        `<path d="M2 13 h5 M25 13 h5" stroke-width="3.5" stroke-linecap="round"/>` +
        `<path d="M5 11 h22 v3 q0 14 -11 14 q-11 0 -11 -14 z" fill="${hm}"/>` +
        `<rect x="4" y="8.5" width="24" height="3.5" rx="1.5" fill="${hl}"/>` +
        `<path d="M13 8.5 q3 -4 6 0" fill="none" stroke-width="2.2"/></g>` +
        `<path d="M9 15 q0 8 5 10" fill="none" stroke="${hl}" stroke-width="1.6" stroke-linecap="round"/>`);
  }
  return svg("");
}

const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${inner}</svg>`;
/** Tilt an upright tool so it sits on the diagonal, like a tool emoji. */
const wrap = (inner: string, angle: number) => svg(`<g fill="none" transform="rotate(${angle} 16 16) translate(0 1)">${inner}</g>`);
