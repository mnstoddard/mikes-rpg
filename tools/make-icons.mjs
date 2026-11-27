// Draws every item's picture from its 3D model (version 0.21): runs
// client3d/src/icon-maker/main.ts in a headless browser and saves the sheet
// (client3d/public/icons/items.png) and its index (client/src/itemIconIndex.ts).
//   node tools/make-icons.mjs
import { build } from "../client3d/node_modules/esbuild/lib/main.js";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const out = await build({ entryPoints: ["client3d/src/icon-maker/main.ts"], bundle: true, format: "iife", write: false, logLevel: "error" });
const js = out.outputFiles[0].text;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") console.error("page:", m.text()); });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.setContent("<!doctype html><html><body></body></html>");
await page.addScriptTag({ content: js });
await page.waitForFunction(() => window.__icons, null, { timeout: 600_000 });
const res = await page.evaluate(() => window.__icons);
await browser.close();
writeFileSync("client3d/public/icons/items.png", Buffer.from(res.png.split(",")[1], "base64"));
const keys = Object.keys(res.index);
writeFileSync("client/src/itemIconIndex.ts", `// Made by tools/make-icons.mjs: where each item picture is in client3d/public/icons/items.png.
export const ICON_SHEET = { cols: ${res.cols}, cell: ${res.cell} };
export const ICON_INDEX: Record<string, number> = ${JSON.stringify(res.index)};
`);
console.log(`${keys.length} pictures, ${res.cols} x ${res.cols} sheet.`);
if (res.failed.length) console.log("Failed:\n" + res.failed.join("\n"));
