// Exports chicken.glb next to the Godot sample. Run: node build_chicken.mjs
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync } from 'node:fs';
import { buildChicken } from './chicken_model.mjs';

globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then(r => { this.result = r; this.onloadend && this.onloadend(); }); }
  readAsDataURL(b) { b.arrayBuffer().then(r => { this.result = 'data:' + b.type + ';base64,' + Buffer.from(r).toString('base64'); this.onloadend && this.onloadend(); }); }
};

const { root, clips } = buildChicken(THREE);
let tris = 0;
root.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
const out = new URL('../chicken.glb', import.meta.url);
new GLTFExporter().parse(root, glb => {
  writeFileSync(out, Buffer.from(glb));
  console.log('wrote', out.pathname, glb.byteLength, 'bytes,', tris, 'tris,', clips.map(c => c.name).join(', '));
}, e => { console.error(e); process.exit(1); }, { binary: true, animations: clips });
