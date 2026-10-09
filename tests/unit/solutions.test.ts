import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { mapHash, replay } from '../../src/core/solver/replay';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);

interface Stored {
  map: string;
  par: number;
  steps: number;
  taps: Array<[number, number]>;
}

/**
 * Сторож уровней (GDD «Бот-решатель»): решение бота из data/solutions/<набор>.json повторяется настоящим ядром
 * и доходит до флага ровно с паром из файла уровня. Правка правил, которая ломает уровень, роняет этот тест;
 * правка карты — тоже (отпечаток карты): после неё — `npm run solve`.
 */
describe('решения бота', () => {
  for (const def of allLevels(DATA)) {
    it(`${def.id}: решение доходит до флага с паром ${def.par}`, () => {
      const file = JSON.parse(readFileSync(new URL(`../../data/solutions/${def.file}.json`, import.meta.url), 'utf8')) as {
        levels: Record<string, Stored>;
      };
      const s = file.levels[def.id];
      expect(s, `нет решения ${def.id} — запусти npm run solve`).toBeDefined();
      expect(s!.map, `карта ${def.id} изменилась — запусти npm run solve`).toBe(mapHash(def));
      expect(s!.par, `пар в файле уровня не равен пару бота`).toBe(def.par);
      const r = replay(def, P, s!.taps.map(([at, hold]) => ({ at, hold })));
      expect(r).toEqual({ done: true, legion: def.par, steps: s!.steps });
    });
  }
});
