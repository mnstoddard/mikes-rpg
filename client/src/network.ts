import { Client, Room } from "colyseus.js";

// In dev (Vite on :5173) the game server runs on :2567. In production the
// server also serves the built client, so it's the same host and port.
function serverUrl(): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const host = import.meta.env.DEV ? `${location.hostname}:2567` : location.host;
  return `${proto}://${host}`;
}

export interface LoginDetails { username: string; password: string; create: boolean }

/** Logs in (or creates an account) and joins the world. Rejects with the server's reason. */
export async function joinWorld(login: LoginDetails): Promise<Room> {
  const client = new Client(serverUrl());
  return client.joinOrCreate("world", login);
}
