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
/**
 * Packs glTF JSON (with data: URIs) into a .glb. Textures named "lib:<name>:<kind>"
 * become links to the shared library file (../../textures/<name>/<name>_<kind>.png,
 * the same folder res://assets/textures uses in Godot), so all models share them.
 * Other images (leaf cards, flower cards) stay inside the .glb.
 */
function packGlb(gltf) {
  const fromData = (uri) => Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");
  let bin = fromData(gltf.buffers[0].uri);
  const libImage = new Map();
  for (const t of gltf.textures ?? []) {
    const m = /^lib:([a-z_]+):([a-z]+)$/.exec(t.name ?? "");
    if (m) libImage.set(t.source, `../../textures/${m[1]}/${m[1]}_${m[2]}.png`);
  }
  for (const [i, img] of (gltf.images ?? []).entries()) {
    if (libImage.has(i)) { img.uri = libImage.get(i); delete img.mimeType; continue; }
    if (!img.uri?.startsWith("data:")) continue;
    const bytes = fromData(img.uri);
    const pad = (4 - (bin.length % 4)) % 4;
    bin = Buffer.concat([bin, Buffer.alloc(pad)]);
    gltf.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: bytes.length });
    img.bufferView = gltf.bufferViews.length - 1;
    img.mimeType = img.uri.slice(5, img.uri.indexOf(";"));
    delete img.uri;
    bin = Buffer.concat([bin, bytes]);
  }
  bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  gltf.buffers = [{ byteLength: bin.length }];
  let js = Buffer.from(JSON.stringify(gltf));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const catalog = [];
let total = 0;
for (const it of items) {
  const dir = `../assets/scenery/${slug(it.group)}`;
  mkdirSync(dir, { recursive: true });
  for (let v = 0; v < it.variants.length; v++) {
    const file = it.variants.length > 1 ? `${it.id}_${slug(it.variants[v])}.glb` : `${it.id}.glb`;
    const { json, tris } = await page.evaluate(([id, v]) => window.exportOne(id, v), [it.id, v]);
    const buf = packGlb(JSON.parse(json));
    writeFileSync(`${dir}/${file}`, buf);
    total += buf.length;
    catalog.push({ id: it.id, name: it.name, variant: it.variants[v], group: it.group, file: `${slug(it.group)}/${file}`, triangles: tris, kb: Math.round(buf.length / 1024) });
  }
}
writeFileSync("../assets/scenery/catalog.json", JSON.stringify(catalog, null, 1));
console.log(`${catalog.length} files, ${(total / 1048576).toFixed(1)} MB`);
await browser.close();
