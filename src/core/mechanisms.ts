import type { Cell, Grid } from './grid';
import type { Hero } from './hero';
import type { Physics } from './physics';

/** Плита нажата: тело в клетке прямо над ней или живая желейка стоит на ней (platePressed прототипа). */
export function platePressed(p: Cell, h: Hero, isBody: (c: number, r: number) => boolean, P: Physics): boolean {
  if (isBody(p.c, p.r - 1)) return true;
  if (!h.alive || !h.grounded) return false;
  return Math.abs(h.y + P.half - p.r) < P.plateEps && h.x + P.half > p.c + P.plateEdge && h.x - P.half < p.c + 1 - P.plateEdge;
}

/** Пар плит и дверей на уровне, не больше (GDD «Элементы уровня»). */
export const PAIRS = 3;

/** Живая желейка задевает клетку какой-нибудь двери пары pair. */
export function heroInDoor(h: Hero, grid: Grid, pair: number, P: Physics): boolean {
  if (!h.alive) return false;
  return grid.doors.some((d) => d.pair === pair && h.x + P.half > d.c && h.x - P.half < d.c + 1 && h.y + P.half > d.r && h.y - P.half < d.r + 1);
}

/**
 * Двери пары открыты, пока нажата хоть одна плита этой пары: цвет связывает плиту со своей дверью (GDD «Элементы
 * уровня», M1-01; в M0 пара была одна — P и D). Правка M0 (GDD «Застывание»): открытая дверь не закрывается, пока
 * в ней живая желейка. wasOpen и ответ — по парам 0…PAIRS−1; ничего не поменялось — ответ тот же массив wasOpen.
 */
export function doorsOpen(grid: Grid, h: Hero, isBody: (c: number, r: number) => boolean, wasOpen: readonly boolean[], P: Physics): readonly boolean[] {
  let pressed = 0; // нажатые пары — битами: один проход по плитам на шаг
  for (const p of grid.plates) if ((pressed & (1 << p.pair)) === 0 && platePressed(p, h, isBody, P)) pressed |= 1 << p.pair;
  let open: boolean[] | null = null;
  for (let k = 0; k < PAIRS; k++) {
    const was = wasOpen[k] === true;
    const now = (pressed & (1 << k)) !== 0 || (was && heroInDoor(h, grid, k, P));
    if (now === was) continue;
    open ??= Array.from({ length: PAIRS }, (_, i) => wasOpen[i] === true);
    open[k] = now;
  }
  return open ?? wasOpen;
}
