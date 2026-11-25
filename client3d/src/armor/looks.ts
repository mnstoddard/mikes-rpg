// What each armor material looks like: colours and how shiny it is.
// Metals shine (they reflect the sky), leather and cloth don't.

export type ArmorKind = "metal" | "leather" | "cloth";

export interface ArmorLook {
  name: string;
  kind: ArmorKind;
  /** The main colour. */
  main: string;
  /** Edges, bands and rims. */
  trim: string;
  /** Plumes, gems, buckles, lacing. */
  accent: string;
  /** Inside of cloaks and hoods; fur on leather. */
  lining: string;
  metalness: number;
  roughness: number;
  /** A faint glow (magic metals). */
  glow?: string;
  glowStrength?: number;
  /** Trim glows too (Thread-cut cloak, Radiant robes). */
  trimGlow?: number;
}

export type LookId =
  | "bronze" | "iron" | "steel" | "mithril" | "aurelite"
  | "leather" | "primeval" | "cloth"
  | "plain" | "radiant" | "ember" | "flame" | "silk" | "threadcut" | "halbrecht";

export const LOOKS: Record<LookId, ArmorLook> = {
  bronze:   { name: "Bronze",   kind: "metal",   main: "#c27c3e", trim: "#8a5226", accent: "#b8322a", lining: "#5c3a1e", metalness: 0.85, roughness: 0.38 },
  iron:     { name: "Iron",     kind: "metal",   main: "#7c7f85", trim: "#4c4f55", accent: "#3a5a8c", lining: "#3a2a1c", metalness: 0.8,  roughness: 0.5 },
  steel:    { name: "Steel",    kind: "metal",   main: "#d3d9e1", trim: "#98a2ae", accent: "#2a5fa8", lining: "#2c3e66", metalness: 0.92, roughness: 0.24 },
  mithril:  { name: "Mithril",  kind: "metal",   main: "#64bfd4", trim: "#e2f1f5", accent: "#1f3f88", lining: "#16304a", metalness: 0.88, roughness: 0.2, glow: "#0b4a5c", glowStrength: 0.35 },
  aurelite: { name: "Embersteel", kind: "metal",   main: "#f0cf7a", trim: "#fff1c9", accent: "#ff8a3c", lining: "#6b2a12", metalness: 0.9,  roughness: 0.2, glow: "#7a4a00", glowStrength: 0.45 },
  leather:  { name: "Leather",  kind: "leather", main: "#8a5733", trim: "#5a361d", accent: "#c9a45a", lining: "#cdb48f", metalness: 0, roughness: 0.78 },
  primeval: { name: "Primeval hide", kind: "leather", main: "#56633f", trim: "#2f3825", accent: "#e8dfc4", lining: "#7a6446", metalness: 0, roughness: 0.7 },
  cloth:    { name: "Cloth",    kind: "cloth",   main: "#3d5ba8", trim: "#e2b33c", accent: "#e2b33c", lining: "#2c3e66", metalness: 0, roughness: 0.9 },
  plain:    { name: "Plain linen", kind: "cloth", main: "#d9ccb0", trim: "#a8916a", accent: "#8e5a3c", lining: "#bfae8c", metalness: 0, roughness: 0.95 },
  radiant:  { name: "Radiant",  kind: "cloth",   main: "#f6f1e4", trim: "#f2c14e", accent: "#ffd76a", lining: "#e9dcc0", metalness: 0, roughness: 0.6, trimGlow: 0.9 },
  ember:    { name: "Ember",    kind: "cloth",   main: "#e0702a", trim: "#8a3a14", accent: "#f2c14e", lining: "#5a2410", metalness: 0, roughness: 0.85 },
  flame:    { name: "Flame",    kind: "cloth",   main: "#e9b23a", trim: "#fff0b8", accent: "#f2c14e", lining: "#a8321e", metalness: 0, roughness: 0.6, trimGlow: 0.35 },
  silk:     { name: "Silk",     kind: "cloth",   main: "#ecebf3", trim: "#bcc3d6", accent: "#c0c6d6", lining: "#d6d9e6", metalness: 0, roughness: 0.4 },
  threadcut:{ name: "Thread-cut", kind: "cloth", main: "#2c2833", trim: "#7fe3d6", accent: "#c9b98a", lining: "#17141c", metalness: 0, roughness: 0.85, trimGlow: 1.2 },
  halbrecht:{ name: "Halbrecht's", kind: "metal", main: "#c9d3de", trim: "#8fd0f0", accent: "#8fd0f0", lining: "#2c3e66", metalness: 0.9, roughness: 0.25, trimGlow: 0.5 },
};
