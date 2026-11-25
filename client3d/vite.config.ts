// The 3D game's dev server and build (npm run dev:3d / npm run build -w client3d).
// The page is the 2D game's client/index.html (login box, bag, skills, quests,
// shops...) with the 3D extras added, so the panels never drift apart.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

function page3d(): Plugin {
  return {
    name: "page-3d",
    transformIndexHtml: {
      order: "pre",
      handler() {
        let html = readFileSync(resolve(__dirname, "../client/index.html"), "utf8");
        const css = readFileSync(resolve(__dirname, "src/game/game.css"), "utf8");
        html = html.replace(/<title>.*?<\/title>/, "<title>Emberfall</title>");
        html = html.replace("</head>", `<style>\n${css}\n</style>\n</head>`);
        html = html.replace('<div id="game"></div>', '<div id="game"></div>\n  <div id="loading3d"><div>Building the world…</div></div>\n  <div id="flash3d"></div>');
        html = html.replace('<button id="map-btn"', '<button id="rotate3d" class="panel btn" aria-label="Turn the camera" title="Turn the camera (or drag with the right mouse button, one finger, or press Q / E). Walk with W A S D, or click where to go.">⟳</button><button id="run3d" class="panel btn" aria-label="Run" title="Run (or hold Shift): faster, but it tires you out. Your breath comes back a few seconds after you stop.">🏃</button><button id="map-btn"');
        html = html.replace('<div class="set-section"><button id="sign-out"', '<div class="set-section"><div class="set-label">Your character</div><button id="look-btn" class="shop-btn" style="width:100%">🧑 Change my look</button></div>\n    <div class="set-section"><button id="sign-out"');
        html = html.replace('<div class="set-label">🔊 Read aloud</div>', '<div class="set-label">🔔 Sound effects</div>\n      <label class="set-check"><input id="set-sfx" type="checkbox" checked /> Play sound effects (chopping, mining, cooking, fighting, footsteps and level ups)</label>\n      <div class="set-row"><span>Volume</span><input id="set-sfx-vol" type="range" min="0" max="1" step="0.05" value="0.8" aria-label="Sound effects volume" style="flex:1" /></div>\n    </div>\n    <div class="set-section">\n      <div class="set-label">🔊 Read aloud</div>');
        html = html.replace('src="/src/main.ts"', 'src="/src/game/main.ts"');
        return html;
      },
    },
  };
}

export default defineConfig({
  plugins: [page3d()],
  server: { port: 5174, fs: { allow: [".."] } },
  build: { outDir: "dist-game", chunkSizeWarningLimit: 4000 },
});
