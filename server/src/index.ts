import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WorldRoom } from "./WorldRoom";
import { store, storageName } from "./storage";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
// When the client has been built (npm run build), serve it from the same port.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
app.use(express.static(clientDist));
app.get("/health", (_req, res) => { res.send("ok"); });

const gameServer = new Server({
  transport: new WebSocketTransport({ server: createServer(app) }),
});
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
  console.log(`Saving accounts to ${storageName}`);
  if (process.env.RENDER && !process.env.DATABASE_URL) {
    console.warn("WARNING: DATABASE_URL isn't set, so accounts and saves will be lost on every redeploy or restart.");
  }
  await gameServer.listen(PORT);
  console.log(`Game server listening on http://localhost:${PORT}`);
}
start();
