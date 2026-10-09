import type { Cell, Grid } from './grid';
import type { Hero } from './hero';
import type { Physics } from './physics';

/** Плита нажата: тело в клетке прямо над ней или живая желейка стоит на ней (platePressed прототипа). */
export function platePressed(p: Cell, h: Hero, isBody: (c: number, r: number) => boolean, P: Physics): boolean {
  if (isBody(p.c, p.r - 1)) return true;
  if (!h.alive || !h.grounded) return false;
  return Math.abs(h.y + P.half - p.r) < P.plateEps && h.x + P.half > p.c + P.plateEdge && h.x - P.half < p.c + 1 - P.plateEdge;
}

/** Живая желейка задевает клетку какой-нибудь двери. */
export function heroInDoor(h: Hero, grid: Grid, P: Physics): boolean {
  if (!h.alive) return false;
  return grid.doors.some((d) => h.x + P.half > d.c && h.x - P.half < d.c + 1 && h.y + P.half > d.r && h.y - P.half < d.r + 1);
}

/**
 * Двери открыты, пока нажата хоть одна плита (в M0 все плиты открывают все двери).
 * Правка M0 (GDD «Застывание»): открытая дверь не закрывается, пока в ней живая желейка.
 */
export function doorsOpen(grid: Grid, h: Hero, isBody: (c: number, r: number) => boolean, wasOpen: boolean, P: Physics): boolean {
  const pressed = grid.plates.length > 0 && grid.plates.some((p) => platePressed(p, h, isBody, P));
  return pressed || (wasOpen && heroInDoor(h, grid, P));
}
