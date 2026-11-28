"""Emberfall creatures for the Godot version: original, round and friendly-looking designs.
python3 creatures.py OUT_DIR [names...]"""
import sys, math, os, json
import numpy as np
from creaturekit import *

S = math.sin; C = math.cos; TAU = 2 * math.pi
def ease(x): x = max(0, min(1, x)); return x * x * (3 - 2 * x)
def bump(t, a, b):  # 0 -> 1 -> 0 between a and b
    if t <= a or t >= b: return 0
    return math.sin((t - a) / (b - a) * math.pi)

# ================= four-legged creatures share one rig and one set of motions =================
def quad_bones(hip, chest, neck, head, legs, tail, ears, scale=1):
    b = [('root', None, (0, hip[1], 0)), ('hips', 'root', hip), ('chest', 'hips', chest), ('neck', 'chest', neck), ('head', 'neck', head)]
    for s, x in (('L', 1), ('R', -1)):
        fx, fy, fz = legs['front']; bx, by, bz = legs['back']
        b += [(f'front_upper_{s}', 'chest', (fx * x, fy, fz)), (f'front_lower_{s}', f'front_upper_{s}', (fx * x, fy * 0.5, fz + 0.01)),
              (f'back_upper_{s}', 'hips', (bx * x, by, bz)), (f'back_lower_{s}', f'back_upper_{s}', (bx * x, by * 0.5, bz - 0.02))]
        if ears: ex, ey, ez = ears; b.append((f'ear_{s}', 'head', (ex * x, ey, ez)))
    t1, t2 = tail; b += [('tail1', 'hips', t1), ('tail2', 'tail1', t2)]
    return b

def quad_anims(stride=0.5, bounce=0.03, T_walk=0.9, ears=True, wag=0.35, heavy=False):
    def legs(ph, A, knee):
        o = {}
        for name, p in (('front_upper_L', 0), ('back_upper_R', 0), ('front_upper_R', math.pi), ('back_upper_L', math.pi)):
            a = -A * S(ph + p); o[name] = (a, 0, 0)
            lift = max(0, C(ph + p)); o[name.replace('upper', 'lower')] = ((knee * lift if 'front' in name else -knee * lift), 0, 0)
        return o
    def idle(t):
        w = t / 2.4 * TAU; o = {'@root': (0, 0.006 * S(w), 0), 'chest': (0.02 * S(w), 0, 0), 'head': (0.04 * S(w + 1), 0.08 * S(w / 2), 0),
                               'tail1': (0.2, wag * S(w * 2), 0), 'tail2': (0.1, wag * 0.8 * S(w * 2 - 0.8), 0)}
        if ears: o['ear_L'] = (0, 0, 0.08 * max(0, S(w * 3)) ** 8); o['ear_R'] = (0, 0, -0.08 * max(0, S(w * 3 + 0.4)) ** 8)
        return o
    def walk(t):
        w = t / T_walk * TAU; o = legs(w, stride, 0.7)
        o.update({'@root': (0, bounce * abs(S(w)) - bounce * 0.5, 0), 'chest': (0, 0.05 * S(w), 0), 'hips': (0, -0.05 * S(w), 0.03 * S(w)),
                  'head': (0.05 * S(2 * w), -0.04 * S(w), 0), 'tail1': (0.25, 0.25 * S(w), 0), 'tail2': (0.15, 0.25 * S(w - 0.8), 0)})
        return o
    def run(t):
        w = t / (T_walk * 0.55) * TAU; o = {}
        for name, p in (('front_upper_L', 0), ('front_upper_R', 0.5), ('back_upper_L', math.pi), ('back_upper_R', math.pi + 0.5)):
            o[name] = (-stride * 1.4 * S(w + p), 0, 0); o[name.replace('upper', 'lower')] = ((1 if 'front' in name else -1) * 0.9 * max(0, C(w + p)), 0, 0)
        o.update({'@root': (0, bounce * 2 * abs(S(w)), 0), 'hips': (0.12 * S(w), 0, 0), 'chest': (-0.15 * S(w), 0, 0), 'head': (0.1 * S(w), 0, 0),
                  'tail1': (0.5, 0, 0), 'tail2': (0.2, 0.1 * S(w), 0)})
        if ears: o['ear_L'] = (-0.3, 0, 0); o['ear_R'] = (-0.3, 0, 0)
        return o
    def attack(t):  # crouch, lunge, recover
        c = ease(t / 0.3) * (1 - ease((t - 0.35) / 0.1)); l = bump(t, 0.35, 0.75); r = 1 - ease((t - 0.7) / 0.3) if t > 0.7 else 1
        o = {'@root': (0, -0.05 * c + 0.03 * l, -0.05 * c + 0.18 * l * (1 if heavy else 1)), 'hips': (0.15 * c - 0.1 * l, 0, 0), 'chest': (-0.2 * c + 0.15 * l, 0, 0),
             'head': (-0.25 * c - 0.2 * l, 0, 0), 'front_upper_L': (0.3 * c - 0.6 * l, 0, 0), 'front_upper_R': (0.3 * c - 0.5 * l, 0, 0),
             'back_upper_L': (-0.2 * c + 0.4 * l, 0, 0), 'back_upper_R': (-0.2 * c + 0.4 * l, 0, 0), 'tail1': (0.5 * c, 0, 0)}
        if ears: o['ear_L'] = (-0.4 * (c + l), 0, 0); o['ear_R'] = (-0.4 * (c + l), 0, 0)
        return o
    def hit(t):
        k = bump(t, 0, 0.5) ; o = {'@root': (0, 0.02 * k, -0.08 * k), 'chest': (0.2 * k, 0, 0.1 * k), 'head': (0.35 * k, 0.2 * k, 0), 'tail1': (-0.3 * k, 0, 0)}
        if ears: o['ear_L'] = (0.5 * k, 0, 0.3 * k); o['ear_R'] = (0.5 * k, 0, -0.3 * k)
        return o
    def defeat(t):  # topple onto its side, a little bounce, then lie still
        k = ease(t / 0.6); b = bump(t, 0.6, 0.8) * 0.15
        h = 0.62 * 0  # sink so the side rests near the ground
        o = {'root': (0, 0, (k * 1.45 - b)), '@root': (0, -k * DEF_SINK[0], 0), 'head': (0.2 * k, 0, -0.3 * k), 'tail1': (0, 0.6 * k, 0),
             'front_upper_L': (-0.4 * k, 0, -0.3 * k), 'back_upper_L': (0.4 * k, 0, -0.3 * k), 'front_upper_R': (-0.2 * k, 0, 0.2 * k), 'back_upper_R': (0.2 * k, 0, 0.2 * k)}
        if ears: o['ear_L'] = (0.5 * k, 0, 0); o['ear_R'] = (0.5 * k, 0, 0)
        return o
    def happy(t):  # a little hop
        k = bump(t, 0.1, 0.6); s = bump(t, 0, 0.15) + bump(t, 0.55, 0.75)
        o = {'@root': (0, 0.12 * k - 0.03 * s, 0), 'head': (-0.15 * k, 0, 0.1 * S(t * 18) * (t < 0.9)), 'tail1': (0.4, 0.5 * S(t * 25), 0), 'tail2': (0.2, 0.5 * S(t * 25 - 1), 0),
             'front_upper_L': (-0.4 * k, 0, 0), 'front_upper_R': (-0.4 * k, 0, 0), 'back_upper_L': (0.3 * k, 0, 0), 'back_upper_R': (0.3 * k, 0, 0)}
        return o
    return {'idle_loop': (2.4, idle), 'walk_loop': (T_walk, walk), 'run_loop': (T_walk * 0.55, run), 'attack': (1.0, attack), 'hit': (0.5, hit), 'defeat': (1.6, defeat), 'happy': (1.0, happy)}
DEF_SINK = [0.3]

# ---------------- Wolf ----------------
def wolf(variant='wolf'):
    hollow = variant == 'hollow'
    P = {'fur': ('#6f7a8c', 0.85), 'cream': ('#efe4d2', 0.85), 'dark': ('#3b3f4a', 0.8), 'nose': ('#2a2228', 0.35), 'ember': ('#ff8a3d', 0.8), 'inner': ('#e9a59a', 0.7),
         'mouth': ('#3a2228', 0.6)}
    if hollow:
        P.update({'fur': ('#8b908d', 0.9), 'cream': ('#c9ccc6', 0.9), 'dark': ('#5d625f', 0.9), 'ember': ('#7fffd0', 0.7, 1.0), 'inner': ('#9aa39e', 0.8), 'glow': ('#7fffd0', 0.6, 1.0)})
    bones = quad_bones(hip=(0, 0.47, -0.2), chest=(0, 0.52, 0.14), neck=(0, 0.6, 0.3), head=(0, 0.74, 0.4),
                       legs={'front': (0.12, 0.42, 0.18), 'back': (0.12, 0.42, -0.24)}, tail=((0, 0.55, -0.4), (0, 0.6, -0.55)), ears=(0.085, 0.9, 0.39))
    E = lambda *a, **k: Ellipsoid(*a, **k); Cn = lambda *a, **k: Cone(*a, **k)
    sh = [E((0, 0.52, 0.1), (0.19, 0.2, 0.23), 'chest', 'fur', rot=rotX(0.15)),
          E((0, 0.49, -0.2), (0.17, 0.17, 0.21), 'hips', 'fur', k=0.08),
          E((0, 0.47, 0.13), (0.15, 0.12, 0.2), 'chest', 'cream', k=0.06),  # belly
          E((0, 0.6, 0.26), (0.19, 0.18, 0.14), 'neck', 'cream', k=0.06),  # ruff
          E((0, 0.77, 0.42), (0.165, 0.15, 0.15), 'head', 'fur', k=0.06),
          E((0, 0.72, 0.56), (0.075, 0.06, 0.085), 'head', 'cream', k=0.05),  # muzzle
          E((0, 0.755, 0.64), (0.03, 0.022, 0.02), 'head', 'nose', k=0.012)]
    for x in (1, -1):
        s = 'L' if x > 0 else 'R'
        sh += [E((0.13 * x, 0.72, 0.42), (0.06, 0.05, 0.07), 'head', 'cream', k=0.04, rot=rotZ(-0.6 * x)),  # cheek tufts
               E((0.15 * x, 0.6, 0.24), (0.06, 0.07, 0.06), 'neck', 'cream', k=0.05, rot=rotZ(-0.5 * x)),
               Cn((0.08 * x, 0.88, 0.4), (0.12 * x, 1.0, 0.38), 0.06, 0.018, f'ear_{s}', 'fur', k=0.03),
               Cn((0.083 * x, 0.88, 0.425), (0.112 * x, 0.97, 0.405), 0.036, 0.01, f'ear_{s}', 'inner', k=0.0),
               Cn((0.12 * x, 0.45, 0.17), (0.11 * x, 0.22, 0.19), 0.06, 0.045, f'front_upper_{s}', 'fur'),
               Cn((0.11 * x, 0.22, 0.19), (0.11 * x, 0.05, 0.2), 0.045, 0.045, f'front_lower_{s}', 'fur', k=0.02),
               E((0.11 * x, 0.04, 0.23), (0.055, 0.045, 0.07), f'front_lower_{s}', 'cream', k=0.03),
               Cn((0.12 * x, 0.46, -0.24), (0.12 * x, 0.24, -0.28), 0.085, 0.05, f'back_upper_{s}', 'fur', k=0.05),
               Cn((0.12 * x, 0.24, -0.28), (0.12 * x, 0.05, -0.24), 0.045, 0.045, f'back_lower_{s}', 'fur', k=0.02),
               E((0.12 * x, 0.04, -0.21), (0.055, 0.045, 0.07), f'back_lower_{s}', 'cream', k=0.03)]
    sh += [Cn((0, 0.53, -0.36), (0, 0.6, -0.5), 0.05, 0.08, 'tail1', 'fur', k=0.04),
           E((0, 0.66, -0.6), (0.085, 0.09, 0.12), 'tail2', 'fur', k=0.06, rot=rotX(0.6)),
           E((0, 0.71, -0.68), (0.06, 0.06, 0.07), 'tail2', 'ember', k=0.05)]
    def back_stripe(p, n):  # darker saddle along the back
        return np.clip((p[..., 1] - 0.62) / 0.05, 0, 1) * (np.abs(p[..., 0]) < 0.14) * (p[..., 2] < 0.3) * (p[..., 2] > -0.45)
    def brow_mark(p, n):  # ember (or glowing) marks over the eyes
        r = 0
        for x in (0.07, -0.07): r = np.maximum(r, 1 - np.hypot((p[..., 0] - x) / 0.028, (p[..., 1] - 0.86) / 0.012))
        return np.clip(r * 3, 0, 1) * (p[..., 2] > 0.45)
    def mouth(p, n):
        x = p[..., 0]; y = p[..., 1]; z = p[..., 2]
        curve = 0.705 + 22 * (np.abs(x) - 0.022) ** 2 * (np.abs(x) > 0.022)
        line = np.abs(y - curve) < 0.0035
        mid = (np.abs(x) < 0.003) & (y > 0.705) & (y < 0.74)
        return ((line & (np.abs(x) < 0.05)) | mid) * (z > 0.58)
    rules = [('dark', back_stripe), ('ember', brow_mark), ('mouth', mouth)]
    if hollow:
        def cracks(p, n):  # glowing seams where the blight has hollowed it
            v = vnoise(p, 14, 7); return np.clip(1 - np.abs(v - 0.5) / 0.012, 0, 1) * (vnoise(p, 5, 9) > 0.55) * (p[..., 1] > 0.3)
        rules.append(('glow', cracks))
    eyes = [{'bone': 'head', 'from': (0.02 * x, 0.79, 0.42), 'dir': (0.45 * x, 0.22, 1), 'r': (0.04, 0.046, 0.022), 'glow': hollow} for x in (1, -1)]
    return Creature('HollowWolf' if hollow else 'Wolf', bones, sh, P, eyes, quad_anims(stride=0.5, T_walk=0.85), cell=0.007, tris=12000, rules=rules,
                    glow='#7fffd0' if hollow else None), ('#bfe8ff' if hollow else '#6b4a2b')

# ---------------- Boar ----------------
def boar():
    P = {'hide': ('#8a5a3c', 0.85), 'belly': ('#c79f7a', 0.85), 'mane': ('#4a3022', 0.9), 'snout': ('#e2a99a', 0.6), 'ivory': ('#f3ead6', 0.4), 'hoof': ('#3a2a22', 0.5),
         'inner': ('#d99a8e', 0.7), 'mouth': ('#3a2228', 0.6), 'nostril': ('#5a2f2f', 0.6)}
    bones = quad_bones(hip=(0, 0.4, -0.2), chest=(0, 0.42, 0.12), neck=(0, 0.45, 0.26), head=(0, 0.47, 0.34),
                       legs={'front': (0.13, 0.3, 0.16), 'back': (0.13, 0.3, -0.24)}, tail=((0, 0.46, -0.48), (0, 0.48, -0.55)), ears=(0.11, 0.62, 0.32))
    E = lambda *a, **k: Ellipsoid(*a, **k); Cn = lambda *a, **k: Cone(*a, **k)
    sh = [E((0, 0.4, -0.05), (0.25, 0.24, 0.38), 'chest', 'hide'),
          E((0, 0.38, -0.25), (0.22, 0.21, 0.2), 'hips', 'hide', k=0.1),
          E((0, 0.31, 0.0), (0.18, 0.12, 0.3), 'chest', 'belly', k=0.08),
          E((0, 0.48, 0.38), (0.175, 0.165, 0.155), 'head', 'hide', k=0.035),
          E((0, 0.42, 0.52), (0.085, 0.075, 0.08), 'head', 'snout', k=0.05),
          E((0, 0.42, 0.585), (0.07, 0.06, 0.02), 'head', 'snout', k=0.02)]
    for x in (1, -1):
        s = 'L' if x > 0 else 'R'
        sh += [Cn((0.06 * x, 0.375, 0.56), (0.085 * x, 0.46, 0.6), 0.02, 0.007, 'head', 'ivory', k=0.006),
               Cn((0.1 * x, 0.58, 0.31), (0.17 * x, 0.66, 0.33), 0.05, 0.015, f'ear_{s}', 'hide', k=0.02),
               Cn((0.1 * x, 0.58, 0.325), (0.155 * x, 0.645, 0.34), 0.028, 0.008, f'ear_{s}', 'inner', k=0.0),
               Cn((0.13 * x, 0.32, 0.15), (0.13 * x, 0.12, 0.16), 0.075, 0.055, f'front_upper_{s}', 'hide', k=0.05),
               Cn((0.13 * x, 0.12, 0.16), (0.13 * x, 0.03, 0.17), 0.05, 0.048, f'front_lower_{s}', 'hoof', k=0.02),
               Cn((0.13 * x, 0.32, -0.25), (0.13 * x, 0.12, -0.26), 0.085, 0.055, f'back_upper_{s}', 'hide', k=0.05),
               Cn((0.13 * x, 0.12, -0.26), (0.13 * x, 0.03, -0.25), 0.05, 0.048, f'back_lower_{s}', 'hoof', k=0.02)]
    for i in range(9):  # a soft bristly mane along the back, swept backwards
        z = 0.42 - i * 0.1; y = 0.6 + 0.035 * math.sin(min(i, 6) / 6 * math.pi) - (0.05 if i > 6 else 0)
        sh.append(Ellipsoid((0, y, z), (0.045, 0.05, 0.075), 'head' if i < 2 else ('chest' if i < 5 else 'hips'), 'mane', k=0.05, rot=rotX(-0.5)))
    sh += [Cn((0, 0.45, -0.46), (0, 0.5, -0.55), 0.02, 0.012, 'tail1', 'hide', k=0.02), E((0, 0.52, -0.57), (0.03, 0.04, 0.03), 'tail2', 'mane', k=0.02)]
    def hoof_split(p, n): return (p[..., 1] < 0.06) * 1.0
    def nostrils(p, n):
        r = 0
        for x in (0.025, -0.025): r = np.maximum(r, 1 - np.hypot((p[..., 0] - x) / 0.012, (p[..., 1] - 0.425) / 0.017))
        return np.clip(r * 4, 0, 1) * (p[..., 2] > 0.59)
    def mouth(p, n):
        x, y, z = p[..., 0], p[..., 1], p[..., 2]
        curve = 0.365 + 18 * (np.abs(x) - 0.0) ** 2
        return (np.abs(y - curve) < 0.004) * (np.abs(x) < 0.06) * (z > 0.51)
    rules = [('hoof', hoof_split), ('nostril', nostrils), ('mouth', mouth)]
    eyes = [{'bone': 'head', 'from': (0.02 * x, 0.51, 0.4), 'dir': (0.42 * x, 0.35, 1), 'r': (0.032, 0.038, 0.018)} for x in (1, -1)]
    return Creature('Boar', bones, sh, P, eyes, quad_anims(stride=0.45, T_walk=0.8, wag=0.2, heavy=True), cell=0.007, tris=12000, rules=rules, fur=0.1), '#4a2f1d'

# ---------------- Chicken ----------------
def chicken():
    P = {'feather': ('#f6efe2', 0.9), 'tip': ('#c98a4b', 0.9), 'comb': ('#e2453c', 0.6), 'beak': ('#f2a93b', 0.45), 'leg': ('#f0a33a', 0.55), 'mouth': ('#7a3a20', 0.6)}
    bones = [('root', None, (0, 0.2, 0)), ('body', 'root', (0, 0.24, 0)), ('head', 'body', (0, 0.38, 0.04)), ('tail', 'body', (0, 0.3, -0.12)),
             ('wing_L', 'body', (0.15, 0.3, 0.0)), ('wing_R', 'body', (-0.15, 0.3, 0.0)),
             ('leg_L', 'body', (0.055, 0.13, 0.0)), ('foot_L', 'leg_L', (0.055, 0.03, 0.01)), ('leg_R', 'body', (-0.055, 0.13, 0.0)), ('foot_R', 'leg_R', (-0.055, 0.03, 0.01))]
    E = lambda *a, **k: Ellipsoid(*a, **k); Cn = lambda *a, **k: Cone(*a, **k)
    sh = [E((0, 0.24, -0.01), (0.16, 0.14, 0.17), 'body', 'feather'),
          E((0, 0.4, 0.05), (0.115, 0.11, 0.105), 'head', 'feather', k=0.09),
          E((0, 0.3, -0.16), (0.07, 0.1, 0.07), 'tail', 'tip', k=0.05, rot=rotX(-0.5)),
          E((0, 0.36, -0.2), (0.05, 0.07, 0.04), 'tail', 'tip', k=0.04, rot=rotX(-0.7)),
          Cn((0, 0.395, 0.14), (0, 0.38, 0.215), 0.032, 0.006, 'head', 'beak', k=0.008),
          E((0, 0.345, 0.165), (0.016, 0.026, 0.012), 'head', 'comb', k=0.01)]
    for i, (z, y, r) in enumerate(((0.07, 0.505, 0.03), (0.035, 0.52, 0.034), (0.0, 0.51, 0.03))):
        sh.append(E((0, y, z), (0.018, r, r), 'head', 'comb', k=0.015))
    for x in (1, -1):
        s = 'L' if x > 0 else 'R'
        sh += [E((0.14 * x, 0.26, -0.05), (0.04, 0.08, 0.12), f'wing_{s}', 'feather', k=0.03, rot=rotX(-0.35)),
               Cn((0.055 * x, 0.13, 0.0), (0.055 * x, 0.025, 0.01), 0.016, 0.012, f'leg_{s}', 'leg', k=0.01)]
        for a in (-0.5, 0, 0.5):
            sh.append(Cn((0.055 * x, 0.012, 0.01), (0.055 * x + 0.05 * math.sin(a), 0.01, 0.01 + 0.05 * math.cos(a)), 0.011, 0.008, f'foot_{s}', 'leg', k=0.008))
    def wing_tips(p, n): return np.clip((np.abs(p[..., 0]) - 0.165) / 0.01, 0, 1) * (p[..., 1] < 0.29) * 1.0
    def chest_fluff(p, n): return 0
    rules = [('tip', lambda p, n: np.clip((-p[..., 2] - 0.09) / 0.03, 0, 1) * (np.abs(p[..., 0]) > 0.12))]
    eyes = [{'bone': 'head', 'from': (0.0, 0.42, 0.05), 'dir': (0.42 * x, 0.12, 1), 'r': (0.029, 0.035, 0.016), 'forward': 0.4} for x in (1, -1)]
    def idle(t):
        w = t / 2 * TAU; peck = bump(t % 2, 1.2, 1.6)
        return {'@root': (0, 0.004 * S(w), 0), 'head': (0.6 * peck, 0.25 * S(w / 2), 0.08 * S(w)), 'body': (0.2 * peck, 0, 0), 'tail': (0.1 * S(w * 2), 0, 0),
                'wing_L': (0, 0, 0.05 * S(w)), 'wing_R': (0, 0, -0.05 * S(w))}
    def walk(t):
        w = t / 0.6 * TAU
        return {'@root': (0, 0.015 * abs(S(w)), 0), 'body': (0, 0, 0.12 * S(w)), 'head': (0.15 * S(2 * w), 0, -0.1 * S(w)), 'leg_L': (-0.6 * S(w), 0, 0), 'leg_R': (0.6 * S(w), 0, 0),
                'foot_L': (0.5 * max(0, C(w)), 0, 0), 'foot_R': (0.5 * max(0, -C(w)), 0, 0), 'tail': (0, 0.2 * S(w), 0)}
    def run(t):
        w = t / 0.36 * TAU; f = 0.6 + 0.4 * S(w * 2)
        return {'@root': (0, 0.03 * abs(S(w)), 0), 'body': (0.35, 0, 0.1 * S(w)), 'head': (-0.3, 0, 0), 'leg_L': (-0.9 * S(w), 0, 0), 'leg_R': (0.9 * S(w), 0, 0),
                'wing_L': (0, 0, 0.9 * f), 'wing_R': (0, 0, -0.9 * f), 'tail': (-0.3, 0, 0)}
    def attack(t):
        c = ease(t / 0.3) * (1 - ease((t - 0.4) / 0.1)); p = bump(t, 0.38, 0.6); f = bump(t, 0.1, 0.8)
        return {'@root': (0, 0.06 * f, 0.08 * p), 'body': (-0.3 * c + 0.4 * p, 0, 0), 'head': (-0.4 * c + 0.9 * p, 0, 0), 'wing_L': (0, 0, 1.1 * f * (0.7 + 0.3 * S(t * 40))), 'wing_R': (0, 0, -1.1 * f * (0.7 + 0.3 * S(t * 40)))}
    def hit(t):
        k = bump(t, 0, 0.5); return {'@root': (0, 0.03 * k, -0.06 * k), 'body': (-0.3 * k, 0, 0), 'head': (-0.4 * k, 0.3 * k, 0), 'wing_L': (0, 0, 0.8 * k), 'wing_R': (0, 0, -0.8 * k)}
    def defeat(t):
        k = ease(t / 0.6)
        return {'root': (0, 0, 1.4 * k), '@root': (0, -0.07 * k, 0), 'head': (0.3 * k, 0, 0.3 * k), 'leg_L': (-0.6 * k, 0, 0), 'leg_R': (-0.6 * k, 0, 0), 'wing_L': (0, 0, 0.3 * k)}
    def happy(t):
        k = bump(t, 0.1, 0.55) + bump(t, 0.55, 1.0) * 0.7; f = 0.5 + 0.5 * S(t * 30)
        return {'@root': (0, 0.08 * k, 0), 'wing_L': (0, 0, 0.8 * f * (t < 0.95)), 'wing_R': (0, 0, -0.8 * f * (t < 0.95)), 'head': (-0.2 * k, 0, 0), 'tail': (-0.4 * k, 0, 0)}
    anims = {'idle_loop': (2.0, idle), 'walk_loop': (0.6, walk), 'run_loop': (0.36, run), 'attack': (0.9, attack), 'hit': (0.5, hit), 'defeat': (1.4, defeat), 'happy': (1.0, happy)}
    return Creature('Chicken', bones, sh, P, eyes, anims, cell=0.004, tris=8000, rules=rules, fur=0.05), '#3a2418'

# ---------------- Slime ----------------
def slime():
    P = {'gel': ('#79d6a3', 0.18), 'top': ('#b9f0cf', 0.15), 'core': ('#ffb347', 0.3, 0.9), 'mouth': ('#2c5a46', 0.4), 'cheek': ('#ff9a8a', 0.3)}
    bones = [('root', None, (0, 0.0, 0)), ('body', 'root', (0, 0.12, 0)), ('top', 'body', (0, 0.3, 0))]
    E = lambda *a, **k: Ellipsoid(*a, **k); Cn = lambda *a, **k: Cone(*a, **k)
    sh = [E((0, 0.15, 0), (0.24, 0.17, 0.22), 'body', 'gel', k=0.0),
          E((0, 0.08, 0), (0.27, 0.08, 0.25), 'body', 'gel', k=0.08),
          Cn((0, 0.25, -0.01), (0.015, 0.39, -0.04), 0.1, 0.018, 'top', 'top', k=0.08)]
    def mouth(p, n):
        x, y, z = p[..., 0], p[..., 1], p[..., 2]
        curve = 0.17 - 0.012 + 3.5 * x ** 2
        smile = (np.abs(y - (0.165 - 6 * (0.03 ** 2 - x ** 2) * (np.abs(x) < 0.03))) < 0.004) * (np.abs(x) < 0.032)
        return smile * (z > 0.15)
    def cheeks(p, n):
        r = 0
        for x in (0.115, -0.115): r = np.maximum(r, 1 - np.hypot((p[..., 0] - x) / 0.03, (p[..., 1] - 0.19) / 0.018))
        return np.clip(r * 2, 0, 1) * 0.8 * (p[..., 2] > 0.1)
    def topshine(p, n): return np.clip((p[..., 1] - 0.22) / 0.1, 0, 1) * 0.8
    def core(p, n):  # a warm ember glowing through its back
        return np.clip(1 - np.hypot(p[..., 0] / 0.06, (p[..., 1] - 0.12) / 0.06), 0, 1) * (p[..., 2] < -0.05) * 1.5
    rules = [('top', topshine), ('cheek', cheeks), ('mouth', mouth), ('core', core)]
    eyes = [{'bone': 'body', 'from': (0.0, 0.22, 0.0), 'dir': (0.3 * x, 0.2, 1), 'r': (0.038, 0.05, 0.018), 'forward': 0.6} for x in (1, -1)]
    def sq(a): return (1 + a, 1 - a, 1 + a)
    def idle(t):
        w = t / 1.6 * TAU; return {'@scale:body': sq(0.04 * S(w)), 'top': (0.1 * S(w + 1), 0, 0.12 * S(w / 2)), '@scale:top': (1, 1, 1)}
    def walk(t):  # hop, hop
        ph = t / 0.7; h = max(0, S(ph * TAU)); sq_ = -0.12 * max(0, -S(ph * TAU))
        return {'@root': (0, 0.12 * h, 0), '@scale:body': sq(-0.08 * h + -sq_), 'top': (-0.3 * h, 0, 0), '@scale:top': (1, 1, 1)}
    def run(t):
        ph = t / 0.45; h = max(0, S(ph * TAU))
        return {'@root': (0, 0.16 * h, 0), '@scale:body': sq(-0.1 * h + 0.12 * max(0, -S(ph * TAU))), 'top': (-0.5, 0, 0), '@scale:top': (1, 1, 1)}
    def attack(t):
        c = ease(t / 0.35) * (1 - ease((t - 0.4) / 0.08)); j = bump(t, 0.4, 0.8)
        return {'@root': (0, 0.2 * j, 0.25 * j), '@scale:body': sq(0.2 * c - 0.12 * j), 'top': (0.4 * c - 0.6 * j, 0, 0), '@scale:top': (1, 1, 1)}
    def hit(t):
        k = bump(t, 0, 0.45); return {'@root': (0, 0, -0.06 * k), '@scale:body': sq(0.18 * k * S(t * 30)), 'top': (0.5 * k, 0, 0.4 * k), '@scale:top': (1, 1, 1)}
    def defeat(t):
        k = ease(t / 0.8); return {'@scale:body': (1 + 0.45 * k, 1 - 0.75 * k, 1 + 0.45 * k), 'top': (0.6 * k, 0, 0), '@scale:top': (1 - 0.5 * k,) * 3}
    def happy(t):
        h = bump(t, 0.15, 0.6) + bump(t, 0.6, 0.95) * 0.6
        return {'@root': (0, 0.14 * h, 0), '@scale:body': sq(-0.1 * h + 0.1 * bump(t, 0, 0.15)), 'top': (0, 0.5 * S(t * 12), 0), '@scale:top': (1, 1, 1)}
    anims = {'idle_loop': (1.6, idle), 'walk_loop': (0.7, walk), 'run_loop': (0.45, run), 'attack': (1.0, attack), 'hit': (0.45, hit), 'defeat': (1.4, defeat), 'happy': (1.0, happy)}
    return Creature('Slime', bones, sh, P, eyes, anims, cell=0.005, tris=6000, rules=rules, fur=0.0, glow='#ffb347'), '#2c5a46'

ALL = {'wolf': lambda: wolf(), 'hollow_wolf': lambda: wolf('hollow'), 'boar': boar, 'chicken': chicken, 'slime': slime}

if __name__ == '__main__':
    out = sys.argv[1]; names = sys.argv[2:] or list(ALL); os.makedirs(out, exist_ok=True)
    for n in names:
        cr, iris = ALL[n]()
        if n in ('wolf', 'hollow_wolf'): DEF_SINK[0] = 0.27
        if n == 'boar': DEF_SINK[0] = 0.15
        cr.build()
        tris, size = write_glb(cr, os.path.join(out, f'creature_{n}.glb'), eye_texture(iris, glow=bool(cr.eyes[0].get('glow'))))
        print(n, tris + 2 * 32 * 16 * 2, 'tris', f'{size / 1024:.0f} KB')
