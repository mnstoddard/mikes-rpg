// Exports every scenery object (and every variant) as a .glb for Godot.
//   node export.mjs     -> ../assets/scenery/<group>/<id>[_<variant>].glb and ../assets/scenery/catalog.json
// Uses the browser that Playwright installs, because the textures are painted on a canvas.
import { build } from "esbuild";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { writeFileSync, mkdirSync } from "node:fs";

const out = await build({ entryPoints: ["export-entry.js"], bundle: true, format: "iife", write: false, target: "es2020" });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error(e));
await page.setContent("<html><body></body></html>");
await page.addScriptTag({ content: out.outputFiles[0].text });
const items = await page.evaluate(() => window.listAll());
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const catalog = [];
let total = 0;
for (const it of items) {
  const dir = `../assets/scenery/${slug(it.group)}`;
  mkdirSync(dir, { recursive: true });
  for (let v = 0; v < it.variants.length; v++) {
    const file = it.variants.length > 1 ? `${it.id}_${slug(it.variants[v])}.glb` : `${it.id}.glb`;
    const { b64, tris } = await page.evaluate(([id, v]) => window.exportOne(id, v), [it.id, v]);
    const buf = Buffer.from(b64, "base64");
    writeFileSync(`${dir}/${file}`, buf);
    total += buf.length;
    catalog.push({ id: it.id, name: it.name, variant: it.variants[v], group: it.group, file: `${slug(it.group)}/${file}`, triangles: tris, kb: Math.round(buf.length / 1024) });
  }
}
writeFileSync("../assets/scenery/catalog.json", JSON.stringify(catalog, null, 1));
console.log(`${catalog.length} files, ${(total / 1048576).toFixed(1)} MB`);
await browser.close();
