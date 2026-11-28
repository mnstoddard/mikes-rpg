// Runs in a headless browser: builds every catalog object and turns it into .glb bytes.
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { CATALOG, EXPORT_SEED } from "./index.js";
import { triCount } from "./lib.js";

window.exportOne = async (id, variant) => {
  const item = CATALOG.find((c) => c.id === id);
  const obj = item.make(EXPORT_SEED, variant);
  const glb = await new GLTFExporter().parseAsync(obj, { binary: true, onlyVisible: true });
  const bytes = new Uint8Array(glb);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { b64: btoa(s), tris: triCount(obj) };
};
window.listAll = () => CATALOG.map((c) => ({ id: c.id, name: c.name, group: c.group, variants: c.variants }));
