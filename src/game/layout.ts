export type Layout = 'landscape' | 'portrait';

/** Размеры экрана в точках дизайна: горизонтальная и вертикальная раскладки. */
export const DESIGN: Record<Layout, { w: number; h: number }> = {
  landscape: { w: 1280, h: 720 },
  portrait: { w: 720, h: 1280 },
};

/** Прямоугольник в точках дизайна и сторона клетки уровня в нём. */
export interface FieldRect {
  x: number;
  y: number;
  w: number;
  h: number;
  cell: number;
}

/**
 * Окно поля: где рисуется сетка уровня 24 × 13. В горизонтали поле видно целиком (клетка 50),
 * в портрете — окно 720 × 728 с камерой за желейкой (клетка 56, видно около 13 столбцов).
 */
export const FIELD: Record<Layout, FieldRect> = {
  landscape: { x: 40, y: 56, w: 1200, h: 650, cell: 50 },
  portrait: { x: 0, y: 120, w: 720, h: 728, cell: 56 },
};

/** Карта всего уровня под полем в портрете (решение Никиты 09.10): клетка 30, уровень целиком. */
export const MINIMAP: FieldRect = { x: 0, y: 872, w: 720, h: 390, cell: 30 };

/** Высота строки счёта над полем, точки дизайна. */
export const HUD_HEIGHT: Record<Layout, number> = { landscape: 56, portrait: 120 };

/** Раскладку выбирает соотношение сторон окна, а не тип устройства. */
export function layoutFor(width: number, height: number): Layout {
  return width >= height ? 'landscape' : 'portrait';
}

/** Масштаб и сдвиг, чтобы экран дизайна целиком вписался в окно и стоял по центру. */
export function fitDesign(width: number, height: number, layout: Layout): { scale: number; x: number; y: number } {
  const d = DESIGN[layout];
  const scale = Math.min(width / d.w, height / d.h);
  return { scale, x: (width - d.w * scale) / 2, y: (height - d.h * scale) / 2 };
}

/** Точка дизайна в координатах окна width × height (CSS-пиксели). */
export function designToScreen(x: number, y: number, width: number, height: number, layout: Layout): { x: number; y: number } {
  const f = fitDesign(width, height, layout);
  return { x: f.x + x * f.scale, y: f.y + y * f.scale };
}

/** Обратное designToScreen: точка окна → точка дизайна. */
export function screenToDesign(sx: number, sy: number, width: number, height: number, layout: Layout): { x: number; y: number } {
  const f = fitDesign(width, height, layout);
  return { x: (sx - f.x) / f.scale, y: (sy - f.y) / f.scale };
}
