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
import { Room } from "colyseus.js";
import { AreaDef, OUTDOORS, TOWN_SPOT, areaAt } from "../../../shared/map";
import { Minimap } from "./minimap";
import { emptyBag } from "../../../shared/bag";
import { DisciplineView, SkillXp, emptySkills } from "../../../shared/disciplines";
import { joinWorld } from "../../../client/src/network";
import { showLogin } from "../../../client/src/login";
import { setReportSource } from "../../../client/src/report";
import { crumb, setCrashSource, watchCanvas } from "../../../client/src/crash";
import { setWorldMapActions, setWorldMapPlayers } from "../../../client/src/worldmap";
import { renderBag, showMessage } from "../../../client/src/ui";
import { createSkyDome, TILE, type SkyDome } from "../environment";
import { setRockEnvironment } from "../rocks";
import { Terrain } from "./terrain";
import { MonsterView, Person, type StationView } from "./actors";
import * as sfx from "./sfx";
import { AutoQuality } from "./quality";
import { Townsfolk } from "./townsfolk";
import { setMusicPlace, setupMusicSettings, updateMusic } from "./music";
import { type Stick } from "./joystick";
import { CAM_KEY, CULL_M } from "./world/common";
import { cameraMethods } from "./world/camera";
import { inputMethods } from "./world/input";
import { networkMethods } from "./world/network";
import { effectsMethods } from "./world/effects";
import { storyMethods } from "./world/story";
import { daylightMethods } from "./world/daylight";
import { farmMethods } from "./world/farm";

/**
 * The 3D game. The class holds the scene and the frame loop; most of what it does
 * lives in files under client3d/src/game/world/, added to this class at the bottom
 * (the interface below declares them).
 */
export class World3D {
  renderer: THREE.WebGLRenderer;
  labels: CSS2DRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.3, 700);
  hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5b6b3a, 1.1);
  sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sky: SkyDome = createSkyDome();
  terrain = new Terrain();
  clock = new THREE.Clock();
  quality: AutoQuality;
  time = 0;
  raycaster = new THREE.Raycaster();
  ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Camera: it orbits round you. Yaw 0 looks north (the map's "up").
  yaw = 0;
  pitch = 0.95;
  dist = 24;
  camDist = 24; // how far the camera really is (closer when a wall is in the way)
  focus = new THREE.Vector3();

  room?: Room;
  players = new Map<string, Person>();
  monsters = new Map<string, MonsterView>();
  npcs = new Map<string, Person>();
  stations = new Map<string, StationView>();
  marker: THREE.Mesh;
  /** The gold arrow on the ground by your feet, pointing the way to your quest's next ❗ or 📍. */
  guide = new THREE.Group();
  hud = document.getElementById("hud")!;
  lastDisciplines?: DisciplineView;
  skillXpSeen = false;
  skillXp: SkillXp = emptySkills();
  hasLantern = false;
  /** For sound effects: what you're doing, how full your bag is, and the monster you last hit. */
  myAction = "idle";
  bagTotal = -1;
  lastTarget = { id: "", at: 0 };
  clockOffset = 0;
  wasNight: boolean | null = null;
  here: AreaDef = OUTDOORS;
  spotMarks: THREE.Object3D[] = [];
  signLabels: CSS2DObject[] = [];
  effects: { obj: THREE.Object3D; t: number; life: number; step: (f: number) => void }[] = [];
  plots = new Map<string, any>();
  plotViews = new Map<string, { group: THREE.Group; sign: CSS2DObject; crops: CSS2DObject[] }>();
  lastHover = 0;
  loading = document.getElementById("loading3d");
  lightTimer = 0;
  // Walking with the keyboard (WASD).
  keys = new Set<string>();
  /** The touch-screen walking pad (all zero on a computer). */
  stick: Stick = { fwd: 0, right: 0 };
  walkSent = "0,0"; // the direction we last told the server ("dx,dy")
  walkSentAt = 0; // when we told it (ms)
  lastStepAt = new THREE.Vector3(); // where we last played a footstep
  pendingBook: { x: number; y: number } | null = null; // a shelf we're walking to, to read
  walkPaused = false;
  runToggle = false; // the 🏃 button
  runShift = false; // holding Shift
  minimap = new Minimap();
  areaSwitch: (() => void) | null = null;
  areaHold = 0;
  mapPlayersTimer = 0; // how soon to tell the 🗺️ map where other players are
  /** Ordinary people walking round town and the Emberhall (shared/townsfolk.ts). */
  folk: Townsfolk;
  /**
   * The opening scene for a new character (Mike's note #1): they're formed lying by
   * the Heart Shrine, Keeper Celene walks over and helps them up, then she talks.
   */
  intro: { t: number; wait?: number; name: string; lines: string[]; talked: boolean; cam: { yaw: number; pitch: number; dist: number }; skip?: HTMLButtonElement; sparks?: THREE.Points } | null = null;


  constructor(public host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.quality = new AutoQuality(this.renderer); // sharpness: drawn a little softer if frames get slow
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    // A phone short of memory can throw away everything on the graphics card. Three.js
    // puts most of it back, but the merged ground and walls keep no spare copy: build them again.
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); crumb("graphics lost"); });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => { crumb("graphics back"); this.terrain.rebuild(); });
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
    // Drawn on top of everything, so a wall or a tree never hides it.
    const arrowMesh = new THREE.Mesh(new THREE.ShapeGeometry(arrow), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(arrow.getPoints().map((p) => new THREE.Vector3(p.x, p.y, 0.01))), new THREE.LineBasicMaterial({ color: 0x5a3d00, depthTest: false }));
    edge.renderOrder = 1001;
    arrowMesh.add(edge);
    arrowMesh.rotation.x = -Math.PI / 2;
    arrowMesh.renderOrder = 1000;
    arrowMesh.scale.setScalar(1.3);
    this.guide.add(arrowMesh);
    this.guide.visible = false;
    this.scene.add(this.guide);

    try {
      const saved = JSON.parse(localStorage.getItem(CAM_KEY) ?? "null");
      if (saved) { this.yaw = saved.yaw ?? 0; this.dist = saved.dist ?? 20; this.pitch = saved.pitch ?? 0.95; }
    } catch { /* storage blocked */ }

    this.drawNpcs();
    this.folk = new Townsfolk(this.scene);
    const town = areaAt(TOWN_SPOT.x, TOWN_SPOT.y) ?? OUTDOORS;
    this.showArea(town, TOWN_SPOT.x, TOWN_SPOT.y);
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
    // 💥 Automatic crash reports: what's being drawn, and the drawing being lost.
    watchCanvas(this.renderer.domElement);
    setCrashSource("3d", () => this.room?.sessionId, () => {
      const info = this.renderer.info;
      const me = this.room ? (this.room.state as any)?.players?.get(this.room.sessionId) : null;
      return {
        area: this.here?.id, x: me?.x, y: me?.y, connected: !!this.room,
        drawCalls: info.render.calls, triangles: info.render.triangles,
        geometries: info.memory.geometries, textures: info.memory.textures,
        pixelRatio: this.renderer.getPixelRatio(), objects: this.scene.children.length,
      };
    });
    this.loop();
  }

  async start() {
    this.hud.textContent = "Log in to play";
    sfx.setupSoundSettings();
    setupMusicSettings();
    // ?at=x,y shows that spot of the world behind the login box (for looking around and testing).
    const at = new URLSearchParams(location.search).get("at")?.split(",").map(Number);
    if (at && at.length === 2 && at.every(Number.isFinite)) this.lookAt(at[0], at[1]);
    this.attach(await showLogin(joinWorld));
  }


  // ---------------------------------------------------------------- the frame loop

  loop = () => {
    requestAnimationFrame(this.loop);
    // Going through a door: wait until the loading sign has been drawn, then switch places.
    if (this.areaSwitch) {
      if (--this.areaHold > 0) return;
      const go = this.areaSwitch;
      this.areaSwitch = null;
      go();
    }
    const dt = Math.min(0.1, this.clock.getDelta());
    this.quality.update(dt);
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
    this.updateIntro(dt, me);
    this.updateSpotRings();
    this.updateHallEmbers();
    this.updateTour(dt);
    for (const p of this.npcs.values()) if (near(p.root)) p.update(dt, this.time);
    const worldMs = Date.now() + this.clockOffset;
    this.folk.update(dt, this.time, worldMs, this.here.id);
    for (const r of this.folk.all()) near(r);
    // Doors swing open for anyone walking up to them.
    this.terrain.walkers = [...[...this.players.values()].filter((p) => p.root.visible).map((p) => p.root.position), ...this.folk.roots().map((r) => r.position)];
    setMusicPlace(this.room ? this.here.id : "");
    updateMusic(dt);
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






















  // ---------------------------------------------------------------- places to go (a "reach" quest step)

  spotRings: THREE.Group[] = [];
  /** Embers drifting up through the Emberhall's great hall (only while you're inside). */
  hallEmbers: THREE.Points | null = null;











  /** Keeper Oren's tour: where we're going next, and the guide walking beside you. */
  tour: { guide: string; stops: string[]; sent: boolean; wait: number; follow: number } | null = null;


























}

type CameraMethods = typeof cameraMethods;
type InputMethods = typeof inputMethods;
type NetworkMethods = typeof networkMethods;
type EffectsMethods = typeof effectsMethods;
type StoryMethods = typeof storyMethods;
type DaylightMethods = typeof daylightMethods;
type FarmMethods = typeof farmMethods;
export interface World3D extends CameraMethods, InputMethods, NetworkMethods, EffectsMethods, StoryMethods, DaylightMethods, FarmMethods {}
Object.assign(World3D.prototype, cameraMethods, inputMethods, networkMethods, effectsMethods, storyMethods, daylightMethods, farmMethods);
