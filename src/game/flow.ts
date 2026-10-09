import type { RunState } from '../core/run';

/**
 * Переход по уровням набора (рабочая заготовка до окна итога M0-03): после финиша нажатие
 * принимается не раньше delay секунд — чтобы прыжок, начатый у флага, не перелистнул уровень.
 */
export class LevelFlow {
  private doneFor = 0;

  constructor(private readonly delay: number) {}

  /** Раз в кадр: dt — время кадра, с. */
  frame(dt: number, state: RunState): void {
    this.doneFor = state === 'done' ? this.doneFor + dt : 0;
  }

  /** Что значит нажатие сейчас: команда попытке, следующий уровень или ничего. */
  onPress(state: RunState): 'run' | 'next' | 'wait' {
    if (state !== 'done') return 'run';
    return this.doneFor >= this.delay ? 'next' : 'wait';
  }

  reset(): void {
    this.doneFor = 0;
  }
}
