// Runs in a headless browser: builds every catalog object and turns it into .glb bytes.
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { CATALOG, EXPORT_SEED } from "./index.js";
import { triCount } from "./lib.js";

window.exportOne = async (id, variant) => {
  const item = CATALOG.find((c) => c.id === id);
  const obj = item.make(EXPORT_SEED, variant);
  // glTF JSON with everything embedded; export.mjs packs it into a .glb and
  // swaps the library textures for links to the shared files
  const gltf = await new GLTFExporter().parseAsync(obj, { binary: false, onlyVisible: true });
  return { json: JSON.stringify(gltf), tris: triCount(obj) };
};
window.listAll = () => CATALOG.map((c) => ({ id: c.id, name: c.name, group: c.group, variants: c.variants }));
