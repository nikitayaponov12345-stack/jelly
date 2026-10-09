import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/core/levels';
import { Run, type RunEvent } from '../../src/core/run';
import { DATA } from '../../src/data';
import { FLAT, P, STEP, level, play, started, type Tap } from './maps';

const byId = (id: string) => allLevels(DATA).find((l) => l.id === id)!;

/** Все события прогона: [шаг, событие]. */
function log(run: Run, steps: number, taps: readonly Tap[] = []): Array<[number, RunEvent]> {
  const out: Array<[number, RunEvent]> = [];
  play(run, steps, taps, (f, ev) => {
    for (const e of ev) out.push([f, e]);
  });
  return out;
}

const deaths = (events: Array<[number, RunEvent]>) => events.filter(([, e]) => e.type === 'death') as Array<[number, Extract<RunEvent, { type: 'death' }>]>;

describe('попытка уровня', () => {
  it('ready: первая желейка ждёт нажатия, первое нажатие — без прыжка', () => {
    const run = new Run(byId('p-01'), P);
    for (let i = 0; i < 120; i++) run.step(STEP);
    expect(run.state).toBe('ready');
    expect(run.hero.x).toBe(1.5);
    expect(run.time).toBe(0);
    expect(run.drainEvents()).toEqual([]);

    run.press();
    expect(run.state).toBe('play');
    expect(run.drainEvents()).toEqual([{ type: 'start' }]);
    run.release();
    run.step(STEP);
    expect(run.drainEvents()).toEqual([]);
    expect(run.hero.vy).toBe(0);
    expect(run.hero.grounded).toBe(true);
    expect(run.hero.x).toBeCloseTo(1.575, 12);

    run.press();
    run.step(STEP);
    expect(run.drainEvents().map((e) => e.type)).toEqual(['jump']);
  });

  it('«Плита» без прыжков: гибель в лазере держит дверь, вторая желейка финиширует', () => {
    const run = started(byId('p-02'));
    const events = log(run, 600);
    expect(events.map(([f, e]) => [f, e.type])).toEqual([
      [160, 'land'],
      [180, 'death'],
      [180, 'freeze'],
      [205, 'respawn'],
      [463, 'finish'],
    ]);
    const land = events[0]![1] as Extract<RunEvent, { type: 'land' }>;
    expect(land.x).toBeCloseTo(12.599, 9);
    expect(land.y).toBeCloseTo(10.599, 9);
    expect(events[1]![1]).toMatchObject({ type: 'death', cause: 'laser' });
    expect(events[2]![1]).toMatchObject({ type: 'freeze', c: 12, r: 10, cause: 'laser' });
    expect(events[4]![1]).toMatchObject({ type: 'finish', legion: 1, stars: 3 });
    expect(run.state).toBe('done');
    expect(run.legion).toBe(1);
    expect(run.stars).toBe(3);
    expect(run.time).toBeCloseTo(464 / 60, 9);

    const snap = JSON.stringify({ hero: run.hero, bodies: run.bodies, time: run.time, legion: run.legion, door: run.doorOpen });
    for (let i = 0; i < 60; i++) run.step(STEP);
    expect(JSON.stringify({ hero: run.hero, bodies: run.bodies, time: run.time, legion: run.legion, door: run.doorOpen })).toBe(snap);
    expect(run.drainEvents()).toEqual([]);
  });

  it('p-01 без нажатий: шипы заполняются телами, потом лопание у стены', () => {
    const run = started(byId('p-01'));
    const d = deaths(log(run, 1500)).slice(0, 8);
    expect(d.map(([f]) => f)).toEqual([100, 226, 386, 546, 733, 920, 1134, 1491]);
    expect(d.map(([, e]) => e.cause)).toEqual(['spike', 'spike', 'spike', 'spike', 'spike', 'spike', 'spike', 'burst']);
    expect(run.bodies.slice(0, 8)).toEqual([
      { c: 9, r: 11 },
      { c: 8, r: 11 },
      { c: 11, r: 11 },
      { c: 10, r: 11 },
      { c: 13, r: 11 },
      { c: 12, r: 11 },
      { c: 14, r: 11 },
      { c: 14, r: 10 },
    ]);
  });

  it('p-03 без нажатий: восьмое тело не встаёт на старт', () => {
    const run = started(byId('p-03'));
    const events = log(run, 6000);
    const d = deaths(events).slice(0, 8);
    expect(d).toHaveLength(8);
    expect(d.map(([, e]) => e.cause)).toEqual(Array(8).fill('burst'));
    const freezes = events.filter(([, e]) => e.type === 'freeze').map(([, e]) => e as Extract<RunEvent, { type: 'freeze' }>);
    expect({ c: freezes[7]!.c, r: freezes[7]!.r }).toEqual({ c: 1, r: 8 });
    expect(run.bodies.some((b) => b.c === 1 && b.r === 9)).toBe(false);
  });

  it('p-05 без нажатий: первая гибель — пила', () => {
    const run = started(byId('p-05'));
    const events = log(run, 60);
    const [f, e] = deaths(events)[0]!;
    expect(f).toBe(43);
    expect(e.cause).toBe('saw');
    expect(run.bodies[0]).toEqual({ c: 4, r: 9 });
  });

  it('упёрлась в стену — лопается', () => {
    const map = FLAT.map((row, r) => (r >= 5 && r <= 9 ? row.slice(0, 10) + '#' + row.slice(11) : row));
    const run = started(level(map));
    let x = 0;
    let at = -1;
    play(run, 400, [], (f, ev) => {
      const d = ev.find((e) => e.type === 'death');
      if (!d || d.type !== 'death') return false;
      at = f;
      x = d.x;
      expect(d.cause).toBe('burst');
      return true;
    });
    expect(at).toBe(264);
    expect(x).toBeCloseTo(9.599, 9);
    expect(run.hero.x).toBeCloseTo(9.599, 9);
    expect(run.bodies).toEqual([{ c: 9, r: 9 }]);
  });

  it('restart: уровень с начала', () => {
    const run = started(byId('p-01'));
    log(run, 300);
    expect(run.bodies).toHaveLength(2);
    run.restart();
    expect(run.state).toBe('ready');
    expect(run.bodies).toEqual([]);
    expect(run.legion).toBe(0);
    expect(run.time).toBe(0);
    expect(run.hero.x).toBe(1.5);
    expect(run.hero.alive).toBe(true);
    expect(run.drainEvents().at(-1)).toEqual({ type: 'restart' });
  });

  it('один сценарий — один исход', () => {
    const taps: Tap[] = [40, 150, 300, 520, 800, 1100, 1400].map((at, i) => ({ at, hold: 3 + i * 4 }));
    const once = () => {
      const run = started(byId('p-06'));
      log(run, 1800, taps);
      return { bodies: run.bodies, legion: run.legion, time: run.time };
    };
    const a = once();
    expect(a.legion).toBeGreaterThan(0);
    expect(once()).toEqual(a);
  });
});
