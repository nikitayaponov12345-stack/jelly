import type { Grid, Laser } from './grid';
import type { Hero, Solid } from './hero';
import type { Physics } from './physics';

export type DeathCause = 'spike' | 'saw' | 'laser' | 'fall' | 'burst';

/** Лазер горит: (время уровня + сдвиг) mod период < laser_on_s. */
export function laserOn(time: number, l: Laser, P: Physics): boolean {
  return (time + l.phase) % P.laserPeriod < P.laserOn;
}

/** Пунктир перед включением: до конца цикла меньше laser_warn_s. */
export function laserWarn(time: number, l: Laser, P: Physics): boolean {
  return (time + l.phase) % P.laserPeriod > P.laserPeriod - P.laserWarn;
}

/** Ряд, где обрывается луч: первая твёрдая клетка под излучателем (тела тоже), или rows. */
export function beamEnd(l: Laser, solid: Solid, rows: number): number {
  let r = l.r + 1;
  while (r < rows && !solid(l.c, r)) r++;
  return r;
}

/** Желейка, урезанная на inset, пересекает прямоугольник [x0, x1) × [y0, y1). */
export function overlapRect(h: Hero, x0: number, y0: number, x1: number, y1: number, inset: number, half: number): boolean {
  return h.x + half - inset > x0 && h.x - half + inset < x1 && h.y + half - inset > y0 && h.y - half + inset < y1;
}

export type Hit = { kind: 'death'; cause: Exclude<DeathCause, 'burst'>; laser: Laser | null } | { kind: 'flag' };

/**
 * Угрозы и флаг — дословно checkHazards прототипа, в том же порядке: падение, шипы, пилы, лазеры, флаг.
 * beamEnds[i] — ряд обрыва луча лазера grid.lasers[i] в этом шаге.
 */
export function checkHazards(
  h: Hero,
  grid: Grid,
  isBody: (c: number, r: number) => boolean,
  time: number,
  beamEnds: readonly number[],
  P: Physics,
): Hit | null {
  const hh = P.half;
  if (h.y - hh > grid.rows + P.fallOutMargin) return { kind: 'death', cause: 'fall', laser: null };
  const c0 = Math.floor(h.x - hh);
  const c1 = Math.floor(h.x + hh);
  const r0 = Math.floor(h.y - hh);
  const r1 = Math.floor(h.y + hh);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (grid.tile(c, r) === '^' && !isBody(c, r) && overlapRect(h, c + P.spikeX0, r + P.spikeY0, c + P.spikeX1, r + 1, P.spikeInset, hh)) {
        return { kind: 'death', cause: 'spike', laser: null };
      }
    }
  }
  for (const s of grid.saws) {
    const dx = h.x - (s.c + 0.5);
    const dy = h.y - (s.r + 0.5);
    if (dx * dx + dy * dy < P.sawRadius * P.sawRadius) return { kind: 'death', cause: 'saw', laser: null };
  }
  for (let i = 0; i < grid.lasers.length; i++) {
    const l = grid.lasers[i]!;
    const end = beamEnds[i] ?? grid.rows;
    if (
      laserOn(time, l, P) &&
      h.x + hh - P.laserInset > l.c + P.laserX0 &&
      h.x - hh + P.laserInset < l.c + P.laserX1 &&
      h.y >= l.r + P.laserMinDy &&
      h.y < end
    ) {
      return { kind: 'death', cause: 'laser', laser: l };
    }
  }
  if (overlapRect(h, grid.flag.c + P.flagX0, grid.flag.r, grid.flag.c + 1, grid.flag.r + 1, 0, hh)) return { kind: 'flag' };
  return null;
}
