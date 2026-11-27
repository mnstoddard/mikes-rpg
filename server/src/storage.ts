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
export const SAVE_VERSION = 3; // 3 = the five Disciplines (Strength, Endurance, Wisdom, Dexterity, Charisma): everyone starts fresh

/**
 * Bump this when the world map is rearranged, so saved positions from the old
 * map aren't used (those characters start in the town square instead).
 * Missing = the first small island map. 2 = the big map of Embervale, with insides.
 */
export const MAP_REV = 3; // 3: version 0.20, the town moved inside Emberhold's walls

/**
 * Which game server this is: "live" (Render, main branch), "dev" (Render, the dev branch),
 * or "local". SERVER_NAME overrides it.
 */
export const SERVER_NAME = process.env.SERVER_NAME?.trim()
  || (process.env.RENDER_GIT_BRANCH ? (process.env.RENDER_GIT_BRANCH === "main" ? "live" : process.env.RENDER_GIT_BRANCH) : "local");
/**
 * A test server (anything but live) can share live's database, so you log in with your real
 * account. Then it keeps its own copy of each character (in test_saves) and its own world
 * data (keys starting "dev:"), so playing on it never changes anyone's live save or farm.
 * The first time you log in there, it starts from a copy of your live character.
 */
const TEST_COPY = SERVER_NAME !== "live" && SERVER_NAME !== "local" ? SERVER_NAME : null;

/** Everything about a character that survives logging out. */
export interface SaveData {
  saveVersion?: number; // see SAVE_VERSION
  quest?: unknown; // the main quest (shared/quests.ts QuestProgress: per chapter, which step and progress on it). Before rev 3: { step, count } in one list
  questRev?: number; // which version of the quest steps this save uses (shared/quests.ts QUEST_REV)
  mapRev?: number;
  tithe?: number; // Tithe marks (Ember Debt, shared/story.ts)
  titheXp?: number; // XP the shrine has taken toward clearing the next one // which version of the world map x and y belong to (MAP_REV); older saves start in the town square
  x?: number;
  y?: number;
  inventory?: (string | null)[]; // one per bag entry (shared/bag.ts); saves from before grouped slots had one per slot
  slots?: number[]; // per entry: which bag slot it's in (missing in older saves: entry i was slot i)
  coins?: number; // total money, in bronze coins
  skills?: Record<string, number>; // XP per Discipline, e.g. { foraging: 42 } (key kept from before Disciplines)
  skillXp?: Record<string, number>; // XP per skill, e.g. { woodcutting: 120, fishing: 0, mining: 8 }
  // Mastery XP per type, e.g. { pine: 300, oak: 12 }. (Saves from before skillXp
  // existed had Mastery per skill here instead, e.g. { woodcutting: 120 }.)
  mastery?: Record<string, number>;
  durability?: (number | null)[]; // per entry: uses left on a tool
  belt?: Record<string, { item: string; durability: number } | null>; // tools on the belt, e.g. { axe: { item: "axe_bronze_pine", durability: 120 } }
  stamina?: number; // stamina when saved
  staminaAt?: number; // when that was (ms since 1970), so stamina keeps coming back while logged out
  hp?: number; // health when saved
  hpAt?: number; // when that was, so health keeps coming back (1 a minute) while logged out
  gear?: Record<string, { item: string; durability: number } | null>; // weapon and armor being worn, e.g. { weapon: { item: "dagger_bronze_pine", durability: 140 } }
  spell?: string; // spell the staff casts, e.g. "fire_blast"
  combatMastery?: Record<string, number>; // Mastery XP per weapon type, spell and monster, e.g. { dagger: 40, chicken: 22 }
  lockedSlots?: number[]; // entries holding locked items, e.g. [0, 3], so Sell all skips them
  tree?: Record<string, number>; // Mastery skill tree ranks bought, e.g. { "cooking.slots": 2 }
  bounties?: { item: string; count: number }[]; // the bounty board's 5 jobs, e.g. [{ item: "oak_logs", count: 6 }]
  tracked?: string; // the bounty on the quest tracker (its item), if one is picked over Maren's quest
  color?: number; // character colour, picked in Settings (one of shared/colors.ts)
  look?: string; // the 3D character's look (Character Workshop recipe as JSON, shared/look.ts)
  locked?: string[]; // old: item types that were locked; turned into lockedSlots when loaded
  counts?: number[]; // per entry: how many are in the stack (missing in older saves: 1 each)
  jewels?: Record<string, string | null>; // rings and amulet worn, e.g. { ring1: "ring_gold_ruby_24", ring2: null, amulet: null }
  books?: string[]; // spells learned from spell books (shared/spells.ts)
  spellBar?: (string | null)[]; // the spell bar's slots
  discovered?: string[]; // hidden potion recipes found by brewing them, e.g. ["restore"] (shared/alchemy.ts)
  buffs?: Record<string, { until: number; power: number }>; // potion buffs still running, e.g. { strength: { until: 1795..., power: 12 } }
  guild?: GuildSave; // the Mages' Guild: rank points, magic bounties and the enchanted chest
  renownRank?: number; // Captain Bryn's Renown rank (shared/renown.ts): 0 none, 1 Wanderer, 2 Trusted, 3 Champion
  title?: string; // the earned title shown over your head ("" for none)
  boardDay?: number; // the day the bounty board was last filled (it changes daily)
  guildDay?: number; // the same for the guild's board
  farmChest?: boolean; // paid Farmer Odo to link the farm chest to the enchanted chest (shared/farming.ts)
  // Add more here later (skills, bank, quests...). Stored as JSON, so no
  // database migration is needed for new fields.
}

/** The Mages' Guild part of a save (shared/guild.ts). */
export interface GuildSave {
  points?: number;
  bounties?: unknown[]; // the guild board's 3 jobs
  chestSize?: number; // spaces rented (missing in older saves: one chest entry per space)
  chest?: { item: string; count: number; durability?: number | null; slot?: number }[]; // one per entry, with its space (older saves: one per space, empty ones { item: "", count: 0 })
}

export interface Account {
  username: string; // as the player typed it, e.g. "Mike"
  passwordHash: string;
  save: SaveData;
}

/** A bug report or change idea sent from inside the game (any client: 2D, 3D...). */
export interface Report {
  id: number;
  createdAt: string; // ISO time
  kind: string; // "bug" | "idea"
  note: string;
  username: string | null; // filled in by the server from the logged-in player, when it can tell
  status: string; // "new" | "done"
  hasScreenshot: boolean;
  /** Everything else: where the player was, browser, game version, recent messages and errors, save snapshot. */
  info: Record<string, unknown>;
}
export type NewReport = Omit<Report, "id" | "createdAt" | "status" | "hasScreenshot">;

/** One line of the login log: someone logged in (or tried to), and when they left. */
export interface LoginEntry {
  id: number;
  username: string; // as typed at login (for a wrong password, whatever they typed)
  /** "login", "new" (made a new account and logged in) or "failed" (wrong password). */
  outcome: string;
  device: string; // e.g. "Chrome on Windows"
  at: string; // ISO time they logged in (or tried to)
  endedAt: string | null; // ISO time they logged out; null while they're still playing
  /** How it ended: "logged out", or "server restarted" (the game restarted while they were on, so the exact time is unknown). */
  ended: string | null;
}
export type NewLogin = Pick<LoginEntry, "username" | "outcome" | "device">;

/** One automatic crash report (server/src/crashes.ts): from a player's game, or from the server itself. */
export interface CrashEntry {
  id: number;
  at: string; // ISO time
  /** "error", "webgl", "disconnect", "killed" (from a player's game), "server-error", "server-start" (the server itself). */
  kind: string;
  message: string;
  stack: string;
  username: string | null;
  /** Which game server: "live", "dev" or "local" (dev and live can share a database). */
  server: string;
  /** Version, device, memory, what was being drawn, the trail of what happened just before. */
  info: Record<string, unknown>;
}
export type NewCrash = Omit<CrashEntry, "id" | "at">;

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
  /** Things that belong to the world, not one character (e.g. "farms": everyone's plots). */
  getWorld(key: string): Promise<unknown>;
  setWorld(key: string, data: unknown): Promise<void>;
  /** Bug reports: saved with an optional JPEG/PNG screenshot. Returns the new report's id. */
  addReport(report: NewReport, screenshot: { type: string; data: Buffer } | null): Promise<number>;
  /** Newest first. */
  listReports(opts: { status?: string; limit: number }): Promise<Report[]>;
  getReport(id: number): Promise<Report | null>;
  getScreenshot(id: number): Promise<{ type: string; data: Buffer } | null>;
  setReportStatus(id: number, status: string): Promise<boolean>;
  /** Throw a report away for good (and its screenshot). */
  deleteReport(id: number): Promise<boolean>;
  /** The login log (for the admin): add a line, returning its id. */
  addLogin(entry: NewLogin): Promise<number>;
  /** Fill in when a login's session ended. */
  endLogin(id: number, how: string): Promise<void>;
  /** Newest first. */
  listLogins(opts: { limit: number }): Promise<LoginEntry[]>;
  /** Crash reports: add one; list them newest first. */
  addCrash(entry: NewCrash): Promise<number>;
  listCrashes(opts: { limit: number }): Promise<CrashEntry[]>;
  close(): Promise<void>;
}

// Usernames are matched case-insensitively ("mike" and "Mike" are the same account).
export const usernameKey = (username: string) => username.trim().toLowerCase();

/** Login log lines older than this are thrown away when the server starts. */
const LOGIN_KEEP_DAYS = 365;
/** The local file version keeps at most this many lines. */
const LOGIN_KEEP_LINES = 5000;
/** Crash reports older than this are thrown away when the server starts. */
const CRASH_KEEP_DAYS = 90;
const CRASH_KEEP_LINES = 2000;

function crashFromRow(r: any): CrashEntry {
  return {
    id: r.id, at: new Date(r.at).toISOString(), kind: r.kind, message: r.message, stack: r.stack ?? "",
    username: r.username ?? null, server: r.server ?? "", info: r.info ?? {},
  };
}

function loginFromRow(r: any): LoginEntry {
  return {
    id: r.id, username: r.username, outcome: r.outcome, device: r.device ?? "",
    at: new Date(r.at).toISOString(), endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null, ended: r.ended ?? null,
  };
}

function reportFromRow(r: any): Report {
  return {
    id: r.id, createdAt: new Date(r.created_at).toISOString(), kind: r.kind, note: r.note,
    username: r.username, status: r.status, hasScreenshot: r.has_shot, info: r.info ?? {},
  };
}

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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS world (
        key        TEXT PRIMARY KEY,
        data       JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id              SERIAL PRIMARY KEY,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        kind            TEXT NOT NULL,
        note            TEXT NOT NULL,
        username        TEXT,
        status          TEXT NOT NULL DEFAULT 'new',
        info            JSONB NOT NULL DEFAULT '{}'::jsonb,
        screenshot      BYTEA,
        screenshot_type TEXT
      )`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS logins (
        id       SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        outcome  TEXT NOT NULL,
        device   TEXT NOT NULL DEFAULT '',
        at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        ended_at TIMESTAMPTZ,
        ended    TEXT
      )`);
    // Anyone still "on" from before this start was cut off by a restart or redeploy.
    // (Not on a test server sharing live's database: that would cut off everyone playing on live.)
    if (!TEST_COPY) await this.pool.query("UPDATE logins SET ended = 'server restarted' WHERE ended IS NULL AND outcome <> 'failed'");
    await this.pool.query(`DELETE FROM logins WHERE at < now() - interval '${LOGIN_KEEP_DAYS} days'`);
    if (TEST_COPY) {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS test_saves (
          server       TEXT NOT NULL,
          username_key TEXT NOT NULL,
          save         JSONB NOT NULL DEFAULT '{}'::jsonb,
          saved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (server, username_key)
        )`);
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS crashes (
        id       SERIAL PRIMARY KEY,
        at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        kind     TEXT NOT NULL,
        message  TEXT NOT NULL,
        stack    TEXT NOT NULL DEFAULT '',
        username TEXT,
        server   TEXT NOT NULL DEFAULT '',
        info     JSONB NOT NULL DEFAULT '{}'::jsonb
      )`);
    await this.pool.query(`DELETE FROM crashes WHERE at < now() - interval '${CRASH_KEEP_DAYS} days'`);
  }
  async addCrash(c: NewCrash) {
    const { rows } = await this.pool.query(
      "INSERT INTO crashes (kind, message, stack, username, server, info) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [c.kind, c.message, c.stack, c.username, c.server, JSON.stringify(c.info)]);
    return rows[0].id as number;
  }
  async listCrashes(opts: { limit: number }) {
    const { rows } = await this.pool.query("SELECT * FROM crashes ORDER BY id DESC LIMIT $1", [opts.limit]);
    return rows.map(crashFromRow);
  }
  async addLogin(e: NewLogin) {
    const { rows } = await this.pool.query(
      "INSERT INTO logins (username, outcome, device) VALUES ($1, $2, $3) RETURNING id", [e.username, e.outcome, e.device]);
    return rows[0].id as number;
  }
  async endLogin(id: number, how: string) {
    await this.pool.query("UPDATE logins SET ended_at = now(), ended = $2 WHERE id = $1 AND ended IS NULL", [id, how]);
  }
  async listLogins(opts: { limit: number }) {
    const { rows } = await this.pool.query("SELECT * FROM logins ORDER BY id DESC LIMIT $1", [opts.limit]);
    return rows.map(loginFromRow);
  }
  async addReport(r: NewReport, shot: { type: string; data: Buffer } | null) {
    const { rows } = await this.pool.query(
      `INSERT INTO reports (kind, note, username, info, screenshot, screenshot_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [r.kind, r.note, r.username, JSON.stringify(r.info), shot?.data ?? null, shot?.type ?? null]);
    return rows[0].id as number;
  }
  async listReports(opts: { status?: string; limit: number }) {
    const { rows } = await this.pool.query(
      `SELECT id, created_at, kind, note, username, status, info, screenshot IS NOT NULL AS has_shot
       FROM reports WHERE ($1::text IS NULL OR status = $1) ORDER BY id DESC LIMIT $2`,
      [opts.status ?? null, opts.limit]);
    return rows.map(reportFromRow);
  }
  async getReport(id: number) {
    const { rows } = await this.pool.query(
      `SELECT id, created_at, kind, note, username, status, info, screenshot IS NOT NULL AS has_shot
       FROM reports WHERE id = $1`, [id]);
    return rows[0] ? reportFromRow(rows[0]) : null;
  }
  async getScreenshot(id: number) {
    const { rows } = await this.pool.query("SELECT screenshot, screenshot_type FROM reports WHERE id = $1", [id]);
    return rows[0]?.screenshot ? { type: rows[0].screenshot_type, data: rows[0].screenshot as Buffer } : null;
  }
  async setReportStatus(id: number, status: string) {
    const res = await this.pool.query("UPDATE reports SET status = $2 WHERE id = $1", [id, status]);
    return res.rowCount === 1;
  }
  async deleteReport(id: number) {
    const res = await this.pool.query("DELETE FROM reports WHERE id = $1", [id]);
    return res.rowCount === 1;
  }
  /** On a test server, world data has its own keys ("dev:farms"), so live's farms are left alone. */
  private worldKey(key: string) { return TEST_COPY ? `${TEST_COPY}:${key}` : key; }
  async getWorld(key: string) {
    const { rows } = await this.pool.query("SELECT data FROM world WHERE key = $1", [this.worldKey(key)]);
    return rows[0]?.data ?? null;
  }
  async setWorld(key: string, data: unknown) {
    await this.pool.query(
      `INSERT INTO world (key, data) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = now()`, [this.worldKey(key), JSON.stringify(data)]);
  }
  async get(username: string) {
    const { rows } = TEST_COPY
      ? await this.pool.query(
        `SELECT a.username, a.password_hash, COALESCE(t.save, a.save) AS save FROM accounts a
         LEFT JOIN test_saves t ON t.server = $2 AND t.username_key = a.username_key WHERE a.username_key = $1`,
        [usernameKey(username), TEST_COPY])
      : await this.pool.query("SELECT username, password_hash, save FROM accounts WHERE username_key = $1", [usernameKey(username)]);
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
    if (TEST_COPY) {
      await this.pool.query(
        `INSERT INTO test_saves (server, username_key, save) VALUES ($1, $2, $3)
         ON CONFLICT (server, username_key) DO UPDATE SET save = $3, saved_at = now()`,
        [TEST_COPY, usernameKey(username), JSON.stringify(data)]);
      return;
    }
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
      if (TEST_COPY && res.rowCount === 1) {
        await this.pool.query("UPDATE test_saves SET username_key = $2 WHERE username_key = $1", [usernameKey(oldName), usernameKey(newName)]);
      }
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
  private world: Record<string, unknown> = {};
  private writing: Promise<void> = Promise.resolve();
  private worldWriting: Promise<void> = Promise.resolve();
  constructor(private file: string) {}
  /** World data sits next to the accounts, in world.json. */
  private get worldFile() { return path.join(path.dirname(this.file), "world.json"); }
  async init() {
    try {
      this.accounts = JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
    try {
      this.world = JSON.parse(await fs.readFile(this.worldFile, "utf8"));
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
    await this.loadReports();
    try {
      this.logins = JSON.parse(await fs.readFile(this.loginFile, "utf8"));
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
    for (const e of this.logins) if (!e.ended && e.outcome !== "failed") e.ended = "server restarted";
    try {
      this.crashes = JSON.parse(await fs.readFile(this.crashFile, "utf8"));
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  // Crash reports go in server/data/crashes.json.
  private get crashFile() { return path.join(path.dirname(this.file), "crashes.json"); }
  private crashes: CrashEntry[] = [];
  private crashWriting: Promise<void> = Promise.resolve();
  async addCrash(c: NewCrash) {
    const id = (this.crashes.at(-1)?.id ?? 0) + 1;
    this.crashes.push({ ...c, id, at: new Date().toISOString() });
    if (this.crashes.length > CRASH_KEEP_LINES) this.crashes.splice(0, this.crashes.length - CRASH_KEEP_LINES);
    this.crashWriting = this.crashWriting.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.crashFile), { recursive: true });
      await fs.writeFile(`${this.crashFile}.tmp`, JSON.stringify(this.crashes, null, 2));
      await fs.rename(`${this.crashFile}.tmp`, this.crashFile);
    });
    await this.crashWriting;
    return id;
  }
  async listCrashes(opts: { limit: number }) {
    return this.crashes.slice(-opts.limit).reverse();
  }
  // The login log goes in server/data/logins.json.
  private get loginFile() { return path.join(path.dirname(this.file), "logins.json"); }
  private logins: LoginEntry[] = [];
  private loginWriting: Promise<void> = Promise.resolve();
  private flushLogins() {
    if (this.logins.length > LOGIN_KEEP_LINES) this.logins.splice(0, this.logins.length - LOGIN_KEEP_LINES);
    this.loginWriting = this.loginWriting.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.loginFile), { recursive: true });
      await fs.writeFile(`${this.loginFile}.tmp`, JSON.stringify(this.logins, null, 2));
      await fs.rename(`${this.loginFile}.tmp`, this.loginFile);
    });
    return this.loginWriting;
  }
  async addLogin(e: NewLogin) {
    const id = (this.logins.at(-1)?.id ?? 0) + 1;
    this.logins.push({ ...e, id, at: new Date().toISOString(), endedAt: null, ended: null });
    await this.flushLogins();
    return id;
  }
  async endLogin(id: number, how: string) {
    const e = this.logins.find((x) => x.id === id);
    if (!e || e.ended) return;
    e.endedAt = new Date().toISOString();
    e.ended = how;
    await this.flushLogins();
  }
  async listLogins(opts: { limit: number }) {
    return this.logins.slice(-opts.limit).reverse();
  }
  // Reports go in server/data/reports/: reports.json, plus 12.jpg etc. for screenshots.
  private get reportDir() { return path.join(path.dirname(this.file), "reports"); }
  private reports: (Report & { screenshotType?: string })[] = [];
  private reportWriting: Promise<void> = Promise.resolve();
  private async loadReports() {
    try {
      this.reports = JSON.parse(await fs.readFile(path.join(this.reportDir, "reports.json"), "utf8"));
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  private flushReports() {
    this.reportWriting = this.reportWriting.catch(() => {}).then(async () => {
      const file = path.join(this.reportDir, "reports.json");
      await fs.writeFile(`${file}.tmp`, JSON.stringify(this.reports, null, 2));
      await fs.rename(`${file}.tmp`, file);
    });
    return this.reportWriting;
  }
  private shotFile(id: number, type: string) { return path.join(this.reportDir, `${id}.${type === "image/png" ? "png" : "jpg"}`); }
  async addReport(r: NewReport, shot: { type: string; data: Buffer } | null) {
    await fs.mkdir(this.reportDir, { recursive: true });
    const id = (this.reports.at(-1)?.id ?? 0) + 1;
    if (shot) await fs.writeFile(this.shotFile(id, shot.type), shot.data);
    this.reports.push({ ...r, id, createdAt: new Date().toISOString(), status: "new", hasScreenshot: !!shot, screenshotType: shot?.type });
    await this.flushReports();
    return id;
  }
  async listReports(opts: { status?: string; limit: number }) {
    return this.reports.filter((r) => !opts.status || r.status === opts.status).slice(-opts.limit).reverse()
      .map(({ screenshotType: _t, ...r }) => r);
  }
  async getReport(id: number) {
    const found = this.reports.find((x) => x.id === id);
    if (!found) return null;
    const { screenshotType: _t, ...r } = found;
    return r;
  }
  async getScreenshot(id: number) {
    const r = this.reports.find((x) => x.id === id);
    if (!r?.screenshotType) return null;
    try { return { type: r.screenshotType, data: await fs.readFile(this.shotFile(id, r.screenshotType)) }; } catch { return null; }
  }
  async setReportStatus(id: number, status: string) {
    const r = this.reports.find((x) => x.id === id);
    if (!r) return false;
    r.status = status;
    await this.flushReports();
    return true;
  }
  async deleteReport(id: number) {
    const i = this.reports.findIndex((x) => x.id === id);
    if (i < 0) return false;
    const [r] = this.reports.splice(i, 1);
    if (r.screenshotType) await fs.rm(this.shotFile(id, r.screenshotType), { force: true });
    await this.flushReports();
    return true;
  }
  async getWorld(key: string) { return this.world[key] ?? null; }
  async setWorld(key: string, data: unknown) {
    this.world[key] = data;
    this.worldWriting = this.worldWriting.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.worldFile), { recursive: true });
      const tmp = `${this.worldFile}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.world, null, 2));
      await fs.rename(tmp, this.worldFile);
    });
    return this.worldWriting;
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
  async close() { await this.writing; await this.worldWriting; await this.reportWriting; await this.loginWriting; await this.crashWriting; }
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
