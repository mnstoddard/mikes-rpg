import Phaser from "phaser";
import { getStateCallbacks, Room } from "colyseus.js";
import { MAP, MAP_HEIGHT, MAP_WIDTH, TICK_MS, TILE_SIZE, Tile, isWalkable } from "../../shared/map";
import { joinWorld } from "./network";

const TILE_COLORS: Record<Tile, number> = {
  grass: 0x4a8f3c, path: 0xb89b6a, water: 0x2d6fa3, tree: 0x2e5e22, rock: 0x7d7d7d, bridge: 0x8b5a2b,
};

interface PlayerView {
  container: Phaser.GameObjects.Container;
  tween?: Phaser.Tweens.Tween;
}

export class WorldScene extends Phaser.Scene {
  private room?: Room;
  private players = new Map<string, PlayerView>();
  private marker!: Phaser.GameObjects.Text;
  private hud = document.getElementById("hud")!;

  constructor() { super("world"); }

  async create() {
    this.drawMap();
    this.marker = this.add.text(0, 0, "✕", { fontSize: "20px", color: "#ffeb3b" })
      .setOrigin(0.5).setDepth(5).setVisible(false);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    const name = new URLSearchParams(location.search).get("name")
      ?? prompt("Pick a name", "")?.trim() ?? "";

    try {
      this.room = await joinWorld(name);
    } catch (err) {
      this.hud.textContent = "Couldn't reach the game server. Is it running?";
      console.error(err);
      return;
    }

    this.listenToState(this.room);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onClick(p));
    this.room.onLeave(() => { this.hud.textContent = "Disconnected from server."; });
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
          g.fillStyle(0x5b3a1e).fillRect(px + 13, py + 18, 6, 12);
          g.fillStyle(TILE_COLORS.tree).fillCircle(px + 16, py + 13, 11);
        } else if (t === "rock") {
          g.fillStyle(TILE_COLORS.rock).fillEllipse(px + 16, py + 18, 26, 20);
        } else if (t === "bridge") {
          g.lineStyle(2, 0x5c3a1a).lineBetween(px, py + 10, px + TILE_SIZE, py + 10)
            .lineBetween(px, py + 22, px + TILE_SIZE, py + 22);
        }
      }
    }
  }

  private listenToState(room: Room) {
    const $ = getStateCallbacks(room);
    $(room.state).players.onAdd((player: any, sessionId: string) => {
      const isMe = sessionId === room.sessionId;
      const container = this.add.container(...this.tileCenter(player.x, player.y)).setDepth(10);
      const shadow = this.add.ellipse(0, 10, 20, 8, 0x000000, 0.3);
      const body = this.add.circle(0, 0, 10, player.color).setStrokeStyle(2, isMe ? 0xffffff : 0x000000);
      const label = this.add.text(0, -24, player.name, {
        fontSize: "12px", color: isMe ? "#ffeb3b" : "#ffffff", stroke: "#000", strokeThickness: 3,
      }).setOrigin(0.5);
      container.add([shadow, body, label]);
      const view: PlayerView = { container };
      this.players.set(sessionId, view);

      if (isMe) this.cameras.main.startFollow(container, true, 0.15, 0.15);

      // Positions update once per server tick; glide to the new tile over one tick.
      $(player).onChange(() => {
        const [tx, ty] = this.tileCenter(player.x, player.y);
        view.tween?.stop();
        view.tween = this.tweens.add({ targets: container, x: tx, y: ty, duration: TICK_MS, ease: "Linear" });
        container.setDepth(10 + player.y);
        if (isMe && this.marker.visible && this.marker.x === tx && this.marker.y === ty) this.marker.setVisible(false);
      });
      this.updateHud();
    });

    $(room.state).players.onRemove((_player: any, sessionId: string) => {
      this.players.get(sessionId)?.container.destroy();
      this.players.delete(sessionId);
      this.updateHud();
    });
  }

  private onClick(pointer: Phaser.Input.Pointer) {
    const x = Math.floor(pointer.worldX / TILE_SIZE);
    const y = Math.floor(pointer.worldY / TILE_SIZE);
    if (!isWalkable(x, y)) return;
    this.room?.send("move", { x, y });
    this.marker.setPosition(...this.tileCenter(x, y)).setVisible(true);
  }

  private tileCenter(x: number, y: number): [number, number] {
    return [x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2];
  }

  private updateHud() {
    this.hud.textContent = `${this.players.size} player(s) online · click a tile to walk`;
  }
}
