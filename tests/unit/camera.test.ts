import { describe, expect, it } from 'vitest';
import { DATA } from '../../src/data';
import { Camera } from '../../src/game/camera';
import { FIELD } from '../../src/game/layout';

const cols = DATA.num('grid_cols');
const lead = DATA.num('camera_lead');

describe('камера портрета', () => {
  it('в горизонтали уровень целиком — камера всегда 0', () => {
    const f = FIELD.landscape;
    for (const x of [0.5, 12, 23.5]) expect(Camera.target(x, f.cell, f.w, cols, lead)).toBe(0);
  });

  it('в портрете желейка на доле camera_lead ширины окна, края уровня не уходят в окно', () => {
    const f = FIELD.portrait;
    const worldW = cols * f.cell;
    expect(Camera.target(1.5, f.cell, f.w, cols, lead)).toBe(0);
    const x = 12;
    expect(Camera.target(x, f.cell, f.w, cols, lead)).toBeCloseTo(x * f.cell - f.w * lead, 9);
    expect(Camera.target(23.5, f.cell, f.w, cols, lead)).toBe(worldW - f.w);
  });

  it('догоняет цель долей min(1, dt · smooth) за кадр и сразу встаёт по snap', () => {
    const c = new Camera();
    const smooth = DATA.num('camera_smooth');
    c.follow(100, 1 / 60, smooth);
    expect(c.x).toBeCloseTo(100 * Math.min(1, smooth / 60), 9);
    c.follow(100, 10, smooth);
    expect(c.x).toBe(100);
    c.snap(7);
    expect(c.x).toBe(7);
  });
});
