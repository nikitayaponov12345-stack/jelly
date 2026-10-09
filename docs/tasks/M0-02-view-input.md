# M0-02 — вид уровня и ввод одной кнопкой

**Цель.** Уровни видны и играются: поле с землёй, шипами, пилами, лазерами, плитами, дверями и флагом, желейка со сквошем, тела с глазами-крестиками, брызги, пыль и конфетти; в портрете — камера за желейкой и карта всего уровня под полем (решение Никиты 09.10); ввод одной кнопкой — касание, щелчок, пробел, ↑ или W, клавиша R и кнопка «Заново»; после финиша нажатие открывает следующий уровень набора. Рисунки — перенос `drawWorld`, `blob` и частиц прототипа на PixiJS 8.

**Что изменится в игре.** Вместо заглушки этапа 0 — уровень «Яма». Желейка стоит на старте и «дышит», над полем надпись «Нажми, чтобы начать». Первое нажатие — бег, следующие — прыжки (держи — выше). Погибшая желейка разлетается брызгами, экран коротко вздрагивает, на месте гибели застывает тело с глазами-крестиками; через 0,4 с со старта бежит следующая. У флага — конфетти и надпись «Уровень пройден! · Дальше»; через 0,6 с нажатие открывает следующий уровень (после шестого — снова первый). Справа вверху — кнопка «Заново» (то же — клавиша R). В портрете поле идёт за желейкой, под ним вся карта уровня с рамкой видимой части. Версия 0.0.3. Строка счёта, надпись «Уровень N — название», подсказка и окно итога — задача M0-03.

Перед началом прочитай `CLAUDE.md`, `docs/ARCHITECTURE.md` (§2, §3, §5, §9) и в `docs/GDD.md` разделы «Управление», «Экраны и интерфейс», «Арт и звук».

**Проверка до передачи.** Код ниже написан Claude и прогнан 09.10.2026 в песочнице поверх ядра M0-01: `npm run check` зелёный, Playwright — 11 сценариев и 1 пропущен намеренно (камера — только в проекте `phone`); снимки обеих раскладок просмотрены. Браузер песочницы рисовал программно, 3–4 кадра в секунду, поэтому сценарии ждут условий, а не фиксированного времени: на ноутбуке они проходят быстрее. Пробная сборка независимым исполнителем по этому тексту: около 12 минут, 17 файлов и 79 тестов Vitest, Playwright 11 passed и 1 skipped в двух прогонах подряд; по её итогам в §1.12 добавлено недостающее объявление `pauseCore`, в §3 — английские надписи, кривые рисуются через `Pen` (§1.2) — без него желейка и холмы выходили гранёными. Ядро M0-01 эта задача не меняет.

**Условие.** M0-01 сделана (в `docs/tasks/README.md` у M0-01 стоит «сделано …»). Если нет — остановись и напиши об этом в отчёте.

## 1. Файлы — дословно

Все файлы ниже переносятся как есть. `src/game/view.ts` (заглушка этапа 0) удалить — его заменяет `scene.ts`.

Как это устроено: `LevelView` рисует уровень в единицах клетки (контейнер масштабируется на сторону клетки, как `ctx.scale(cs, cs)` в прототипе): неподвижное — в `build`, шипы и тела — только когда меняются тела, остальное — каждый кадр. `Scene` держит два вида — поле и карту уровня (только в портрете), камеру, анимацию формы желейки и частицы; раз в кадр вычитывает события попытки (`run.drainEvents()`) и раздаёт их. `OneButton` — логика кнопки без DOM (её проверяют тесты), `bindOneButton` подключает её к холсту и окну. `LevelFlow` — пауза перед переходом после финиша. `Pen` — рисование в клетках с гладкими кривыми: PixiJS дробит дуги по их размеру в собственных единицах, и в клетках (радиус около 0,3) они выходят гранёными, поэтому координаты умножаются на 64, а фигура уменьшается обратно. Анимация, частицы, камера и пауза перехода идут во времени кадров: на правила они не влияют (ARCHITECTURE §5). Интерфейс — рабочая заготовка (CLAUDE.md, правило 9).

### 1.1. `src/game/palette.ts`

```ts
/**
 * Цвета прототипа: PAL и цвета, записанные прямо в drawWorld и частицах docs/research/prototype.html. Свои — только поле
 * (один цвет вместо градиента bg0 → bg1) и рамка карты уровня (цвет кнопок PAL.btn). До вехи арта (M3) — рабочая палитра.
 */
export const PAL = {
  bg: 0xf6f1ff,
  field: 0xefe6ff,
  ground: 0x3b2a55,
  grass: 0x8ee3a0,
  grassDark: 0x5fc47a,
  spike: 0xf1eff6,
  spikeEdge: 0x8e8aa3,
  laser: 0xff5050,
  laserCore: 0xff5a5a,
  laserWarn: 0xff5a5a,
  lampOff: 0x7a5c8f,
  lampWarn: 0xffb0b0,
  door: 0xff9f43,
  doorDark: 0xd97a1f,
  plate: 0xffd166,
  plateDark: 0xc99a2e,
  platePressed: 0xffe28a,
  flag: 0x58d68d,
  hero: 0xff6fae,
  heroDark: 0xd64f8f,
  heroLight: 0xffd1e6,
  frozen: 0xc99bb5,
  frozenDark: 0x9f7591,
  ink: 0x3b2a55,
  saw: 0xdcd9e6,
  sawDark: 0x6b6880,
  star: 0xffc93c,
  cloud: 0xffffff,
  hill: 0xbeaae6,
  minimapFrame: 0x7c5cff,
} as const;

export const CONFETTI = [0xff6fae, 0x7c5cff, 0x58d68d, 0xffd166, 0xff9f43, 0x6fd3ff] as const;
```

### 1.2. `src/game/pen.ts`

```ts
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
```

### 1.3. `src/game/blob.ts`

```ts
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
```

### 1.4. `src/game/level-view.ts`

```ts
import { Container } from 'pixi.js';
import type { Run } from '../core/run';
import { drawBlob } from './blob';
import type { HeroLook } from './hero-anim';
import { PAL } from './palette';
import { Pen } from './pen';

const solidTile = (t: string): boolean => t === '#' || t === 'P';

/**
 * Уровень в клетках: контейнер `root` масштабируется на сторону клетки, всё рисуется в единицах клетки
 * (как ctx.scale(cs, cs) в прототипе) через Pen. Неподвижное (земля, трава, основания плит, косяки дверей, пилы)
 * рисуется в build; шипы и тела — в sync, только когда меняются тела; плиты, двери, лучи, флаг и желейка — каждый кадр.
 */
export class LevelView {
  readonly root = new Container();
  private readonly decor = new Pen();
  private readonly back = new Pen();
  private readonly sawLayer = new Container();
  private readonly spikes = new Pen();
  private readonly dyn = new Pen();
  private readonly bodyLayer = new Pen();
  private readonly hero = new Pen();
  private saws: Pen[] = [];
  /** Сколько тел нарисовано (−1 — перерисовать) и шла ли «вспышка» последнего тела. */
  private drawnBodies = -1;
  private drawnFlash = false;

  constructor(private readonly withDecor: boolean) {
    this.root.addChild(this.decor.g, this.back.g, this.sawLayer, this.spikes.g, this.dyn.g, this.bodyLayer.g, this.hero.g);
  }

  /** Неподвижная часть уровня попытки run. */
  build(run: Run): void {
    const g = run.grid;
    this.drawnBodies = -1;
    const b = this.back.clear();
    // Земля: подряд идущие твёрдые клетки ряда — одним прямоугольником (без швов).
    for (let r = 0; r < g.rows; r++) {
      let c = 0;
      while (c < g.cols) {
        if (!solidTile(g.tile(c, r))) {
          c++;
          continue;
        }
        let c2 = c;
        while (c2 < g.cols && solidTile(g.tile(c2, r))) c2++;
        b.rect(c - 0.01, r - 0.01, c2 - c + 0.02, 1.03).fill(PAL.ground);
        c = c2;
      }
    }
    // Трава на открытых сверху участках.
    for (let r = 1; r < g.rows; r++) {
      let c = 0;
      while (c < g.cols) {
        const exposed = (cc: number): boolean => solidTile(g.tile(cc, r)) && !solidTile(g.tile(cc, r - 1));
        if (!exposed(c)) {
          c++;
          continue;
        }
        let c2 = c;
        while (c2 < g.cols && exposed(c2)) c2++;
        b.rect(c, r, c2 - c, 0.26).fill(PAL.grassDark);
        b.roundRect(c - 0.02, r - 0.06, c2 - c + 0.04, 0.24, 0.1).fill(PAL.grass);
        c = c2;
      }
    }
    for (const p of g.plates) b.rect(p.c + 0.08, p.r, 0.84, 0.34).fill(PAL.plateDark);
    for (const d of g.doors) {
      b.rect(d.c + 0.08, d.r, 0.1, 1).fill(PAL.doorDark);
      b.rect(d.c + 0.82, d.r, 0.1, 1).fill(PAL.doorDark);
    }
    // Пилы — отдельные фигуры: в sync они только вращаются.
    for (const old of this.sawLayer.removeChildren()) old.destroy();
    this.saws = g.saws.map((s) => {
      const saw = new Pen();
      const pts: number[] = [];
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        const rad = i % 2 ? 0.34 : 0.46;
        pts.push(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      saw.poly(pts).fill(PAL.saw).stroke({ width: 0.04, color: PAL.sawDark });
      saw.circle(0, 0, 0.13).fill(PAL.sawDark);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        saw.moveTo(Math.cos(a) * 0.3, Math.sin(a) * 0.3).lineTo(-Math.cos(a) * 0.3, -Math.sin(a) * 0.3);
      }
      saw.stroke({ width: 0.05, color: PAL.sawDark, alpha: 0.5 });
      saw.g.position.set(s.c + 0.5, s.r + 0.5);
      this.sawLayer.addChild(saw.g);
      return saw;
    });
  }

  /**
   * Меняющаяся часть: t — время для покачивания флага и облаков (с), doorAnim — открытость двери 0…1,
   * bodyAge(i) — сколько секунд назад застыло тело i (для «вспышки» формы), look — вид желейки.
   */
  sync(run: Run, t: number, doorAnim: number, bodyAge: (i: number) => number, look: HeroLook | null): void {
    const g = run.grid;
    if (this.withDecor) this.drawDecor(g.cols, t);
    // Тела застывают по одному, поэтому «вспыхивает» только последнее.
    const n = run.bodies.length;
    const flash = n > 0 && bodyAge(n - 1) < 0.3;
    if (n !== this.drawnBodies || flash || this.drawnFlash) {
      this.drawBodies(run, bodyAge);
      this.drawnBodies = n;
      this.drawnFlash = flash;
    }
    const d = this.dyn.clear();
    g.plates.forEach((p, i) => {
      const pressed = run.platePressed(i);
      d.roundRect(p.c + 0.05, p.r - 0.04, 0.9, pressed ? 0.18 : 0.3, 0.06).fill(pressed ? PAL.platePressed : PAL.plate);
    });
    const hgt = 1 - doorAnim;
    if (hgt > 0.02) {
      for (const dr of g.doors) {
        d.roundRect(dr.c + 0.14, dr.r, 0.72, hgt, 0.05).fill(PAL.door);
        d.rect(dr.c + 0.2, dr.r + 0.08 * hgt, 0.12, hgt * 0.85).fill({ color: 0xffffff, alpha: 0.35 });
      }
    }
    g.lasers.forEach((l, i) => {
      const on = run.laserOn(i);
      const warn = run.laserWarn(i);
      const x = l.c + 0.5;
      const y0 = l.r + 0.5;
      const y1 = run.beamEnds[i] ?? g.rows;
      if (on) {
        const fl = 1 + Math.sin(run.time * 50) * 0.12;
        d.rect(x - 0.19 * fl, y0, 0.38 * fl, y1 - y0).fill({ color: PAL.laser, alpha: 0.32 });
        d.rect(x - 0.05, y0, 0.1, y1 - y0).fill(PAL.laserCore);
        d.rect(x - 0.02, y0, 0.04, y1 - y0).fill({ color: 0xffffff, alpha: 0.8 });
        d.ellipse(x, y1, 0.3, 0.1).fill({ color: 0xff7878, alpha: 0.5 });
      } else if (warn) {
        for (let y = y0; y < y1; y += 0.26) d.moveTo(x, y).lineTo(x, Math.min(y1, y + 0.12));
        d.stroke({ width: 0.04, color: PAL.laserWarn, alpha: 0.45 });
      }
      d.roundRect(l.c + 0.18, l.r + 0.04, 0.64, 0.46, 0.1).fill(PAL.ground);
      d.circle(x, l.r + 0.44, on ? 0.14 : 0.11).fill(on ? PAL.laserCore : warn ? PAL.lampWarn : PAL.lampOff);
    });
    for (const saw of this.saws) saw.g.rotation = run.time * 5;
    // Флаг: древко и полотнище; после финиша — цвета звезды.
    const f = g.flag;
    const fx = f.c + 0.28;
    const wave = Math.sin(t * 6) * 0.06;
    d.moveTo(fx, f.r + 1).lineTo(fx, f.r + 0.02).stroke({ width: 0.08, color: PAL.ground, cap: 'round' });
    d.poly([fx, f.r + 0.04, fx + 0.68 + wave, f.r + 0.3 - wave, fx, f.r + 0.56]).fill(run.state === 'done' ? PAL.star : PAL.flag);
    const h = this.hero.clear();
    if (look) drawBlob(h, look.x, look.footY, look.sx, look.sy, false, look.lookY);
  }

  /** Шипы, которые не накрыло тело, и тела: первые 0,3 с форма тела «вспыхивает» (как в прототипе). */
  private drawBodies(run: Run, bodyAge: (i: number) => number): void {
    const g = run.grid;
    const s = this.spikes.clear();
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        if (g.tile(c, r) !== '^' || run.isBody(c, r)) continue;
        for (let k = 0; k < 3; k++) {
          const x0 = c + k / 3;
          s.poly([x0 + 0.02, r + 1, x0 + 1 / 6, r + 0.15, x0 + 1 / 3 - 0.02, r + 1]);
        }
        s.fill(PAL.spike).stroke({ width: 0.035, color: PAL.spikeEdge });
      }
    }
    const b = this.bodyLayer.clear();
    run.bodies.forEach((body, i) => {
      const age = bodyAge(i);
      const k = age < 0.3 ? 1 + (0.3 - age) * 0.9 : 1;
      drawBlob(b, body.c + 0.5, body.r + 1, k, 2 - k, true);
    });
  }

  private drawDecor(cols: number, t: number): void {
    const g = this.decor.clear();
    for (let i = 0; i < 5; i++) g.ellipse(i * 5.5 + 2, 10.4, 3.6, 1.6).fill({ color: PAL.hill, alpha: 0.28 });
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 6.3 + t * 0.12) % (cols + 6)) - 3;
      const cy = 1 + (i % 2) * 1.6;
      g.ellipse(cx, cy, 1.5, 0.5).fill({ color: PAL.cloud, alpha: 0.55 });
      g.ellipse(cx + 0.9, cy - 0.25, 0.9, 0.45).fill({ color: PAL.cloud, alpha: 0.55 });
    }
  }
}
```

### 1.5. `src/game/hero-anim.ts`

```ts
import type { Run, RunEvent } from '../core/run';

/** Что рисовать на месте желейки: центр по x, уровень ступней, сквош и взгляд — в клетках. */
export interface HeroLook {
  x: number;
  footY: number;
  sx: number;
  sy: number;
  lookY: number;
}

/**
 * Анимация формы желейки — только отрисовка, правил не меняет (формулы анимации из updateHero и drawWorld прототипа).
 * Обновляется раз в кадр по состоянию попытки и её событиям.
 */
export class HeroAnim {
  private sx = 1;
  private sy = 1;
  private lookY = 0;
  private runT = 0;
  private finishT = 0;
  private frame = 0;

  onEvent(e: RunEvent): void {
    if (e.type === 'jump') {
      this.sx = 0.8;
      this.sy = 1.25;
    } else if (e.type === 'land') {
      this.sx = 1.35;
      this.sy = 0.65;
    } else if (e.type === 'respawn' || e.type === 'restart') {
      this.sx = 1;
      this.sy = 1;
      this.lookY = 0;
      this.runT = 0;
    } else if (e.type === 'finish') this.finishT = 0;
  }

  /** dt — время кадра, с; stuckFrom — с какого stuckT желейка дрожит. Возвращает null, пока новая желейка не родилась. */
  update(run: Run, dt: number, vmax: number, stuckFrom: number): HeroLook | null {
    this.frame++;
    const h = run.hero;
    const footY = h.y + run.P.half;
    if (run.state === 'done') {
      this.finishT += dt;
      const bounce = Math.abs(Math.sin(this.finishT * 8)) * 0.35;
      return { x: h.x, footY: footY - bounce, sx: 1 - bounce * 0.3, sy: 1 + bounce * 0.4, lookY: -0.6 };
    }
    if (!h.alive) return null;
    const k = Math.min(1, dt * 14);
    this.runT += dt;
    let tsx: number;
    let tsy: number;
    if (run.state === 'ready') {
      tsx = 1;
      tsy = 1 - Math.sin(this.runT * 3) * 0.03; // дышит на старте
    } else if (h.grounded) {
      tsx = h.pushing ? 0.86 + Math.sin(this.runT * 40) * 0.03 : 1 + Math.sin(this.runT * 18) * 0.04;
      tsy = h.pushing ? 1.16 : 1 - Math.sin(this.runT * 18) * 0.04;
    } else {
      tsx = h.vy < -4 ? 0.86 : h.vy > 6 ? 0.9 : 1;
      tsy = h.vy < -4 ? 1.18 : h.vy > 6 ? 1.12 : 1;
    }
    this.sx += (tsx - this.sx) * k;
    this.sy += (tsy - this.sy) * k;
    this.lookY += ((h.grounded ? 0 : h.vy / vmax) * 0.25 - this.lookY) * Math.min(1, dt * 10);
    // Перед лопанием от стресса — дрожит.
    if (run.state === 'play' && h.stuckT > stuckFrom) {
      return { x: h.x + Math.sin(this.frame * 2.1) * 0.04, footY, sx: this.sx * 1.1, sy: this.sy * 0.95, lookY: this.lookY };
    }
    return { x: h.x, footY, sx: this.sx, sy: this.sy, lookY: this.lookY };
  }
}
```

### 1.6. `src/game/fx.ts`

```ts
import { Rng } from '../core/rng';
import { CONFETTI, PAL } from './palette';
import type { Pen } from './pen';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
  r: number;
  color: number;
  alpha: number;
  g: number;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  t: number;
  color: number;
  w: number;
  h: number;
}

/** Частицы и тряска экрана (puff, splash, confettiBurst прототипа) — в клетках. Случайность — Rng с сидом. */
export class Fx {
  private parts: Particle[] = [];
  private confetti: Confetti[] = [];
  private readonly rnd = new Rng(20251008);
  /** Остаток тряски, с. */
  shake = 0;

  clear(): void {
    this.parts = [];
    this.confetti = [];
    this.shake = 0;
  }

  /** Облачко у ступней при прыжке (n = 5) или пыль при приземлении (n = 8). */
  puff(x: number, y: number, n: number, color: number, alpha: number, spread: number, up: number): void {
    const r = (): number => this.rnd.next();
    for (let i = 0; i < n; i++) {
      this.parts.push({ x, y, vx: (r() - 0.5) * spread, vy: -r() * up, life: 0.35 + r() * 0.3, t: 0, r: 0.06 + r() * 0.08, color, alpha, g: 6 });
    }
  }

  /** Брызги при гибели и короткая тряска. */
  splash(x: number, y: number): void {
    const r = (): number => this.rnd.next();
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2;
      const sp = 2 + r() * 6;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, life: 0.5 + r() * 0.5, t: 0, r: 0.08 + r() * 0.12,
        color: r() < 0.7 ? PAL.hero : PAL.heroLight, alpha: 1, g: 22,
      });
    }
    this.shake = 0.25;
  }

  confettiBurst(x: number, y: number): void {
    const r = (): number => this.rnd.next();
    for (let i = 0; i < 70; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
      const sp = 5 + r() * 9;
      this.confetti.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: r() * 6, vr: (r() - 0.5) * 12, life: 1.6 + r(), t: 0,
        color: CONFETTI[i % CONFETTI.length]!, w: 0.12 + r() * 0.1, h: 0.08 + r() * 0.08,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const p of this.confetti) {
      p.t += dt;
      p.vy += 14 * dt;
      p.vx *= 0.98;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.confetti = this.confetti.filter((p) => p.t < p.life);
    if (this.shake > 0) this.shake -= dt;
  }

  draw(g: Pen): void {
    g.clear();
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      g.circle(p.x, p.y, p.r * (0.6 + a * 0.4)).fill({ color: p.color, alpha: a * p.alpha });
    }
    for (const p of this.confetti) {
      const c = Math.cos(p.rot);
      const s = Math.sin(p.rot);
      const hw = p.w / 2;
      const hh = p.h / 2;
      g.poly([
        p.x - hw * c + hh * s, p.y - hw * s - hh * c,
        p.x + hw * c + hh * s, p.y + hw * s - hh * c,
        p.x + hw * c - hh * s, p.y + hw * s + hh * c,
        p.x - hw * c - hh * s, p.y - hw * s + hh * c,
      ]).fill({ color: p.color, alpha: Math.min(1, (p.life - p.t) * 1.5) });
    }
  }

  get count(): number {
    return this.parts.length + this.confetti.length;
  }
}
```

### 1.7. `src/game/camera.ts`

```ts
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
```

### 1.8. `src/game/scene.ts`

```ts
import { Container, Graphics } from 'pixi.js';
import type { Physics } from '../core/physics';
import type { Run } from '../core/run';
import { Camera } from './camera';
import { Fx } from './fx';
import { HeroAnim } from './hero-anim';
import { DESIGN, FIELD, MINIMAP, type Layout } from './layout';
import { LevelView } from './level-view';
import { PAL } from './palette';
import { Pen } from './pen';

export interface SceneTuning {
  cameraLead: number;
  cameraSmooth: number;
  /** За сколько секунд до лопания от стресса желейка дрожит (stuck_warn_s). */
  stuckWarn: number;
}

/**
 * Сцена: фон, окно поля (в портрете — с камерой и маской), карта всего уровня под полем в портрете,
 * частицы и тряска. Читает попытку и её события; правил не решает.
 */
export class Scene {
  private readonly bg = new Graphics();
  private readonly fieldBox = new Container();
  private readonly fieldBg = new Graphics();
  private readonly fieldMask = new Graphics();
  private readonly main = new LevelView(true);
  private readonly fxLayer = new Pen();
  private readonly miniBox = new Container();
  private readonly miniBg = new Graphics();
  private readonly mini = new LevelView(false);
  private readonly miniFrame = new Graphics();
  private readonly anim = new HeroAnim();
  private readonly fx = new Fx();
  private bodyBorn: number[] = [];
  private doorOpenAnim = 0;
  private time = 0;
  private frame = 0;
  private layout: Layout = 'landscape';
  readonly camera = new Camera();

  constructor(
    root: Container,
    private run: Run,
    private readonly P: Physics,
    private readonly tune: SceneTuning,
  ) {
    this.main.root.addChild(this.fxLayer.g);
    this.fieldBox.addChild(this.fieldBg, this.main.root, this.fieldMask);
    this.fieldBox.mask = this.fieldMask;
    this.miniBox.addChild(this.miniBg, this.mini.root, this.miniFrame);
    root.addChild(this.bg, this.fieldBox, this.miniBox);
  }

  /** Раскладка экрана: фон, окно поля, карта уровня (только в портрете). */
  build(layout: Layout): void {
    this.layout = layout;
    const d = DESIGN[layout];
    const f = FIELD[layout];
    this.bg.clear().rect(0, 0, d.w, d.h).fill(PAL.bg);
    this.fieldBox.position.set(f.x, f.y);
    this.fieldBg.clear().rect(0, 0, f.w, f.h).fill(PAL.field);
    this.fieldMask.clear().rect(0, 0, f.w, f.h).fill(0xffffff);
    this.main.root.scale.set(f.cell);
    this.miniBox.visible = layout === 'portrait';
    this.miniBox.position.set(MINIMAP.x, MINIMAP.y);
    this.miniBg.clear().rect(0, 0, MINIMAP.w, MINIMAP.h).fill(PAL.field);
    this.mini.root.scale.set(MINIMAP.cell);
    this.setRun(this.run);
  }

  /** Новая попытка (другой уровень): неподвижная часть заново, камера — сразу к желейке. */
  setRun(run: Run): void {
    this.run = run;
    this.main.build(run);
    this.mini.build(run);
    this.bodyBorn = run.bodies.map(() => this.time - 1);
    this.doorOpenAnim = run.doorOpen ? 1 : 0;
    this.fx.clear();
    this.camera.snap(this.cameraTarget());
  }

  /** Кадр: события попытки → анимация и частицы, камера, отрисовка. dtMs — время кадра. */
  sync(dtMs: number): void {
    const run = this.run;
    const dt = dtMs / 1000;
    this.time += dt;
    this.frame++;
    for (const e of run.drainEvents()) {
      this.anim.onEvent(e);
      if (e.type === 'jump') this.fx.puff(e.x, e.y + this.P.half, 5, 0xffffff, 0.8, 2, 1.5);
      else if (e.type === 'land') this.fx.puff(e.x, e.y + this.P.half, 8, PAL.ground, 0.45, 3, 1.2);
      else if (e.type === 'death') this.fx.splash(e.x, e.y);
      else if (e.type === 'freeze') this.bodyBorn.push(this.time);
      else if (e.type === 'finish') this.fx.confettiBurst(run.grid.flag.c + 0.5, run.grid.flag.r + 0.3);
      else if (e.type === 'respawn') this.camera.snap(this.cameraTarget());
      else if (e.type === 'restart') {
        this.bodyBorn = [];
        this.fx.clear();
        this.camera.snap(this.cameraTarget());
      }
    }
    this.fx.update(dt);
    const look = this.anim.update(run, dt, this.P.vmax, this.P.stuck - this.tune.stuckWarn);
    if (run.hero.alive) this.camera.follow(this.cameraTarget(), dt, this.tune.cameraSmooth);
    const f = FIELD[this.layout];
    const sx = this.fx.shake > 0 ? Math.sin(this.frame * 1.7) * this.fx.shake * 12 : 0;
    const sy = this.fx.shake > 0 ? Math.cos(this.frame * 2.3) * this.fx.shake * 8 : 0;
    this.main.root.position.set(-this.camera.x + sx, sy);
    const age = (i: number): number => this.time - (this.bodyBorn[i] ?? this.time - 1);
    const doorAnim = this.doorAnim(dt);
    this.main.sync(run, this.time, doorAnim, age, look);
    this.fx.draw(this.fxLayer);
    if (this.layout === 'portrait') {
      this.mini.sync(run, this.time, doorAnim, age, look);
      const m = MINIMAP.cell / f.cell;
      this.miniFrame.clear().rect(this.camera.x * m, 0, f.w * m, MINIMAP.h).stroke({ width: 3, color: PAL.minimapFrame, alpha: 0.8 });
    }
  }

  /** Точка уровня (клетки) → точка дизайна с учётом камеры. */
  cellToDesign(x: number, y: number): { x: number; y: number } {
    const f = FIELD[this.layout];
    return { x: f.x + x * f.cell - this.camera.x, y: f.y + y * f.cell };
  }

  get particles(): number {
    return this.fx.count;
  }

  /** Открытость двери для рисунка 0…1: догоняет состояние попытки. */
  private doorAnim(dt: number): number {
    const target = this.run.doorOpen ? 1 : 0;
    this.doorOpenAnim += (target - this.doorOpenAnim) * Math.min(1, dt * 12);
    return this.doorOpenAnim;
  }

  private cameraTarget(): number {
    const f = FIELD[this.layout];
    return Camera.target(this.run.hero.x, f.cell, f.w, this.run.grid.cols, this.tune.cameraLead);
  }
}
```

### 1.9. `src/game/input.ts`

```ts
/** Команды, которые подаёт кнопка. */
export interface OneButtonTarget {
  press(): void;
  release(): void;
  restart(): void;
}

/** Клавиши прыжка — по коду клавиши (e.code), поэтому работают и в русской раскладке. */
export const JUMP_KEYS: readonly string[] = ['Space', 'ArrowUp', 'KeyW'];
export const RESTART_KEY = 'KeyR';

/**
 * Одна кнопка: каждое новое касание, щелчок или нажатие клавиши прыжка — press(); release() — когда отпущены
 * все пальцы и клавиши. Автоповтор клавиши — не нажатие. R — заново. Без DOM: тесты подают события напрямую.
 */
export class OneButton {
  private readonly pointers = new Set<number>();
  private readonly keys = new Set<string>();

  constructor(private readonly target: OneButtonTarget) {}

  pointerDown(id: number): void {
    this.pointers.add(id);
    this.target.press();
  }

  pointerUp(id: number): void {
    if (!this.pointers.delete(id)) return;
    this.releaseIfIdle();
  }

  /** true — клавиша наша (браузеру не прокручивать страницу). */
  keyDown(code: string, repeat: boolean): boolean {
    if (JUMP_KEYS.includes(code)) {
      if (!repeat && !this.keys.has(code)) {
        this.keys.add(code);
        this.target.press();
      }
      return true;
    }
    if (code === RESTART_KEY) {
      if (!repeat) this.target.restart();
      return true;
    }
    return false;
  }

  keyUp(code: string): boolean {
    if (!JUMP_KEYS.includes(code)) return code === RESTART_KEY;
    if (this.keys.delete(code)) this.releaseIfIdle();
    return true;
  }

  /** Окно потеряло фокус: всё отпущено. */
  blur(): void {
    const held = this.pointers.size > 0 || this.keys.size > 0;
    this.pointers.clear();
    this.keys.clear();
    if (held) this.target.release();
  }

  private releaseIfIdle(): void {
    if (this.pointers.size === 0 && this.keys.size === 0) this.target.release();
  }
}

/** Подключает кнопку к холсту и окну: касания и мышь — по холсту (кнопки интерфейса поверх него не прыгают), клавиши — по окну. */
export function bindOneButton(canvas: HTMLCanvasElement, input: OneButton): void {
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    input.pointerDown(e.pointerId);
    e.preventDefault();
  });
  const up = (e: PointerEvent): void => input.pointerUp(e.pointerId);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  window.addEventListener('keydown', (e) => {
    if (input.keyDown(e.code, e.repeat)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (input.keyUp(e.code)) e.preventDefault();
  });
  window.addEventListener('blur', () => input.blur());
}
```

### 1.10. `src/game/flow.ts`

```ts
import type { RunState } from '../core/run';

/**
 * Переход по уровням набора (рабочая заготовка до окна итога M0-03): после финиша нажатие
 * принимается не раньше delay секунд — чтобы прыжок, начатый у флага, не перелистнул уровень.
 */
export class LevelFlow {
  private doneFor = 0;

  constructor(private readonly delay: number) {}

  /** Раз в кадр: dt — время кадра, с. */
  frame(dt: number, state: RunState): void {
    this.doneFor = state === 'done' ? this.doneFor + dt : 0;
  }

  /** Что значит нажатие сейчас: команда попытке, следующий уровень или ничего. */
  onPress(state: RunState): 'run' | 'next' | 'wait' {
    if (state !== 'done') return 'run';
    return this.doneFor >= this.delay ? 'next' : 'wait';
  }

  reset(): void {
    this.doneFor = 0;
  }
}
```

### 1.11. `src/ui/play-ui.ts`

```ts
import type { RunState } from '../core/run';
import { FIELD, designToScreen, type Layout } from '../game/layout';

/**
 * Рабочая заготовка интерфейса M0-02: кнопка «Заново» в правом верхнем углу и надпись над полем —
 * «Нажми, чтобы начать» в ready и «Уровень пройден! · Дальше» в done. Строку счёта и окно итога делает M0-03.
 */
export class PlayUi {
  private readonly msg: HTMLDivElement;
  private shown = '';

  constructor(host: HTMLElement, text: (key: string) => string, onRestart: () => void) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'restart-btn';
    btn.dataset.testid = 'restart';
    btn.textContent = '↻';
    btn.title = text('ui.restart');
    btn.setAttribute('aria-label', text('ui.restart'));
    btn.addEventListener('click', () => {
      onRestart();
      btn.blur(); // пробел после щелчка — прыжок, а не повторный щелчок по кнопке
    });
    this.msg = document.createElement('div');
    this.msg.className = 'play-msg';
    this.msg.dataset.testid = 'play-msg';
    this.msg.hidden = true;
    host.append(btn, this.msg);
    this.text = text;
  }

  private readonly text: (key: string) => string;

  /** Надпись по состоянию попытки; место — третий ряд окна поля (как подсказка в прототипе). */
  update(state: RunState, layout: Layout): void {
    const want = state === 'ready' ? this.text('ui.tap_to_start') : state === 'done' ? `${this.text('ui.level_done')} · ${this.text('ui.next')}` : '';
    const f = FIELD[layout];
    const p = designToScreen(f.x + f.w / 2, f.y + 1.6 * f.cell, window.innerWidth, window.innerHeight, layout);
    this.msg.style.left = `${p.x}px`;
    this.msg.style.top = `${p.y}px`;
    if (want === this.shown) return;
    this.shown = want;
    this.msg.textContent = want;
    this.msg.hidden = want === '';
  }
}
```

### 1.12. `src/main.ts` — заменить целиком

```ts
import './debug';
import { FixedStep, STEP_MS } from './core/clock';
import { allLevels } from './core/levels';
import { physicsFrom } from './core/physics';
import { Run } from './core/run';
import { DATA } from './data';
import type { DebugState } from './debug';
import { LevelFlow } from './game/flow';
import { OneButton, bindOneButton } from './game/input';
import { designToScreen } from './game/layout';
import { Scene } from './game/scene';
import { Stage } from './game/stage';
import { StubPlatform } from './platform/stub';
import { DebugLine } from './ui/debug-line';
import { PlayUi } from './ui/play-ui';

const VERSION = '0.0.3';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
const BUILD = import.meta.env.VITE_BUILD ?? 'dev';

async function boot(): Promise<void> {
  const platform = new StubPlatform();
  await platform.init();
  const lang = platform.language() === 'ru' ? 'ru' : 'en';
  const text = (key: string): string => DATA.text(key, lang);

  const stage = new Stage();
  await stage.init(document.getElementById('game')!);

  const levels = allLevels(DATA);
  const P = physicsFrom(DATA);
  let index = 0;
  let run = new Run(levels[0]!, P);
  let gameMs = 0;
  const flow = new LevelFlow(DATA.num('done_input_delay_s'));
  const step = (dt: number): void => {
    run.step(dt);
    gameMs += dt;
  };

  const scene = new Scene(stage.root, run, P, {
    cameraLead: DATA.num('camera_lead'),
    cameraSmooth: DATA.num('camera_smooth'),
    stuckWarn: DATA.num('stuck_warn_s'),
  });
  scene.build(stage.layout);
  stage.onLayout = (layout) => scene.build(layout);

  const setLevel = (i: number): void => {
    index = i;
    run = new Run(levels[i]!, P);
    flow.reset();
    scene.setRun(run);
  };

  // Одна кнопка: в done (после паузы) — следующий уровень набора, иначе — команда попытки.
  const input = new OneButton({
    press: () => {
      const what = flow.onPress(run.state);
      if (what === 'next') setLevel((index + 1) % levels.length);
      else if (what === 'run') run.press();
    },
    release: () => run.release(),
    restart: () => run.restart(),
  });
  bindOneButton(stage.app.canvas, input);
  const ui = document.getElementById('ui')!;
  const playUi = new PlayUi(ui, text, () => run.restart());
  const line = new DebugLine(ui);
  const title = text('game.title');
  const clock = new FixedStep();
  let corePaused = false;

  stage.app.ticker.add((ticker) => {
    if (!corePaused) clock.advance(ticker.deltaMS, step);
    flow.frame(ticker.deltaMS / 1000, run.state);
    scene.sync(ticker.deltaMS);
    playUi.update(run.state, stage.layout);
    line.update(
      performance.now(),
      `${title} ${VERSION} (${BUILD}) · ${stage.layout} · ${Math.round(ticker.FPS)} к/с · ${run.def.id} · ${run.state}` +
        ` · легион ${run.legion} · ${run.time.toFixed(1)} с`,
    );
  });

  const state = (): DebugState => ({
    level: run.def.id,
    state: run.state,
    legion: run.legion,
    time: run.time,
    stars: run.stars,
    hero: { x: run.hero.x, y: run.hero.y, vx: run.hero.vx, vy: run.hero.vy, alive: run.hero.alive, grounded: run.hero.grounded },
    bodies: run.bodies.map(({ c, r }) => ({ c, r })),
    doorOpen: run.doorOpen,
    lasers: run.grid.lasers.map((_, i) => ({ on: run.laserOn(i), warn: run.laserWarn(i), end: run.beamEnds[i] ?? run.grid.rows })),
  });

  window.__game = {
    ready: true,
    version: VERSION,
    build: BUILD,
    layout: () => stage.layout,
    gameMs: () => gameMs,
    platformLog: () => platform.log.slice(),
    levels: () => levels.map((l) => l.id),
    setLevel: (id) => {
      const i = levels.findIndex((l) => l.id === id);
      if (i < 0) throw new Error(`нет уровня ${id}`);
      setLevel(i);
    },
    state,
    command: {
      press: () => run.press(),
      release: () => run.release(),
      restart: () => run.restart(),
    },
    advance: (ms) => {
      for (let i = Math.round(ms / STEP_MS); i > 0; i--) step(STEP_MS);
    },
    toScreen: (x, y) => {
      const d = scene.cellToDesign(x, y);
      return designToScreen(d.x, d.y, window.innerWidth, window.innerHeight, stage.layout);
    },
    camera: () => scene.camera.x,
    pauseCore: (on) => {
      corePaused = on;
    },
  };
  platform.loadingFinished();
}

boot().catch((err: unknown) => {
  console.error('boot failed', err);
});
```

### 1.13. `src/debug.ts` — три поля в конец интерфейса `GameDebug`, после `advance`

```ts
  /** Точка уровня (клетки) → точка окна (CSS-пиксели) с учётом раскладки и камеры. */
  toScreen(x: number, y: number): { x: number; y: number };
  /** Сдвиг камеры окна поля, точки дизайна (в горизонтали всегда 0). */
  camera(): number;
  /** Остановить (true) или продолжить шаги ядра в тикере; кадры, камера и анимация идут, advance работает. */
  pauseCore(on: boolean): void;
```

### 1.14. `index.html` — стили кнопки «Заново» и надписи над полем

Вставить перед правилом `#ui .debug-line {`:

```css
      #ui .restart-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 48px;
        height: 48px;
        border: 0;
        border-radius: 12px;
        background: #7c5cff;
        color: #fff;
        font-size: 28px;
        line-height: 48px;
        padding: 0;
      }
      #ui .play-msg {
        position: absolute;
        transform: translate(-50%, -50%);
        padding: 8px 18px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.75);
        color: #7c6a94;
        font-size: 18px;
        font-weight: 700;
        white-space: nowrap;
      }
      #ui .play-msg[hidden] {
        display: none;
      }
```

### 1.15. Версия

В `package.json` — `"version": "0.0.3"`, затем `npm install` (обновит версию в `package-lock.json`, зависимости те же).

## 2. Тесты — дословно

### 2.1. `tests/unit/camera.test.ts`

```ts
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
```

### 2.2. `tests/unit/input.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { JUMP_KEYS, OneButton, RESTART_KEY } from '../../src/game/input';

function setup(): { log: string[]; b: OneButton } {
  const log: string[] = [];
  const b = new OneButton({ press: () => log.push('press'), release: () => log.push('release'), restart: () => log.push('restart') });
  return { log, b };
}

describe('одна кнопка', () => {
  it('касание — нажатие, отпускание — release', () => {
    const { log, b } = setup();
    b.pointerDown(1);
    b.pointerUp(1);
    expect(log).toEqual(['press', 'release']);
  });

  it('второй палец — новое нажатие; release — когда отпущены все', () => {
    const { log, b } = setup();
    b.pointerDown(1);
    b.pointerDown(2);
    b.pointerUp(1);
    expect(log).toEqual(['press', 'press']);
    b.pointerUp(2);
    expect(log).toEqual(['press', 'press', 'release']);
  });

  it('клавиши прыжка по коду, автоповтор не нажатие, палец и клавиша вместе', () => {
    const { log, b } = setup();
    expect(JUMP_KEYS).toEqual(['Space', 'ArrowUp', 'KeyW']);
    expect(b.keyDown('Space', false)).toBe(true);
    expect(b.keyDown('Space', true)).toBe(true);
    b.pointerDown(1);
    expect(b.keyUp('Space')).toBe(true);
    expect(log).toEqual(['press', 'press']);
    b.pointerUp(1);
    expect(log).toEqual(['press', 'press', 'release']);
  });

  it('R — заново (без автоповтора), чужие клавиши не наши', () => {
    const { log, b } = setup();
    expect(b.keyDown(RESTART_KEY, false)).toBe(true);
    expect(b.keyDown(RESTART_KEY, true)).toBe(true);
    expect(b.keyDown('KeyQ', false)).toBe(false);
    expect(b.keyUp('KeyQ')).toBe(false);
    expect(log).toEqual(['restart']);
  });

  it('потеря фокуса отпускает всё; отпускание без нажатия ничего не шлёт', () => {
    const { log, b } = setup();
    b.pointerUp(5);
    b.keyUp('ArrowUp');
    expect(log).toEqual([]);
    b.keyDown('KeyW', false);
    b.blur();
    b.blur();
    expect(log).toEqual(['press', 'release']);
  });
});
```

### 2.3. `tests/unit/flow.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { DATA } from '../../src/data';
import { LevelFlow } from '../../src/game/flow';

describe('переход по уровням', () => {
  const delay = DATA.num('done_input_delay_s');
  it('во время попытки нажатие — команда попытке', () => {
    const f = new LevelFlow(delay);
    f.frame(5, 'play');
    expect(f.onPress('ready')).toBe('run');
    expect(f.onPress('play')).toBe('run');
  });
  it('после финиша — пауза delay, потом следующий уровень', () => {
    const f = new LevelFlow(delay);
    f.frame(delay * 0.5, 'done');
    expect(f.onPress('done')).toBe('wait');
    f.frame(delay * 0.5, 'done');
    expect(f.onPress('done')).toBe('next');
    f.reset();
    expect(f.onPress('done')).toBe('wait');
  });
  it('пауза считается заново после каждого финиша', () => {
    const f = new LevelFlow(delay);
    f.frame(delay, 'done');
    f.frame(0.016, 'play');
    f.frame(delay * 0.9, 'done');
    expect(f.onPress('done')).toBe('wait');
  });
});
```

### 2.4. `tests/e2e/play.spec.ts`

Настоящие нажатия: на ПК — пробел и клавиша R, на телефоне — касание поля и кнопки. Точку касания даёт `__game.toScreen`: клетка (12, 4) — небо над полем, при любом положении камеры она на холсте и далеко от кнопки «↻». Сценарий камеры ставит ядро на паузу (`pauseCore`), чтобы снимок не зависел от скорости браузера.

```ts
import { expect, test, type Page } from '@playwright/test';

// Ввод одной кнопкой и вид уровня в собранной игре — настоящими нажатиями (клавиатура на ПК, касания на телефоне).

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });
  return errors;
}

/** Нажатие кнопки прыжка тем способом, каким играют в этой раскладке: пробел на ПК, касание поля на телефоне. */
async function tap(page: Page, phone: boolean): Promise<void> {
  if (phone) {
    const p = await page.evaluate(() => window.__game!.toScreen(12, 4));
    await page.touchscreen.tap(p.x, p.y);
  } else await page.keyboard.press('Space');
}

test('первое нажатие — старт, следующее — прыжок', async ({ page }, info) => {
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('ready');
  await expect(page.getByTestId('play-msg')).toBeVisible();
  await tap(page, phone);
  await page.waitForFunction(() => window.__game!.state().state === 'play');
  await expect(page.getByTestId('play-msg')).toBeHidden();
  // Первое нажатие не прыгает: желейка бежит по земле.
  await page.waitForFunction(() => window.__game!.state().hero.x > 2);
  expect((await page.evaluate(() => window.__game!.state())).hero.grounded).toBe(true);
  await tap(page, phone);
  await page.waitForFunction(() => !window.__game!.state().hero.grounded, null, { timeout: 2000 });
  expect(errors).toEqual([]);
});

test('«Заново» — клавишей R и кнопкой', async ({ page }, info) => {
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  await tap(page, phone);
  await page.evaluate(() => window.__game!.advance(3000)); // первая желейка гибнет на шипах «Ямы»
  expect((await page.evaluate(() => window.__game!.state())).bodies.length).toBeGreaterThan(0);
  if (phone) await page.getByTestId('restart').tap();
  else await page.keyboard.press('KeyR');
  const s = await page.evaluate(() => window.__game!.state());
  expect(s.state).toBe('ready');
  expect(s.bodies).toEqual([]);
  expect(s.legion).toBe(0);
  await page.getByTestId('restart').click();
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('ready');
  expect(errors).toEqual([]);
});

test('«Плита»: тело на плите, финиш, переход к следующему уровню', async ({ page }, info) => {
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  await page.evaluate(() => window.__game!.setLevel('p-02'));
  await tap(page, phone);
  await page.evaluate(() => window.__game!.advance(8000));
  const s = await page.evaluate(() => window.__game!.state());
  expect(s.state).toBe('done');
  expect(s.bodies).toEqual([{ c: 12, r: 10 }]);
  await expect(page.getByTestId('play-msg')).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `build/shots/m0-02_done_${info.project.name}.png` });
  // Нажатие принимается через done_input_delay_s (0,6 с) по времени кадров, поэтому — повтор нажатия, пока не сработает
  // (сама пауза проверена в tests/unit/flow.test.ts); нажатие, которое открыло уровень, его не запускает.
  await expect
    .poll(async () => {
      await tap(page, phone);
      return page.evaluate(() => window.__game!.state().level);
    }, { timeout: 10_000 })
    .toBe('p-03');
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('ready');
  expect(errors).toEqual([]);
});

test('портрет: камера идёт за желейкой', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'камера двигается только в портрете');
  const errors = await open(page);
  expect(await page.evaluate(() => window.__game!.camera())).toBe(0);
  // Ядро на паузе: старт касанием и ровно 1,2 с игры — желейка у края ямы «Ямы» (x ≈ 6,9); кадры идут, камера догоняет.
  await page.evaluate(() => window.__game!.pauseCore(true));
  await tap(page, true);
  await page.evaluate(() => window.__game!.advance(1200));
  // Камера догнала: желейка на доле camera_lead (0,38) ширины окна поля; поле в портрете — во всю ширину экрана.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = window.__game!;
          const h = g.state().hero;
          return g.toScreen(h.x, h.y).x / window.innerWidth;
        }),
      { timeout: 10_000 },
    )
    .toBeCloseTo(0.38, 2);
  expect(await page.evaluate(() => window.__game!.camera())).toBeGreaterThan(50);
  await page.screenshot({ path: `build/shots/m0-02_camera_${info.project.name}.png` });
  expect(errors).toEqual([]);
});
```

### 2.5. `tests/e2e/smoke.spec.ts` — заменить целиком

От M0-01 три отличия: шаги ядра ждутся условием, а не окном в 1 с (в медленном headless-браузере кадры редкие); версия 0.0.3; снимок первого теста — `m0-02_*` (экран сменился, TESTPLAN §3).

```ts
import { expect, test } from '@playwright/test';

// Смоук собранной игры: страница открывается без ошибок, холст есть, раскладка верная, ядро уровня шагает.
test('игра запускается и рисует сцену', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });

  const canvas = page.locator('#game canvas');
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);

  // Ядро шагает в тикере: 0,3 с игрового времени. Без жёсткого окна в 1 с — в медленном headless-браузере кадры редкие.
  const before = await page.evaluate(() => window.__game!.gameMs());
  await page.waitForFunction((b) => window.__game!.gameMs() > b + 300, before, { timeout: 10_000 });

  const layout = await page.evaluate(() => window.__game!.layout());
  expect(layout).toBe(info.project.name === 'phone' ? 'portrait' : 'landscape');

  const calls = await page.evaluate(() => window.__game!.platformLog().map((c) => c.name));
  expect(calls).toContain('loadingFinished');

  // Сборка `npm run check` идёт без метки публикации.
  expect(await page.evaluate(() => window.__game!.build)).toBe('dev');
  // Язык страницы берётся из браузера: ru — «Желейный легион», иначе «Jelly Legion».
  await expect(page.getByTestId('debug-line')).toContainText(/(Желейный легион|Jelly Legion) 0\.0\.3/);

  await page.screenshot({ path: `build/shots/m0-02_${info.project.name}.png` });
  expect(errors).toEqual([]);
});

// Ядро в собранной игре: первая желейка ждёт нажатия; «Плита» проходится без прыжков с одной гибелью.
test('ядро уровня: старт по нажатию и «Плита» без прыжков', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });

  expect(await page.evaluate(() => window.__game!.levels())).toEqual(['p-01', 'p-02', 'p-03', 'p-04', 'p-05', 'p-06']);
  const s0 = await page.evaluate(() => window.__game!.state());
  expect(s0.level).toBe('p-01');
  expect(s0.state).toBe('ready');
  await page.evaluate(() => window.__game!.advance(1000));
  expect(await page.evaluate(() => window.__game!.state().hero.x)).toBe(1.5); // ждёт на старте

  const s1 = await page.evaluate(() => {
    const g = window.__game!;
    g.setLevel('p-02');
    g.command.press();
    g.command.release();
    g.advance(8000);
    return g.state();
  });
  expect(s1.state).toBe('done');
  expect(s1.legion).toBe(1);
  expect(s1.stars).toBe(3);
  expect(s1.bodies).toEqual([{ c: 12, r: 10 }]);
  expect(s1.time).toBeCloseTo(7.7333, 3);
  expect(errors).toEqual([]);
});
```

## 3. Снимки — посмотреть глазами
Язык надписей — язык браузера: у Playwright по умолчанию английский, поэтому на снимках «Tap to start» и «Level complete! · Next» (по-русски — «Нажми, чтобы начать» и «Уровень пройден! · Дальше»). Кривые гладкие, без граней.
- `build/shots/m0-02_desktop.png` — «Яма» целиком: сиреневое небо с облаками и холмами, тёмная земля с зелёной травой, между краями — яма с серыми шипами на дне, розовая желейка с глазами на старте слева, зелёный флаг справа, вверху надпись «Tap to start», справа вверху фиолетовая кнопка «↻».
- `build/shots/m0-02_done_desktop.png` — «Плита» после финиша: в узкой ямке на плите — тело с глазами-крестиками, над ним корпус лазера, дверь открыта (видны только оранжевые косяки под тёмной стеной), желейка у жёлтого флага, конфетти, надпись «Level complete! · Next».
- `build/shots/m0-02_phone.png` — «Яма» в портрете: вверху окно поля с началом уровня (желейка на старте, край ямы с шипами справа), под ним вся карта уровня мелко, фиолетовая рамка видимой части — слева; «Tap to start», кнопка «↻» — над полем справа.
- `build/shots/m0-02_done_phone.png` — «Плита» в портрете: окно поля у правого края уровня — тело на плите, открытая дверь, желейка у флага, конфетти; рамка на карте — справа.
- `build/shots/m0-02_camera_phone.png` — «Яма»: желейка у края ямы примерно на трети ширины экрана (0,38), справа — яма с шипами; рамка на карте сдвинута вправо от левого края.

## 4. Сборка по ссылке — без отправки
`npm run publish -- --dry-run` — ожидается строка `publish: Желейный легион 0.0.3 (<хеш>+), файлов N, адрес https://github.com/nikitayaponov12345-stack/jelly-play.git — push не делался` («+» — правки ещё не закоммичены). Отправляет сборку Никита сам.

## 5. Критерии готовности
- Файлы §1 и тесты §2 — дословно (§1.13 — три поля `toScreen`, `camera`, `pauseCore`); `src/game/view.ts` удалён.
- `npm run check` зелёный: Vitest — все прежние файлы и три новых; сборка до 3 МБ; Playwright — 11 passed, 1 skipped (камера — только `phone`).
- Снимки §3 соответствуют описанию.
- `npm run publish -- --dry-run` — строка §4.
- В `docs/tasks/README.md` — строка M0-02 «сделано ДД.ММ».

## Если что-то не так
- Если снимок не совпадает с описанием — приложи его и опиши, что видно; код рисования не перерисовывай на свой вкус (вид — рабочая заготовка до M3).
- Если падает сценарий Playwright — приложи текст ошибки и папку `test-results\`; ожидания в сценариях не удлиняй и проверки не ослабляй без отчёта.

## Отчёт
Что сделано; итоговые строки `npm run check`; что видно на снимках §3; строка `publish --dry-run`; что не получилось и почему.
