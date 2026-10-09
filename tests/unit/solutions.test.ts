import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { lifeWindows, mapHash, replay, tapSlack } from '../../src/core/solver/replay';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
/** Запас решения для пара (GDD «Бот-решатель», «Запас»): окно нажатия и длина короткого тапа, шагов. */
const WINDOW = Math.round(DATA.num('par_window_s') * 60);
const TAP = Math.round(DATA.num('par_tap_s') * 60);

interface Stored {
  map: string;
  par: number;
  strict: number;
  steps: number;
  windows: number[];
  taps: Array<[number, number]>;
}

/**
 * Сторож уровней (GDD «Бот-решатель»): решение бота с запасом из data/solutions/<набор>.json повторяется настоящим
 * ядром, доходит до флага ровно с паром из файла уровня и сохраняет запас: окно каждого нажатия — не меньше
 * par_window_s, короткий тап — любой длины до par_tap_s. Правка правил, которая ломает уровень, роняет этот тест;
 * правка карты — тоже (отпечаток карты): после неё — `npm run solve`.
 */
describe('решения бота', () => {
  for (const def of allLevels(DATA)) {
    it(`${def.id}: решение с запасом доходит до флага с паром ${def.par}`, () => {
      const file = JSON.parse(readFileSync(new URL(`../../data/solutions/${def.file}.json`, import.meta.url), 'utf8')) as {
        levels: Record<string, Stored>;
      };
      const s = file.levels[def.id];
      expect(s, `нет решения ${def.id} — запусти npm run solve`).toBeDefined();
      expect(s!.map, `карта ${def.id} изменилась — запусти npm run solve`).toBe(mapHash(def));
      expect(s!.par, `пар в файле уровня не равен пару бота`).toBe(def.par);
      expect(s!.strict, 'строгий пар больше пара с запасом').toBeLessThanOrEqual(s!.par);
      const taps = s!.taps.map(([at, hold]) => ({ at, hold }));
      expect(replay(def, P, taps)).toEqual({ done: true, legion: def.par, steps: s!.steps });
      const windows = lifeWindows(def, P, taps);
      expect(windows).toEqual(s!.windows);
      expect(windows.filter((w) => w < WINDOW), `окно нажатия меньше ${WINDOW} шагов`).toEqual([]);
      expect(tapSlack(def, P, taps, TAP), `короткий тап проходит не с любой длиной до ${TAP} шагов`).not.toContain(false);
    });
  }
});
