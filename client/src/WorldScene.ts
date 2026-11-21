import Phaser from "phaser";
import { getStateCallbacks, Room } from "colyseus.js";
import { AREAS, AreaDef, DOORS, MAP, MAP_HEIGHT, MAP_WIDTH, OUTDOORS, TICK_MS, TILE_SIZE, areaAt, doorAt, isWalkable } from "../../shared/map";
import { buildTileset, emptyRockTexture, fishingSpotsIn, patchTextures, rockTexture, stumpTexture, treeTexture } from "./mapDraw";
import { setWorldMapActions, setWorldMapMarks, updateWorldMap } from "./worldmap";
import { CombatMasteryId, CombatMasteryXp, MONSTERS, MonsterId, SpellId, combatMasteryName } from "../../shared/combat";
import type { Gear } from "../../shared/gear";
import { RESOURCES, ResourceId, fishAt, isFishingSpot, nodeAt, treeKey } from "../../shared/foraging";

import { ITEMS, ItemId } from "../../shared/items";
import { joinWorld, rejoinWorld } from "./network";
import { Bag, emptyBag } from "../../shared/bag";
import { accountResult, closeBounties, renderMe, renderTracked, resetForSignOut, setAccountActions, setBountyActions, setQuestActions, showBounties, closeGuild, closeChest, setGuildActions, showChest, showGuild } from "./ui";
import type { GuildView } from "../../shared/guild";
import type { Bounty } from "../../shared/bounties";
import { closeRepair, setRepairActions, showRepairs, closeDialog, openDialog, renderQuest, renderStamina, renderVitals, renderGear, renderCombatMastery, flashCombatMastery, closeCraft, closeInfo, closeShop, flashDiscipline, flashMastery, flashSkillRow, openCraft, renderBelt, renderMastery, renderSkillXp, openShop, renderBag, renderCoins, renderDisciplines, setHoverText, setInventoryActions, showMessage } from "./ui";
import { masteryName } from "../../shared/crafting";
import type { Belt, ToolType } from "../../shared/tools";
import { NPCS, npcAt } from "../../shared/npcs";
import { DISCIPLINES, DisciplineId, DisciplineView, SkillId, SkillXp, emptySkills, findSkill, isUnlocked, levelForXp } from "../../shared/disciplines";
import { ItemMasteryXp, MasteryId } from "../../shared/mastery";
import { showLogin } from "./login";
import { setTreeActions } from "./tree";
import { nightSightOn, renderTreeRanks, setBuffs, setDiscovered, setServerOffset, tickBuffs } from "./ui";
import type { TreeRanks } from "../../shared/skilltree";
import type { QuestView } from "../../shared/quests";
import type { ShopId } from "../../shared/shops";
import type { RepairJob } from "../../shared/repair";
import type { Buffs, PotionType } from "../../shared/alchemy";
import type { Jewels } from "../../shared/jewelry";
import { renderJewels, setGemActions, setSpellbook, castSlot, setAltarActions } from "./ui";
import type { BoltSpellId } from "../../shared/combat";
import { TRAP_BLINK_SECONDS } from "../../shared/spells";
import { CROPS, LOTS, LOT_SIZE, decodeCrop, growth, inPlot, lotAt, tileOf, timeLeft } from "../../shared/farming";
import { serverNow, setFarm, setFarmActions } from "./ui";
import type { FarmView } from "../../shared/farming";
import type { RenownView } from "../../shared/renown";
import { setRenown, setRenownActions, renderParty, setPartyActions, showPartyInvite, addPartyChat, PartyMember } from "./ui";
import { NIGHT_DARKNESS, darkness, isNight, minutesUntilChange } from "../../shared/daynight";

interface MonsterView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  status: Phaser.GameObjects.Text;
  /** Soul trap's purple glow. */
  glow: Phaser.GameObjects.Ellipse;
  tween?: Phaser.Tweens.Tween;
}

interface PlayerView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  tween?: Phaser.Tweens.Tween;
  chopTween?: Phaser.Tweens.Tween;
  line?: Phaser.GameObjects.Container; // fishing line, while fishing
  bar: Phaser.GameObjects.Graphics; // health bar (shown once hurt)
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const TAP_SLOP = 12; // px a finger can wobble and still count as a tap
const ZOOM_KEY = "rpg.zoom";

interface TreeView { tree: Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown }; stump: Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown } }
/** Outdoors the sea shows past the map's edge; inside places float in black. */
const SEA = 0x2d6fa3;

export class WorldScene extends Phaser.Scene {
  private room?: Room;
  private players = new Map<string, PlayerView>();
  private monsters = new Map<string, MonsterView>();
  private trees = new Map<string, TreeView>();
  private rocks = new Map<string, TreeView>(); // same idea: full rock, or emptied
  private patches = new Map<string, TreeView>(); // dig patches: glinting mound, or dug out
  private marker!: Phaser.GameObjects.Text;
  private hud = document.getElementById("hud")!;
  // Touch gesture state
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private gestureWasPinch = false;
  private lastDisciplines?: DisciplineView;
  private skillXpSeen = false; // the first skill XP after logging in isn't "gained"
  private skillXp: SkillXp = emptySkills();
  /** The ❗ over each person who has a lesson for you (the server says who, with the quest tracker). */
  private alerts = new Map<string, Phaser.GameObjects.Text>();
  /** Night: a dark blue layer over the world. */
  private nightShade!: Phaser.GameObjects.Rectangle;
  /** Server clock minus ours, so everyone's day and night match. */
  private clockOffset = 0;
  private wasNight: boolean | null = null;
  /** One layer per area (the outdoors, each building and cave): only the one you're in is shown. */
  private areaLayers = new Map<string, Phaser.GameObjects.Layer>();
  /** The area you're in now. */
  private here: AreaDef = OUTDOORS;

  constructor() { super("world"); }

  async create() {
    this.drawMap();
    this.drawNpcs();
    this.showArea(OUTDOORS);
    this.nightShade = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE + 8000, MAP_HEIGHT * TILE_SIZE + 8000, 0x0a1238, 1)
      .setDepth(450);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateDaylight() });
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.redrawPlots() });
    const clock = document.getElementById("clock");
    if (clock) clock.onclick = () => showMessage(clock.title);
    this.updateDaylight();
    this.marker = this.add.text(0, 0, "✕", { fontSize: "20px", color: "#ffeb3b" })
      .setOrigin(0.5).setDepth(500).setVisible(false);
    // No camera bounds: the camera stays centred on you, and past the map edge
    // the background is the same colour as the sea, so the island just floats.
    this.cameras.main.centerOn(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2);
    this.setupZoom();
    setWorldMapActions();
    renderBag(emptyBag(0));

    // A mouse click acts the moment you press. A finger acts on release, so a
    // pinch or a wobbly finger isn't read as a tap.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => { if (this.room && !p.wasTouch && p.leftButtonDown()) this.onClick(p); });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => { if (this.room && p.wasTouch) this.onPointerUp(p); });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => { if (this.room && !p.wasTouch) this.onHover(p); });
    this.input.on("gameout", () => setHoverText(null));
    // Coming back from another app: the browser paused the game while it was hidden.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.onResume(); });

    this.hud.textContent = "Log in to play";
    this.attach(await showLogin(joinWorld));
  }

  /** Hook the scene up to a joined room (first login, or after reconnecting). */
  private attach(room: Room, reconnected = false) {
    this.room = room;
    room.onMessage("message", (text: string) => showMessage(text));
    room.onMessage("disciplines", (disciplines: DisciplineView) => {
      this.lastDisciplines = disciplines;
      renderDisciplines(disciplines);
    });
    room.onMessage("levelup", (msg: { discipline: DisciplineId; level: number }) => this.celebrateLevelUp(msg.discipline));
    room.onMessage("skillxp", (skillXp: SkillXp) => {
      // Floating "+2 Fishing XP" over your head whenever you earn XP.
      if (this.skillXpSeen) {
        for (const id of Object.keys(skillXp) as SkillId[]) {
          const gained = skillXp[id] - (this.skillXp[id] ?? 0);
          if (gained > 0) this.floatText(`+${gained} ${findSkill(id).def.name} XP`, "#9be28a");
        }
      }
      this.skillXpSeen = true;
      this.skillXp = skillXp;
      renderSkillXp(skillXp);
    });
    room.onMessage("mastery", (mastery: ItemMasteryXp) => renderMastery(mastery));
    room.onMessage("skillup", (msg: { skill: SkillId; level: number }) => this.celebrateSkill(msg.skill, msg.level));
    room.onMessage("masteryup", (msg: { resource: MasteryId; level: number }) => this.celebrateMastery(msg.resource, msg.level));
    setInventoryActions({
      drop: (slot) => room.send("drop", { slot }),
      sell: (slot, count) => room.send("sell", { slot, count }),
      sellAll: () => room.send("sellAll"),
      lock: (slot, locked) => room.send("lock", { slot, locked }),
      equip: (slot) => room.send("equip", { slot }),
      unequip: (type: ToolType) => room.send("unequip", { type }),
      buy: (item, count) => room.send("buy", { item, count }),
      craft: (item, all) => room.send("craft", { item, all }),
      eat: (slot) => room.send("eat", { slot }),
      wear: (slot) => room.send("wear", { slot }),
      remove: (slot) => room.send("remove", { slot }),
      drink: (slot) => room.send("drink", { slot }),
      spell: (id) => room.send("spell", { id }),
      cast: (id) => room.send("cast", { id }),
      spellBar: (bar) => room.send("spellBar", { bar }),
      read: (slot) => room.send("read", { slot }),
      sort: () => room.send("sortInventory"),
      move: (from, to) => room.send("moveItem", { from, to }),
    });
    setTreeActions({
      buy: (node) => room.send("treeBuy", { node }),
      reset: (skill) => room.send("treeReset", { skill }),
    });
    room.onMessage("tree", (ranks: TreeRanks) => renderTreeRanks(ranks));
    room.onMessage("discovered", (list: PotionType[]) => setDiscovered(list));
    room.onMessage("buffs", (b: Buffs) => { setBuffs(b); this.updateDaylight(); });
    room.onMessage("jewels", (j: Jewels) => renderJewels(j));
    setAltarActions({
      enchant: (msg) => room.send("enchant", msg),
      disenchant: (slot) => room.send("disenchant", { slot }),
    });
    setGemActions({
      cut: (item) => room.send("cut", { item }),
      wearJewel: (slot) => room.send("wearJewel", { slot }),
      removeJewel: (slot) => room.send("removeJewel", { slot }),
    });
    setQuestActions({ track: (bounty) => room.send("track", bounty == null ? {} : { bounty }) });
    setAccountActions({
      rename: (name) => room.send("rename", { name }),
      password: (current, next) => room.send("setPassword", { current, next }),
      color: (color) => room.send("setColor", { color }),
      signOut: () => void this.signOut(),
    });
    room.onMessage("tracked", (msg: { item: ItemId | null }) => renderTracked(msg.item));
    room.onMessage("account", (msg: { ok: boolean; text: string; name: string }) => accountResult(msg.ok, msg.text, msg.name));
    setBountyActions({
      handIn: (index) => room.send("handIn", { index }),
      refresh: () => room.send("refreshBounties"),
    });
    room.onMessage("bounties", (msg: { bounties: Bounty[]; open: boolean }) => {
      if (msg.open) this.marker.setVisible(false);
      showBounties(msg.bounties, msg.open);
    });
    room.onMessage("quest", (q: QuestView) => {
      this.alerts.forEach((a, id) => a.setVisible(q.marks.includes(id as never)));
      setWorldMapMarks(q.marks);
      renderQuest(q);
    });
    room.onMessage("clock", (msg: { now: number }) => {
      this.clockOffset = msg.now - Date.now();
      setServerOffset(this.clockOffset);
      this.wasNight = null;
      this.updateDaylight();
    });
    room.onMessage("questDone", () => this.floatText("Quest complete!", "#ffd84a", true));
    room.onMessage("vitals", (v: { hp: number; maxHp: number; mana: number; maxMana: number }) => renderVitals(v.hp, v.maxHp, v.mana, v.maxMana));
    room.onMessage("gear", (msg: { gear: Gear; spell: BoltSpellId }) => renderGear(msg.gear, msg.spell));
    room.onMessage("spellbook", (b: Parameters<typeof setSpellbook>[0]) => setSpellbook(b));
    // Parties (stage 13).
    room.onMessage("partyInvite", (msg: { from: string }) => showPartyInvite(msg.from));
    room.onMessage("partyChat", (msg: { from: string; text: string }) => addPartyChat(msg.from, msg.text));
    setPartyActions({
      answer: (yes) => room.send("partyAnswer", { yes }),
      leave: () => room.send("partyLeave"),
      kick: (id) => room.send("partyKick", { id }),
      chat: (text) => room.send("partyChat", { text }),
    });
    // Number keys 1-8 cast the spell in that slot of the spell bar (not while typing in a box).
    window.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key >= "1" && e.key <= "8" && !e.ctrlKey && !e.metaKey && !e.altKey) castSlot(Number(e.key) - 1);
    });
    // Soul trap glows: steady, then blinking for the last few seconds.
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.updateTrapGlows() });
    room.onMessage("combatmastery", (m: CombatMasteryXp) => renderCombatMastery(m));
    room.onMessage("combatmasteryup", (msg: { id: CombatMasteryId; level: number }) => {
      this.time.delayedCall(700, () => this.floatText(`${combatMasteryName(msg.id)} Mastery ${msg.level}!`, "#7fd0ff"));
      flashCombatMastery(msg.id);
    });
    room.onMessage("hit", (h: { on: "monster" | "player"; id: string; damage: number; miss: boolean; spell: SpellId | null; from: string }) => this.showHit(h));
    room.onMessage("died", () => this.showDeath());
    room.onMessage("dialog", (msg: { name: string; lines: string[] }) => {
      this.marker.setVisible(false);
      openDialog(msg.name, msg.lines);
    });
    room.onMessage("stamina", (msg: { stamina: number; max: number }) => renderStamina(msg.stamina, msg.max));
    room.onMessage("belt", (belt: Belt) => renderBelt(belt));
    room.onMessage("station", (msg: { npc: string }) => {
      this.marker.setVisible(false);
      openCraft(msg.npc);
    });
    setGuildActions({
      buySpace: () => room.send("buyChestSpace"),
      deposit: (slot, count) => room.send("deposit", { slot, count }),
      withdraw: (slot, count) => room.send("withdraw", { slot, count }),
      handIn: (index) => room.send("guildHandIn", { index }),
      refresh: () => room.send("refreshGuild"),
    });
    room.onMessage("guild", (g: GuildView & { open: boolean }) => {
      if (g.open) this.marker.setVisible(false);
      showGuild(g, g.open);
    });
    room.onMessage("chest", (c: Bag & { open: boolean }) => {
      if (c.open) this.marker.setVisible(false);
      showChest(c, c.open);
    });
    room.onMessage("guildRank", (msg: { rank: string }) => this.floatText(`Guild ${msg.rank}!`, "#c9a2ff", true));
    room.onMessage("bag", (bag: Bag) => renderBag(bag));
    room.onMessage("coins", (coins: number) => renderCoins(coins));
    room.onMessage("repair", (view: { jobs: RepairJob[]; free: boolean; open: boolean }) => {
      if (view.open) this.marker.setVisible(false);
      showRepairs(view);
    });
    setRepairActions({
      repair: (where, key) => this.room?.send("repair", { where, key }),
      repairAll: () => this.room?.send("repairAll"),
    });
    room.onMessage("farm", (view: FarmView) => setFarm(view));
    room.onMessage("renown", (view: RenownView) => setRenown(view));
    setRenownActions({ title: (title) => room.send("title", { title }) });
    setFarmActions({
      buy: () => room.send("farmBuy"),
      chest: () => room.send("farmChest"),
      seed: (item) => room.send("seed", { item }),
    });
    room.onMessage("shop", (msg: { npc: ShopId }) => {
      this.marker.setVisible(false);
      openShop(msg.npc);
    });
    this.listenToState(room);
    room.send("ready", { reconnected });
    room.onLeave((code: number) => {
      if (this.room !== room) return;
      this.room = undefined;
      // 1000 = we left on purpose. Anything else: the connection dropped, so get it back.
      if (code === 1000) this.hud.textContent = "Disconnected from server.";
      else void this.recover(room.reconnectionToken);
    });
  }

  /**
   * The connection dropped (phone switched apps, Wi-Fi blip). Keep trying to
   * rejoin as the same character for up to 2 minutes; after that, log in again.
   */
  private async recover(token: string) {
    closeShop();
    closeRepair();
    closeCraft();
    closeInfo();
    closeDialog();
    const started = Date.now();
    for (let wait = 500; Date.now() - started < 110_000; wait = Math.min(wait * 2, 8000)) {
      this.hud.textContent = "Reconnecting…";
      try {
        const room = await rejoinWorld(token);
        this.clearWorld();
        this.attach(room, true);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    this.clearWorld();
    this.hud.textContent = "Log in to play";
    this.attach(await showLogin(joinWorld));
  }

  /** ⚙️ Settings > Sign out: leave the world and show the login box again. */
  private async signOut() {
    const room = this.room;
    if (!room) return;
    this.room = undefined; // so onLeave doesn't try to reconnect
    try { await room.leave(true); } catch { /* already gone */ }
    this.clearWorld();
    resetForSignOut();
    this.hud.textContent = "Log in to play";
    this.attach(await showLogin(joinWorld));
  }

  /** Forget everything the old connection showed, so the new one can draw it fresh. */
  private clearWorld() {
    this.cameras.main.stopFollow();
    this.players.forEach((v) => v.container.destroy());
    this.players.clear();
    this.monsters.forEach((v) => v.container.destroy());
    this.monsters.clear();
    for (const key of [...this.trees.keys(), ...this.rocks.keys(), ...this.patches.keys()]) this.setStump(key, false);
    this.marker.setVisible(false);
    this.lastDisciplines = undefined;
    this.skillXpSeen = false;
  }

  /**
   * Back from another app. The browser froze the game while it was hidden, so
   * half-finished walking animations and finger presses are stale: snap
   * everyone to where they really are and forget any touch that was down.
   */
  private onResume() {
    this.input.manager.pointers.forEach((p) => p.reset());
    this.pinchStartDist = 0;
    this.gestureWasPinch = false;
    const room = this.room;
    if (!room) return;
    room.state.players.forEach((player: any, sessionId: string) => {
      const view = this.players.get(sessionId);
      if (!view) return;
      view.tween?.stop();
      const [tx, ty] = this.tileCenter(player.x, player.y);
      view.container.setPosition(tx, ty);
    });
  }

  /** The layer for whatever area a tile is in (things in the gaps between areas go outdoors). */
  private layerAt(x: number, y: number): Phaser.GameObjects.Layer {
    return this.areaLayers.get(areaAt(x, y)?.id ?? OUTDOORS.id)!;
  }

  /** Put a game object on the layer of the area at tile (x, y). */
  private put<T extends Phaser.GameObjects.GameObject>(obj: T, x: number, y: number): T {
    this.layerAt(x, y).add(obj);
    return obj;
  }

  /**
   * Draw the world: each area gets its own layer with a tilemap for the ground,
   * and pictures for trees, rocks, dig patches and fishing spots on top.
   */
  private drawMap() {
    const tileIndex = buildTileset(this);
    const [patch, dug] = patchTextures(this);
    const stump = stumpTexture(this);
    const emptyRock = emptyRockTexture(this);
    for (const a of AREAS) {
      const layer = this.add.layer().setDepth(0).setVisible(false);
      this.areaLayers.set(a.id, layer);
      const data: number[][] = [];
      for (let y = a.y; y < a.y + a.h; y++) {
        const row: number[] = [];
        for (let x = a.x; x < a.x + a.w; x++) row.push(tileIndex(x, y));
        data.push(row);
      }
      const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
      const tiles = map.addTilesetImage("tiles", "tiles", TILE_SIZE, TILE_SIZE, 0, 0)!;
      const ground = map.createLayer(0, tiles, a.x * TILE_SIZE, a.y * TILE_SIZE)!;
      layer.add(ground.setDepth(0));
      for (let y = a.y; y < a.y + a.h; y++) {
        for (let x = a.x; x < a.x + a.w; x++) {
          const t = MAP[y][x];
          const px = x * TILE_SIZE, py = y * TILE_SIZE;
          if (t === "tree") {
            const tree = layer.add(this.make.image({ x: px, y: py, key: treeTexture(this, nodeAt(x, y)!) }, false).setOrigin(0).setDepth(10 + y)) as Phaser.GameObjects.Image;
            const st = layer.add(this.make.image({ x: px, y: py, key: stump }, false).setOrigin(0).setDepth(10 + y).setVisible(false)) as Phaser.GameObjects.Image;
            this.trees.set(treeKey(x, y), { tree, stump: st });
          } else if (t === "rock") {
            const rock = layer.add(this.make.image({ x: px, y: py, key: rockTexture(this, nodeAt(x, y)!) }, false).setOrigin(0).setDepth(10 + y)) as Phaser.GameObjects.Image;
            const empty = layer.add(this.make.image({ x: px, y: py, key: emptyRock }, false).setOrigin(0).setDepth(10 + y).setVisible(false)) as Phaser.GameObjects.Image;
            this.rocks.set(treeKey(x, y), { tree: rock, stump: empty });
          } else if (t === "dig") {
            this.patches.set(treeKey(x, y), this.makeDigPatch(layer, px, py, y, patch, dug));
          }
        }
      }
      for (const f of fishingSpotsIn(a)) this.makeFishingSpot(layer, f.x * TILE_SIZE, f.y * TILE_SIZE, f.type);
    }
    // Name signs over the doors of shops, trainers and caves.
    for (const d of DOORS) {
      if (!d.sign) continue;
      const [sx, sy] = this.tileCenter(d.x, d.y);
      this.put(this.add.text(sx, sy - 24, d.sign, { fontSize: "11px", color: "#ffe9b8", stroke: "#000", strokeThickness: 3, backgroundColor: "#4a2e14cc", padding: { x: 3, y: 1 } })
        .setOrigin(0.5).setDepth(12 + d.y), d.x, d.y);
    }
  }

  /** Show only the area you're in (its layer), with the right background and lighting. */
  private showArea(a: AreaDef) {
    this.here = a;
    this.areaLayers.forEach((layer, id) => layer.setVisible(id === a.id));
    this.cameras.main.setBackgroundColor(a.kind === "outdoor" ? SEA : 0x000000);
    this.updateDaylight();
    updateWorldMap(this.myTile(), a);
  }

  /** Your tile, if you're in the world. */
  private myTile(): { x: number; y: number } | null {
    const me = this.room?.state.players.get(this.room.sessionId);
    return me ? { x: me.x, y: me.y } : null;
  }

  private drawNpcs() {
    for (const npc of NPCS) {
      if (npc.kind === "station") { this.drawStation(npc.id, npc.x, npc.y, npc.name); continue; }
      const [cx, cy] = this.tileCenter(npc.x, npc.y);
      const c = this.put(this.add.container(cx, cy).setDepth(10 + npc.y + 0.5), npc.x, npc.y);
      const shadow = this.add.ellipse(0, 10, 20, 8, 0x000000, 0.3);
      const body = this.add.circle(0, 0, 10, npc.color).setStrokeStyle(2, 0x000000);
      const hat = this.add.graphics();
      if (npc.id === "maren") {
        // A grey bun of hair and a straw sun hat.
        hat.fillStyle(0xd9d4c7).fillCircle(0, -9, 5);
        hat.fillStyle(0xe8c56a).fillEllipse(0, -11, 24, 5).fillRect(-6, -17, 12, 6);
        hat.fillStyle(0x2e86c1).fillRect(-6, -13, 12, 2);
      } else if (["aldric", "celene", "oren", "lisette", "tomas", "wynne"].includes(npc.id)) {
        // The Lightkeepers' white hoods, trimmed with gold.
        // A hood drawn up over the head, with the face peeking out.
        hat.fillStyle(0xf7f3e8).fillCircle(0, -3, 11).lineStyle(1.5, 0xd4a640).strokeCircle(0, -3, 11);
        hat.fillStyle(0xf1c9a0).fillCircle(0, -1, 6);
        hat.fillStyle(0x3b2410).fillCircle(-2, -2, 1).fillCircle(2, -2, 1);
        if (npc.id === "aldric") hat.fillStyle(0xffd84a).fillCircle(0, -12, 2.5);
      } else if (npc.id === "vale") {
        // A deep violet cowl with a pale gem.
        hat.fillStyle(0x3b2a6a).fillCircle(0, -3, 11);
        hat.fillStyle(0xe0b48a).fillCircle(0, -1, 6);
        hat.fillStyle(0x1b1030).fillCircle(-2, -2, 1).fillCircle(2, -2, 1);
        hat.fillStyle(0xbfe8ff).fillCircle(0, -11, 2);
      } else if (npc.id === "archmage") {
        // A tall pointed wizard's hat with a star on it.
        hat.fillStyle(0x2d1b5e).fillEllipse(0, -10, 24, 5).fillTriangle(-8, -10, 8, -10, 2, -30);
        hat.fillStyle(0xffd84a).fillCircle(0, -17, 1.8);
      } else {
        hat.fillStyle(0x3b2410).fillRect(-9, -12, 18, 3).fillRect(-6, -18, 12, 7);
      }
      const badge = this.add.text(11, 2, npc.badge ?? "", { fontSize: "13px" }).setOrigin(0.5);
      const label = this.add.text(0, npc.id === "repairer" || npc.id === "wren" ? 24 : -28, npc.name, {
        fontSize: "12px", color: "#7fe0ff", stroke: "#000", strokeThickness: 3,
      }).setOrigin(0.5);
      c.add([shadow, body, hat, badge, label]);
      // A little idle bob so they look alive.
      this.tweens.add({ targets: [body, hat], y: "-=2", duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      // ❗ when they have a lesson for you (the server says who, with the quest tracker).
      const alert = this.add.text(0, -46, "❗", { fontSize: "18px" }).setOrigin(0.5).setVisible(false);
      c.add(alert);
      this.alerts.set(npc.id, alert);
      this.tweens.add({ targets: alert, y: -50, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  /** The furnace (glowing fire) and the anvil in Brann's smithy, the stove (pot on top) by Maren, and the other stations. */
  private drawStation(id: string, x: number, y: number, name: string) {
    const [cx, cy] = this.tileCenter(x, y);
    const c = this.put(this.add.container(cx, cy).setDepth(10 + y + 0.5), x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillEllipse(0, 11, 26, 8);
    if (id === "heart_shrine") {
      // A great crystal on a stone base, pouring out golden light.
      const halo = this.add.circle(0, -8, 26, 0xffe27a, 0.25);
      g.fillStyle(0xbdb6a0).fillRect(-14, 0, 28, 10);
      g.fillStyle(0xd8d2c2).fillRect(-11, -4, 22, 5);
      g.fillStyle(0xfff2b0).fillTriangle(-8, -2, 0, -30, 8, -2);
      g.fillStyle(0xffffff, 0.8).fillTriangle(-2, -6, 0, -24, 3, -6);
      c.add([halo, g]);
      this.tweens.add({ targets: halo, scale: 1.25, alpha: 0.1, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    } else if (id === "plinth") {
      g.fillStyle(0xbdb6a0).fillRect(-11, -6, 22, 16);
      g.fillStyle(0xd8d2c2).fillRect(-13, -9, 26, 4);
      g.lineStyle(1, 0x6a6458).lineBetween(-6, 2, 6, 4).lineBetween(-5, 4, 4, 1);
      c.add(g);
    } else if (id === "furnace") {
      g.fillStyle(0x6e3b25).fillRect(-12, -12, 24, 22);
      g.lineStyle(1, 0x3b1f12);
      for (let row = -12; row < 10; row += 5) g.lineBetween(-12, row, 12, row);
      g.fillStyle(0x3b1f12).fillRect(-4, -18, 8, 6); // chimney
      g.fillStyle(0x1a0d06).fillRoundedRect(-7, -2, 14, 10, 3);
      const fire = this.add.ellipse(0, 4, 10, 7, 0xff8a1f);
      const glow = this.add.ellipse(0, 3, 6, 4, 0xffe066);
      c.add([g, fire, glow]);
      this.tweens.add({ targets: [fire, glow], scaleY: 1.3, alpha: 0.75, duration: 300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    } else if (id === "stove") {
      g.fillStyle(0x2f2f33).fillRect(-12, -6, 24, 16); // iron stove body
      g.fillStyle(0x45454b).fillRect(-13, -8, 26, 3);
      g.fillStyle(0x1a1a1d).fillRoundedRect(-6, 0, 12, 7, 2); // fire door
      g.fillStyle(0x8e969d).fillRect(-8, -16, 16, 8).fillRect(-10, -17, 20, 2); // pot
      g.fillStyle(0x8e969d).fillRect(-12, -14, 3, 2).fillRect(9, -14, 3, 2); // pot handles
      const fire = this.add.ellipse(0, 4, 8, 4, 0xff8a1f);
      const steam = this.add.ellipse(0, -21, 6, 4, 0xffffff, 0.6);
      c.add([g, fire, steam]);
      this.tweens.add({ targets: fire, alpha: 0.5, duration: 350, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: steam, y: -30, alpha: 0, scaleX: 1.8, duration: 1400, repeat: -1 });
    } else if (id === "alchemy_table") {
      // A dark table with bubbling flasks.
      g.fillStyle(0x3b2a4a).fillRect(-12, -2, 3, 12).fillRect(9, -2, 3, 12);
      g.fillStyle(0x5a4470).fillRect(-14, -8, 28, 7);
      g.fillStyle(0x7fe0a0, 0.9).fillCircle(-7, -12, 4).fillRect(-8, -19, 2, 5);
      g.fillStyle(0xd6443a, 0.9).fillTriangle(1, -9, 9, -9, 5, -17);
      g.fillStyle(0x9ad1ff, 0.9).fillRect(10, -16, 3, 8);
      const bubble = this.add.circle(-7, -18, 1.6, 0xc8ffd8);
      c.add([g, bubble]);
      this.tweens.add({ targets: bubble, y: -26, alpha: 0, duration: 1200, repeat: -1 });
    } else if (id === "altar") {
      // A stone altar with a glowing purple rune on top.
      g.fillStyle(0x4a4458).fillRect(-11, -6, 22, 16);
      g.fillStyle(0x6a6378).fillRect(-14, -10, 28, 5);
      g.fillStyle(0x2e2a38).fillRect(-11, 4, 22, 2);
      const rune = this.add.star(0, -15, 5, 2.5, 6, 0xc39bff);
      const halo = this.add.circle(0, -15, 8, 0xa25bff, 0.35);
      c.add([g, halo, rune]);
      this.tweens.add({ targets: [rune, halo], alpha: 0.4, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: rune, angle: 360, duration: 6000, repeat: -1 });
    } else if (id === "workbench") {
      // A wooden bench on legs, with a jar of worms and a little bundle of thread.
      g.fillStyle(0x5c3a1a).fillRect(-12, -2, 3, 12).fillRect(9, -2, 3, 12); // legs
      g.fillStyle(0x9a6b3a).fillRect(-14, -8, 28, 7); // top
      g.fillStyle(0x6e4a24).fillRect(-14, -2, 28, 2);
      g.fillStyle(0xcfe8ef, 0.85).fillRect(-10, -16, 7, 8); // jar
      g.fillStyle(0xd98a8a).fillRect(-9, -11, 5, 2); // worms in it
      g.fillStyle(0xf2e6c9).fillCircle(6, -11, 3); // thread
      g.lineStyle(1, 0x8b5a2b).strokeCircle(6, -11, 3);
      c.add(g);
    } else if (id === "tanning_rack") {
      // A wooden frame with a hide stretched across it.
      g.fillStyle(0x5c3a1a).fillRect(-12, -20, 3, 30).fillRect(9, -20, 3, 30).fillRect(-12, -20, 24, 2).fillRect(-12, 4, 24, 2);
      g.fillStyle(0xb07a4a).fillRoundedRect(-8, -17, 16, 19, 4);
      g.lineStyle(1, 0x5c3a1a).lineBetween(-9, -15, -8, -15).lineBetween(8, -15, 9, -15).lineBetween(-9, 0, -8, 0).lineBetween(8, 0, 9, 0);
      c.add(g);
    } else if (id === "spinning_wheel") {
      // A spinning wheel that slowly turns.
      g.fillStyle(0x5c3a1a).fillRect(-10, 2, 20, 3).fillRect(-9, 2, 2, 9).fillRect(7, 2, 2, 9).fillRect(-1, -8, 2, 11);
      g.fillStyle(0xf2e6c9).fillCircle(10, -2, 3);
      const wheel = this.add.graphics({ x: 0, y: -10 });
      wheel.lineStyle(2, 0x8b5a2b).strokeCircle(0, 0, 9);
      wheel.lineStyle(1, 0x8b5a2b).lineBetween(-9, 0, 9, 0).lineBetween(0, -9, 0, 9).lineBetween(-6, -6, 6, 6).lineBetween(-6, 6, 6, -6);
      c.add([g, wheel]);
      this.tweens.add({ targets: wheel, angle: 360, duration: 4000, repeat: -1 });
    } else if (id.startsWith("chest")) {
      // A purple chest with gold bands and a glowing keyhole.
      g.fillStyle(0x4a2a7a).fillRoundedRect(-12, -10, 24, 18, 3);
      g.fillStyle(0x6a3fb5).fillRoundedRect(-12, -14, 24, 7, 3);
      g.fillStyle(0xd4a640).fillRect(-12, -7, 24, 2).fillRect(-8, -14, 2, 22).fillRect(6, -14, 2, 22);
      const glow = this.add.circle(0, -3, 2.5, 0xb9f2ff);
      c.add([g, glow]);
      this.tweens.add({ targets: glow, alpha: 0.3, scale: 1.6, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    } else if (id === "board" || id === "guildboard") {
      // A wooden notice board on two posts, with papers pinned to it.
      g.fillStyle(0x5c3a1a).fillRect(-11, -4, 3, 15).fillRect(8, -4, 3, 15); // posts
      g.fillStyle(id === "guildboard" ? 0x5b2c9f : 0x8b5a2b).fillRect(-14, -18, 28, 16); // board (purple for the guild)
      g.lineStyle(2, 0x5c3a1a).strokeRect(-14, -18, 28, 16);
      g.fillStyle(0x4a2e14).fillTriangle(-16, -18, 16, -18, 0, -24); // little roof
      g.fillStyle(0xf2e6c9).fillRect(-11, -16, 7, 9).fillRect(-2, -15, 6, 8).fillRect(6, -16, 6, 10); // notices
      g.fillStyle(0xc0392b).fillCircle(-7.5, -15, 1).fillCircle(1, -14, 1).fillCircle(9, -15, 1); // pins
      c.add(g);
    } else {
      g.fillStyle(0x3b2410).fillRect(-6, 0, 12, 10); // wooden stump
      g.fillStyle(0x50565c).fillRect(-6, -6, 12, 6);
      g.fillStyle(0x6c737a).fillRect(-13, -12, 24, 7).fillTriangle(11, -12, 11, -5, 16, -11);
      g.fillStyle(0x9aa3ab).fillRect(-12, -12, 22, 2);
      c.add(g);
    }
    // In the guild hall the stations stand close to the Archmage, so their names go underneath.
    const below = id === "spinning_wheel" || id === "chest" || id === "guildboard" || id === "alchemy_table" || id === "altar" || id === "furnace" || id === "anvil" || id === "workbench";
    const label = this.add.text(0, below ? 22 : id === "board" ? -32 : -28, name, { fontSize: "12px", color: "#ffd84a", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5);
    c.add(label);
  }

  /** A special fishing spot: little ripples in the fish's colour. */
  private makeFishingSpot(layer: Phaser.GameObjects.Layer, px: number, py: number, type: ResourceId) {
    const color = RESOURCES[type].color;
    const g = this.make.graphics({ x: px, y: py }, false).setDepth(5);
    g.lineStyle(1.5, color, 0.9).strokeEllipse(16, 16, 18, 8);
    g.lineStyle(1, color, 0.6).strokeEllipse(16, 16, 26, 12);
    g.fillStyle(0xffffff, 0.8).fillCircle(12, 14, 1.2).fillCircle(20, 17, 1);
    layer.add(g);
    this.tweens.add({ targets: g, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: (px + py) % 700 });
  }

  /** A dig patch: a mound of turned earth with a twinkle on it. Dug out, it's a flat dark hole. */
  private makeDigPatch(layer: Phaser.GameObjects.Layer, px: number, py: number, row: number, patch: string, dug: string): TreeView {
    const tree = this.make.image({ x: px, y: py, key: patch }, false).setOrigin(0).setDepth(5);
    const glint = this.make.text({ x: px + 21, y: py + 9, text: "✦", style: { fontSize: "11px", color: "#fff6b0", stroke: "#8a6a10", strokeThickness: 2 } }, false).setOrigin(0.5).setDepth(6 + row);
    this.tweens.add({ targets: glint, alpha: 0.15, scale: 0.6, duration: 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: (px * 3 + py) % 900 });
    const stump = this.make.image({ x: px, y: py, key: dug }, false).setOrigin(0).setDepth(5).setVisible(false);
    layer.add([tree, glint, stump]);
    // Hide the glint along with the mound.
    const show = tree.setVisible.bind(tree);
    tree.setVisible = (v: boolean) => { glint.setVisible(v); return show(v); };
    return { tree, stump };
  }

  private isFullPatch(x: number, y: number) {
    return this.patches.has(treeKey(x, y)) && !this.room?.state.depleted.has(treeKey(x, y));
  }

  private setStump(key: string, isStump: boolean) {
    const t = this.trees.get(key) ?? this.rocks.get(key) ?? this.patches.get(key);
    if (!t) return;
    t.tree.setVisible(!isStump);
    t.stump.setVisible(isStump);
  }

  private listenToState(room: Room) {
    const $ = getStateCallbacks(room);

    $(room.state).depleted.onAdd((_respawnAt: number, key: string) => this.setStump(key, true));
    $(room.state).depleted.onRemove((_respawnAt: number, key: string) => this.setStump(key, false));

    $(room.state).players.onAdd((player: any, sessionId: string) => {
      const isMe = sessionId === room.sessionId;
      const container = this.add.container(...this.tileCenter(player.x, player.y)).setDepth(10 + player.y);
      const shadow = this.add.ellipse(0, 10, 20, 8, 0x000000, 0.3);
      const body = this.add.circle(0, 0, 10, player.color).setStrokeStyle(2, isMe ? 0xffffff : 0x000000);
      const label = this.add.text(0, -24, player.name, {
        fontSize: "12px", color: isMe ? "#ffeb3b" : "#ffffff", stroke: "#000", strokeThickness: 3,
      }).setOrigin(0.5);
      const bar = this.add.graphics();
      // An earned title (shared/renown.ts), small and gold, over the name.
      const title = this.add.text(0, -37, player.title ? `« ${player.title} »` : "", {
        fontSize: "10px", color: "#ffd84a", fontStyle: "italic", stroke: "#000", strokeThickness: 3,
      }).setOrigin(0.5);
      container.add([shadow, body, label, bar, title]);
      this.put(container, player.x, player.y);
      const view: PlayerView = { container, body, label, bar };
      this.players.set(sessionId, view);

      if (isMe) {
        this.cameras.main.startFollow(container, true, 0.15, 0.15);
        const a = areaAt(player.x, player.y) ?? OUTDOORS;
        if (a !== this.here) this.showArea(a);
        else updateWorldMap({ x: player.x, y: player.y }, a);
      }

      // Positions update once per server tick; glide to the new tile over one tick.
      $(player).listen("x", () => this.moveTo(view, player, isMe));
      $(player).listen("y", () => this.moveTo(view, player, isMe));
      $(player).listen("action", (action: string) => this.setAction(view, player, action));
      $(player).listen("hp", () => { this.drawHealth(view.bar, player.hp, player.maxHp, -16); this.refreshParty(); });
      $(player).listen("maxHp", () => { this.drawHealth(view.bar, player.hp, player.maxHp, -16); this.refreshParty(); });
      // Parties (stage 13): party members' names show green, and the 🚩 panel lists everyone's health.
      $(player).listen("party", () => this.refreshParty());
      $(player).listen("partyLead", () => this.refreshParty());
      // Settings: a new name or colour shows up for everyone.
      $(player).listen("color", (color: number) => { view.body.setFillStyle(color); if (isMe) renderMe(player.name, color); });
      // Invisibility: you see yourself faded; others barely see you at all.
      $(player).listen("invisible", (inv: boolean) => view.container.setAlpha(inv ? (isMe ? 0.4 : 0.12) : 1));
      $(player).listen("title", (t: string) => title.setText(t ? `« ${t} »` : ""));
      $(player).listen("name", (name: string) => { view.label.setText(name); this.refreshParty(); if (isMe) { renderMe(name, player.color); this.updateHud(); } });
      this.updateHud();
    });

    $(room.state).monsters.onAdd((m: any, id: string) => this.addMonster(m, id, $));

    // Farm plots (shared/farming.ts): everyone sees everyone's.
    $(room.state).plots.onAdd((plot: any, key: string) => {
      this.plots.set(key, plot);
      const redraw = () => this.drawPlot(key);
      $(plot).listen("w", redraw);
      $(plot).listen("h", redraw);
      $(plot).listen("owner", redraw);
      $(plot).crops.onChange(redraw);
      redraw();
    });
    $(room.state).plots.onRemove((_plot: any, key: string) => { this.plots.delete(key); this.drawPlot(key); });

    $(room.state).players.onRemove((_player: any, sessionId: string) => {
      this.players.get(sessionId)?.container.destroy();
      this.players.delete(sessionId);
      this.updateHud();
      this.refreshParty();
    });
  }

  private moveTo(view: PlayerView, player: any, isMe: boolean) {
    const [tx, ty] = this.tileCenter(player.x, player.y);
    if (view.container.x === tx && view.container.y === ty) return;
    view.tween?.stop();
    // Through a door (or waking up at the shrine): onto that area's layer.
    const layer = this.layerAt(player.x, player.y);
    if (view.container.displayList !== layer) layer.add(view.container);
    // A long jump (a door, or waking up at the shrine) snaps straight there instead of sliding across the map.
    const jump = Math.abs(view.container.x - tx) > TILE_SIZE * 2 || Math.abs(view.container.y - ty) > TILE_SIZE * 2;
    if (jump) view.container.setPosition(tx, ty);
    else view.tween = this.tweens.add({ targets: view.container, x: tx, y: ty, duration: player.stepMs || TICK_MS, ease: "Linear" });
    view.container.setDepth(10 + player.y + 0.5);
    if (isMe && this.marker.visible && this.marker.x === tx && this.marker.y === ty) this.marker.setVisible(false);
    if (isMe) {
      const a = areaAt(player.x, player.y) ?? OUTDOORS;
      if (a !== this.here) {
        this.showArea(a);
        this.marker.setVisible(false);
        this.cameras.main.centerOn(tx, ty);
        this.floatText(a.kind === "outdoor" ? a.name : a.name, a.danger ? "#ff9a8a" : "#ffe9a8", true);
      } else if (jump || (player.x + player.y) % 3 === 0) {
        updateWorldMap({ x: player.x, y: player.y }, a);
      }
    }
  }

  /** Animations for what a player is doing: chopping (lunge at the tree) or fishing (line and bobber). */
  private setAction(view: PlayerView, player: any, action: string) {
    view.chopTween?.stop();
    view.chopTween = undefined;
    view.line?.destroy();
    view.line = undefined;
    view.body.setPosition(0, 0);
    if (action === "idle") return;
    if (view === this.players.get(this.room?.sessionId ?? "")) this.marker.setVisible(false);
    const dx = Math.sign(player.faceX - player.x), dy = Math.sign(player.faceY - player.y);

    if (action === "chopping" || action === "mining" || action === "digging" || action === "farming" || action === "smelting" || action === "smithing" || action === "cooking" || action === "fighting") {
      view.chopTween = this.tweens.add({
        targets: view.body, x: dx * 6, y: dy * 6,
        duration: TICK_MS / 4, yoyo: true, hold: 30, repeatDelay: TICK_MS / 2 - 30, repeat: -1,
        ease: "Quad.easeOut",
      });
    } else if (action === "fishing") {
      // A line from the player out to a bobber on the water, bobbing gently.
      const bx = dx * TILE_SIZE * 0.9, by = dy * TILE_SIZE * 0.9;
      const line = this.add.container(0, 0);
      const g = this.add.graphics().lineStyle(1, 0xffffff, 0.8).lineBetween(dx * 8, dy * 8 - 6, bx, by);
      const bobber = this.add.circle(bx, by, 3, 0xff3b3b).setStrokeStyle(1, 0xffffff);
      line.add([g, bobber]);
      view.container.add(line);
      view.line = line;
      view.chopTween = this.tweens.add({ targets: bobber, y: by + 2, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  private tileAt(pointer: Phaser.Input.Pointer) {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: Math.floor(world.x / TILE_SIZE), y: Math.floor(world.y / TILE_SIZE) };
  }

  // ---- Zoom: pinch with two fingers, mouse wheel, or the +/- buttons ----

  private setupZoom() {
    const saved = Number(localStorage.getItem(ZOOM_KEY));
    this.setZoom(saved > 0 ? saved : 1);

    this.input.on("pointerdown", () => {
      if (this.downPointers().length === 1) this.gestureWasPinch = false;
      if (this.downPointers().length === 2) this.startPinch();
    });
    this.input.on("pointermove", () => {
      const [a, b] = this.downPointers();
      if (!a || !b) return;
      if (!this.pinchStartDist) this.startPinch();
      const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      this.setZoom(this.pinchStartZoom * dist / this.pinchStartDist);
    });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.setZoom(this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1));
    });
    document.getElementById("zoom-in")!.onclick = () => this.setZoom(this.cameras.main.zoom * 1.25);
    document.getElementById("zoom-out")!.onclick = () => this.setZoom(this.cameras.main.zoom / 1.25);
  }

  private downPointers() {
    return this.input.manager.pointers.filter((p) => p.isDown);
  }

  private startPinch() {
    const [a, b] = this.downPointers();
    this.gestureWasPinch = true;
    this.pinchStartDist = Math.max(1, Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y));
    this.pinchStartZoom = this.cameras.main.zoom;
  }

  private setZoom(zoom: number) {
    const z = Phaser.Math.Clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    this.cameras.main.setZoom(z);
    localStorage.setItem(ZOOM_KEY, String(z));
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    if (this.downPointers().length < 2) this.pinchStartDist = 0;
    if (this.gestureWasPinch) return; // the end of a pinch is not a tap
    const moved = Phaser.Math.Distance.Between(pointer.downX, pointer.downY, pointer.upX, pointer.upY);
    if (moved > TAP_SLOP) return;
    this.onClick(pointer);
  }

  /** Text that floats up from your character and fades, e.g. "+1 Foraging XP". */
  /** Darken the world at night (a gentle dark for now), and say when night falls or the sun comes up. */
  private updateDaylight() {
    const now = Date.now() + this.clockOffset;
    // A night sight potion lifts the dark.
    // Inside it's always lit (caves stay a little dim). A night sight potion lifts the dark.
    const dark = this.here.kind === "indoor" ? 0 : this.here.kind === "cave" ? 0.25 : darkness(now) * NIGHT_DARKNESS;
    this.nightShade?.setAlpha(nightSightOn() ? 0 : dark);
    tickBuffs();
    const night = isNight(now);
    if (this.wasNight !== null && night !== this.wasNight && this.room) {
      showMessage(night ? "🌙 Night falls over the town." : "☀️ The sun comes up.");
    }
    this.wasNight = night;
    const clock = document.getElementById("clock");
    if (clock) {
      const mins = minutesUntilChange(now);
      clock.textContent = night ? "🌙" : "☀️";
      clock.title = night ? `Night. The sun comes up in about ${mins} minute${mins === 1 ? "" : "s"}.` : `Day. Night falls in about ${mins} minute${mins === 1 ? "" : "s"}.`;
    }
  }

  private floatText(text: string, color: string, big = false) {
    const me = this.room && this.players.get(this.room.sessionId);
    if (!me) return;
    const t = this.add.text(me.container.x, me.container.y - 34, text, {
      fontSize: big ? "18px" : "13px", color, stroke: "#000", strokeThickness: big ? 4 : 3, fontStyle: big ? "bold" : "",
    }).setOrigin(0.5).setDepth(1000);
    this.tweens.add({
      targets: t, y: t.y - (big ? 50 : 32), alpha: 0, duration: big ? 2500 : 1400, ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  private celebrateLevelUp(discipline: DisciplineId) {
    this.time.delayedCall(350, () => this.floatText(`${DISCIPLINES[discipline].name} level up!`, "#ffd84a", true));
    flashDiscipline(discipline);
    const me = this.room && this.players.get(this.room.sessionId);
    if (me) {
      // A ring of light around you.
      const ring = this.add.circle(me.container.x, me.container.y, 12).setStrokeStyle(3, 0xffd84a).setDepth(999);
      this.tweens.add({ targets: ring, scale: 3.5, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
    }
  }

  private celebrateSkill(skill: SkillId, level: number) {
    const name = findSkill(skill).def.name;
    this.time.delayedCall(350, () => this.floatText(`${name} level ${level}!`, "#ffd84a", true));
    flashSkillRow(skill);
  }

  private celebrateMastery(type: MasteryId, level: number) {
    const name = masteryName(type);
    this.time.delayedCall(700, () => this.floatText(`${name} Mastery ${level}!`, "#7fd0ff"));
    flashMastery(type);
  }

  /** " (Woodcutting level 20)" if you can't gather this type yet, else "". */
  private lockNote(type: ResourceId) {
    const r = RESOURCES[type];
    const { def } = findSkill(r.skill);
    if (!isUnlocked(this.lastDisciplines?.unlocked ?? [], r.skill)) return ` (learn ${def.name} first)`;
    return levelForXp(this.skillXp[r.skill] ?? 0) < r.level ? ` (${def.name} level ${r.level})` : "";
  }

  private isStandingTree(x: number, y: number) {
    return this.trees.has(treeKey(x, y)) && !this.room?.state.depleted.has(treeKey(x, y));
  }

  private isFullRock(x: number, y: number) {
    return this.rocks.has(treeKey(x, y)) && !this.room?.state.depleted.has(treeKey(x, y));
  }

  // ---- Farm plots ----
  private plots = new Map<string, any>();
  private plotViews = new Map<string, { soil: Phaser.GameObjects.Graphics; tiles: Phaser.GameObjects.Text[]; sign: Phaser.GameObjects.Text }>();

  /** The soil, the crops at their stage, and the sign with the owner's name. */
  private drawPlot(key: string) {
    const lot = LOTS[Number(key)];
    if (!lot) return;
    let view = this.plotViews.get(key);
    if (!view) {
      const outdoors = this.areaLayers.get(OUTDOORS.id)!;
      const soil = outdoors.add(this.make.graphics({}, false).setDepth(1)) as Phaser.GameObjects.Graphics;
      const tiles = Array.from({ length: LOT_SIZE * LOT_SIZE }, (_, i) => {
        const t = tileOf(Number(key), i);
        return outdoors.add(this.make.text({ x: this.tileCenter(t.x, t.y)[0], y: this.tileCenter(t.x, t.y)[1], text: "", style: { fontSize: "18px" } }, false).setOrigin(0.5, 0.6).setDepth(10 + t.y)) as Phaser.GameObjects.Text;
      });
      const sign = this.add.text(lot.x * TILE_SIZE + LOT_SIZE * TILE_SIZE / 2, lot.y * TILE_SIZE - 8, "", {
        fontSize: "11px", color: "#ffe9a8", stroke: "#000", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(10 + lot.y);
      outdoors.add(sign);
      view = { soil, tiles, sign };
      this.plotViews.set(key, view);
    }
    const plot = this.plots.get(key);
    const now = serverNow();
    view.soil.clear();
    view.sign.setText(plot ? `${plot.owner}'s farm` : "Free lot: ask Farmer Odo");
    view.sign.setAlpha(plot ? 1 : 0.6);
    view.tiles.forEach((text, i) => {
      const t = tileOf(Number(key), i);
      if (!plot || !inPlot(i, plot.w, plot.h)) { text.setText(""); return; }
      const px = t.x * TILE_SIZE, py = t.y * TILE_SIZE;
      view!.soil.fillStyle(0x6b4423).fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      view!.soil.fillStyle(0x553518).fillRect(px + 3, py + 8, TILE_SIZE - 6, 2).fillRect(px + 3, py + 18, TILE_SIZE - 6, 2);
      const c = decodeCrop(plot.crops[i]);
      if (!c) { text.setText(""); return; }
      const g = growth(c, now);
      if (g >= 1) {
        text.setText(ITEMS[CROPS[c.crop].produce].icon).setScale(1);
      } else {
        // Growing: a sprout that gets bigger.
        text.setText(g < 0.34 ? "🌱" : "🌿").setScale(0.45 + g * 0.5);
      }
    });
  }

  private myName(): string {
    return this.room?.state.players.get(this.room.sessionId)?.name ?? "";
  }

  /** Crops grow on their own, so redraw the plots now and then. */
  private redrawPlots() {
    for (const key of this.plotViews.keys()) this.drawPlot(key);
  }

  private onClick(pointer: Phaser.Input.Pointer) {
    const { x, y } = this.tileAt(pointer);
    closeShop(); // clicking the map walks away from the shop
    closeRepair();
    closeCraft();
    closeBounties();
    closeGuild();
    closeChest();
    closeInfo();
    closeDialog();
    if (areaAt(x, y) !== this.here) return; // only what you can see
    const npc = npcAt(x, y);
    const monster = this.monsterAt(x, y);
    const other = this.otherPlayerAt(x, y);
    if (monster) {
      this.room?.send("attack", { id: monster });
      return;
    } else if (other && !npc) {
      this.room?.send("partyInvite", { id: other });
      return;
    } else if (npc) {
      this.room?.send("talk", { id: npc.id });
    } else if (this.isStandingTree(x, y)) {
      this.room?.send("chop", { x, y });
    } else if (this.isFullRock(x, y)) {
      this.room?.send("mine", { x, y });
    } else if (this.isFullPatch(x, y)) {
      this.room?.send("dig", { x, y });
    } else if (isFishingSpot(x, y)) {
      this.room?.send("fish", { x, y });
    } else if (lotAt(x, y) && this.plots.has(String(lotAt(x, y)!.lot))) {
      this.room?.send("farm", { x, y });
    } else if (isWalkable(x, y)) {
      this.room?.send("move", { x, y });
    } else {
      return;
    }
    this.marker.setPosition(...this.tileCenter(x, y)).setVisible(true);
  }

  private onHover(pointer: Phaser.Input.Pointer) {
    const { x, y } = this.tileAt(pointer);
    if (areaAt(x, y) !== this.here) { setHoverText(null); this.input.setDefaultCursor("default"); return; }
    const door = doorAt(x, y);
    const key = treeKey(x, y);
    const npc = npcAt(x, y);
    const monster = this.monsterAt(x, y);
    const other = this.otherPlayerAt(x, y);
    if (other && !monster && !npc) {
      setHoverText("Invite", `${this.room!.state.players.get(other).name} to your party`, pointer.x, pointer.y);
    } else if (monster) {
      const m = this.room!.state.monsters.get(monster);
      const def = MONSTERS[m.kind as MonsterId];
      setHoverText("Attack", `${def.name} (level ${def.level})${def.aggressive ? " ⚠" : ""}`, pointer.x, pointer.y);
    } else if (npc) {
      setHoverText(npc.id === "board" || npc.id === "guildboard" ? "Read" : npc.name === "Enchanted chest" ? "Open" : npc.kind === "station" ? "Use" : "Talk-to", npc.name, pointer.x, pointer.y);
    } else if (this.isStandingTree(x, y)) {
      const type = nodeAt(x, y)!;
      setHoverText("Chop down", RESOURCES[type].node + this.lockNote(type), pointer.x, pointer.y);
    } else if (this.trees.has(key)) {
      setHoverText("Examine", `${RESOURCES[nodeAt(x, y)!].node} stump`, pointer.x, pointer.y);
    } else if (this.isFullRock(x, y)) {
      const type = nodeAt(x, y)!;
      setHoverText("Mine", RESOURCES[type].node + this.lockNote(type), pointer.x, pointer.y);
    } else if (this.rocks.has(key)) {
      setHoverText("Examine", `Empty ${RESOURCES[nodeAt(x, y)!].node.toLowerCase()}`, pointer.x, pointer.y);
    } else if (this.isFullPatch(x, y)) {
      setHoverText("Dig", "Dig patch" + this.lockNote("dig"), pointer.x, pointer.y);
    } else if (this.patches.has(key)) {
      setHoverText("Examine", "Dug-out patch (it glints again soon)", pointer.x, pointer.y);
    } else if (door) {
      setHoverText(door.label.startsWith("Leave") || door.label.startsWith("Back") || door.label.startsWith("Go") ? door.label : "Enter", door.label.replace(/^Enter /, ""), pointer.x, pointer.y);
    } else if (this.here.danger && (MAP[y]?.[x] === "cave" || MAP[y]?.[x] === "crystal")) {
      setHoverText(`⚠ ${this.here.name}:`, "monsters here attack on sight!", pointer.x, pointer.y);
    } else if (MAP[y]?.[x] === "lockeddoor") {
      setHoverText("Locked", "a heavy door with a gold lock", pointer.x, pointer.y);
    } else if (MAP[y]?.[x] === "barricade") {
      setHoverText("Road closed:", "the Ashen Barrens lie beyond. The Watch has shut the road.", pointer.x, pointer.y);
    } else if (lotAt(x, y)) {
      const at = lotAt(x, y)!;
      const plot = this.plots.get(String(at.lot));
      const c = plot && inPlot(at.index, plot.w, plot.h) ? decodeCrop(plot.crops[at.index]) : null;
      const now = serverNow();
      if (!plot) setHoverText("Walk here", "Free farm lot (Farmer Odo sells plots)", pointer.x, pointer.y);
      else if (!inPlot(at.index, plot.w, plot.h)) setHoverText("Examine", `${plot.owner}'s lot (not planted yet)`, pointer.x, pointer.y);
      else if (!c) setHoverText(plot.owner === this.myName() ? "Plant" : "Examine", `Empty soil in ${plot.owner}'s farm`, pointer.x, pointer.y);
      else if (now >= c.ripeAt) setHoverText(plot.owner === this.myName() ? "Harvest" : "Examine", `Ripe ${ITEMS[CROPS[c.crop].produce].name.toLowerCase()}`, pointer.x, pointer.y);
      else setHoverText("Examine", `${ITEMS[CROPS[c.crop].produce].name}, ripe in ${timeLeft(c.ripeAt - now)}`, pointer.x, pointer.y);
    } else if (isFishingSpot(x, y)) {
      const type = fishAt(x, y)!;
      setHoverText("Fish", RESOURCES[type].node + this.lockNote(type), pointer.x, pointer.y);
    } else if (MAP[y]?.[x] === "sign") {
      if (y < 90) setHoverText("⚠ Road closed:", "the Ashen Barrens lie beyond, where the Withering began.", pointer.x, pointer.y);
      else setHoverText("⚠ Danger:", "the Dark Forest. Monsters attack on sight!", pointer.x, pointer.y);
    } else if (MAP[y]?.[x] === "gate") {
      setHoverText("Walk into", "the Dark Forest ⚠", pointer.x, pointer.y);
    } else if (isWalkable(x, y)) {
      setHoverText("Walk here", "", pointer.x, pointer.y);
    } else {
      setHoverText(null);
    }
    this.input.setDefaultCursor(npc || monster || door || this.isStandingTree(x, y) || this.isFullRock(x, y) || this.isFullPatch(x, y) || isFishingSpot(x, y) ? "pointer" : "default");
  }

  // ---- Monsters and fighting ----

  /** The live monster standing on a tile, if any (its id). */
  /** Someone else standing on that tile who isn't in your party yet (click to invite them). */
  private otherPlayerAt(x: number, y: number): string | null {
    const room = this.room;
    if (!room) return null;
    const me = room.state.players.get(room.sessionId);
    let found: string | null = null;
    room.state.players.forEach((pl: any, id: string) => {
      if (id !== room.sessionId && pl.x === x && pl.y === y && !pl.invisible && !(me?.party && pl.party === me.party)) found = id;
    });
    return found;
  }

  /** The 🚩 party panel, and green names for your party. */
  private refreshParty() {
    const room = this.room;
    if (!room) return;
    const me = room.state.players.get(room.sessionId);
    const mine = me?.party ?? "";
    const members: PartyMember[] = [];
    room.state.players.forEach((pl: any, id: string) => {
      const view = this.players.get(id);
      const mate = !!mine && pl.party === mine;
      if (view && id !== room.sessionId) view.label.setColor(mate ? "#7dff8a" : "#ffffff");
      if (mate) members.push({ id, name: pl.name, hp: pl.hp, maxHp: pl.maxHp, lead: pl.partyLead, me: id === room.sessionId });
    });
    members.sort((a, b) => Number(b.lead) - Number(a.lead) || a.name.localeCompare(b.name));
    renderParty(members, !!me?.partyLead);
  }

  private monsterAt(x: number, y: number): string | null {
    let found: string | null = null;
    this.room?.state.monsters?.forEach((m: any, id: string) => { if (m.alive && m.x === x && m.y === y) found = id; });
    return found;
  }

  private addMonster(m: any, id: string, $: ReturnType<typeof getStateCallbacks>) {
    const def = MONSTERS[m.kind as MonsterId];
    const container = this.put(this.add.container(...this.tileCenter(m.x, m.y)).setDepth(10 + m.y), m.x, m.y);
    const shadow = this.add.ellipse(0, 11, 20, 7, 0x000000, 0.3);
    const big = m.kind === "cow" || m.kind === "bandit" || m.kind === "spider";
    const body = this.add.text(0, 0, def.icon, { fontSize: m.kind === "alpha_wolf" ? "30px" : big ? "24px" : "20px" }).setOrigin(0.5);
    const bar = this.add.graphics();
    const status = this.add.text(12, -14, "", { fontSize: "12px" }).setOrigin(0.5);
    const glow = this.add.ellipse(0, 0, 34, 34, 0xa25bff, 0.45).setStrokeStyle(2, 0xd6a8ff, 0.9).setVisible(false);
    container.add([glow, shadow, body, bar, status]);
    const view: MonsterView = { container, body, bar, status, glow };
    this.monsters.set(id, view);
    // Danger zone monsters get a red name tag, so you know they'll come for you.
    if (def.aggressive) {
      container.add(this.add.text(0, -24, def.name, { fontSize: "10px", color: "#ff8a7a", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5));
    }
    const move = () => {
      const [tx, ty] = this.tileCenter(m.x, m.y);
      view.tween?.stop();
      if (!container.visible) container.setPosition(tx, ty);
      else view.tween = this.tweens.add({ targets: container, x: tx, y: ty, duration: TICK_MS, ease: "Linear" });
      container.setDepth(10 + m.y + 0.4);
      // Face the way it's walking.
      if (tx !== container.x) body.setScale(tx > container.x ? -1 : 1, 1);
    };
    $(m).listen("x", move);
    $(m).listen("y", move);
    $(m).listen("hp", () => this.drawHealth(bar, m.hp, m.maxHp, -16));
    $(m).listen("alive", (alive: boolean) => {
      if (alive) {
        container.setPosition(...this.tileCenter(m.x, m.y)).setVisible(true).setAlpha(0);
        this.tweens.add({ targets: container, alpha: 1, duration: 600 });
      } else {
        // Topple over and fade.
        this.tweens.add({ targets: body, angle: 90, duration: 300 });
        this.tweens.add({ targets: container, alpha: 0, delay: 300, duration: 500, onComplete: () => { container.setVisible(false); body.setAngle(0); } });
      }
    });
    $(m).listen("status", (st: string) => {
      status.setText(st === "asleep" ? "💤" : st === "frozen" ? "❄️" : "");
      body.setTint(st === "frozen" ? 0x9ad8ff : 0xffffff);
    });
    container.setVisible(m.alive);
  }

  /** Soul-trapped monsters glow purple; in the last seconds the glow blinks. */
  private updateTrapGlows() {
    const state = this.room?.state;
    if (!state?.monsters) return;
    const tick = state.tick as number;
    const blinkTicks = Math.round(TRAP_BLINK_SECONDS * 1000 / TICK_MS);
    const on = Math.floor(Date.now() / 200) % 2 === 0;
    state.monsters.forEach((m: any, id: string) => {
      const view = this.monsters.get(id);
      if (!view) return;
      const left = m.alive && m.trappedUntil ? m.trappedUntil - tick : 0;
      view.glow.setVisible(left > 0 && (left > blinkTicks || on));
    });
  }

  /** A small health bar over someone's head once they're hurt (hidden at full health). */
  private drawHealth(bar: Phaser.GameObjects.Graphics, hp: number, max: number, y: number) {
    bar.clear();
    if (!max || hp >= max) return;
    const w = 24;
    bar.fillStyle(0x000000, 0.7).fillRect(-w / 2 - 1, y - 1, w + 2, 5);
    bar.fillStyle(0xc0392b).fillRect(-w / 2, y, w, 3);
    bar.fillStyle(0x5fd35f).fillRect(-w / 2, y, Math.max(0, Math.round(w * hp / max)), 3);
  }

  /** A hit splat: red with the damage, or a blue 0 for a miss. Spells show their icon. */
  private showHit(h: { on: "monster" | "player"; id: string; damage: number; miss: boolean; spell: SpellId | null }) {
    const target = h.on === "monster" ? this.monsters.get(h.id)?.container : this.players.get(h.id)?.container;
    if (!target || target.displayList !== this.areaLayers.get(this.here.id)) return;
    const icon = h.spell === "fire_blast" ? "🔥" : h.spell === "frost_bolt" ? "❄️" : h.spell === "sleep" ? "💤" : h.spell === "frost_nova" ? "🌨️" : (h.spell as string) === "poison" ? "☠️" : (h.spell as string) === "lightning" ? "⚡" : "";
    if (icon && !h.miss) {
      const fx = this.add.text(target.x, target.y, icon, { fontSize: "22px" }).setOrigin(0.5).setDepth(998);
      this.tweens.add({ targets: fx, scale: 1.8, alpha: 0, duration: 500, onComplete: () => fx.destroy() });
    }
    if (h.spell === "sleep" && !h.miss) return;
    const text = h.miss ? "0" : String(h.damage);
    const color = h.miss ? "#7fb2ff" : h.on === "player" ? "#ff5a4a" : "#ffdd55";
    const t = this.add.text(target.x + Phaser.Math.Between(-6, 6), target.y - 6, text, {
      fontSize: "15px", color, stroke: "#000", strokeThickness: 4, fontStyle: "bold",
    }).setOrigin(0.5).setDepth(999);
    this.tweens.add({ targets: t, y: t.y - 22, alpha: 0, duration: 900, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
    // A little shake on whoever got hit.
    if (!h.miss) this.tweens.add({ targets: target, x: target.x + 2, duration: 50, yoyo: true, repeat: 1 });
  }

  /** Knocked out: the screen flashes red, then you're at Maren's. */
  private showDeath() {
    this.cameras.main.flash(700, 160, 20, 20);
    this.time.delayedCall(300, () => this.floatText("You were knocked out!", "#ff7a6a", true));
  }

  private tileCenter(x: number, y: number): [number, number] {
    return [x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2];
  }

  private updateHud() {
    this.hud.textContent = `${this.players.size} player(s) online`;
  }
}
