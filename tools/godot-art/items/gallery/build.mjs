// Builds the Items Gallery page: godot/assets/items/_gallery/index.html
// (it loads the .glb files from glb/<category>/<id>.glb and thumbnails from thumbs/<id>.png).
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../..");
const gal = join(root, "godot/assets/items/_gallery");
const js = (await build({ entryPoints: [join(here, "main.ts")], bundle: true, minify: true, format: "iife", write: false, target: "es2020", legalComments: "none", absWorkingDir: root })).outputFiles[0].text;
const catalog = JSON.parse(readFileSync(join(gal, "catalog.json"), "utf8"));
const html = readFileSync(join(here, "template.html"), "utf8")
  .replace("<!--CATALOG-->", () => `<script>window.CATALOG=${JSON.stringify(catalog)}</script>`)
  .replace("<!--APP-->", () => `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`);
writeFileSync(join(gal, "index.html"), html);
console.log(`index.html ${(html.length / 1024).toFixed(0)} KB, ${catalog.length} models`);
