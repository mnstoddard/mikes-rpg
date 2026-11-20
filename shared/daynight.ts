// Day and night: one full day lasts 40 minutes (30 of day, 10 of night), the
// same for everyone, worked out from the server's clock. Dusk and dawn each
// take 2 minutes. For now night only darkens the screen a little; night-only
// monsters and herbs come later (docs/DESIGN.md stage 5).
export const DAY_MS = 40 * 60_000;
export const NIGHT_MS = 10 * 60_000;
export const TWILIGHT_MS = 2 * 60_000;
/** How dark the screen gets at midnight (0 = not at all, 1 = black). Gentle for now. */
export const NIGHT_DARKNESS = 0.38;

/** Where in the day it is: 0 at sunrise, up to DAY_MS. */
export const timeOfDay = (now: number) => ((now % DAY_MS) + DAY_MS) % DAY_MS;

/** How dark it is, 0 (day) to 1 (full night). Dusk is the last 2 minutes of the day; dawn the last 2 of the night. */
export function darkness(now: number): number {
  const t = timeOfDay(now);
  const dusk = DAY_MS - NIGHT_MS - TWILIGHT_MS;
  if (t < dusk) return 0;
  if (t < DAY_MS - NIGHT_MS) return (t - dusk) / TWILIGHT_MS;
  if (t < DAY_MS - TWILIGHT_MS) return 1;
  return (DAY_MS - t) / TWILIGHT_MS;
}

export const isNight = (now: number) => darkness(now) >= 0.5;

/** Minutes until night falls (or until sunrise, at night), for the clock's tooltip. */
export function minutesUntilChange(now: number): number {
  const t = timeOfDay(now);
  const nightStart = DAY_MS - NIGHT_MS;
  return Math.ceil(((t < nightStart ? nightStart : DAY_MS) - t) / 60_000);
}
