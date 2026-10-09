import { describe, expect, it } from 'vitest';
import { parseLevels, type LevelDef } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { Run } from '../../src/core/run';
import { mapHash, pressWindows, replay } from '../../src/core/solver/replay';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
const AIR = '........................';
const GROUND = '########################';

/** Ряды 0…8 — воздух, ряд 9 — старт (1, 9) и флаг (21, 9), ряды 10…12 — пол floor. */
function lvl(floor: string): LevelDef {
  const map = [...Array<string>(9).fill(AIR), '.@...................F..', floor, floor, floor];
  return parseLevels(`level t-1\npar 0\nmap\n${map.join('\n')}\nend\n`, 'test', 24, 13)[0]!;
}

/** Яма без дна шириной n со столбца 8 — как gapMap в тестах M0-01. */
const gap = (n: number): string => '#'.repeat(8) + '.'.repeat(n) + '#'.repeat(24 - 8 - n);

describe('повтор решения', () => {
  it('без нажатий — тот же прогон, что у ядра', () => {
    const def = lvl(GROUND);
    const run = new Run(def, P);
    run.press();
    run.release();
    let steps = 0;
    while (run.state !== 'done') {
      run.step(1000 / 60);
      steps++;
    }
    expect(replay(def, P, [])).toEqual({ done: true, legion: 0, steps });
  });

  it('предел шагов: прогон обрывается', () => {
    expect(replay(lvl(GROUND), P, [], 10)).toEqual({ done: false, legion: 0, steps: 10 });
  });

  it('яма без дна: без прыжков её заполняют телами, прыжок вовремя — без гибелей', () => {
    const def = lvl(gap(4));
    expect(replay(def, P, []).legion).toBeGreaterThan(0);
    expect(replay(def, P, [{ at: 86, hold: 30 }])).toMatchObject({ done: true, legion: 0 });
  });
});

describe('запас нажатий', () => {
  it('у решения без нажатий окон нет', () => {
    expect(pressWindows(lvl(GROUND), P, [])).toEqual([]);
  });

  it('яма в 4 клетки, полное удержание: нажатие годится на шагах 77…96 (как в тестах M0-01)', () => {
    const def = lvl(gap(4));
    expect(pressWindows(def, P, [{ at: 77, hold: 30 }], 30)).toEqual([20]);
    expect(pressWindows(def, P, [{ at: 96, hold: 30 }], 30)).toEqual([20]);
    expect(pressWindows(def, P, [{ at: 86, hold: 30 }])).toEqual([12]); // предел cap = 12
    // Удержание 15 шагов чуть короче полного (действует 16 шагов): окно на шаг уже.
    expect(pressWindows(def, P, [{ at: 78, hold: 15 }], 30)).toEqual([19]);
  });
});

describe('отпечаток карты', () => {
  it('тот же для той же карты и другой для другой', () => {
    expect(mapHash(lvl(GROUND))).toBe(mapHash(lvl(GROUND)));
    expect(mapHash(lvl(gap(4)))).not.toBe(mapHash(lvl(gap(5))));
    expect(mapHash(lvl(GROUND))).toMatch(/^[0-9a-f]{8}$/);
  });
});
