// Keeping the game smooth on slower computers and phones.
//
// Screens with sharp ("retina") displays have up to 4 times as many pixels to
// draw. If frames start taking too long, draw a few less pixels (the picture
// gets a little softer) until the game runs smoothly again, and go back up
// when there's time to spare. Nothing changes on computers that keep up.
import type * as THREE from "three";

const SLOW_MS = 1000 / 40; // slower than 40 frames a second: draw less
const FAST_MS = 1000 / 55; // faster than 55 frames a second: draw more again
const STEP = 0.25;
const MIN_RATIO = 1; // never blurrier than an ordinary screen

export class AutoQuality {
  private max = Math.min(2, window.devicePixelRatio || 1);
  private ratio = this.max;
  private sum = 0;
  private frames = 0;
  private wait = 3; // seconds before the next change (lets the game settle after loading)
  private fastStreak = 0;
  /** A sharpness that was too slow isn't tried again for a minute. */
  private slowAt = Infinity;
  private retryAt = 0;

  constructor(private renderer: THREE.WebGLRenderer) {
    renderer.setPixelRatio(this.ratio);
  }

  /** Call once a frame with the frame's time in seconds. */
  update(dt: number) {
    if (document.hidden) return; // a hidden tab isn't a slow computer
    this.sum += dt;
    this.frames++;
    if (this.sum < 2) return;
    const ms = (this.sum / this.frames) * 1000;
    this.sum = 0;
    this.frames = 0;
    if ((this.wait -= 2) > 0) return;
    if (ms > SLOW_MS && this.ratio > MIN_RATIO) {
      this.slowAt = this.ratio;
      this.retryAt = performance.now() + 60_000;
      this.set(this.ratio - STEP);
      this.fastStreak = 0;
    } else if (ms < FAST_MS && this.ratio < this.max && (this.ratio + STEP < this.slowAt || performance.now() > this.retryAt)) {
      // Go back up slowly (after 6 smooth seconds), so it doesn't flicker between the two.
      if (++this.fastStreak >= 3) { this.set(this.ratio + STEP); this.fastStreak = 0; }
    } else this.fastStreak = 0;
  }

  private set(r: number) {
    this.ratio = Math.max(MIN_RATIO, Math.min(this.max, r));
    this.renderer.setPixelRatio(this.ratio);
    this.wait = 2;
  }
}
