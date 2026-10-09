import { describe, expect, it } from 'vitest';
import { parseLevels, type LevelDef } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { Run } from '../../src/core/run';
import { replay } from '../../src/core/solver/replay';
import { solve, solverOptions } from '../../src/core/solver/solve';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
const STEP = 1000 / 60;
const AIR = '........................';
const GROUND = '########################';

/** Уровень из 13 строк карты прямо в тесте. */
function levelOf(map: readonly string[]): LevelDef {
  return parseLevels(`level t-1\npar 0\nmap\n${map.join('\n')}\nend\n`, 'test', 24, 13)[0]!;
}

/** Ряды 0…8 — воздух, ряд 9 — старт (1, 9) и флаг (21, 9), ряды 10…12 — пол floor (на дне — bottom). */
function lvl(floor: string, bottom = floor): LevelDef {
  return levelOf([...Array<string>(9).fill(AIR), '.@...................F..', floor, floor, bottom]);
}

/** Яма шириной n со столбца 8: без дна или с шипами на дне. */
const gap = (n: number): string => '#'.repeat(8) + '.'.repeat(n) + '#'.repeat(24 - 8 - n);

describe('копия попытки', () => {
  it('копия идёт сама по себе, а одинаковые команды дают одно и то же', () => {
    const def = lvl(gap(6));
    const a = new Run(def, P);
    a.press();
    a.release();
    for (let i = 0; i < 60; i++) a.step(STEP);
    const b = a.clone();
    expect(b.grid).toBe(a.grid);
    for (let i = 0; i < 90; i++) b.step(STEP);
    expect(a.time).toBeCloseTo(1, 9);
    expect(b.bodies.length).toBe(1);
    expect(a.bodies.length).toBe(0);
    for (let i = 0; i < 90; i++) a.step(STEP);
    expect(a.hero).toEqual(b.hero);
    expect(a.bodies).toEqual(b.bodies);
    expect(a.legion).toBe(b.legion);
    expect(a.drainEvents().map((e) => e.type)).toContain('death');
    expect(b.drainEvents().map((e) => e.type)).toContain('death');
  });
});

describe('бот-решатель', () => {
  it('ровный пол: пар 0, без нажатий', () => {
    const def = lvl(GROUND);
    const s = solve(def, P);
    expect(s.found).toBe(true);
    expect(s.par).toBe(0);
    expect(s.taps).toEqual([]);
    expect(s.steps).toBe(replay(def, P, []).steps);
  });

  it('яма без дна в 4 клетки: перепрыгивается без гибелей', () => {
    const def = lvl(gap(4));
    expect(replay(def, P, []).legion).toBeGreaterThan(0); // без прыжков яму заполняют телами
    const s = solve(def, P);
    expect(s.par).toBe(0);
    expect(s.taps.length).toBeGreaterThan(0);
    const r = replay(def, P, s.taps);
    expect(r).toEqual({ done: true, legion: 0, steps: s.steps });
  });

  it('широкая яма с шипами: без тел не пройти, решение повторяется', () => {
    const pit = '#'.repeat(7) + '.'.repeat(8) + '#'.repeat(9);
    const def = lvl(pit, '#'.repeat(7) + '^'.repeat(8) + '#'.repeat(9));
    const s = solve(def, P);
    expect(s.found).toBe(true);
    expect(s.par).toBeGreaterThanOrEqual(1);
    const r = replay(def, P, s.taps);
    expect(r.done).toBe(true);
    expect(r.legion).toBe(s.par);
    expect(r.steps).toBe(s.steps);
  });

  it('стена до неба: в пределах поиска не решается', () => {
    const wall = '...........#............';
    const def = levelOf([...Array<string>(9).fill(wall), '.@.........#.........F..', GROUND, GROUND, GROUND]);
    const s = solve(def, P, { ...solverOptions(P), maxDeaths: 2 });
    expect(s.found).toBe(false);
    expect(s.par).toBe(-1);
    expect(s.nodes).toBeGreaterThan(1);
  });
});
