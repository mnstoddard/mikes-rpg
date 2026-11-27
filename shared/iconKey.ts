// Item pictures (version 0.21, Mike's note: icons that fit the game). Every item's
// picture is its real 3D model, drawn once into a picture sheet by
// tools/make-icons.ts (client3d/public/icons/items.png). Items that look the same
// share a picture: a sword's handle wood doesn't show at that size, a gem's carat
// doesn't either, and every stew is a bowl of stew. This turns an item id into its
// picture's name; the client looks the name up in the sheet's index and falls
// back to the emoji for anything without one.
import { isTool, parseTool } from "./tools";
import { isWeapon, parseWeapon } from "./gear";
import { parseGem } from "./jewelry";
import { parsePotion } from "./alchemy";
import { parseMeal } from "./cooking";

export function iconKey(id: string): string {
  // Enchanted gear ("sword_iron_oak+swift.20") looks like the plain one.
  const plus = id.indexOf("+");
  if (plus > 0) id = id.slice(0, plus);
  if (isWeapon(id)) {
    const { type, metal } = parseWeapon(id);
    return `${type}_${metal}`;
  }
  if (isTool(id)) {
    const { type, metal } = parseTool(id);
    return metal ? `${type}_${metal}` : type;
  }
  const g = parseGem(id);
  if (g) {
    if (g.kind === "rough" || g.kind === "cut") return `${g.kind}_${g.gem}`;
    if (g.kind === "soulstone") return "soulstone";
    if (g.kind === "soulgem") return g.souls ? "soulgem_full" : "soulgem";
    // Rings and amulets: the gem is what you see (plain ones show their metal).
    if (g.kind === "jewel") return `${g.type}_${g.gem ?? g.metal}`;
  }
  const p = parsePotion(id);
  if (p) return `potion_${p.type}`;
  const m = parseMeal(id);
  if (m) return `meal_${m.dish}`;
  return id;
}
