/** Кнопка «Заново» справа в строке счёта (слой дизайна); размер в CSS-пикселях — на телефоне не меньше 48 × 48. */
export class RestartButton {
  private readonly btn: HTMLButtonElement;

  constructor(host: HTMLElement, label: string, onRestart: () => void) {
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'restart-btn';
    this.btn.dataset.testid = 'restart';
    this.btn.textContent = '↻';
    this.btn.title = label;
    this.btn.setAttribute('aria-label', label);
    this.btn.addEventListener('click', () => {
      onRestart();
      this.btn.blur(); // пробел после щелчка — прыжок, а не повторный щелчок по кнопке
    });
    host.append(this.btn);
  }

  /** В итоге набора кнопки нет: начинать там нечего. */
  setShown(shown: boolean): void {
    if (this.btn.hidden === shown) this.btn.hidden = !shown;
  }
}
