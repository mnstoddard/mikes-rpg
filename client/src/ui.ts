// The game's windows and panels, shared by the 2D and 3D clients.
//
// Each window lives in its own file under client/src/ui/ (bag, shop, crafting, quests...).
// This file gathers what the rest of the game uses, and draws the panels once at load.
export { openPanel, setRenownActions, setRenown, setGemActions, renderJewels, setDiscovered, serverNow, setServerOffset, setBuffs, tickBuffs, nightSightOn } from "./ui/core";
export { renderDisciplines, renderCombatMastery, flashCombatMastery, renderSkillXp, renderTreeRanks, renderMastery, flashDiscipline, flashSkillRow, flashMastery } from "./ui/skills";
export { logDialogue, showMessage, recentMessages } from "./ui/messages";
export type { MessageKind } from "./ui/messages";
export { setFarmActions, setFarm, setInventoryActions, renderBag, renderBelt, renderGear, setSpellbook, castSlot, renderInventory, renderCoins } from "./ui/bag";
export { setRepairActions, closeRepair, showRepairs } from "./ui/repair";
export { openShop, closeShop, askAmount, closeAmount } from "./ui/shop";
export type { AmountAsk } from "./ui/shop";
export { setAltarActions, openCraft, closeCraft } from "./ui/craft";
export { forgetBounties, setBountyActions, showBounties, closeBounties, setGuildActions, showGuild, closeGuild, showChest, closeChest } from "./ui/guild";
export { closeInfo } from "./ui/info";
export { renderStamina, setTithe, renderVitals, setHoverText } from "./ui/vitals";
export { forgetQuest, setQuestActions, renderTracked, renderQuest, openDialog, closeDialog } from "./ui/quests";
export { setAccountActions, renderMe, openSettings, closeSettings, accountResult, resetForSignOut } from "./ui/settings";
export { setPartyActions, renderParty, showPartyInvite, addPartyChat } from "./ui/party";
export type { PartyMember } from "./ui/party";

import { openPanel, isSmallScreen } from "./ui/core";
import { renderDisciplines, lastDisciplines } from "./ui/skills";
import { renderFilters } from "./ui/messages";
import { renderBelt, lastBelt, renderGear, lastGear, lastSpell, renderCoins } from "./ui/bag";
import { renderStamina } from "./ui/vitals";
import { MAX_STAMINA } from "../../shared/cooking";

// Draw everything once at load (after every window's file has loaded).
openPanel(isSmallScreen() ? "" : "inventory");
renderDisciplines(lastDisciplines);
renderFilters();
renderBelt(lastBelt);
renderGear(lastGear, lastSpell);
renderCoins(0);
renderStamina(MAX_STAMINA, MAX_STAMINA);
