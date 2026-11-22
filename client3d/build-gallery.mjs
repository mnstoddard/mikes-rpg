// Builds the review galleries, each into one HTML file in dist/:
//   dist/tree-gallery.html  and  dist/ore-gallery.html
// Run with:  npm run gallery
// three.js and the game code are bundled inside, so each file works on its own.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const AXE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 10 4 20"/><path d="M13 4c3 0 7 3 7 7l-3 1-5-5z"/></svg>';
const PICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 9.5 4 20"/><path d="M4 7c4-4 10-4 13 0"/><path d="M17 7c4 3 4 9 0 13"/></svg>';

const GALLERIES = [
  { entry: "src/gallery/trees.ts", out: "tree-gallery.html", title: "Tree Gallery", heading: "Trees for Elderra", icon: AXE },
  { entry: "src/gallery/ores.ts", out: "ore-gallery.html", title: "Ore Gallery", heading: "Ores for Elderra", icon: PICK },
];

const template = readFileSync("gallery/template.html", "utf8");
mkdirSync("dist", { recursive: true });
for (const g of GALLERIES) {
  const out = await build({ entryPoints: [g.entry], bundle: true, format: "iife", minify: true, target: "es2020", write: false, legalComments: "none" });
  const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  const html = template
    .replaceAll("{{TITLE}}", g.title)
    .replaceAll("{{HEADING}}", g.heading)
    .replaceAll("{{ICON}}", g.icon)
    .replace("<!--APP-->", () => `<script>${js}</script>`);
  writeFileSync(`dist/${g.out}`, html);
  console.log(`dist/${g.out}: ${(html.length / 1024).toFixed(0)} KB`);
}
