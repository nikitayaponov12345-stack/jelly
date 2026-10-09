import { describe, expect, it } from 'vitest';
import { Grid, type Laser } from '../../src/core/grid';
import { beamEnd, checkHazards, laserOn, laserWarn } from '../../src/core/hazards';
import { newHero } from '../../src/core/hero';
import { allLevels } from '../../src/core/levels';
import { DATA } from '../../src/data';
import { P } from './maps';

type Bodies = ReadonlyArray<readonly [number, number]>;

const grid = (id: string): Grid => new Grid(allLevels(DATA).find((l) => l.id === id)!, P.laserAltPhase);

/** Твёрдость как Run.isSolid: двери закрыты, тела — в bodies. */
function solidOf(g: Grid, bodies: Bodies = []) {
  const isBody = (c: number, r: number): boolean => bodies.some(([bc, br]) => bc === c && br === r);
  const solid = (c: number, r: number): boolean => {
    if (c < 0 || c >= g.cols) return true;
    if (r < 0 || r >= g.rows) return false;
    const t = g.tile(c, r);
    return t === '#' || t === 'P' || t === 'D' || isBody(c, r);
  };
  return { isBody, solid };
}

function hit(id: string, x: number, y: number, time = 0, bodies: Bodies = []) {
  const g = grid(id);
  const { isBody, solid } = solidOf(g, bodies);
  const h = { ...newHero(g.start, P), x, y };
  return checkHazards(h, g, isBody, time, g.lasers.map((l) => beamEnd(l, solid, g.rows)), P);
}

function cause(id: string, x: number, y: number, time = 0, bodies: Bodies = []): string | null {
  const r = hit(id, x, y, time, bodies);
  return r === null ? null : r.kind === 'flag' ? 'flag' : r.cause;
}

describe('лазеры', () => {
  const l0: Laser = { c: 0, r: 0, phase: 0 };
  const l1: Laser = { c: 0, r: 0, phase: P.laserAltPhase };

  it('цикл и пунктир', () => {
    expect([0, 1.4, 1.5, 2.9].map((t) => laserOn(t, l0, P))).toEqual([true, true, false, false]);
    expect([2.66, 2.64, 0.5].map((t) => laserWarn(t, l0, P))).toEqual([true, false, false]);
    expect([0, 1.49, 1.5, 2.99].map((t) => laserOn(t, l1, P))).toEqual([false, false, true, true]);
  });

  it('луч обрывается на первой твёрдой клетке, тела тоже', () => {
    const g = grid('p-02');
    expect(beamEnd(g.lasers[0]!, solidOf(g).solid, g.rows)).toBe(11);
    expect(beamEnd(g.lasers[0]!, solidOf(g, [[12, 10]]).solid, g.rows)).toBe(10);
  });
});

describe('угрозы и флаг', () => {
  it('шипы', () => {
    expect(cause('p-01', 9.5, 11.9)).toBe('spike');
    expect(cause('p-01', 9.5, 11.8)).toBeNull();
  });

  it('тело накрывает шипы', () => {
    expect(cause('p-01', 9.5, 11.9, 0, [[9, 12]])).toBeNull();
    expect(cause('p-01', 9.5, 11.9)).toBe('spike');
  });

  it('пила', () => {
    expect(cause('p-05', 5.5 - 0.71, 9.5)).toBe('saw');
    expect(cause('p-05', 5.5 - 0.73, 9.5)).toBeNull();
  });

  it('флаг', () => {
    expect(cause('p-02', 20.81, 9.6)).toBe('flag');
    expect(cause('p-02', 20.79, 9.6)).toBeNull();
  });

  it('лазер', () => {
    expect(hit('p-02', 12.5, 10.6, 0)).toEqual({ kind: 'death', cause: 'laser', laser: grid('p-02').lasers[0] });
    expect(cause('p-02', 12.5, 10.6, 2)).toBeNull();
    expect(cause('p-02', 12.5, 9.6, 0)).toBeNull(); // на земле выше луча
  });

  it('падение', () => {
    expect(cause('p-01', 9.5, 13.71)).toBe('fall');
    expect(cause('p-01', 9.5, 13.69)).toBeNull();
  });
});
