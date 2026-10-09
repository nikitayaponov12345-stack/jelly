import { PAL } from './palette';
import type { Pen } from './pen';

/**
 * Желейка в клетках (blob прототипа): x — центр, fy — уровень ступней, sx/sy — сквош.
 * Живая — розовая, глаза и улыбка; тело — приглушённое, глаза-крестики.
 */
export function drawBlob(g: Pen, x: number, fy: number, sx: number, sy: number, frozen: boolean, lookY = 0): void {
  const w = 0.8 * sx;
  const h = 0.8 * sy;
  const x0 = x - w / 2;
  const y0 = fy - h;
  const rad = Math.min(w, h) * 0.36;
  g.roundRect(x0, y0, w, h, rad)
    .fill({ color: frozen ? PAL.frozen : PAL.hero, alpha: frozen ? 1 : 0.92 })
    .stroke({ width: 0.045, color: frozen ? PAL.frozenDark : PAL.heroDark });
  g.ellipse(x0 + w * 0.3, y0 + h * 0.24, w * 0.14, h * 0.09).fill({ color: 0xffffff, alpha: frozen ? 0.35 : 0.55 });
  const ey = y0 + h * 0.42;
  const ex = x + w * 0.08;
  for (const dx of [-0.15, 0.15]) {
    const cx = ex + (dx * w) / 0.8;
    if (frozen) {
      g.moveTo(cx - 0.06, ey - 0.06).lineTo(cx + 0.06, ey + 0.06).moveTo(cx + 0.06, ey - 0.06).lineTo(cx - 0.06, ey + 0.06);
      g.stroke({ width: 0.05, color: PAL.frozenDark, cap: 'round' });
    } else {
      g.circle(cx, ey, 0.095).fill(0xffffff);
      g.circle(cx + 0.035, ey + lookY * 0.06, 0.05).fill(PAL.ink);
    }
  }
  if (!frozen) {
    const a0 = 0.25;
    const a1 = Math.PI - 0.25;
    g.moveTo(ex + Math.cos(a0) * 0.09, ey + 0.13 + Math.sin(a0) * 0.09)
      .arc(ex, ey + 0.13, 0.09, a0, a1)
      .stroke({ width: 0.035, color: PAL.heroDark, cap: 'round' });
  }
}
