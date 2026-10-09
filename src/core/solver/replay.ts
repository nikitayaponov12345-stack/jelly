import type { LevelDef } from '../levels';
import type { Physics } from '../physics';
import { Run } from '../run';
import type { Tap } from './solve';

const STEP_MS = 1000 / 60;

export interface ReplayResult {
  done: boolean;
  legion: number;
  /** Шагов до флага (или до предела). */
  steps: number;
}

/**
 * Повтор решения с начала уровня теми же командами, что у пальца: первое нажатие — старт, затем на шаге f
 * сначала release() (кончилось удержание), потом press(), потом step — как в прогонах тестов и у бота.
 */
export function replay(def: LevelDef, P: Physics, taps: readonly Tap[], maxSteps = 6000): ReplayResult {
  const run = new Run(def, P);
  run.press();
  run.release();
  const releases = new Set(taps.map((t) => t.at + t.hold));
  const presses = new Set(taps.map((t) => t.at));
  let f = 0;
  for (; f < maxSteps && run.state !== 'done'; f++) {
    if (releases.has(f)) run.release();
    if (presses.has(f)) run.press();
    run.step(STEP_MS);
  }
  return { done: run.state === 'done', legion: run.legion, steps: f };
}

/**
 * Запас решения: для каждого нажатия — сколько подряд шагов (включая найденный) можно нажать раньше или позже,
 * и уровень всё так же проходится с тем же числом гибелей. Остальные нажатия при этом на месте; считаем до cap.
 * Окно в 1 шаг — нажатие «кадр в кадр», живому игроку почти недоступно; 6 шагов — 0,1 с.
 */
export function pressWindows(def: LevelDef, P: Physics, taps: readonly Tap[], cap = 12): number[] {
  const base = replay(def, P, taps);
  const ok = (moved: Tap[]): boolean => {
    const r = replay(def, P, moved);
    return r.done && r.legion === base.legion;
  };
  return taps.map((_, i) => {
    let width = 1;
    for (const dir of [-1, 1]) {
      for (let d = dir; width < cap; d += dir) {
        const moved = taps.map((t, j) => (j === i ? { at: t.at + d, hold: t.hold } : t));
        if (moved[i]!.at < 0 || !ok(moved)) break;
        width++;
      }
    }
    return width;
  });
}

/** Отпечаток карты уровня (FNV-1a по строкам карты): сохранённое решение верно, только пока карта та же. */
export function mapHash(def: LevelDef): string {
  let h = 0x811c9dc5;
  for (const ch of def.map.join('\n')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
