import type { Run, RunEvent } from '../core/run';

/** Что рисовать на месте желейки: центр по x, уровень ступней, сквош и взгляд — в клетках. */
export interface HeroLook {
  x: number;
  footY: number;
  sx: number;
  sy: number;
  lookY: number;
}

/**
 * Анимация формы желейки — только отрисовка, правил не меняет (формулы анимации из updateHero и drawWorld прототипа).
 * Обновляется раз в кадр по состоянию попытки и её событиям.
 */
export class HeroAnim {
  private sx = 1;
  private sy = 1;
  private lookY = 0;
  private runT = 0;
  private finishT = 0;
  private frame = 0;

  onEvent(e: RunEvent): void {
    if (e.type === 'jump') {
      this.sx = 0.8;
      this.sy = 1.25;
    } else if (e.type === 'land') {
      this.sx = 1.35;
      this.sy = 0.65;
    } else if (e.type === 'respawn' || e.type === 'restart') {
      this.sx = 1;
      this.sy = 1;
      this.lookY = 0;
      this.runT = 0;
    } else if (e.type === 'finish') this.finishT = 0;
  }

  /** dt — время кадра, с; stuckFrom — с какого stuckT желейка дрожит. Возвращает null, пока новая желейка не родилась. */
  update(run: Run, dt: number, vmax: number, stuckFrom: number): HeroLook | null {
    this.frame++;
    const h = run.hero;
    const footY = h.y + run.P.half;
    if (run.state === 'done') {
      this.finishT += dt;
      const bounce = Math.abs(Math.sin(this.finishT * 8)) * 0.35;
      return { x: h.x, footY: footY - bounce, sx: 1 - bounce * 0.3, sy: 1 + bounce * 0.4, lookY: -0.6 };
    }
    if (!h.alive) return null;
    const k = Math.min(1, dt * 14);
    this.runT += dt;
    let tsx: number;
    let tsy: number;
    if (run.state === 'ready') {
      tsx = 1;
      tsy = 1 - Math.sin(this.runT * 3) * 0.03; // дышит на старте
    } else if (h.grounded) {
      tsx = h.pushing ? 0.86 + Math.sin(this.runT * 40) * 0.03 : 1 + Math.sin(this.runT * 18) * 0.04;
      tsy = h.pushing ? 1.16 : 1 - Math.sin(this.runT * 18) * 0.04;
    } else {
      tsx = h.vy < -4 ? 0.86 : h.vy > 6 ? 0.9 : 1;
      tsy = h.vy < -4 ? 1.18 : h.vy > 6 ? 1.12 : 1;
    }
    this.sx += (tsx - this.sx) * k;
    this.sy += (tsy - this.sy) * k;
    this.lookY += ((h.grounded ? 0 : h.vy / vmax) * 0.25 - this.lookY) * Math.min(1, dt * 10);
    // Перед лопанием от стресса — дрожит.
    if (run.state === 'play' && h.stuckT > stuckFrom) {
      return { x: h.x + Math.sin(this.frame * 2.1) * 0.04, footY, sx: this.sx * 1.1, sy: this.sy * 0.95, lookY: this.lookY };
    }
    return { x: h.x, footY, sx: this.sx, sy: this.sy, lookY: this.lookY };
  }
}
