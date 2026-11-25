// Sample scenes for the Environment Gallery: small places that put the
// pieces together, one for each kind of place in Embervale. Every piece uses
// the variant Mike has picked for it, so he sees his choices side by side.
import * as THREE from "three";
import { EnvPiece, SceneId, TILE, WALL_H, createEnv, house, chimney } from "../environment";

export interface Pick {
  (id: string): { variant: number; seed: number };
}

export interface BuiltScene {
  group: THREE.Group;
  pieces: EnvPiece[];
  /** Where the camera looks, and from how far. */
  target: THREE.Vector3;
  dist: number;
  dir: THREE.Vector3;
  /** Inside places and caves: dim light, no sky. */
  inside?: "cave" | "room";
  fog?: { color: number; near: number; far: number };
  /** The scene's usual weather style (left out: clear). */
  weather?: number;
  /** Where the stand-in person stands. */
  personAt?: [number, number];
}

export function buildScene(id: SceneId, pick: Pick): BuiltScene {
  const group = new THREE.Group();
  const pieces: EnvPiece[] = [];
  /** Add a piece, tagged with its id so clicking it in the scene selects it. */
  const put = (envId: string, o: { x0?: number; z0?: number; w?: number; d?: number; length?: number } = {}, at: [number, number, number] = [0, 0, 0], ry = 0, variant?: number) => {
    const p = pick(envId);
    const piece = createEnv(envId, { ...p, ...(variant !== undefined ? { variant } : {}), ...o });
    piece.object.position.set(...at);
    piece.object.rotation.y = ry;
    piece.object.userData.envId = envId;
    group.add(piece.object);
    pieces.push(piece);
    return piece;
  };
  /** Ground: a rectangle from (x0, z0) to (x1, z1). */
  const ground = (envId: string, x0: number, z0: number, x1: number, z1: number, variant?: number) => put(envId, { x0, z0, w: x1 - x0, d: z1 - z0 }, [0, 0, 0], 0, variant);
  /** An ornament on a wall face at (x, y, z), facing direction ry. */
  const hang = (envId: string, x: number, y: number | null, z: number, ry = 0) => {
    const p = put(envId, {}, [x, 0, z], ry) as EnvPiece & { mountY?: number };
    p.object.position.y = y ?? p.mountY ?? 0;
    return p;
  };
  const houseAt = (o: Parameters<typeof house>[0], wallId: string, roofId: string | null, x: number, z: number, ry = 0) => {
    const h = house(o);
    h.piece.object.position.set(x, 0, z);
    h.piece.object.rotation.y = ry;
    // Clicking the walls picks the wall; clicking the roof picks the roof.
    h.piece.object.children.forEach((c, i, all) => (c.userData.envId = roofId && i === all.length - 1 && !o.noRoof ? roofId : wallId));
    group.add(h.piece.object);
    pieces.push(h.piece);
    return h;
  };
  const wallSpec = (envId: string) => ({ wall: envId.replace("wall-", "") as "timber", wallVariant: pick(envId).variant });
  const roofSpec = (envId: string) => ({ roof: envId.replace("roof-", "") as "tile", roofVariant: pick(envId).variant });

  let target = new THREE.Vector3(0, 1, 0), dist = 22;
  let dir = new THREE.Vector3(0.35, 0.55, 1);
  let inside: BuiltScene["inside"];
  let fog: BuiltScene["fog"];
  let personAt: BuiltScene["personAt"];
  let weather: number | undefined;

  if (id === "town") {
    ground("ground-cobble", -10, -4, 10, 3);
    ground("ground-grass", -10, 3, 10, 8);
    ground("ground-grass", -10, -12, 10, -4);
    // A timber-frame shop and a stone house facing the street.
    const a = houseAt({ tw: 3, td: 2, ...wallSpec("wall-timber"), ...roofSpec("roof-tile"), seed: 3 }, "wall-timber", "roof-tile", -5, -6.15);
    const cz = chimney(1.6, WALL_H + 0.6, -0.6, 4);
    cz.userData.envId = "roof-tile";
    a.piece.object.add(cz);
    const f = -6.15 + a.front;
    put("wall-door", {}, [-5, 0, f], 0);
    hang("orn-window", -7.2, null, f);
    hang("orn-window", -2.8, null, f);
    hang("orn-flowerbox", -7.2, 0.95, f);
    hang("orn-flowerbox", -2.8, 0.95, f);
    hang("orn-lantern", -4.1, 2.25, f);
    hang("orn-sign", -8, 2.5, f);
    hang("orn-vines", -7.7, 0, f + 0.02).object.scale.set(0.7, 0.9, 1);
    const b = houseAt({ tw: 3, td: 2, ...wallSpec("wall-stone"), ...roofSpec("roof-tile"), seed: 9 }, "wall-stone", "roof-tile", 5, -6.15);
    const fb = -6.15 + b.front;
    put("wall-door", {}, [4, 0, fb], 0);
    hang("orn-awning", 4, 2.75, fb);
    hang("orn-window", 6.6, null, fb);
    hang("orn-banner", 2.4, 2.7, fb);
    hang("orn-lantern", 5.05, 2.25, fb);
    put("decor-well", {}, [0, 0, -1.2]);
    put("decor-lamp", {}, [-9, 0, 2.2]);
    put("decor-lamp", {}, [8.6, 0, 2.2]);
    put("decor-barrels", {}, [8.4, 0, -3.2], -0.3);
    put("wall-hedge", { length: 6 }, [-6, 0, 6.6]);
    put("decor-bush", {}, [3.2, 0, 5.6]);
    put("decor-flowers", {}, [1, 0, 4.6]);
    put("decor-flowers", {}, [6.5, 0, 5]);
    put("decor-tufts", {}, [-1.5, 0, 6]);
    put("decor-tufts", {}, [8.5, 0, 6.6]);
    put("sky-clouds");
    target = new THREE.Vector3(0, 2, -2);
    dist = 24;
  } else if (id === "farm") {
    ground("ground-grass", -12, -12, 12, 9);
    ground("ground-field", -10, -2, -1, 6);
    ground("ground-path", 0, -12, 2, 9);
    // Fence round the field, with a gate on the path side.
    put("wall-fence", { length: 10 }, [-5.5, 0, -2.6]);
    put("wall-fence", { length: 10 }, [-5.5, 0, 6.6]);
    put("wall-fence", { length: 8 }, [-10.5, 0, 2], Math.PI / 2);
    put("wall-fence", { length: 2 }, [-0.5, 0, -0.6], Math.PI / 2);
    put("wall-gate", {}, [-0.5, 0, 2.4], Math.PI / 2);
    put("wall-fence", { length: 2 }, [-0.5, 0, 5.4], Math.PI / 2);
    const h = houseAt({ tw: 3, td: 2, ...wallSpec("wall-plank"), ...roofSpec("roof-thatch"), seed: 21 }, "wall-plank", "roof-thatch", 6.5, -7);
    const f = -7 + h.front;
    put("wall-door", {}, [6.5, 0, f], 0, 0);
    hang("orn-window", 4.3, null, f);
    hang("orn-window", 8.7, null, f);
    hang("orn-flowerbox", 4.3, 0.95, f);
    put("decor-well", {}, [5, 0, 0.5]);
    put("decor-barrels", {}, [9.5, 0, -3.5]);
    put("wall-hedge", { length: 10 }, [-6, 0, -9]);
    put("decor-signpost", {}, [2.8, 0, 6], -0.4, 1);
    put("decor-bush", {}, [10, 0, 4]);
    put("decor-flowers", {}, [4.5, 0, 5]);
    put("decor-flowers", {}, [-4, 0, 8]);
    put("decor-tufts", {}, [8, 0, 7]);
    put("decor-tufts", {}, [-9, 0, -5]);
    put("sky-clouds");
    target = new THREE.Vector3(-1, 1, -0.5);
    dist = 27;
    dir = new THREE.Vector3(0.45, 0.6, 1);
  } else if (id === "coast") {
    put("water-sea", {}, [0, 0, 2]);
    ground("ground-grass", -7, -9, 7, -4);
    put("decor-tufts", {}, [-4, 0, -6]);
    put("decor-tufts", {}, [3.5, 0, -6.5]);
    put("decor-reeds", {}, [5.5, 0, -5.2]);
    put("decor-rocks", {}, [-4.5, 0, -0.5]);
    put("decor-rocks", {}, [4, 0, -1.6], 0, 2);
    put("decor-beach", {}, [0, 0, -1.8]);
    put("decor-beach", {}, [-1.8, 0, -2.6], 1, 1);
    put("decor-beach", {}, [2.2, 0, -0.6]);
    put("sky-clouds");
    personAt = [-1, -3.4];
    target = new THREE.Vector3(0, 0, 0);
    dist = 20;
    dir = new THREE.Vector3(0.2, 0.5, -1);
  } else if (id === "thornwood") {
    ground("ground-withered", -10, -10, 10, 8);
    ground("ground-path", -1, -10, 1, 8, 0);
    put("wall-fence", { length: 8 }, [-5, 0, 6.6]);
    put("wall-gate", {}, [0, 0, 6.6]);
    put("wall-fence", { length: 8 }, [5, 0, 6.6]);
    put("decor-signpost", {}, [1.8, 0, 7.4], 0.3, 0);
    // A ruined wall with thorny vines.
    put("wall-stone", { length: 4 }, [-6, 0, -5], 0.3);
    hang("orn-vines", -6.5, 0, -4.7, 0.3);
    put("wall-barricade", { length: 4 }, [6, 0, -7], -0.4);
    put("decor-grave", {}, [5, 0, -1.5], 0, 0);
    put("decor-grave", {}, [6.6, 0, -1.6], 0, 1);
    put("decor-grave", {}, [8.2, 0, -1.4], 0, 2);
    put("decor-bramble", {}, [-3, 0, 3]);
    put("decor-bramble", {}, [3, 0, 2], 0, 1);
    put("decor-bramble", {}, [-7, 0, 1]);
    put("decor-mushrooms", {}, [-2.5, 0, -2]);
    put("decor-mushrooms", {}, [2.5, 0, -4.5], 0, 2);
    put("decor-log", {}, [-5, 0, -1], 0.6);
    put("decor-rocks", {}, [7, 0, 3]);
    put("decor-tufts", {}, [-8, 0, 5], 0, 2);
    weather = 1; // fog
    target = new THREE.Vector3(0, 1, -0.5);
    dist = 24;
  } else if (id === "cave") {
    ground("floor-cave", -7, -6, 3, 5);
    ground("floor-crystal", 3, -6, 7, 5);
    put("wall-cave", { length: 14 }, [0, 0, -6.3]);
    put("wall-cave", { length: 11 }, [-7.3, 0, -0.5], Math.PI / 2);
    put("wall-cave", { length: 11 }, [7.3, 0, -0.5], -Math.PI / 2);
    hang("orn-torch", -3.5, null, -5.7);
    hang("orn-torch", 2.5, null, -5.7);
    hang("orn-torch", -6.7, null, 1.5, Math.PI / 2);
    put("decor-rocks", {}, [-4, 0, 1.5]);
    put("decor-rocks", {}, [1.5, 0, 3], 0, 1);
    put("decor-mushrooms", {}, [-5.5, 0, -3.5], 0, 2);
    put("decor-barrels", {}, [-5.2, 0, 3.2], 0.4, 1);
    inside = "cave";
    target = new THREE.Vector3(0, 1, -0.5);
    dist = 17;
    dir = new THREE.Vector3(0.15, 0.6, 1);
  } else if (id === "house") {
    ground("floor-boards", -5, -4, 5, 4);
    ground("floor-rug", -2, -1.2, 2, 1.2);
    // Three walls; the front is left open so you can look in.
    put("wall-plank", { length: 10.6 }, [0, 0, -4.15]);
    put("wall-plank", { length: 8 }, [-5.15, 0, 0], Math.PI / 2);
    put("wall-plank", { length: 8 }, [5.15, 0, 0], -Math.PI / 2);
    hang("orn-window", -1.6, null, -4);
    hang("orn-window", 2.6, null, -4);
    hang("orn-lantern", 0.5, 2.3, -4);
    put("wall-door", {}, [5, 0, 1.5], -Math.PI / 2);
    hang("orn-lantern", -5, 2.3, 0.5, Math.PI / 2);
    put("decor-barrels", {}, [-3.8, 0, -2.8], 0, 0);
    put("decor-barrels", {}, [3.6, 0, -2.8], 0, 1);
    inside = "room";
    target = new THREE.Vector3(0, 1.1, -0.5);
    dist = 15;
    dir = new THREE.Vector3(0.25, 0.6, 1);
  } else if (id === "hall") {
    ground("floor-marble", -7, -5, -2, 5);
    ground("floor-marble", 2, -5, 7, 5);
    ground("floor-glow", -2, -5, 2, -1);
    ground("floor-rug", -1, -1, 1, 5, 1);
    ground("floor-marble", -2, -1, -1, 5);
    ground("floor-marble", 1, -1, 2, 5);
    put("wall-marble", { length: 14.6 }, [0, 0, -5.15]);
    put("wall-marble", { length: 10 }, [7.15, 0, 0], -Math.PI / 2);
    put("wall-guild", { length: 10 }, [-7.15, 0, 0], Math.PI / 2);
    put("decor-statue", {}, [0, 0, -3]);
    hang("orn-banner", -4, null, -5);
    hang("orn-banner", 4, null, -5);
    hang("orn-banner", -7, null, -1.5, Math.PI / 2);
    hang("orn-lantern", -7, 2.3, 2, Math.PI / 2);
    hang("orn-lantern", 7, 2.3, 2, -Math.PI / 2);
    put("decor-lamp", {}, [5.5, 0, 3.5]);
    inside = "room";
    target = new THREE.Vector3(0, 1.4, -0.5);
    dist = 19;
    dir = new THREE.Vector3(0.2, 0.55, 1);
  } else if (id === "river") {
    put("water-river", {}, [0, 0, 0]);
    ground("ground-grass", -14, -10, -10, 8);
    ground("ground-grass", 10, -10, 14, 8);
    ground("ground-grass", -10, -10, 10, -4.5);
    ground("ground-grass", -10, 4.5, 10, 8);
    put("wall-bridge", {}, [1.5, 0, 0]);
    ground("ground-path", 0.5, 4.5, 2.5, 8);
    ground("ground-path", 0.5, -10, 2.5, -4.5);
    put("wall-cliff", { length: 28 }, [0, 0, -10]);
    put("decor-reeds", {}, [-3.5, 0, 2.8]);
    put("decor-reeds", {}, [4, 0, -3]);
    put("decor-rocks", {}, [-7, 0, -6]);
    put("decor-log", {}, [8, 0, 5], 0.4);
    put("decor-bush", {}, [-8, 0, 4]);
    put("decor-flowers", {}, [-5.5, 0, 6]);
    put("decor-flowers", {}, [6.5, 0, -6]);
    put("decor-tufts", {}, [5.5, 0, 2]);
    put("decor-tufts", {}, [-6, 0, -2.5]);
    put("sky-clouds");
    target = new THREE.Vector3(0, 0.5, -1);
    dist = 24;
  }
  void TILE;
  return { group, pieces, target, dist, dir: dir.normalize(), inside, fog, personAt, weather };
}
