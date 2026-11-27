// Player settings: titles, colour, look, name, password.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { areaAt } from "../../../shared/map";
import { npcById } from "../../../shared/npcs";
import { GUIDE_NAME, tutorialDone, chapterById } from "../../../shared/quests";
import { checkPassword, hashPassword, store, usernameKey } from "../storage";
import { PLAYER_COLORS, isPlayerColor } from "../../../shared/colors";
import { cleanLook } from "../../../shared/look";
import { USERNAME_RE, MIN_PASSWORD, worldNow, online, waitingToReconnect } from "./common";
import type { WorldRoom } from "../WorldRoom";

/** The messages from players about this. */
export function registerSettings(this: WorldRoom) {
    this.onMessage("title", (client, msg: { title: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const title = String(msg?.title ?? "");
      if (title && !this.titlesOf(p).includes(title)) return;
      p.title = title;
      p.dirty = true;
      this.say(client, title ? `🏅 Your title is now "${title}". Everyone can see it over your head.` : "🏅 You put your title away.");
      this.sendRenown(client, p);
    });
    // ⚙️ Settings: change your character's colour.
    this.onMessage("setColor", (client, msg: { color: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !isPlayerColor(msg?.color)) return;
      p.color = msg.color;
      this.saveSoon(p);
      this.say(client, `You're ${PLAYER_COLORS.find((c) => c.color === msg.color)!.name.toLowerCase()} now.`);
    });
    // The 3D game's character creator: how your character looks (shared/look.ts).
    this.onMessage("setLook", (client, msg: { look: unknown }) => {
      const p = this.state.players.get(client.sessionId);
      const look = cleanLook(msg?.look);
      if (!p || look === null) return;
      p.look = look;
      this.saveSoon(p);
    });
    // ⚙️ Settings: change your name (it's also what you log in with).
    this.onMessage("rename", async (client, msg: { name: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const name = String(msg?.name ?? "").trim();
      const reply = (ok: boolean, text: string) => client.send("account", { ok, text, name: p.name });
      if (!USERNAME_RE.test(name)) return reply(false, "Names are 1-12 letters, numbers, spaces, _ or -, starting with a letter or number.");
      if (name === p.name) return reply(false, "That's already your name.");
      const oldKey = usernameKey(p.name), newKey = usernameKey(name);
      if (newKey !== oldKey && (online.has(newKey) || waitingToReconnect.has(newKey))) return reply(false, "That name is taken. Try another one.");
      try {
        await this.save(p); // so nothing is lost under the old name
        if (!(await store.rename(p.name, name))) return reply(false, "That name is taken. Try another one.");
      } catch (err: any) {
        console.error(`Renaming ${p.name} failed:`, err.message);
        return reply(false, "Couldn't change your name right now. Try again in a bit.");
      }
      console.log(`${p.name} is now called ${name}`);
      online.delete(oldKey);
      online.add(newKey);
      const mine = this.plotOf(p);
      if (mine) { mine.plot.ownerKey = newKey; mine.plot.owner = name; this.saveFarmsSoon(); }
      p.name = name;
      reply(true, `Your name is now ${name}. Use it to log in from now on.`);
    });
    // ⚙️ Settings: change your password (needs the old one).
    this.onMessage("setPassword", async (client, msg: { current: string; next: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const reply = (ok: boolean, text: string) => client.send("account", { ok, text, name: p.name });
      const current = String(msg?.current ?? ""), next = String(msg?.next ?? "");
      if (next.length < MIN_PASSWORD) return reply(false, `Passwords need at least ${MIN_PASSWORD} characters.`);
      if (next.length > 100) return reply(false, "That password is too long.");
      try {
        const account = await store.get(p.name);
        if (!account || !(await checkPassword(current, account.passwordHash))) return reply(false, "Your current password isn't right.");
        await store.setPassword(p.name, await hashPassword(next));
      } catch (err: any) {
        console.error(`Changing ${p.name}'s password failed:`, err.message);
        return reply(false, "Couldn't change your password right now. Try again in a bit.");
      }
      reply(true, "Password changed. Use the new one next time you log in.");
    });
    // The client says it's ready once its message handlers are set up.
    this.onMessage("ready", (client, msg?: { reconnected?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      this.sendInventory(client, p);
      this.sendDisciplines(client, p);
      this.sendMastery(client, p);
      this.sendStamina(client, p);
      this.sendVitals(client, p);
      client.send("combatmastery", p.combatMastery);
      client.send("tree", p.tree);
      client.send("discovered", p.discovered);
      client.send("jewels", p.jewels);
      this.sendSpellbook(client, p);
      this.sendBuffs(client, p);
      this.fillBoard(p);
      this.sendBounties(client, p);
      client.send("clock", { now: worldNow() }); // day and night (shared/daynight.ts)
      if (msg?.reconnected) return;
      const step = this.step(p);
      if (!step) this.say(client, tutorialDone(p.quest) ? "Welcome back!" : "Welcome back! Talk to anyone with a ❗ for your next lesson.");
      else if (p.quest.active === "awakening" && p.quest.ch.awakening?.step === 0) {
        // The opening scene (Mike's note #1): you wake lying by the shrine, and Keeper Celene comes over, helps you up and talks to you.
        this.say(client, "✨ You open your eyes on the steps of the Heart Shrine. The flame crackles above you, and someone is hurrying over.");
        const celene = npcById("celene")!;
        this.doTalk(client, p, chapterById("awakening"), this.step(p)!, celene, [], true);
      }
      else if (p.quest.active === "maren" && p.quest.ch.maren?.step === 0) this.say(client, `Welcome! Go and talk to ${GUIDE_NAME} in her cottage by the lake (${areaAt(p.x, p.y)?.id === "lighthall" ? "walk out of the big doors at the bottom of this hall, then " : ""}west along the road: your 🗺️ map shows her ❗). She'll show you how to get started.`);
      else this.say(client, `Welcome back! Your task: ${step.task}.`);
      for (const note of p.loginNotes.splice(0)) this.say(client, note);
    });
}
