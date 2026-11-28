// Builds the gallery into one HTML file (three.js bundled inside).
//   node build.mjs            -> dist/scenery-gallery.html (needs Python 3 with Pillow for the texture copies)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

// small copies of the shared library textures (see make-libtex.py)
execSync("python3 make-libtex.py", { stdio: "inherit" });
const libtex = readFileSync("dist/libtex.json", "utf8");

const out = await build({ entryPoints: ["gallery.js"], bundle: true, format: "iife", minify: true, target: "es2020", write: false, legalComments: "none" });
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
mkdirSync("dist", { recursive: true });
const html = readFileSync("gallery.html", "utf8").replace("<!--APP-->", () => `<script>globalThis.EMBERFALL_LIBTEX=${libtex};</script><script>${js}</script>`);
writeFileSync("dist/scenery-gallery.html", html);
console.log(`dist/scenery-gallery.html: ${(html.length / 1024).toFixed(0)} KB`);
