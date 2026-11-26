// The login log: who logged into the game, when, from what kind of device, and when they left.
// Only the admin can see it (the same ADMIN_PASSWORD as the bug reports page).
//
//   /admin/logins              the login log page
//   /admin/api/logins?limit=N  the log as JSON, newest first (up to 5000 lines)
//
// The lines themselves are written by WorldRoom.ts (onAuth, onJoin and onLeave) and
// stored by storage.ts (a "logins" table in Postgres, or server/data/logins.json).
import express from "express";
import { readFileSync } from "node:fs";
import { store } from "./storage";
import { adminOnly } from "./reports";

export const loginsRouter = express.Router();

loginsRouter.get("/admin/api/logins", adminOnly, async (req, res) => {
  const limit = Math.min(5000, Math.max(1, Number(req.query.limit) || 2000));
  res.set("Cache-Control", "no-store").json(await store.listLogins({ limit }));
});

const PAGE = readFileSync(new URL("./admin-logins.html", import.meta.url), "utf8");
loginsRouter.get("/admin/logins", adminOnly, (_req, res) => {
  res.type("html").set("Cache-Control", "no-store").send(PAGE);
});
