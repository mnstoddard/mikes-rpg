"""Emberfall Godot texture library generator.
Usage: python3 gen.py OUT_DIR [name ...]
Writes OUT_DIR/<name>/<name>_albedo.png, _normal.png, _orm.png (+ _emission.png when glowing)
and OUT_DIR/manifest.json describing every material."""
import sys, os, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from texlib import *

R = {}
def recipe(name, cat, size, desc, metal=0.0, **extra):
    def deco(fn):
        R[name] = dict(fn=fn, cat=cat, size=size, desc=desc, metal=metal, extra=extra); return fn
    return deco

def wobble(n, seed, s=60, amt=1.0): return fnoise(n, seed, s) * amt

# ---------------- GROUND ----------------
@recipe("grass", "Ground", 1024, "Meadow grass, the main ground of the open world. Repeats every 2 m.")
def _(n):
    big = fnoise(n, 1, 260); mid = fnoise(n, 2, 50); fine = fnoise(n, 3, 3, 1.4)
    blades = fnoise(n, 4, 2.5, 2.0, aniso=(1.0, 0.35))
    t = norm01(big * 0.8 + mid * 0.5 + blades * 0.25)
    col = ramp(t, [(0, "#3F8A2E"), (0.45, "#6DB33F"), (0.8, "#8CC94F"), (1, "#A6D964")])
    warm = norm01(fnoise(n, 5, 180)) ; col = lerp(col, col * hexc("#E8E070") * 1.15, (warm > 0.78) * 0.35)
    h = blades * 0.6 + fine * 0.4 + mid * 0.3
    col = shade(col, 0.9 + 0.12 * norm01(blades))
    return col, h, 0.92 - 0.06 * norm01(blades)

@recipe("grass_lush", "Ground", 1024, "Deeper green grass with clover and tiny flowers, for valleys and gardens.")
def _(n):
    col, h, rgh = R["grass"]["fn"](n)
    col = lerp(col, col * hexc("#4FA34A") * 1.3, 0.35)
    f1, f2, cid = voronoi(n, 900, 11)
    pick = cell_values(cid, 900, 12)
    dot = np.clip(1 - f1 / 3.2, 0, 1) ** 0.7
    for lo, hi, c in [(0, 0.035, "#FFD75A"), (0.035, 0.06, "#F8F4EC"), (0.06, 0.075, "#F28AB2"), (0.075, 0.085, "#7FB8F0")]:
        m = ((pick >= lo) & (pick < hi)) * dot
        col = lerp(col, np.broadcast_to(hexc(c), col.shape), m)
        h = h + m * 1.5
    return col, h, rgh

@recipe("dirt", "Ground", 1024, "Bare soil for fields edges, digging spots and forest paths.")
def _(n):
    big = fnoise(n, 21, 200); mid = fnoise(n, 22, 30); fine = fnoise(n, 23, 2.5)
    f1, f2, cid = voronoi(n, 500, 24)
    pebble = np.clip(1 - f1 / 6, 0, 1) * (cell_values(cid, 500, 25) > 0.7)
    t = norm01(big * 0.7 + mid * 0.5 + fine * 0.2)
    col = ramp(t, [(0, "#6B4A30"), (0.5, "#8E6643"), (1, "#B08559")])
    col = lerp(col, np.broadcast_to(hexc("#A49A8C"), col.shape), pebble * 0.85)
    h = mid * 0.5 + fine * 0.3 + pebble * 2.5
    return col, h, 0.95

@recipe("path", "Ground", 1024, "Packed earth road, worn smooth by travellers.")
def _(n):
    big = fnoise(n, 31, 240); mid = fnoise(n, 32, 40); fine = fnoise(n, 33, 2)
    f1, f2, cid = voronoi(n, 700, 34)
    grit = np.clip(1 - f1 / 3.5, 0, 1) * (cell_values(cid, 700, 35) > 0.55)
    t = norm01(big * 0.6 + mid * 0.6)
    col = ramp(t, [(0, "#A88458"), (0.5, "#C9A574"), (1, "#DCBF8E")])
    col = lerp(col, col * 0.82, grit * 0.6)
    h = mid * 0.3 + fine * 0.15 + grit * 1.2
    return col, h, 0.9

@recipe("sand", "Ground", 1024, "Soft beach and riverbank sand with gentle wind ripples.")
def _(n):
    w = fnoise(n, 41, 120) * 0.08
    rip = periodic_lines(n, 28, 0, warp=w + fnoise(n, 42, 300) * 0.04)
    fine = fnoise(n, 43, 1.5)
    t = norm01(fnoise(n, 44, 220) * 0.6 + rip * 0.4)
    col = ramp(t, [(0, "#D9BF88"), (0.6, "#E8D3A0"), (1, "#F3E4BC")])
    col = shade(col, 0.95 + 0.05 * norm01(fine))
    return col, rip * 0.6 + fine * 0.08, 0.93

@recipe("mud", "Ground", 1024, "Wet mud by rivers and swamps, shiny in the dips.")
def _(n):
    big = fnoise(n, 51, 140); mid = fnoise(n, 52, 25)
    h = big * 0.7 + mid * 0.4
    wet = norm01(-h) > 0.62
    col = ramp(norm01(h), [(0, "#4A3322"), (0.5, "#6B4A30"), (1, "#80603F")])
    col = lerp(col, col * 0.7, wet * 0.6)
    return col, h, np.where(wet, 0.25, 0.85)

@recipe("farmland", "Ground", 1024, "Tilled farm soil in rows, for the farm plots.")
def _(n):
    w = fnoise(n, 61, 150) * 0.012
    rows = periodic_lines(n, 8, 1, warp=w, sharp=1.0)
    clod = fnoise(n, 62, 6); fine = fnoise(n, 63, 2)
    h = rows * 1.5 + clod * 0.35 + fine * 0.1
    col = ramp(norm01(h), [(0, "#4C321F"), (0.5, "#6E4A2E"), (1, "#8E6440")])
    return col, h, 0.95

@recipe("forest_floor", "Ground", 1024, "Shady woodland floor with fallen leaves, needles and moss.")
def _(n):
    base = fnoise(n, 71, 160)
    col = ramp(norm01(base), [(0, "#4B3A26"), (0.5, "#6B5236"), (1, "#5E7A35")])
    h = fnoise(n, 72, 20) * 0.3
    f1, f2, cid = voronoi(n, 1400, 73)
    v = cell_values(cid, 1400, 74)
    leaf = np.clip(1 - f1 / 9, 0, 1) ** 0.6 * (v > 0.35)
    lc = ramp(cell_values(cid, 1400, 75), [(0, "#A8642E"), (0.4, "#C98A3A"), (0.7, "#8E5A2A"), (1, "#7C8F3A")])
    col = lerp(col, lc, leaf * 0.9)
    h = h + leaf * (0.8 + v)
    return col, h, 0.85

@recipe("snow", "Ground", 1024, "Fresh snow for mountain tops, soft and slightly blue in the shade.")
def _(n):
    big = fnoise(n, 81, 200); mid = fnoise(n, 82, 30); sp = fnoise(n, 83, 1.2)
    h = big * 0.6 + mid * 0.3
    col = ramp(norm01(h), [(0, "#C9D8EC"), (0.6, "#EAF1FA"), (1, "#F6F9FD")])
    sparkle = (sp > 2.6) * 0.15
    return col, h, 0.75 - sparkle * 2

# ---------------- STONE ----------------
@recipe("rock", "Stone", 1024, "Everyday grey rock for boulders, cliffs and mining rocks.")
def _(n):
    f1, f2, cid = voronoi(n, 40, 91)
    facets = norm01(cell_values(cid, 40, 92))
    crack = np.clip(1 - (f2 - f1) / 5, 0, 1) ** 2
    big = fnoise(n, 93, 120); mid = fnoise(n, 94, 18); fine = fnoise(n, 95, 2.5)
    h = facets * 1.2 + big * 0.5 + mid * 0.25 + fine * 0.1 - crack * 1.5
    col = ramp(norm01(big * 0.6 + facets * 0.6 + mid * 0.2), [(0, "#7E7C76"), (0.5, "#9C9A94"), (1, "#B9B6AE")])
    col = lerp(col, col * 0.55, crack * 0.8)
    return col, h, 0.85

@recipe("rock_mossy", "Stone", 1024, "Rock with moss growing on its upper faces, for forests and old ruins.")
def _(n):
    col, h, r = R["rock"]["fn"](n)
    m = norm01(fnoise(n, 101, 70) + h * 0.4) > 0.5
    mt = blur(m.astype(np.float32), 4)
    moss = ramp(norm01(fnoise(n, 102, 6)), [(0, "#4E7A2E"), (1, "#86AE4A")])
    col = lerp(col, moss, mt)
    return col, h + mt * fnoise(n, 103, 3) * 0.3, r * (1 - mt) + 0.9 * mt

@recipe("slate", "Stone", 1024, "Dark layered slate for mountain cliffs and roof stone.")
def _(n):
    w = fnoise(n, 111, 200) * 0.04
    layers = fnoise(n, 112, 30, 2.0, aniso=(0.12, 1.0))
    h = layers * 0.8 + fnoise(n, 113, 4) * 0.15
    col = ramp(norm01(layers + fnoise(n, 114, 150) * 0.5), [(0, "#4D545C"), (0.5, "#6E7680"), (1, "#8A939C")])
    return col, h, 0.7

@recipe("sandstone", "Stone", 1024, "Warm banded sandstone for desert cliffs and city foundations.")
def _(n):
    bands = fnoise(n, 121, 40, 2.0, aniso=(0.08, 1.0))
    h = bands * 0.6 + fnoise(n, 122, 5) * 0.2
    col = ramp(norm01(bands + fnoise(n, 123, 100) * 0.4), [(0, "#B98E5E"), (0.5, "#D2B58A"), (1, "#E6CFA6")])
    return col, h, 0.88

@recipe("cobblestone", "Stone", 1024, "Rounded cobbles for Emberhold's streets and market square.")
def _(n):
    f1, f2, cid = voronoi(n, 120, 131)
    edge = f2 - f1
    dome = np.clip(edge / 14, 0, 1) ** 0.5
    v = cell_values(cid, 120, 132)
    h = dome * 2 + fnoise(n, 133, 4) * 0.1
    col = ramp(v * 0.7 + norm01(fnoise(n, 134, 20)) * 0.3, [(0, "#7A766F"), (0.5, "#8F8B83"), (1, "#A9A49A")])
    grout = np.clip(1 - edge / 4, 0, 1)
    col = lerp(col, np.broadcast_to(hexc("#5B5148"), col.shape), grout)
    col = shade(col, 0.85 + 0.15 * dome)
    return col, h, 0.8 - dome * 0.1

@recipe("flagstone", "Stone", 1024, "Big flat paving slabs for halls, plazas and the Emberhall floor.")
def _(n):
    f1, f2, cid = voronoi(n, 28, 141)
    edge = f2 - f1
    v = cell_values(cid, 28, 142)
    slab = np.clip(edge / 6, 0, 1)
    h = slab * 1.0 + v * 0.3 + fnoise(n, 143, 15) * 0.1
    col = ramp(v * 0.6 + norm01(fnoise(n, 144, 60)) * 0.4, [(0, "#9C968C"), (0.5, "#B3ADA2"), (1, "#C8C1B4")])
    col = lerp(col, np.broadcast_to(hexc("#6A6158"), col.shape), 1 - slab)
    return col, h, 0.8

@recipe("stone_brick", "Stone", 1024, "Cut stone blocks for castle walls, the Emberhall and city gates.")
def _(n):
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    rows = 8; bh = n / rows; bw = n / 4
    r = (ys // bh).astype(int)
    off = (r % 2) * bw / 2
    xx = (xs + off) % bw; yy = ys % bh
    bid = r * 4 + ((xs + off) // bw).astype(int) % 4
    mx = np.minimum(xx, bw - xx); my = np.minimum(yy, bh - yy)
    m = np.minimum(mx, my)
    gw = 6
    bevel = np.clip((m - gw) / 10, 0, 1)
    v = rng(151).random(rows * 4 + 4)[bid]
    h = bevel * 1.5 + fnoise(n, 152, 12) * 0.2 + v * 0.2
    col = ramp(v * 0.6 + norm01(fnoise(n, 153, 40)) * 0.4, [(0, "#8F8A80"), (0.5, "#A8A196"), (1, "#C2BBAE")])
    col = lerp(col, np.broadcast_to(hexc("#6B6258"), col.shape), (m < gw) * 1.0)
    col = shade(col, 0.88 + 0.12 * bevel)
    return col, h, 0.85

# ---------------- WOOD ----------------
WOODS = {"pine": ("#D2AE73", "#A07C45"), "oak": ("#9C6C3F", "#6E4826"), "birch": ("#ECE2CC", "#C9B994"),
         "maple": ("#BB6A3C", "#864424"), "yew": ("#8E3D2B", "#5C2219"), "ironwood": ("#737A7F", "#4B5155"),
         "elderwood": ("#6E4F96", "#45306A")}
def wood_grain(n, seed, light, dark):
    warp = fnoise(n, seed, 120, 4.0, aniso=(1.0, 0.2)) * 0.015 + fnoise(n, seed + 1, 30, 4.0, aniso=(1.0, 0.2)) * 0.002
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32) / n
    rings = (0.5 + 0.5 * np.sin(2 * np.pi * (xs * 22 + warp * 40))) ** 3
    streak = fnoise(n, seed + 2, 3, 2.0, aniso=(1.0, 0.05))
    t = norm01(rings * 0.8 + streak * 0.07 + fnoise(n, seed + 3, 150) * 0.08)
    col = ramp(t, [(0, light), (0.55, light), (1, dark)])
    col = lerp(col, np.broadcast_to(hexc(dark), col.shape), (rings > 0.85) * 0.25)
    h = -rings * 0.4 + streak * 0.25
    return col, h
for _w, (_l, _d) in WOODS.items():
    def _mk(w=_w, l=_l, d=_d):
        def f(n):
            col, h = wood_grain(n, 200 + list(WOODS).index(w) * 10, l, d)
            r = 0.75
            if w == "ironwood": r = 0.6
            return col, h, r
        return f
    extra = {}
    if _w == "elderwood": extra = dict(emission="#7B4FBF", emission_energy=0.3)
    R[f"wood_{_w}"] = dict(fn=_mk(), cat="Wood", size=512, desc=f"{_w.capitalize()} wood grain for tool handles, bows, staffs and furniture.",
                           metal=0.3 if _w == "ironwood" else 0.0, extra=extra)

@recipe("planks", "Wood", 1024, "Oak floorboards and wall planks for houses, docks and the farm.")
def _(n):
    boards = 6; ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    bw = n / boards; b = (xs // bw).astype(int)
    col = np.zeros((n, n, 3), np.float32); h = np.zeros((n, n), np.float32)
    cg, hg = wood_grain(n, 301, "#A87445", "#6E4826")
    cg = np.transpose(cg, (1, 0, 2)); hg = hg.T
    shift = (rng(302).random(boards) * n).astype(int)
    tone = 0.88 + rng(303).random(boards) * 0.2
    for i in range(boards):
        m = b == i
        rolled = np.roll(cg, shift[i], 0); rh = np.roll(hg, shift[i], 0)
        col[m] = rolled[m] * tone[i]; h[m] = rh[m]
    gx = np.minimum(xs % bw, bw - xs % bw)
    gap = np.clip(gx / 4, 0, 1)
    endy = (ys + (b * 397) % n) % (n / 2); endgap = np.clip(np.minimum(endy, n / 2 - endy) / 3, 0, 1)
    g = np.minimum(gap, endgap)
    col = shade(col, 0.45 + 0.55 * g); h = h + g * 1.0
    return col, h, 0.75

@recipe("bark_pine", "Wood", 1024, "Deep-grooved pine bark for pine trees.")
def _(n):
    ridges = fnoise(n, 311, 14, 2.2, aniso=(1.0, 0.12))
    plates = voronoi(n, 60, 312)
    h = ridges * 1.0 + norm01(plates[1] - plates[0]) * 0.8
    col = ramp(norm01(h), [(0, "#3E2A1E"), (0.5, "#6A4A32"), (1, "#8F6A4A")])
    return col, h, 0.9

@recipe("bark_oak", "Wood", 1024, "Chunky oak bark for oak and maple trees.")
def _(n):
    ridges = fnoise(n, 321, 10, 2.0, aniso=(1.0, 0.2))
    h = ridges * 1.0 + fnoise(n, 322, 3) * 0.15
    col = ramp(norm01(h), [(0, "#3A2C22"), (0.5, "#5E4A3A"), (1, "#7E6A55")])
    moss = blur((fnoise(n, 323, 60) > 1.0).astype(np.float32), 6)
    col = lerp(col, np.broadcast_to(hexc("#5E8F3A"), col.shape), moss * 0.6)
    return col, h, 0.9

@recipe("bark_birch", "Wood", 1024, "White birch bark with dark marks for birch trees.")
def _(n):
    base = ramp(norm01(fnoise(n, 331, 80)), [(0, "#DCD6C8"), (1, "#F2EEE4")])
    marks = fnoise(n, 332, 8, 2.2, aniso=(0.08, 1.0))
    dark = (marks > 1.4) * 1.0
    dark = blur(dark, 1.2)
    col = lerp(base, np.broadcast_to(hexc("#3C3A36"), base.shape), np.clip(dark * 1.3, 0, 1))
    h = -dark * 0.8 + fnoise(n, 333, 4) * 0.1
    return col, h, 0.8

# ---------------- METAL ----------------
METALS = {"bronze": ("#D99C52", 0.3, None), "iron": ("#8D9197", 0.5, None), "steel": ("#D5DBE1", 0.26, None),
          "mithril": ("#7CC4EE", 0.22, ("#2A6FA8", 0.35)), "copper": ("#C87447", 0.35, None), "silver": ("#E3E6EA", 0.2, None),
          "gold": ("#F2C14E", 0.22, None), "platinum": ("#DCE3E6", 0.18, None), "iridium": ("#B9B2D8", 0.2, None),
          "embersteel": ("#F3C64F", 0.25, ("#B07A10", 0.45))}
for _m, (_c, _r, _e) in METALS.items():
    def _mk(c=_c, r=_r, seed=400 + len(R)):
        def f(n):
            brush = fnoise(n, seed, 2, 2.0, aniso=(0.04, 1.0))
            smudge = fnoise(n, seed + 1, 90)
            scratch = (fnoise(n, seed + 2, 1.5, 2.0, aniso=(1.0, 0.02)) > 2.6) * 1.0
            base = hexc(c)
            col = np.broadcast_to(base, (n, n, 3)) * (0.94 + 0.04 * norm01(brush) + 0.04 * norm01(smudge))[..., None]
            rough = np.clip(r + 0.06 * smudge + 0.03 * brush - scratch * 0.1, 0.05, 1)
            return col, brush * 0.05 - scratch * 0.3, rough
        return f
    extra = dict(emission=_e[0], emission_energy=_e[1]) if _e else {}
    R[f"metal_{_m}"] = dict(fn=_mk(), cat="Metal", size=512, desc=f"Brushed {_m} for tool heads, weapons, armor and jewellery.", metal=1.0, extra=extra)

@recipe("metal_rusty_iron", "Metal", 512, "Old iron with soft rust, for gates, chains and abandoned mines.", metal=1.0)
def _(n):
    col, h, r = R["metal_iron"]["fn"](n)
    rust = blur((fnoise(n, 451, 30) + fnoise(n, 452, 4) * 0.4 > 0.6).astype(np.float32), 2)
    rc = ramp(norm01(fnoise(n, 453, 5)), [(0, "#7A3E1E"), (1, "#B5652E")])
    col = lerp(col, rc, rust)
    return col, h + rust * 0.4, r * (1 - rust) + 0.85 * rust, 1 - rust

# ---------------- WATER ----------------
@recipe("water", "Water", 1024, "Normal map for lakes, rivers and the sea. Colour comes from the water shader's depth tint.")
def _(n):
    w1 = fnoise(n, 501, 60, 2.5); w2 = fnoise(n, 502, 18, 2.5, aniso=(1.0, 0.7))
    h = w1 * 0.6 + w2 * 0.4
    col = ramp(norm01(h), [(0, "#1E5F9E"), (0.5, "#2F9FCF"), (1, "#5FD0D8")])
    return col, h, 0.05

@recipe("foam", "Water", 512, "Soft white foam for shorelines, waterfalls and boat wakes. Use as a mask.")
def _(n):
    f1, f2, cid = voronoi(n, 160, 511)
    cells = np.clip((f2 - f1) / 10, 0, 1)
    m = norm01(fnoise(n, 512, 30)) * (1 - cells * 0.8)
    col = lerp(np.broadcast_to(hexc("#9FD9E8"), (n, n, 3)), np.broadcast_to(hexc("#F2FBFF"), (n, n, 3)), np.clip(m * 1.5, 0, 1))
    return col, m, 0.3, 0.0, np.clip(m * 1.6, 0, 1)

# ---------------- FOLIAGE ----------------
def leaf_cluster(n, seed, cols, count):
    """Leaf card: many soft leaf shapes with alpha."""
    r = rng(seed)
    alpha = np.zeros((n, n), np.float32); col = np.zeros((n, n, 3), np.float32); h = np.zeros((n, n), np.float32)
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    for i in range(count):
        cx, cy = r.random(2) * n; ang = r.random() * np.pi * 2; L = n * (0.06 + r.random() * 0.05); W = L * 0.45
        dx = xs - cx; dy = ys - cy
        dx = (dx + n / 2) % n - n / 2; dy = (dy + n / 2) % n - n / 2
        u = dx * np.cos(ang) + dy * np.sin(ang); v = -dx * np.sin(ang) + dy * np.cos(ang)
        t = u / L
        inside = (t > -1) & (t < 1) & (np.abs(v) < W * np.sqrt(np.clip(1 - t * t, 0, 1)))
        if not inside.any(): continue
        c = hexc(cols[r.integers(len(cols))]) * (0.85 + r.random() * 0.3)
        shadeL = 0.8 + 0.2 * (t * 0.5 + 0.5)
        vein = np.clip(1 - np.abs(v) / (W * 0.08), 0, 1) * 0.15
        col[inside] = c * (shadeL[inside] + vein[inside])[:, None]
        h[inside] = 1 - np.abs(v[inside]) / W * 0.5 + i * 0.002
        alpha[inside] = 1
    return col, h, alpha

@recipe("leaves_broad", "Foliage", 512, "Broadleaf card (oak, maple, birch canopies). Alpha cut-out.")
def _(n):
    col, h, a = leaf_cluster(n, 601, ["#4E9A3A", "#5FAE42", "#3F8A2E", "#78BE4C"], 260)
    return col, h, 0.7, 0.0, a

@recipe("leaves_autumn", "Foliage", 512, "Autumn leaf card for maple trees and fall areas. Alpha cut-out.")
def _(n):
    col, h, a = leaf_cluster(n, 611, ["#E0913A", "#D2622E", "#F2B84A", "#B8452A"], 260)
    return col, h, 0.7, 0.0, a

@recipe("pine_needles", "Foliage", 512, "Pine and yew needle card. Alpha cut-out.")
def _(n):
    r = rng(621); ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    a = np.zeros((n, n), np.float32); col = np.zeros((n, n, 3), np.float32); h = np.zeros((n, n), np.float32)
    for i in range(170):
        cx, cy = r.random(2) * n; ang = r.random() * np.pi * 2; L = n * 0.12
        dx = (xs - cx + n / 2) % n - n / 2; dy = (ys - cy + n / 2) % n - n / 2
        u = dx * np.cos(ang) + dy * np.sin(ang); v = -dx * np.sin(ang) + dy * np.cos(ang)
        stem = (np.abs(v) < 2.5) & (u > 0) & (u < L)
        needles = (u > 0) & (u < L) & (np.abs(v) < L * 0.35 * (1 - u / L)) & ((np.abs((u - np.abs(v) * 0.9) % 9)) < 2.2)
        m = stem | needles
        c = hexc(["#2F6E3A", "#3B7F44", "#4E9150"][i % 3])
        col[m] = c * (0.8 + 0.4 * r.random()); a[m] = 1; h[m] = 0.5 + 0.5 * (1 - np.abs(v[m]) / (L * 0.35))
    return col, h, 0.75, 0.0, a

@recipe("grass_blades", "Foliage", 512, "Grass tuft card for 3D grass you walk through. Alpha cut-out.")
def _(n):
    r = rng(631); ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    a = np.zeros((n, n), np.float32); col = np.zeros((n, n, 3), np.float32); h = np.zeros((n, n), np.float32)
    for i in range(55):
        x0 = r.random() * n; ht = n * (0.5 + r.random() * 0.48); wd = n * (0.012 + r.random() * 0.012); bend = (r.random() - 0.5) * n * 0.25
        t = np.clip((n - ys) / ht, 0, 1)
        cx = x0 + bend * t * t
        dx = (xs - cx + n / 2) % n - n / 2
        m = (np.abs(dx) < wd * (1 - t)) & (ys > n - ht)
        c = ramp(t, [(0, "#3F8A2E"), (0.6, "#6DB33F"), (1, "#B5DE6E")])
        col[m] = c[m]; a[m] = 1; h[m] = 1 - np.abs(dx[m]) / wd
    return col, h, 0.75, 0.0, a

@recipe("moss", "Foliage", 512, "Soft cushion moss for rocks, roofs and tree roots.")
def _(n):
    h = fnoise(n, 641, 6) * 0.6 + fnoise(n, 642, 1.5) * 0.4 + fnoise(n, 643, 60) * 0.5
    col = ramp(norm01(h), [(0, "#3E6B26"), (0.5, "#5E8F3A"), (1, "#9CC45A")])
    return col, h, 0.92

# ---------------- CLOTH & HIDE ----------------
def weave(n, seed, freq, c1, c2, slub=0.3):
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32) / n
    wx = np.sin(2 * np.pi * xs * freq); wy = np.sin(2 * np.pi * ys * freq)
    cellx = np.floor(xs * freq * 2); celly = np.floor(ys * freq * 2)
    over = ((cellx + celly) % 2 == 0)
    thread = np.where(over, np.abs(np.sin(np.pi * ys * freq * 2)), np.abs(np.sin(np.pi * xs * freq * 2)))
    sl = fnoise(n, seed, 30, 2.0, aniso=(1.0, 0.05)) * slub
    h = thread + sl * 0.3
    col = ramp(norm01(thread * 0.6 + sl + fnoise(n, seed + 1, 120) * 0.2), [(0, c2), (1, c1)])
    return col, h

@recipe("linen", "Cloth", 512, "Plain undyed linen for shirts, robes, sacks and banners.")
def _(n):
    col, h = weave(n, 701, 48, "#EFE6D2", "#CDBF9F"); return col, h, 0.9

@recipe("wool_red", "Cloth", 512, "Red dyed wool for cloaks and Emberguard banners.")
def _(n):
    col, h = weave(n, 711, 32, "#C4544A", "#8E3028", 0.5); return col, h + fnoise(n, 712, 1.2) * 0.2, 0.95

@recipe("wool_blue", "Cloth", 512, "Blue dyed wool for clothes and mage robes.")
def _(n):
    col, h = weave(n, 721, 32, "#4F74B8", "#2D4A82", 0.5); return col, h + fnoise(n, 722, 1.2) * 0.2, 0.95

@recipe("wool_green", "Cloth", 512, "Green dyed wool for rangers' and farmers' clothes.")
def _(n):
    col, h = weave(n, 731, 32, "#5E9152", "#3A6332", 0.5); return col, h + fnoise(n, 732, 1.2) * 0.2, 0.95

@recipe("burlap", "Cloth", 512, "Rough sacking for grain sacks, targets and the training dummies.")
def _(n):
    col, h = weave(n, 741, 14, "#C9A86E", "#8C6E40", 0.8); return col, h, 0.95

@recipe("leather", "Cloth", 512, "Tanned leather for armor, belts, boots, bags and book covers.")
def _(n):
    f1, f2, cid = voronoi(n, 900, 751)
    pores = np.clip((f2 - f1) / 3, 0, 1)
    big = fnoise(n, 752, 80)
    h = pores * 0.4 + big * 0.2
    col = ramp(norm01(big + pores * 0.3), [(0, "#6E4426"), (0.5, "#8A5A34"), (1, "#A8743F")])
    return col, h, 0.6 + 0.1 * norm01(big)

@recipe("fur", "Cloth", 512, "Short animal fur for pelts, wolves, boars and fur trims.")
def _(n):
    strands = fnoise(n, 761, 1.6, 2.0, aniso=(1.0, 0.15)); clumps = fnoise(n, 762, 25)
    h = strands * 0.7 + clumps * 0.5
    col = ramp(norm01(h), [(0, "#5A3E28"), (0.5, "#8C6440"), (1, "#C49A6C")])
    return col, h, 0.85

@recipe("feathers", "Cloth", 512, "Soft overlapping feathers for chickens, birds and arrow fletching.")
def _(n):
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    rows = 10; rh = n / rows; r_ = (ys // rh).astype(int); off = (r_ % 2) * (n / 12)
    xx = ((xs + off) % (n / 6)) - n / 12; yy = ys % rh
    shape = np.clip(1 - (xx / (n / 12)) ** 2 - ((rh - yy) / rh) ** 2 * 0.2, 0, 1)
    barbs = 0.5 + 0.5 * np.sin(xx * 0.9 + yy * 0.3)
    h = shape + barbs * 0.15
    col = ramp(norm01(h), [(0, "#D8CDB8"), (0.6, "#F3ECDF"), (1, "#FFFFFF")])
    return col, h, 0.85

# ---------------- BUILDING ----------------
@recipe("thatch", "Building", 1024, "Straw thatch for farmhouse and village roofs.")
def _(n):
    straw = fnoise(n, 801, 2, 2.0, aniso=(1.0, 0.05)) ; layers = periodic_lines(n, 6, 0, warp=fnoise(n, 802, 100) * 0.02, sharp=3)
    h = straw * 0.6 + layers * 1.0
    col = ramp(norm01(straw * 0.6 + layers * 0.5 + fnoise(n, 803, 120) * 0.4), [(0, "#8C6A32"), (0.5, "#C9A253"), (1, "#E3C47A")])
    return col, h, 0.95

@recipe("roof_tiles", "Building", 1024, "Rounded clay roof tiles for Emberhold's houses.")
def _(n):
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    rows = 8; rh = n / rows; cols = 10; cw = n / cols
    r_ = (ys // rh).astype(int); off = (r_ % 2) * cw / 2
    u = ((xs + off) % cw) / cw; v = (ys % rh) / rh
    arch = np.sin(np.pi * u) * (0.4 + 0.6 * v)
    tid = r_ * cols + (((xs + off) // cw).astype(int) % cols)
    tone = rng(811).random(rows * cols + cols)[tid]
    h = arch + v * 0.5
    col = ramp(tone * 0.6 + norm01(fnoise(n, 812, 50)) * 0.4, [(0, "#9E4B34"), (0.5, "#B7684A"), (1, "#C98660")])
    col = shade(col, 0.6 + 0.4 * np.clip(arch + 0.2, 0, 1) * (0.7 + 0.3 * v))
    return col, h, 0.8

@recipe("plaster", "Building", 1024, "Warm whitewashed plaster for house walls.")
def _(n):
    big = fnoise(n, 821, 150); mid = fnoise(n, 822, 12)
    col = ramp(norm01(big * 0.7 + mid * 0.3), [(0, "#DCCDB2"), (0.5, "#EDE3D0"), (1, "#F6F0E4")])
    patch = blur((fnoise(n, 823, 80) > 1.6).astype(np.float32), 3)
    col = lerp(col, np.broadcast_to(hexc("#B08F6A"), col.shape), patch * 0.5)
    return col, mid * 0.3 + big * 0.2 - patch * 0.5, 0.9

@recipe("brick", "Building", 1024, "Red brick for chimneys, forges and the smithy.")
def _(n):
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    rows = 16; bh = n / rows; bw = n / 6
    r_ = (ys // bh).astype(int); off = (r_ % 2) * bw / 2
    xx = (xs + off) % bw; yy = ys % bh
    m = np.minimum(np.minimum(xx, bw - xx), np.minimum(yy, bh - yy))
    bid = r_ * 6 + ((xs + off) // bw).astype(int) % 6
    v = rng(831).random(rows * 6 + 6)[bid]
    face = np.clip((m - 3) / 4, 0, 1)
    h = face + fnoise(n, 832, 5) * 0.1
    col = ramp(v * 0.6 + norm01(fnoise(n, 833, 10)) * 0.4, [(0, "#8E3E2A"), (0.5, "#A9533A"), (1, "#C26E4E")])
    col = lerp(col, np.broadcast_to(hexc("#CFC4B2"), col.shape), 1 - face)
    return col, h, 0.85

# ---------------- SPECIAL ----------------
@recipe("embers", "Special", 512, "Glowing embers and coals for forges, campfires and the Flame. Emission on the hot cracks.", emission="#FF7A2F", emission_energy=3.0)
def _(n):
    f1, f2, cid = voronoi(n, 90, 901)
    crack = np.clip(1 - (f2 - f1) / 10, 0, 1) ** 1.5
    pulse = norm01(fnoise(n, 902, 60))
    heat = np.clip(crack * (0.4 + 0.8 * pulse), 0, 1)
    coal = ramp(norm01(fnoise(n, 903, 8)), [(0, "#2A2420"), (1, "#4A403B")])
    hot = ramp(heat, [(0, "#C2431B"), (0.5, "#FF7A2F"), (1, "#FFE08A")])
    col = lerp(coal, hot, heat)
    return col, -crack, 0.9, 0.0, None, hot * heat[..., None]

@recipe("ice", "Special", 512, "Clear blue ice for frost spells, frozen lakes and the cold north.")
def _(n):
    f1, f2, cid = voronoi(n, 50, 911)
    crack = np.clip(1 - (f2 - f1) / 3, 0, 1)
    h = fnoise(n, 912, 40) * 0.4 - crack * 0.6
    col = ramp(norm01(fnoise(n, 913, 80) + crack), [(0, "#7FB9E0"), (0.6, "#B8E2F5"), (1, "#F0FAFF")])
    return col, h, 0.1

@recipe("crystal", "Special", 512, "Arcane crystal for gems, mana stones and the Emberhall's restricted section.", emission="#8A5CFF", emission_energy=0.6)
def _(n):
    f1, f2, cid = voronoi(n, 30, 921)
    facet = cell_values(cid, 30, 922)
    h = facet * 1.2 + (f2 - f1) / 40
    col = ramp(facet, [(0, "#5A3FB0"), (0.5, "#8A5CFF"), (1, "#C8B0FF")])
    return col, h, 0.12, 0.0, None, col * 0.25

@recipe("ore_veins", "Special", 1024, "Rock with bright metal veins, a base the scenery thread can tint per ore (copper, iron, gold, mithril...).")
def _(n):
    col, h, r = R["rock"]["fn"](n)
    vein = np.abs(fnoise(n, 931, 170, 4.0) + fnoise(n, 932, 12, 3.0) * 0.08)
    m = np.clip(1 - vein / 0.12, 0, 1) ** 0.7
    rim = np.clip(1 - vein / 0.22, 0, 1) - m
    col = lerp(col, col * 0.5, np.clip(rim * 1.5, 0, 1))
    col = lerp(col, np.broadcast_to(hexc("#EDEDED"), col.shape), np.clip(m * 1.4, 0, 1))
    return col, h + m * 0.6, r * (1 - m) + 0.35 * m, m

# ---------------- OUTPUT ----------------
def to8(a): return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)

def build(out, names=None):
    os.makedirs(out, exist_ok=True)
    manpath = os.path.join(out, "manifest.json")
    manifest = json.load(open(manpath)) if os.path.exists(manpath) else {}
    for name, spec in R.items():
        if names and name not in names: continue
        n = spec["size"]
        res = spec["fn"](n)
        col, h, rough = res[0], res[1], res[2]
        metal = res[3] if len(res) > 3 and res[3] is not None else spec["metal"]
        alpha = res[4] if len(res) > 4 else None
        emis = res[5] if len(res) > 5 else None
        rough = np.broadcast_to(np.asarray(rough, np.float32), (n, n)) if np.ndim(rough) == 0 else rough
        metal = np.broadcast_to(np.asarray(metal, np.float32), (n, n)) if np.ndim(metal) == 0 else metal
        col = np.clip(col, 40 / 255, 235 / 255) if alpha is None else np.clip(col, 0, 235 / 255)
        h = (h - h.mean()) / (h.std() + 1e-6)
        strength = 1.6 * (512 / n) ** 0.5 * 2
        nrm = normal_from_height(blur(h, 1.0), strength)
        ao = ao_from_height(h, 12 * n / 1024, 0.18)
        d = os.path.join(out, name); os.makedirs(d, exist_ok=True)
        if alpha is not None:
            Image.fromarray(np.dstack([to8(col), to8(alpha)]), "RGBA").save(f"{d}/{name}_albedo.png", optimize=True)
        else:
            Image.fromarray(to8(col), "RGB").save(f"{d}/{name}_albedo.png", optimize=True)
        Image.fromarray(to8(nrm), "RGB").save(f"{d}/{name}_normal.png", optimize=True)
        Image.fromarray(np.dstack([to8(ao), to8(rough), to8(metal)]), "RGB").save(f"{d}/{name}_orm.png", optimize=True)
        e = dict(spec["extra"])
        if emis is not None:
            Image.fromarray(to8(emis), "RGB").save(f"{d}/{name}_emission.png", optimize=True); e["emission_texture"] = True
        manifest[name] = dict(category=spec["cat"], size=n, description=spec["desc"], alpha=alpha is not None,
                              repeat_m=2.0 if spec["cat"] == "Ground" else 1.0, **e)
        print("made", name, flush=True)
    json.dump(manifest, open(manpath, "w"), indent=1)

if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2:] or None)
