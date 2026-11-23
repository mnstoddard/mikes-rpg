// A character's look, as the server saves it (shared/look.ts): the Character
// Workshop's recipe as JSON. Anything missing uses the Workshop's defaults.
import { DEFAULT_RECIPE, recipeFromCode, type CharacterRecipe } from "../character";

export function lookToRecipe(look: string): CharacterRecipe | null {
  try { return recipeFromCode(look); } catch { return null; }
}

/** Only the settings that differ from the defaults, so the save stays small. */
export function recipeToLook(r: CharacterRecipe): string {
  const out: Record<string, unknown> = {};
  const d = DEFAULT_RECIPE as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(r)) if (v !== d[k] && k !== "name") out[k] = v;
  return JSON.stringify(out);
}
