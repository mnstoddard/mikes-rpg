import Phaser from "phaser";
import { WorldScene } from "./WorldScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#2d6fa3", // same blue as the water tiles
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  input: { activePointers: 3 }, // two fingers for pinch-to-zoom
  scene: [WorldScene],
});
