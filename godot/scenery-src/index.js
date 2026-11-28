// The full catalog of scenery. Each entry: id (also the .glb file name),
// name, group, variants, make(seed, variant) -> THREE.Group, and a note.
import { TREES } from "./trees.js";
import { ROCKS, ORE_NODES } from "./rocks.js";
import { PLANTS } from "./plants.js";
import { STATIONS } from "./stations.js";
import { PROPS, FENCES } from "./props.js";
import { BUILDINGS } from "./buildings.js";

export const CATALOG = [...TREES, ...ROCKS, ...ORE_NODES, ...PLANTS, ...BUILDINGS, ...STATIONS, ...FENCES, ...PROPS];
export const GROUPS = [...new Set(CATALOG.map((c) => c.group))];
/** The seed used for the exported .glb files (so files match the gallery's first look). */
export const EXPORT_SEED = 7;
