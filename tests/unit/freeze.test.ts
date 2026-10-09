import { describe, expect, it } from 'vitest';
import { freezeAnchor, placeBody } from '../../src/core/freeze';
import { Grid } from '../../src/core/grid';
import { newHero } from '../../src/core/hero';
import { allLevels } from '../../src/core/levels';
import { DATA } from '../../src/data';
import { EMPTY, GROUND, level, P } from './maps';

const byId = (id: string) => allLevels(DATA).find((l) => l.id === id)!;

/** placeBody с твёрдостью как Run.isSolid (земля, плита, закрытая дверь, тело). */
function place(g: Grid, x: number, y: number, bodies: ReadonlyArray<readonly [number, number]> = []) {
  const solid = (c: number, r: number): boolean => {
    if (c < 0 || c >= g.cols) return true;
    if (r < 0 || r >= g.rows) return false;
    const t = g.tile(c, r);
    return t === '#' || t === 'P' || t === 'D' || bodies.some(([bc, br]) => bc === c && br === r);
  };
  return placeBody(x, y, g, solid);
}

describe('где застывает тело', () => {
  it('p-01: шипы, тело над телом, старт', () => {
    const g = new Grid(byId('p-01'), P.laserAltPhase);
    expect(place(g, 9.3, 11.9)).toEqual({ c: 9, r: 11 });
    expect(place(g, 9.3, 12.5)).toEqual({ c: 9, r: 11 });
    expect(place(g, 9.3, 11.9, [[9, 11]])).toEqual({ c: 9, r: 10 });
    expect(place(g, 1.5, 9.6)).toEqual({ c: 1, r: 8 });
  });

  it('не в двери, излучателе и пиле', () => {
    const g2 = new Grid(byId('p-02'), P.laserAltPhase);
    expect(place(g2, 13.5, 8.5)).toEqual({ c: 12, r: 8 });
    expect(place(g2, 12.5, 9.5)).toEqual({ c: 12, r: 8 });
    const g5 = new Grid(byId('p-05'), P.laserAltPhase);
    expect(place(g5, 8.4, 9.2)).toEqual({ c: 8, r: 8 });
  });

  it('замкнутые шипы: тело накрывает шипы, иначе тела нет', () => {
    const map = Array<string>(13).fill(EMPTY);
    map[7] = '.....#..................';
    map[8] = '....###.................';
    map[9] = '....###.................';
    map[10] = '....#^#.................';
    map[11] = '.@..###..............F..';
    map[12] = GROUND;
    const g = new Grid(level(map), P.laserAltPhase);
    expect(place(g, 5.5, 10.5)).toEqual({ c: 5, r: 10 });
    expect(place(g, 5.5, 9.5)).toBeNull();
  });

  it('опорная точка по причине гибели', () => {
    const g = new Grid(byId('p-02'), P.laserAltPhase);
    const laser = g.lasers[0]!;
    const h = { ...newHero(g.start, P), x: 7.25, y: 9.6 };
    expect(freezeAnchor('fall', h, null, P)).toEqual({ x: 7.25, y: 12.5 });
    expect(freezeAnchor('laser', h, laser, P)).toEqual({ x: 12.5, y: 10.5 });
    expect(freezeAnchor('laser', { ...h, y: 11.2 }, laser, P)).toEqual({ x: 12.5, y: 11.2 });
    for (const c of ['spike', 'saw', 'burst'] as const) expect(freezeAnchor(c, h, null, P)).toEqual({ x: 7.25, y: 9.6 });
  });
});
