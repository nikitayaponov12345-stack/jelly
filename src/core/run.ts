import { Grid, type Cell, type Laser } from './grid';
import { beamEnd, checkHazards, laserOn as isLaserOn, laserWarn as isLaserWarn, type DeathCause } from './hazards';
import { freezeAnchor, placeBody } from './freeze';
import { moveHero, newHero, type Control, type Hero } from './hero';
import type { LevelDef } from './levels';
import { PAIRS, doorsOpen, platePressed } from './mechanisms';
import type { Physics } from './physics';
import { starsFor } from './stars';

export type RunState = 'ready' | 'play' | 'done';

export type RunEvent =
  | { type: 'start' }
  | { type: 'jump'; x: number; y: number }
  | { type: 'land'; x: number; y: number }
  | { type: 'death'; cause: DeathCause; x: number; y: number }
  | { type: 'freeze'; c: number; r: number; cause: DeathCause }
  | { type: 'respawn' }
  | { type: 'finish'; legion: number; stars: 1 | 2 | 3; time: number }
  | { type: 'restart' };

/**
 * Попытка уровня: состояния ready → play → done, команды press/release/restart, шаг, тела, легион, время.
 * Порядок внутри шага — как Proto.update прототипа: время → лучи → желейка (или пауза возрождения) → двери.
 */
export class Run {
  readonly grid: Grid;
  state: RunState = 'ready';
  hero: Hero;
  bodies: Cell[] = [];
  /** Число гибелей в попытке. */
  legion = 0;
  /** Время уровня, с: идёт только в play. */
  time = 0;
  /** Открыты ли двери пары 0, 1, 2 (P и D, Q и E, R и G). */
  doorOpen: readonly boolean[] = new Array<boolean>(PAIRS).fill(false);
  respawnT = 0;
  stars: 0 | 1 | 2 | 3 = 0;
  /** Ряд обрыва луча каждого лазера (grid.lasers) на этом шаге. */
  beamEnds: number[];
  readonly ctl: Control = { jumpBuf: 0, held: false };
  private bodyKeys = new Set<number>();
  private events: RunEvent[] = [];

  /** grid — сетка уровня def, если она уже есть (копии попытки делят одну сетку). */
  constructor(
    readonly def: LevelDef,
    readonly P: Physics,
    grid?: Grid,
  ) {
    this.grid = grid ?? new Grid(def, P.laserAltPhase);
    this.hero = newHero(this.grid.start, P);
    this.beamEnds = this.grid.lasers.map(() => this.grid.rows);
    this.updateBeams();
  }

  /** Нажатие: в ready — только старт бега (без прыжка), в play — прыжок в буфер и удержание. */
  press(): void {
    if (this.state === 'ready') {
      this.state = 'play';
      this.ctl.held = true;
      this.events.push({ type: 'start' });
      return;
    }
    if (this.state !== 'play') return;
    this.ctl.held = true;
    this.ctl.jumpBuf = this.P.jumpBuffer;
  }

  release(): void {
    this.ctl.held = false;
  }

  /** Уровень с начала: тел нет, легион 0, время 0, первая желейка ждёт на старте. */
  restart(): void {
    this.state = 'ready';
    this.hero = newHero(this.grid.start, this.P);
    this.bodies = [];
    this.bodyKeys.clear();
    this.legion = 0;
    this.time = 0;
    this.doorOpen = new Array<boolean>(PAIRS).fill(false);
    this.respawnT = 0;
    this.stars = 0;
    this.ctl.jumpBuf = 0;
    this.ctl.held = false;
    this.updateBeams();
    this.events.push({ type: 'restart' });
  }

  step(dtMs: number): void {
    if (this.state !== 'play') return;
    const dt = dtMs / 1000;
    this.time += dt;
    this.updateBeams();
    if (this.hero.alive) this.stepHero(dt);
    else {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        this.hero = newHero(this.grid.start, this.P);
        this.events.push({ type: 'respawn' });
      }
    }
    if (this.grid.plates.length > 0 || this.grid.doors.length > 0) this.doorOpen = doorsOpen(this.grid, this.hero, this.isBody, this.doorOpen, this.P);
  }

  /** Твёрдая клетка: земля, плита, закрытая дверь, тело; за краями слева и справа — стена (isSolid прототипа). */
  readonly isSolid = (c: number, r: number): boolean => {
    if (c < 0 || c >= this.grid.cols) return true;
    if (r < 0 || r >= this.grid.rows) return false;
    const t = this.grid.tile(c, r);
    // Плиты P Q R — пол; двери D E G — пар 0, 1, 2 (PLATE_CHARS и DOOR_CHARS сетки); сравнение знаков — горячий путь.
    if (t === '#' || t === 'P' || t === 'Q' || t === 'R') return true;
    if (t === 'D') return !this.doorOpen[0];
    if (t === 'E') return !this.doorOpen[1];
    if (t === 'G') return !this.doorOpen[2];
    return this.isBody(c, r);
  };

  readonly isBody = (c: number, r: number): boolean => this.bodyKeys.has(r * 1000 + c);

  laserOn(i: number): boolean {
    const l = this.grid.lasers[i];
    return l !== undefined && isLaserOn(this.time, l, this.P);
  }

  laserWarn(i: number): boolean {
    const l = this.grid.lasers[i];
    return l !== undefined && isLaserWarn(this.time, l, this.P);
  }

  platePressed(i: number): boolean {
    const p = this.grid.plates[i];
    return p !== undefined && platePressed(p, this.hero, this.isBody, this.P);
  }

  /** Копия попытки для перебора ботом: своя желейка, тела, время и нажатия, сетка общая, событий нет. */
  clone(): Run {
    const r = new Run(this.def, this.P, this.grid);
    r.state = this.state;
    r.hero = { ...this.hero };
    r.bodies = this.bodies.slice();
    r.bodyKeys = new Set(this.bodyKeys);
    r.legion = this.legion;
    r.time = this.time;
    r.doorOpen = this.doorOpen; // массив не меняется на месте: doorsOpen отдаёт новый, когда что-то сменилось
    r.respawnT = this.respawnT;
    r.stars = this.stars;
    r.beamEnds = this.beamEnds.slice();
    r.ctl.jumpBuf = this.ctl.jumpBuf;
    r.ctl.held = this.ctl.held;
    return r;
  }

  /** События шагов с прошлого вызова (для отрисовки и звука). */
  drainEvents(): RunEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private updateBeams(): void {
    this.beamEnds = this.grid.lasers.map((l) => beamEnd(l, this.isSolid, this.grid.rows));
  }

  private stepHero(dt: number): void {
    const h = this.hero;
    const m = moveHero(h, this.ctl, dt, this.isSolid, this.P);
    if (m.jumped) this.events.push({ type: 'jump', x: h.x, y: h.y });
    if (m.landed) this.events.push({ type: 'land', x: h.x, y: h.y });
    if (m.stuck) {
      this.kill('burst', null);
      return;
    }
    const hit = checkHazards(h, this.grid, this.isBody, this.time, this.beamEnds, this.P);
    if (!hit) return;
    if (hit.kind === 'flag') this.finish();
    else this.kill(hit.cause, hit.laser);
  }

  private kill(cause: DeathCause, laser: Laser | null): void {
    const h = this.hero;
    h.alive = false;
    this.respawnT = this.P.respawn;
    this.legion++;
    this.events.push({ type: 'death', cause, x: h.x, y: h.y });
    const a = freezeAnchor(cause, h, laser, this.P);
    const cell = placeBody(a.x, a.y, this.grid, this.isSolid);
    if (cell) {
      this.bodies.push(cell);
      this.bodyKeys.add(cell.r * 1000 + cell.c);
      this.events.push({ type: 'freeze', c: cell.c, r: cell.r, cause });
    }
  }

  private finish(): void {
    this.hero.alive = false;
    this.state = 'done';
    this.stars = starsFor(this.legion, this.def.par, this.P.stars2Extra);
    this.events.push({ type: 'finish', legion: this.legion, stars: this.stars, time: this.time });
  }
}
