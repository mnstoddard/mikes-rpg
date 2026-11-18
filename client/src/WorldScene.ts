import Phaser from "phaser";
import { getStateCallbacks, Room } from "colyseus.js";
import { MAP, MAP_HEIGHT, MAP_WIDTH, TICK_MS, TILE_SIZE, Tile, isWalkable } from "../../shared/map";
import { treeKey } from "../../shared/foraging";
import { ItemId } from "../../shared/items";
import { joinWorld } from "./network";
import { renderInventory, setHoverText, showMessage } from "./ui";
import { showLogin } from "./login";

const TILE_COLORS: Record<Tile, number> = {
  grass: 0x4a8f3c, path: 0xb89b6a, water: 0x2d6fa3, tree: 0x2e5e22, rock: 0x7d7d7d, bridge: 0x8b5a2b,
};

interface PlayerView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  tween?: Phaser.Tweens.Tween;
  chopTween?: Phaser.Tweens.Tween;
}

interface TreeView { tree: Phaser.GameObjects.Graphics; stump: Phaser.GameObjects.Graphics }

export class WorldScene extends Phaser.Scene {
  private room?: Room;
  private players = new Map<string, PlayerView>();
  private trees = new Map<string, TreeView>();
  private marker!: Phaser.GameObjects.Text;
  private hud = document.getElementById("hud")!;

  constructor() { super("world"); }

  async create() {
    this.drawMap();
    this.marker = this.add.text(0, 0, "✕", { fontSize: "20px", color: "#ffeb3b" })
      .setOrigin(0.5).setDepth(500).setVisible(false);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    renderInventory([], () => {});

    this.hud.textContent = "Log in to play";
    this.room = await showLogin(joinWorld);

    const room = this.room;
    room.onMessage("message", (text: string) => showMessage(text));
    room.onMessage("inventory", (items: (ItemId | null)[]) =>
      renderInventory(items, (slot) => room.send("drop", { slot })));
    this.listenToState(room);
    room.send("ready");

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onClick(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onHover(p));
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
          this.trees.set(treeKey(x, y), this.makeTree(px, py, y));
        } else if (t === "rock") {
          g.fillStyle(TILE_COLORS.rock).fillEllipse(px + 16, py + 18, 26, 20);
        } else if (t === "bridge") {
          g.lineStyle(2, 0x5c3a1a).lineBetween(px, py + 10, px + TILE_SIZE, py + 10)
            .lineBetween(px, py + 22, px + TILE_SIZE, py + 22);
        }
      }
    }
  }

  private makeTree(px: number, py: number, row: number): TreeView {
    const tree = this.add.graphics({ x: px, y: py }).setDepth(10 + row);
    tree.fillStyle(0x5b3a1e).fillRect(13, 18, 6, 12);
    tree.fillStyle(TILE_COLORS.tree).fillCircle(16, 13, 11);
    tree.fillStyle(0x3d7a2e).fillCircle(13, 10, 5);
    const stump = this.add.graphics({ x: px, y: py }).setDepth(10 + row).setVisible(false);
    stump.fillStyle(0x5b3a1e).fillEllipse(16, 24, 14, 8);
    stump.fillStyle(0xc9a26b).fillEllipse(16, 22, 12, 6);
    return { tree, stump };
  }

  private setStump(key: string, isStump: boolean) {
    const t = this.trees.get(key);
    if (!t) return;
    t.tree.setVisible(!isStump);
    t.stump.setVisible(isStump);
  }

  private listenToState(room: Room) {
    const $ = getStateCallbacks(room);

    $(room.state).stumps.onAdd((_respawnAt: number, key: string) => this.setStump(key, true));
    $(room.state).stumps.onRemove((_respawnAt: number, key: string) => this.setStump(key, false));

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
      $(player).listen("action", (action: string) => this.setChopping(view, player, action === "chopping"));
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

  /** Chopping animation: the player lunges toward the tree once per tick. */
  private setChopping(view: PlayerView, player: any, chopping: boolean) {
    view.chopTween?.stop();
    view.chopTween = undefined;
    view.body.setPosition(0, 0);
    if (!chopping) return;
    this.marker.setVisible(false);
    view.chopTween = this.tweens.add({
      targets: view.body,
      x: Math.sign(player.faceX - player.x) * 6,
      y: Math.sign(player.faceY - player.y) * 6,
      duration: TICK_MS / 4, yoyo: true, hold: 30, repeatDelay: TICK_MS / 2 - 30, repeat: -1,
      ease: "Quad.easeOut",
    });
  }

  private tileAt(pointer: Phaser.Input.Pointer) {
    return { x: Math.floor(pointer.worldX / TILE_SIZE), y: Math.floor(pointer.worldY / TILE_SIZE) };
  }

  private isStandingTree(x: number, y: number) {
    return this.trees.has(treeKey(x, y)) && !this.room?.state.stumps.has(treeKey(x, y));
  }

  private onClick(pointer: Phaser.Input.Pointer) {
    const { x, y } = this.tileAt(pointer);
    if (this.isStandingTree(x, y)) {
      this.room?.send("chop", { x, y });
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
    if (this.isStandingTree(x, y)) {
      setHoverText("Chop down", "Tree", pointer.x, pointer.y);
    } else if (this.trees.has(key)) {
      setHoverText("Examine", "Tree stump", pointer.x, pointer.y);
    } else if (isWalkable(x, y)) {
      setHoverText("Walk here", "", pointer.x, pointer.y);
    } else {
      setHoverText(null);
    }
    this.input.setDefaultCursor(this.isStandingTree(x, y) ? "pointer" : "default");
  }

  private tileCenter(x: number, y: number): [number, number] {
    return [x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2];
  }

  private updateHud() {
    this.hud.textContent = `${this.players.size} player(s) online`;
  }
}
