import { describe, expect, it } from 'vitest';
import { Grid } from '../../src/core/grid';
import { allLevels } from '../../src/core/levels';
import { DATA } from '../../src/data';

const ALT = DATA.num('laser_alt_phase_s');
const grid = (id: string): Grid => new Grid(allLevels(DATA).find((l) => l.id === id)!, ALT);

describe('сетка уровня', () => {
  it('p-02: элементы и клетки', () => {
    const g = grid('p-02');
    expect(g.start).toEqual({ c: 1, r: 9 });
    expect(g.flag).toEqual({ c: 21, r: 9 });
    expect(g.lasers).toEqual([{ c: 12, r: 9, phase: 0 }]);
    expect(g.plates).toEqual([{ c: 12, r: 11 }]);
    expect(g.doors).toEqual([
      { c: 13, r: 7 },
      { c: 13, r: 8 },
      { c: 13, r: 9 },
    ]);
    expect(g.saws).toEqual([]);
    expect(g.tile(12, 9)).toBe('.');
    expect(g.tile(13, 7)).toBe('D');
    expect(g.tile(12, 11)).toBe('P');
    expect(g.tile(-1, 5)).toBe('#');
    expect(g.tile(24, 5)).toBe('#');
    expect(g.tile(5, -1)).toBe('.');
    expect(g.tile(5, 13)).toBe('.');
  });

  it('p-03: лазер l со сдвигом', () => {
    expect(grid('p-03').lasers).toEqual([{ c: 10, r: 2, phase: ALT }]);
  });

  it('p-05: пилы в порядке обхода карты', () => {
    const g = grid('p-05');
    expect(g.saws).toEqual([
      { c: 12, r: 7 },
      { c: 19, r: 8 },
      { c: 5, r: 9 },
      { c: 8, r: 9 },
    ]);
    expect(g.isSaw(8, 9)).toBe(true);
  });
});
