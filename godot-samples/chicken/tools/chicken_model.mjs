// Emberfall chicken sample: builds the model + animations with three.js.
// Used by build_chicken.mjs to export chicken.glb for Godot.
// Units: metres, Y-up, chicken faces -Z (Emberfall Godot style guide).

export function buildChicken(THREE) {
  const mat = (color, roughness = 0.85, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const M = {
    feather: mat('#d98a3a', 0.9),   // warm honey-russet body
    cream: mat('#f6e3bf', 0.9),     // soft chest / face
    wingTip: mat('#a9552a', 0.9),   // darker russet wing edge
    tail: mat('#3a8a80', 0.6),      // teal tail sheen
    tailTip: mat('#2b6670', 0.6),
    comb: mat('#e0413a', 0.6),
    beak: mat('#f2b233', 0.5),
    leg: mat('#f0a23a', 0.55),
    eye: mat('#1b1512', 0.15),
    shine: mat('#ffffff', 0.2, { emissive: '#ffffff', emissiveIntensity: 0.4 }),
  };

  // Mesh helper: geometry gets scale/rotation baked in so nodes stay unit-scale.
  function part(name, geo, material, { s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0] } = {}) {
    geo.scale(...s);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...r)));
    const m = new THREE.Mesh(geo, material);
    m.name = name;
    m.position.set(...p);
    return m;
  }
  const sphere = (seg = 20) => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  const pivot = (name, p = [0, 0, 0]) => {
    const g = new THREE.Object3D();
    g.name = name;
    g.position.set(...p);
    return g;
  };

  const root = pivot('Chicken');

  // ---- Body (egg shape via lathe, long axis along Z) ----
  const hips = pivot('Hips', [0, 0.27, 0]);
  root.add(hips);
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = t * Math.PI;
    // egg profile: fuller at the back (tail end), narrower at the chest
    const rad = Math.sin(a) * (0.155 + 0.03 * t);
    pts.push(new THREE.Vector2(Math.max(rad, 0.0005), -Math.cos(a) * 0.2));
  }
  const bodyGeo = new THREE.LatheGeometry(pts, 30);
  hips.add(part('Body', bodyGeo, M.feather, { s: [1, 0.95, 1], r: [Math.PI / 2 - 0.35, 0, 0], p: [0, 0.02, 0.02] }));
  hips.add(part('Chest', sphere(), M.cream, { s: [0.1, 0.11, 0.07], p: [0, 0.02, -0.125] }));
  hips.add(part('Belly', sphere(), M.cream, { s: [0.12, 0.08, 0.13], p: [0, -0.08, -0.02] }));

  // ---- Tail fan ----
  const tail = pivot('Tail', [0, 0.1, 0.17]);
  hips.add(tail);
  [-0.5, -0.17, 0.17, 0.5].forEach((ang, i) => {
    const f = pivot('TailFeather' + i);
    f.rotation.set(-0.55, 0, ang);
    tail.add(f);
    f.add(part('TailFeatherMesh' + i, sphere(16), i % 3 === 0 ? M.tailTip : M.tail,
      { s: [0.035, 0.13, 0.018], p: [0, 0.1, 0] }));
  });

  // ---- Wings ----
  for (const side of [-1, 1]) {
    const nm = side < 0 ? 'L' : 'R';
    const w = pivot('Wing' + nm, [side * 0.135, 0.05, -0.03]);
    hips.add(w);
    w.add(part('WingMesh' + nm, sphere(), M.feather, { s: [0.036, 0.085, 0.14], r: [0.3, 0, side * 0.08], p: [side * 0.012, -0.015, 0.07] }));
    w.add(part('WingTip' + nm, sphere(16), M.wingTip, { s: [0.026, 0.055, 0.075], r: [0.4, 0, side * 0.08], p: [side * 0.018, -0.03, 0.16] }));
  }

  // ---- Neck + head ----
  const neck = pivot('Neck', [0, 0.1, -0.12]);
  hips.add(neck);
  neck.add(part('NeckMesh', sphere(), M.feather, { s: [0.085, 0.11, 0.085], r: [-0.3, 0, 0], p: [0, 0.06, -0.01] }));
  const head = pivot('Head', [0, 0.15, -0.03]);
  neck.add(head);
  head.add(part('HeadMesh', sphere(), M.feather, { s: [0.095, 0.09, 0.1], p: [0, 0.02, 0] }));
  head.add(part('Face', sphere(), M.cream, { s: [0.075, 0.06, 0.07], p: [0, 0.0, -0.04] }));
  head.add(part('Beak', new THREE.ConeGeometry(1, 1, 24), M.beak, { s: [0.028, 0.07, 0.022], r: [-Math.PI / 2, 0, 0], p: [0, 0.0, -0.12] }));
  head.add(part('Wattle', sphere(16), M.comb, { s: [0.018, 0.03, 0.018], p: [0, -0.045, -0.085] }));
  [[0, 0.11, -0.02, 0.03], [0, 0.115, 0.02, 0.032], [0, 0.1, 0.055, 0.026]].forEach(([x, y, z, r], i) =>
    head.add(part('Comb' + i, sphere(16), M.comb, { s: [0.016, r, r * 0.9], p: [x, y, z] })));
  for (const side of [-1, 1]) {
    const nm = side < 0 ? 'L' : 'R';
    const eye = pivot('Eye' + nm, [side * 0.07, 0.03, -0.045]);
    head.add(eye);
    eye.add(part('EyeBall' + nm, sphere(14), M.eye, { s: [0.024, 0.028, 0.024] }));
    eye.add(part('EyeShine' + nm, sphere(12), M.shine, { s: [0.008, 0.008, 0.008], p: [side * 0.016, 0.01, -0.01] }));
  }

  // ---- Legs ----
  for (const side of [-1, 1]) {
    const nm = side < 0 ? 'L' : 'R';
    const leg = pivot('Leg' + nm, [side * 0.06, 0.18, 0.0]);
    root.add(leg);
    leg.add(part('Thigh' + nm, sphere(), M.feather, { s: [0.05, 0.06, 0.06], p: [0, 0.0, 0] }));
    leg.add(part('Shin' + nm, new THREE.CylinderGeometry(0.012, 0.014, 0.15, 10), M.leg, { p: [0, -0.1, 0] }));
    const foot = pivot('Foot' + nm, [0, -0.17, 0]);
    leg.add(foot);
    [-0.45, 0, 0.45].forEach((a, i) => {
      const toe = part('Toe' + nm + i, new THREE.CapsuleGeometry(0.009, 0.06, 4, 10), M.leg, { r: [Math.PI / 2, 0, 0] });
      const tp = pivot('ToePivot' + nm + i);
      tp.rotation.y = a;
      toe.position.set(0, -0.003, -0.035);
      tp.add(toe);
      foot.add(tp);
    });
    foot.add(part('BackToe' + nm, new THREE.CapsuleGeometry(0.008, 0.03, 4, 10), M.leg, { r: [Math.PI / 2, 0, 0], p: [0, -0.003, 0.025] }));
  }

  // ---- Animations (sampled poses -> keyframe tracks) ----
  const animated = ['Hips', 'Neck', 'Head', 'Tail', 'WingL', 'WingR', 'LegL', 'LegR', 'FootL', 'FootR', 'EyeL', 'EyeR'];
  const byName = Object.fromEntries(animated.map(n => [n, root.getObjectByName(n)]));
  const rest = Object.fromEntries(animated.map(n => [n, byName[n].position.clone()]));
  const TAU = Math.PI * 2;
  const blink = (t, at) => (Math.abs(t - at) < 0.06 ? 0.1 : 1);

  function makeClip(name, duration, poseFn, fps = 30) {
    const n = Math.round(duration * fps);
    const times = [];
    const q = {}, pos = {}, scl = {};
    animated.forEach(k => { q[k] = []; pos[k] = []; scl[k] = []; });
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * duration;
      times.push(t);
      const pose = poseFn(t, t / duration);
      for (const k of animated) {
        const p = pose[k] || {};
        const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx || 0, p.ry || 0, p.rz || 0));
        q[k].push(quat.x, quat.y, quat.z, quat.w);
        const r = rest[k];
        pos[k].push(r.x + (p.px || 0), r.y + (p.py || 0), r.z + (p.pz || 0));
        scl[k].push(1, p.sy ?? 1, 1);
      }
    }
    const tracks = [];
    for (const k of animated) {
      tracks.push(new THREE.QuaternionKeyframeTrack(k + '.quaternion', times, q[k]));
      tracks.push(new THREE.VectorKeyframeTrack(k + '.position', times, pos[k]));
      if (k.startsWith('Eye')) tracks.push(new THREE.VectorKeyframeTrack(k + '.scale', times, scl[k]));
    }
    return new THREE.AnimationClip(name, duration, tracks);
  }

  // Idle: breathing, curious head turns, tail flick, blinks.
  const idle = makeClip('Idle', 4, (t, u) => {
    const breathe = Math.sin(u * TAU * 2);
    const look = Math.sin(u * TAU) * 0.6 + Math.sin(u * TAU * 3) * 0.15;
    const eyeS = blink(t, 1.1) * blink(t, 3.2);
    return {
      Hips: { py: breathe * 0.004, rx: breathe * 0.01 },
      Neck: { rx: Math.sin(u * TAU * 2 + 1) * 0.04 },
      Head: { ry: look, rz: Math.sin(u * TAU * 2) * 0.12 },
      Tail: { ry: Math.max(0, Math.sin(u * TAU * 4 - 1)) ** 6 * 0.4 * Math.sin(t * 40) },
      WingL: { rz: -breathe * 0.02 }, WingR: { rz: breathe * 0.02 },
      EyeL: { sy: eyeS }, EyeR: { sy: eyeS },
    };
  });

  // Peck: lean forward, two quick pecks at the ground, back up.
  const peck = makeClip('Peck', 1.6, (t, u) => {
    const lean = Math.sin(Math.min(1, u * 1.25) * Math.PI); // 0 -> 1 -> 0 over the first 80%
    const jab = Math.max(0, Math.sin(u * TAU * 2.5)) ** 3 * lean;
    return {
      Hips: { rx: -0.25 * lean, py: -0.01 * lean },
      Neck: { rx: -0.7 * lean - 0.3 * jab, pz: -0.03 * lean },
      Head: { rx: -0.05 * lean - 0.15 * jab },
      Tail: { rx: 0.3 * lean },
      WingL: { rz: -0.05 * lean }, WingR: { rz: 0.05 * lean },
      LegL: { rx: 0.15 * lean }, LegR: { rx: 0.15 * lean },
    };
  });

  // Walk: stepping legs, body bob/waddle, head bob, wing flutter.
  const walk = makeClip('Walk', 0.8, (t, u) => {
    const a = u * TAU;
    const sL = Math.sin(a), sR = Math.sin(a + Math.PI);
    const lift = s => Math.max(0, Math.cos(Math.asin(Math.max(-1, Math.min(1, s)))) * (s > 0 ? 1 : 0));
    return {
      Hips: { py: Math.abs(Math.sin(a)) * 0.012, rz: Math.sin(a) * 0.07, ry: Math.sin(a) * 0.05 },
      Neck: { pz: -Math.sin(a * 2) * 0.018, rx: Math.sin(a * 2) * 0.06 },
      Head: { rx: -Math.sin(a * 2) * 0.06, rz: -Math.sin(a) * 0.05 },
      Tail: { ry: -Math.sin(a) * 0.15 },
      WingL: { rz: -0.06 - Math.max(0, Math.sin(a * 2)) * 0.12 },
      WingR: { rz: 0.06 + Math.max(0, Math.sin(a * 2)) * 0.12 },
      LegL: { rx: sL * 0.55, py: Math.max(0, Math.cos(a)) * 0.02 },
      LegR: { rx: sR * 0.55, py: Math.max(0, -Math.cos(a)) * 0.02 },
      FootL: { rx: -sL * 0.45 - Math.max(0, Math.cos(a)) * 0.4 },
      FootR: { rx: -sR * 0.45 - Math.max(0, -Math.cos(a)) * 0.4 },
    };
  });

  return { root, clips: [idle, peck, walk] };
}
