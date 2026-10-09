import type { RunState } from '../core/run';
import { FIELD, designToScreen, type Layout } from '../game/layout';

/**
 * Рабочая заготовка интерфейса M0-02: кнопка «Заново» в правом верхнем углу и надпись над полем —
 * «Нажми, чтобы начать» в ready и «Уровень пройден! · Дальше» в done. Строку счёта и окно итога делает M0-03.
 */
export class PlayUi {
  private readonly msg: HTMLDivElement;
  private shown = '';

  constructor(host: HTMLElement, text: (key: string) => string, onRestart: () => void) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'restart-btn';
    btn.dataset.testid = 'restart';
    btn.textContent = '↻';
    btn.title = text('ui.restart');
    btn.setAttribute('aria-label', text('ui.restart'));
    btn.addEventListener('click', () => {
      onRestart();
      btn.blur(); // пробел после щелчка — прыжок, а не повторный щелчок по кнопке
    });
    this.msg = document.createElement('div');
    this.msg.className = 'play-msg';
    this.msg.dataset.testid = 'play-msg';
    this.msg.hidden = true;
    host.append(btn, this.msg);
    this.text = text;
  }

  private readonly text: (key: string) => string;

  /** Надпись по состоянию попытки; место — третий ряд окна поля (как подсказка в прототипе). */
  update(state: RunState, layout: Layout): void {
    const want = state === 'ready' ? this.text('ui.tap_to_start') : state === 'done' ? `${this.text('ui.level_done')} · ${this.text('ui.next')}` : '';
    const f = FIELD[layout];
    const p = designToScreen(f.x + f.w / 2, f.y + 1.6 * f.cell, window.innerWidth, window.innerHeight, layout);
    this.msg.style.left = `${p.x}px`;
    this.msg.style.top = `${p.y}px`;
    if (want === this.shown) return;
    this.shown = want;
    this.msg.textContent = want;
    this.msg.hidden = want === '';
  }
}
