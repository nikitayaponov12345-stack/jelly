import { Graphics } from 'pixi.js';

/** Единиц рисунка в клетке. PixiJS дробит дуги по их размеру в своих единицах: в клетках (радиус ~0,3) они гранёные. */
export const PEN_UNIT = 64;

type Fill = number | { color: number; alpha?: number };
type Stroke = { width: number; color: number; alpha?: number; cap?: 'butt' | 'round' | 'square' };

/**
 * Рисование в клетках: вызовы как у Graphics, но координаты и толщина линий умножаются на PEN_UNIT,
 * а сама фигура уменьшена обратно (g.scale = 1 / PEN_UNIT) — кривые гладкие при любой стороне клетки.
 */
export class Pen {
  readonly g = new Graphics();

  constructor() {
    this.g.scale.set(1 / PEN_UNIT);
  }

  clear(): this {
    this.g.clear();
    return this;
  }

  rect(x: number, y: number, w: number, h: number): this {
    this.g.rect(x * PEN_UNIT, y * PEN_UNIT, w * PEN_UNIT, h * PEN_UNIT);
    return this;
  }

  roundRect(x: number, y: number, w: number, h: number, r: number): this {
    this.g.roundRect(x * PEN_UNIT, y * PEN_UNIT, w * PEN_UNIT, h * PEN_UNIT, r * PEN_UNIT);
    return this;
  }

  circle(x: number, y: number, r: number): this {
    this.g.circle(x * PEN_UNIT, y * PEN_UNIT, r * PEN_UNIT);
    return this;
  }

  ellipse(x: number, y: number, rx: number, ry: number): this {
    this.g.ellipse(x * PEN_UNIT, y * PEN_UNIT, rx * PEN_UNIT, ry * PEN_UNIT);
    return this;
  }

  /** Многоугольник: x0, y0, x1, y1, … */
  poly(points: number[]): this {
    this.g.poly(points.map((v) => v * PEN_UNIT));
    return this;
  }

  moveTo(x: number, y: number): this {
    this.g.moveTo(x * PEN_UNIT, y * PEN_UNIT);
    return this;
  }

  lineTo(x: number, y: number): this {
    this.g.lineTo(x * PEN_UNIT, y * PEN_UNIT);
    return this;
  }

  arc(x: number, y: number, r: number, a0: number, a1: number): this {
    this.g.arc(x * PEN_UNIT, y * PEN_UNIT, r * PEN_UNIT, a0, a1);
    return this;
  }

  fill(style: Fill): this {
    this.g.fill(style);
    return this;
  }

  stroke(style: Stroke): this {
    this.g.stroke({ ...style, width: style.width * PEN_UNIT });
    return this;
  }
}
