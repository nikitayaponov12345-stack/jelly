import { Rng } from '../core/rng';
import { CONFETTI, PAL } from './palette';
import type { Pen } from './pen';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
  r: number;
  color: number;
  alpha: number;
  g: number;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  t: number;
  color: number;
  w: number;
  h: number;
}

/** Частицы и тряска экрана (puff, splash, confettiBurst прототипа) — в клетках. Случайность — Rng с сидом. */
export class Fx {
  private parts: Particle[] = [];
  private confetti: Confetti[] = [];
  private readonly rnd = new Rng(20251008);
  /** Остаток тряски, с. */
  shake = 0;

  clear(): void {
    this.parts = [];
    this.confetti = [];
    this.shake = 0;
  }

  /** Облачко у ступней при прыжке (n = 5) или пыль при приземлении (n = 8). */
  puff(x: number, y: number, n: number, color: number, alpha: number, spread: number, up: number): void {
    const r = (): number => this.rnd.next();
    for (let i = 0; i < n; i++) {
      this.parts.push({ x, y, vx: (r() - 0.5) * spread, vy: -r() * up, life: 0.35 + r() * 0.3, t: 0, r: 0.06 + r() * 0.08, color, alpha, g: 6 });
    }
  }

  /** Брызги при гибели и короткая тряска. */
  splash(x: number, y: number): void {
    const r = (): number => this.rnd.next();
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2;
      const sp = 2 + r() * 6;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, life: 0.5 + r() * 0.5, t: 0, r: 0.08 + r() * 0.12,
        color: r() < 0.7 ? PAL.hero : PAL.heroLight, alpha: 1, g: 22,
      });
    }
    this.shake = 0.25;
  }

  confettiBurst(x: number, y: number): void {
    const r = (): number => this.rnd.next();
    for (let i = 0; i < 70; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
      const sp = 5 + r() * 9;
      this.confetti.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: r() * 6, vr: (r() - 0.5) * 12, life: 1.6 + r(), t: 0,
        color: CONFETTI[i % CONFETTI.length]!, w: 0.12 + r() * 0.1, h: 0.08 + r() * 0.08,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const p of this.confetti) {
      p.t += dt;
      p.vy += 14 * dt;
      p.vx *= 0.98;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.confetti = this.confetti.filter((p) => p.t < p.life);
    if (this.shake > 0) this.shake -= dt;
  }

  draw(g: Pen): void {
    g.clear();
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      g.circle(p.x, p.y, p.r * (0.6 + a * 0.4)).fill({ color: p.color, alpha: a * p.alpha });
    }
    for (const p of this.confetti) {
      const c = Math.cos(p.rot);
      const s = Math.sin(p.rot);
      const hw = p.w / 2;
      const hh = p.h / 2;
      g.poly([
        p.x - hw * c + hh * s, p.y - hw * s - hh * c,
        p.x + hw * c + hh * s, p.y + hw * s - hh * c,
        p.x + hw * c - hh * s, p.y + hw * s + hh * c,
        p.x - hw * c - hh * s, p.y - hw * s + hh * c,
      ]).fill({ color: p.color, alpha: Math.min(1, (p.life - p.t) * 1.5) });
    }
  }

  get count(): number {
    return this.parts.length + this.confetti.length;
  }
}
