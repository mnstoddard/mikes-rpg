// A small sample scene built only from gallery objects: a Heartvale meadow.
// Repeated small things use instancing (Godot: MultiMeshInstance3D).
import { THREE, rng, triCount, mat } from "./lib.js";
import { CATALOG } from "./index.js";

const make = (id, seed = 7, v = 0) => CATALOG.find((c) => c.id === id).make(seed, v);

/** Draw many copies of an object in one go (one draw call per material). */
function instanced(obj, mats) {
  const g = new THREE.Group();
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = false; im.receiveShadow = true;
    g.add(im);
  });
  return g;
}

export function buildSampleScene() {
  const r = rng(42);
  const root = new THREE.Group();
  let objects = 0;
  const place = (o, x, z, rotY = r() * 6.28, s = 1) => {
    o.position.set(x, 0, z); o.rotation.y = rotY; o.scale.setScalar(s);
    root.add(o); objects++;
    return o;
  };
  const taken = [];
  const free = (x, z, d) => taken.every(([a, b, dd]) => Math.hypot(a - x, b - z) > d + dd);
  const claim = (x, z, d) => taken.push([x, z, d]);

  // the pond
  const pond = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40), new THREE.MeshStandardMaterial({ color: 0x2f9fcf, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(-6, 0.03, 4); pond.scale.set(1.3, 1, 1);
  pond.receiveShadow = true;
  const shore = new THREE.Mesh(new THREE.RingGeometry(5.4, 6.4, 40), new THREE.MeshStandardMaterial({ color: 0xc9a574, roughness: 0.95 }));
  shore.rotation.x = -Math.PI / 2; shore.position.set(-6, 0.02, 4); shore.scale.set(1.3, 1, 1);
  shore.receiveShadow = true;
  root.add(pond, shore);
  claim(-6, 4, 7);
  place(make("plant_lilypads", 3), -5, 3, 0); place(make("plant_lilypads", 9), -8.5, 5.5, 1);
  for (let i = 0; i < 6; i++) { const a = r.range(2.2, 4.4); place(make("plant_reeds", i + 1), -6 + Math.cos(a) * 7.3, 4 + Math.sin(a) * 5.7); }

  // the cliff with ore rocks in front of it
  place(make("rock_cliff", 5), 4, -12, 0.2, 2.2); claim(4, -12, 6);
  place(make("rock_cliff", 11), -5, -13, -0.3, 1.8); claim(-5, -13, 5);
  const ores = ["ore_copper", "ore_tin", "ore_iron", "ore_coal"];
  ores.forEach((id, i) => { const x = -6 + i * 4, z = -6.5; place(make(id, 7 + i, i % 2), x, z); claim(x, z, 1.6); });

  // the grove
  const trees = ["tree_oak", "tree_oak", "tree_birch", "tree_maple", "tree_pine", "tree_pine", "tree_birch", "tree_oak", "tree_pine", "tree_maple"];
  let tries = 0, ti = 0;
  while (ti < trees.length && tries++ < 400) {
    const a = r() * 6.28, d = r.range(11, 22);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (z < -9 || !free(x, z, 3)) continue;
    place(make(trees[ti], 10 + ti), x, z, r() * 6.28, r.range(0.85, 1.1));
    claim(x, z, 3); ti++;
  }
  // rocks and bushes
  for (let i = 0; i < 10; i++) {
    const x = r.range(-20, 20), z = r.range(-9, 20);
    if (!free(x, z, 1.5)) continue;
    const id = r.pick(["rock_boulder", "rock_cluster", "plant_bush", "plant_bush", "plant_fern", "plant_mushroom"]);
    place(make(id, i + 30, id === "plant_bush" ? r.int(0, 2) : 0), x, z);
    claim(x, z, 1.2);
  }

  // grass and flowers: hundreds of copies as instances
  const grassM = [], tallM = [], flowerM = [[], [], []];
  const m4 = (x, z, s) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(s, s, s));
  for (let i = 0; i < 900; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * 28;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot((x + 6) / 1.3, z - 4) < 5.6) continue; // not in the pond
    const k = r();
    if (k < 0.7) grassM.push(m4(x, z, r.range(0.8, 1.3)));
    else if (k < 0.82) tallM.push(m4(x, z, r.range(0.8, 1.1)));
    else flowerM[r.int(0, 2)].push(m4(x, z, r.range(0.8, 1.2)));
  }
  root.add(instanced(make("plant_grass", 1, 0), grassM));
  root.add(instanced(make("plant_grass", 2, 1), tallM));
  flowerM.forEach((ms, i) => root.add(instanced(make("plant_flowers", 4 + i, i), ms)));
  objects += grassM.length + tallM.length + flowerM.flat().length;

  let calls = 0, tris = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    calls++;
    const t = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    tris += t * (o.isInstancedMesh ? o.count : 1);
  });
  root.userData.stats = { objects, calls, tris: Math.round(tris) };
  return root;
}
