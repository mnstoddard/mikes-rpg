// Talking to the game server: joining, reconnecting, and keeping the picture in step with the game.
// Part of the 3D game (client3d/src/game/world.ts), split out to keep each file to one job.
import { undress } from "../../character";
import { getStateCallbacks, Room } from "colyseus.js";
import { OUTDOORS, areaAt } from "../../../../shared/map";
import { CombatMasteryId, CombatMasteryXp, MONSTERS, MonsterId, SpellId, combatMasteryName } from "../../../../shared/combat";
import type { Gear } from "../../../../shared/gear";
import { ItemId } from "../../../../shared/items";
import { Bag } from "../../../../shared/bag";
import type { GuildView } from "../../../../shared/guild";
import type { Bounty } from "../../../../shared/bounties";
import type { Belt, ToolType } from "../../../../shared/tools";
import { NPCS } from "../../../../shared/npcs";
import { DisciplineId, DisciplineView, SkillId, SkillXp, findSkill } from "../../../../shared/disciplines";
import { ItemMasteryXp, MasteryId } from "../../../../shared/mastery";
import type { TreeRanks } from "../../../../shared/skilltree";
import type { QuestView } from "../../../../shared/quests";
import type { ShopId } from "../../../../shared/shops";
import type { RepairJob } from "../../../../shared/repair";
import type { Buffs, PotionType } from "../../../../shared/alchemy";
import type { Jewels } from "../../../../shared/jewelry";
import type { BoltSpellId } from "../../../../shared/combat";
import type { FarmView } from "../../../../shared/farming";
import type { RenownView } from "../../../../shared/renown";
import { joinWorld, rejoinWorld } from "../../../../client/src/network";
import { showLogin } from "../../../../client/src/login";
import { setReportRoom } from "../../../../client/src/report";
import { crumb, reportCrash } from "../../../../client/src/crash";
import { setTreeActions } from "../../../../client/src/tree";
import { setWorldMapMarks, updateWorldMap } from "../../../../client/src/worldmap";
import { accountResult, renderMe, renderTracked, resetForSignOut, setAccountActions, setBountyActions, setQuestActions, showBounties, setGuildActions, showChest, showGuild, closeRepair, setRepairActions, showRepairs, closeDialog, openDialog, renderQuest, renderStamina, renderVitals, renderGear, renderCombatMastery, flashCombatMastery, closeCraft, closeInfo, closeShop, openCraft, renderBelt, renderMastery, renderSkillXp, openShop, renderBag, renderCoins, renderDisciplines, setInventoryActions, showMessage, renderTreeRanks, setBuffs, setDiscovered, setServerOffset, setTithe, renderJewels, setGemActions, setSpellbook, setAltarActions, setFarm, setFarmActions, setRenown, setRenownActions, renderParty, setPartyActions, showPartyInvite, addPartyChat, PartyMember } from "../../../../client/src/ui";
import { TILE } from "../../environment";
import { tileCenter } from "../terrain";
import { MonsterView, Person, makeStation, npcRecipe, playerRecipe } from "../actors";
import { openCreator } from "../creator";
import { lookToRecipe } from "../look";
import * as sfx from "../sfx";
import type { World3D } from "../world";

export const networkMethods = {
  // ---------------------------------------------------------------- joining the server

  attach(this: World3D, room: Room, reconnected = false) {
    this.walkSent = "0,0";
    this.room = room;
    setReportRoom(room);
    crumb(reconnected ? "reconnected to the server" : "joined the game");
    room.onMessage("message", (text: string) => showMessage(text));
    // Carrying too much (version 0.22, Mike's note): running switches off and the 🏃 button greys out.
    room.onMessage("heavy", (heavy: boolean) => {
      document.getElementById("run3d")?.classList.toggle("heavy", !!heavy);
      if (heavy) { this.runToggle = false; this.runShift = false; this.showRun(false); }
    });
    // Once per browser: tell them about walking with the keyboard.
    try {
      if (!localStorage.getItem("rpg3d.wasdTip")) {
        localStorage.setItem("rpg3d.wasdTip", "1");
        setTimeout(() => showMessage("Tip: walk with W A S D (forward is the way the camera faces), or click where to go. Q / E turn the camera."), 1500);
      }
    } catch { /* ignore */ }
    room.onMessage("disciplines", (disciplines: DisciplineView) => { this.lastDisciplines = disciplines; renderDisciplines(disciplines); });
    room.onMessage("levelup", (msg: { discipline: DisciplineId; level: number }) => { sfx.onLevelUp(); this.celebrateLevelUp(msg.discipline); });
    room.onMessage("skillxp", (skillXp: SkillXp) => {
      if (this.skillXpSeen) {
        for (const id of Object.keys(skillXp) as SkillId[]) {
          const gained = skillXp[id] - (this.skillXp[id] ?? 0);
          if (gained > 0) this.floatText(`+${gained} ${findSkill(id).def.name} XP`, "#9be28a");
        }
      }
      this.skillXpSeen = true;
      this.skillXp = skillXp;
      renderSkillXp(skillXp);
    });
    room.onMessage("mastery", (mastery: ItemMasteryXp) => renderMastery(mastery));
    room.onMessage("skillup", (msg: { skill: SkillId; level: number }) => { sfx.onLevelUp(); this.celebrateSkill(msg.skill, msg.level); });
    room.onMessage("masteryup", (msg: { resource: MasteryId; level: number }) => { sfx.onLevelUp(); this.celebrateMastery(msg.resource, msg.level); });
    setInventoryActions({
      drop: (slot) => room.send("drop", { slot }),
      sell: (slot, count) => room.send("sell", { slot, count }),
      sellAll: () => room.send("sellAll"),
      lock: (slot, locked) => room.send("lock", { slot, locked }),
      equip: (slot) => room.send("equip", { slot }),
      unequip: (type: ToolType) => room.send("unequip", { type }),
      buy: (item, count) => room.send("buy", { item, count }),
      craft: (item, all) => room.send("craft", { item, all }),
      eat: (slot) => room.send("eat", { slot }),
      wear: (slot) => room.send("wear", { slot }),
      remove: (slot) => room.send("remove", { slot }),
      drink: (slot) => room.send("drink", { slot }),
      spell: (id) => room.send("spell", { id }),
      cast: (id) => room.send("cast", { id }),
      spellBar: (bar) => room.send("spellBar", { bar }),
      read: (slot) => room.send("read", { slot }),
      sort: () => room.send("sortInventory"),
      move: (from, to) => room.send("moveItem", { from, to }),
    });
    setTreeActions({
      buy: (node) => room.send("treeBuy", { node }),
      reset: (skill) => room.send("treeReset", { skill }),
    });
    room.onMessage("tree", (ranks: TreeRanks) => renderTreeRanks(ranks));
    room.onMessage("discovered", (list: PotionType[]) => setDiscovered(list));
    room.onMessage("buffs", (b: Buffs) => { setBuffs(b); this.updateDaylight(); });
    room.onMessage("jewels", (j: Jewels) => renderJewels(j));
    setAltarActions({
      enchant: (msg) => room.send("enchant", msg),
      disenchant: (slot) => room.send("disenchant", { slot }),
    });
    setGemActions({
      cut: (item) => room.send("cut", { item }),
      wearJewel: (slot) => room.send("wearJewel", { slot }),
      removeJewel: (slot) => room.send("removeJewel", { slot }),
    });
    setQuestActions({ track: (bounty) => room.send("track", bounty == null ? {} : { bounty }) });
    setAccountActions({
      rename: (name) => room.send("rename", { name }),
      password: (current, next) => room.send("setPassword", { current, next }),
      color: (color) => room.send("setColor", { color }),
      signOut: () => void this.signOut(),
    });
    room.onMessage("tracked", (msg: { item: ItemId | null }) => renderTracked(msg.item));
    room.onMessage("account", (msg: { ok: boolean; text: string; name: string }) => accountResult(msg.ok, msg.text, msg.name));
    setBountyActions({
      handIn: (index) => room.send("handIn", { index }),
      refresh: () => room.send("refreshBounties"),
    });
    room.onMessage("bounties", (msg: { bounties: Bounty[]; open: boolean }) => {
      if (msg.open) this.marker.visible = false;
      showBounties(msg.bounties, msg.open);
    });
    room.onMessage("quest", (q: QuestView) => {
      this.npcs.forEach((p, id) => { if (p.alert) p.alert.obj.visible = q.marks.includes(id as never); });
      this.stations.forEach((s, id) => { if (s.alert) s.alert.obj.visible = q.marks.includes(id as never); });
      setWorldMapMarks(q.marks, q.spots);
      this.showSpotRings(q.reach ? q.spots ?? [] : []);
      renderQuest(q);
      this.showStory(q);
    });
    room.onMessage("clock", (msg: { now: number }) => {
      this.clockOffset = msg.now - Date.now();
      setServerOffset(this.clockOffset);
      this.wasNight = null;
      this.updateDaylight();
    });
    room.onMessage("questDone", () => { sfx.onQuestDone(); this.floatText("Quest complete!", "#ffd84a", true); });
    room.onMessage("vitals", (v: { hp: number; maxHp: number; mana: number; maxMana: number }) => renderVitals(v.hp, v.maxHp, v.mana, v.maxMana));
    room.onMessage("gear", (msg: { gear: Gear; spell: BoltSpellId }) => renderGear(msg.gear, msg.spell));
    room.onMessage("spellbook", (b: Parameters<typeof setSpellbook>[0]) => setSpellbook(b));
    room.onMessage("partyInvite", (msg: { from: string }) => showPartyInvite(msg.from));
    room.onMessage("partyChat", (msg: { from: string; text: string }) => addPartyChat(msg.from, msg.text));
    setPartyActions({
      answer: (yes) => room.send("partyAnswer", { yes }),
      leave: () => room.send("partyLeave"),
      kick: (id) => room.send("partyKick", { id }),
      chat: (text) => room.send("partyChat", { text }),
    });
    room.onMessage("combatmastery", (m: CombatMasteryXp) => renderCombatMastery(m));
    room.onMessage("combatmasteryup", (msg: { id: CombatMasteryId; level: number }) => {
      sfx.onLevelUp();
      setTimeout(() => this.floatText(`${combatMasteryName(msg.id)} Mastery ${msg.level}!`, "#7fd0ff"), 700);
      flashCombatMastery(msg.id);
    });
    room.onMessage("hit", (h: { on: "monster" | "player"; id: string; damage: number; miss: boolean; spell: SpellId | null; from: string }) => {
      if (h.on === "monster" && h.from === room.sessionId) { sfx.onFightHit(h.miss); this.lastTarget = { id: h.id, at: performance.now() }; }
      if (h.on === "player" && h.id === room.sessionId && !h.miss) sfx.onPlayerHurt();
      this.showHit(h);
    });
    room.onMessage("died", () => this.showDeath());
    room.onMessage("dialog", (msg: { name: string; lines: string[] }) => {
      this.marker.visible = false;
      openDialog(msg.name, msg.lines);
      // On a tour, this is the stop we were walking to: on to the next once it's read.
      if (this.tour?.sent) { this.tour.stops.shift(); this.tour.sent = false; this.tour.wait = 0.6; }
    });
    // Keeper Oren walks you round the statues (version 0.22, Mike's note): no clicking each one.
    room.onMessage("tour", (msg: { guide: string; stops: string[] }) => { this.tour = { guide: msg.guide, stops: [...msg.stops], sent: false, wait: 0.6, follow: 0 }; });
    room.onMessage("intro", (msg: { name: string; lines: string[] }) => this.startIntro(msg.name, msg.lines));
    room.onMessage("stamina", (msg: { stamina: number; max: number; winded?: number }) => renderStamina(msg.stamina, msg.max, msg.winded ?? 0));
    room.onMessage("reward", (msg: { text: string }) => this.floatText(msg.text, "#ffd84a", true));
    room.onMessage("caught", (msg: { id: string; item: string }) => this.players.get(msg.id)?.catchFish(msg.item));
    room.onMessage("belt", (belt: Belt) => renderBelt(belt));
    room.onMessage("station", (msg: { npc: string }) => { this.marker.visible = false; openCraft(msg.npc); });
    setGuildActions({
      buySpace: () => room.send("buyChestSpace"),
      deposit: (slot, count) => room.send("deposit", { slot, count }),
      withdraw: (slot, count) => room.send("withdraw", { slot, count }),
      handIn: (index) => room.send("guildHandIn", { index }),
      refresh: () => room.send("refreshGuild"),
    });
    room.onMessage("guild", (g: GuildView & { open: boolean }) => { if (g.open) this.marker.visible = false; showGuild(g, g.open); });
    room.onMessage("chest", (c: Bag & { open: boolean }) => { if (c.open) this.marker.visible = false; showChest(c, c.open); });
    room.onMessage("guildRank", (msg: { rank: string }) => this.floatText(`Guild ${msg.rank}!`, "#c9a2ff", true));
    room.onMessage("bag", (bag: Bag) => {
      renderBag(bag);
      const total = bag.inventory.reduce((n, item, i) => n + (item ? bag.counts[i] || 1 : 0), 0);
      if (this.bagTotal >= 0 && total > this.bagTotal) sfx.onGot(this.myAction);
      this.bagTotal = total;
      const lantern = bag.inventory.includes("lantern");
      if (lantern !== this.hasLantern) { this.hasLantern = lantern; this.updateDaylight(); }
    });
    room.onMessage("coins", (coins: number) => renderCoins(coins));
    room.onMessage("repair", (view: { jobs: RepairJob[]; free: boolean; open: boolean }) => { if (view.open) this.marker.visible = false; showRepairs(view); });
    setRepairActions({
      repair: (where, key) => this.room?.send("repair", { where, key }),
      repairAll: () => this.room?.send("repairAll"),
    });
    room.onMessage("farm", (view: FarmView) => setFarm(view));
    room.onMessage("renown", (view: RenownView) => setRenown(view));
    setRenownActions({ title: (title) => room.send("title", { title }) });
    setFarmActions({
      buy: () => room.send("farmBuy"),
      chest: () => room.send("farmChest"),
      seed: (item) => room.send("seed", { item }),
    });
    room.onMessage("shop", (msg: { npc: ShopId }) => { this.marker.visible = false; openShop(msg.npc); });
    // Messages the 2D game doesn't know about yet are fine to ignore here too.
    room.onMessage("*", () => {});
    const lookBtn = document.getElementById("look-btn");
    if (lookBtn) lookBtn.onclick = () => this.editLook();
    this.listenToState(room);
    room.send("ready", { reconnected });
    room.onLeave((code: number) => {
      if (this.room !== room) return;
      this.room = undefined;
      crumb(`connection closed (code ${code})`);
      if (code === 1000) this.hud.textContent = "Disconnected from server.";
      else void this.recover(room.reconnectionToken);
    });
  },
  async recover(this: World3D, token: string) {
    closeShop(); closeRepair(); closeCraft(); closeInfo(); closeDialog();
    const started = Date.now();
    for (let wait = 500; Date.now() - started < 110_000; wait = Math.min(wait * 2, 8000)) {
      this.hud.textContent = "Reconnecting…";
      try {
        const room = await rejoinWorld(token);
        this.clearWorld();
        this.attach(room, true);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    // Couldn't get back in for almost two minutes: the server probably restarted or crashed.
    reportCrash("disconnect", "Lost the connection to the game server and couldn't reconnect");
    this.clearWorld();
    this.hud.textContent = "Log in to play";
    this.attach(await showLogin(joinWorld));
  },
  async signOut(this: World3D) {
    const room = this.room;
    if (!room) return;
    this.room = undefined;
    try { await room.leave(true); } catch { /* already gone */ }
    this.clearWorld();
    resetForSignOut();
    this.hud.textContent = "Log in to play";
    this.attach(await showLogin(joinWorld));
  },
  clearWorld(this: World3D) {
    this.players.forEach((v) => v.dispose());
    this.players.clear();
    this.monsters.forEach((v) => v.dispose());
    this.monsters.clear();
    this.terrain.clearDepleted();
    this.marker.visible = false;
    this.lastDisciplines = undefined;
    this.skillXpSeen = false;
  },
  onResume(this: World3D) {
    const room = this.room;
    if (!room) return;
    room.state.players.forEach((player: any, sessionId: string) => this.players.get(sessionId)?.place(player.x, player.y));
  },
  /** ⚙️ Settings > Change my look: the character creator. */
  editLook(this: World3D) {
    const room = this.room;
    const me = room?.state.players.get(room.sessionId);
    if (!room || !me) return;
    const current = playerRecipe(me.look, me.name, me.color);
    openCreator(current, me.look ? "edit" : "new", (look) => room.send("setLook", { look }));
  },
  listenToState(this: World3D, room: Room) {
    const $ = getStateCallbacks(room);
    $(room.state).depleted.onAdd((_at: number, key: string) => this.terrain.setDepleted(key, true));
    $(room.state).depleted.onRemove((_at: number, key: string) => this.terrain.setDepleted(key, false));

    $(room.state).players.onAdd((player: any, sessionId: string) => {
      const isMe = sessionId === room.sessionId;
      const view = new Person(undress(playerRecipe(player.look, player.name, player.color)), { name: player.name, me: isMe });
      view.place(player.x, player.y);
      view.onHit = (x, y) => this.terrain.hitNode(x, y);
      if (isMe) view.onBeat = (phase, action) => (phase === "swing" ? sfx.onSwing(action) : sfx.onToolHit(action));
      this.scene.add(view.root);
      this.players.set(sessionId, view);
      view.setTitle(player.title);
      view.setRank(player.rank ?? 0);
      if (isMe) {
        this.focus.copy(view.root.position);
        const a = areaAt(player.x, player.y) ?? OUTDOORS;
        this.showArea(a, player.x, player.y);
        updateWorldMap({ x: player.x, y: player.y }, a);
        // First time in 3D: make your character.
        if (!player.look) setTimeout(() => { if (this.room === room) this.editLook(); }, 800);
      }
      $(player).listen("x", () => this.moveTo(view, player, isMe));
      $(player).listen("y", () => this.moveTo(view, player, isMe));
      // Where exactly they stand (smooth movement: anywhere, not just mid-tile).
      $(player).listen("fx", () => view.glide(player.fx, player.fy));
      $(player).listen("fy", () => view.glide(player.fx, player.fy));
      $(player).listen("action", (action: string) => {
        view.setAction(action, player.faceX, player.faceY);
        if (isMe) this.myAction = action;
        if (isMe && action !== "idle") this.marker.visible = false;
      });
      $(player).listen("held", (item: string) => view.setWeapon(item || ""));
      $(player).listen("running", (on: boolean) => {
        view.running = !!on;
        if (isMe) { if (!on && !this.runShift) this.runToggle = false; this.showRun(!!on); }
      });
      $(player).listen("faceX", () => view.setAction(player.action, player.faceX, player.faceY));
      $(player).listen("hp", () => { view.bar.set(player.hp, player.maxHp); this.refreshParty(); });
      $(player).listen("maxHp", () => { view.bar.set(player.hp, player.maxHp); this.refreshParty(); });
      $(player).listen("party", () => this.refreshParty());
      $(player).listen("partyLead", () => this.refreshParty());
      // Players start in plain undergarments: clothes are the armor they wear.
      $(player).listen("color", (color: number) => { if (!player.look) view.setLook(undress(playerRecipe("", player.name, color))); if (isMe) renderMe(player.name, color); });
      $(player).listen("look", (look: string) => { if (look) view.setLook(undress(lookToRecipe(look) ?? playerRecipe("", player.name, player.color))); });
      $(player).listen("worn", (worn: string) => view.setWorn(worn ? worn.split(",") : []));
      $(player).listen("invisible", (inv: boolean) => view.setFaded(inv ? (isMe ? 0.4 : 0.12) : 1));
      $(player).listen("title", (t: string) => view.setTitle(t));
      $(player).listen("rank", (r: number) => view.setRank(r));
      $(player).listen("tithe", () => { if (isMe) setTithe(player.tithe); });
      $(player).listen("name", (name: string) => { view.setName(name); this.refreshParty(); if (isMe) { renderMe(name, player.color); this.updateHud(); } });
      this.updateHud();
    });

    $(room.state).monsters.onAdd((m: any, id: string) => this.addMonster(m, id, $));
    $(room.state).monsters.onRemove((_m: any, id: string) => { this.monsters.get(id)?.dispose(); this.monsters.delete(id); });

    $(room.state).plots.onAdd((plot: any, key: string) => {
      this.plots.set(key, plot);
      const redraw = () => this.drawPlot(key);
      $(plot).listen("w", redraw);
      $(plot).listen("h", redraw);
      $(plot).listen("owner", redraw);
      $(plot).crops.onChange(redraw);
      redraw();
    });
    $(room.state).plots.onRemove((_plot: any, key: string) => { this.plots.delete(key); this.drawPlot(key); });

    $(room.state).players.onRemove((_player: any, sessionId: string) => {
      this.players.get(sessionId)?.dispose();
      this.players.delete(sessionId);
      this.updateHud();
      this.refreshParty();
    });
  },
  moveTo(this: World3D, view: Person, player: any, isMe: boolean) {
    const a = areaAt(player.x, player.y) ?? OUTDOORS;
    view.root.userData.show = a === this.here || isMe;
    if (!isMe) return;
    if (this.pendingBook && Math.max(Math.abs(this.pendingBook.x - player.x), Math.abs(this.pendingBook.y - player.y)) <= 1) {
      const b = this.pendingBook; this.pendingBook = null;
      this.openBook(b.x, b.y);
    }
    if (this.marker.visible && Math.floor(this.marker.position.x / TILE) === player.x && Math.floor(this.marker.position.z / TILE) === player.y) this.marker.visible = false;
    if (a !== this.here) {
      // Through a door: the server stopped your keyboard walk, so wait for a fresh key press.
      if (this.walkSent !== "0,0") { this.walkSent = "0,0"; this.walkPaused = true; }
      // Building a new place can take a moment (the first time outside most of all), so put up
      // "Building the world…" first and swap places a couple of frames later, once it's on screen.
      if (this.loading) this.loading.style.display = "flex";
      this.areaHold = 2;
      this.areaSwitch = () => {
        this.showArea(a, player.x, player.y);
        this.marker.visible = false;
        this.focus.copy(tileCenter(player.x, player.y));
        view.place(player.x, player.y);
        this.floatText(a.name, a.danger ? "#ff9a8a" : "#ffe9a8", true);
        updateWorldMap({ x: player.x, y: player.y }, a);
      };
    } else if (!this.areaSwitch) {
      this.terrain.setCenter(player.x, player.y);
      if ((player.x + player.y) % 3 === 0) updateWorldMap({ x: player.x, y: player.y }, a);
    }
  },
  drawNpcs(this: World3D) {
    for (const npc of NPCS) {
      if (npc.kind === "station") {
        const s = makeStation(npc);
        this.scene.add(s.root);
        this.stations.set(npc.id, s);
        continue;
      }
      const p = new Person(npcRecipe(npc), { name: npc.name, npc: true, badge: npc.badge });
      p.place(npc.x, npc.y);
      this.scene.add(p.root);
      this.npcs.set(npc.id, p);
    }
  },
  // ---------------------------------------------------------------- monsters

  addMonster(this: World3D, m: any, id: string, $: ReturnType<typeof getStateCallbacks>) {
    const def = MONSTERS[m.kind as MonsterId];
    const view = new MonsterView(m.kind, id.length * 7 + (m.x ?? 0), def?.name ?? m.kind, !!def?.aggressive);
    view.place(m.x, m.y);
    this.scene.add(view.root);
    this.monsters.set(id, view);
    const inArea = () => areaAt(m.x, m.y) === this.here;
    view.root.userData.show = m.alive && inArea();
    view.alive = m.alive;
    const move = () => { view.walkTo(m.x, m.y); if (m.alive) view.root.userData.show = inArea(); };
    $(m).listen("x", move);
    $(m).listen("y", move);
    $(m).listen("hp", () => view.bar.set(m.hp, m.maxHp));
    $(m).listen("alive", (alive: boolean) => {
      if (alive) { view.place(m.x, m.y); view.setAlive(true); view.root.userData.show = inArea(); }
      else {
        view.setAlive(false);
        if (this.lastTarget.id === id && performance.now() - this.lastTarget.at < 4000) sfx.onMonsterDefeated();
      }
    });
    $(m).listen("status", (st: string) => view.setStatus(st));
  },
  refreshParty(this: World3D) {
    const room = this.room;
    if (!room) return;
    const me = room.state.players.get(room.sessionId);
    const mine = me?.party ?? "";
    const members: PartyMember[] = [];
    room.state.players.forEach((pl: any, id: string) => {
      const view = this.players.get(id);
      const mate = !!mine && pl.party === mine;
      if (view && id !== room.sessionId) view.setNameColor(mate ? "#7dff8a" : null);
      if (mate) members.push({ id, name: pl.name, hp: pl.hp, maxHp: pl.maxHp, lead: pl.partyLead, me: id === room.sessionId });
    });
    members.sort((a, b) => Number(b.lead) - Number(a.lead) || a.name.localeCompare(b.name));
    renderParty(members, !!me?.partyLead);
  },
  myName(this: World3D): string { return this.room?.state.players.get(this.room.sessionId)?.name ?? ""; },
  updateHud(this: World3D) { this.hud.textContent = `${this.players.size} player(s) online`; },
};
