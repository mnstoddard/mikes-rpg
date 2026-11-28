import json
TOWN = ['idle', 'walk', 'run', 'talk', 'wave', 'bow', 'look', 'sit', 'drink', 'eat', 'pickup', 'hit', 'fall', 'defeat']
FOE = ['idle', 'walk', 'run', 'sneak', 'jump', 'sword', 'slash', 'rising', 'thrust', 'block', 'dagger', 'spear', 'mace', 'greatsword', 'shield', 'spell', 'staff', 'archery', 'throw', 'hit', 'fall', 'defeat', 'talk', 'look']
def pc(name, kind, tex, tint=None, **k):
    d = {'name': name, 'kind': kind, 'tex': tex, 'color': '#ffffff'}
    if tint: d['tint'] = tint
    d.update(k); return d
LIN, RED, BLUE, GREEN, LEA, BUR = 'linen', 'wool_red', 'wool_blue', 'wool_green', 'leather', 'burlap'
DARK = '#7a6a60'; ASH = '#8f8a84'
def boots(h=0.28, tint=DARK): return pc('Boots', 'boots', LEA, tint, rough=0.65, height=h)
def trousers(tex=LEA, tint=DARK, **k): return pc('Trousers', 'trousers', tex, tint, **k)
def shirt(tex, tint=None, sleeve='long', name='Shirt', **k): return pc(name, 'shirt', tex, tint, sleeve=sleeve, **k)
def vest(tex=LEA, tint=None, name='Vest'): return pc(name, 'shirt', tex, tint, sleeve='none', push=0.016, neck=0.08)
def robe(tex, tint=None): return [shirt(tex, tint, name='Robe'), pc('RobeSkirt', 'skirt', tex, tint, flare=0.6, hemUp=0.04, double=True)]
def belt(tex=LEA, tint=DARK): return pc('Belt', 'belt', tex, tint)
def apron(tex=LEA, tint=None, **k): return pc('Apron', 'apron', tex, tint, **k)
def cape(tex, tint=None, **k): return pc('Cape', 'cape', tex, tint, double=True, **k)
def hood(tex, tint=None): return pc('Hood', 'hood', tex, tint)
def gloves(tex=LEA, tint=None): return pc('Gloves', 'gloves', tex, tint)
P = []
def add(file, name, who, cfg, outfit, motions, **k):
    P.append(dict(name=name, file=file, who=who, cfg=cfg, outfit=outfit, motions=motions, dropCovered=True, **k))
KEEPER = robe(LIN, '#f2ead8') + [pc('Sash', 'shirt', RED, None, sleeve='none', push=0.02, neck=0.12), belt(RED, None), boots(0.14)]
# ---- foes ----
add('foe_goblin', 'Goblin', 'man', {'hair': 'bald', 'elf': 1, 'ears': 1, 'nose': 0.8, 'eyeSize': 1, 'muscle': -0.3, 'weight': 0.3, 'belly': 0.6, 'jaw': -0.4, 'eye': 7},
    [shirt(BUR, None, 'short', name='Tunic'), trousers(LEA, None, length='knee'), belt()], FOE, skinColor='#7fae4e', scale=0.68)
add('foe_ashbound_scout', 'Ashbound_Scout', 'man', {'skin': 3, 'eye': 4, 'hair': 'short', 'beard': 'stubble', 'muscle': 0.2},
    [shirt(LEA, '#8a7c6a'), trousers(BUR, '#7a7068'), boots(), belt(), gloves(LEA, ASH), hood(BUR, '#6a6258'), cape(BUR, '#6a6258', hemUp=0.45)], FOE, hideHair=True)
add('foe_ashbound_raider', 'Ashbound_Raider', 'man', {'skin': 5, 'eye': 5, 'hair': 'messy', 'beard': 'full', 'hairCol': 1, 'muscle': 1, 'weight': 0.5, 'shoulders': 0.8, 'height': 0.5},
    [shirt(BUR, '#5e5a52'), pc('Breastplate', 'shirt', 'metal_rusty_iron', None, sleeve='none', push=0.022, neck=0.06, rough=0.5), trousers(LEA, '#5a5048'), boots(0.32, '#5a5048'), belt(), gloves(LEA, ASH), cape(BUR, '#4a4640', hemUp=0.3)], FOE)
add('foe_grave_ghoul', 'Grave_Ghoul', 'man', {'hair': 'messy', 'hairCol': 7, 'eye': 7, 'muscle': -1, 'weight': -1, 'cheeks': 1, 'eyeSize': 0.6, 'jaw': 0.5, 'height': -0.2},
    [shirt(BUR, '#8a8478', sleeve='elbow', name='Rags'), trousers(BUR, '#6a6458', length='knee')], FOE, skinColor='#a8b4a0')
add('boss_sable', 'Sable', 'woman', {'skin': 3, 'hair': 'ponytail', 'hairCol': 0, 'eye': 5, 'muscle': 0.6, 'jaw': 0.3, 'height': 0.4, 'browThick': 0.5},
    [shirt(LEA, '#4a4450'), trousers(LEA, '#3a3440'), boots(0.32, '#3a3440'), belt(), gloves(LEA, '#9a9690'), cape(BLUE, '#3a3446', hemUp=0.2)], FOE)
add('boss_vale', 'Vale', 'man', {'skin': 0, 'hair': 'long', 'hairCol': 6, 'beard': 'full', 'eye': 7, 'height': 0.2, 'weight': -0.2, 'cheeks': 0.4},
    robe(LIN, '#f6edd2') + [pc('Mantle', 'shirt', 'metal_gold', None, sleeve='none', push=0.022, neck=0.06, hem='chest'), belt('metal_gold', None), cape(RED, '#c99a3a', hemUp=0.06), boots(0.14)], FOE)
# ---- townsfolk ----
add('npc_aldric', 'High_Keeper_Aldric', 'man', {'skin': 0, 'hair': 'long', 'hairCol': 6, 'beard': 'full', 'eye': 7, 'height': 0.2, 'weight': -0.2, 'cheeks': 0.4},
    robe(LIN, '#f6edd2') + [pc('Sash', 'shirt', RED, None, sleeve='none', push=0.02, neck=0.12), belt('metal_gold', None), boots(0.14)], TOWN + ['spell', 'staff'])
add('npc_bryn', 'Captain_Bryn', 'man', {'skin': 4, 'hair': 'short', 'hairCol': 1, 'beard': 'goatee', 'eye': 2, 'muscle': 0.8, 'shoulders': 0.5, 'height': 0.4},
    [shirt(BLUE), pc('Breastplate', 'shirt', 'metal_steel', None, sleeve='none', push=0.022, neck=0.06, rough=0.4), trousers(LEA, DARK), boots(0.34), belt(), cape(BLUE, None, hemUp=0.3)], TOWN + ['sword', 'block'])
add('npc_celene', 'Keeper_Celene', 'woman', {'skin': 1, 'hair': 'long', 'hairCol': 5, 'eye': 0, 'faceWidth': -0.3}, KEEPER, TOWN + ['spell'])
add('npc_corwen', 'Enchanter_Corwen', 'man', {'skin': 2, 'hair': 'messy', 'hairCol': 8, 'beard': 'goatee', 'eye': 6, 'muscle': -0.5, 'weight': -0.3},
    robe(BLUE, '#8a78c8') + [belt('metal_silver', None), boots(0.14)], TOWN + ['enchant', 'spell'])
add('npc_greta', 'Miner_Greta', 'woman', {'skin': 3, 'hair': 'bun', 'hairCol': 4, 'eye': 2, 'muscle': 0.7, 'weight': 0.3, 'shoulders': 0.5},
    [shirt(RED, sleeve='elbow'), trousers(BUR, '#8a7a68'), boots(0.3), apron(LEA, None, push=0.024)], TOWN + ['mine'])
add('npc_holt', 'Forester_Holt', 'man', {'skin': 2, 'hair': 'short', 'hairCol': 3, 'beard': 'full', 'eye': 1, 'muscle': 0.6, 'height': 0.3},
    [shirt(GREEN), vest(LEA), trousers(LEA, DARK), boots(0.32), belt(), cape(GREEN, '#6a8a5a', hemUp=0.4)], TOWN + ['chop'])
add('npc_kael', 'Huntmaster_Kael', 'man', {'skin': 5, 'hair': 'mohawk', 'hairCol': 0, 'beard': 'stubble', 'eye': 3, 'muscle': 1, 'shoulders': 0.6, 'jaw': 0.5},
    [shirt(GREEN, '#7a9a6a'), vest(LEA, None, name='Jerkin'), trousers(LEA, DARK), boots(0.34), belt(), gloves(LEA, DARK)], TOWN + ['sword', 'slash', 'archery', 'block'])
add('npc_lisette', 'Keeper_Lisette', 'woman', {'skin': 2, 'hair': 'bob', 'hairCol': 6, 'eye': 4, 'weight': 0.2, 'height': -0.4}, KEEPER, TOWN)
add('npc_moss', 'Alchemist_Moss', 'man', {'skin': 1, 'hair': 'messy', 'hairCol': 3, 'beard': 'mustache', 'eye': 1, 'weight': -0.3},
    [shirt(LIN), vest(GREEN, '#6a8a5a', name='Waistcoat'), trousers(BUR), boots(0.2), apron(LIN, '#d8d0bc', push=0.022)], TOWN + ['alchemy'])
add('npc_odo', 'Farmer_Odo', 'man', {'skin': 3, 'hair': 'short', 'hairCol': 2, 'beard': 'stubble', 'eye': 2, 'weight': 0.7, 'belly': 1, 'height': -0.2},
    [shirt(LIN, sleeve='elbow'), trousers(BUR, None), boots(0.26), belt()], TOWN + ['plant', 'harvest', 'dig'])
add('npc_oren', 'Keeper_Oren', 'man', {'skin': 1, 'hair': 'bald', 'beard': 'full', 'hairCol': 7, 'eye': 0, 'weight': 0.4, 'belly': 0.5}, KEEPER, TOWN)
add('npc_rhys', 'Rhys', 'man', {'skin': 2, 'hair': 'messy', 'hairCol': 5, 'eye': 1, 'height': 0.1, 'muscle': 0.3},
    [shirt(BLUE, name='Tunic'), trousers(LEA, DARK), belt(), boots(0.3)], TOWN + FOE[:12])
add('npc_rook', 'Woodworker_Rook', 'man', {'skin': 4, 'hair': 'short', 'hairCol': 0, 'beard': 'full', 'eye': 2, 'muscle': 0.4},
    [shirt(LIN, sleeve='elbow'), trousers(LEA, DARK), boots(0.28), apron(LEA, None, push=0.024)], TOWN + ['saw'])
add('npc_rowan', 'Archmage_Rowan', 'woman', {'skin': 4, 'hair': 'long', 'hairCol': 7, 'eye': 6, 'height': 0.3},
    robe(BLUE, '#6a50a0') + [belt('metal_gold', None), cape(BLUE, '#4a3a7a', hemUp=0.04), boots(0.14)], TOWN + ['spell', 'staff', 'enchant'])
add('npc_tam', 'Shopkeeper_Tam', 'woman', {'skin': 2, 'hair': 'bob', 'hairCol': 2, 'eye': 2, 'weight': 0.4},
    [shirt(LIN), pc('Skirt', 'skirt', BUR, None, flare=0.7, double=True), apron(LIN, '#d8d0bc', push=0.02, lo=0.75), boots(0.14)], TOWN)
add('npc_tamsin', 'Tamsin', 'woman', {'skin': 4, 'hair': 'pigtails', 'hairCol': 3, 'eye': 3, 'height': -0.7, 'muscle': 0.2},
    [shirt(LEA, '#8a7c6a'), trousers(BUR, '#7a7068'), boots(0.3), belt(), cape(BUR, '#6a6258', hemUp=0.45)], TOWN + FOE[:12])
add('npc_tomas', 'Keeper_Tomas', 'man', {'skin': 0, 'hair': 'short', 'hairCol': 7, 'beard': 'mustache', 'eye': 4, 'height': -0.3, 'weight': -0.4}, KEEPER, TOWN)
add('npc_wren', 'Herbalist_Wren', 'woman', {'skin': 1, 'hair': 'long', 'hairCol': 3, 'eye': 1, 'weight': -0.2},
    [shirt(GREEN), pc('Skirt', 'skirt', BUR, None, flare=0.7, double=True), belt(), boots(0.2), cape(GREEN, '#5a7a4a', hemUp=0.35)], TOWN + ['harvest', 'pickup'])
add('npc_wynne', 'Keeper_Wynne', 'woman', {'skin': 5, 'hair': 'bun', 'hairCol': 0, 'eye': 2, 'weight': 0.5, 'belly': 0.3}, KEEPER + [apron(LIN, None, push=0.024)], TOWN)
json.dump(P, open('people2.json', 'w'), indent=1)
print(len(P))
