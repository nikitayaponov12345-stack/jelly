import type { Cell } from './grid';
import type { Physics } from './physics';

/** Живая желейка. Точка (x, y) — центр, в клетках; размер 2·half × 2·half. */
export interface Hero {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  grounded: boolean;
  /** Сколько ещё можно прыгнуть после схода с края, с. */
  coyote: number;
  /** Сколько прошло с отрыва, с (для удержания). */
  holdT: number;
  jumping: boolean;
  /** Упирается в стену в этом шаге. */
  pushing: boolean;
  /** Сколько не продвигалась правее maxX, с. */
  stuckT: number;
  maxX: number;
}

/** Нажатия, которые помнит попытка: буфер прыжка (с) и удержание. */
export interface Control {
  jumpBuf: number;
  held: boolean;
}

export type Solid = (c: number, r: number) => boolean;

export interface MoveResult {
  jumped: boolean;
  landed: boolean;
  /** Желейка лопается от стресса: stuckT > stuck_s. */
  stuck: boolean;
}

/** Разделение с клеткой после столкновения, клеток (как в прототипе). */
const SEPARATION = 0.001;

export function newHero(start: Cell, P: Physics): Hero {
  return {
    x: start.c + 0.5,
    y: start.r + 1 - P.half,
    vx: P.run,
    vy: 0,
    alive: true,
    grounded: true,
    coyote: 0,
    holdT: 0,
    jumping: false,
    pushing: false,
    stuckT: 0,
    maxX: start.c + 0.5,
  };
}

/** Перебор твёрдых клеток, которые задевает желейка, урезанная на insetX по бокам и insetY сверху и снизу. */
function overlapSolid(h: Hero, insetX: number, insetY: number, P: Physics, solid: Solid, fn: (c: number, r: number) => void): void {
  const c0 = Math.floor(h.x - P.half + insetX);
  const c1 = Math.floor(h.x + P.half - insetX);
  const r0 = Math.floor(h.y - P.half + insetY);
  const r1 = Math.floor(h.y + P.half - insetY);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(c, r)) fn(c, r);
}

/**
 * Шаг движения желейки — дословно updateHero прототипа без анимации и угроз:
 * буфер прыжка → гравитация (с удержанием) → вертикаль и опора → горизонталь и стена → койот → продвижение.
 * Границы перебора клеток считаются до поправок, поправка видна следующим клеткам того же перебора.
 */
export function moveHero(h: Hero, ctl: Control, dt: number, solid: Solid, P: Physics): MoveResult {
  let jumped = false;
  let landed = false;
  if (ctl.jumpBuf > 0) ctl.jumpBuf -= dt;
  if (ctl.jumpBuf > 0 && (h.grounded || h.coyote > 0)) {
    h.vy = -P.jumpV;
    h.grounded = false;
    h.coyote = 0;
    h.jumping = true;
    h.holdT = 0;
    ctl.jumpBuf = 0;
    jumped = true;
  }
  const g = h.jumping && ctl.held && h.holdT < P.holdMax && h.vy < 0 ? P.gravityHold : P.gravity;
  if (h.jumping) h.holdT += dt;
  h.vy = Math.min(P.vmax, h.vy + g * dt);
  // Вертикаль раньше горизонтали — чтобы приземление на край блока работало.
  const wasGrounded = h.grounded;
  h.grounded = false;
  h.y += h.vy * dt;
  overlapSolid(h, P.inset, 0, P, solid, (_c, r) => {
    if (h.vy >= 0 && h.y + P.half > r && h.y - P.half < r) {
      h.y = r - P.half - SEPARATION;
      h.vy = 0;
      h.grounded = true;
    } else if (h.vy < 0 && h.y - P.half < r + 1 && h.y + P.half > r + 1) {
      h.y = r + 1 + P.half + SEPARATION;
      h.vy = 0;
    }
  });
  // Горизонталь: бежит вправо; стена впереди (клетка, левая половина которой перед желейкой) — стоит и толкается.
  h.x += h.vx * dt;
  h.pushing = false;
  overlapSolid(h, 0, P.inset, P, solid, (c) => {
    if (h.x + P.half > c && h.x < c + 0.5) {
      h.x = c - P.half - SEPARATION;
      h.pushing = true;
    }
  });
  if (h.grounded) {
    h.coyote = P.coyote;
    h.jumping = false;
    if (!wasGrounded) landed = true;
  } else if (h.coyote > 0) h.coyote -= dt;
  if (h.x > h.maxX + P.progressEps) {
    h.maxX = h.x;
    h.stuckT = 0;
  } else h.stuckT += dt;
  return { jumped, landed, stuck: h.stuckT > P.stuck };
}
