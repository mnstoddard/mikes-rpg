// Builds the Tree Gallery into one HTML file: dist/tree-gallery.html.
// Run with:  npm run gallery
// three.js and the tree code are bundled inside, so the file works on its own.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const out = await build({
  entryPoints: ["src/gallery/main.ts"],
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  write: false,
  legalComments: "none",
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = readFileSync("gallery/template.html", "utf8").replace("<!--APP-->", () => `<script>${js}</script>`);
mkdirSync("dist", { recursive: true });
writeFileSync("dist/tree-gallery.html", html);
console.log(`dist/tree-gallery.html: ${(html.length / 1024).toFixed(0)} KB`);
