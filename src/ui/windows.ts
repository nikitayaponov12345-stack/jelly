import type { LevelResult } from '../game/flow';
import { el, setShown, setText } from './design-layer';
import { formatTime } from './format';

type Text = (key: string, vars?: Readonly<Record<string, string | number>>) => string;

export interface WindowActions {
  retry(): void;
  next(): void;
  fromStart(): void;
}

function button(cls: string, testid: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', `win-btn ${cls}`, testid);
  b.type = 'button';
  b.addEventListener('click', () => {
    onClick();
    b.blur(); // пробел после щелчка — команда игре, а не повторный щелчок по кнопке
  });
  return b;
}

/**
 * Окна поверх поля: итог уровня («Уровень пройден!», звёзды, желейки и пар, время с десятыми, «Ещё раз» и
 * «Дальше» / «Итоги») и итог набора (желейки, время, звёзды из возможных, «Сначала»). Кнопки неактивны,
 * пока окно не готово принимать нажатия (done_input_delay_s). Рабочая заготовка до M3.
 */
export class Windows {
  private readonly result = el('div', 'window', 'result');
  private readonly rTitle = el('div', 'win-title');
  private readonly rStars = el('div', 'win-stars', 'stars');
  private readonly rUsed = el('div', 'win-line', 'result-used');
  private readonly rTime = el('div', 'win-line', 'result-time');
  private readonly rRetry: HTMLButtonElement;
  private readonly rNext: HTMLButtonElement;
  private readonly pack = el('div', 'window', 'pack');
  private readonly pTitle = el('div', 'win-title');
  private readonly pUsed = el('div', 'win-line', 'pack-used');
  private readonly pTime = el('div', 'win-line', 'pack-time');
  private readonly pStars = el('div', 'win-line', 'pack-stars');
  private readonly pAgain: HTMLButtonElement;
  private readonly starEls: HTMLSpanElement[] = [];

  /** decimal — разделитель десятых в языке игры («,» или «.»). */
  constructor(
    layer: HTMLElement,
    private readonly t: Text,
    private readonly decimal: string,
    actions: WindowActions,
  ) {
    for (let i = 0; i < 3; i++) {
      const s = el('span', 'star');
      s.textContent = '★';
      this.starEls.push(s);
      this.rStars.append(s);
    }
    this.rRetry = button('secondary', 'retry', () => actions.retry());
    this.rNext = button('primary', 'next', () => actions.next());
    const rButtons = el('div', 'win-buttons');
    rButtons.append(this.rRetry, this.rNext);
    this.result.append(this.rTitle, this.rStars, this.rUsed, this.rTime, rButtons);
    this.pAgain = button('primary', 'from-start', () => actions.fromStart());
    const pButtons = el('div', 'win-buttons');
    pButtons.append(this.pAgain);
    this.pack.append(this.pTitle, this.pUsed, this.pTime, this.pStars, pButtons);
    this.result.hidden = true;
    this.pack.hidden = true;
    layer.append(this.result, this.pack);
  }

  /** Окно итога уровня (r = null — спрятать). */
  showResult(r: LevelResult | null, par: number, last: boolean, ready: boolean): void {
    setShown(this.result, r !== null);
    if (!r) return;
    setText(this.rTitle, this.t('ui.level_done'));
    this.starEls.forEach((s, i) => s.classList.toggle('on', i < r.stars));
    setText(this.rUsed, this.t('ui.used', { n: r.legion, par }));
    setText(this.rTime, this.t('ui.time', { t: formatTime(r.time, true, this.decimal) }));
    setText(this.rRetry, this.t('ui.retry'));
    setText(this.rNext, this.t(last ? 'ui.results' : 'ui.next'));
    this.rRetry.disabled = !ready;
    this.rNext.disabled = !ready;
  }

  /** Итог набора (null — спрятать). */
  showPack(totals: { legion: number; time: number; stars: number; maxStars: number } | null, ready: boolean): void {
    setShown(this.pack, totals !== null);
    if (!totals) return;
    setText(this.pTitle, this.t('ui.pack_done'));
    setText(this.pUsed, this.t('ui.total_jellies', { n: totals.legion }));
    setText(this.pTime, this.t('ui.total_time', { t: formatTime(totals.time, true, this.decimal) }));
    setText(this.pStars, this.t('ui.total_stars', { n: totals.stars, max: totals.maxStars }));
    setText(this.pAgain, this.t('ui.from_start'));
    this.pAgain.disabled = !ready;
  }
}
