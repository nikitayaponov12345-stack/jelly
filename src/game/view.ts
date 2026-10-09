import { Container, Graphics } from 'pixi.js';
import { DESIGN, FIELD, MINIMAP, type Layout } from './layout';

/**
 * Заглушка этапа 0: фон, окно поля, полоса земли и желейка, прыгающая на месте по игровому времени.
 * M0-01 заменяет её видом уровня.
 */
export class StubView {
  private readonly layer = new Container();
  private readonly jelly = new Graphics();
  private layout: Layout = 'landscape';

  constructor(root: Container) {
    root.addChild(this.layer);
  }

  build(layout: Layout): void {
    this.layout = layout;
    this.layer.removeChildren();
    const d = DESIGN[layout];
    const f = FIELD[layout];
    const g = new Graphics();
    g.rect(0, 0, d.w, d.h).fill(0xf6f1ff);
    g.rect(f.x, f.y, f.w, f.h).fill(0xe9ddff);
    // Земля — три нижних ряда поля, сверху полоска травы.
    const ground = f.y + f.h - 3 * f.cell;
    g.rect(f.x, ground, f.w, 3 * f.cell).fill(0x3b2a55);
    g.rect(f.x, ground - 6, f.w, 12).fill(0x8ee3a0);
    if (layout === 'portrait') g.rect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h).fill(0xded3f5);
    this.layer.addChild(g, this.jelly);
  }

  sync(gameMs: number): void {
    const f = FIELD[this.layout];
    const size = f.cell * 0.8;
    const ground = f.y + f.h - 3 * f.cell;
    const phase = ((gameMs / 1000) % 0.8) / 0.8; // прыжок раз в 0,8 с
    const lift = 2.4 * f.cell * 4 * phase * (1 - phase);
    const x = f.x + 2 * f.cell;
    this.jelly.clear().roundRect(x, ground - size - lift, size, size, size * 0.36).fill(0xff6fae);
  }
}
