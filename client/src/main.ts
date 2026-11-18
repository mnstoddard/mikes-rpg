import Phaser from "phaser";
import { WorldScene } from "./WorldScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: document.body,
  backgroundColor: "#1b3a4b",
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [WorldScene],
});
