"""More Emberfall creatures and the bosses (same kit and style as creatures.py).
python3 creatures2.py OUT_DIR [names...]"""
import sys, math, os
import numpy as np
from creaturekit import *
import creatures as C1
from creatures import quad_bones, quad_anims, ease, bump, S, C, TAU, DEF_SINK

E = lambda *a, **k: Ellipsoid(*a, **k)
Cn = lambda *a, **k: Cone(*a, **k)
def mirror(fn):  # build both sides: fn(x, 'L'/'R') -> list of shapes
    return fn(1, 'L') + fn(-1, 'R')
def spots(scale, thr, seed):
    return lambda p, n: np.clip((vnoise(p, scale, seed) - thr) / 0.04, 0, 1)
def eyes2(bone, frm, dir_, r, fwd=0.35, glow=False, sink=0.55):
    return [{'bone': bone, 'from': (frm[0] * x, frm[1], frm[2]), 'dir': (dir_[0] * x, dir_[1], dir_[2]), 'r': r, 'forward': fwd, 'glow': glow, 'sink': sink} for x in (1, -1)]
def mouth_arc(y0, curve, zmin, half=0.05, w=0.0035):
    return lambda p, n: (np.abs(p[..., 1] - (y0 + curve * p[..., 0] ** 2)) < w) * (np.abs(p[..., 0]) < half) * (p[..., 2] > zmin)
def with_extra(anims, extra):  # add more bone motion on top of each animation
    out = {}
    for k, (T, f) in anims.items():
        out[k] = (T, (lambda f, k: lambda t: {**f(t), **extra(k, t)})(f, k))
    return out

# ---------------- Rat ----------------
def rat():
    P = {'fur': ('#8a6a52', 0.85), 'belly': ('#e8d9c4', 0.85), 'pink': ('#eaa6a0', 0.6), 'nose': ('#d9737a', 0.4), 'mouth': ('#4a2a2a', 0.6), 'tooth': ('#fbf6ea', 0.4)}
    bones = quad_bones(hip=(0, 0.11, -0.07), chest=(0, 0.12, 0.05), neck=(0, 0.14, 0.11), head=(0, 0.16, 0.15),
                       legs={'front': (0.045, 0.08, 0.08), 'back': (0.055, 0.08, -0.09)}, tail=((0, 0.08, -0.17), (0, 0.04, -0.3)), ears=(0.05, 0.24, 0.14))
    sh = [E((0, 0.11, -0.03), (0.085, 0.085, 0.14), 'hips', 'fur'), E((0, 0.12, 0.06), (0.07, 0.075, 0.08), 'chest', 'fur', k=0.04),
          E((0, 0.09, 0.0), (0.06, 0.05, 0.11), 'chest', 'belly', k=0.03),
          E((0, 0.17, 0.15), (0.075, 0.07, 0.075), 'head', 'fur', k=0.04), Cn((0, 0.16, 0.18), (0, 0.145, 0.27), 0.05, 0.018, 'head', 'fur', k=0.03),
          E((0, 0.148, 0.272), (0.013, 0.011, 0.01), 'head', 'nose', k=0.006),
          E((0, 0.125, 0.25), (0.012, 0.012, 0.006), 'head', 'tooth', k=0.004)]
    sh += mirror(lambda x, s: [E((0.055 * x, 0.235, 0.13), (0.045, 0.045, 0.014), f'ear_{s}', 'fur', k=0.02, rot=rotY(0.3 * x)),
                               E((0.055 * x, 0.235, 0.138), (0.034, 0.034, 0.008), f'ear_{s}', 'pink', k=0.0, rot=rotY(0.3 * x)),
                               Cn((0.045 * x, 0.09, 0.08), (0.045 * x, 0.01, 0.1), 0.02, 0.012, f'front_upper_{s}', 'fur', k=0.02),
                               E((0.045 * x, 0.008, 0.11), (0.016, 0.01, 0.022), f'front_lower_{s}', 'pink', k=0.01),
                               Cn((0.055 * x, 0.1, -0.09), (0.055 * x, 0.01, -0.08), 0.035, 0.014, f'back_upper_{s}', 'fur', k=0.02),
                               E((0.055 * x, 0.008, -0.06), (0.017, 0.01, 0.03), f'back_lower_{s}', 'pink', k=0.01)])
    sh += [Cn((0, 0.08, -0.16), (0, 0.05, -0.28), 0.018, 0.012, 'tail1', 'pink', k=0.01), Cn((0, 0.05, -0.28), (0, 0.07, -0.42), 0.012, 0.005, 'tail2', 'pink', k=0.01)]
    eyes = eyes2('head', (0.01, 0.18, 0.15), (0.6, 0.25, 1), (0.022, 0.026, 0.012))
    DEF_SINK[0] = 0.06
    return Creature('Rat', bones, sh, P, eyes, quad_anims(stride=0.6, bounce=0.015, T_walk=0.45, wag=0.25), cell=0.0025, tris=9000,
                    rules=[('mouth', mouth_arc(0.132, 12, 0.235, 0.025, 0.002))]), '#1c1418'

# ---------------- Cow ----------------
def cow():
    P = {'white': ('#f4f1ea', 0.85), 'black': ('#2e2a2c', 0.85), 'muzzle': ('#e9b0a4', 0.6), 'horn': ('#eadfc6', 0.45), 'hoof': ('#3a302c', 0.5), 'nostril': ('#7a4044', 0.6),
         'tuft': ('#2e2a2c', 0.9), 'inner': ('#e9b0a4', 0.7), 'mouth': ('#5a3030', 0.6)}
    bones = quad_bones(hip=(0, 0.95, -0.45), chest=(0, 0.98, 0.3), neck=(0, 1.08, 0.58), head=(0, 1.18, 0.72),
                       legs={'front': (0.2, 0.78, 0.38), 'back': (0.2, 0.78, -0.5)}, tail=((0, 1.05, -0.74), (0, 0.75, -0.86)), ears=(0.2, 1.3, 0.7))
    sh = [E((0, 0.98, -0.05), (0.34, 0.33, 0.68), 'chest', 'white'), E((0, 0.95, -0.42), (0.31, 0.3, 0.32), 'hips', 'white', k=0.12),
          E((0, 1.22, 0.76), (0.21, 0.22, 0.22), 'head', 'white', k=0.1), E((0, 1.1, 0.95), (0.16, 0.12, 0.11), 'head', 'muzzle', k=0.06),
          E((0, 1.05, 0.62), (0.18, 0.18, 0.16), 'neck', 'white', k=0.1)]
    sh += mirror(lambda x, s: [Cn((0.13 * x, 1.4, 0.72), (0.2 * x, 1.5, 0.7), 0.035, 0.015, 'head', 'horn', k=0.02),
                               E((0.25 * x, 1.31, 0.7), (0.09, 0.04, 0.05), f'ear_{s}', 'white', k=0.03, rot=rotZ(-0.3 * x)),
                               E((0.26 * x, 1.31, 0.725), (0.06, 0.025, 0.02), f'ear_{s}', 'inner', k=0.0, rot=rotZ(-0.3 * x)),
                               Cn((0.2 * x, 0.8, 0.38), (0.2 * x, 0.35, 0.4), 0.1, 0.075, f'front_upper_{s}', 'white', k=0.08),
                               Cn((0.2 * x, 0.35, 0.4), (0.2 * x, 0.04, 0.41), 0.075, 0.07, f'front_lower_{s}', 'white', k=0.03),
                               Cn((0.2 * x, 0.8, -0.5), (0.2 * x, 0.35, -0.53), 0.12, 0.075, f'back_upper_{s}', 'white', k=0.08),
                               Cn((0.2 * x, 0.35, -0.53), (0.2 * x, 0.04, -0.52), 0.075, 0.07, f'back_lower_{s}', 'white', k=0.03)])
    sh += [Cn((0, 1.1, -0.72), (0, 0.6, -0.85), 0.025, 0.018, 'tail1', 'white', k=0.03), E((0, 0.55, -0.86), (0.04, 0.08, 0.04), 'tail2', 'tuft', k=0.03)]
    def patches(p, n): return np.clip((vnoise(p * V(1, 1.2, 1), 2.4, 4) - 0.56) / 0.03, 0, 1) * (np.abs(p[..., 2] - 0.85) > 0.0) * (p[..., 1] > 0.3) * ((p[..., 2] < 0.62) | (p[..., 1] > 1.32))
    def hooves(p, n): return (p[..., 1] < 0.12) * 1.0
    def nostrils(p, n):
        r = 0
        for x in (0.055, -0.055): r = np.maximum(r, 1 - np.hypot((p[..., 0] - x) / 0.02, (p[..., 1] - 1.12) / 0.028))
        return np.clip(r * 4, 0, 1) * (p[..., 2] > 1.0)
    eyes = eyes2('head', (0.02, 1.27, 0.75), (0.65, 0.2, 1), (0.05, 0.058, 0.026))
    DEF_SINK[0] = 0.6
    return Creature('Cow', bones, sh, P, eyes, quad_anims(stride=0.35, bounce=0.02, T_walk=1.2, wag=0.4, heavy=True), cell=0.014, tris=14000,
                    rules=[('black', patches), ('hoof', hooves), ('nostril', nostrils), ('mouth', mouth_arc(1.04, 4, 1.0, 0.09, 0.005))], fur=0.05), '#2a1c14'

# ---------------- Giant bat ----------------
def bat():
    P = {'fur': ('#6a4a3a', 0.9), 'chest': ('#b08a6a', 0.9), 'wing': ('#4a3438', 0.7), 'bone': ('#3a2a2e', 0.7), 'inner': ('#d98f8a', 0.7), 'fang': ('#fbf6ea', 0.4), 'nose': ('#3a2228', 0.5)}
    H = 1.0
    bones = [('root', None, (0, H, 0)), ('body', 'root', (0, H, 0)), ('head', 'body', (0, H + 0.1, 0.04)),
             ('ear_L', 'head', (0.05, H + 0.2, 0.03)), ('ear_R', 'head', (-0.05, H + 0.2, 0.03)),
             ('wing1_L', 'body', (0.07, H + 0.05, 0)), ('wing2_L', 'wing1_L', (0.3, H + 0.08, -0.02)), ('wing1_R', 'body', (-0.07, H + 0.05, 0)), ('wing2_R', 'wing1_R', (-0.3, H + 0.08, -0.02)),
             ('foot_L', 'body', (0.04, H - 0.1, -0.02)), ('foot_R', 'body', (-0.04, H - 0.1, -0.02))]
    sh = [E((0, H, 0), (0.1, 0.12, 0.09), 'body', 'fur'), E((0, H - 0.01, 0.05), (0.07, 0.08, 0.05), 'body', 'chest', k=0.04),
          E((0, H + 0.12, 0.04), (0.1, 0.09, 0.085), 'head', 'fur', k=0.06), E((0, H + 0.1, 0.115), (0.03, 0.022, 0.02), 'head', 'nose', k=0.02)]
    def wing(x, s):
        o = [Cn((0.06 * x, H + 0.05, 0), (0.3 * x, H + 0.08, -0.02), 0.018, 0.012, f'wing1_{s}', 'bone', k=0.015),
             Cn((0.04 * x, H + 0.2, 0.0), (0.07 * x, H + 0.3, 0.0), 0.045, 0.012, f'ear_{s}', 'fur', k=0.03),
             Cn((0.045 * x, H + 0.2, 0.012), (0.068 * x, H + 0.27, 0.012), 0.025, 0.006, f'ear_{s}', 'inner', k=0.0),
             E((0.18 * x, H + 0.02, -0.04), (0.14, 0.012, 0.1), f'wing1_{s}', 'wing', k=0.02),
             Cn((0.02 * x, H + 0.06, 0.11), (0.02 * x, H + 0.035, 0.11), 0.007, 0.002, 'head', 'fang', k=0.002),
             Cn((0.04 * x, H - 0.08, -0.02), (0.04 * x, H - 0.13, -0.02), 0.015, 0.01, f'foot_{s}', 'bone', k=0.01)]
        for a, ln in ((0.3, 0.26), (-0.2, 0.3), (-0.75, 0.24)):
            tip = (0.3 * x + math.cos(a) * ln * x, H + 0.08 + math.sin(a) * 0.04, -0.02 - math.sin(-a) * ln * 0.6 - 0.02)
            o.append(Cn((0.3 * x, H + 0.08, -0.02), tip, 0.011, 0.005, f'wing2_{s}', 'bone', k=0.01))
        o.append(E((0.47 * x, H + 0.06, -0.1), (0.17, 0.01, 0.13), f'wing2_{s}', 'wing', k=0.03))
        return o
    sh += mirror(wing)
    eyes = eyes2('head', (0.0, H + 0.13, 0.04), (0.5, 0.15, 1), (0.026, 0.03, 0.013))
    def flap(t, T, A=0.7, base=0.0):
        w = t / T * TAU; return {'wing1_L': (0, 0.1 * S(w), base + A * S(w)), 'wing1_R': (0, -0.1 * S(w), -base - A * S(w)), 'wing2_L': (0, 0, 0.5 * A * S(w - 0.8)), 'wing2_R': (0, 0, -0.5 * A * S(w - 0.8))}
    def idle(t): o = flap(t, 0.5); o.update({'@root': (0, 0.05 * S(t / 0.5 * TAU - 1), 0), 'head': (0.1 * S(t * 2), 0.2 * S(t), 0)}); return o
    def walk(t): o = flap(t, 0.4); o.update({'@root': (0, 0.06 * S(t / 0.4 * TAU - 1), 0), 'body': (0.3, 0, 0), 'head': (-0.25, 0, 0)}); return o
    def run(t): o = flap(t, 0.25, 0.9); o.update({'@root': (0, 0.04 * S(t / 0.25 * TAU - 1), 0), 'body': (0.6, 0, 0), 'head': (-0.5, 0, 0)}); return o
    def attack(t):
        d = bump(t, 0.25, 0.75); o = flap(t, 0.3, 0.9 * (1 - d) + 0.1); o.update({'@root': (0, -0.3 * d, 0.45 * d), 'body': (0.7 * d, 0, 0), 'head': (-0.3 * d, 0, 0),
              'wing1_L': (0, 0, -0.6 * d + 0.5 * (1 - d) * S(t * 20)), 'wing1_R': (0, 0, 0.6 * d - 0.5 * (1 - d) * S(t * 20))}); return o
    def hit(t): k = bump(t, 0, 0.5); o = flap(t, 0.2, 0.9); o.update({'@root': (0, 0.08 * k, -0.15 * k), 'body': (-0.5 * k, 0, 0.3 * k)}); return o
    def defeat(t):
        k = ease(t / 0.7); o = flap(t, 0.2, 0.8 * (1 - k)); o.update({'@root': (0, -(H - 0.03) * k, 0), 'root': (0, 0, 1.3 * k), 'wing1_L': (0, 0, -0.2 * k), 'wing1_R': (0, 0, 0.2 * k)}); return o
    def happy(t): o = flap(t, 0.3); o.update({'root': (0, TAU * ease(t / 0.9), 0), '@root': (0, 0.1 * bump(t, 0, 0.9), 0)}); return o
    anims = {'idle_loop': (1.0, idle), 'walk_loop': (0.8, walk), 'run_loop': (0.5, run), 'attack': (1.0, attack), 'hit': (0.5, hit), 'defeat': (1.4, defeat), 'happy': (1.0, happy)}
    return Creature('GiantBat', bones, sh, P, eyes, anims, cell=0.004, tris=10000, rules=[], fur=0.08), '#2a1418'

# ---------------- Wolf kin: alpha wolf and dire wolf ----------------
def wolf_kin(kind):
    cr, iris = C1.wolf()
    if kind == 'alpha':  # silver, bigger ruff, icy marks
        cr.name = 'AlphaWolf'; cr.scale = 1.25
        cr.paints.update({'fur': ('#b9c2cc', 0.85), 'dark': ('#6f7a88', 0.85), 'ember': ('#8fd6ff', 0.7), 'cream': ('#f6f3ee', 0.85)})
        cr.shapes += [Ellipsoid((0, 0.66, 0.22), (0.22, 0.2, 0.16), 'neck', 'cream', k=0.06)]
        cr.shapes += mirror(lambda x, s: [Ellipsoid((0.17 * x, 0.66, 0.2), (0.08, 0.09, 0.07), 'neck', 'cream', k=0.05, rot=rotZ(-0.6 * x))])
        return cr, '#3f6f9a'
    cr.name = 'DireWolf'; cr.scale = 1.6
    cr.paints.update({'fur': ('#4a4440', 0.9), 'dark': ('#2a2624', 0.9), 'ember': ('#ff7a2f', 0.7), 'cream': ('#8a7e72', 0.9), 'fang': ('#f4ecd8', 0.4)})
    for i in range(7):  # a spiky mane down the neck and back
        z = 0.42 - i * 0.1; y = 0.86 - i * 0.035
        cr.shapes.append(Cone((0, y - 0.08, z), (0, y + 0.08, z - 0.12), 0.06, 0.012, 'neck' if i < 3 else 'chest', 'dark', k=0.04))
    cr.shapes += mirror(lambda x, s: [Cone((0.03 * x, 0.71, 0.6), (0.032 * x, 0.67, 0.61), 0.011, 0.003, 'head', 'fang', k=0.003)])
    return cr, '#c9621f'

# ---------------- bugs: spiders and beetles share a rig ----------------
def bug_bones(body, abdomen, head, legs):
    b = [('root', None, (0, body[1], 0)), ('body', 'root', body), ('abdomen', 'body', abdomen), ('head', 'body', head)]
    for i, (hip, knee) in enumerate(legs):
        for x, s in ((1, 'L'), (-1, 'R')):
            b += [(f'leg{i}_upper_{s}', 'body', (hip[0] * x, hip[1], hip[2])), (f'leg{i}_lower_{s}', f'leg{i}_upper_{s}', (knee[0] * x, knee[1], knee[2]))]
    return b
def bug_legs(legs, paint, r0, r1, r2, k=0.02):
    o = []
    for i, (hip, knee, foot) in enumerate(legs):
        for x, s in ((1, 'L'), (-1, 'R')):
            h, kn, f = (hip[0] * x, hip[1], hip[2]), (knee[0] * x, knee[1], knee[2]), (foot[0] * x, foot[1], foot[2])
            o += [Cone(h, kn, r0, r1, f'leg{i}_upper_{s}', paint, k=k), Cone(kn, f, r1, r2, f'leg{i}_lower_{s}', paint, k=k * 0.5)]
    return o
def bug_anims(n, T_walk=0.7, lift=0.35, swing=0.3, sink=0.1, bob=0.01):
    def legs(w, A, L):
        o = {}
        for i in range(n):
            for x, s in ((1, 'L'), (-1, 'R')):
                ph = w + (i % 2) * math.pi + (0 if s == 'L' else math.pi)
                up = max(0, S(ph)) * L
                o[f'leg{i}_upper_{s}'] = (0, A * C(ph) * x, up * x)
                o[f'leg{i}_lower_{s}'] = (0, 0, -0.5 * up * x)
        return o
    def idle(t):
        w = t / 2.2 * TAU; o = {'@root': (0, bob * S(w), 0), 'abdomen': (0.06 * S(w), 0, 0), 'head': (0, 0.08 * S(w / 2), 0)}
        tap = bump(t % 2.2, 1.4, 1.7)
        o['leg0_upper_L'] = (0, 0, 0.4 * tap); o['leg0_lower_L'] = (0, 0, -0.2 * tap); return o
    def walk(t): w = t / T_walk * TAU; o = legs(w, swing, lift); o.update({'@root': (0, bob * abs(S(2 * w)), 0), 'abdomen': (0.05 * S(2 * w), 0.05 * S(w), 0)}); return o
    def run(t): w = t / (T_walk * 0.5) * TAU; o = legs(w, swing * 1.3, lift * 1.2); o.update({'@root': (0, bob * 2 * abs(S(2 * w)), 0), 'abdomen': (0.1, 0, 0)}); return o
    def attack(t):
        r = ease(t / 0.35) * (1 - ease((t - 0.45) / 0.1)); l = bump(t, 0.4, 0.75)
        o = {'@root': (0, 0.06 * r, 0.12 * l), 'body': (-0.35 * r + 0.25 * l, 0, 0), 'head': (-0.2 * r + 0.3 * l, 0, 0), 'abdomen': (0.3 * r, 0, 0)}
        for s, x in (('L', 1), ('R', -1)): o[f'leg0_upper_{s}'] = (0, -0.4 * x * (r + l), 0.8 * x * r); o[f'leg1_upper_{s}'] = (0, -0.2 * x * r, 0.4 * x * r)
        return o
    def hit(t):
        k = bump(t, 0, 0.5); o = {'@root': (0, 0.03 * k, -0.06 * k), 'body': (0.25 * k, 0, 0.1 * k), 'abdomen': (-0.2 * k, 0, 0)}
        for i in range(n):
            for s, x in (('L', 1), ('R', -1)): o[f'leg{i}_upper_{s}'] = (0, 0, 0.3 * x * k)
        return o
    def defeat(t):  # rolls over, legs curl in
        k = ease(t / 0.7); c = ease((t - 0.5) / 0.6); o = {'root': (0, 0, math.pi * k), '@root': (0, -sink * k + 0.15 * sink * bump(t, 0.7, 0.9), 0)}
        for i in range(n):
            for s, x in (('L', 1), ('R', -1)): o[f'leg{i}_upper_{s}'] = (0, 0, 0.8 * x * c); o[f'leg{i}_lower_{s}'] = (0, 0, -1.2 * x * c)
        return o
    def happy(t):
        k = bump(t, 0.05, 0.5) + bump(t, 0.5, 0.95); o = legs(t / 0.3 * TAU, 0.1, 0.2); o.update({'@root': (0, 0.05 * k, 0), 'abdomen': (0.3 * S(t * 25), 0, 0)}); return o
    return {'idle_loop': (2.2, idle), 'walk_loop': (T_walk, walk), 'run_loop': (T_walk * 0.5, run), 'attack': (1.0, attack), 'hit': (0.5, hit), 'defeat': (1.4, defeat), 'happy': (1.0, happy)}

SPIDER_LEGS = [((0.07, 0.17, 0.07), (0.22, 0.3, 0.2), (0.3, 0.0, 0.32)), ((0.08, 0.17, 0.03), (0.26, 0.3, 0.08), (0.38, 0.0, 0.12)),
               ((0.08, 0.17, -0.02), (0.26, 0.3, -0.06), (0.37, 0.0, -0.1)), ((0.07, 0.17, -0.06), (0.22, 0.29, -0.17), (0.3, 0.0, -0.3))]
def spider(kind):
    giant, queen = kind in ('giant', 'thornmother'), kind == 'thornmother'
    pal = {'cave': ('#6a4a36', '#a8865f', '#3a2a22'), 'giant': ('#3a2a30', '#5a4048', '#241a1e'), 'thornmother': ('#4a3450', '#6a5070', '#2a1e30')}[kind]
    P = {'body': (pal[0], 0.6), 'light': (pal[1], 0.7), 'leg': (pal[2], 0.55), 'mark': ('#d93a3a', 0.5), 'fang': ('#e8dcc8', 0.4), 'thorn': ('#2e3a24', 0.6),
         'glow': ('#7fffd0', 0.6, 1.0), 'crown': ('#3b2a1e', 0.5), 'mouth': ('#1a1014', 0.6)}
    bones = bug_bones((0, 0.18, 0.02), (0, 0.24, -0.14), (0, 0.2, 0.12), [(l[0], l[1]) for l in SPIDER_LEGS])
    sh = [E((0, 0.18, 0.03), (0.11, 0.08, 0.12), 'body', 'body'), E((0, 0.26, -0.2), (0.17, 0.15, 0.19), 'abdomen', 'body', k=0.05),
          E((0, 0.2, 0.14), (0.085, 0.08, 0.075), 'head', 'body', k=0.05)]
    sh += mirror(lambda x, s: [Cn((0.03 * x, 0.15, 0.2), (0.025 * x, 0.1, 0.22), 0.02, 0.006, 'head', 'fang', k=0.01)])
    sh += bug_legs(SPIDER_LEGS, 'leg', 0.03, 0.024, 0.01)
    rules = [('light', lambda p, n: np.clip(np.sin(p[..., 2] * 60) * 4 - 2, 0, 1) * (p[..., 2] < -0.08) * (p[..., 1] > 0.2) * (kind == 'cave'))]
    if kind == 'giant':  # red hourglass on the back
        rules.append(('mark', lambda p, n: ((np.abs(p[..., 0]) < 0.012 + 0.6 * np.abs(p[..., 2] + 0.22) ** 1.3 * 0) * (np.abs(p[..., 0]) < 0.04 * np.abs(p[..., 2] + 0.2) / 0.08) * (np.abs(p[..., 2] + 0.2) < 0.08) * (p[..., 1] > 0.36)) * 1.0))
    if queen:
        for i in range(10):  # a back of thorns
            a = i / 10 * TAU; z = -0.2 + 0.11 * math.cos(a); x = 0.11 * math.sin(a)
            sh.append(Cn((x, 0.33, z), (x * 1.5, 0.47 + 0.03 * (i % 2), z * 1.1 - 0.02), 0.022, 0.004, 'abdomen', 'thorn', k=0.015))
        for i in range(5):  # a crown of thorns
            a = (i / 4 - 0.5) * 2.2; sh.append(Cn((0.06 * math.sin(a), 0.26, 0.13 + 0.03 * math.cos(a)), (0.08 * math.sin(a), 0.34, 0.12 + 0.03 * math.cos(a)), 0.012, 0.003, 'head', 'crown', k=0.008))
        rules.append(('glow', lambda p, n: np.clip(1 - np.abs(vnoise(p, 22, 3) - 0.5) / 0.014, 0, 1) * (vnoise(p, 7, 5) > 0.5) * (p[..., 1] > 0.12)))
    eyes = eyes2('head', (0.0, 0.21, 0.13), (0.38, 0.25, 1), (0.026, 0.03, 0.013), fwd=0.5, glow=queen)
    eyes += [{'bone': 'head', 'from': (0, 0.21, 0.13), 'dir': (0.75 * x, 0.75, 0.6), 'r': (0.012, 0.012, 0.006), 'forward': 0.2, 'glow': queen} for x in (1, -1)]
    name = {'cave': 'CaveSpider', 'giant': 'GiantSpider', 'thornmother': 'Thornmother'}[kind]
    return Creature(name, bones, sh, P, eyes, bug_anims(4, T_walk=0.6, sink=0.1), cell=0.0035, tris=14000, rules=rules, fur=0.04,
                    scale={'cave': 1.0, 'giant': 2.0, 'thornmother': 5.0}[kind], glow='#7fffd0' if queen else None), ('#b8fff0' if queen else '#5a1a1a')

BEETLE_LEGS = [((0.07, 0.1, 0.1), (0.17, 0.14, 0.16), (0.22, 0.0, 0.24)), ((0.08, 0.1, 0.02), (0.2, 0.14, 0.02), (0.27, 0.0, 0.02)), ((0.07, 0.1, -0.06), (0.17, 0.14, -0.14), (0.22, 0.0, -0.24))]
def beetle(kind):
    titan = kind == 'titan'
    P = {'shell': ('#b8341e', 0.3) if not titan else ('#a8a49a', 0.75), 'dark': ('#2a1e1c', 0.4) if not titan else ('#6a665e', 0.8), 'belly': ('#ff9a3d', 0.4, 1.0) if not titan else ('#8a857a', 0.8),
         'leg': ('#2a1e1c', 0.4) if not titan else ('#5a564e', 0.8), 'spot': ('#ffb347', 0.3, 1.0), 'glow': ('#7fffd0', 0.6, 1.0), 'horn': ('#3a2a22', 0.4) if not titan else ('#7a766c', 0.7), 'mouth': ('#1a1014', 0.6)}
    bones = bug_bones((0, 0.12, 0.02), (0, 0.15, -0.1), (0, 0.13, 0.18), [(l[0], l[1]) for l in BEETLE_LEGS])
    sh = [E((0, 0.13, -0.06), (0.16, 0.12, 0.2), 'abdomen', 'shell'), E((0, 0.08, -0.04), (0.13, 0.05, 0.18), 'abdomen', 'belly', k=0.03),
          E((0, 0.13, 0.12), (0.12, 0.08, 0.07), 'body', 'dark', k=0.03), E((0, 0.12, 0.2), (0.075, 0.065, 0.06), 'head', 'dark', k=0.03),
          Cn((0, 0.15, 0.24), (0, 0.24, 0.32), 0.03, 0.008, 'head', 'horn', k=0.02)]
    sh += bug_legs(BEETLE_LEGS, 'leg', 0.024, 0.02, 0.012)
    rules = [('dark', lambda p, n: (np.abs(p[..., 0]) < 0.006) * (p[..., 1] > 0.15) * (p[..., 2] < 0.05) * 1.0)]
    if titan:
        sh += [E((0.08 * x, 0.23 + 0.02 * i, -0.15 + 0.09 * i), (0.04, 0.03, 0.04), 'abdomen', 'shell', k=0.03) for x in (1, -1) for i in range(3)]
        rules.append(('glow', lambda p, n: np.clip(1 - np.abs(vnoise(p, 30, 11) - 0.5) / 0.012, 0, 1) * (p[..., 1] > 0.12)))
    else:
        rules.append(('spot', lambda p, n: np.clip((vnoise(p, 45, 6) - 0.7) / 0.04, 0, 1) * (p[..., 1] > 0.16)))
    eyes = eyes2('head', (0.0, 0.13, 0.2), (0.7, 0.25, 1), (0.02, 0.024, 0.01), fwd=0.3, glow=titan)
    return Creature('DustTitan' if titan else 'FireBeetle', bones, sh, P, eyes, bug_anims(3, T_walk=0.5, sink=0.06, lift=0.4), cell=0.003, tris=12000, rules=rules,
                    fur=0.03, scale=10.0 if titan else 1.0, glow='#7fffd0' if titan else '#ff8a2f'), ('#b8fff0' if titan else '#3a1408')

# ---------------- floating spirits ----------------
def float_anims(H, sway=0.08):
    def base(t, T, amp): w = t / T * TAU; return {'@root': (0, amp * S(w), 0), 'body': (0.05 * S(w), 0, 0.05 * S(w / 2)), 'tail1': (0.15 * S(w - 1), 0.2 * S(w / 2), 0), 'tail2': (0.25 * S(w - 2), 0.3 * S(w / 2 - 1), 0), 'orbit': (0, t / T * TAU, 0)}
    def idle(t): return base(t, 2.4, 0.05)
    def walk(t): o = base(t, 1.2, 0.04); o['body'] = (0.25, 0, 0.1 * S(t / 1.2 * TAU)); return o
    def run(t): o = base(t, 0.6, 0.03); o['body'] = (0.5, 0, 0); o['tail1'] = (-0.4, 0, 0); return o
    def attack(t): o = base(t, 1.0, 0.03); d = bump(t, 0.3, 0.7); o['@root'] = (0, 0.05 * d, 0.4 * d); o['body'] = (0.4 * d, 0, 0); o['@scale:body'] = (1 + 0.2 * d,) * 3; return o
    def hit(t): o = base(t, 0.5, 0.0); k = bump(t, 0, 0.5); o['@root'] = (0, 0.05 * k, -0.15 * k); o['@scale:body'] = (1 - 0.2 * k, 1 + 0.15 * k, 1 - 0.2 * k); return o
    def defeat(t): o = base(t, 1.0, 0.0); k = ease(t / 1.2); o['@root'] = (0, -0.3 * k, 0); o['@scale:body'] = (max(0.02, 1 - k),) * 3; return o
    def happy(t): o = base(t, 1.0, 0.0); o['@root'] = (0, 0.15 * bump(t, 0, 1), 0); o['body'] = (0, TAU * ease(t), 0); return o
    out = {'idle_loop': (2.4, idle), 'walk_loop': (1.2, walk), 'run_loop': (0.6, run), 'attack': (1.0, attack), 'hit': (0.5, hit), 'defeat': (1.4, defeat), 'happy': (1.0, happy)}
    for k, (T, f) in out.items():  # every pose names the scale so it resets between motions
        out[k] = (T, (lambda f: lambda t: {'@scale:body': (1, 1, 1), **f(t)})(f))
    return out

def wisp(kind='blue'):
    col = {'blue': ('#7fd8ff', '#d8f4ff'), 'green': ('#8dffb0', '#e0ffe8'), 'gold': ('#ffd166', '#fff3cf')}[kind]
    H = 1.0
    P = {'core': (col[1], 0.3, 1.0), 'flame': (col[0], 0.3, 1.0), 'spark': (col[1], 0.3, 1.0), 'mouth': ('#3a5a7a', 0.4, 0.0)}
    bones = [('root', None, (0, H, 0)), ('body', 'root', (0, H, 0)), ('tail1', 'body', (0, H + 0.12, -0.06)), ('tail2', 'tail1', (0, H + 0.26, -0.14)), ('orbit', 'root', (0, H, 0))]
    sh = [E((0, H, 0), (0.13, 0.13, 0.13), 'body', 'core'), Cn((0, H + 0.06, -0.03), (0, H + 0.2, -0.1), 0.1, 0.05, 'tail1', 'flame', k=0.06),
          Cn((0, H + 0.2, -0.1), (0, H + 0.36, -0.2), 0.05, 0.005, 'tail2', 'flame', k=0.04)]
    for i in range(3):
        a = i / 3 * TAU; sh.append(E((0.24 * math.cos(a), H + 0.05 * math.sin(a * 2), 0.24 * math.sin(a)), (0.025, 0.025, 0.025), 'orbit', 'spark', k=0.0))
    eyes = eyes2('body', (0.0, H + 0.02, 0.0), (0.3, 0.05, 1), (0.024, 0.032, 0.012), fwd=0.7)
    return Creature('Wisp', bones, sh, P, eyes, float_anims(H), cell=0.004, tris=6000, rules=[('mouth', mouth_arc(H - 0.04, 9, 0.1, 0.022, 0.0025))],
                    fur=0.0, ground=False, glow=col[0]), '#2a4a6a'

def ghost():
    H = 0.55
    P = {'sheet': ('#e6f0ff', 0.6, 0.35), 'shade': ('#b8c6e6', 0.6, 0.2), 'mouth': ('#3a3a5a', 0.6, 0.0), 'thread': ('#ffd27a', 0.4, 1.0)}
    bones = [('root', None, (0, H, 0)), ('body', 'root', (0, H + 0.35, 0)), ('tail1', 'body', (0, H, 0)), ('tail2', 'tail1', (0, H - 0.25, 0)), ('orbit', 'root', (0, H, 0)),
             ('arm_L', 'body', (0.2, H + 0.25, 0)), ('arm_R', 'body', (-0.2, H + 0.25, 0))]
    sh = [E((0, H + 0.4, 0), (0.22, 0.22, 0.2), 'body', 'sheet'), Cn((0, H + 0.3, 0), (0, H - 0.2, -0.04), 0.22, 0.27, 'tail1', 'sheet', k=0.08)]
    for i in range(7):  # a wavy hem
        a = i / 7 * TAU; sh.append(Cn((0.22 * math.sin(a), H - 0.15, 0.2 * math.cos(a) - 0.04), (0.25 * math.sin(a), H - 0.33 - 0.04 * (i % 2), 0.23 * math.cos(a) - 0.08), 0.06, 0.012, 'tail2', 'sheet', k=0.05))
    sh += mirror(lambda x, s: [Cn((0.18 * x, H + 0.28, 0.02), (0.3 * x, H + 0.18, 0.08), 0.05, 0.03, f'arm_{s}', 'sheet', k=0.05)])
    rules = [('shade', lambda p, n: np.clip((H + 0.05 - p[..., 1]) / 0.3, 0, 1) * 0.6), ('mouth', lambda p, n: np.clip(1 - np.hypot(p[..., 0] / 0.03, (p[..., 1] - H - 0.33) / 0.04), 0, 1) * 3 * (p[..., 2] > 0.1))]
    eyes = eyes2('body', (0.0, H + 0.42, 0.0), (0.32, 0.1, 1), (0.03, 0.04, 0.014), fwd=0.6)
    an = float_anims(H)
    an = with_extra(an, lambda k, t: {'arm_L': (0, 0, -0.2 + 0.15 * S(t * 3)), 'arm_R': (0, 0, 0.2 - 0.15 * S(t * 3))})
    return Creature('GraveyardGhost', bones, sh, P, eyes, an, cell=0.005, tris=8000, rules=rules, fur=0.0, ground=False, glow='#cfe0ff'), '#2a2a4a'

# ---------------- Primeval beast ----------------
def primeval():
    P = {'wool': ('#7a4a2e', 0.95), 'deep': ('#4e2e1c', 0.95), 'face': ('#5a3a28', 0.85), 'tusk': ('#f1e6cc', 0.4), 'hoof': ('#2e2622', 0.6), 'horn': ('#3a3028', 0.5), 'mouth': ('#2a1a14', 0.6)}
    bones = quad_bones(hip=(0, 1.3, -0.55), chest=(0, 1.4, 0.35), neck=(0, 1.45, 0.75), head=(0, 1.4, 0.95),
                       legs={'front': (0.34, 1.0, 0.45), 'back': (0.34, 1.0, -0.6)}, tail=((0, 1.4, -0.95), (0, 1.1, -1.05)), ears=(0.3, 1.6, 0.9))
    sh = [E((0, 1.45, 0.05), (0.55, 0.62, 0.85), 'chest', 'wool'), E((0, 1.85, 0.25), (0.42, 0.35, 0.45), 'chest', 'wool', k=0.2),  # hump
          E((0, 1.35, -0.55), (0.48, 0.5, 0.4), 'hips', 'wool', k=0.2), E((0, 1.42, 1.0), (0.3, 0.3, 0.3), 'head', 'face', k=0.12)]
    for i in range(10):  # shaggy hanging fur
        a = (i / 9 - 0.5) * 2.6; z = 0.6 * math.sin(a * 0.6) + 0.05
        sh += mirror(lambda x, s, a=a, z=z: [Ellipsoid((0.5 * x, 0.95, z), (0.1, 0.25, 0.14), 'chest' if z > -0.2 else 'hips', 'deep', k=0.12)])
    def tusk(x, s):
        pts = [(0.14 * x, 1.25, 1.18), (0.22 * x, 1.05, 1.35), (0.26 * x, 1.1, 1.6), (0.2 * x, 1.35, 1.72)]; r = [0.07, 0.06, 0.045, 0.02]
        return [Cone(pts[i], pts[i + 1], r[i], r[i + 1], 'head', 'tusk', k=0.02) for i in range(3)]
    sh += mirror(tusk)
    sh += mirror(lambda x, s: [Cone((0.2 * x, 1.66, 0.95), (0.36 * x, 1.82, 0.85), 0.06, 0.02, 'head', 'horn', k=0.03),
                               Cone((0.34 * x, 1.05, 0.45), (0.34 * x, 0.45, 0.47), 0.2, 0.16, f'front_upper_{s}', 'wool', k=0.15),
                               Cone((0.34 * x, 0.45, 0.47), (0.34 * x, 0.06, 0.48), 0.16, 0.15, f'front_lower_{s}', 'deep', k=0.05),
                               Cone((0.34 * x, 1.05, -0.6), (0.34 * x, 0.45, -0.63), 0.22, 0.16, f'back_upper_{s}', 'wool', k=0.15),
                               Cone((0.34 * x, 0.45, -0.63), (0.34 * x, 0.06, -0.62), 0.16, 0.15, f'back_lower_{s}', 'deep', k=0.05),
                               Ellipsoid((0.3 * x, 1.58, 0.9), (0.1, 0.06, 0.06), f'ear_{s}', 'face', k=0.05)])
    sh += [Cone((0, 1.4, -0.95), (0, 1.05, -1.05), 0.06, 0.08, 'tail1', 'deep', k=0.05)]
    rules = [('hoof', lambda p, n: (p[..., 1] < 0.14) * 1.0), ('mouth', mouth_arc(1.24, 3, 1.18, 0.12, 0.006))]
    eyes = eyes2('head', (0.02, 1.5, 1.0), (0.55, 0.15, 1), (0.045, 0.05, 0.02))
    DEF_SINK[0] = 0.9
    return Creature('PrimevalBeast', bones, sh, P, eyes, quad_anims(stride=0.3, bounce=0.03, T_walk=1.5, wag=0.2, heavy=True), cell=0.02, tris=15000, rules=rules, fur=0.14), '#2a1a10'

# ---------------- Frost Wyrm ----------------
def frost_wyrm():
    P = {'scale': ('#7fb6d8', 0.4), 'belly': ('#dff1fb', 0.5), 'dark': ('#3f6f9a', 0.45), 'ice': ('#c8f6ff', 0.15, 0.8), 'wing': ('#5d8fb8', 0.5), 'horn': ('#eef6fb', 0.3), 'claw': ('#e8eef4', 0.3), 'mouth': ('#1e2a3a', 0.6)}
    bones = quad_bones(hip=(0, 0.9, -0.5), chest=(0, 1.0, 0.25), neck=(0, 1.3, 0.55), head=(0, 1.85, 0.8),
                       legs={'front': (0.3, 0.8, 0.3), 'back': (0.32, 0.8, -0.5)}, tail=((0, 0.85, -0.95), (0, 0.55, -1.6)), ears=None)
    bones += [('wing1_L', 'chest', (0.25, 1.35, 0.1)), ('wing2_L', 'wing1_L', (0.9, 1.7, -0.2)), ('wing1_R', 'chest', (-0.25, 1.35, 0.1)), ('wing2_R', 'wing1_R', (-0.9, 1.7, -0.2)), ('jaw', 'head', (0, 1.8, 0.9))]
    sh = [E((0, 1.0, -0.1), (0.38, 0.4, 0.62), 'chest', 'scale'), E((0, 0.85, -0.05), (0.3, 0.28, 0.55), 'chest', 'belly', k=0.1),
          Cn((0, 1.15, 0.4), (0, 1.7, 0.72), 0.24, 0.14, 'neck', 'scale', k=0.12), E((0, 1.85, 0.85), (0.19, 0.17, 0.22), 'head', 'scale', k=0.08),
          E((0, 1.79, 1.06), (0.12, 0.09, 0.12), 'head', 'scale', k=0.06),
          Cn((0, 0.9, -0.6), (0, 0.7, -1.3), 0.26, 0.12, 'tail1', 'scale', k=0.1), Cn((0, 0.7, -1.3), (0, 0.45, -1.9), 0.12, 0.03, 'tail2', 'scale', k=0.05)]
    for i in range(8):  # ice crystals down the spine
        t = i / 7; y = 2.0 - 1.4 * t + (0.25 if i > 3 else 0) * 0; z = 0.7 - 2.3 * t
        y = [2.02, 1.75, 1.5, 1.42, 1.38, 1.25, 1.05, 0.8][i]
        sh.append(Cn((0, y - 0.1, z), (0, y + 0.12 - 0.01 * i, z - 0.08), 0.07 - 0.005 * i, 0.008, ['head', 'neck', 'neck', 'chest', 'chest', 'hips', 'tail1', 'tail1'][i], 'ice', k=0.03))
    def side(x, s):
        o = [Cn((0.12 * x, 1.98, 0.78), (0.2 * x, 2.18, 0.6), 0.04, 0.008, 'head', 'horn', k=0.02),
             Cn((0.3 * x, 0.9, 0.3), (0.3 * x, 0.4, 0.38), 0.13, 0.09, f'front_upper_{s}', 'scale', k=0.1), Cn((0.3 * x, 0.4, 0.38), (0.3 * x, 0.06, 0.42), 0.09, 0.08, f'front_lower_{s}', 'scale', k=0.04),
             Cn((0.32 * x, 0.9, -0.5), (0.32 * x, 0.4, -0.45), 0.17, 0.09, f'back_upper_{s}', 'scale', k=0.12), Cn((0.32 * x, 0.4, -0.45), (0.32 * x, 0.06, -0.48), 0.09, 0.08, f'back_lower_{s}', 'scale', k=0.04),
             Cn((0.25 * x, 1.3, 0.1), (0.9 * x, 1.7, -0.2), 0.06, 0.04, f'wing1_{s}', 'dark', k=0.04), Cn((0.9 * x, 1.7, -0.2), (1.5 * x, 1.4, -0.5), 0.04, 0.015, f'wing2_{s}', 'dark', k=0.03),
             E((0.75 * x, 1.42, -0.35), (0.5, 0.05, 0.28), f'wing1_{s}', 'wing', k=0.05, rot=rotZ(0.3 * x)),
             E((1.2 * x, 1.4, -0.55), (0.32, 0.04, 0.26), f'wing2_{s}', 'wing', k=0.05, rot=rotZ(-0.2 * x))]
        for c in (-0.06, 0, 0.06): o.append(Cn((0.3 * x + c, 0.04, 0.45), (0.3 * x + c * 1.3, 0.02, 0.53), 0.025, 0.006, f'front_lower_{s}', 'claw', k=0.01))
        return o
    sh += mirror(side)
    rules = [('dark', lambda p, n: np.clip((vnoise(p, 9, 2) - 0.62) / 0.03, 0, 1) * (p[..., 1] > 1.0)), ('mouth', mouth_arc(1.74, 2, 1.1, 0.09, 0.005))]
    eyes = eyes2('head', (0.02, 1.9, 0.9), (0.6, 0.25, 1), (0.04, 0.046, 0.02), glow=True)
    an = quad_anims(stride=0.35, bounce=0.03, T_walk=1.3, ears=False, wag=0.3, heavy=True)
    def extra(k, t):
        w = t * 3; o = {'wing1_L': (0, 0, -0.15 + 0.05 * S(w)), 'wing1_R': (0, 0, 0.15 - 0.05 * S(w)), 'wing2_L': (0, 0, 0.3), 'wing2_R': (0, 0, -0.3)}
        if k == 'attack':  # rears up, wings wide, frost breath
            r = bump(t, 0.1, 0.9); o.update({'wing1_L': (0, 0, 0.6 * r), 'wing1_R': (0, 0, -0.6 * r), 'wing2_L': (0, 0, -0.2 * r), 'wing2_R': (0, 0, 0.2 * r), 'jaw': (0.5 * bump(t, 0.4, 0.9), 0, 0)})
        if k == 'happy': o.update({'wing1_L': (0, 0, 0.8 * abs(S(t * 8))), 'wing1_R': (0, 0, -0.8 * abs(S(t * 8)))})
        return o
    DEF_SINK[0] = 0.55
    return Creature('FrostWyrm', bones, sh, P, eyes, with_extra(an, extra), cell=0.016, tris=15000, rules=rules, fur=0.04, glow='#bff4ff'), '#8fe6ff'

# ---------------- The Deep One ----------------
def deep_one():
    P = {'skin': ('#3a7a6a', 0.35), 'belly': ('#a8d0b0', 0.45), 'fin': ('#2c5a6a', 0.4), 'glow': ('#7fffd0', 0.4, 1.0), 'mouth': ('#14201c', 0.6), 'tooth': ('#f2ecdc', 0.3)}
    n = 7; pts = []
    for i in range(n + 1):  # an S-shaped neck rising out of the water
        t = i / n; pts.append((0.0, 0.0 + 3.0 * t, -0.9 * math.sin(t * math.pi) + 0.6 * t))
    bones = [('root', None, (0, 0, 0))] + [(f'spine{i}', 'root' if i == 0 else f'spine{i - 1}', pts[i]) for i in range(n)] + [('head', f'spine{n - 1}', pts[n]), ('jaw', 'head', (0, pts[n][1] - 0.05, pts[n][2] + 0.2))]
    sh = []
    for i in range(n):
        r0 = 0.42 - 0.03 * i; r1 = 0.42 - 0.03 * (i + 1)
        sh.append(Cone(pts[i], pts[i + 1], r0, r1, f'spine{i}', 'skin', k=0.1))
        sh.append(Cone((0, pts[i][1] + 0.1, pts[i][2] - r0 * 0.8), (0, pts[i][1] + 0.4, pts[i][2] - r0 * 1.2), 0.07, 0.01, f'spine{i}', 'fin', k=0.06))
    hx, hy, hz = pts[n]
    sh += [E((0, hy + 0.1, hz + 0.15), (0.36, 0.3, 0.42), 'head', 'skin', k=0.12), E((0, hy - 0.08, hz + 0.25), (0.3, 0.14, 0.35), 'jaw', 'belly', k=0.08)]
    sh += mirror(lambda x, s: [Cone((0.3 * x, hy + 0.15, hz), (0.65 * x, hy + 0.35, hz - 0.3), 0.12, 0.02, 'head', 'fin', k=0.08),
                               Cone((0.12 * x, hy - 0.02, hz + 0.52), (0.13 * x, hy - 0.12, hz + 0.53), 0.03, 0.006, 'head', 'tooth', k=0.01)])
    rules = [('belly', lambda p, n_: np.clip((n_[..., 2] - 0.3) / 0.2, 0, 1) * (p[..., 1] < hy - 0.1)),
             ('glow', lambda p, n_: np.clip((vnoise(p, 6, 13) - 0.68) / 0.03, 0, 1) * (n_[..., 2] < 0.2)),
             ('mouth', lambda p, n_: (np.abs(p[..., 1] - (hy - 0.02 + 0.5 * p[..., 0] ** 2)) < 0.012) * (p[..., 2] > hz + 0.2))]
    eyes = eyes2('head', (0.05, hy + 0.2, hz + 0.2), (0.75, 0.2, 1), (0.08, 0.09, 0.035), glow=True)
    def wave(t, A, T, ph=0): return {f'spine{i}': (A * S(t / T * TAU - i * 0.7 + ph) * 0.4, A * S(t / T * TAU - i * 0.7 + ph), 0) for i in range(n)}
    def idle(t): o = wave(t, 0.06, 3.0); o['head'] = (0.05 * S(t), 0.1 * S(t / 3 * TAU), 0); return o
    def walk(t): o = wave(t, 0.12, 1.6); o['@root'] = (0, 0, 0); return o
    def run(t): o = wave(t, 0.18, 1.0); return o
    def attack(t):
        c = ease(t / 0.4) * (1 - ease((t - 0.5) / 0.1)); l = bump(t, 0.45, 0.85); o = wave(t, 0.03, 2)
        for i in range(n): o[f'spine{i}'] = (0.08 * c - 0.12 * l, 0, 0)
        o['head'] = (-0.3 * c + 0.3 * l, 0, 0); o['jaw'] = (0.6 * (c + l), 0, 0); return o
    def hit(t): k = bump(t, 0, 0.6); o = wave(t, 0.03, 2); o.update({f'spine{i}': (-0.06 * k, 0, 0.04 * k) for i in range(n)}); o['head'] = (-0.4 * k, 0.3 * k, 0); return o
    def defeat(t): k = ease(t / 1.6); o = wave(t, 0.1 * (1 - k), 1); o['@root'] = (0, -3.4 * k, 0); o['head'] = (-0.5 * k, 0, 0); o['jaw'] = (0.4 * k, 0, 0); return o
    def happy(t): o = wave(t, 0.1, 1.0); o['jaw'] = (0.5 * bump(t, 0.1, 0.9), 0, 0); o['head'] = (-0.4 * bump(t, 0, 1), 0, 0); return o
    anims = {'idle_loop': (3.0, idle), 'walk_loop': (1.6, walk), 'run_loop': (1.0, run), 'attack': (1.2, attack), 'hit': (0.6, hit), 'defeat': (2.0, defeat), 'happy': (1.0, happy)}
    for k, (T, f) in anims.items(): anims[k] = (T, (lambda f: lambda t: {'@root': (0, 0, 0), **f(t)})(f))
    return Creature('DeepOne', bones, sh, P, eyes, anims, cell=0.03, tris=15000, rules=rules, fur=0.03, glow='#7fffd0'), '#b8fff0'

ALL = {'rat': rat, 'cow': cow, 'giant_bat': bat, 'alpha_wolf': lambda: wolf_kin('alpha'), 'dire_wolf': lambda: wolf_kin('dire'),
       'cave_spider': lambda: spider('cave'), 'giant_spider': lambda: spider('giant'), 'fire_beetle': lambda: beetle('fire'), 'wisp': wisp,
       'graveyard_ghost': ghost, 'primeval_beast': primeval, 'thornmother': lambda: spider('thornmother'), 'frost_wyrm': frost_wyrm,
       'deep_one': deep_one, 'dust_titan': lambda: beetle('titan')}
SINK = {'rat': 0.06, 'cow': 0.6, 'alpha_wolf': 0.27, 'dire_wolf': 0.27, 'primeval_beast': 0.9, 'frost_wyrm': 0.55}

if __name__ == '__main__':
    out = sys.argv[1]; names = sys.argv[2:] or list(ALL); os.makedirs(out, exist_ok=True)
    for n in names:
        cr, iris = ALL[n]()
        DEF_SINK[0] = SINK.get(n, 0.3)
        cr.build()
        tris, size = write_glb(cr, os.path.join(out, f'creature_{n}.glb'), eye_texture(iris, glow=bool(cr.eyes[0].get('glow'))))
        print(n, tris, 'tris', f'{size / 1024:.0f} KB', flush=True)
