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
        html = html.replace(/<title>.*?<\/title>/, "<title>Mike's RPG 3D</title>");
        html = html.replace("</head>", `<style>\n${css}\n</style>\n</head>`);
        html = html.replace('<div id="game"></div>', '<div id="game"></div>\n  <div id="loading3d"><div>Building the world…</div></div>\n  <div id="flash3d"></div>');
        html = html.replace('<button id="map-btn"', '<button id="rotate3d" class="panel btn" aria-label="Turn the camera" title="Turn the camera (or drag with the right mouse button, one finger, or press Q / E). Walk with W A S D, or click where to go.">⟳</button><button id="map-btn"');
        html = html.replace('<div class="set-section"><button id="sign-out"', '<div class="set-section"><div class="set-label">Your character</div><button id="look-btn" class="shop-btn" style="width:100%">🧑 Change my look</button></div>\n    <div class="set-section"><button id="sign-out"');
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
