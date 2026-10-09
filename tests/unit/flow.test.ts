import { describe, expect, it } from 'vitest';
import { DATA } from '../../src/data';
import { PackFlow } from '../../src/game/flow';

const delay = DATA.num('done_input_delay_s');
const play = { state: 'play' as const, legion: 0, time: 1, stars: 0 };
const done = (legion: number, time: number, stars: number) => ({ state: 'done' as const, legion, time, stars });

describe('ход по набору уровней', () => {
  it('на уровне нажатие — команда попытке', () => {
    const f = new PackFlow(3, delay);
    f.frame(5, play);
    expect(f.screen).toBe('level');
    expect(f.ready).toBe(true);
    expect(f.press()).toBe('run');
  });

  it('финиш открывает окно итога и запоминает итог уровня', () => {
    const f = new PackFlow(3, delay);
    f.frame(0.016, done(2, 7.5, 2));
    expect(f.screen).toBe('result');
    expect(f.result()).toEqual({ legion: 2, time: 7.5, stars: 2 });
    expect(f.result(1)).toBeNull();
  });

  it('окно итога не принимает нажатия первые delay секунд', () => {
    const f = new PackFlow(3, delay);
    f.frame(0.016, done(0, 5, 3));
    expect(f.ready).toBe(false);
    expect(f.press()).toBe('wait');
    f.frame(delay / 2, done(0, 5, 3));
    expect(f.press()).toBe('wait');
    f.frame(delay / 2, done(0, 5, 3));
    expect(f.ready).toBe(true);
    expect(f.press()).toBe('next');
  });

  it('«Дальше» — следующий уровень, после последнего — итог набора', () => {
    const f = new PackFlow(2, delay);
    f.frame(0, done(1, 4, 3));
    expect(f.isLast).toBe(false);
    expect(f.next()).toBe(1);
    expect(f.screen).toBe('level');
    expect(f.index).toBe(1);
    f.frame(0, done(3, 6, 2));
    expect(f.isLast).toBe(true);
    expect(f.next()).toBeNull();
    expect(f.screen).toBe('pack');
    expect(f.press()).toBe('wait');
    f.frame(delay, play);
    expect(f.press()).toBe('from-start');
    expect(f.totals()).toEqual({ legion: 4, time: 10, stars: 5, maxStars: 6, passed: 2 });
  });

  it('«Ещё раз» — тот же уровень; новый финиш заменяет итог', () => {
    const f = new PackFlow(3, delay);
    f.frame(0, done(4, 9, 1));
    f.retry();
    expect(f.screen).toBe('level');
    expect(f.index).toBe(0);
    f.frame(0.016, play);
    expect(f.screen).toBe('level');
    f.frame(0.016, done(1, 6, 3));
    expect(f.result()).toEqual({ legion: 1, time: 6, stars: 3 });
    expect(f.totals()).toMatchObject({ legion: 1, stars: 3, passed: 1 });
  });

  it('«Сначала» стирает итоги и открывает первый уровень', () => {
    const f = new PackFlow(2, delay);
    f.frame(0, done(1, 4, 3));
    f.next();
    f.frame(0, done(2, 5, 3));
    f.next();
    f.fromStart();
    expect(f.screen).toBe('level');
    expect(f.index).toBe(0);
    expect(f.totals()).toEqual({ legion: 0, time: 0, stars: 0, maxStars: 6, passed: 0 });
  });

  it('пауза окна считается заново для каждого окна', () => {
    const f = new PackFlow(3, delay);
    f.frame(0, done(0, 5, 3));
    f.frame(delay, play);
    expect(f.ready).toBe(true);
    f.next();
    f.frame(0, done(0, 5, 3));
    f.frame(delay * 0.9, play);
    expect(f.press()).toBe('wait');
  });
});
