import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allLevels, parseLevels, type LevelDef } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { replay, tapSlack } from '../../src/core/solver/replay';
import { LifeOracle, robustOptions, solveRobust } from '../../src/core/solver/robust';
import { levelKey, rootNode, solve } from '../../src/core/solver/solve';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
const OPT = robustOptions(P, DATA.num('par_window_s'), DATA.num('par_tap_s'));
const AIR = '........................';
const GROUND = '########################';

/** Ряды 0…8 — воздух, ряд 9 — старт (1, 9) и флаг (21, 9), ряды 10…12 — пол floor. */
function lvl(floor: string): LevelDef {
  const map = [...Array<string>(9).fill(AIR), '.@...................F..', floor, floor, floor];
  return parseLevels(`level t-1\npar 0\nmap\n${map.join('\n')}\nend\n`, 'test', 24, 13)[0]!;
}

/** Яма без дна шириной n со столбца 8. */
const gap = (n: number): string => '#'.repeat(8) + '.'.repeat(n) + '#'.repeat(24 - 8 - n);

describe('бот с запасом', () => {
  it('пределы M0-05: окно 6 шагов (0,1 с), нажатие раз в 6 шагов, короткий тап — до 6 шагов', () => {
    expect(OPT).toMatchObject({ window: 6, pressEvery: 6, tapMax: 6, holds: [1, 30], maxJumps: 3, maxDeaths: 8 });
  });

  it('ровный пол: пар 0, без нажатий', () => {
    const def = lvl(GROUND);
    const s = solveRobust(def, P, OPT);
    expect(s).toMatchObject({ found: true, par: 0, taps: [] });
    expect(s.steps).toBe(replay(def, P, []).steps);
  });

  it('яма в 4 клетки: окно короткого прыжка — 10 шагов, полного — 20; с запасом 6 годится короткий', () => {
    const def = lvl(gap(4));
    const oracle = new LifeOracle(rootNode(def, P), OPT.maxLifeSteps);
    expect(oracle.window([{ at: 96, hold: 1 }], 0, 'flag', 30)).toBe(10);
    expect(oracle.window([{ at: 86, hold: 30 }], 0, 'flag', 30)).toBe(20);
    expect(oracle.outcome([])).toBe('1210'); // без прыжка — тело на дне ямы
    expect(oracle.robust([{ at: 96, hold: 1 }], 'flag', OPT)).toBe(true);
    expect(solveRobust(def, P, OPT)).toMatchObject({ found: true, par: 0, steps: 258, taps: [{ at: 96, hold: 1 }] });
  });

  it('запас больше, чем даёт прыжок, — без гибели не пройти', () => {
    const def = lvl(gap(4));
    expect(solveRobust(def, P, { ...OPT, window: 12, pressEvery: 12 })).toMatchObject({ par: 0, taps: [{ at: 84, hold: 30 }] });
    const s = solveRobust(def, P, { ...OPT, window: 21, pressEvery: 21 });
    expect(s.par).toBe(1);
    expect(replay(def, P, s.taps)).toEqual({ done: true, legion: 1, steps: s.steps });
  });
});

describe('состояние уровня', () => {
  it('фаза лазеров — часть состояния, только если на уровне есть лазеры', () => {
    const laser = rootNode(allLevels(DATA).find((l) => l.id === 'p-03')!, P).run;
    expect(levelKey(laser, 0, 180)).not.toBe(levelKey(laser, 90, 180));
    expect(levelKey(laser, 0, 180)).toBe(levelKey(laser, 180, 180));
    const plain = rootNode(lvl(GROUND), P).run;
    expect(levelKey(plain, 0, 180)).toBe(levelKey(plain, 90, 180));
  });
});

interface Stored {
  par: number;
  strict: number;
  steps: number;
  taps: Array<[number, number]>;
}

/**
 * Сторож самого бота: на быстрых уровнях прототипа оба бота находят ровно то, что записано в data/solutions
 * (`npm run solve`). Правка бота, которая меняет его решения, роняет этот тест; после неё — `npm run solve`.
 */
describe('сторож бота: быстрые уровни прототипа', () => {
  const stored = (
    JSON.parse(readFileSync(new URL('../../data/solutions/proto.json', import.meta.url), 'utf8')) as {
      levels: Record<string, Stored>;
    }
  ).levels;
  for (const id of ['p-01', 'p-02', 'p-03', 'p-05']) {
    it(`${id}: бот с запасом и строгий бот находят записанное`, { timeout: 60_000 }, () => {
      const def = allLevels(DATA).find((l) => l.id === id)!;
      const want = stored[id]!;
      const s = solveRobust(def, P, OPT);
      expect({ par: s.par, steps: s.steps, taps: s.taps.map((t) => [t.at, t.hold]) }).toEqual({ par: want.par, steps: want.steps, taps: want.taps });
      expect(solve(def, P).par).toBe(want.strict);
    });
  }

  it('«Пилы»: строгий бот проходит без гибелей только тапами короче 0,1 с, с запасом нужна одна гибель', { timeout: 60_000 }, () => {
    const def = allLevels(DATA).find((l) => l.id === 'p-05')!;
    const strict = solve(def, P);
    expect(strict.par).toBe(0);
    expect(tapSlack(def, P, strict.taps, OPT.tapMax)).toContain(false);
    expect(solveRobust(def, P, OPT).par).toBe(1);
  });
});
