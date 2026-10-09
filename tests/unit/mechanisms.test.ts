import { describe, expect, it } from 'vitest';
import { Grid } from '../../src/core/grid';
import { newHero, type Hero } from '../../src/core/hero';
import { allLevels } from '../../src/core/levels';
import { doorsOpen, platePressed } from '../../src/core/mechanisms';
import { Run } from '../../src/core/run';
import { DATA } from '../../src/data';
import { EMPTY, GROUND, P, level } from './maps';

const grid = (id: string): Grid => new Grid(allLevels(DATA).find((l) => l.id === id)!, P.laserAltPhase);
const noBody = (): boolean => false;
const CLOSED = [false, false, false];

describe('плиты и двери', () => {
  const g = grid('p-02');
  const plate = g.plates[0]!;
  const onPlate: Hero = { ...newHero(g.start, P), x: 12.5, y: 11 - P.half - 0.001, grounded: true };

  it('плита: желейка на ней или тело над ней', () => {
    expect(plate).toEqual({ c: 12, r: 11, pair: 0 });
    expect(platePressed(plate, onPlate, noBody, P)).toBe(true);
    expect(platePressed(plate, { ...onPlate, x: 13.5 }, noBody, P)).toBe(false);
    expect(platePressed(plate, { ...onPlate, grounded: false }, noBody, P)).toBe(false);
    const body = (c: number, r: number): boolean => c === 12 && r === 10;
    expect(platePressed(plate, { ...onPlate, alive: false }, body, P)).toBe(true);
  });

  it('открытая дверь не закрывается, пока в ней живая желейка', () => {
    const h = { ...newHero(g.start, P), y: 9.6 };
    expect(doorsOpen(g, { ...h, x: 13.5 }, noBody, [true, false, false], P)).toEqual([true, false, false]);
    expect(doorsOpen(g, { ...h, x: 13.5 }, noBody, CLOSED, P)).toEqual(CLOSED);
    expect(doorsOpen(g, { ...h, x: 11.5 }, noBody, [true, false, false], P)).toEqual(CLOSED);
  });

  it('без плит двери закрыты', () => {
    const g1 = grid('p-01');
    expect(doorsOpen(g1, newHero(g1.start, P), noBody, CLOSED, P)).toEqual(CLOSED);
  });
});

describe('парные плиты и двери (M1-01)', () => {
  // Плиты в полу (ряд 10): R (пара 2) — столбец 3, Q (пара 1) — 6, P (пара 0) — 10. Двери в рядах 7…9:
  // E (пара 1) — столбец 14, D (пара 0) — 17, G (пара 2) — 19.
  const doorRow = '..............E..D.G....';
  const map = [...Array<string>(7).fill(EMPTY), doorRow, doorRow, '.@............E..D.G.F..', '###R##Q###P#############', GROUND, GROUND];
  const def = level(map);
  const g = new Grid(def, P.laserAltPhase);
  const far: Hero = { ...newHero(g.start, P), x: 1.5 };
  const bodyAt =
    (...cells: Array<[number, number]>) =>
    (c: number, r: number): boolean =>
      cells.some(([bc, br]) => bc === c && br === r);

  it('знаки пар: P и D — пара 0, Q и E — 1, R и G — 2', () => {
    expect(g.plates).toEqual([
      { c: 3, r: 10, pair: 2 },
      { c: 6, r: 10, pair: 1 },
      { c: 10, r: 10, pair: 0 },
    ]);
    const doorCols = (pair: number): number[] => g.doors.filter((d) => d.pair === pair).map((d) => d.c);
    expect([doorCols(0), doorCols(1), doorCols(2)]).toEqual([
      [17, 17, 17],
      [14, 14, 14],
      [19, 19, 19],
    ]);
    expect(g.doors.filter((d) => d.pair === 1).map((d) => d.r)).toEqual([7, 8, 9]);
    expect(g.tile(3, 10)).toBe('R');
    expect(g.tile(14, 8)).toBe('E');
    expect(g.tile(19, 8)).toBe('G');
    expect(g.isDoor(19, 8)).toBe(true);
    expect(g.isDoor(6, 10)).toBe(false);
  });

  it('тело на плите открывает только двери своей пары', () => {
    expect(doorsOpen(g, far, bodyAt([6, 9]), CLOSED, P)).toEqual([false, true, false]);
    expect(doorsOpen(g, far, bodyAt([10, 9]), CLOSED, P)).toEqual([true, false, false]);
    expect(doorsOpen(g, far, bodyAt([3, 9]), CLOSED, P)).toEqual([false, false, true]);
    expect(doorsOpen(g, far, bodyAt([6, 9], [10, 9]), CLOSED, P)).toEqual([true, true, false]);
  });

  it('желейка в двери держит открытой только дверь своей пары', () => {
    const inE: Hero = { ...far, x: 14.5, y: 9.6 };
    expect(doorsOpen(g, inE, noBody, [true, true, true], P)).toEqual([false, true, false]);
  });

  it('закрытая дверь твёрдая, открытая — нет, по парам', () => {
    const run = new Run(def, P);
    expect([run.isSolid(17, 8), run.isSolid(14, 8), run.isSolid(19, 8)]).toEqual([true, true, true]);
    run.doorOpen = [false, true, false];
    expect([run.isSolid(17, 8), run.isSolid(14, 8), run.isSolid(19, 8)]).toEqual([true, false, true]);
    run.doorOpen = [true, false, true];
    expect([run.isSolid(17, 8), run.isSolid(14, 8), run.isSolid(19, 8)]).toEqual([false, true, false]);
    // Плиты всех пар — твёрдые клетки пола.
    expect([run.isSolid(10, 10), run.isSolid(6, 10), run.isSolid(3, 10)]).toEqual([true, true, true]);
  });

  it('«Заново» закрывает двери всех пар', () => {
    const run = new Run(def, P);
    run.doorOpen = [true, true, true];
    run.restart();
    expect(run.doorOpen).toEqual(CLOSED);
  });
});
