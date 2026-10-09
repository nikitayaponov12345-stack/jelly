import { DESIGN, fitDesign, type Layout } from '../game/layout';

/**
 * Слой вёрстки в точках дизайна: прямоугольник экрана дизайна поверх холста, как его вписал fitDesign.
 * CSS берёт масштаб из переменной --u (CSS-пикселей в точке дизайна) и раскладку из data-layout:
 * строка счёта, надписи и окна стоят на своих местах в обеих раскладках и на любом окне.
 */
export class DesignLayer {
  readonly el: HTMLDivElement;
  private key = '';

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'design-layer';
    host.appendChild(this.el);
  }

  /** Раз в кадр (дёшево, пока размеры окна те же). */
  fit(layout: Layout, width: number, height: number): void {
    const key = `${layout} ${width} ${height}`;
    if (key === this.key) return;
    this.key = key;
    const f = fitDesign(width, height, layout);
    const d = DESIGN[layout];
    const s = this.el.style;
    s.left = `${f.x}px`;
    s.top = `${f.y}px`;
    s.width = `${d.w * f.scale}px`;
    s.height = `${d.h * f.scale}px`;
    s.setProperty('--u', String(f.scale));
    this.el.dataset.layout = layout;
  }
}

/** Элемент с классом и data-testid. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, testid?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (testid) e.dataset.testid = testid;
  return e;
}

/** Текст элемента меняется, только если он другой (не трогаем DOM каждый кадр). */
export function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

/** Видимость элемента через hidden, только при изменении. */
export function setShown(e: HTMLElement, shown: boolean): void {
  if (e.hidden === shown) e.hidden = !shown;
}
