import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WorldRoom } from "./WorldRoom";
import { SERVER_NAME, store, storageName } from "./storage";
import { reportsRouter } from "./reports";
import { loginsRouter } from "./logins";
import { crashesRouter, installCrashCapture, noteServerStart } from "./crashes";
import { attachJsonGateway } from "./jsonGateway";

// 💥 Errors nobody caught are written down (see /admin/crashes) instead of stopping the server.
installCrashCapture();

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.set("trust proxy", 1); // Render sits in front: use the player's real address (for the report rate limit)
// Bug reports from inside the game, and the password-protected page to review them.
app.use(reportsRouter);
// The login log (who logged in, and when), for the admin only.
app.use(loginsRouter);
// Automatic crash reports (from players' games and from the server), for the admin only.
app.use(crashesRouter);
// When the client has been built (npm run build), serve it from the same port.
// Which game to show: the 3D game (client3d) is the main game. The older 2D
// game is still built and can be shown instead by setting CLIENT=2d.
const want3d = process.env.CLIENT !== "2d";
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), want3d ? "../../client3d/dist-game" : "../../client/dist");
app.use(express.static(clientDist));
app.get("/health", (_req, res) => { res.send("ok"); });

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});
// 🎮 The JSON door at /json, for the Godot app (server/src/jsonGateway.ts). Browsers are unaffected.
attachJsonGateway(httpServer, PORT);
gameServer.define("world", WorldRoom);
// On shutdown (e.g. Render redeploying), players are saved as they're disconnected,
// then the database connection is closed.
gameServer.onShutdown(() => store.close());

async function start() {
  // Set up the accounts table. Retry a few times in case the database is waking up.
  for (let attempt = 1; ; attempt++) {
    try {
      await store.init();
      break;
    } catch (err: any) {
      console.error(`Couldn't open storage (attempt ${attempt}):`, err.message);
      if (attempt >= 5) process.exit(1);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.log(`Saving accounts to ${storageName} (this is the ${SERVER_NAME} server${SERVER_NAME !== "live" && SERVER_NAME !== "local" ? ": characters and farms are kept apart from live" : ""})`);
  await noteServerStart();
  if (process.env.RENDER && !process.env.DATABASE_URL) {
    console.warn("WARNING: DATABASE_URL isn't set, so accounts and saves will be lost on every redeploy or restart.");
  }
  await gameServer.listen(PORT);
  console.log(`Game server listening on http://localhost:${PORT} (serving the ${want3d ? "3D" : "2D"} game)`);
}
start();
