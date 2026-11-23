// How a 3D character looks: the Character Workshop's "recipe" (body, face,
// hair, clothes and colours), sent by the 3D game's character creator and
// saved with the character. The server only checks it's small and tidy;
// the 3D game fills in anything missing with its defaults.

/** Longest look the server keeps (as JSON text). */
export const LOOK_MAX = 2000;

/**
 * A tidy copy of a look as JSON text, or null if it isn't one.
 * Only short names with numbers or short words are kept.
 */
export function cleanLook(raw: unknown): string | null {
  let o: unknown = raw;
  if (typeof raw === "string") {
    if (raw.length > LOOK_MAX) return null;
    try { o = JSON.parse(raw); } catch { return null; }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const out: Record<string, string | number> = {};
  let n = 0;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (!/^[a-zA-Z]{1,20}$/.test(k) || ++n > 80) continue;
    if (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100) out[k] = Math.round(v * 1000) / 1000;
    else if (typeof v === "string" && /^[#a-zA-Z0-9 _-]{0,24}$/.test(v)) out[k] = v;
  }
  const text = JSON.stringify(out);
  return text.length <= LOOK_MAX ? text : null;
}
