import { Room, Client, ServerError, type AuthContext } from "colyseus";
import { type } from "@colyseus/schema";
import { TICK_MS, WAKE_SPOT, areaAt, DOORS, PLACES } from "../../shared/map";
import { Point } from "../../shared/pathfinding";
import { SkillId, isUnlocked, levelForXp } from "../../shared/disciplines";
import { HEALTH_REGEN_TICKS, MANA_REGEN_TICKS, MONSTERS, MONSTER_SPAWNS } from "../../shared/combat";
import { NpcDef } from "../../shared/npcs";
import { RUN_REFILL, RUN_REST_MS } from "../../shared/stats";
import { rankFor } from "../../shared/guild";
import { enchantTotal, manaFlowPercent } from "../../shared/enchanting";
import { QuestStep, chapterById, chapterOpen, Chapter, CHAPTERS, gateMet, litLanterns, talkWith } from "../../shared/quests";
import { roomError } from "./crashes";
import { Account, checkPassword, hashPassword, store, usernameKey } from "./storage";
import { PLAYER_COLORS, isPlayerColor } from "../../shared/colors";
import { earnedTitles } from "../../shared/renown";
import { cleanLook } from "../../shared/look";
import { PLOT_SIZES } from "../../shared/farming";
import { HV_WALL } from "../../shared/world";
import { Player, Monster, Plot, WorldState } from "./room/schema";
import { STEP_LOOP_MS, AUTOSAVE_TICKS, USERNAME_RE, MIN_PASSWORD, REGEN_TICKS, online, pendingSaves, failedLogins, RECONNECT_SECONDS, waitingToReconnect, loginLines, deviceName, logLogin, logLogout, AuthedAccount, rooms, playerForReport } from "./room/common";
import { movementMethods, registerMovement } from "./room/movement";
import { gatheringMethods, registerGathering } from "./room/gathering";
import { craftingMethods, registerCrafting } from "./room/crafting";
import { statsMethods, registerStats } from "./room/stats";
import { bagMethods, registerBag } from "./room/bag";
import { shopsMethods, registerShops } from "./room/shops";
import { guildMethods, registerGuild } from "./room/guild";
import { combatMethods, registerCombat } from "./room/combat";
import { partyMethods, registerParty } from "./room/party";
import { repairMethods, registerRepair } from "./room/repair";
import { magicMethods, registerMagic } from "./room/magic";
import { questsMethods, registerQuests } from "./room/quests";
import { farmingMethods, registerFarming } from "./room/farming";
import { savesMethods } from "./room/saves";
import { registerSettings } from "./room/settings";

/**
 * The game room: everyone in the world, the monsters, and the game loop.
 * Most of what happens lives in feature files under server/src/room/; their
 * methods are added to this class at the bottom (the interface below declares them).
 */
export class WorldRoom extends Room<WorldState> {
  maxClients = 100;
  state = new WorldState();

  /** Who a bug report came from: name, where they are, and a copy of their save. */
  reportInfo(sessionId: string) {
    const p = this.state.players.get(sessionId);
    if (!p) return null;
    const area = areaAt(p.x, p.y);
    return { username: p.name, x: p.x, y: p.y, area: area?.name ?? null, action: p.action, hp: p.hp, maxHp: p.maxHp, save: this.snapshot(p) };
  }

  /** An error in a message handler or timer: written down as a crash report, and the game keeps going. */
  onUncaughtException(error: unknown, methodName: string) {
    roomError(error, methodName);
  }

  onCreate() {
    // Each feature file registers the messages it handles (server/src/room/).
    registerMovement.call(this);
    registerGathering.call(this);
    registerCrafting.call(this);
    registerStats.call(this);
    registerBag.call(this);
    registerShops.call(this);
    registerGuild.call(this);
    registerCombat.call(this);
    registerParty.call(this);
    registerRepair.call(this);
    registerMagic.call(this);
    registerQuests.call(this);
    registerFarming.call(this);
    registerSettings.call(this);
    rooms.add(this);
    // Walking runs on each player's own 600ms step timer, so a click starts you
    // moving right away instead of waiting for the next world tick. Everything
    // else (chopping, trees growing back, saving) runs on the 600ms world tick.
    // State is sent out every 50ms so clients see changes as soon as they happen.
    this.setPatchRate(STEP_LOOP_MS);
    let sinceTick = 0;
    this.setSimulationInterval((dt) => {
      this.stepPlayers();
      sinceTick += dt;
      if (sinceTick >= TICK_MS) {
        sinceTick -= TICK_MS;
        this.gameTick();
      }
    }, STEP_LOOP_MS);

    void this.loadFarms();

    MONSTER_SPAWNS.forEach(([kind, x, y], i) => {
      const m = new Monster();
      m.kind = kind;
      m.x = m.homeX = x;
      m.y = m.homeY = y;
      m.hp = m.maxHp = MONSTERS[kind].hp;
      this.state.monsters.set(`m${i}`, m);
    });












































    // ---- Mages' Guild ----






  }

  gameTick() {
    const tick = ++this.state.tick;
    if (tick % AUTOSAVE_TICKS === 0) this.autosave();

    // Grow back trees whose time is up.
    this.state.depleted.forEach((respawnAt, key) => {
      if (tick >= respawnAt) this.state.depleted.delete(key);
    });

    this.state.players.forEach((p, sessionId) => {
      // Stamina comes back on its own, 1 every 30 seconds.
      if (p.stamina < p.maxStamina && ++p.regenTicks >= REGEN_TICKS) {
        p.regenTicks = 0;
        p.stamina++;
        p.dirty = true;
        const client = this.clients.getById(sessionId);
        if (client) this.sendStamina(client, p);
      }
      // Health comes back very slowly (1 a minute), mana faster (1 every 6 seconds).
      const client = this.clients.getById(sessionId);
      // Catching your breath after running: it all comes back a few seconds after you stop.
      if (p.winded > 0 && Date.now() - p.lastRunAt > RUN_REST_MS) {
        const could = this.canRun(p);
        p.winded = Math.max(0, p.winded - RUN_REFILL);
        if (this.canRun(p) !== could) p.stepMs = this.stepMsOf(p);
        if (!p.winded) p.outOfBreath = false;
        if (client) this.sendStamina(client, p);
      }
      if (tick % 5 === 0) this.expireBuffs(p, client);
      let vitals = false;
      if (p.hp < p.maxHp && ++p.healthTicks >= HEALTH_REGEN_TICKS) { p.healthTicks = 0; p.hp++; vitals = true; }
      const mMax = this.maxManaOf(p);
      const manaEvery = MANA_REGEN_TICKS / (1 + manaFlowPercent(enchantTotal(this.armorItems(p), "manaflow")) / 100);
      if (p.mana < mMax && ++p.manaTicks >= manaEvery) { p.manaTicks = 0; p.mana++; vitals = true; }
      if (vitals && client) this.sendVitals(client, p);
      if (p.fighting) return this.combatTick(p, sessionId);
      if (p.path.length || !p.target) return;
      if (p.crafting) this.craftTick(p, sessionId);
      else if (p.activity === "farming") this.farmTick(p, sessionId);
      else this.gatherTick(p, sessionId);
    });
    this.monsterTick(tick);
  }











































































  // ---------------- Parties (stage 13, shared/party.ts) ----------------

  parties = new Map<string, { leader: string; members: string[] }>();
  partySeq = 0;























































  /** The talk step this person has for you right now, if any: the current step, or the first step of the story chapter they give next. */
  nextTalkWith(p: Player, npc: NpcDef): { chapter: Chapter; step: QuestStep } | null {
    const q = p.quest;
    const step = this.step(p);
    if (q.active && step) {
      const c = chapterById(q.active);
      return step.goal.kind === "talk" && talkWith(c, step) === npc.id ? { chapter: c, step } : null;
    }
    const c = CHAPTERS.find((ch) => ch.act && ch.giver === npc.id && !q.ch[ch.id] && chapterOpen(q, ch.id) && gateMet(ch, this.levelOf(p)));
    const first = c?.steps[0];
    if (!c || !first || first.goal.kind !== "talk" || talkWith(c, first) !== npc.id) return null;
    q.ch[c.id] = { step: 0, count: 0 };
    q.active = c.id;
    p.dirty = true;
    return { chapter: c, step: first };
  }













  /** The nearest shrine that can raise you: the Heart Shrine, or ones you've relit. */
  respawnShrine(p: Player): { name: string; at: Point } {
    const lit = litLanterns(p.quest);
    // Where you fell, outdoors: inside somewhere counts as its front door.
    const area = areaAt(p.x, p.y);
    const door = area && area.kind !== "outdoor" ? DOORS.find((d) => d.area === area.id && areaAt(d.x, d.y)?.kind === "outdoor") : null;
    const from = door ?? p;
    const heart = DOORS.find((d) => d.area === "lighthall" && areaAt(d.x, d.y)?.kind === "outdoor")!;
    // Out in Heartvale, the Heart Shrine counts as being where Emberhold's walls are.
    const hvCity = { x: (HV_WALL.X0 + HV_WALL.X1) / 2, y: (HV_WALL.Y0 + HV_WALL.Y1) / 2 };
    const inValley = areaAt(from.x, from.y)?.id === "heartvale";
    const choices: { name: string; at: Point; from: Point }[] = [{ name: "the Heart Shrine in the Emberhall", at: WAKE_SPOT, from: inValley ? hvCity : heart }];
    if (lit.includes("west_shrine")) choices.push({ name: "the Westroad shrine", at: PLACES.westShrine, from: PLACES.westShrine });
    if (lit.includes("thorn_shrine")) choices.push({ name: "the valley's edge shrine", at: PLACES.thornShrine, from: PLACES.thornShrine });
    const dist = (a: Point) => Math.hypot(a.x - from.x, a.y - from.y);
    const best = area && area.kind !== "outdoor" && !door ? choices[0] : choices.reduce((a, b) => (dist(b.from) < dist(a.from) ? b : a));
    return { name: best.name, at: best.at };
  }











  // ---- Trading and Renown (stage 12: shared/renown.ts, shared/shops.ts) ----

  tradingLevel = (p: Player) => (isUnlocked(p.unlocked, "trading") ? levelForXp(p.skillXp.trading) : 1);
  renownLevel = (p: Player) => (isUnlocked(p.unlocked, "renown") ? levelForXp(p.skillXp.renown) : 1);
  /** A skill's level (0 if you haven't been taught it), for quests that need one. */
  levelOf = (p: Player) => (skill: SkillId) => (isUnlocked(p.unlocked, skill) ? levelForXp(p.skillXp[skill]) : 0);
  titlesOf = (p: Player) => earnedTitles(p.renownRank, rankFor(p.guildPoints));




  // ---- Farming (shared/farming.ts) ----

  farmSaveTimer: ReturnType<typeof setTimeout> | null = null;




  plotOf(p: Player): { lot: number; plot: Plot } | null {
    const key = usernameKey(p.name);
    for (const [k, plot] of this.state.plots) if (plot.ownerKey === key) return { lot: Number(k), plot };
    return null;
  }

  plotStep = (plot: Plot) => Math.max(0, PLOT_SIZES.findIndex(([w, h]) => w === plot.w && h === plot.h));





  /** Within reach of a farm tile: on it, or next to it (diagonals too). */
  nearTile = (p: Point, t: Point) => Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y)) <= 1;






















  // ---- Accounts ----

  /** Runs before a player joins: checks their username and password. */
  async onAuth(_client: Client, options: { username?: string; password?: string; create?: boolean }, context?: AuthContext) {
    const device = deviceName(context?.headers?.["user-agent"]);
    const username = String(options?.username ?? "").trim();
    const password = String(options?.password ?? "");
    const k = usernameKey(username);
    if (!USERNAME_RE.test(username)) {
      throw new ServerError(400, "Usernames are 1-12 letters, numbers, spaces, _ or -, starting with a letter or number.");
    }
    if (password.length < MIN_PASSWORD) throw new ServerError(400, `Passwords need at least ${MIN_PASSWORD} characters.`);
    if (password.length > 100) throw new ServerError(400, "That password is too long.");

    const lock = failedLogins.get(k);
    if (lock && lock.until > Date.now()) throw new ServerError(429, "Too many wrong passwords. Wait a minute and try again.");
    // Logging in again while an old connection waits to reconnect: end the old one first.
    const waiting = waitingToReconnect.get(k);
    if (waiting) {
      waiting.reject(new Error("logged in again"));
      await new Promise((r) => setTimeout(r, 50));
    }
    await pendingSaves.get(k); // finish saving a previous session first

    let account: Account | null;
    if (options?.create) {
      const created = await store.create(username, await hashPassword(password));
      if (!created) throw new ServerError(409, "That username is taken. Try another one.");
      account = await store.get(username);
      console.log(`New account: ${username}`);
    } else {
      account = await store.get(username);
      if (!account || !(await checkPassword(password, account.passwordHash))) {
        const f = failedLogins.get(k) ?? { count: 0, until: 0 };
        f.count++;
        if (f.count >= 5) { f.count = 0; f.until = Date.now() + 60_000; }
        failedLogins.set(k, f);
        logLogin(username, "failed", device);
        throw new ServerError(401, "Wrong username or password.");
      }
    }
    failedLogins.delete(k);
    if (online.has(k)) throw new ServerError(409, "That account is already logged in.");
    store.touchLogin(username).catch((err) => console.error("touchLogin failed:", err.message));
    const authed: AuthedAccount = { ...account!, isNew: !!options?.create, device };
    return authed; // becomes client.auth
  }

  onJoin(client: Client) {
    const account = client.auth as AuthedAccount;
    const k = usernameKey(account.username);
    if (online.has(k)) throw new ServerError(409, "That account is already logged in.");
    online.add(k);
    const p = new Player();
    p.name = account.username;
    p.color = isPlayerColor(account.save.color) ? account.save.color : PLAYER_COLORS[this.state.players.size % PLAYER_COLORS.length].color;
    p.look = cleanLook(account.save.look) ?? "";
    this.restore(p, account.save);
    p.lastSavedAt = Date.now();
    this.state.players.set(client.sessionId, p);
    console.log(`${p.name} logged in (${this.state.players.size} online)`);
    loginLines.set(client.sessionId, logLogin(p.name, account.isNew ? "new" : "login", account.device ?? "unknown"));
  }

  async onLeave(client: Client, consented: boolean) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const k = usernameKey(p.name);
    if (!consented) {
      // The connection dropped rather than the player leaving: keep them in the
      // world (standing still) and let the same browser pick up where it left off.
      this.stopActions(p);
      p.path = [];
      const reconnection = this.allowReconnection(client, RECONNECT_SECONDS);
      waitingToReconnect.set(k, reconnection);
      try {
        await reconnection;
        waitingToReconnect.delete(k);
        console.log(`${p.name} reconnected`);
        return;
      } catch {
        waitingToReconnect.delete(k);
      }
    }
    this.leaveParty(client.sessionId, "left");
    p.invite = null;
    this.state.players.delete(client.sessionId);
    console.log(`${p.name} logged out (${this.state.players.size} online)`);
    logLogout(client.sessionId, "logged out");
    const saving = this.save(p).finally(() => { pendingSaves.delete(k); });
    pendingSaves.set(k, saving);
    online.delete(k);
    await saving;
  }

  async onDispose() {
    rooms.delete(this);
    // Normally onLeave already saved everyone; this is a safety net.
    await Promise.all([...this.state.players.values()].map((p) => this.save(p)));
    await Promise.all([...this.state.players.keys()].map((sid) => logLogout(sid, "logged out")));
    if (this.farmSaveTimer) { clearTimeout(this.farmSaveTimer); await this.saveFarms(); }
  }





}

type MovementMethods = typeof movementMethods;
type GatheringMethods = typeof gatheringMethods;
type CraftingMethods = typeof craftingMethods;
type StatsMethods = typeof statsMethods;
type BagMethods = typeof bagMethods;
type ShopsMethods = typeof shopsMethods;
type GuildMethods = typeof guildMethods;
type CombatMethods = typeof combatMethods;
type PartyMethods = typeof partyMethods;
type RepairMethods = typeof repairMethods;
type MagicMethods = typeof magicMethods;
type QuestsMethods = typeof questsMethods;
type FarmingMethods = typeof farmingMethods;
type SavesMethods = typeof savesMethods;
export interface WorldRoom extends MovementMethods, GatheringMethods, CraftingMethods, StatsMethods, BagMethods, ShopsMethods, GuildMethods, CombatMethods, PartyMethods, RepairMethods, MagicMethods, QuestsMethods, FarmingMethods, SavesMethods {}
Object.assign(WorldRoom.prototype, movementMethods, gatheringMethods, craftingMethods, statsMethods, bagMethods, shopsMethods, guildMethods, combatMethods, partyMethods, repairMethods, magicMethods, questsMethods, farmingMethods, savesMethods);

export { Player, Monster, Plot, WorldState } from "./room/schema";
export { deviceName, playerForReport } from "./room/common";
