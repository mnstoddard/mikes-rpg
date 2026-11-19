import Phaser from "phaser";
import { getStateCallbacks, Room } from "colyseus.js";
import { MAP, MAP_HEIGHT, MAP_WIDTH, TICK_MS, TILE_SIZE, Tile, isWalkable } from "../../shared/map";
import { RESOURCES, ResourceId, fishAt, isFishingSpot, nodeAt, treeKey } from "../../shared/foraging";
import { MasteryXp, emptyMastery, masteryLevelForXp } from "../../shared/mastery";
import { ItemId } from "../../shared/items";
import { joinWorld } from "./network";
import { closeShop, flashDiscipline, flashMastery, renderMastery, openShop, renderCoins, renderDisciplines, renderInventory, renderLocks, setHoverText, setInventoryActions, showMessage } from "./ui";
import { NPCS, npcAt } from "../../shared/npcs";
import { DISCIPLINES, DisciplineId, DisciplineXp, SkillId, findSkill } from "../../shared/disciplines";
import { showLogin } from "./login";

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
  private mastery: MasteryXp = emptyMastery();

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

    this.hud.textContent = "Log in to play";
    this.room = await showLogin(joinWorld);

    const room = this.room;
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
    room.onMessage("mastery", (mastery: MasteryXp) => {
      this.mastery = mastery;
      renderMastery(mastery);
    });
    room.onMessage("masteryup", (msg: { skill: SkillId; level: number }) => this.celebrateMastery(msg.skill, msg.level));
    setInventoryActions({
      drop: (slot) => room.send("drop", { slot }),
      sell: (slot) => room.send("sell", { slot }),
      sellAll: () => room.send("sellAll"),
      lock: (slot, locked) => room.send("lock", { slot, locked }),
    });
    room.onMessage("locks", (slots: boolean[]) => renderLocks(slots));
    room.onMessage("inventory", (items: (ItemId | null)[]) => renderInventory(items));
    room.onMessage("coins", (coins: number) => renderCoins(coins));
    room.onMessage("shop", () => {
      this.marker.setVisible(false);
      openShop();
    });
    this.listenToState(room);
    room.send("ready");

    // A mouse click acts the moment you press. A finger acts on release, so a
    // pinch or a wobbly finger isn't read as a tap.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => { if (!p.wasTouch && p.leftButtonDown()) this.onClick(p); });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => { if (p.wasTouch) this.onPointerUp(p); });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => { if (!p.wasTouch) this.onHover(p); });
    this.input.on("gameout", () => setHoverText(null));
    room.onLeave(() => { this.hud.textContent = "Disconnected from server."; });
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
      const [cx, cy] = this.tileCenter(npc.x, npc.y);
      const c = this.add.container(cx, cy).setDepth(10 + npc.y + 0.5);
      const shadow = this.add.ellipse(0, 10, 20, 8, 0x000000, 0.3);
      const body = this.add.circle(0, 0, 10, npc.color).setStrokeStyle(2, 0x000000);
      const hat = this.add.graphics();
      hat.fillStyle(0x3b2410).fillRect(-9, -12, 18, 3).fillRect(-6, -18, 12, 7);
      const bag = this.add.text(11, 2, "💰", { fontSize: "13px" }).setOrigin(0.5);
      const label = this.add.text(0, -28, npc.name, {
        fontSize: "12px", color: "#7fe0ff", stroke: "#000", strokeThickness: 3,
      }).setOrigin(0.5);
      c.add([shadow, body, hat, bag, label]);
      // A little idle bob so he looks alive.
      this.tweens.add({ targets: [body, hat], y: "-=2", duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
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
      if (RESOURCES[type].mastery >= 40) {
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
      const big = RESOURCES[type].mastery >= 35 ? 13 : 11; // the rare ones are bigger
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

    if (action === "chopping" || action === "mining") {
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

  private celebrateMastery(skill: SkillId, level: number) {
    const name = findSkill(skill).def.name;
    this.time.delayedCall(350, () => this.floatText(`${name} Mastery ${level}!`, "#7fd0ff", true));
    flashMastery(skill);
  }

  /** " (Mastery 20)" if you can't gather this type yet, else "". */
  private lockNote(type: ResourceId) {
    const r = RESOURCES[type];
    return masteryLevelForXp(this.mastery[r.skill] ?? 0) < r.mastery ? ` (Mastery ${r.mastery})` : "";
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
      setHoverText("Talk-to", npc.name, pointer.x, pointer.y);
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
