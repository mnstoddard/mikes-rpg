// Builds every item: Godot-ready .glb files and gallery thumbnails.
//   node tools/godot-art/items/build.mjs [id ...]
// .glb files go to godot/assets/items/<category>/<id>.glb, thumbnails and
// catalog.json to godot/assets/items/_gallery/ (Godot ignores that folder).
import { build } from "esbuild";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const out = join(root, "godot/assets/items");
const gal = join(out, "_gallery");
mkdirSync(join(gal, "thumbs"), { recursive: true });
writeFileSync(join(gal, ".gdignore"), "");

const js = (await build({ entryPoints: [join(here, "exporter.ts")], bundle: true, format: "iife", write: false, target: "es2020", absWorkingDir: root })).outputFiles[0].text;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("browser:", m.text()); });
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.setContent(`<html><body style="margin:0"><script>${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`);
await page.waitForFunction(() => window.ready);
const list = await page.evaluate(() => window.listItems());
const only = process.argv.slice(2);
const catFile = join(gal, "catalog.json");
const prev = existsSync(catFile) ? JSON.parse(readFileSync(catFile, "utf8")) : [];
const byId = new Map(prev.map((e) => [e.id, e]));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
for (const item of list) {
  if (only.length && !only.includes(item.id)) continue;
  const r = await page.evaluate((id) => window.exportItem(id), item.id);
  const rel = `${slug(item.cat)}/${item.id}.glb`;
  mkdirSync(join(out, slug(item.cat)), { recursive: true });
  const glb = Buffer.from(r.glb, "base64");
  writeFileSync(join(out, rel), glb);
  writeFileSync(join(gal, "thumbs", `${item.id}.png`), Buffer.from(r.png.split(",")[1], "base64"));
  byId.set(item.id, { ...item, file: rel, bytes: glb.length, tris: r.tris, materials: r.materials, size: r.size });
  console.log(`${rel.padEnd(36)} ${String(r.tris).padStart(6)} tris  ${(glb.length / 1024).toFixed(0).padStart(5)} KB  ${r.size.join(" x ")} m`);
}
const order = list.map((i) => i.id);
const catalog = [...byId.values()].filter((e) => order.includes(e.id)).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
writeFileSync(catFile, JSON.stringify(catalog, null, 1));
await browser.close();
