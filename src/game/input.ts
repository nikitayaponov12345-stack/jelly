/** Команды, которые подаёт кнопка. */
export interface OneButtonTarget {
  press(): void;
  release(): void;
  restart(): void;
}

/** Клавиши прыжка — по коду клавиши (e.code), поэтому работают и в русской раскладке. */
export const JUMP_KEYS: readonly string[] = ['Space', 'ArrowUp', 'KeyW'];
export const RESTART_KEY = 'KeyR';

/**
 * Одна кнопка: каждое новое касание, щелчок или нажатие клавиши прыжка — press(); release() — когда отпущены
 * все пальцы и клавиши. Автоповтор клавиши — не нажатие. R — заново. Без DOM: тесты подают события напрямую.
 */
export class OneButton {
  private readonly pointers = new Set<number>();
  private readonly keys = new Set<string>();

  constructor(private readonly target: OneButtonTarget) {}

  pointerDown(id: number): void {
    this.pointers.add(id);
    this.target.press();
  }

  pointerUp(id: number): void {
    if (!this.pointers.delete(id)) return;
    this.releaseIfIdle();
  }

  /** true — клавиша наша (браузеру не прокручивать страницу). */
  keyDown(code: string, repeat: boolean): boolean {
    if (JUMP_KEYS.includes(code)) {
      if (!repeat && !this.keys.has(code)) {
        this.keys.add(code);
        this.target.press();
      }
      return true;
    }
    if (code === RESTART_KEY) {
      if (!repeat) this.target.restart();
      return true;
    }
    return false;
  }

  keyUp(code: string): boolean {
    if (!JUMP_KEYS.includes(code)) return code === RESTART_KEY;
    if (this.keys.delete(code)) this.releaseIfIdle();
    return true;
  }

  /** Окно потеряло фокус: всё отпущено. */
  blur(): void {
    const held = this.pointers.size > 0 || this.keys.size > 0;
    this.pointers.clear();
    this.keys.clear();
    if (held) this.target.release();
  }

  private releaseIfIdle(): void {
    if (this.pointers.size === 0 && this.keys.size === 0) this.target.release();
  }
}

/** Подключает кнопку к холсту и окну: касания и мышь — по холсту (кнопки интерфейса поверх него не прыгают), клавиши — по окну. */
export function bindOneButton(canvas: HTMLCanvasElement, input: OneButton): void {
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    input.pointerDown(e.pointerId);
    e.preventDefault();
  });
  const up = (e: PointerEvent): void => input.pointerUp(e.pointerId);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  window.addEventListener('keydown', (e) => {
    if (input.keyDown(e.code, e.repeat)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (input.keyUp(e.code)) e.preventDefault();
  });
  window.addEventListener('blur', () => input.blur());
}
