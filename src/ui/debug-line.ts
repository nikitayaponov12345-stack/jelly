/** Отладочная строка в левом нижнем углу: версия, сборка, раскладка, кадры. Без перевода. */
export class DebugLine {
  private readonly el: HTMLDivElement;
  private last = -Infinity;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'debug-line';
    this.el.dataset.testid = 'debug-line';
    host.appendChild(this.el);
  }

  /** Обновляет текст не чаще четырёх раз в секунду. */
  update(nowMs: number, text: string): void {
    if (nowMs - this.last < 250) return;
    this.last = nowMs;
    this.el.textContent = text;
  }
}
