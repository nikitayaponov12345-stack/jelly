import { describe, expect, it } from 'vitest';
import { FixedStep } from '../../src/core/clock';
import type { Run } from '../../src/core/run';
import { DATA } from '../../src/data';
import { EMPTY, FLAT, P, gapMap, level, play, started, stepsOf, wallMap, type Tap } from './maps';

/** Шаги нажатия k = 0 … 199 с удержанием hold, при которых уровень пройден до первой гибели (попытка до 600 шагов). */
function passes(map: string[], hold: number): number[] {
  const def = level(map);
  const out: number[] = [];
  for (let k = 0; k < 200; k++) {
    const run = started(def);
    let ok = false;
    play(run, 600, [{ at: k, hold }], (_f, ev) => {
      if (ev.some((e) => e.type === 'death')) return true;
      if (run.state === 'done') return (ok = true);
      return false;
    });
    if (ok) out.push(k);
  }
  return out;
}

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('движение желейки', () => {
  it('скорость отрыва', () => {
    expect(P.jumpV).toBeCloseTo(Math.sqrt(2 * DATA.num('gravity') * DATA.num('jump_height')), 12);
    expect(P.jumpV).toBeCloseTo(12.2474487, 6);
  });

  it('прыжок на ровном полу: удержание выше и дальше', () => {
    const cases: Array<[number, number, number, number]> = [
      [1, 58, 2.478979, 3.6],
      [3, 60, 2.63477, 3.75],
      [6, 62, 2.852228, 3.9],
      [15, 68, 3.398724, 4.35],
      [30, 69, 3.448724, 4.425],
    ];
    for (const [hold, landAt, rise, dx] of cases) {
      const run = started(level(FLAT));
      let jumpAt = -1;
      let land = -1;
      let x0 = 0;
      let x1 = 0;
      let minY = Infinity;
      play(run, 120, [{ at: 10, hold }], (f, ev) => {
        if (ev.some((e) => e.type === 'jump')) {
          jumpAt = f;
          x0 = run.hero.x;
        }
        if (jumpAt >= 0) minY = Math.min(minY, run.hero.y);
        if (ev.some((e) => e.type === 'land')) {
          land = f;
          x1 = run.hero.x;
          return true;
        }
        return false;
      });
      expect(jumpAt).toBe(10);
      expect(land).toBe(landAt);
      expect(9.599 - minY).toBeCloseTo(rise, 5);
      expect(x1 - x0).toBeCloseTo(dx, 9);
    }
  });

  it('стены: какой высоты берутся', () => {
    expect(passes(wallMap(2), 1)).toEqual(range(74, 199));
    expect(passes(wallMap(2), 30)).toEqual(range(60, 199));
    expect(passes(wallMap(3), 1)).toEqual([]);
    expect(passes(wallMap(3), 30)).toEqual(range(68, 199));
    expect(passes(wallMap(4), 1)).toEqual([]);
    expect(passes(wallMap(4), 30)).toEqual([]);
  });

  it('ямы без дна: какой ширины перепрыгиваются', () => {
    expect(passes(gapMap(3), 1)).toEqual(range(74, 96));
    expect(passes(gapMap(3), 30)).toEqual(range(64, 96));
    expect(passes(gapMap(4), 1)).toEqual(range(87, 96));
    expect(passes(gapMap(4), 30)).toEqual(range(77, 96));
    expect(passes(gapMap(5), 1)).toEqual([]);
    expect(passes(gapMap(5), 30)).toEqual(range(90, 96));
    expect(passes(gapMap(6), 1)).toEqual([]);
    expect(passes(gapMap(6), 30)).toEqual([]);
  });

  it('койот-время: прыжок ещё возможен несколько шагов после схода с края', () => {
    const ground = '#'.repeat(10) + '....' + '#'.repeat(10);
    const def = level([...Array<string>(9).fill(EMPTY), '.@...................F..', ground, ground, ground]);
    let last = -1;
    const run = started(def);
    play(run, 300, [], (f) => {
      if (run.hero.grounded) last = f;
      return !run.hero.alive;
    });
    expect(last).toBe(117);
    const jumped = (k: number): boolean => {
      const r = started(def);
      let got = false;
      play(r, 300, [{ at: 117 + k, hold: 1 }], (f, ev) => {
        if (f === 117 + k && ev.some((e) => e.type === 'jump')) got = true;
        return ev.some((e) => e.type === 'death');
      });
      return got;
    };
    expect(range(0, 8).map(jumped)).toEqual([true, true, true, true, true, true, false, false, false]);
  });

  it('буфер прыжка: нажатие незадолго до приземления', () => {
    expect(stepsOf(started(level(FLAT)), 120, [{ at: 10, hold: 1 }], 'land')[0]).toBe(58);
    for (let n = 0; n <= 9; n++) {
      const taps: Tap[] = [
        { at: 10, hold: 1 },
        { at: 58 - n, hold: 1 },
      ];
      const jumps = stepsOf(started(level(FLAT)), 65, taps, 'jump');
      expect(jumps, `n = ${n}`).toEqual(n <= 5 ? [10, 59] : [10]);
    }
  });

  it('частота кадров не меняет исход', () => {
    const def = level(gapMap(10));
    const result = (frameMs: number) => {
      const run: Run = started(def);
      const clock = new FixedStep();
      for (let t = 0; t < 3000 - 1e-6; t += frameMs) clock.advance(frameMs, (dt) => run.step(dt));
      return run;
    };
    for (const frame of [1000 / 30, 1000 / 60, 1000 / 144]) {
      const run = result(frame);
      expect(run.hero.x).toBeCloseTo(3.9, 9);
      expect(run.hero.y).toBeCloseTo(9.599, 9);
      expect(run.legion).toBe(1);
      expect(run.time).toBeCloseTo(3, 9);
      expect(run.bodies).toEqual([{ c: 10, r: 12 }]);
    }
  });
});
