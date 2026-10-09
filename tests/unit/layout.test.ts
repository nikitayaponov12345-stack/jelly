import { describe, expect, it } from 'vitest';
import { DATA } from '../../src/data';
import { DESIGN, FIELD, HUD_HEIGHT, MINIMAP, designToScreen, fitDesign, layoutFor, screenToDesign } from '../../src/game/layout';

const cols = DATA.num('grid_cols');
const rows = DATA.num('grid_rows');

describe('раскладка', () => {
  it('выбирается по соотношению сторон окна', () => {
    expect(layoutFor(1280, 720)).toBe('landscape');
    expect(layoutFor(412, 915)).toBe('portrait');
    expect(layoutFor(800, 800)).toBe('landscape');
  });

  it('экран дизайна вписывается целиком и стоит по центру', () => {
    const f = fitDesign(412, 915, 'portrait');
    expect(f.scale).toBeCloseTo(412 / 720, 6);
    expect(f.x).toBeCloseTo(0, 6);
    expect(f.y).toBeCloseTo((915 - 1280 * f.scale) / 2, 6);
  });

  it('перевод точки туда и обратно', () => {
    const p = designToScreen(333, 444, 1000, 700, 'landscape');
    const back = screenToDesign(p.x, p.y, 1000, 700, 'landscape');
    expect(back.x).toBeCloseTo(333, 6);
    expect(back.y).toBeCloseTo(444, 6);
  });

  it('в горизонтали поле — весь уровень, под строкой счёта и внутри экрана', () => {
    const f = FIELD.landscape;
    expect(f.w).toBe(cols * f.cell);
    expect(f.h).toBe(rows * f.cell);
    expect(f.y).toBeGreaterThanOrEqual(HUD_HEIGHT.landscape);
    expect(f.x + f.w).toBeLessThanOrEqual(DESIGN.landscape.w);
    expect(f.y + f.h).toBeLessThanOrEqual(DESIGN.landscape.h);
  });

  it('в портрете поле — все ряды и часть столбцов, карта уровня целиком под полем', () => {
    const f = FIELD.portrait;
    expect(f.h).toBe(rows * f.cell);
    expect(f.w).toBe(DESIGN.portrait.w);
    expect(f.w / f.cell).toBeGreaterThan(12);
    expect(f.w / f.cell).toBeLessThan(cols);
    expect(MINIMAP.w).toBe(cols * MINIMAP.cell);
    expect(MINIMAP.h).toBe(rows * MINIMAP.cell);
    expect(MINIMAP.y).toBeGreaterThan(f.y + f.h);
    expect(MINIMAP.y + MINIMAP.h).toBeLessThanOrEqual(DESIGN.portrait.h);
  });
});
