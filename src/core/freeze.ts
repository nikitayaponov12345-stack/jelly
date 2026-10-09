import type { Cell, Grid, Laser } from './grid';
import type { Hero, Solid } from './hero';
import type { DeathCause } from './hazards';
import type { Physics } from './physics';

/** Порядок поиска свободной клетки вокруг опорной (dc, dr): она сама, выше, левее, правее, ниже, … — как в прототипе. */
export const FREEZE_ORDER: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [0, -2], [-1, 1], [1, 1],
];

/** Опорная точка тела по причине гибели (killHero прототипа). */
export function freezeAnchor(cause: DeathCause, h: Hero, laser: Laser | null, P: Physics): { x: number; y: number } {
  if (cause === 'fall') return { x: h.x, y: P.rows - 0.5 };
  if (cause === 'laser' && laser) return { x: laser.c + 0.5, y: Math.max(laser.r + P.laserFreezeDy, h.y) };
  return { x: h.x, y: h.y };
}

/**
 * Клетка, где застывает тело (placeFrozen прототипа), или null — тела не будет.
 * Свободна клетка поля, которая не твёрдая, не шипы и не флаг (прототип), а также не старт, не дверь,
 * не излучатель и не пила (правки M0, GDD «Застывание»). Нет свободной, а в опорной шипы — тело накрывает шипы.
 */
export function placeBody(x: number, y: number, grid: Grid, solid: Solid): Cell | null {
  const c = Math.max(0, Math.min(grid.cols - 1, Math.floor(x)));
  const r = Math.max(0, Math.min(grid.rows - 1, Math.floor(y)));
  const free = (cc: number, rr: number): boolean =>
    cc >= 0 &&
    cc < grid.cols &&
    rr >= 0 &&
    rr < grid.rows &&
    !solid(cc, rr) &&
    grid.tile(cc, rr) !== '^' &&
    !grid.isFlag(cc, rr) &&
    !grid.isStart(cc, rr) &&
    !grid.isDoor(cc, rr) &&
    !grid.isEmitter(cc, rr) &&
    !grid.isSaw(cc, rr);
  for (const [dc, dr] of FREEZE_ORDER) if (free(c + dc, r + dr)) return { c: c + dc, r: r + dr };
  if (grid.tile(c, r) === '^' && !solid(c, r)) return { c, r };
  return null;
}
