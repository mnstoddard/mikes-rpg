// Accounts and saved games.
//
// With DATABASE_URL set (e.g. a Neon Postgres connection string on Render),
// everything is stored in Postgres. Without it (running on your own computer),
// accounts and saves go into server/data/accounts.json so you can play locally
// without setting up a database.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/**
 * Bump this to make every character start over from scratch on their next login
 * (their account and password are kept). Version 1 = Old Maren's tutorial: saves
 * from before it have no version, so everyone replays from the start.
 */
export const SAVE_VERSION = 2; // 2 = tutorial steps reordered (equip steps, guards), so everyone restarts it

/** Everything about a character that survives logging out. */
export interface SaveData {
  saveVersion?: number; // see SAVE_VERSION
  quest?: { step: number; count: number }; // tutorial step (shared/quests.ts) and progress on it
  x?: number;
  y?: number;
  inventory?: (string | null)[];
  coins?: number; // total money, in bronze coins
  skills?: Record<string, number>; // XP per Discipline, e.g. { foraging: 42 } (key kept from before Disciplines)
  skillXp?: Record<string, number>; // XP per skill, e.g. { woodcutting: 120, fishing: 0, mining: 8 }
  // Mastery XP per type, e.g. { pine: 300, oak: 12 }. (Saves from before skillXp
  // existed had Mastery per skill here instead, e.g. { woodcutting: 120 }.)
  mastery?: Record<string, number>;
  durability?: (number | null)[]; // per inventory slot: uses left on a tool
  belt?: Record<string, { item: string; durability: number } | null>; // tools on the belt, e.g. { axe: { item: "axe_bronze_pine", durability: 120 } }
  stamina?: number; // stamina when saved
  staminaAt?: number; // when that was (ms since 1970), so stamina keeps coming back while logged out
  hp?: number; // health when saved
  hpAt?: number; // when that was, so health keeps coming back (1 a minute) while logged out
  gear?: Record<string, { item: string; durability: number } | null>; // weapon and armor being worn, e.g. { weapon: { item: "dagger_bronze_pine", durability: 140 } }
  spell?: string; // spell the staff casts, e.g. "fire_blast"
  combatMastery?: Record<string, number>; // Mastery XP per weapon type, spell and monster, e.g. { dagger: 40, chicken: 22 }
  lockedSlots?: number[]; // inventory slots holding locked items, e.g. [0, 3], so Sell all skips them
  tree?: Record<string, number>; // Mastery skill tree ranks bought, e.g. { "cooking.slots": 2 }
  bounties?: { item: string; count: number }[]; // the bounty board's 5 jobs, e.g. [{ item: "oak_logs", count: 6 }]
  tracked?: string; // the bounty on the quest tracker (its item), if one is picked over Maren's quest
  color?: number; // character colour, picked in Settings (one of shared/colors.ts)
  locked?: string[]; // old: item types that were locked; turned into lockedSlots when loaded
  counts?: number[]; // per inventory slot: how many are in the stack (missing in older saves: 1 each)
  guild?: GuildSave; // the Mages' Guild: rank points, magic bounties and the enchanted chest
  // Add more here later (skills, bank, quests...). Stored as JSON, so no
  // database migration is needed for new fields.
}

/** The Mages' Guild part of a save (shared/guild.ts). */
export interface GuildSave {
  points?: number;
  bounties?: unknown[]; // the guild board's 3 jobs
  chest?: { item: string; count: number; durability?: number | null }[]; // one per chest space; empty spaces are { item: "", count: 0 }
}

export interface Account {
  username: string; // as the player typed it, e.g. "Mike"
  passwordHash: string;
  save: SaveData;
}

interface Store {
  init(): Promise<void>;
  get(username: string): Promise<Account | null>;
  /** Returns false if the username is already taken. */
  create(username: string, passwordHash: string): Promise<boolean>;
  save(username: string, data: SaveData): Promise<void>;
  touchLogin(username: string): Promise<void>;
  /** Change an account's name (it's also the login). Returns false if the new name is taken. */
  rename(oldName: string, newName: string): Promise<boolean>;
  setPassword(username: string, passwordHash: string): Promise<void>;
  close(): Promise<void>;
}

// Usernames are matched case-insensitively ("mike" and "Mike" are the same account).
export const usernameKey = (username: string) => username.trim().toLowerCase();

class PostgresStore implements Store {
  private pool: pg.Pool;
  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, max: 5 });
    this.pool.on("error", (err) => console.error("Database connection error:", err.message));
  }
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        username_key  TEXT PRIMARY KEY,
        username      TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        save          JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at TIMESTAMPTZ,
        saved_at      TIMESTAMPTZ
      )`);
  }
  async get(username: string) {
    const { rows } = await this.pool.query(
      "SELECT username, password_hash, save FROM accounts WHERE username_key = $1", [usernameKey(username)]);
    if (!rows.length) return null;
    return { username: rows[0].username, passwordHash: rows[0].password_hash, save: rows[0].save ?? {} };
  }
  async create(username: string, passwordHash: string) {
    const res = await this.pool.query(
      `INSERT INTO accounts (username_key, username, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (username_key) DO NOTHING`, [usernameKey(username), username.trim(), passwordHash]);
    return res.rowCount === 1;
  }
  async save(username: string, data: SaveData) {
    await this.pool.query("UPDATE accounts SET save = $2, saved_at = now() WHERE username_key = $1",
      [usernameKey(username), JSON.stringify(data)]);
  }
  async touchLogin(username: string) {
    await this.pool.query("UPDATE accounts SET last_login_at = now() WHERE username_key = $1", [usernameKey(username)]);
  }
  async rename(oldName: string, newName: string) {
    try {
      const res = await this.pool.query("UPDATE accounts SET username_key = $2, username = $3 WHERE username_key = $1",
        [usernameKey(oldName), usernameKey(newName), newName.trim()]);
      return res.rowCount === 1;
    } catch (err: any) {
      if (err.code === "23505") return false; // that name is someone else's
      throw err;
    }
  }
  async setPassword(username: string, passwordHash: string) {
    await this.pool.query("UPDATE accounts SET password_hash = $2 WHERE username_key = $1", [usernameKey(username), passwordHash]);
  }
  async close() { await this.pool.end(); }
}

class FileStore implements Store {
  private accounts: Record<string, Account> = {};
  private writing: Promise<void> = Promise.resolve();
  constructor(private file: string) {}
  async init() {
    try {
      this.accounts = JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  async get(username: string) { return this.accounts[usernameKey(username)] ?? null; }
  async create(username: string, passwordHash: string) {
    if (this.accounts[usernameKey(username)]) return false;
    this.accounts[usernameKey(username)] = { username: username.trim(), passwordHash, save: {} };
    await this.flush();
    return true;
  }
  async save(username: string, data: SaveData) {
    const acct = this.accounts[usernameKey(username)];
    if (!acct) return;
    acct.save = data;
    await this.flush();
  }
  async touchLogin() {}
  async rename(oldName: string, newName: string) {
    const from = usernameKey(oldName), to = usernameKey(newName);
    const acct = this.accounts[from];
    if (!acct || (to !== from && this.accounts[to])) return false;
    delete this.accounts[from];
    this.accounts[to] = { ...acct, username: newName.trim() };
    await this.flush();
    return true;
  }
  async setPassword(username: string, passwordHash: string) {
    const acct = this.accounts[usernameKey(username)];
    if (!acct) return;
    acct.passwordHash = passwordHash;
    await this.flush();
  }
  async close() { await this.writing; }
  private flush() {
    // Write one at a time, to a temp file first, so a crash can't leave half a file.
    this.writing = this.writing.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.accounts, null, 2));
      await fs.rename(tmp, this.file);
    });
    return this.writing;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const dbUrl = process.env.DATABASE_URL?.trim();
export const store: Store = dbUrl
  ? new PostgresStore(dbUrl)
  : new FileStore(path.resolve(here, "../data/accounts.json"));
export const storageName = dbUrl ? "Postgres database (DATABASE_URL)" : "local file server/data/accounts.json";

// ---- Passwords: never stored as-is, only as a salted scrypt hash. ----

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}
