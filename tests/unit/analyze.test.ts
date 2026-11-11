import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { analyzeLevel, difficulty } from '../../src/core/solver/analyze';
import { robustOptions } from '../../src/core/solver/robust';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
const OPT = robustOptions(P, DATA.num('par_window_s'), DATA.num('par_tap_s'));
const level = (id: string) => allLevels(DATA).find((l) => l.id === id)!;

describe('разбор уровня ботом (npm run analyze)', () => {
  it('формула сложности: пар, скрытые тела, доля хороших первых тел, тесное окно, простой игрок', () => {
    const base = { par: 2, steps: 600, minWindow: 12, first: 8, firstGood: 1, solutions: 1, passive: null, greedy: null, simple: null, hidden: 1 };
    expect(difficulty(base)).toBe(6.5); // 2 + 1,5 + log₂ 8
    expect(difficulty({ ...base, minWindow: 8 })).toBe(7); // окно < 9 шагов — +0,5
    expect(difficulty({ ...base, simple: 2 })).toBe(4.5); // простой игрок берёт пар — −2
    expect(difficulty({ ...base, firstGood: 0, par: 0, hidden: 0 })).toBe(0);
  });

  it('«Подставка» (pz-01): семь первых тел, три оставляют пар — три решения; простой игрок тратит 2', () => {
    expect(analyzeLevel(level('pz-01'), P, OPT)).toEqual({
      par: 1,
      steps: 381,
      minWindow: 12,
      first: 7,
      firstGood: 3,
      solutions: 3,
      passive: null,
      greedy: 2,
      simple: 2,
      hidden: 1,
      d: 3.7,
    });
  });

  it('«Пила за мостом» (w1-09): жизнь «подальше» сама кладёт нужное тело — скрытых тел нет, простой игрок берёт пар', () => {
    expect(analyzeLevel(level('w1-09'), P, OPT)).toMatchObject({
      par: 1,
      first: 5,
      firstGood: 2,
      solutions: 2,
      passive: null,
      greedy: 1,
      simple: 1,
      hidden: 0,
      d: 0.3,
    });
  });

  it('«Мост в воздухе» (pz-04): пять первых тел, к пару ведёт одно; без нажатий не дойти', () => {
    expect(analyzeLevel(level('pz-04'), P, OPT)).toMatchObject({
      par: 1,
      minWindow: 7,
      first: 5,
      firstGood: 1,
      solutions: 1,
      passive: null,
      simple: 4,
      hidden: 1,
      d: 5.3,
    });
  });
});
