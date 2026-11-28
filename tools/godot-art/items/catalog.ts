// Every item model, in gallery order.
import { ItemDef } from "./kit";
import { WEAPON_DEFS } from "./weapons";
import { TOOL_DEFS } from "./tools";
import { ARMOR_DEFS } from "./armor";
import { RESOURCE_DEFS } from "./resources";
import { CONSUMABLE_DEFS } from "./consumables";
import { TREASURE_DEFS } from "./treasures";

export const ITEMS: ItemDef[] = [...TOOL_DEFS, ...WEAPON_DEFS, ...ARMOR_DEFS, ...RESOURCE_DEFS, ...CONSUMABLE_DEFS, ...TREASURE_DEFS];
