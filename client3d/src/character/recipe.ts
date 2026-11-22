// A character "recipe": every setting from the Character Workshop (body,
// face, eyes, hair, clothes and colours). The same recipe always builds the
// same character, and the Workshop's "character code" (its JSON) loads here.

export interface CharacterRecipe {
  name: string;
  // Body
  frame: number; height: number; build: number; muscle: number;
  shoulders: number; hips: number; head: number; legs: number; skin: string;
  // Face
  faceWidth: number; faceLength: number; jaw: number; chin: number; cheeks: number; square: number;
  nose: "button" | "round" | "small" | "pointy" | "long"; noseSize: number;
  mouth: "smile" | "neutral" | "grin" | "smirk" | "frown"; mouthWidth: number;
  ears: "round" | "pointy" | "elf"; earSize: number; blush: "off" | "on";
  // Eyes
  eyeStyle: "classic" | "big" | "dots" | "sleepy"; eyeColor: string; eyeSize: number; eyeSpacing: number;
  eyeHeight: number; eyeTilt: number; lashes: "off" | "on"; browThick: number; browTilt: number;
  // Hair
  hairStyle: "bald" | "buzz" | "short" | "messy" | "spiky" | "quiff" | "bob" | "long" | "ponytail" | "bun" | "pigtails" | "mohawk" | "afro";
  hairColor: string; bangs: number; hairLength: number;
  beard: "none" | "stubble" | "mustache" | "goatee" | "full" | "wizard";
  // Clothes
  top: "tshirt" | "long" | "tank" | "tunic" | "robe"; bottom: "pants" | "shorts" | "skirt"; shoes: "boots" | "shoes" | "bare";
  belt: "off" | "on"; hat: "none" | "beanie" | "wizard" | "headband" | "crown"; glasses: "none" | "round" | "square";
  shirtColor: string; pantsColor: string; shoeColor: string; accentColor: string;
}

export const DEFAULT_RECIPE: CharacterRecipe = {
  name: "Wren",
  frame: 0, height: 1, build: 0.3, muscle: 0.35, shoulders: 1, hips: 1, head: 1.05, legs: 1, skin: "#e9b48a",
  faceWidth: 1, faceLength: 1, jaw: 0.9, chin: 1, cheeks: 0.3, square: 0.2, nose: "button", noseSize: 1,
  mouth: "smile", mouthWidth: 1, ears: "round", earSize: 1, blush: "off",
  eyeStyle: "classic", eyeColor: "#3a78c2", eyeSize: 1, eyeSpacing: 1, eyeHeight: 0, eyeTilt: 0, lashes: "off", browThick: 1, browTilt: 0,
  hairStyle: "short", hairColor: "#5e3a1f", bangs: 0.3, hairLength: 0.5, beard: "none",
  top: "tunic", bottom: "pants", shoes: "boots", belt: "on", hat: "none", glasses: "none",
  shirtColor: "#2a7867", pantsColor: "#5c4636", shoeColor: "#3b3f44", accentColor: "#8e5a3c",
};

/** The Workshop's ready-made characters (only what differs from the default). */
export const CHARACTER_PRESETS: { role: string; recipe: Partial<CharacterRecipe> }[] = [
  { role: "Adventurer", recipe: {} },
  { role: "Adventurer (female)", recipe: { name: "Ada", frame: 1, hairStyle: "ponytail", lashes: "on", hairColor: "#8b5b2c" } },
  { role: "Blacksmith", recipe: { name: "Brom", frame: 0, height: 1.02, build: 0.65, muscle: 0.95, shoulders: 1.15, head: 1, skin: "#b97b4c", jaw: 1.1, square: 0.7, chin: 1.05, nose: "round", noseSize: 1.2, mouth: "neutral", browThick: 1.8, browTilt: 0.6, eyeStyle: "classic", eyeColor: "#5a3a1e", hairStyle: "buzz", hairColor: "#1b1613", beard: "full", top: "tank", bottom: "pants", shoes: "boots", belt: "on", shirtColor: "#5c4636", pantsColor: "#3b3f44", shoeColor: "#1f2124", accentColor: "#8e5a3c" } },
  { role: "Elf ranger", recipe: { name: "Sylra", frame: 0.85, height: 1.12, build: 0.05, muscle: 0.35, legs: 1.12, head: 0.98, skin: "#ffe3cc", faceLength: 1.08, jaw: 0.75, chin: 1.1, cheeks: 0.9, square: 0, nose: "small", mouth: "smirk", ears: "elf", earSize: 1.2, eyeStyle: "big", eyeColor: "#49a86a", eyeTilt: 0.6, lashes: "on", browThick: 0.7, browTilt: 0.3, hairStyle: "long", hairColor: "#f2e4b8", bangs: 0.2, hairLength: 0.8, beard: "none", top: "long", bottom: "pants", shoes: "boots", belt: "on", shirtColor: "#5a8f3c", pantsColor: "#5c4636", shoeColor: "#3a2517", accentColor: "#8e5a3c" } },
  { role: "Farm kid", recipe: { name: "Pip", frame: 0.3, height: 0.86, build: 0.3, muscle: 0.1, legs: 0.88, head: 1.3, shoulders: 0.88, skin: "#e9b48a", faceWidth: 1.08, jaw: 0.95, chin: 0.92, square: 0, nose: "button", noseSize: 0.8, mouth: "grin", mouthWidth: 1.2, blush: "on", eyeStyle: "big", eyeSize: 1.3, eyeColor: "#8a6a2c", browThick: 0.8, browTilt: -0.2, hairStyle: "spiky", hairColor: "#d9782b", hairLength: 0.3, beard: "none", top: "tshirt", bottom: "shorts", shoes: "shoes", belt: "off", hat: "none", shirtColor: "#e8c547", pantsColor: "#3a6ea5", shoeColor: "#8e5a3c" } },
  { role: "Orc guard", recipe: { name: "Grukk", frame: 0, height: 1.1, build: 0.6, muscle: 1, shoulders: 1.2, head: 0.95, skin: "#86b064", faceWidth: 1.12, jaw: 1.15, chin: 0.95, square: 0.85, cheeks: 0.1, nose: "round", noseSize: 1.25, mouth: "frown", mouthWidth: 1.3, ears: "pointy", earSize: 1.1, eyeStyle: "dots", eyeSize: 0.8, eyeTilt: 0.4, browThick: 1.9, browTilt: 1, hairStyle: "mohawk", hairColor: "#1b1613", hairLength: 0.6, beard: "none", top: "tank", bottom: "pants", shoes: "boots", belt: "on", hat: "none", shirtColor: "#3b3f44", pantsColor: "#5c4636", shoeColor: "#1f2124", accentColor: "#c0392b" } },
  { role: "Queen", recipe: { name: "Isolde", frame: 1, height: 1.02, build: 0.2, muscle: 0.15, head: 1.02, skin: "#714528", faceLength: 1.05, jaw: 0.8, chin: 1.05, cheeks: 0.8, nose: "small", mouth: "neutral", eyeStyle: "classic", eyeColor: "#d08d1a", lashes: "on", eyeTilt: 0.3, browThick: 0.8, browTilt: 0.2, hairStyle: "afro", hairColor: "#1b1613", hairLength: 0.4, beard: "none", top: "robe", bottom: "skirt", shoes: "shoes", belt: "on", hat: "crown", shirtColor: "#a44a6e", pantsColor: "#a44a6e", shoeColor: "#e8c547", accentColor: "#e8c547" } },
];

/** A full recipe from a partial one (missing settings use the defaults). */
export function makeRecipe(p: Partial<CharacterRecipe> = {}): CharacterRecipe {
  return { ...DEFAULT_RECIPE, ...p };
}

/** Load a Workshop "character code" (JSON text or object). Unknown keys are ignored. */
export function recipeFromCode(code: string | object): CharacterRecipe {
  const o = (typeof code === "string" ? JSON.parse(code) : code) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...DEFAULT_RECIPE };
  for (const k of Object.keys(DEFAULT_RECIPE)) {
    const v = o[k];
    if (v !== undefined && typeof v === typeof (DEFAULT_RECIPE as unknown as Record<string, unknown>)[k]) out[k] = v;
  }
  return out as unknown as CharacterRecipe;
}
