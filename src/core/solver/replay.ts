import type { LevelDef } from '../levels';
import type { Physics } from '../physics';
import { Run } from '../run';
import { bodiesKey, type Tap } from './solve';

const STEP_MS = 1000 / 60;

export interface ReplayResult {
  done: boolean;
  legion: number;
  /** Шагов до флага (или до предела). */
  steps: number;
}

/** Жизнь желейки в прогоне решения. */
export interface Life {
  /** Шаг рождения желейки (у первой — 0). */
  from: number;
  /** Номера нажатий решения, сделанных в эту жизнь. */
  taps: number[];
  /** Исход: 'flag', тела после гибели (как bodiesKey) или 'none' — прогон кончился раньше. */
  outcome: string;
}

/**
 * Палец отпускает кнопку, прежде чем нажать снова: удержание — не дольше, чем до следующего нажатия.
 * Нажатия — по возрастанию шага; null — два нажатия на одном шаге или не по порядку.
 */
export function fitHolds(taps: readonly Tap[]): Tap[] | null {
  const out: Tap[] = [];
  for (let i = 0; i < taps.length; i++) {
    const t = taps[i]!;
    const next = taps[i + 1];
    const hold = next === undefined ? t.hold : Math.min(t.hold, next.at - t.at);
    if (hold < 1) return null;
    out.push({ at: t.at, hold });
  }
  return out;
}

/**
 * Прогон решения с начала уровня теми же командами, что у пальца и бота: первое нажатие — старт; на шаге f сначала
 * release() (кончилось удержание), потом press(), потом step; гибель отпускает кнопку — как у бота. Прогон
 * останавливается у флага, на пределе шагов или после гибели жизни номер stopAfter (с нуля).
 */
function play(def: LevelDef, P: Physics, taps: readonly Tap[], maxSteps: number, stopAfter: number): ReplayResult & { lives: Life[] } {
  const fit = fitHolds(taps);
  if (!fit) throw new Error('решение: нажатия не по порядку или два на одном шаге');
  const run = new Run(def, P);
  run.press();
  run.release();
  const lives: Life[] = [{ from: 0, taps: [], outcome: 'none' }];
  let pending = -1;
  let next = 0;
  let alive = true;
  let f = 0;
  for (; f < maxSteps; f++) {
    if (f === pending) {
      run.release();
      pending = -1;
    }
    if (next < fit.length && fit[next]!.at === f) {
      lives[lives.length - 1]!.taps.push(next);
      run.press();
      pending = f + fit[next]!.hold;
      next++;
    }
    run.step(STEP_MS);
    if (run.state === 'done') {
      lives[lives.length - 1]!.outcome = 'flag';
      return { done: true, legion: run.legion, steps: f + 1, lives };
    }
    if (alive && !run.hero.alive) {
      lives[lives.length - 1]!.outcome = bodiesKey(run.bodies);
      if (lives.length > stopAfter) return { done: false, legion: run.legion, steps: f + 1, lives };
      run.release();
      pending = -1;
    }
    if (!alive && run.hero.alive) lives.push({ from: f + 1, taps: [], outcome: 'none' });
    alive = run.hero.alive;
  }
  return { done: false, legion: run.legion, steps: f, lives };
}

/** Повтор решения: дошла ли попытка до флага, с каким легионом и за сколько шагов. */
export function replay(def: LevelDef, P: Physics, taps: readonly Tap[], maxSteps = 6000): ReplayResult {
  const r = play(def, P, taps, maxSteps, Infinity);
  return { done: r.done, legion: r.legion, steps: r.steps };
}

/** Жизни прогона решения: с какого шага, какие нажатия и чем кончилась каждая. */
export function lives(def: LevelDef, P: Physics, taps: readonly Tap[], maxSteps = 6000): Life[] {
  return play(def, P, taps, maxSteps, Infinity).lives;
}

/** Нажатия решения по жизням: исход жизни L при нажатиях moved (берутся нажатия до конца этой жизни). */
function lifeOutcome(def: LevelDef, P: Physics, moved: readonly Tap[], upto: number, L: number): string {
  const r = play(def, P, moved.slice(0, upto), 6000, L);
  return r.lives.length === L + 1 ? r.lives[L]!.outcome : 'other';
}

/**
 * Запас решения по жизням (GDD «Бот-решатель», «Запас»): для каждого нажатия — сколько шагов подряд (включая своё)
 * можно нажать раньше или позже, и его жизнь кончается так же — тело в той же клетке или флаг. Остальные нажатия
 * этой жизни на месте, следующие жизни не в счёт; считаем до cap. Окно в 1 шаг — нажатие «кадр в кадр».
 */
export function lifeWindows(def: LevelDef, P: Physics, taps: readonly Tap[], cap = 12): number[] {
  const out = taps.map(() => 0);
  lives(def, P, taps).forEach((life, L) => {
    const upto = life.taps.length > 0 ? Math.max(...life.taps) + 1 : 0;
    for (const i of life.taps) {
      const at = taps[i]!.at;
      const lowest = Math.max(life.from, i > 0 ? taps[i - 1]!.at + 1 : 0);
      const highest = i + 1 < upto ? taps[i + 1]!.at - 1 : Infinity;
      const same = (d: number): boolean =>
        lifeOutcome(def, P, taps.map((t, j) => (j === i ? { at: at + d, hold: t.hold } : t)), upto, L) === life.outcome;
      let lo = 0;
      let hi = 0;
      while (hi - lo + 1 < cap && at + lo - 1 >= lowest && same(lo - 1)) lo--;
      while (hi - lo + 1 < cap && at + hi + 1 <= highest && same(hi + 1)) hi++;
      out[i] = hi - lo + 1;
    }
  });
  return out;
}

/**
 * Короткие тапы решения (удержание до tapMax шагов): даёт ли каждый тот же исход своей жизни с любой длиной
 * 1…tapMax шагов — палец не нажмёт ровно на 1/60 с. Полные удержания — true.
 */
export function tapSlack(def: LevelDef, P: Physics, taps: readonly Tap[], tapMax: number): boolean[] {
  const out = taps.map(() => true);
  lives(def, P, taps).forEach((life, L) => {
    const upto = life.taps.length > 0 ? Math.max(...life.taps) + 1 : 0;
    for (const i of life.taps) {
      if (taps[i]!.hold > tapMax) continue;
      for (let len = 1; len <= tapMax; len++) {
        const changed = taps.map((t, j) => (j === i ? { at: t.at, hold: len } : t));
        if (lifeOutcome(def, P, changed, upto, L) !== life.outcome) out[i] = false;
      }
    }
  });
  return out;
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
