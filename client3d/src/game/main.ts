// The 3D game starts here (see world.ts).
import "../../../client/src/report"; // 🐞 button; starts noting errors right away
import { World3D } from "./world";

const world = new World3D(document.getElementById("game")!);
void world.start();
