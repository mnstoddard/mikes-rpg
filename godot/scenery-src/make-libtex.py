"""Small copies of the shared library textures for the gallery page.

Finds every library texture the scenery code uses (any quoted name that is a
folder in godot/assets/textures), shrinks each map to 256 px, and writes them
as data URLs to dist/libtex.json. The exported .glb files point at the real,
full-size textures instead.   Needs Python 3 with Pillow.
"""
import base64, io, json, os, re
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "..", "assets", "textures")
names = set()
for f in os.listdir(HERE):
    if f.endswith(".js"):
        for n in re.findall(r'"([a-z_]+)"', open(os.path.join(HERE, f)).read()):
            if os.path.isdir(os.path.join(TEX, n)):
                names.add(n)
out = {}
for n in sorted(names):
    out[n] = {}
    for kind in ("albedo", "normal", "orm", "emission"):
        p = os.path.join(TEX, n, f"{n}_{kind}.png")
        if not os.path.exists(p):
            continue
        im = Image.open(p)
        im = im.resize((256, 256), Image.LANCZOS)
        buf = io.BytesIO()
        if im.mode == "RGBA":
            im.save(buf, "PNG", optimize=True); mime = "png"
        else:
            im.convert("RGB").save(buf, "JPEG", quality=85); mime = "jpeg"
        out[n][kind] = f"data:image/{mime};base64," + base64.b64encode(buf.getvalue()).decode()
os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
json.dump(out, open(os.path.join(HERE, "dist", "libtex.json"), "w"))
print(len(out), "library textures:", ", ".join(sorted(out)))
