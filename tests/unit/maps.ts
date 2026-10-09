import { parseLevels, type LevelDef } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { Run, type RunEvent } from '../../src/core/run';
import { DATA } from '../../src/data';

/** Общие помощники тестов ядра: карты уровней в тесте и прогон попытки по шагам (M0-01, §3). */

export const P = physicsFrom(DATA);
export const STEP = 1000 / 60;
export const EMPTY = '........................';
export const GROUND = '########################';

/** Уровень из 13 строк карты, id t-1. */
export function level(map: string[], par = 0): LevelDef {
  return parseLevels(`level t-1\npar ${par}\nmap\n${map.join('\n')}\nend\n`, 'test', 24, 13)[0]!;
}

/** Ровный пол: ряды 10–12 — земля, старт (1, 9), флаг (22, 9). */
export const FLAT: string[] = [...Array<string>(9).fill(EMPTY), '.@....................F.', GROUND, GROUND, GROUND];

/** Ровный пол и яма без дна в столбцах 8 … 8+n−1 (все три ряда пустые), старт (1, 9), флаг (21, 9). */
export function gapMap(n: number): string[] {
  const ground = '#'.repeat(8) + '.'.repeat(n) + '#'.repeat(24 - 8 - n);
  return [...Array<string>(9).fill(EMPTY), '.@...................F..', ground, ground, ground];
}

/** Ровный пол и стена высотой h в столбцах 10–23 (ряды 10−h … 9), старт (1, 9), флаг (21, 9−h). */
export function wallMap(h: number): string[] {
  const map = [...Array<string>(10).fill(EMPTY), GROUND, GROUND, GROUND];
  for (let r = 10 - h; r <= 9; r++) map[r] = '.'.repeat(10) + '#'.repeat(14);
  map[9 - h] = '.'.repeat(21) + 'F..';
  map[9] = '.@' + map[9]!.slice(2);
  return map;
}

/** Старт: press() и release() — в ready это только запуск бега. */
export function started(def: LevelDef): Run {
  const run = new Run(def, P);
  run.press();
  run.release();
  run.drainEvents();
  return run;
}

/** Нажатие на шаге `at` с удержанием `hold` шагов. */
export interface Tap {
  at: number;
  hold: number;
}

/**
 * Прогон попытки после старта: на шаге f сначала release() (если удержание кончилось), затем press(), затем step.
 * fn получает номер шага и события этого шага; вернула true — прогон останавливается.
 */
export function play(run: Run, steps: number, taps: readonly Tap[], fn: (f: number, ev: RunEvent[]) => boolean | void = () => {}): void {
  for (let f = 0; f < steps; f++) {
    if (taps.some((t) => t.at + t.hold === f)) run.release();
    if (taps.some((t) => t.at === f)) run.press();
    run.step(STEP);
    if (fn(f, run.drainEvents())) return;
  }
}

/** Шаги, на которых случились события типа type. */
export function stepsOf(run: Run, steps: number, taps: readonly Tap[], type: RunEvent['type']): number[] {
  const out: number[] = [];
  play(run, steps, taps, (f, ev) => {
    if (ev.some((e) => e.type === type)) out.push(f);
  });
  return out;
}
