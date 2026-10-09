import { describe, expect, it } from 'vitest';
import { Grid } from '../../src/core/grid';
import { newHero, type Hero } from '../../src/core/hero';
import { allLevels } from '../../src/core/levels';
import { doorsOpen, platePressed } from '../../src/core/mechanisms';
import { DATA } from '../../src/data';
import { P } from './maps';

const grid = (id: string): Grid => new Grid(allLevels(DATA).find((l) => l.id === id)!, P.laserAltPhase);
const noBody = (): boolean => false;

describe('плиты и двери', () => {
  const g = grid('p-02');
  const plate = g.plates[0]!;
  const onPlate: Hero = { ...newHero(g.start, P), x: 12.5, y: 11 - P.half - 0.001, grounded: true };

  it('плита: желейка на ней или тело над ней', () => {
    expect(plate).toEqual({ c: 12, r: 11 });
    expect(platePressed(plate, onPlate, noBody, P)).toBe(true);
    expect(platePressed(plate, { ...onPlate, x: 13.5 }, noBody, P)).toBe(false);
    expect(platePressed(plate, { ...onPlate, grounded: false }, noBody, P)).toBe(false);
    const body = (c: number, r: number): boolean => c === 12 && r === 10;
    expect(platePressed(plate, { ...onPlate, alive: false }, body, P)).toBe(true);
  });

  it('открытая дверь не закрывается, пока в ней живая желейка', () => {
    const h = { ...newHero(g.start, P), y: 9.6 };
    expect(doorsOpen(g, { ...h, x: 13.5 }, noBody, true, P)).toBe(true);
    expect(doorsOpen(g, { ...h, x: 13.5 }, noBody, false, P)).toBe(false);
    expect(doorsOpen(g, { ...h, x: 11.5 }, noBody, true, P)).toBe(false);
  });

  it('без плит двери закрыты', () => {
    const g1 = grid('p-01');
    expect(doorsOpen(g1, newHero(g1.start, P), noBody, false, P)).toBe(false);
  });
});
