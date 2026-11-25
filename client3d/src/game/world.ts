// The 3D game: draws the world with three.js and talks to the same game
// server as the 2D game. The server, the rules (shared/) and every panel
// (bag, skills, quests, shops... from client/src/ui.ts) are exactly the same;
// only the picture is new.
//
// The message handling below follows client/src/WorldScene.ts closely, so a
// new server message added there is easy to add here too.
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { getStateCallbacks, Room } from "colyseus.js";
import { AreaDef, MAP, OUTDOORS, TICK_MS, areaAt, doorAt, isWalkable } from "../../../shared/map";
import { bookAt } from "../../../shared/lore";
import { Minimap, nextGoal } from "./minimap";
import { CombatMasteryId, CombatMasteryXp, MONSTERS, MonsterId, SpellId, combatMasteryName } from "../../../shared/combat";
import type { Gear } from "../../../shared/gear";
import { RESOURCES, ResourceId, fishAt, isFishingSpot, nodeAt, treeKey } from "../../../shared/foraging";
import { ITEMS, ItemId } from "../../../shared/items";
import { Bag, emptyBag } from "../../../shared/bag";
import type { GuildView } from "../../../shared/guild";
import type { Bounty } from "../../../shared/bounties";
import { masteryName } from "../../../shared/crafting";
import type { Belt, ToolType } from "../../../shared/tools";
import { NPCS, npcAt } from "../../../shared/npcs";
import { DISCIPLINES, DisciplineId, DisciplineView, SkillId, SkillXp, emptySkills, findSkill, isUnlocked, levelForXp } from "../../../shared/disciplines";
import { ItemMasteryXp, MasteryId } from "../../../shared/mastery";
import type { TreeRanks } from "../../../shared/skilltree";
import type { QuestView } from "../../../shared/quests";
import type { ShopId } from "../../../shared/shops";
import type { RepairJob } from "../../../shared/repair";
import type { Buffs, PotionType } from "../../../shared/alchemy";
import type { Jewels } from "../../../shared/jewelry";
import type { BoltSpellId } from "../../../shared/combat";
import { TRAP_BLINK_SECONDS } from "../../../shared/spells";
import { CROPS, LOTS, LOT_SIZE, decodeCrop, growth, inPlot, lotAt, tileOf, timeLeft } from "../../../shared/farming";
import type { FarmView } from "../../../shared/farming";
import type { RenownView } from "../../../shared/renown";
import { darkness, isNight, minutesUntilChange } from "../../../shared/daynight";
import { joinWorld, rejoinWorld } from "../../../client/src/network";
import { showLogin } from "../../../client/src/login";
import { setReportRoom, setReportSource } from "../../../client/src/report";
import { setTreeActions } from "../../../client/src/tree";
import { setWorldMapActions, setWorldMapMarks, setWorldMapPlayers, updateWorldMap } from "../../../client/src/worldmap";
import {
  accountResult, closeBounties, renderMe, renderTracked, resetForSignOut, setAccountActions, setBountyActions, setQuestActions, showBounties, closeGuild, closeChest, setGuildActions, showChest, showGuild,
  closeRepair, setRepairActions, showRepairs, closeDialog, openDialog, renderQuest, renderStamina, renderVitals, renderGear, renderCombatMastery, flashCombatMastery, closeCraft, closeInfo, closeShop, flashDiscipline, flashMastery, flashSkillRow, openCraft, renderBelt, renderMastery, renderSkillXp, openShop, renderBag, renderCoins, renderDisciplines, setHoverText, setInventoryActions, showMessage,
  nightSightOn, renderTreeRanks, setBuffs, setDiscovered, setServerOffset, tickBuffs, setTithe,
  renderJewels, setGemActions, setSpellbook, castSlot, setAltarActions,
  serverNow, setFarm, setFarmActions,
  setRenown, setRenownActions, renderParty, setPartyActions, showPartyInvite, addPartyChat, PartyMember,
} from "../../../client/src/ui";
import { createSkyDome, SKY_TIMES, TILE, type SkyDome } from "../environment";
import { setRockEnvironment } from "../rocks";
import { Terrain, tileCenter } from "./terrain";
import { MonsterView, Person, label, makeStation, npcRecipe, playerRecipe, type StationView } from "./actors";
import { openCreator } from "./creator";
import { lookToRecipe } from "./look";
import * as sfx from "./sfx";

const MIN_DIST = 7;
const MAX_DIST = 42;
const CAM_KEY = "rpg3d.camera";
const TAP_SLOP = 10;
/** The keys that walk you: forward, left, back and right (by position, so other keyboard layouts work too). */
const WALK_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD"];
/** People, monsters and stations further than this (metres, each way) aren't drawn. */
const CULL_M = 60;
/** At most this many lamps light the scene at once (the nearest ones), so it stays fast. */
const MAX_LAMPS = 6;

export class World3D {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.3, 700);
  private hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5b6b3a, 1.1);
  private sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  private sky: SkyDome = createSkyDome();
  private terrain = new Terrain();
  private clock = new THREE.Clock();
  private time = 0;
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Camera: it orbits round you. Yaw 0 looks north (the map's "up").
  private yaw = 0;
  private pitch = 0.95;
  private dist = 24;
  private camDist = 24; // how far the camera really is (closer when a wall is in the way)
  private focus = new THREE.Vector3();

  private room?: Room;
  private players = new Map<string, Person>();
  private monsters = new Map<string, MonsterView>();
  private npcs = new Map<string, Person>();
  private stations = new Map<string, StationView>();
  private marker: THREE.Mesh;
  /** The gold arrow on the ground by your feet, pointing the way to your quest's next ❗ or 📍. */
  private guide = new THREE.Group();
  private hud = document.getElementById("hud")!;
  private lastDisciplines?: DisciplineView;
  private skillXpSeen = false;
  private skillXp: SkillXp = emptySkills();
  private hasLantern = false;
  /** For sound effects: what you're doing, how full your bag is, and the monster you last hit. */
  private myAction = "idle";
  private bagTotal = -1;
  private lastTarget = { id: "", at: 0 };
  private clockOffset = 0;
  private wasNight: boolean | null = null;
  private here: AreaDef = OUTDOORS;
  private spotMarks: THREE.Object3D[] = [];
  private signLabels: CSS2DObject[] = [];
  private effects: { obj: THREE.Object3D; t: number; life: number; step: (f: number) => void }[] = [];
  private plots = new Map<string, any>();
  private plotViews = new Map<string, { group: THREE.Group; sign: CSS2DObject; crops: CSS2DObject[] }>();
  private lastHover = 0;
  private loading = document.getElementById("loading3d");
  private lightTimer = 0;
  // Walking with the keyboard (WASD).
  private keys = new Set<string>();
  private walkSent = "0,0"; // the direction we last told the server ("dx,dy")
  private walkSentAt = 0; // when we told it (ms)
  private lastStepAt = new THREE.Vector3(); // where we last played a footstep
  private pendingBook: { x: number; y: number } | null = null; // a shelf we're walking to, to read
  private walkPaused = false;
  private runToggle = false; // the 🏃 button
  private runShift = false; // holding Shift
  private minimap = new Minimap();
  private areaSwitch: (() => void) | null = null;
  private areaHold = 0;
  private mapPlayersTimer = 0; // how soon to tell the 🗺️ map where other players are

  /** Turn on only the nearest few lamps (every point light costs on every pixel). */
  private pickLights() {
    const lights: THREE.PointLight[] = [];
    const p = new THREE.Vector3();
    this.scene.traverse((o) => { if ((o as THREE.PointLight).isPointLight) lights.push(o as THREE.PointLight); });
    const d = new Map<THREE.PointLight, number>();
    for (const l of lights) {
      let shown = true;
      for (let a: THREE.Object3D | null = l.parent; a; a = a.parent) if (a.userData.show === false) shown = false;
      l.getWorldPosition(p);
      d.set(l, shown ? p.distanceToSquared(this.focus) : Infinity);
    }
    lights.sort((a, b) => d.get(a)! - d.get(b)!);
    lights.forEach((l, i) => { l.visible = i < MAX_LAMPS; });
  }

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = "labels3d";
    host.appendChild(this.labels.domElement);

    // Shiny ores reflect a soft room, like in the Ore Gallery.
    setRockEnvironment(new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture);
    this.scene.fog = new THREE.Fog(0xcfe4ee, 40, 95);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.terrain.root, this.sky.object);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 160 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;

    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.65, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0.9, depthWrite: false }));
    this.marker.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    this.marker.visible = false;
    this.scene.add(this.marker);

    const arrow = new THREE.Shape();
    arrow.moveTo(0.75, 0); arrow.lineTo(0.05, 0.5); arrow.lineTo(0.05, 0.2); arrow.lineTo(-0.55, 0.2);
    arrow.lineTo(-0.55, -0.2); arrow.lineTo(0.05, -0.2); arrow.lineTo(0.05, -0.5); arrow.closePath();
    const arrowMesh = new THREE.Mesh(new THREE.ShapeGeometry(arrow), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(arrow.getPoints().map((p) => new THREE.Vector3(p.x, p.y, 0.01))), new THREE.LineBasicMaterial({ color: 0x5a3d00 }));
    arrowMesh.add(edge);
    arrowMesh.rotation.x = -Math.PI / 2;
    arrowMesh.renderOrder = 5;
    arrowMesh.scale.setScalar(1.3);
    this.guide.add(arrowMesh);
    this.guide.visible = false;
    this.scene.add(this.guide);

    try {
      const saved = JSON.parse(localStorage.getItem(CAM_KEY) ?? "null");
      if (saved) { this.yaw = saved.yaw ?? 0; this.dist = saved.dist ?? 20; this.pitch = saved.pitch ?? 0.95; }
    } catch { /* storage blocked */ }

    this.drawNpcs();
    this.showArea(OUTDOORS, 120, 95);
    this.setupInput();
    window.addEventListener("resize", () => this.resize());
    this.resize();
    setWorldMapActions();
    renderBag(emptyBag(0));
    const clock = document.getElementById("clock");
    if (clock) clock.onclick = () => showMessage(clock.title);
    setInterval(() => this.updateDaylight(), 1000);
    setInterval(() => this.redrawPlots(), 5000);
    setInterval(() => this.updateTrapGlows(), 200);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.onResume(); });
    (window as any).world3d = this; // for automated browser tests
    // The 🐞 button's screenshot: draw a fresh frame and copy it in the same moment.
    setReportSource("3d", () => { this.renderer.render(this.scene, this.camera); return this.renderer.domElement; });
    this.loop();
  }

  async start() {
    this.hud.textContent = "Log in to play";
    sfx.setupSoundSettings();
    // ?at=x,y shows that spot of the world behind the login box (for looking around and testing).
    const at = new URLSearchParams(location.search).get("at")?.split(",").map(Number);
    if (at && at.length === 2 && at.every(Number.isFinite)) this.lookAt(at[0], at[1]);
    this.attach(await showLogin(joinWorld));
  }

  /** Point the camera at a tile without being logged in (the ?at= preview, and tests). */
  lookAt(x: number, y: number, hour?: "day" | "sunset" | "night") {
    const a = areaAt(x, y) ?? OUTDOORS;
    this.showArea(a, x, y);
    this.focus.copy(tileCenter(x, y));
    if (hour) {
      // Shift our clock so it's that time of day (only on this screen).
      const want = hour === "day" ? 10 * 60_000 : hour === "sunset" ? 29 * 60_000 : 35 * 60_000;
      const now = Date.now();
      this.clockOffset = want - (now % (40 * 60_000));
      this.updateDaylight();
    }
  }

  // ---------------------------------------------------------------- the frame loop

  private loop = () => {
    requestAnimationFrame(this.loop);
    // Going through a door: wait until the loading sign has been drawn, then switch places.
    if (this.areaSwitch) {
      if (--this.areaHold > 0) return;
      const go = this.areaSwitch;
      this.areaSwitch = null;
      go();
    }
    const dt = Math.min(0.1, this.clock.getDelta());
    this.time += dt;
    const me = this.room ? this.players.get(this.room.sessionId) : undefined;
    if (me) this.focus.lerp(me.root.position, Math.min(1, dt * 10));
    if (me) this.footsteps(me);
    this.updateWalk();
    this.placeCamera(dt);
    const mine = this.room?.state.players?.get(this.room.sessionId);
    sfx.update(dt, this.myAction);
    const others: { x: number; y: number }[] = [];
    for (const [id, v] of this.players) if (id !== this.room?.sessionId && v.root.visible) others.push({ x: v.root.position.x / TILE, y: v.root.position.z / TILE });
    this.minimap.update(mine ? { x: mine.x, y: mine.y } : null, this.focus.x / TILE, this.focus.z / TILE, this.here, this.yaw, others);
    if ((this.mapPlayersTimer -= dt) < 0) {
      this.mapPlayersTimer = 1;
      const list: { x: number; y: number; name: string }[] = [];
      this.room?.state.players?.forEach((pl: any, id: string) => { if (id !== this.room!.sessionId) list.push({ x: pl.x, y: pl.y, name: pl.name }); });
      setWorldMapPlayers(list);
    }
    const night = this.nightLevel();
    this.terrain.update(dt, this.time, night, 0.6);
    // Only people, monsters and stations near you are drawn (and animated).
    const near = (root: THREE.Object3D) => {
      const show = root.userData.show !== false && Math.abs(root.position.x - this.focus.x) < CULL_M && Math.abs(root.position.z - this.focus.z) < CULL_M;
      root.visible = show;
      return show;
    };
    for (const p of this.players.values()) { near(p.root); p.update(dt, this.time); }
    for (const p of this.npcs.values()) if (near(p.root)) p.update(dt, this.time);
    for (const m of this.monsters.values()) if (near(m.root)) m.update(dt, this.time);
    for (const s of this.stations.values()) if (near(s.root)) s.update(dt, this.time, night);
    if ((this.lightTimer -= dt) < 0) { this.lightTimer = 0.5; this.pickLights(); }
    this.sky.update(dt, this.time);
    this.sky.object.position.copy(this.camera.position);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      e.step(Math.min(1, e.t / e.life));
      if (e.t >= e.life) {
        e.obj.parent?.remove(e.obj);
        if (e.obj instanceof CSS2DObject) e.obj.element.remove();
        this.effects.splice(i, 1);
      }
    }
    if (this.marker.visible) this.marker.rotation.z += dt * 2;
    this.updateGuide(me);
    if (this.loading) this.loading.style.display = this.room && this.terrain.loadingNear() ? "flex" : "none";
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  /** Point the guide arrow at the nearest ❗ or 📍 (or the door that leads there). It hides once you're close, or while a box is open. */
  private updateGuide(me: { root: THREE.Object3D } | undefined) {
    const busy = document.body.classList.contains("dialog-open") || document.body.classList.contains("shop-open") || document.body.classList.contains("craft-open");
    const goal = me && !busy ? nextGoal(me.root.position.x / TILE, me.root.position.z / TILE, this.here) : null;
    if (!me || !goal) { this.guide.visible = false; return; }
    const to = tileCenter(goal.x, goal.y);
    const dx = to.x - me.root.position.x, dz = to.z - me.root.position.z;
    const d = Math.hypot(dx, dz);
    if (d < TILE * 2.5) { this.guide.visible = false; return; }
    this.guide.visible = true;
    const bob = 1.5 + Math.sin(this.time * 4) * 0.2;
    this.guide.position.set(me.root.position.x + (dx / d) * bob, me.root.position.y + 0.15, me.root.position.z + (dz / d) * bob);
    this.guide.rotation.y = Math.atan2(-dz, dx);
  }

  private placeCamera(dt = 0) {
    const f = this.focus;
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // Don't go through buildings or walls: come in closer, in front of the first one in the way.
    const free = this.freeDist(dir);
    this.camDist = dt ? Math.min(free, this.camDist + (free - this.camDist) * Math.min(1, dt * 4)) : free;
    const off = dir.multiplyScalar(this.camDist);
    this.camera.position.copy(f).add(off);
    this.camera.lookAt(f.x, f.y + 1, f.z);
    // The sun's shadow box follows you.
    this.sun.target.position.copy(f);
  }

  /** How far the camera can sit from you along this direction before a wall or building is in the way. */
  private freeDist(dir: THREE.Vector3): number {
    const f = this.focus;
    const fx = Math.floor(f.x / TILE), fy = Math.floor(f.z / TILE);
    const step = 0.25;
    for (let d = 1; d < this.dist; d += step) {
      const x = f.x + dir.x * d, y = f.y + 1 + dir.y * d, z = f.z + dir.z * d;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (tx === fx && ty === fy) continue;
      if (this.terrain.blockHeight(tx, ty) > y - 0.3) return Math.max(MIN_DIST * 0.5, d - 0.6);
    }
    return this.dist;
  }

  private resize() {
    const w = this.host.clientWidth || window.innerWidth, h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private saveCamera() {
    try { localStorage.setItem(CAM_KEY, JSON.stringify({ yaw: this.yaw, dist: this.dist, pitch: this.pitch })); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- input

  private setupInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; button: number }>();
    let pinch = 0, pinchDist = 0, dragged = false;
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button });
      dragged = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        pinchDist = this.dist;
      }
    });
    el.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) { if (e.pointerType === "mouse") this.onHover(e.clientX, e.clientY); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_SLOP) dragged = true;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.setDist(pinchDist * pinch / Math.max(1, d));
        return;
      }
      // Drag (right or middle mouse, or one finger) turns the camera round you.
      const rotating = e.pointerType !== "mouse" || p.button !== 0 || e.shiftKey;
      if (rotating && dragged) {
        this.yaw -= dx * 0.008;
        this.pitch = Math.min(1.35, Math.max(0.35, this.pitch + dy * 0.005));
        this.saveCamera();
      }
    });
    const up = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (!p || dragged || pointers.size > 0) return;
      // A tap or a left click (without dragging) acts on the tile.
      if (e.pointerType === "mouse" && p.button !== 0) return;
      this.onClick(e.clientX, e.clientY);
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); pinch = 0; });
    el.addEventListener("pointerleave", () => setHoverText(null));
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.setDist(this.dist * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
    window.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // W A S D walk (forward is the way the camera faces).
      if (e.key === "Shift" && !this.runShift) { this.runShift = true; this.sendRun(); }
      if (WALK_KEYS.includes(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!this.keys.has(e.code)) { this.keys.add(e.code); this.walkPaused = false; }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "q" || e.key === "Q") { this.yaw += 0.12; this.saveCamera(); }
      else if (e.key === "ArrowRight" || e.key === "e" || e.key === "E") { this.yaw -= 0.12; this.saveCamera(); }
      else if (e.key === "ArrowUp") { this.pitch = Math.min(1.35, this.pitch + 0.06); this.saveCamera(); }
      else if (e.key === "ArrowDown") { this.pitch = Math.max(0.35, this.pitch - 0.06); this.saveCamera(); }
      // Number keys 1-8 cast the spell in that slot of the spell bar.
      else if (e.key >= "1" && e.key <= "8" && !e.ctrlKey && !e.metaKey && !e.altKey) castSlot(Number(e.key) - 1);
    });
    window.addEventListener("keyup", (e) => {
      if (this.keys.delete(e.code)) this.walkPaused = false;
      if (e.key === "Shift" && this.runShift) { this.runShift = false; this.sendRun(); }
    });
    // Switching to another window would miss the key being let go: stop walking.
    window.addEventListener("blur", () => { this.keys.clear(); if (this.runShift) { this.runShift = false; this.sendRun(); } });
    document.getElementById("zoom-in")!.onclick = () => this.setDist(this.dist / 1.25);
    document.getElementById("zoom-out")!.onclick = () => this.setDist(this.dist * 1.25);
    const rot = document.getElementById("rotate3d");
    if (rot) rot.onclick = () => { this.yaw += Math.PI / 4; this.saveCamera(); };
    const run = document.getElementById("run3d");
    if (run) run.onclick = () => { this.runToggle = !this.runToggle; this.sendRun(); };
  }

  /** Running: the 🏃 button turns it on and off, and holding Shift runs too. */
  private sendRun() {
    const on = this.runToggle || this.runShift;
    this.showRun(on);
    this.room?.send("run", { on });
  }

  private showRun(on: boolean) {
    document.getElementById("run3d")?.classList.toggle("on", on);
  }

  /** Which way (dx, dy) the held keys point, turned to match the camera: any angle, not just 8 ways. */
  private keyDirection(): { dx: number; dy: number } {
    const k = this.keys;
    const fwd = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    const right = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    // Not while making your character (its window covers the game).
    if (this.walkPaused || (!fwd && !right) || document.getElementById("creator")) return { dx: 0, dy: 0 };
    // The camera sits at (sin yaw, cos yaw) from you, so it looks along -(sin yaw, cos yaw).
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const vx = -s * fwd + c * right, vz = -c * fwd - s * right;
    const len = Math.hypot(vx, vz) || 1;
    return { dx: vx / len, dy: vz / len };
  }

  /** Each frame: tell the server when the keyboard direction changes (or stops). */
  private updateWalk() {
    if (!this.room) return;
    const { dx, dy } = this.keyDirection();
    const key = !dx && !dy ? "0,0" : `${dx.toFixed(3)},${dy.toFixed(3)}`;
    if (key === this.walkSent) return;
    if (key !== "0,0" && this.walkSent !== "0,0") {
      // Turning the camera while you walk: send the new way, but not every single frame.
      const [ox, oy] = this.walkSent.split(",").map(Number);
      if (ox * dx + oy * dy > 0.9995 || performance.now() - this.walkSentAt < 80) return;
    }
    this.walkSentAt = performance.now();
    if (this.walkSent === "0,0") { this.closePanels(); this.marker.visible = false; }
    this.walkSent = key;
    this.room.send("walk", { dx, dy });
  }

  private closePanels() {
    closeShop();
    closeRepair();
    closeCraft();
    closeBounties();
    closeGuild();
    closeChest();
    closeInfo();
    closeDialog();
  }

  private setDist(d: number) {
    this.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, d));
    this.saveCamera();
  }

  /** The tile under a point on the screen: trees, rocks and people first, then the ground. */
  private tileAt(sx: number, sy: number): { x: number; y: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // People and monsters (their tile is where they stand).
    const actors: THREE.Object3D[] = [];
    for (const m of this.monsters.values()) if (m.root.visible) actors.push(m.root);
    for (const p of this.npcs.values()) actors.push(p.root);
    for (const s of this.stations.values()) actors.push(s.root);
    for (const [id, p] of this.players) if (id !== this.room?.sessionId) actors.push(p.root);
    const hits = this.raycaster.intersectObjects([...actors, ...this.terrain.pickables()], true);
    for (const h of hits) {
      const t = this.terrain.tileOfHit(h);
      if (t) return t;
      for (let o: THREE.Object3D | null = h.object; o; o = o.parent) {
        if (actors.includes(o)) {
          return { x: Math.floor(o.position.x / TILE), y: Math.floor(o.position.z / TILE) };
        }
      }
    }
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return null;
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.z / TILE) };
  }

  /** Where the last click's ray meets the ground, if that's inside tile (x, y). */
  private groundSpot(x: number, y: number): THREE.Vector3 | null {
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return null;
    return Math.floor(p.x / TILE) === x && Math.floor(p.z / TILE) === y ? p : null;
  }

  private onHover(sx: number, sy: number) {
    if (!this.room) return;
    const now = performance.now();
    if (now - this.lastHover < 60) return;
    this.lastHover = now;
    const t = this.tileAt(sx, sy);
    if (!t) { setHoverText(null); return; }
    this.hoverText(t.x, t.y, sx, sy);
  }

  private onClick(sx: number, sy: number) {
    if (!this.room) return;
    const t = this.tileAt(sx, sy);
    if (!t) return;
    const { x, y } = t;
    this.closePanels();
    this.pendingBook = null;
    // Clicking takes over from the keys (until you press or let go of one).
    if (this.walkSent !== "0,0") {
      this.room.send("walk", { dx: 0, dy: 0 });
      this.walkSent = "0,0";
      this.walkPaused = true;
    }
    if (areaAt(x, y) !== this.here) return;
    const npc = npcAt(x, y);
    const monster = this.monsterAt(x, y);
    const other = this.otherPlayerAt(x, y);
    if (monster) { this.room.send("attack", { id: monster }); return; }
    else if (other && !npc) { this.room.send("partyInvite", { id: other }); return; }
    else if (npc) this.room.send("talk", { id: npc.id });
    else if (MAP[y]?.[x] === "shelf") { this.readShelf(x, y); return; }
    else if (this.isStandingTree(x, y)) this.room.send("chop", { x, y });
    else if (this.isFullRock(x, y)) this.room.send("mine", { x, y });
    else if (this.isFullPatch(x, y)) this.room.send("dig", { x, y });
    else if (isFishingSpot(x, y)) this.room.send("fish", { x, y });
    else if (lotAt(x, y) && this.plots.has(String(lotAt(x, y)!.lot))) this.room.send("farm", { x, y });
    else if (isWalkable(x, y)) {
      // Walk right to the spot you clicked (not just the middle of its tile).
      const spot = this.groundSpot(x, y);
      this.room.send("move", spot ? { x, y, fx: spot.x / TILE, fy: spot.z / TILE } : { x, y });
      this.marker.position.copy(spot ?? tileCenter(x, y)).setY(0.08);
      this.marker.visible = true;
      return;
    } else return;
    this.marker.position.copy(tileCenter(x, y)).setY(0.08);
    this.marker.visible = true;
  }

  // ---------------------------------------------------------------- joining the server

  private attach(room: Room, reconnected = false) {
    this.walkSent = "0,0";
    this.room = room;
    setReportRoom(room);
    room.onMessage("message", (text: string) => showMessage(text));
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
    room.onMessage("dialog", (msg: { name: string; lines: string[] }) => { this.marker.visible = false; openDialog(msg.name, msg.lines); });
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
      if (code === 1000) this.hud.textContent = "Disconnected from server.";
      else void this.recover(room.reconnectionToken);
    });
  }

  private async recover(token: string) {
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
    this.clearWorld();
    this.hud.textContent = "Log in to play";
    this.attach(await showLogin(joinWorld));
  }

  private async signOut() {
    const room = this.room;
    if (!room) return;
    this.room = undefined;
    try { await room.leave(true); } catch { /* already gone */ }
    this.clearWorld();
    resetForSignOut();
    this.hud.textContent = "Log in to play";
    this.attach(await showLogin(joinWorld));
  }

  private clearWorld() {
    this.players.forEach((v) => v.dispose());
    this.players.clear();
    this.monsters.forEach((v) => v.dispose());
    this.monsters.clear();
    this.terrain.clearDepleted();
    this.marker.visible = false;
    this.lastDisciplines = undefined;
    this.skillXpSeen = false;
  }

  private onResume() {
    const room = this.room;
    if (!room) return;
    room.state.players.forEach((player: any, sessionId: string) => this.players.get(sessionId)?.place(player.x, player.y));
  }

  /** ⚙️ Settings > Change my look: the character creator. */
  private editLook() {
    const room = this.room;
    const me = room?.state.players.get(room.sessionId);
    if (!room || !me) return;
    const current = playerRecipe(me.look, me.name, me.color);
    openCreator(current, me.look ? "edit" : "new", (look) => room.send("setLook", { look }));
  }

  private listenToState(room: Room) {
    const $ = getStateCallbacks(room);
    $(room.state).depleted.onAdd((_at: number, key: string) => this.terrain.setDepleted(key, true));
    $(room.state).depleted.onRemove((_at: number, key: string) => this.terrain.setDepleted(key, false));

    $(room.state).players.onAdd((player: any, sessionId: string) => {
      const isMe = sessionId === room.sessionId;
      const view = new Person(playerRecipe(player.look, player.name, player.color), { name: player.name, me: isMe });
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
      $(player).listen("color", (color: number) => { if (!player.look) view.setLook(playerRecipe("", player.name, color)); if (isMe) renderMe(player.name, color); });
      $(player).listen("look", (look: string) => { if (look) view.setLook(lookToRecipe(look) ?? playerRecipe("", player.name, player.color)); });
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
  }

  /** A footstep for every tile's length you walk (in any direction), on whatever ground is under you. */
  private footsteps(me: Person) {
    const p = me.root.position;
    const d = Math.hypot(p.x - this.lastStepAt.x, p.z - this.lastStepAt.z);
    if (d > TILE * 3) this.lastStepAt.copy(p); // through a door: no step
    else if (d >= TILE * 0.95) {
      this.lastStepAt.copy(p);
      sfx.onStep(Math.floor(p.x / TILE), Math.floor(p.z / TILE));
    }
  }

  private moveTo(view: Person, player: any, isMe: boolean) {
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
  }

  // ---------------------------------------------------------------- areas, NPCs and lighting

  private showArea(a: AreaDef, x: number, y: number) {
    this.here = a;
    this.terrain.setArea(a);
    this.terrain.setCenter(x, y);
    for (const s of this.signLabels) { s.parent?.remove(s); s.element.remove(); }
    this.signLabels = [];
    for (const s of this.terrain.signs) {
      const l = label("sign3d", s.text);
      l.obj.position.copy(s.at);
      this.scene.add(l.obj);
      this.signLabels.push(l.obj);
    }
    const inArea = (px: number, py: number) => areaAt(px, py) === a;
    this.npcs.forEach((p, id) => { const n = NPCS.find((d) => d.id === id)!; p.root.userData.show = inArea(n.x, n.y); });
    this.stations.forEach((s, id) => { const n = NPCS.find((d) => d.id === id)!; s.root.userData.show = inArea(n.x, n.y); });
    this.room?.state.players.forEach((pl: any, id: string) => { const v = this.players.get(id); if (v) v.root.userData.show = inArea(pl.x, pl.y) || id === this.room!.sessionId; });
    this.room?.state.monsters?.forEach((m: any, id: string) => { const v = this.monsters.get(id); if (v) v.root.userData.show = m.alive && inArea(m.x, m.y); });
    this.plotViews.forEach((v) => { v.group.visible = a === OUTDOORS; });
    this.sky.object.visible = a.kind === "outdoor";
    this.scene.background = a.kind === "outdoor" ? null : new THREE.Color(0x000000);
    this.updateDaylight();
  }

  private drawNpcs() {
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
  }

  /** 0 in the day, 1 at night (what lanterns and windows light up with). */
  private nightLevel(): number {
    if (this.here.kind !== "outdoor") return this.here.kind === "cave" ? 1 : 0.6;
    return darkness(Date.now() + this.clockOffset);
  }

  private updateDaylight() {
    const now = Date.now() + this.clockOffset;
    const fog = this.scene.fog as THREE.Fog;
    if (this.here.kind === "outdoor") {
      // Blend between the gallery's day, sunset and night lighting.
      let d = darkness(now) * (this.hasLantern ? 0.75 : 1);
      if (nightSightOn()) d = Math.min(d, 0.15);
      const a = d < 0.5 ? SKY_TIMES.day : SKY_TIMES.sunset, b = d < 0.5 ? SKY_TIMES.sunset : SKY_TIMES.night;
      const k = d < 0.5 ? d * 2 : (d - 0.5) * 2;
      const c = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), k);
      this.hemi.color.copy(c(a.hemi[0] as number, b.hemi[0] as number));
      this.hemi.groundColor.copy(c(a.hemi[1] as number, b.hemi[1] as number));
      this.hemi.intensity = (a.hemi[2] as number) * (1 - k) + (b.hemi[2] as number) * k;
      this.sun.color.copy(c(a.sun[0] as number, b.sun[0] as number));
      this.sun.intensity = (a.sun[1] as number) * (1 - k) + (b.sun[1] as number) * k;
      const dir = new THREE.Vector3(...(a.dir as unknown as [number, number, number])).lerp(new THREE.Vector3(...(b.dir as unknown as [number, number, number])), k).normalize();
      this.sun.position.copy(this.focus).addScaledVector(dir, 60);
      this.renderer.toneMappingExposure = a.exposure * (1 - k) + b.exposure * k;
      fog.color.copy(c(a.fog, b.fog));
      fog.near = 40; fog.far = 95;
      this.sky.setTime(d < 0.25 ? "day" : d < 0.75 ? "sunset" : "night");
    } else {
      const cave = this.here.kind === "cave";
      this.hemi.color.setHex(cave ? 0x8a8ab0 : 0xfff0d8);
      this.hemi.groundColor.setHex(cave ? 0x1a1814 : 0x5a4a38);
      this.hemi.intensity = cave ? 0.7 : 1.3;
      this.sun.color.setHex(cave ? 0xffb070 : 0xfff1d6);
      this.sun.intensity = cave ? 0.7 : 1.4;
      this.sun.position.copy(this.focus).add(new THREE.Vector3(10, 40, 20));
      this.renderer.toneMappingExposure = 1.05;
      fog.color.setHex(0x000000);
      fog.near = 30; fog.far = 80;
    }
    tickBuffs();
    const night = isNight(now);
    if (this.wasNight !== null && night !== this.wasNight && this.room) showMessage(night ? "🌙 Night falls over the town." : "☀️ The sun comes up.");
    this.wasNight = night;
    const clock = document.getElementById("clock");
    if (clock) {
      const mins = minutesUntilChange(now);
      clock.textContent = night ? "🌙" : "☀️";
      clock.title = night ? `Night. The sun comes up in about ${mins} minute${mins === 1 ? "" : "s"}.` : `Day. Night falls in about ${mins} minute${mins === 1 ? "" : "s"}.`;
    }
  }

  /** Lit lanterns and shrines, and 📍 where your quest sends you. */
  private showStory(q: QuestView) {
    const lit = new Set<string>(q.lit ?? []);
    this.stations.forEach((s, id) => s.setLit?.(lit.has(id)));
    for (const o of this.spotMarks) { o.parent?.remove(o); if (o instanceof CSS2DObject) o.element.remove(); }
    this.spotMarks = [];
    for (const s of q.spots ?? []) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(tileCenter(s.x, s.y)).setY(0.1);
      const pin = label("pin3d", "📍");
      pin.obj.position.copy(tileCenter(s.x, s.y)).setY(2);
      this.scene.add(ring, pin.obj);
      this.spotMarks.push(ring, pin.obj);
    }
  }

  /** Click a bookshelf: walk up to it, then take a book down and read it. */
  private readShelf(x: number, y: number) {
    const me = this.room && this.room.state.players.get(this.room.sessionId);
    if (!me) return;
    if (Math.max(Math.abs(me.x - x), Math.abs(me.y - y)) <= 1) { this.openBook(x, y); return; }
    // The free tile next to the shelf that's closest to us.
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!isWalkable(nx, ny) || areaAt(nx, ny) !== this.here) continue;
      const d = Math.hypot(nx - me.x, ny - me.y);
      if (d < bd) { bd = d; best = { x: nx, y: ny }; }
    }
    if (!best) { this.openBook(x, y); return; }
    this.pendingBook = { x, y };
    this.room!.send("move", best);
    this.marker.position.copy(tileCenter(best.x, best.y)).setY(0.08);
    this.marker.visible = true;
  }

  private openBook(x: number, y: number) {
    const book = bookAt(this.here.id, x, y);
    this.marker.visible = false;
    openDialog(`📖 ${book.title}`, book.pages);
  }

  // ---------------------------------------------------------------- floating text and effects

  private floatText(text: string, color: string, big = false) {
    const me = this.room && this.players.get(this.room.sessionId);
    if (!me) return;
    const l = label("float3d" + (big ? " big" : ""), "");
    l.el.textContent = text;
    l.el.style.color = color;
    const start = me.root.position.clone().setY(2.6);
    l.obj.position.copy(start);
    this.scene.add(l.obj);
    this.effects.push({ obj: l.obj, t: 0, life: big ? 2.5 : 1.4, step: (f) => { l.obj.position.y = start.y + f * (big ? 2.2 : 1.4); l.el.style.opacity = String(1 - f * f); } });
  }

  private celebrateLevelUp(discipline: DisciplineId) {
    setTimeout(() => this.floatText(`${DISCIPLINES[discipline].name} level up!`, "#ffd84a", true), 350);
    flashDiscipline(discipline);
    const me = this.room && this.players.get(this.room.sessionId);
    if (!me) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 32), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(me.root.position).setY(0.15);
    this.scene.add(ring);
    this.effects.push({ obj: ring, t: 0, life: 0.9, step: (f) => { ring.scale.setScalar(1 + f * 4); (ring.material as THREE.MeshBasicMaterial).opacity = 1 - f; } });
  }

  private celebrateSkill(skill: SkillId, level: number) {
    setTimeout(() => this.floatText(`${findSkill(skill).def.name} level ${level}!`, "#ffd84a", true), 350);
    flashSkillRow(skill);
  }

  private celebrateMastery(type: MasteryId, level: number) {
    setTimeout(() => this.floatText(`${masteryName(type)} Mastery ${level}!`, "#7fd0ff"), 700);
    flashMastery(type);
  }

  private showHit(h: { on: "monster" | "player"; id: string; damage: number; miss: boolean; spell: SpellId | null; from: string }) {
    const target = h.on === "monster" ? this.monsters.get(h.id) : this.players.get(h.id);
    if (!target || !target.root.visible) return;
    if (h.on === "monster" && !h.miss) (target as MonsterView).hit();
    if (h.on === "player") this.monsters.get(h.from)?.attack();
    const icon = h.spell === "fire_blast" ? "🔥" : h.spell === "frost_bolt" ? "❄️" : h.spell === "sleep" ? "💤" : h.spell === "frost_nova" ? "🌨️" : (h.spell as string) === "poison" ? "☠️" : (h.spell as string) === "lightning" ? "⚡" : "";
    const at = target.root.position.clone().setY(1.4);
    if (icon && !h.miss) {
      const fx = label("splash3d", icon);
      fx.obj.position.copy(at);
      this.scene.add(fx.obj);
      this.effects.push({ obj: fx.obj, t: 0, life: 0.5, step: (f) => { fx.el.style.transform = `scale(${1 + f})`; fx.el.style.opacity = String(1 - f); } });
    }
    if (h.spell === "sleep" && !h.miss) return;
    const t = label("splat3d " + (h.miss ? "miss" : h.on === "player" ? "hurt" : "dmg"), h.miss ? "0" : String(h.damage));
    const start = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, 0));
    t.obj.position.copy(start);
    this.scene.add(t.obj);
    this.effects.push({ obj: t.obj, t: 0, life: 0.9, step: (f) => { t.obj.position.y = start.y + f * 0.9; t.el.style.opacity = String(1 - f * f); } });
  }

  private showDeath() {
    const flash = document.getElementById("flash3d");
    if (flash) { flash.classList.remove("on"); void flash.offsetWidth; flash.classList.add("on"); }
    setTimeout(() => this.floatText("You were knocked out!", "#ff7a6a", true), 300);
  }

  // ---------------------------------------------------------------- monsters

  private addMonster(m: any, id: string, $: ReturnType<typeof getStateCallbacks>) {
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
  }

  private updateTrapGlows() {
    const state = this.room?.state;
    if (!state?.monsters) return;
    const tick = state.tick as number;
    const blinkTicks = Math.round(TRAP_BLINK_SECONDS * 1000 / TICK_MS);
    const on = Math.floor(Date.now() / 200) % 2 === 0;
    state.monsters.forEach((m: any, id: string) => {
      const left = m.alive && m.trappedUntil ? m.trappedUntil - tick : 0;
      this.monsters.get(id)?.setTrapped(left > 0 && (left > blinkTicks || on));
    });
  }

  private monsterAt(x: number, y: number): string | null {
    let found: string | null = null;
    this.room?.state.monsters?.forEach((m: any, id: string) => { if (m.alive && m.x === x && m.y === y) found = id; });
    return found;
  }

  private otherPlayerAt(x: number, y: number): string | null {
    const room = this.room;
    if (!room) return null;
    const me = room.state.players.get(room.sessionId);
    let found: string | null = null;
    room.state.players.forEach((pl: any, id: string) => {
      if (id !== room.sessionId && pl.x === x && pl.y === y && !pl.invisible && !(me?.party && pl.party === me.party)) found = id;
    });
    return found;
  }

  private refreshParty() {
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
  }

  // ---------------------------------------------------------------- what's where (same rules as the 2D game)

  private isStandingTree(x: number, y: number) { return MAP[y]?.[x] === "tree" && !this.terrain.isDepleted(treeKey(x, y)); }
  private isFullRock(x: number, y: number) { return MAP[y]?.[x] === "rock" && !this.terrain.isDepleted(treeKey(x, y)); }
  private isFullPatch(x: number, y: number) { return MAP[y]?.[x] === "dig" && !this.terrain.isDepleted(treeKey(x, y)); }

  private lockNote(type: ResourceId) {
    const r = RESOURCES[type];
    const { def } = findSkill(r.skill);
    if (!isUnlocked(this.lastDisciplines?.unlocked ?? [], r.skill)) return ` (learn ${def.name} first)`;
    return levelForXp(this.skillXp[r.skill] ?? 0) < r.level ? ` (${def.name} level ${r.level})` : "";
  }

  private myName(): string { return this.room?.state.players.get(this.room.sessionId)?.name ?? ""; }

  private hoverText(x: number, y: number, px: number, py: number) {
    const el = this.renderer.domElement;
    if (areaAt(x, y) !== this.here) { setHoverText(null); el.style.cursor = "default"; return; }
    const door = doorAt(x, y);
    const npc = npcAt(x, y);
    const monster = this.monsterAt(x, y);
    const other = this.otherPlayerAt(x, y);
    const t = MAP[y]?.[x];
    if (other && !monster && !npc) setHoverText("Invite", `${this.room!.state.players.get(other).name} to your party`, px, py);
    else if (monster) {
      const m = this.room!.state.monsters.get(monster);
      const def = MONSTERS[m.kind as MonsterId];
      setHoverText("Attack", `${def.name} (level ${def.level})${def.aggressive ? " ⚠" : ""}`, px, py);
    } else if (npc) setHoverText(npc.id.startsWith("lantern_") || npc.id.startsWith("round_") ? "Light" : npc.id === "board" || npc.id === "guildboard" ? "Read" : npc.name === "Enchanted chest" ? "Open" : npc.kind === "station" ? "Use" : "Talk-to", npc.name, px, py);
    else if (this.isStandingTree(x, y)) { const type = nodeAt(x, y)!; setHoverText("Chop down", RESOURCES[type].node + this.lockNote(type), px, py); }
    else if (t === "tree") setHoverText("Examine", `${RESOURCES[nodeAt(x, y)!].node} stump`, px, py);
    else if (this.isFullRock(x, y)) { const type = nodeAt(x, y)!; setHoverText("Mine", RESOURCES[type].node + this.lockNote(type), px, py); }
    else if (t === "rock") setHoverText("Examine", `Empty ${RESOURCES[nodeAt(x, y)!].node.toLowerCase()}`, px, py);
    else if (this.isFullPatch(x, y)) setHoverText("Dig", "Dig patch" + this.lockNote("dig"), px, py);
    else if (t === "dig") setHoverText("Examine", "Dug-out patch (it glints again soon)", px, py);
    else if (door) setHoverText(door.label.startsWith("Leave") || door.label.startsWith("Back") || door.label.startsWith("Go") ? door.label : "Enter", door.label.replace(/^Enter /, ""), px, py);
    else if (this.here.danger && (t === "cave" || t === "crystal")) setHoverText(`⚠ ${this.here.name}:`, "monsters here attack on sight!", px, py);
    else if (t === "lockeddoor") setHoverText("Locked", "a heavy door with a gold lock", px, py);
    else if (t === "barricade") setHoverText("Road closed:", "the Ashen Barrens lie beyond. The Watch has shut the road.", px, py);
    else if (lotAt(x, y)) {
      const at = lotAt(x, y)!;
      const plot = this.plots.get(String(at.lot));
      const c = plot && inPlot(at.index, plot.w, plot.h) ? decodeCrop(plot.crops[at.index]) : null;
      const now = serverNow();
      if (!plot) setHoverText("Walk here", "Free farm lot (Farmer Odo sells plots)", px, py);
      else if (!inPlot(at.index, plot.w, plot.h)) setHoverText("Examine", `${plot.owner}'s lot (not planted yet)`, px, py);
      else if (!c) setHoverText(plot.owner === this.myName() ? "Plant" : "Examine", `Empty soil in ${plot.owner}'s farm`, px, py);
      else if (now >= c.ripeAt) setHoverText(plot.owner === this.myName() ? "Harvest" : "Examine", `Ripe ${ITEMS[CROPS[c.crop].produce].name.toLowerCase()}`, px, py);
      else setHoverText("Examine", `${ITEMS[CROPS[c.crop].produce].name}, ripe in ${timeLeft(c.ripeAt - now)}`, px, py);
    } else if (isFishingSpot(x, y)) { const type = fishAt(x, y)!; setHoverText("Fish", RESOURCES[type].node + this.lockNote(type), px, py); }
    else if (t === "sign") {
      if (y < 90) setHoverText("⚠ Road closed:", "the Ashen Barrens lie beyond, where the Withering began.", px, py);
      else setHoverText("⚠ Danger:", "the Dark Forest. Monsters attack on sight!", px, py);
    } else if (t === "gate") setHoverText("Walk into", "the Dark Forest ⚠", px, py);
    else if (isWalkable(x, y)) setHoverText("Walk here", "", px, py);
    else setHoverText(null);
    el.style.cursor = npc || monster || door || this.isStandingTree(x, y) || this.isFullRock(x, y) || this.isFullPatch(x, y) || isFishingSpot(x, y) ? "pointer" : "default";
  }

  // ---------------------------------------------------------------- farm plots

  private drawPlot(key: string) {
    const lot = LOTS[Number(key)];
    if (!lot) return;
    let view = this.plotViews.get(key);
    if (view) { this.scene.remove(view.group); view.sign.element.remove(); view.crops.forEach((c) => c.element.remove()); }
    const group = new THREE.Group();
    group.visible = this.here === OUTDOORS;
    const plot = this.plots.get(key);
    const sign = label("sign3d small", plot ? `${plot.owner}'s farm` : "Free lot: ask Farmer Odo");
    sign.obj.position.copy(tileCenter(lot.x, lot.y)).add(new THREE.Vector3(LOT_SIZE * TILE / 2 - TILE / 2, 1.2, -TILE / 2));
    group.add(sign.obj);
    const crops: CSS2DObject[] = [];
    const now = serverNow();
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 });
    for (let i = 0; i < LOT_SIZE * LOT_SIZE; i++) {
      if (!plot || !inPlot(i, plot.w, plot.h)) continue;
      const t = tileOf(Number(key), i);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.92, 0.12, TILE * 0.92), soilMat);
      soil.position.copy(tileCenter(t.x, t.y)).setY(0.06);
      soil.receiveShadow = true;
      group.add(soil);
      const c = decodeCrop(plot.crops[i]);
      if (!c) continue;
      const g = growth(c, now);
      const l = label("crop3d", g >= 1 ? ITEMS[CROPS[c.crop].produce].icon : g < 0.34 ? "🌱" : "🌿");
      l.el.style.fontSize = `${Math.round(14 + g * 12)}px`;
      l.obj.position.copy(tileCenter(t.x, t.y)).setY(0.5);
      group.add(l.obj);
      crops.push(l.obj);
    }
    this.scene.add(group);
    view = { group, sign: sign.obj, crops };
    this.plotViews.set(key, view);
  }

  private redrawPlots() { for (const key of this.plotViews.keys()) this.drawPlot(key); }

  private updateHud() { this.hud.textContent = `${this.players.size} player(s) online`; }
}
