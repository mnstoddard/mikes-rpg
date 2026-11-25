import type { Room } from "colyseus.js";
import type { LoginDetails } from "./network";
import { startTitleMusic, stopTitleMusic } from "./titleMusic";
import { drawSky, showTitleScreen } from "./titleScreen";

const LAST_USERNAME = "rpg.lastUsername";

/**
 * Shows the login box and keeps it up until the server accepts a login.
 * Resolves with the joined room.
 */
export function showLogin(join: (login: LoginDetails) => Promise<Room>): Promise<Room> {
  const box = document.getElementById("login")!;
  const form = box.querySelector("form")!;
  const username = form.querySelector<HTMLInputElement>("#login-username")!;
  const password = form.querySelector<HTMLInputElement>("#login-password")!;
  const error = box.querySelector<HTMLElement>("#login-error")!;
  const buttons = form.querySelectorAll("button");

  try { username.value = localStorage.getItem(LAST_USERNAME) ?? ""; } catch { /* storage blocked */ }
  box.style.display = "flex";
  // The same night sky as the title screen, with embers and falling stars, behind
  // the login box. It covers the game's bars and buttons until you're logged in.
  // (?at=x,y keeps the world showing through, for looking around and testing.)
  box.classList.toggle("see-through", new URLSearchParams(location.search).has("at"));
  let sky = box.querySelector<HTMLCanvasElement>("canvas.login-sky");
  if (!sky) { sky = document.createElement("canvas"); sky.className = "login-sky"; box.prepend(sky); }
  const stopSky = drawSky(sky);
  showTitleScreen(() => (username.value ? password : username).focus());
  startTitleMusic();
  (username.value ? password : username).focus();

  return new Promise((resolve) => {
    form.onsubmit = async (e: SubmitEvent) => {
      e.preventDefault();
      const create = (e.submitter as HTMLButtonElement | null)?.value === "create";
      error.textContent = create ? "Creating account…" : "Logging in…";
      buttons.forEach((b) => (b.disabled = true));
      try {
        const room = await join({ username: username.value.trim(), password: password.value, create });
        try { localStorage.setItem(LAST_USERNAME, username.value.trim()); } catch { /* ignore */ }
        box.style.display = "none";
        stopSky();
        stopTitleMusic();
        form.onsubmit = null;
        resolve(room);
      } catch (err: any) {
        // The server sends a readable reason (wrong password, name taken...).
        // Anything without a code means we couldn't reach the server at all.
        error.textContent = err?.code && err?.message
          ? err.message
          : "Couldn't reach the game server. Is it running?";
        console.error(err);
        password.select();
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    };
  });
}
