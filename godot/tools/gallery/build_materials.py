import sys, json, os
from PIL import Image
tex_dir, guide, out = sys.argv[1:4]
man = json.load(open(os.path.join(tex_dir, "manifest.json")))
g = json.load(open(guide))
os.makedirs(f"{out}/tex", exist_ok=True); os.makedirs(f"{out}/thumbs", exist_ok=True)
for n, m in man.items():
    d = f"{tex_dir}/{n}/{n}"
    a = Image.open(f"{d}_albedo.png")
    if m["alpha"]:
        a.resize((512, 512), Image.LANCZOS).save(f"{out}/tex/{n}_albedo.png", optimize=True)
    else:
        a.convert("RGB").resize((512, 512), Image.LANCZOS).save(f"{out}/tex/{n}_albedo.jpg", quality=88)
    for k in ["normal", "orm", "emission"]:
        if os.path.exists(f"{d}_{k}.png"):
            Image.open(f"{d}_{k}.png").convert("RGB").resize((512, 512), Image.LANCZOS).save(f"{out}/tex/{n}_{k}.jpg", quality=90)
    t = a.convert("RGBA").resize((160, 160), Image.LANCZOS)
    bg = Image.new("RGBA", t.size, (90, 127, 168, 255)); bg.alpha_composite(t)
    bg.convert("RGB").save(f"{out}/thumbs/{n}.jpg", quality=85)
L = g["lighting"]
light = {"sun": L["sun"], "sky": L["sky"], "ambient": L["ambient"], "times_of_day": L["times_of_day"]}
html = open(os.path.join(os.path.dirname(__file__), "materials_template.html")).read()
html = html.replace("__MANIFEST__", json.dumps(man)).replace("__LIGHTING__", json.dumps(light))
open(f"{out}/index.html", "w").write(html)
print("ok", len(man))
