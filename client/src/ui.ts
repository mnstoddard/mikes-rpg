import { INVENTORY_SIZE, ITEMS, ItemId } from "../../shared/items";

const MAX_MESSAGES = 6;
const messagesEl = document.getElementById("messages")!;
const slotsEl = document.getElementById("slots")!;
const hoverEl = document.getElementById("hover")!;
const bagCountEl = document.getElementById("bag-count")!;

// On small screens the inventory hides behind a bag button.
document.getElementById("bag")!.addEventListener("click", () => document.body.classList.toggle("bag-open"));

export function showMessage(text: string) {
  const line = document.createElement("div");
  line.textContent = text;
  messagesEl.appendChild(line);
  while (messagesEl.children.length > MAX_MESSAGES) messagesEl.firstChild!.remove();
}

export function renderInventory(items: (ItemId | null)[], onDrop: (slot: number) => void) {
  slotsEl.replaceChildren();
  const used = items.filter(Boolean).length;
  bagCountEl.textContent = used ? String(used) : "";
  for (let i = 0; i < INVENTORY_SIZE; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    const id = items[i];
    if (id) {
      slot.classList.add("filled");
      slot.textContent = ITEMS[id].icon;
      slot.title = `Drop ${ITEMS[id].name}`;
      slot.onclick = () => onDrop(i);
    }
    slotsEl.appendChild(slot);
  }
}

/** RuneScape-style "Action Target" text next to the cursor. */
export function setHoverText(action: string | null, target = "", x = 0, y = 0) {
  if (!action) { hoverEl.style.display = "none"; return; }
  hoverEl.innerHTML = "";
  hoverEl.append(action + " ");
  const b = document.createElement("b");
  b.textContent = target;
  hoverEl.append(b);
  hoverEl.style.left = `${x + 14}px`;
  hoverEl.style.top = `${y + 14}px`;
  hoverEl.style.display = "block";
}
