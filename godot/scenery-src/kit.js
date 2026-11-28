// Building blocks for made things: crafting stations, props, fences,
// bridges and buildings. Wood, stone, plaster, roof and metal materials, and
// shapes with soft, bevelled edges (the style guide asks for 1-3 cm bevels).
import { THREE, mat, softBox, boxUV, lathe, paint, mix, plankTexture, brickTexture, plasterTexture, roofTexture, stoneTexture, barkTexture, tint, limb } from "./lib.js";

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Materials (shared, so a building is only a few draw calls) ----------
export const M = {
  // shared library textures (godot/assets/textures), see lib.js
  wood: () => mat("planks", { lib: { name: "planks" }, roughness: 0.75 }),
  woodDark: () => mat("planks_dark", { lib: { name: "planks", tint: 0xa88a78 } }),
  log: () => mat("bark_oak", { lib: { name: "bark_oak" } }),
  stone: () => mat("stone_brick", { lib: { name: "stone_brick", ref: 0xe0dacd } }),
  rock: () => mat("rock", { lib: { name: "rock", ref: 0x9c9a94 } }),
  plaster: () => mat("plaster", { lib: { name: "plaster", ref: 0xf2ead8 } }),
  roof: () => mat("roof_tiles", { lib: { name: "roof_tiles", ref: 0xb4553a } }),
  roofSlate: () => mat("roof_slate", { lib: { name: "slate", ref: 0x5a6a80 } }),
  thatch: () => mat("thatch", { lib: { name: "thatch" } }),
  iron: () => mat("metal_iron", { lib: { name: "metal_iron" } }),
  brass: () => mat("metal_bronze", { lib: { name: "metal_bronze" } }),
  leather: () => mat("leather", { lib: { name: "leather" } }),
  ember: () => mat("embers", { lib: { name: "embers" }, emissiveIntensity: 3 }),
  // Emberfall's white stone (the Emberhall, shrines, the altar): kept as its own
  // light texture, because the library's stone_brick is a warm grey
  stoneWhite: () => mat("stone_white", { map: brickTexture(17, 4, 3), roughness: 0.85 }),
  // plain materials (no texture needed)
  cloth: () => mat("cloth", { roughness: 0.9 }),
  paper: () => mat("paper", { roughness: 0.9, double: true }),
  glass: () => mat("glass", { color: 0xcfeaf2, vertexColors: false, roughness: 0.05, transparent: true, opacity: 0.45 }),
  flame: () => mat("flame", { color: 0xffe08a, vertexColors: false, roughness: 1, emissive: 0xffa040, emissiveIntensity: 3.5 }),
  lamp: () => mat("lamp_glow", { color: 0xfff0c0, vertexColors: false, roughness: 1, emissive: 0xffc060, emissiveIntensity: 2.5 }),
  arcane: () => mat("arcane_glow", { color: 0xc8b0ff, vertexColors: false, roughness: 0.2, emissive: 0x8a5cff, emissiveIntensity: 2.2 }),
  foliage: () => mat("hedge", { roughness: 0.75 }),
};

/** A box with soft edges and textures at 1 repeat per `tex` metres. Origin at its centre. */
export function box(w, h, d, { bevel = 0.03, tex = 1, color = 0xffffff } = {}) {
  const g = softBox(w, h, d, Math.min(bevel, w / 3, h / 3, d / 3), 1);
  boxUV(g, tex);
  return tint(g, color);
}

/** A round post / log along Y, base at 0. */
export function post(r, h, { sides = 10, color = 0xffffff, taper = 1 } = {}) {
  const g = new THREE.CylinderGeometry(r * taper, r, h, sides, 1);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, r * 6.28), uv.getY(i) * h);
  return tint(g, color);
}

/** A cylinder lying along X (logs, rails, rollers). */
export function logX(r, len, opts = {}) {
  const g = post(r, len, opts);
  g.translate(0, -len / 2, 0);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** A turned shape (pots, barrels, flasks) from [radius, height] pairs, with colour. */
export function turned(profile, segs = 16, color = 0xffffff, texH = 1) {
  const g = lathe(profile, segs);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * texH);
  return tint(g, color);
}

/** A torus ring lying flat (hoops, rims). */
export function ring(R, r, color = 0xffffff, segs = 24) {
  const g = new THREE.TorusGeometry(R, r, 6, segs);
  g.rotateX(Math.PI / 2);
  return tint(g, color);
}

/** Soft shade: a little darker near the ground (AO), as the style guide allows. */
export const groundAO = (h = 1, amt = 0.25) => (v) => mix(new THREE.Color(1 - amt, 1 - amt, 1 - amt), 0xffffff, Math.min(1, v.y / h));

/**
 * A pitched (gable) roof over a w x d footprint, ridge along X, eaves at y = 0.
 * Two thick sloped slabs, so it has real edges and an overhang.
 */
export function gableRoof(b, material, w, d, rise, { over = 0.35, thick = 0.16, color = 0xffffff, at = [0, 0, 0], rotY = 0 } = {}) {
  const half = d / 2 + over;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  const base = new THREE.Matrix4().makeTranslation(at[0], at[1], at[2]).multiply(new THREE.Matrix4().makeRotationY(rotY));
  const place = (g, p, rx) => b.add(g, material, base.clone().multiply(new THREE.Matrix4().makeTranslation(...p)).multiply(new THREE.Matrix4().makeRotationX(rx)));
  for (const s of [-1, 1]) place(box(w + over * 2, thick, slope + 0.05, { bevel: 0.04, tex: 1.5, color }), [0, rise / 2, (s * half) / 2], s * ang);
  // ridge cap
  place(logX(thick * 0.9, w + over * 2, { color: mix(color, 0x000000, 0.15) }), [0, rise + thick * 0.3, 0], 0);
}

/** A triangular gable wall (fills the end of a pitched roof). Base width d, height rise, in the XY plane facing ±X. */
export function gable(d, rise, thick = 0.2, color = 0xffffff) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, rise); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  g.translate(0, 0, -thick / 2);
  g.rotateY(Math.PI / 2);
  boxUV(g, 1.5);
  return tint(g, color);
}

/** A cone roof (towers, wells), base at y = 0. */
export function coneRoof(r, h, segs = 16, color = 0xffffff) {
  const g = new THREE.ConeGeometry(r, h, segs, 2, false);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 4, uv.getY(i) * h);
  return tint(g, color);
}

/** A flame made of a few soft teardrops (emissive). */
export function flameGeo(h = 0.5, r = 0.18) {
  return turned([[0, 0], [r * 0.8, h * 0.12], [r, h * 0.3], [r * 0.6, h * 0.65], [r * 0.15, h * 0.92], [0, h]], 10);
}

export { limb };
