// Parties: the 🚩 panel under your health bars.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { INVITE_MS, PARTY_CHAT_MAX, PARTY_MAX } from "../../../shared/party";
import { el } from "./core";
import { showMessage } from "./messages";
import { staminaEl } from "./vitals";

// ---- Parties (stage 13, shared/party.ts): the 🚩 panel under your health bars ----

export interface PartyMember { id: string; name: string; hp: number; maxHp: number; lead: boolean; me: boolean }

const partyEl = document.getElementById("party")!;

const partyChatLines: { from: string; text: string }[] = [];

let partyMembers: PartyMember[] = [];

let partyIsLead = false;

let invitedBy: { from: string; until: number } | null = null;

let partyActions = { answer: (_yes: boolean) => {}, leave: () => {}, kick: (_id: string) => {}, chat: (_text: string) => {} };

export function setPartyActions(a: typeof partyActions) { partyActions = a; }

export function renderParty(members: PartyMember[], lead: boolean) {
  partyMembers = members;
  partyIsLead = lead;
  drawParty();
}

export function showPartyInvite(from: string) {
  invitedBy = { from, until: Date.now() + INVITE_MS };
  showMessage(`🚩 ${from} invites you to their party. Answer in the 🚩 panel on the left.`);
  drawParty();
  setTimeout(drawParty, INVITE_MS + 100);
}

export function addPartyChat(from: string, text: string) {
  partyChatLines.push({ from, text });
  while (partyChatLines.length > 6) partyChatLines.shift();
  showMessage(`🚩 ${from}: ${text}`, "chat");
  drawParty();
}

// The chat box is kept between redraws so typing isn't lost when health changes.
const partyInput = document.createElement("input");

partyInput.id = "party-input";

partyInput.maxLength = PARTY_CHAT_MAX;

partyInput.placeholder = "Party chat…";

partyInput.onkeydown = (e) => {
  e.stopPropagation();
  if (e.key !== "Enter") return;
  const text = partyInput.value.trim();
  if (text) partyActions.chat(text);
  partyInput.value = "";
};

export function drawParty() {
  if (invitedBy && invitedBy.until < Date.now()) invitedBy = null;
  const inParty = partyMembers.length > 1;
  partyEl.style.display = inParty || invitedBy ? "block" : "none";
  if (!inParty && !invitedBy) return;
  // Sit just under the health bars (their height changes with potion buffs).
  partyEl.style.top = `${staminaEl.offsetTop + staminaEl.offsetHeight + 6}px`;
  const keep = document.activeElement === partyInput;
  partyEl.replaceChildren();
  if (invitedBy && !inParty) {
    partyEl.append(el("party-title", "🚩 Party invite"), el("party-note", `${invitedBy.from} invites you to their party.`));
    const row = el("party-buttons");
    const yes = document.createElement("button");
    yes.className = "shop-btn";
    yes.textContent = "Join";
    yes.onclick = () => { invitedBy = null; partyActions.answer(true); drawParty(); };
    const no = document.createElement("button");
    no.className = "shop-btn";
    no.textContent = "No thanks";
    no.onclick = () => { invitedBy = null; partyActions.answer(false); drawParty(); };
    row.append(yes, no);
    partyEl.append(row);
    return;
  }
  partyEl.append(el("party-title", `🚩 Party (${partyMembers.length}/${PARTY_MAX})`));
  for (const m of partyMembers) {
    const row = el("party-member");
    row.title = `${m.name}${m.lead ? " leads the party" : ""}: health ${m.hp} of ${m.maxHp}`;
    const top = el("party-name", `${m.lead ? "★ " : ""}${m.name}${m.me ? " (you)" : ""}`);
    if (partyIsLead && !m.me) {
      const kick = document.createElement("button");
      kick.className = "party-kick";
      kick.textContent = "✕";
      kick.title = `Take ${m.name} out of the party`;
      kick.onclick = () => partyActions.kick(m.id);
      top.append(kick);
    }
    const bar = el("stamina-bar");
    const fill = document.createElement("div");
    fill.style.width = `${Math.floor((m.hp / Math.max(1, m.maxHp)) * 100)}%`;
    fill.style.background = m.hp <= m.maxHp / 4 ? "#ff3b30" : "#d6443a";
    bar.append(fill);
    row.append(top, bar);
    partyEl.append(row);
  }
  const log = el("party-chat");
  for (const line of partyChatLines) {
    const l = el("party-line");
    l.append(el("party-from", line.from + ": "), document.createTextNode(line.text));
    log.append(l);
  }
  partyEl.append(log, partyInput);
  const leave = document.createElement("button");
  leave.className = "shop-btn party-leave";
  leave.textContent = "Leave party";
  leave.onclick = () => partyActions.leave();
  partyEl.append(leave);
  if (keep) partyInput.focus();
}
