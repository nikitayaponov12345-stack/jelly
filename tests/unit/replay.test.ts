import { describe, expect, it } from 'vitest';
import { allLevels, parseLevels, type LevelDef } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { Run } from '../../src/core/run';
import { fitHolds, lifeWindows, lives, mapHash, replay, tapSlack } from '../../src/core/solver/replay';
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

  it('удержание — не дольше, чем до следующего нажатия; два нажатия на одном шаге — ошибка', () => {
    expect(fitHolds([{ at: 10, hold: 30 }, { at: 20, hold: 1 }])).toEqual([{ at: 10, hold: 10 }, { at: 20, hold: 1 }]);
    expect(fitHolds([{ at: 10, hold: 1 }, { at: 10, hold: 1 }])).toBeNull();
    expect(() => replay(lvl(GROUND), P, [{ at: 10, hold: 1 }, { at: 10, hold: 1 }])).toThrow();
  });
});

describe('жизни прогона', () => {
  it('яма без дна в 4 клетки без нажатий: тела заполняют яму, последняя желейка у флага', () => {
    const def = lvl(gap(4));
    const all = lives(def, P, []);
    expect(all.length).toBe(replay(def, P, []).legion + 1);
    expect(all[0]!.from).toBe(0);
    expect(all[0]!.outcome).toBe('1210'); // первое тело — на дне ямы, клетка (10, 12)
    expect(all.at(-1)!.outcome).toBe('flag');
    for (let i = 1; i < all.length; i++) expect(all[i]!.from).toBeGreaterThan(all[i - 1]!.from);
  });

  it('нажатия раскладываются по жизням', () => {
    const def = lvl(gap(4));
    // Первая желейка прыгает слишком рано и падает в яму, вторая перепрыгивает её по телу.
    const taps = [{ at: 30, hold: 1 }, { at: 260, hold: 30 }];
    const all = lives(def, P, taps);
    expect(all.map((l) => l.taps)).toEqual([[0], [1]]);
    expect(all.at(-1)!.outcome).toBe('flag');
  });
});

describe('запас нажатий', () => {
  it('у решения без нажатий окон нет', () => {
    expect(lifeWindows(lvl(GROUND), P, [])).toEqual([]);
  });

  it('яма в 4 клетки, полное удержание: нажатие годится на шагах 77…96 (как в тестах M0-01)', () => {
    const def = lvl(gap(4));
    expect(lifeWindows(def, P, [{ at: 77, hold: 30 }], 30)).toEqual([20]);
    expect(lifeWindows(def, P, [{ at: 96, hold: 30 }], 30)).toEqual([20]);
    expect(lifeWindows(def, P, [{ at: 86, hold: 30 }])).toEqual([12]); // предел cap = 12
    // Удержание 15 шагов чуть короче полного (действует 16 шагов): окно на шаг уже.
    expect(lifeWindows(def, P, [{ at: 78, hold: 15 }], 30)).toEqual([19]);
  });

  it('короткий тап: в яме в 4 клетки годится любая длина до 0,1 с', () => {
    expect(tapSlack(lvl(gap(4)), P, [{ at: 96, hold: 1 }], 6)).toEqual([true]);
  });

  it('«Пилы»: строгое решение M0-04 — окна 6, 9, 11, но первые два тапа проходят только короче 0,1 с', () => {
    const def = allLevels(DATA).find((l) => l.id === 'p-05')!;
    const strict = [{ at: 18, hold: 1 }, { at: 69, hold: 1 }, { at: 120, hold: 30 }];
    expect(replay(def, P, strict)).toEqual({ done: true, legion: 0, steps: 258 });
    expect(lifeWindows(def, P, strict)).toEqual([6, 9, 11]);
    expect(tapSlack(def, P, strict, 6)).toEqual([false, false, true]);
  });
});

describe('отпечаток карты', () => {
  it('тот же для той же карты и другой для другой', () => {
    expect(mapHash(lvl(GROUND))).toBe(mapHash(lvl(GROUND)));
    expect(mapHash(lvl(gap(4)))).not.toBe(mapHash(lvl(gap(5))));
    expect(mapHash(lvl(GROUND))).toMatch(/^[0-9a-f]{8}$/);
  });
});
