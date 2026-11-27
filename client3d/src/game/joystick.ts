// The touch-screen walking pad: a round pad in the bottom left corner (above the messages).
// Put your thumb on it and push the way you want to walk; how far you push sets nothing but the
// direction (running is the 🏃 button). It only shows on touch screens.

export interface Stick {
  /** Forward (+1, the way the camera faces) to back (-1). */
  fwd: number;
  /** Right (+1) to left (-1). */
  right: number;
}

export function isTouchScreen(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);
}

/** Makes the pad and returns its live direction (all zero when nobody's touching it). */
export function createJoystick(onChange: () => void): Stick {
  const stick: Stick = { fwd: 0, right: 0 };
  if (!isTouchScreen()) return stick;
  const pad = document.createElement("div");
  pad.id = "joystick";
  pad.setAttribute("aria-label", "Walking pad: push the way you want to walk");
  const knob = document.createElement("div");
  knob.className = "knob";
  pad.append(knob);
  document.body.append(pad);

  // Sit just above the messages box, whatever its height.
  const msgs = document.getElementById("messages");
  const place = () => {
    const h = msgs && msgs.getClientRects().length ? msgs.getBoundingClientRect().height : 0;
    pad.style.bottom = `calc(${Math.round(h + 18)}px + env(safe-area-inset-bottom))`;
  };
  place();
  if (msgs && "ResizeObserver" in window) new ResizeObserver(place).observe(msgs);
  window.addEventListener("resize", place);

  let id: number | null = null;
  const R = 44; // how far the knob can travel from the middle
  const move = (e: PointerEvent) => {
    const r = pad.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(x, y);
    if (d > R) { x = (x / d) * R; y = (y / d) * R; }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    // A small dead zone in the middle so a resting thumb doesn't creep.
    const live = d > 10;
    stick.right = live ? x / R : 0;
    stick.fwd = live ? -y / R : 0;
    onChange();
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = null;
    pad.classList.remove("on");
    knob.style.transform = "";
    stick.fwd = stick.right = 0;
    onChange();
  };
  pad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    id = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    pad.classList.add("on");
    move(e);
  });
  pad.addEventListener("pointermove", (e) => { if (e.pointerId === id) { e.preventDefault(); move(e); } });
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);
  pad.addEventListener("lostpointercapture", end);
  return stick;
}
