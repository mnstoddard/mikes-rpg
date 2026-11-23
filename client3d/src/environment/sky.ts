// The sky: a big dome round the world that changes with the time of day
// (sun, moon and stars), clouds that drift across it, and weather.
import * as THREE from "three";
import { EnvPiece, Parts, disposeGroup, jitter, makeRng, mat } from "./kit";

export type TimeOfDay = "day" | "sunset" | "night";

/** Colours and lights for each time of day. */
export const SKY_TIMES = {
  day: { top: 0x3f8ede, mid: 0x86c0ec, low: 0xd6eaf0, fog: 0xcfe4ee, hemi: [0xcfe8ff, 0x5b6b3a, 1.1], sun: [0xfff1d6, 2.4], dir: [0.45, 0.75, 0.5], exposure: 1.05, bloom: 0.2, night: 0 },
  sunset: { top: 0x3e4c8e, mid: 0xe2907a, low: 0xf8c27a, fog: 0xe8b090, hemi: [0xffd2b0, 0x5a4a48, 1.0], sun: [0xffa060, 2.3], dir: [-0.85, 0.22, 0.3], exposure: 1.0, bloom: 0.35, night: 0.45 },
  night: { top: 0x070d24, mid: 0x152248, low: 0x2b3a62, fog: 0x1e2a4a, hemi: [0x5a6fae, 0x141824, 0.5], sun: [0xa9c1ff, 0.55], dir: [-0.4, 0.8, -0.5], exposure: 1.15, bloom: 0.9, night: 1 },
} as const;

export interface SkyDome {
  object: THREE.Group;
  /** 0: smooth colours. 1: low-poly bands of colour. */
  setStyle(style: number): void;
  setTime(t: TimeOfDay): void;
  /** Grey storm sky with lightning. */
  setStorm(on: boolean): void;
  /** How bright a lightning flash is right now (0 to 1), to light the scene. */
  flash: number;
  update(dt: number, time: number): void;
}

/** Storm sky colours for each time of day. */
const STORM = {
  day: { top: 0x5a626c, mid: 0x7e868e, low: 0x9ea4a8 },
  sunset: { top: 0x3e3c48, mid: 0x6a5e62, low: 0x9a7e6e },
  night: { top: 0x0e1016, mid: 0x1c2028, low: 0x2a2e36 },
} as const;

/** The dome. It follows the camera, so it always looks infinitely far away. */
export function createSkyDome(): SkyDome {
  const group = new THREE.Group();
  const R = 300;
  const geo = new THREE.SphereGeometry(R, 24, 16).toNonIndexed();
  const colors = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  dome.renderOrder = -10;
  group.add(dome);
  // Sun and moon.
  const sun = new THREE.Mesh(new THREE.CircleGeometry(14, 16), new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false, transparent: true, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.CircleGeometry(26, 16), new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false, transparent: true, opacity: 0.25, depthWrite: false }));
  const moon = new THREE.Group();
  const moonFace = new THREE.Mesh(new THREE.CircleGeometry(10, 14), new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false, depthWrite: false }));
  moon.add(moonFace);
  const rng = makeRng(5);
  for (let i = 0; i < 5; i++) {
    const cr = new THREE.Mesh(new THREE.CircleGeometry(1.2 + rng() * 2, 7), new THREE.MeshBasicMaterial({ color: 0xc8d0e8, fog: false, depthWrite: false }));
    cr.position.set((rng() - 0.5) * 11, (rng() - 0.5) * 11, 0.1);
    moon.add(cr);
  }
  // The moon's dark side, so it's a crescent.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(10, 14), new THREE.MeshBasicMaterial({ color: 0x152248, fog: false, depthWrite: false }));
  shadow.position.set(5, 2, 0.2);
  moon.add(shadow);
  for (const m of [sun, halo, moon]) group.add(m);
  // Stars.
  const starGeo = new THREE.BufferGeometry();
  const sp: number[] = [];
  const twinkle: number[] = [];
  for (let i = 0; i < 700; i++) {
    const u = rng(), v = 0.08 + rng() * 0.92;
    const a = u * Math.PI * 2, el = Math.asin(v);
    sp.push(Math.cos(a) * Math.cos(el) * (R - 10), Math.sin(el) * (R - 10), Math.sin(a) * Math.cos(el) * (R - 10));
    twinkle.push(rng() * 6.28);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  let style = 0;
  let time: TimeOfDay = "day";
  let storm = false;
  // Lightning: a jagged bolt that flashes now and then.
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xe8f0ff, fog: false, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const bolt = new THREE.Group();
  const makeBolt = () => {
    bolt.clear();
    let x = 0, y = 0;
    const r2 = makeRng(Math.floor(Math.random() * 1e6) + 1);
    const seg = (x0: number, y0: number, x1: number, y1: number, w: number) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), boltMat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      m.rotation.z = -Math.atan2(x1 - x0, y1 - y0);
      bolt.add(m);
    };
    for (let i = 0; i < 9; i++) {
      const nx = x + (r2() - 0.5) * 14, ny = y - 9 - r2() * 5;
      seg(x, y, nx, ny, 2.2 - i * 0.15);
      if (r2() < 0.3) seg(nx, ny, nx + (r2() - 0.5) * 18, ny - 8, 1);
      x = nx;
      y = ny;
    }
    const a = Math.random() * Math.PI * 2;
    bolt.position.set(Math.cos(a) * (R - 40), 115, Math.sin(a) * (R - 40));
    bolt.lookAt(0, 115, 0);
  };
  group.add(bolt);
  let flashT = 0, nextFlash = 3;
  const flashCol = new THREE.Color(0xcfd8ff);
  const paint = () => {
    const s = SKY_TIMES[time];
    const sc = storm ? STORM[time] : s;
    const top = new THREE.Color(sc.top), mid = new THREE.Color(sc.mid), low = new THREE.Color(sc.low);
    const c = new THREE.Color();
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const dir = new THREE.Vector3(...s.dir).normalize();
    const sunCol = new THREE.Color(s.sun[0]);
    for (let i = 0; i < pos.count; i += 3) {
      let y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 / R;
      const fx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 / R, fz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3 / R;
      if (style === 1) y = Math.round(y * 7) / 7;
      if (y < 0) c.copy(low).lerp(mid, 0.35);
      else if (y < 0.35) c.copy(low).lerp(mid, y / 0.35);
      else c.copy(mid).lerp(top, Math.min(1, (y - 0.35) / 0.55));
      // A warm glow on the side of the sky where the sun is.
      const toward = Math.max(0, fx * dir.x + fz * dir.z) * (1 - Math.abs(y));
      if (time !== "night" && !storm) c.lerp(sunCol, toward * (time === "sunset" ? 0.45 : 0.12));
      for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
    }
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    const sunPos = dir.clone().multiplyScalar(R - 30);
    sun.position.copy(sunPos);
    halo.position.copy(dir.clone().multiplyScalar(R - 28));
    sun.lookAt(0, 0, 0);
    halo.lookAt(0, 0, 0);
    (sun.material as THREE.MeshBasicMaterial).color.setHex(time === "sunset" ? 0xffb070 : 0xfff4c8);
    (halo.material as THREE.MeshBasicMaterial).color.setHex(time === "sunset" ? 0xff9a60 : 0xfff4c8);
    sun.visible = halo.visible = time !== "night" && !storm;
    moon.visible = time !== "day" && !storm;
    const md = time === "night" ? new THREE.Vector3(-0.4, 0.55, -0.7) : new THREE.Vector3(0.6, 0.35, -0.7);
    moon.position.copy(md.normalize().multiplyScalar(R - 30));
    moon.lookAt(0, 0, 0);
    (moonFace.material as THREE.MeshBasicMaterial).opacity = 1;
    (shadow.material as THREE.MeshBasicMaterial).color.copy(time === "night" ? mid : new THREE.Color(s.top).lerp(mid, 0.5));
    stars.visible = time !== "day" && !storm;
    for (let i = 0; i < colors.length; i++) base[i] = colors[i];
    starMat.opacity = time === "night" ? 1 : 0.25;
  };
  const base = new Float32Array(colors.length);
  paint();
  const api: SkyDome = {
    object: group,
    flash: 0,
    setStorm(on) {
      if (on === storm) return;
      storm = on;
      paint();
    },
    setStyle(s) {
      style = s;
      paint();
    },
    setTime(t) {
      time = t;
      paint();
    },
    update(dt, t) {
      if (stars.visible) starMat.size = 2 + Math.sin(t * 2.3) * 0.35;
      void twinkle;
      let f = 0;
      if (storm) {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          makeBolt();
          flashT = 0.55;
          nextFlash = 2.5 + Math.random() * 5;
        }
        if (flashT > 0) {
          flashT -= dt;
          // Two or three quick flickers.
          f = Math.max(0, Math.sin((0.55 - flashT) * 34)) * (flashT / 0.55);
        }
      }
      boltMat.opacity = f;
      if (f > 0 || api.flash > 0) {
        const k = f * (time === "night" ? 0.6 : 0.35);
        for (let i = 0; i < colors.length; i += 3) {
          colors[i] = base[i] + (flashCol.r - base[i]) * k;
          colors[i + 1] = base[i + 1] + (flashCol.g - base[i + 1]) * k;
          colors[i + 2] = base[i + 2] + (flashCol.b - base[i + 2]) * k;
        }
        (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      }
      api.flash = f;
    },
  };
  return api;
}

// ---------------------------------------------------------------- clouds

export interface CloudOptions {
  variant: number;
  seed: number;
}

/**
 * Clouds drifting slowly round the sky.
 * Puffy: tall, round heaps (fair-weather clouds).
 * Flat-bottomed: long, low, layered clouds with a straight flat base.
 * Storm: dozens of big dark clouds that fill the sky, lower down.
 */
export function clouds(o: CloudOptions): EnvPiece {
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const list: { m: THREE.Mesh; r: number; a: number; speed: number }[] = [];
  const storm = o.variant === 2;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, emissive: storm ? 0x60666e : 0x8a96a8, emissiveIntensity: 0.5 });
  (material as any).__own = true;
  const n = storm ? 46 : 18;
  for (let i = 0; i < n; i++) {
    const c = new Parts();
    if (o.variant === 0) {
      // A heap: a wide base row, a smaller row on top, a round crown.
      const rows: [number, number][] = [[4, 2.4], [3, 2.6], [1, 3.0]];
      let y = 0;
      rows.forEach(([count, r], row) => {
        for (let k = 0; k < count; k++) {
          const rr = r * (0.85 + rng() * 0.3);
          const g = new THREE.IcosahedronGeometry(rr, 1);
          g.translate((k - (count - 1) / 2) * r * 1.3 + (rng() - 0.5), y + rr * 0.4, (rng() - 0.5) * 2);
          c.add(g, jitter(row === 0 ? 0xeef0f4 : 0xffffff, rng, 0.03));
        }
        y += r * 1.1;
      });
    } else if (o.variant === 1) {
      // Long flat layers.
      const blobs = 6 + Math.floor(rng() * 4);
      for (let k = 0; k < blobs; k++) {
        const r = 2.4 + rng() * 1.8;
        const g = new THREE.IcosahedronGeometry(r, 0);
        g.scale(1.8, 0.5, 1.1);
        g.translate((k - blobs / 2) * 3.6 + (rng() - 0.5), rng() * 0.8, (rng() - 0.5) * 3);
        c.add(g, jitter(0xf4f6f8, rng, 0.03));
      }
    } else {
      const blobs = 6 + Math.floor(rng() * 5);
      for (let k = 0; k < blobs; k++) {
        const r = 3 + rng() * 3;
        const g = new THREE.IcosahedronGeometry(r, 0);
        g.translate((k - blobs / 2) * 3.4 + (rng() - 0.5) * 2, rng() * 2.2, (rng() - 0.5) * 5);
        c.add(g, jitter(rng() < 0.5 ? 0x747a84 : 0x868c96, rng, 0.06));
      }
    }
    const m = c.build(material, false)!;
    // Flatten the bottoms: a hard, straight cut for flat-bottomed and storm clouds.
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      if (o.variant === 0 && y < 0) pos.setY(k, y * 0.45);
      if (o.variant !== 0 && y < 0) pos.setY(k, y * 0.08);
    }
    m.geometry.computeVertexNormals();
    const s = storm ? 1 + rng() * 0.8 : (o.variant === 0 ? 1.1 : 0.8) + rng() * 0.7;
    m.scale.set(s, s * (storm ? 0.7 : 1), s);
    const r = storm ? 10 + rng() * 140 : 95 + rng() * 85;
    // Spread evenly round the sky, so there are always some in view.
    const a = ((i + rng() * 0.6) / n) * Math.PI * 2;
    list.push({ m, r, a, speed: (0.004 + rng() * 0.006) * (storm ? 2.5 : 1) });
    m.position.y = storm ? 22 + rng() * 14 : o.variant === 1 ? 42 + rng() * 14 : 45 + rng() * 22;
    group.add(m);
  }
  let blow = 0;
  return {
    object: group,
    update(dt, _t, env) {
      blow = Math.max(0, blow - dt * 0.3);
      for (const c of list) {
        c.a += (dt * c.speed * (1 + env.wind * 2 + blow * 20) * 60) / Math.max(30, c.r);
        c.m.position.x = Math.cos(c.a) * c.r;
        c.m.position.z = Math.sin(c.a) * c.r;
        c.m.rotation.y = -c.a;
      }
      material.emissiveIntensity = 0.5 * (1 - env.night * 0.85);
    },
    poke: () => (blow = 1),
    dispose: () => disposeGroup(group),
  };
}

// ---------------------------------------------------------------- weather

/**
 * Rain, fog, snow, fireflies or a thunderstorm, filling a 40 m box. The
 * gallery keeps the box centred on what you're looking at.
 */
export function weather(o: CloudOptions): EnvPiece {
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const SIZE = 40, TOP = 16;
  if (o.variant === 1) {
    // Fog: low drifting banks of mist (and the scene's fog closes in).
    const m = mat(0xe8eef2, { opacity: 0.2 });
    const banks: { o: THREE.Mesh; s: number; x: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const g = new THREE.IcosahedronGeometry(2 + rng() * 2, 0);
      const b = new THREE.Mesh(g, m);
      b.scale.set(1.8, 0.2, 1.2);
      b.position.set((rng() - 0.5) * SIZE, 0.3 + rng() * 0.6, (rng() - 0.5) * SIZE);
      group.add(b);
      banks.push({ o: b, s: 0.2 + rng() * 0.3, x: b.position.x });
    }
    return {
      object: group,
      fog: { color: 0xc8d2d8, near: 14, far: 70 },
      update(_dt, t) {
        for (const b of banks) b.o.position.x = ((b.x + t * b.s + SIZE / 2) % SIZE) - SIZE / 2;
      },
      dispose: () => disposeGroup(group),
    };
  }
  if (o.variant === 3) {
    // Fireflies: little glowing dots that wander, brightest at night.
    const flies: { m: THREE.Mesh; p: THREE.Vector3; ph: number }[] = [];
    const fm = new THREE.MeshBasicMaterial({ color: 0xe8ff8a, transparent: true });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), fm);
      const p = new THREE.Vector3((rng() - 0.5) * 12, 0.3 + rng() * 1.8, (rng() - 0.5) * 12);
      flies.push({ m, p, ph: rng() * 6.28 });
      group.add(m);
    }
    return {
      object: group,
      update(_dt, t, env) {
        fm.opacity = 0.15 + env.night * 0.85;
        for (const f of flies) {
          f.m.position.set(f.p.x + Math.sin(t * 0.5 + f.ph) * 0.6, f.p.y + Math.sin(t * 0.9 + f.ph * 2) * 0.25, f.p.z + Math.cos(t * 0.4 + f.ph) * 0.6);
          f.m.scale.setScalar(0.6 + Math.max(0, Math.sin(t * 2 + f.ph * 3)) * 0.9);
        }
      },
      dispose: () => disposeGroup(group),
    };
  }
  // Rain (streaks), a thunderstorm (heavy rain) or snow (flakes).
  const snow = o.variant === 2;
  const thunder = o.variant === 4;
  const N = snow ? 2000 : thunder ? 4200 : 2800;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * (snow ? 3 : 6));
  const seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    seeds[i * 3] = (rng() - 0.5) * SIZE;
    seeds[i * 3 + 1] = rng() * TOP;
    seeds[i * 3 + 2] = (rng() - 0.5) * SIZE;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const obj = snow
    ? new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.95 }))
    : new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x8a9cb0, transparent: true, opacity: 0.85 }));
  obj.frustumCulled = false;
  group.add(obj);
  let heavy = 0;
  return {
    object: group,
    fog: snow ? { color: 0xdfe6ee, near: 12, far: 80 } : thunder ? { color: 0x6a727c, near: 10, far: 70 } : { color: 0x8a96a2, near: 14, far: 90 },
    update(dt, t, env) {
      heavy = Math.max(0, heavy - dt * 0.3);
      const fall = snow ? 1.1 : (thunder ? 19 : 14) * (1 + heavy);
      const slant = (snow ? 0.3 : thunder ? 2.4 : 1.2) * (0.5 + env.wind);
      for (let i = 0; i < N; i++) {
        const y = TOP - ((seeds[i * 3 + 1] + t * fall) % TOP);
        let x = seeds[i * 3] + (TOP - y) * slant * 0.1, z = seeds[i * 3 + 2];
        if (snow) {
          x += Math.sin(t + i) * 0.3;
          z += Math.cos(t * 0.7 + i) * 0.3;
          pos.set([x, y, z], i * 3);
        } else {
          pos.set([x, y, z, x - slant * 0.05, y + 0.45, z], i * 6);
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
    poke: () => (heavy = 1),
    dispose: () => disposeGroup(group),
  };
}
