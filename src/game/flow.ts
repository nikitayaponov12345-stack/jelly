import type { RunState } from '../core/run';

/** Итог пройденного уровня: гибели, время (с) и звёзды. */
export interface LevelResult {
  legion: number;
  time: number;
  stars: number;
}

/** Что на экране: идёт уровень, окно итога уровня или итог набора. */
export type Screen = 'level' | 'result' | 'pack';

/** Что значит нажатие одной кнопки сейчас. */
export type PressAction = 'run' | 'next' | 'from-start' | 'wait';

/**
 * Ход по набору уровней (рабочая заготовка до карты миров M1): финиш попытки открывает окно итога,
 * «Дальше» — следующий уровень, после последнего — итог набора, «Сначала» — первый уровень с чистыми итогами.
 * Окна принимают нажатия не раньше delay секунд после появления — чтобы прыжок у флага не нажал «Дальше».
 * Логика без DOM: её проверяют тесты, кнопки и клавиши только вызывают методы.
 */
export class PackFlow {
  index = 0;
  screen: Screen = 'level';
  private shown = 0;
  private readonly results: Array<LevelResult | null>;

  constructor(
    readonly count: number,
    private readonly delay: number,
  ) {
    this.results = new Array<LevelResult | null>(count).fill(null);
  }

  /** Раз в кадр: dt — время кадра, с. Финиш попытки запоминает итог уровня и открывает окно итога. */
  frame(dt: number, run: { state: RunState; legion: number; time: number; stars: number }): void {
    if (this.screen === 'level') {
      if (run.state === 'done') {
        this.results[this.index] = { legion: run.legion, time: run.time, stars: run.stars };
        this.open('result');
      }
      return;
    }
    this.shown += dt;
  }

  /** Окно принимает нажатия (на уровне — всегда). */
  get ready(): boolean {
    return this.screen === 'level' || this.shown >= this.delay;
  }

  get isLast(): boolean {
    return this.index === this.count - 1;
  }

  /** Одна кнопка: на уровне — команда попытке, в окне итога — «Дальше», в итоге набора — «Сначала». */
  press(): PressAction {
    if (this.screen === 'level') return 'run';
    if (!this.ready) return 'wait';
    return this.screen === 'result' ? 'next' : 'from-start';
  }

  /** «Дальше»: номер следующего уровня (новая попытка) или null — после последнего открыт итог набора. */
  next(): number | null {
    if (this.isLast) {
      this.open('pack');
      return null;
    }
    this.index++;
    this.screen = 'level';
    return this.index;
  }

  /** «Ещё раз» и «Заново»: тот же уровень с начала. */
  retry(): void {
    this.screen = 'level';
  }

  /** «Сначала»: итоги стёрты, первый уровень. */
  fromStart(): void {
    this.results.fill(null);
    this.index = 0;
    this.screen = 'level';
  }

  /** Уровень i с начала (отладка и тесты). */
  goTo(i: number): void {
    this.index = i;
    this.screen = 'level';
  }

  /** Итог уровня i, если он пройден. */
  result(i = this.index): LevelResult | null {
    return this.results[i] ?? null;
  }

  /** Итог набора: суммы по пройденным уровням (у каждого — последнее прохождение). */
  totals(): { legion: number; time: number; stars: number; maxStars: number; passed: number } {
    let legion = 0;
    let time = 0;
    let stars = 0;
    let passed = 0;
    for (const r of this.results) {
      if (!r) continue;
      legion += r.legion;
      time += r.time;
      stars += r.stars;
      passed++;
    }
    return { legion, time, stars, maxStars: this.count * 3, passed };
  }

  private open(screen: Screen): void {
    this.screen = screen;
    this.shown = 0;
  }
}
