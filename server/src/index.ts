import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WorldRoom } from "./WorldRoom";

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

gameServer.listen(PORT).then(() => {
  console.log(`Game server listening on http://localhost:${PORT}`);
});
