import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { Run } from '../../src/core/run';
import { DATA } from '../../src/data';
import { loadPrototype } from './prototype';

const P = physicsFrom(DATA);
const LEVELS = allLevels(DATA);
const STEPS = 60 * 40;
/** Сколько шагов сравнено при проверке до передачи (09.10.2026). */
const COMPARED = 307_106;

/** Случайный сценарий нажатий: нажатие через 5–94 шага, удержание 1–25 шагов (тот же генератор, что при проверке до передачи). */
function script(seed: number): { press: Set<number>; release: Set<number> } {
  let s = seed >>> 0;
  const rnd = (): number => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const press = new Set<number>();
  const release = new Set<number>();
  let f = 0;
  while (f < STEPS) {
    f += 5 + Math.floor(rnd() * 90);
    press.add(f);
    const hold = 1 + Math.floor(rnd() * 25);
    release.add(f + hold);
    f += hold;
  }
  return { press, release };
}

describe('ядро против прототипа', () => {
  it('шесть уровней × 40 сценариев: на каждом шаге то же положение, гибели, тела и двери', () => {
    const proto = loadPrototype();
    let compared = 0;
    let stoppedByDesign = 0;
    const mismatches: string[] = [];
    for (let li = 0; li < 6; li++) {
      const def = LEVELS[li]!;
      for (let seed = 1; seed <= 40; seed++) {
        const sc = script(seed * 7919 + li);
        proto.loadLevel(li);
        const run = new Run(def, P);
        run.press(); // в ядре первая желейка ждёт нажатия; прототип бежит сразу
        run.release();
        for (let f = 0; f < STEPS; f++) {
          if (sc.release.has(f)) {
            proto.release();
            run.release();
          }
          if (sc.press.has(f)) {
            proto.press();
            run.press();
          }
          const before = proto.G().frozen.length;
          proto.step();
          run.step(1000 / 60);
          const G = proto.G();
          // Правка M0: тело не встаёт в клетку старта, двери, излучателя и пилы — дальше уровни расходятся намеренно.
          const nb = G.frozen.length > before ? G.frozen.at(-1) : null;
          if (nb && (run.grid.isStart(nb.c, nb.r) || run.grid.isDoor(nb.c, nb.r) || run.grid.isEmitter(nb.c, nb.r) || run.grid.isSaw(nb.c, nb.r))) {
            stoppedByDesign++;
            break;
          }
          const a = `${G.hero.x.toFixed(9)} ${G.hero.y.toFixed(9)} ${G.legion} ${G.frozen.map((b: { c: number; r: number }) => `${b.c},${b.r}`).join(';')} ${G.doorOpen} ${G.state === 'done'}`;
          const b = `${run.hero.x.toFixed(9)} ${run.hero.y.toFixed(9)} ${run.legion} ${run.bodies.map((x) => `${x.c},${x.r}`).join(';')} ${run.doorOpen} ${run.state === 'done'}`;
          if (a !== b) {
            mismatches.push(`L${li + 1} seed ${seed} step ${f}: прототип «${a}», ядро «${b}»`);
            break;
          }
          compared++;
          if (G.state !== 'play') break;
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(stoppedByDesign).toBe(17);
    expect(compared).toBe(COMPARED);
  });
});
