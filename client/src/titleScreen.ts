// The Emberfall title screen: the first thing players see when the game opens.
// Embers drift up from a glowing horizon and the odd star falls across the sky.
// Tapping it (or pressing a key) fades it away to the login box, and that same
// tap lets the browser start the title music (titleMusic.ts).

let shown = false; // only once each time the page opens, not again after signing out

export function showTitleScreen(onClose: () => void) {
  if (shown) return;
  shown = true;

  const screen = document.createElement("div");
  screen.id = "title-screen";
  screen.innerHTML = '<canvas></canvas><div class="game-title"><div class="gt-name">Emberfall</div></div><div class="tts-hint">Tap to start</div>';
  document.body.appendChild(screen);
  const canvas = screen.querySelector("canvas")!;
  const stopSky = drawSky(canvas);

  const close = (e: Event) => {
    e.preventDefault();
    window.removeEventListener("keydown", close, true);
    screen.removeEventListener("pointerdown", close);
    screen.classList.add("leaving");
    setTimeout(() => { stopSky(); screen.remove(); onClose(); }, 700);
  };
  screen.addEventListener("pointerdown", close);
  window.addEventListener("keydown", close, true);
}

interface Ember { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; hue: number }
interface Star { x: number; y: number; vx: number; vy: number; life: number }

/** Animate the embers and falling stars. Returns a function that stops it. */
export function drawSky(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, running = true;
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener("resize", resize);

  const twinkles = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.6, p: Math.random() * 6.28, r: Math.random() * 1.1 + 0.3 }));
  const embers: Ember[] = [];
  const stars: Star[] = [];
  const newEmber = (anywhere: boolean): Ember => {
    const max = 4 + Math.random() * 5;
    return { x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10, vx: (Math.random() - 0.5) * 12, vy: -(18 + Math.random() * 40),
      r: 0.8 + Math.random() * 2.2, life: anywhere ? Math.random() * max : 0, max, hue: 15 + Math.random() * 30 };
  };
  const count = calm ? 25 : Math.round(Math.min(110, 40 + w / 12));
  for (let i = 0; i < count; i++) embers.push(newEmber(true));

  let last = performance.now(), nextStar = 1.2;
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);

    // Faint stars in the night sky.
    for (const t of twinkles) {
      const a = 0.25 + 0.35 * Math.sin(now / 900 + t.p);
      ctx.fillStyle = `rgba(255, 240, 220, ${a})`;
      ctx.fillRect(t.x * w, t.y * h, t.r, t.r);
    }

    // Falling stars: a burning streak across the sky every few seconds.
    if (!calm && (nextStar -= dt) <= 0) {
      nextStar = 2.5 + Math.random() * 4;
      const fromLeft = Math.random() < 0.5;
      const speed = 500 + Math.random() * 300;
      stars.push({ x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5, y: Math.random() * h * 0.25,
        vx: (fromLeft ? 1 : -1) * speed * 0.8, vy: speed * 0.5, life: 0 });
    }
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const fade = Math.max(0, 1 - s.life / 1.1);
      const tail = 0.18;
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * tail, s.y - s.vy * tail);
      g.addColorStop(0, `rgba(255, 245, 210, ${fade})`);
      g.addColorStop(0.3, `rgba(255, 160, 60, ${fade * 0.7})`);
      g.addColorStop(1, "rgba(255, 80, 20, 0)");
      ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * tail, s.y - s.vy * tail); ctx.stroke();
      if (fade <= 0) stars.splice(i, 1);
    }

    // Embers rising from the glow below, flickering as they cool.
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      e.life += dt;
      e.x += (e.vx + Math.sin(now / 700 + i) * 10) * dt;
      e.y += e.vy * dt;
      const k = e.life / e.max;
      if (k >= 1 || e.y < -10) { embers[i] = newEmber(false); continue; }
      const a = Math.sin(Math.PI * k) * (0.6 + 0.4 * Math.sin(now / 90 + i * 3));
      const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
      glow.addColorStop(0, `hsla(${e.hue + 15}, 100%, 75%, ${a})`);
      glow.addColorStop(0.35, `hsla(${e.hue}, 100%, 55%, ${a * 0.5})`);
      glow.addColorStop(1, `hsla(${e.hue}, 100%, 40%, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 4, 0, 6.29); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => { running = false; removeEventListener("resize", resize); };
}
