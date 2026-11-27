// The ⛶ full screen button (in the column of buttons on the right).
// Browsers that can go full screen (computers, Android, iPad) do it straight away. iPhone Safari
// can't, so there the button explains Add to Home Screen instead: opened from the home screen the
// game fills the whole screen with no browser bars (see the web app manifest in client/public).

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

function canFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

function isFull(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Already opened from the home screen (no browser bars to hide). */
function standalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function toggle() {
  const d = document as FsDoc;
  if (isFull()) {
    if (d.exitFullscreen) d.exitFullscreen().catch(() => {});
    else d.webkitExitFullscreen?.();
    return;
  }
  const el = document.documentElement as FsEl;
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  else el.webkitRequestFullscreen?.();
}

function homeScreenTip() {
  const old = document.getElementById("fs-tip");
  if (old) { old.remove(); return; }
  const tip = document.createElement("div");
  tip.id = "fs-tip";
  tip.className = "panel";
  tip.innerHTML = `<b>Play full screen</b><br>This browser can't hide its bars, but you can add the game to your home screen:<br>
    1. Tap the Share button <span aria-hidden="true">(the square with an arrow)</span>.<br>
    2. Tap <b>Add to Home Screen</b>.<br>
    3. Open the game from its new icon. It fills the whole screen.<br><button class="shop-btn">Got it</button>`;
  tip.querySelector("button")!.onclick = () => tip.remove();
  document.body.append(tip);
}

export function setupFullscreen() {
  if (standalone()) return; // nothing to hide
  const bar = document.getElementById("zoom");
  if (!bar) return;
  const ios = /iPhone|iPod/.test(navigator.userAgent);
  if (!canFullscreen() && !ios) return;
  const b = document.createElement("button");
  b.id = "fullscreen-btn";
  b.className = "panel btn";
  b.setAttribute("aria-label", "Full screen");
  b.title = "Full screen";
  b.textContent = "⛶";
  b.onclick = () => (canFullscreen() ? toggle() : homeScreenTip());
  const show = () => b.classList.toggle("on", isFull());
  document.addEventListener("fullscreenchange", show);
  document.addEventListener("webkitfullscreenchange", show);
  bar.insertBefore(b, document.getElementById("settings-btn"));
}
