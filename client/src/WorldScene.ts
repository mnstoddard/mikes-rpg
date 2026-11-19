import Phaser from "phaser";
import { getStateCallbacks, Room } from "colyseus.js";
import { MAP, MAP_HEIGHT, MAP_WIDTH, TICK_MS, TILE_SIZE, Tile, isWalkable } from "../../shared/map";
import { RESOURCES, ResourceId, fishAt, isFishingSpot, nodeAt, treeKey } from "../../shared/foraging";

import { ITEMS, ItemId } from "../../shared/items";
import { joinWorld, rejoinWorld } from "./network";
import { closeDialog, openDialog, renderQuest, renderStamina, closeCraft, closeInfo, closeShop, flashDiscipline, flashMastery, flashSkillRow, openCraft, renderBelt, renderDurability, renderMastery, renderSkillXp, openShop, renderCoins, renderDisciplines, renderInventory, renderLocks, setHoverText, setInventoryActions, showMessage } from "./ui";
import { masteryName } from "../../shared/crafting";
import type { Belt, ToolType } from "../../shared/tools";
import { NPCS, npcAt } from "../../shared/npcs";
import { DISCIPLINES, DisciplineId, DisciplineXp, SkillId, SkillXp, emptySkills, findSkill, levelForXp } from "../../shared/disciplines";
import { ItemMasteryXp, MasteryId } from "../../shared/mastery";
import { showLogin } from "./login";
import type { QuestView } from "../../shared/quests";

const TILE_COLORS: Record<Tile, number> = {
  grass: 0x4a8f3c, path: 0xb89b6a, water: 0x2d6fa3, tree: 0x2e5e22, rock: 0x7d7d7d, bridge: 0x8b5a2b,
};

interface PlayerView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  tween?: Phaser.Tweens.Tween;
  chopTween?: Phaser.Tweens.Tween;
  line?: Phaser.GameObjects.Container; // fishing line, while fishing
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const TAP_SLOP = 12; // px a finger can wobble and still count as a tap
const ZOOM_KEY = "rpg.zoom";

interface TreeView { tree: Phaser.GameObjects.Graphics; stump: Phaser.GameObjects.Graphics }

export class WorldScene extends Phaser.Scene {
  private room?: Room;
  private players = new Map<string, PlayerView>();
  private trees = new Map<string, TreeView>();
  private rocks = new Map<string, TreeView>(); // same idea: full rock, or emptied
  private marker!: Phaser.GameObjects.Text;
  private hud = document.getElementById("hud")!;
  // Touch gesture state
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private gestureWasPinch = false;
  private lastDisciplines?: DisciplineXp;
  private skillXp: SkillXp = emptySkills();
  /** The ❗ over Old Maren when she has something to say. */
  private guideAlert?: Phaser.GameObjects.Text;

  constructor() { super("world"); }

  async create() {
    this.drawMap();
    this.drawNpcs();
    this.marker = this.add.text(0, 0, "✕", { fontSize: "20px", color: "#ffeb3b" })
      .setOrigin(0.5).setDepth(500).setVisible(false);
    // No camera bounds: the camera stays centred on you, and past the map edge
    // the background is the same colour as the sea, so the island just floats.
    this.cameras.main.centerOn(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2);
    this.setupZoom();
    renderInventory([]);

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
    room.onMessage("disciplines", (disciplines: DisciplineXp) => {
      // Floating "+1 Foraging XP" over your head whenever you earn XP.
      if (this.lastDisciplines) {
        for (const id of Object.keys(disciplines) as DisciplineId[]) {
          const gained = disciplines[id] - (this.lastDisciplines[id] ?? 0);
          if (gained > 0) this.floatText(`+${gained} ${DISCIPLINES[id].name} XP`, "#9be28a");
        }
      }
      this.lastDisciplines = disciplines;
      renderDisciplines(disciplines);
    });
    room.onMessage("levelup", (msg: { discipline: DisciplineId; level: number }) => this.celebrateLevelUp(msg.discipline));
    room.onMessage("skillxp", (skillXp: SkillXp) => {
      this.skillXp = skillXp;
      renderSkillXp(skillXp);
    });
    room.onMessage("mastery", (mastery: ItemMasteryXp) => renderMastery(mastery));
    room.onMessage("skillup", (msg: { skill: SkillId; level: number }) => this.celebrateSkill(msg.skill, msg.level));
    room.onMessage("masteryup", (msg: { resource: MasteryId; level: number }) => this.celebrateMastery(msg.resource, msg.level));
    setInventoryActions({
      drop: (slot) => room.send("drop", { slot }),
      sell: (slot) => room.send("sell", { slot }),
      sellAll: () => room.send("sellAll"),
      lock: (slot, locked) => room.send("lock", { slot, locked }),
      equip: (slot) => room.send("equip", { slot }),
      unequip: (type: ToolType) => room.send("unequip", { type }),
      buy: (item, count) => room.send("buy", { item, count }),
      craft: (item, all) => room.send("craft", { item, all }),
      eat: (slot) => room.send("eat", { slot }),
    });
    room.onMessage("quest", (q: QuestView) => {
      this.guideAlert?.setVisible(q.talk);
      renderQuest(q);
    });
    room.onMessage("questDone", () => this.floatText("Quest complete!", "#ffd84a", true));
    room.onMessage("dialog", (msg: { name: string; lines: string[] }) => {
      this.marker.setVisible(false);
      openDialog(msg.name, msg.lines);
    });
    room.onMessage("stamina", (msg: { stamina: number; max: number }) => renderStamina(msg.stamina, msg.max));
    room.onMessage("durability", (slots: (number | null)[]) => renderDurability(slots));
    room.onMessage("belt", (belt: Belt) => renderBelt(belt));
    room.onMessage("station", (msg: { npc: string }) => {
      this.marker.setVisible(false);
      openCraft(msg.npc);
    });
    room.onMessage("locks", (slots: boolean[]) => renderLocks(slots));
    room.onMessage("inventory", (items: (ItemId | null)[]) => renderInventory(items));
    room.onMessage("coins", (coins: number) => renderCoins(coins));
    room.onMessage("shop", () => {
      this.marker.setVisible(false);
      openShop();
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

  /** Forget everything the old connection showed, so the new one can draw it fresh. */
  private clearWorld() {
    this.cameras.main.stopFollow();
    this.players.forEach((v) => v.container.destroy());
    this.players.clear();
    for (const key of [...this.trees.keys(), ...this.rocks.keys()]) this.setStump(key, false);
    this.marker.setVisible(false);
    this.lastDisciplines = undefined;
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

  private drawMap() {
    const g = this.add.graphics();
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const t = MAP[y][x];
        const px = x * TILE_SIZE, py = y * TILE_SIZE;
        // Grass underneath trees and rocks.
        const base = t === "tree" || t === "rock" ? TILE_COLORS.grass : TILE_COLORS[t];
        // Slight checkerboard shading so you can see the tile grid.
        g.fillStyle(base, (x + y) % 2 ? 1 : 0.92);
        g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        if (t === "tree") {
          this.trees.set(treeKey(x, y), this.makeTree(px, py, y, nodeAt(x, y)!));
        } else if (t === "rock") {
          this.rocks.set(treeKey(x, y), this.makeRock(px, py, y, nodeAt(x, y)!));
        } else if (t === "water" && fishAt(x, y) && fishAt(x, y) !== "minnow") {
          this.makeFishingSpot(px, py, fishAt(x, y)!);
        } else if (t === "bridge") {
          g.lineStyle(2, 0x5c3a1a).lineBetween(px, py + 10, px + TILE_SIZE, py + 10)
            .lineBetween(px, py + 22, px + TILE_SIZE, py + 22);
        }
      }
    }
  }

  private drawNpcs() {
    for (const npc of NPCS) {
      if (npc.kind === "station") { this.drawStation(npc.id, npc.x, npc.y, npc.name); continue; }
      const [cx, cy] = this.tileCenter(npc.x, npc.y);
      const c = this.add.container(cx, cy).setDepth(10 + npc.y + 0.5);
      const shadow = this.add.ellipse(0, 10, 20, 8, 0x000000, 0.3);
      const body = this.add.circle(0, 0, 10, npc.color).setStrokeStyle(2, 0x000000);
      const hat = this.add.graphics();
      if (npc.id === "maren") {
        // A grey bun of hair and a straw sun hat.
        hat.fillStyle(0xd9d4c7).fillCircle(0, -9, 5);
        hat.fillStyle(0xe8c56a).fillEllipse(0, -11, 24, 5).fillRect(-6, -17, 12, 6);
        hat.fillStyle(0x2e86c1).fillRect(-6, -13, 12, 2);
      } else {
        hat.fillStyle(0x3b2410).fillRect(-9, -12, 18, 3).fillRect(-6, -18, 12, 7);
      }
      const badge = this.add.text(11, 2, npc.badge ?? "", { fontSize: "13px" }).setOrigin(0.5);
      const label = this.add.text(0, -28, npc.name, {
        fontSize: "12px", color: "#7fe0ff", stroke: "#000", strokeThickness: 3,
      }).setOrigin(0.5);
      c.add([shadow, body, hat, badge, label]);
      // A little idle bob so they look alive.
      this.tweens.add({ targets: [body, hat], y: "-=2", duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      if (npc.id === "maren") {
        // ❗ when she has something for you (the server says when, with the quest tracker).
        this.guideAlert = this.add.text(0, -46, "❗", { fontSize: "18px" }).setOrigin(0.5).setVisible(false);
        c.add(this.guideAlert);
        this.tweens.add({ targets: this.guideAlert, y: -50, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
  }

  /** The furnace (glowing fire), the anvil and the stove (pot on top), next to the Merchant. */
  private drawStation(id: string, x: number, y: number, name: string) {
    const [cx, cy] = this.tileCenter(x, y);
    const c = this.add.container(cx, cy).setDepth(10 + y + 0.5);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillEllipse(0, 11, 26, 8);
    if (id === "furnace") {
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
    } else {
      g.fillStyle(0x3b2410).fillRect(-6, 0, 12, 10); // wooden stump
      g.fillStyle(0x50565c).fillRect(-6, -6, 12, 6);
      g.fillStyle(0x6c737a).fillRect(-13, -12, 24, 7).fillTriangle(11, -12, 11, -5, 16, -11);
      g.fillStyle(0x9aa3ab).fillRect(-12, -12, 22, 2);
      c.add(g);
    }
    const label = this.add.text(0, -28, name, { fontSize: "12px", color: "#ffd84a", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5);
    c.add(label);
  }

  /** A rock with flecks in its ore's colour (plain for stone), and its emptied look. */
  private makeRock(px: number, py: number, row: number, type: ResourceId): TreeView {
    const full = this.add.graphics({ x: px, y: py }).setDepth(10 + row);
    full.fillStyle(TILE_COLORS.rock).fillEllipse(16, 18, 26, 20);
    full.fillStyle(0x9a9a9a).fillEllipse(12, 14, 10, 6);
    if (type === "stone") {
      full.lineStyle(1, 0x5a5a5a).lineBetween(9, 20, 15, 17).lineBetween(18, 23, 23, 19);
    } else {
      const fleck = RESOURCES[type].color;
      full.fillStyle(fleck).fillCircle(10, 19, 2.5).fillCircle(19, 15, 2).fillCircle(21, 22, 2.5).fillCircle(14, 23, 1.5);
      if (RESOURCES[type].level >= 40) {
        // Rare ores sparkle.
        full.fillStyle(0xffffff, 0.9).fillCircle(19, 14, 0.8).fillCircle(9, 18, 0.8);
      }
    }
    const empty = this.add.graphics({ x: px, y: py }).setDepth(10 + row).setVisible(false);
    empty.fillStyle(0x6a6a6a).fillEllipse(16, 21, 22, 14);
    empty.fillStyle(0x5a5a5a).fillEllipse(16, 22, 12, 6);
    return { tree: full, stump: empty };
  }

  private makeTree(px: number, py: number, row: number, type: ResourceId): TreeView {
    const tree = this.add.graphics({ x: px, y: py }).setDepth(10 + row);
    const leaves = RESOURCES[type].color;
    const highlight = Phaser.Display.Color.ValueToColor(leaves).lighten(18).color;
    const trunk = type === "birch" ? 0xe8e4d8 : type === "ironwood" ? 0x3a3a3a : 0x5b3a1e;
    tree.fillStyle(trunk).fillRect(13, 18, 6, 12);
    if (type === "birch") tree.fillStyle(0x333333).fillRect(14, 21, 3, 1).fillRect(15, 25, 3, 1);
    if (type === "pine") {
      // Pines are pointy.
      tree.fillStyle(leaves).fillTriangle(16, 0, 4, 22, 28, 22);
      tree.fillStyle(highlight).fillTriangle(16, 3, 10, 14, 18, 14);
    } else {
      const big = RESOURCES[type].level >= 35 ? 13 : 11; // the rare ones are bigger
      tree.fillStyle(leaves).fillCircle(16, 13, big);
      tree.fillStyle(highlight).fillCircle(13, 10, 5);
      if (type === "elderwood") tree.fillStyle(0xe0c8ff).fillCircle(20, 8, 1.5).fillCircle(10, 15, 1.5).fillCircle(21, 17, 1.5);
    }
    const stump = this.add.graphics({ x: px, y: py }).setDepth(10 + row).setVisible(false);
    stump.fillStyle(0x5b3a1e).fillEllipse(16, 24, 14, 8);
    stump.fillStyle(0xc9a26b).fillEllipse(16, 22, 12, 6);
    return { tree, stump };
  }

  /** A special fishing spot: little ripples in the fish's colour. */
  private makeFishingSpot(px: number, py: number, type: ResourceId) {
    const color = RESOURCES[type].color;
    const g = this.add.graphics({ x: px, y: py }).setDepth(5);
    g.lineStyle(1.5, color, 0.9).strokeEllipse(16, 16, 18, 8);
    g.lineStyle(1, color, 0.6).strokeEllipse(16, 16, 26, 12);
    g.fillStyle(0xffffff, 0.8).fillCircle(12, 14, 1.2).fillCircle(20, 17, 1);
    this.tweens.add({ targets: g, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: (px + py) % 700 });
  }

  private setStump(key: string, isStump: boolean) {
    const t = this.trees.get(key) ?? this.rocks.get(key);
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
      container.add([shadow, body, label]);
      const view: PlayerView = { container, body };
      this.players.set(sessionId, view);

      if (isMe) this.cameras.main.startFollow(container, true, 0.15, 0.15);

      // Positions update once per server tick; glide to the new tile over one tick.
      $(player).listen("x", () => this.moveTo(view, player, isMe));
      $(player).listen("y", () => this.moveTo(view, player, isMe));
      $(player).listen("action", (action: string) => this.setAction(view, player, action));
      this.updateHud();
    });

    $(room.state).players.onRemove((_player: any, sessionId: string) => {
      this.players.get(sessionId)?.container.destroy();
      this.players.delete(sessionId);
      this.updateHud();
    });
  }

  private moveTo(view: PlayerView, player: any, isMe: boolean) {
    const [tx, ty] = this.tileCenter(player.x, player.y);
    if (view.container.x === tx && view.container.y === ty) return;
    view.tween?.stop();
    view.tween = this.tweens.add({ targets: view.container, x: tx, y: ty, duration: TICK_MS, ease: "Linear" });
    view.container.setDepth(10 + player.y + 0.5);
    if (isMe && this.marker.visible && this.marker.x === tx && this.marker.y === ty) this.marker.setVisible(false);
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

    if (action === "chopping" || action === "mining" || action === "smelting" || action === "smithing" || action === "cooking") {
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
    return levelForXp(this.skillXp[r.skill] ?? 0) < r.level ? ` (${findSkill(r.skill).def.name} level ${r.level})` : "";
  }

  private isStandingTree(x: number, y: number) {
    return this.trees.has(treeKey(x, y)) && !this.room?.state.depleted.has(treeKey(x, y));
  }

  private isFullRock(x: number, y: number) {
    return this.rocks.has(treeKey(x, y)) && !this.room?.state.depleted.has(treeKey(x, y));
  }

  private onClick(pointer: Phaser.Input.Pointer) {
    const { x, y } = this.tileAt(pointer);
    closeShop(); // clicking the map walks away from the shop
    closeCraft();
    closeInfo();
    closeDialog();
    const npc = npcAt(x, y);
    if (npc) {
      this.room?.send("talk", { id: npc.id });
    } else if (this.isStandingTree(x, y)) {
      this.room?.send("chop", { x, y });
    } else if (this.isFullRock(x, y)) {
      this.room?.send("mine", { x, y });
    } else if (isFishingSpot(x, y)) {
      this.room?.send("fish", { x, y });
    } else if (isWalkable(x, y)) {
      this.room?.send("move", { x, y });
    } else {
      return;
    }
    this.marker.setPosition(...this.tileCenter(x, y)).setVisible(true);
  }

  private onHover(pointer: Phaser.Input.Pointer) {
    const { x, y } = this.tileAt(pointer);
    const key = treeKey(x, y);
    const npc = npcAt(x, y);
    if (npc) {
      setHoverText(npc.kind === "station" ? "Use" : "Talk-to", npc.name, pointer.x, pointer.y);
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
    } else if (isFishingSpot(x, y)) {
      const type = fishAt(x, y)!;
      setHoverText("Fish", RESOURCES[type].node + this.lockNote(type), pointer.x, pointer.y);
    } else if (isWalkable(x, y)) {
      setHoverText("Walk here", "", pointer.x, pointer.y);
    } else {
      setHoverText(null);
    }
    this.input.setDefaultCursor(npc || this.isStandingTree(x, y) || this.isFullRock(x, y) || isFishingSpot(x, y) ? "pointer" : "default");
  }

  private tileCenter(x: number, y: number): [number, number] {
    return [x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2];
  }

  private updateHud() {
    this.hud.textContent = `${this.players.size} player(s) online`;
  }
}
