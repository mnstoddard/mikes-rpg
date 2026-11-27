// ⚙️ Settings: name, password, colour, signing out.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { canSpeak, setAutoRead, autoSpeak, autoRead } from "../speech";
import { PLAYER_COLORS } from "../../../shared/colors";
import { messagesEl, history } from "./messages";
import { lockMode, setLockMode } from "./bag";
import { closeRepair } from "./repair";
import { closeShop } from "./shop";
import { closeCraft } from "./craft";
import { closeBounties, closeGuild, closeChest, forgetBounties } from "./guild";
import { closeInfo } from "./info";
import { closeDialog, forgetQuest } from "./quests";

// ---- ⚙️ Settings: change your name, password or colour, or sign out ----

const settingsEl = document.getElementById("settings")!;

const nameForm = document.getElementById("set-name-form") as HTMLFormElement;

const nameInput = document.getElementById("set-name") as HTMLInputElement;

const nameMsg = document.getElementById("set-name-msg")!;

const pwForm = document.getElementById("set-pw-form") as HTMLFormElement;

const pwCurrent = document.getElementById("set-pw-current") as HTMLInputElement;

const pwNew = document.getElementById("set-pw-new") as HTMLInputElement;

const pwMsg = document.getElementById("set-pw-msg")!;

const colorsEl = document.getElementById("set-colors")!;

let myName = "";

let myColor = 0;

let pendingAccount: "name" | "password" | null = null;

let account = {
  rename: (_name: string) => {},
  password: (_current: string, _next: string) => {},
  color: (_color: number) => {},
  signOut: () => {},
};

export function setAccountActions(actions: typeof account) {
  account = actions;
}

/** Your own name and colour, as the server has them. */
export function renderMe(name: string, color: number) {
  myName = name;
  myColor = color;
  if (settingsEl.contains(document.activeElement) && document.activeElement === nameInput) return;
  if (document.body.classList.contains("settings-open")) renderSettings();
}

function setMsg(box: HTMLElement, ok: boolean, text: string) {
  box.textContent = text;
  box.className = "set-msg " + (ok ? "ok" : "bad");
}

const readAloudBox = document.getElementById("set-read-aloud") as HTMLInputElement | null;

if (readAloudBox) {
  if (!canSpeak()) readAloudBox.closest(".set-section")?.remove();
  readAloudBox.onchange = () => {
    setAutoRead(readAloudBox.checked);
    if (readAloudBox.checked) autoSpeak("I'll read everything out loud for you. Tap a speaker button to hear something again.");
  };
}

function renderSettings() {
  if (readAloudBox) readAloudBox.checked = autoRead();
  colorsEl.replaceChildren();
  for (const c of PLAYER_COLORS) {
    const b = document.createElement("button");
    b.className = "swatch" + (c.color === myColor ? " active" : "");
    b.style.background = `#${c.color.toString(16).padStart(6, "0")}`;
    b.title = c.name;
    b.setAttribute("aria-label", c.name);
    b.onclick = () => account.color(c.color);
    colorsEl.appendChild(b);
  }
}

export function openSettings() {
  document.body.classList.remove("history-open");
  document.body.classList.add("settings-open");
  nameInput.value = myName;
  nameMsg.textContent = "";
  pwMsg.textContent = "";
  pwCurrent.value = pwNew.value = "";
  renderSettings();
}

export function closeSettings() {
  document.body.classList.remove("settings-open");
}

/** The server answered a name or password change. */
export function accountResult(ok: boolean, text: string, name: string) {
  const box = pendingAccount === "password" ? pwMsg : nameMsg;
  pendingAccount = null;
  setMsg(box, ok, text);
  if (box === pwMsg && ok) pwCurrent.value = pwNew.value = "";
  if (box === nameMsg) nameInput.value = name;
  if (ok && name) {
    myName = name;
    try { localStorage.setItem("rpg.lastUsername", name); } catch { /* storage blocked */ }
  }
}

nameForm.onsubmit = (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name || name === myName) return setMsg(nameMsg, false, name ? "That's already your name." : "Type a new name first.");
  pendingAccount = "name";
  setMsg(nameMsg, true, "Saving…");
  account.rename(name);
};

pwForm.onsubmit = (e) => {
  e.preventDefault();
  if (!pwCurrent.value) return setMsg(pwMsg, false, "Type your current password first.");
  if (pwNew.value.length < 6) return setMsg(pwMsg, false, "New passwords need at least 6 characters.");
  pendingAccount = "password";
  setMsg(pwMsg, true, "Changing…");
  account.password(pwCurrent.value, pwNew.value);
};

document.getElementById("settings-btn")!.onclick = () => (document.body.classList.contains("settings-open") ? closeSettings() : openSettings());

document.getElementById("settings-close")!.onclick = closeSettings;

document.getElementById("sign-out")!.onclick = () => { closeSettings(); account.signOut(); };

/** After signing out: forget the last character's messages, bounties and tracker. */
export function resetForSignOut() {
  closeSettings();
  closeShop();
  closeRepair();
  closeBounties();
  closeCraft();
  closeGuild();
  closeChest();
  closeInfo();
  closeDialog();
  document.body.classList.remove("history-open", "has-quest");
  messagesEl.replaceChildren();
  history.length = 0;
  forgetBounties();
  forgetQuest();
  if (lockMode) setLockMode(false);
}
