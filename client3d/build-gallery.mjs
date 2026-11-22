// Builds gallery pages, each into one HTML file that opens in any browser.
// three.js and the game code are bundled inside, so each file works on its own.
//
//   node build-gallery.mjs          -> dist/tree-gallery.html and dist/ore-gallery.html
//   node build-gallery.mjs tree     -> dist/tree-gallery.html  (src/gallery/trees.ts, the shared review gallery)
//   node build-gallery.mjs ore      -> dist/ore-gallery.html   (src/gallery/ores.ts, the shared review gallery)
//   node build-gallery.mjs <name>   -> dist/<name>-gallery.html (src/<name>-gallery/main.ts + gallery/<name>-template.html)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const AXE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 10 4 20"/><path d="M13 4c3 0 7 3 7 7l-3 1-5-5z"/></svg>';
const PICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 9.5 4 20"/><path d="M4 7c4-4 10-4 13 0"/><path d="M17 7c4 3 4 9 0 13"/></svg>';

// Galleries built on the shared review gallery (src/gallery/app.ts + gallery/template.html).
const SHARED = {
  tree: { entry: "src/gallery/trees.ts", title: "Tree Gallery", heading: "Trees for Elderra", icon: AXE },
  ore: { entry: "src/gallery/ores.ts", title: "Ore Gallery", heading: "Ores for Elderra", icon: PICK },
};

async function bundle(entry) {
  const out = await build({ entryPoints: [entry], bundle: true, format: "iife", minify: true, target: "es2020", write: false, legalComments: "none" });
  return out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
}

mkdirSync("dist", { recursive: true });
const name = process.argv[2];
const names = name ? [name] : Object.keys(SHARED);
for (const n of names) {
  const outFile = `dist/${n}-gallery.html`;
  let html;
  if (SHARED[n]) {
    const g = SHARED[n];
    const js = await bundle(g.entry);
    html = readFileSync("gallery/template.html", "utf8")
      .replaceAll("{{TITLE}}", g.title)
      .replaceAll("{{HEADING}}", g.heading)
      .replaceAll("{{ICON}}", g.icon)
      .replace("<!--APP-->", () => `<script>${js}</script>`);
  } else {
    const js = await bundle(`src/${n}-gallery/main.ts`);
    html = readFileSync(`gallery/${n}-template.html`, "utf8").replace("<!--APP-->", () => `<script>${js}</script>`);
  }
  writeFileSync(outFile, html);
  console.log(`${outFile}: ${(html.length / 1024).toFixed(0)} KB`);
}
