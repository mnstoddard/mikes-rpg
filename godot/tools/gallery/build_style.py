import json, html, sys
g = json.load(open(sys.argv[1]))
def sw(name, hexv):
    return f'<div class="sw"><div class="chip" style="background:{hexv}"></div><div class="sl"><b>{html.escape(name.replace("_"," "))}</b><code>{hexv}</code></div></div>'
pal = "".join(f'<section class="grp"><h3>{k}</h3><div class="sws">'+"".join(sw(n,h) for n,h in v.items())+'</div></section>' for k,v in g["palette"].items())
L = g["lighting"]
tod = "".join(f'<div class="tod" style="background:linear-gradient({v["sky_top"]},{v["horizon"]})"><b>{k}</b><span>light {v.get("sun",v.get("moon"))} · {v["energy"]}</span></div>' for k,v in L["times_of_day"].items())
rough = "".join(f'<tr><td>{k.replace("_"," ")}</td><td class="n">{v}</td><td><div class="bar"><i style="width:{v*100}%"></i></div></td></tr>' for k,v in g["pbr"]["roughness"].items())
polys = "".join(f'<tr><td>{k.replace("_"," ")}</td><td>{html.escape(v)}</td></tr>' for k,v in g["poly_budgets"].items())
tex = g["textures"]
sizes = ", ".join(f"{k.replace('_',' ')} {v}px" for k,v in tex["sizes"].items())
special = "".join(f'<li><b>{k.replace("_"," ")}:</b> {html.escape(v)}</li>' for k,v in g["special_materials"].items())
dont = "".join(f'<li>{html.escape(d)}</li>' for d in g["dont"])
light_rows = "".join(f'<tr><td>{k}</td><td><code>{html.escape(json.dumps(v)[1:-1] if isinstance(v,dict) else str(v))}</code></td></tr>' for k,v in L.items() if k!="times_of_day")
out = f'''<title>Emberfall Art Style</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Nunito+Sans:wght@400;700&family=JetBrains+Mono:wght@400&display=swap">
<style>
/* Layout: a sunlit header band, then stacked reference sections; swatch grids wrap. */
:root {{ --bg:#F6FAF3; --panel:#FFFFFF; --fg:#22301F; --muted:#5D6B58; --line:#DCE6D5; --accent:#E8692A;
  --display:"Fraunces", Georgia, serif; --body:"Nunito Sans", system-ui, sans-serif; --mono:"JetBrains Mono", ui-monospace, monospace; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#141A13; --panel:#1C241B; --fg:#E7EFE2; --muted:#9FB098; --line:#2E3A2C; --accent:#FF8A4C; color-scheme:dark }} }}
:root[data-theme="dark"] {{ --bg:#141A13; --panel:#1C241B; --fg:#E7EFE2; --muted:#9FB098; --line:#2E3A2C; --accent:#FF8A4C; color-scheme:dark }}
body {{ background:var(--bg); color:var(--fg); font-family:var(--body); font-size:15px; line-height:1.55 }}
.wrap {{ max-width:1100px; margin:0 auto; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); padding-block:0 4rem }}
.hero {{ margin-top:calc(-1 * env(safe-area-inset-top,0px)); padding-top:calc(env(safe-area-inset-top,0px) + 3rem); padding-bottom:2.5rem;
  background:linear-gradient(180deg,#3F86DB 0%,#7DB6EA 45%,#BFE2F7 75%,#9BD35A 75.5%,#6DB33F 100%); color:#fff }}
.hero h1 {{ font-family:var(--display); font-weight:800; font-size:clamp(2rem,6vw,3.4rem); margin:0; text-shadow:0 2px 12px rgba(20,50,90,.35); text-wrap:balance }}
.hero p {{ max-width:60ch; font-size:1.05rem; margin:.6rem 0 4.5rem; text-shadow:0 1px 6px rgba(20,50,90,.4) }}
h2 {{ font-family:var(--display); font-weight:600; font-size:1.6rem; margin:2.6rem 0 .8rem }}
h3 {{ font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:0 0 .5rem }}
.grp {{ margin-bottom:1.4rem }}
.sws {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px }}
.sw {{ display:flex; gap:10px; align-items:center; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:8px; min-width:0 }}
.chip {{ width:38px; height:38px; border-radius:8px; flex:none; box-shadow:inset 0 0 0 1px rgba(0,0,0,.08) }}
.sl {{ display:flex; flex-direction:column; min-width:0; font-size:.85rem }} .sl b {{ text-transform:capitalize; font-weight:700 }}
code {{ font-family:var(--mono); font-size:.8rem; color:var(--muted); word-break:break-word }}
.tods {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px }}
.tod {{ border-radius:12px; padding:1rem; min-height:90px; color:#fff; display:flex; flex-direction:column; justify-content:flex-end; text-shadow:0 1px 4px rgba(0,0,0,.5) }}
.tod b {{ text-transform:capitalize; font-size:1.1rem }} .tod span {{ font-family:var(--mono); font-size:.75rem }}
.tbl {{ overflow-x:auto }} table {{ border-collapse:collapse; width:100%; font-size:.9rem }}
td {{ border-bottom:1px solid var(--line); padding:.45rem .5rem; vertical-align:top }} td:first-child {{ text-transform:capitalize; white-space:nowrap; font-weight:700 }}
.n {{ font-variant-numeric:tabular-nums }} .bar {{ height:8px; background:var(--line); border-radius:4px; min-width:120px }} .bar i {{ display:block; height:100%; background:var(--accent); border-radius:4px }}
.cols {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1.5rem }} .cols > * {{ min-width:0 }}
.note {{ background:var(--panel); border:1px solid var(--line); border-left:4px solid var(--accent); border-radius:8px; padding:1rem 1.2rem }}
ul {{ padding-left:1.2rem }} li {{ margin:.3rem 0 }}
</style>
<header class="hero"><div class="wrap"><h3 style="color:#fff;opacity:.9">Godot version · style guide v{g["version"]}</h3><h1>Emberfall Art Style</h1><p>{html.escape(g["look"])}</p></div></header>
<main class="wrap">
<h2>The rules in short</h2>
<div class="cols">
<div class="note"><b>Shape and shading.</b> {html.escape(g["shading"]["rule"])} {html.escape(g["shading"]["silhouette"])}</div>
<div class="note"><b>Materials.</b> {html.escape(g["pbr"]["workflow"])} {html.escape(g["pbr"]["albedo_range"])} Detail: {html.escape(g["pbr"]["detail_scale"])}</div>
<div class="note"><b>Scale.</b> 1 Godot unit = 1 metre, 1 game tile = {g["units"]["tile_m"]} m, player {g["units"]["player_height_m"]} m tall. {html.escape(g["units"]["origin"])} Export {html.escape(g["poly_budgets"]["export"])}.</div>
<div class="note"><b>Characters.</b> {html.escape(g["characters"])}</div>
</div>
<h2>Palette</h2>
{pal}
<h2>Light and time of day</h2>
<div class="tods">{tod}</div>
<div class="tbl" style="margin-top:1rem"><table>{light_rows}</table></div>
<h2>Material settings</h2>
<div class="cols"><div><h3>Roughness by surface</h3><div class="tbl"><table>{rough}</table></div><p>Normal strength {g["pbr"]["normal_strength"]}.</p></div>
<div><h3>Special materials</h3><ul>{special}</ul></div></div>
<h2>Textures and files</h2>
<div class="note"><p>{html.escape(tex["format"])} Sizes: {sizes}. Texel density {tex["texel_density_px_per_m"]} px per metre. {html.escape(tex["tiling"])}</p>
<p>Files: <code>{tex["naming"]}</code>, materials <code>{tex["materials_path"]}</code>. Shared copy: <code>{tex["shared_folder"]}</code>. Exact values as JSON: <code>/mnt/project-files/godot-art/style-guide.json</code> (repo: <code>godot/art/style-guide.json</code>).</p></div>
<h2>Polygon budgets</h2>
<div class="tbl"><table>{polys}</table></div>
<h2>Never</h2>
<ul>{dont}</ul>
</main>
'''
open(sys.argv[2],"w").write(out)
