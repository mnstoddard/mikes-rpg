// Builds a gallery page into one HTML file that opens in any browser.
// three.js and the game code are bundled inside, so the file works on its own.
//
//   node build-gallery.mjs          -> dist/tree-gallery.html   (src/gallery/main.ts + gallery/template.html)
//   node build-gallery.mjs armor    -> dist/armor-gallery.html  (src/armor-gallery/main.ts + gallery/armor-template.html)
//   node build-gallery.mjs <name>   -> dist/<name>-gallery.html (src/<name>-gallery/main.ts + gallery/<name>-template.html)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const name = process.argv[2];
const entry = name ? `src/${name}-gallery/main.ts` : "src/gallery/main.ts";
const template = name ? `gallery/${name}-template.html` : "gallery/template.html";
const outFile = `dist/${name ?? "tree"}-gallery.html`;

const out = await build({
  entryPoints: [entry],
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  write: false,
  legalComments: "none",
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = readFileSync(template, "utf8").replace("<!--APP-->", () => `<script>${js}</script>`);
mkdirSync("dist", { recursive: true });
writeFileSync(outFile, html);
console.log(`${outFile}: ${(html.length / 1024).toFixed(0)} KB`);
