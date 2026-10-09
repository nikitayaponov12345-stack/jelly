/**
 * Камера окна поля в портрете (camTarget прототипа): желейка — на доле lead ширины окна, края уровня не уходят в окно.
 * В горизонтали уровень помещается целиком, и камера всегда 0. x — сдвиг содержимого поля в точках дизайна.
 */
export class Camera {
  x = 0;

  static target(heroX: number, cell: number, viewW: number, cols: number, lead: number): number {
    const worldW = cols * cell;
    if (worldW <= viewW) return 0;
    return Math.max(0, Math.min(worldW - viewW, heroX * cell - viewW * lead));
  }

  /** Догоняет цель: доля min(1, dt · smooth) расстояния за кадр. */
  follow(target: number, dt: number, smooth: number): void {
    this.x += (target - this.x) * Math.min(1, dt * smooth);
  }

  snap(target: number): void {
    this.x = target;
  }
}
