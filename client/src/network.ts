import { Client, Room } from "colyseus.js";

// In dev (Vite on :5173) the game server runs on :2567. In production the
// server also serves the built client, so it's the same host and port.
function serverUrl(): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const host = import.meta.env.DEV ? `${location.hostname}:2567` : location.host;
  return `${proto}://${host}`;
}

export interface LoginDetails { username: string; password: string; create: boolean }

let client: Client | null = null;
const getClient = () => (client ??= new Client(serverUrl()));

/** Logs in (or creates an account) and joins the world. Rejects with the server's reason. */
export async function joinWorld(login: LoginDetails): Promise<Room> {
  return getClient().joinOrCreate("world", login);
}

/** After the connection drops (e.g. the phone switched apps), pick up the same character again. */
export async function rejoinWorld(reconnectionToken: string): Promise<Room> {
  return getClient().reconnect(reconnectionToken);
}
