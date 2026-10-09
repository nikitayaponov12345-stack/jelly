# M1-01 — парные плиты и двери

**Цель.** Цвет связывает плиту со своей дверью (GDD «Элементы уровня», строка «Парные плиты и двери»): к паре `P` и `D` (пара 0) добавляются `Q` и `E` (пара 1, голубые) и `R` и `G` (пара 2, фиолетовые). Дверь открыта, пока нажата хоть одна плита её пары; открытая дверь не закрывается, пока в ней живая желейка (правка M0 — теперь по парам). В M0 все плиты уровня открывали все двери; на уровнях прототипа одна пара, `P` и `D`, поэтому там ничего не меняется. Уровни с новыми знаками придут в M1-02.

**Что изменится в игре.** На уровнях прототипа — ничего, кроме версии 0.0.7. Знаки `Q`, `E`, `R`, `G` принимают `npm run data`, ядро и вид: плиты и двери пары 1 — голубые, пары 2 — фиолетовые, у пары 0 — прежние жёлтая плита и оранжевая дверь. Ещё одна мелочь — не в игре, а в проверке: смоук Playwright поднимает предпросмотр сборки на своём порту 4273 вместо 4173 (§1.13).

Перед началом прочитай `CLAUDE.md`, `data/README.md` (знаки карты), `docs/ARCHITECTURE.md` (§2) и в `docs/GDD.md` раздел «Элементы уровня». Документы уже описывают итог всей пачки 4, в том числе мир 1 из M1-02 (`data/levels/w1.txt`, строки мира 1): это не ошибка, мир 1 придёт следующей задачей.

**Проверка до передачи.** Код ниже написан Claude и прогнан 09.10.2026 в песочнице поверх M0-05 (состояние ноутбука после коммита `efb5bf7`): `npm run check` зелёный — Vitest 22 файла, 118 тестов, Playwright — 15 passed, 1 skipped; `npm run solve` — те же пар и решения, что после M0-05, `data/solutions/proto.json` не меняется. Двери стали массивом по парам, а проверка твёрдой клетки — самое частое действие бота-решателя, поэтому `isSolid` сравнивает знаки напрямую, `doorsOpen` не создаёт новый массив, когда ничего не поменялось, а на уровнях без плит и дверей не зовётся вовсе. На уровнях без плит бот работает как прежде, на уровнях с плитами — примерно на 10 % медленнее («Всё вместе» — около 64 с вместо 59 в песочнице; замер по очереди, по два прогона). Из 14 намеренных поломок пар (какая плита какую дверь открывает, желейка в двери, твёрдость плит и дверей, «Заново», копия попытки для бота, знаки и разбор карты) тесты ловят 13; не ловят одну — двери пар 1 и 2 в ключе склейки веток бота: на всех 21 уровне вместе с миром 1 она не меняет ни перебора, ни решений, потому что состояние двери почти всегда следует из положения желейки и тел. Пробная сборка независимым исполнителем по этому тексту (09.10, около 15 минут на саму задачу): все файлы совпали с эталоном байт в байт, `npm run check` зелёный, `npm run solve` — как в §4. По её итогам пара 2 стала фиолетовой, а не зелёной (зелёная плита сливалась с травой), у смоука появился свой порт (§1.13), а про скорость бота написано измеренное число.

**Условие.** M0-05 сделана (в `docs/tasks/README.md` у M0-05 стоит «сделано …»). Если нет — остановись и напиши об этом в отчёте.

## 1. Файлы

Как это устроено. Сетка помнит у каждой плиты и двери номер пары (`PairCell.pair`): знаки плит — `PLATE_CHARS = 'PQR'`, дверей — `DOOR_CHARS = 'DEG'`; плита `PLATE_CHARS[k]` открывает двери `DOOR_CHARS[k]`. `Run.doorOpen` — открыты ли двери каждой пары, массив из `PAIRS` = 3. Массив не меняется на месте: `doorsOpen` отдаёт новый, когда что-то сменилось, поэтому копия попытки для бота может делить его с оригиналом. Ключ склейки веток бота берёт двери всех пар битами. Вид рисует плиты и двери цветом их пары (`PAIR_COLORS`), открытость дверей анимируется по парам. `npm run data` проверяет пары: есть дверь пары — должна быть и плита этой пары, и наоборот.

Файлы §1.1, 1.2, 1.7 и 1.8 — дословно целиком. В остальных — правки «было → стало»: блок «было» встречается в файле ровно один раз, его надо заменить блоком «стало», остальное в файле не трогать.

### 1.1. `src/core/grid.ts` — заменить целиком

```ts
import type { LevelDef } from './levels';

export interface Cell {
  c: number;
  r: number;
}

/** Плита или дверь и номер её пары: 0 — `P` и `D`, 1 — `Q` и `E`, 2 — `R` и `G` (GDD «Элементы уровня»). */
export interface PairCell extends Cell {
  pair: number;
}

/** Знаки плит и дверей по парам: плита PLATE_CHARS[k] открывает двери DOOR_CHARS[k]. */
export const PLATE_CHARS = 'PQR';
export const DOOR_CHARS = 'DEG';

export interface Laser extends Cell {
  /** Сдвиг цикла, с: `L` — 0, `l` — laser_alt_phase_s. */
  phase: number;
}

/**
 * Неподвижная часть уровня: клетки земли, шипов, плит и дверей и места элементов.
 * Как в прототипе (parseLevel): знаки @ F S L l в сетке клеток становятся воздухом, плиты и двери остаются.
 */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly start: Cell;
  readonly flag: Cell;
  readonly saws: readonly Cell[];
  readonly lasers: readonly Laser[];
  readonly plates: readonly PairCell[];
  readonly doors: readonly PairCell[];
  private readonly tiles: string[][];

  constructor(def: LevelDef, laserAltPhase: number) {
    this.rows = def.map.length;
    this.cols = def.map[0]?.length ?? 0;
    const saws: Cell[] = [];
    const lasers: Laser[] = [];
    const plates: PairCell[] = [];
    const doors: PairCell[] = [];
    let start: Cell = { c: 0, r: 0 };
    let flag: Cell = { c: 0, r: 0 };
    this.tiles = def.map.map((row, r) =>
      [...row].map((ch, c) => {
        if (ch === 'L' || ch === 'l') lasers.push({ c, r, phase: ch === 'l' ? laserAltPhase : 0 });
        else if (ch === 'S') saws.push({ c, r });
        else if (PLATE_CHARS.includes(ch)) plates.push({ c, r, pair: PLATE_CHARS.indexOf(ch) });
        else if (DOOR_CHARS.includes(ch)) doors.push({ c, r, pair: DOOR_CHARS.indexOf(ch) });
        else if (ch === '@') start = { c, r };
        else if (ch === 'F') flag = { c, r };
        return ch === 'L' || ch === 'l' || ch === 'S' || ch === '@' || ch === 'F' ? '.' : ch;
      }),
    );
    this.start = start;
    this.flag = flag;
    this.saws = saws;
    this.lasers = lasers;
    this.plates = plates;
    this.doors = doors;
  }

  /** Знак клетки: '#', '.', '^', плита (P Q R) или дверь (D E G). За левым и правым краем — '#', выше и ниже поля — '.'. */
  tile(c: number, r: number): string {
    if (c < 0 || c >= this.cols) return '#';
    if (r < 0 || r >= this.rows) return '.';
    return this.tiles[r]?.[c] ?? '.';
  }

  isStart(c: number, r: number): boolean {
    return c === this.start.c && r === this.start.r;
  }

  isFlag(c: number, r: number): boolean {
    return c === this.flag.c && r === this.flag.r;
  }

  isSaw(c: number, r: number): boolean {
    return this.saws.some((s) => s.c === c && s.r === r);
  }

  isEmitter(c: number, r: number): boolean {
    return this.lasers.some((l) => l.c === c && l.r === r);
  }

  isDoor(c: number, r: number): boolean {
    return DOOR_CHARS.includes(this.tile(c, r));
  }
}
```

### 1.2. `src/core/mechanisms.ts` — заменить целиком

```ts
import type { Cell, Grid } from './grid';
import type { Hero } from './hero';
import type { Physics } from './physics';

/** Плита нажата: тело в клетке прямо над ней или живая желейка стоит на ней (platePressed прототипа). */
export function platePressed(p: Cell, h: Hero, isBody: (c: number, r: number) => boolean, P: Physics): boolean {
  if (isBody(p.c, p.r - 1)) return true;
  if (!h.alive || !h.grounded) return false;
  return Math.abs(h.y + P.half - p.r) < P.plateEps && h.x + P.half > p.c + P.plateEdge && h.x - P.half < p.c + 1 - P.plateEdge;
}

/** Пар плит и дверей на уровне, не больше (GDD «Элементы уровня»). */
export const PAIRS = 3;

/** Живая желейка задевает клетку какой-нибудь двери пары pair. */
export function heroInDoor(h: Hero, grid: Grid, pair: number, P: Physics): boolean {
  if (!h.alive) return false;
  return grid.doors.some((d) => d.pair === pair && h.x + P.half > d.c && h.x - P.half < d.c + 1 && h.y + P.half > d.r && h.y - P.half < d.r + 1);
}

/**
 * Двери пары открыты, пока нажата хоть одна плита этой пары: цвет связывает плиту со своей дверью (GDD «Элементы
 * уровня», M1-01; в M0 пара была одна — P и D). Правка M0 (GDD «Застывание»): открытая дверь не закрывается, пока
 * в ней живая желейка. wasOpen и ответ — по парам 0…PAIRS−1; ничего не поменялось — ответ тот же массив wasOpen.
 */
export function doorsOpen(grid: Grid, h: Hero, isBody: (c: number, r: number) => boolean, wasOpen: readonly boolean[], P: Physics): readonly boolean[] {
  let pressed = 0; // нажатые пары — битами: один проход по плитам на шаг
  for (const p of grid.plates) if ((pressed & (1 << p.pair)) === 0 && platePressed(p, h, isBody, P)) pressed |= 1 << p.pair;
  let open: boolean[] | null = null;
  for (let k = 0; k < PAIRS; k++) {
    const was = wasOpen[k] === true;
    const now = (pressed & (1 << k)) !== 0 || (was && heroInDoor(h, grid, k, P));
    if (now === was) continue;
    open ??= Array.from({ length: PAIRS }, (_, i) => wasOpen[i] === true);
    open[k] = now;
  }
  return open ?? wasOpen;
}
```

### 1.3. `src/core/run.ts` — 6 правок

Двери — по парам: поле `doorOpen`, «Заново», шаг, твёрдая клетка, копия попытки.

Правка 1. Было:

```ts
import type { LevelDef } from './levels';
import { doorsOpen, platePressed } from './mechanisms';
import type { Physics } from './physics';
```

Стало:

```ts
import type { LevelDef } from './levels';
import { PAIRS, doorsOpen, platePressed } from './mechanisms';
import type { Physics } from './physics';
```

Правка 2. Было:

```ts
  time = 0;
  doorOpen = false;
  respawnT = 0;
```

Стало:

```ts
  time = 0;
  /** Открыты ли двери пары 0, 1, 2 (P и D, Q и E, R и G). */
  doorOpen: readonly boolean[] = new Array<boolean>(PAIRS).fill(false);
  respawnT = 0;
```

Правка 3. Было:

```ts
    this.time = 0;
    this.doorOpen = false;
    this.respawnT = 0;
```

Стало:

```ts
    this.time = 0;
    this.doorOpen = new Array<boolean>(PAIRS).fill(false);
    this.respawnT = 0;
```

Правка 4. Было:

```ts
    }
    this.doorOpen = doorsOpen(this.grid, this.hero, this.isBody, this.doorOpen, this.P);
  }
```

Стало:

```ts
    }
    if (this.grid.plates.length > 0 || this.grid.doors.length > 0) this.doorOpen = doorsOpen(this.grid, this.hero, this.isBody, this.doorOpen, this.P);
  }
```

Правка 5. Было:

```ts
    const t = this.grid.tile(c, r);
    if (t === '#' || t === 'P') return true;
    if (t === 'D') return !this.doorOpen;
    return this.isBody(c, r);
```

Стало:

```ts
    const t = this.grid.tile(c, r);
    // Плиты P Q R — пол; двери D E G — пар 0, 1, 2 (PLATE_CHARS и DOOR_CHARS сетки); сравнение знаков — горячий путь.
    if (t === '#' || t === 'P' || t === 'Q' || t === 'R') return true;
    if (t === 'D') return !this.doorOpen[0];
    if (t === 'E') return !this.doorOpen[1];
    if (t === 'G') return !this.doorOpen[2];
    return this.isBody(c, r);
```

Правка 6. Было:

```ts
    r.time = this.time;
    r.doorOpen = this.doorOpen;
    r.respawnT = this.respawnT;
```

Стало:

```ts
    r.time = this.time;
    r.doorOpen = this.doorOpen; // массив не меняется на месте: doorsOpen отдаёт новый, когда что-то сменилось
    r.respawnT = this.respawnT;
```

### 1.4. `src/core/levels.ts` — знаки карты

Было:

```ts
/** Знаки карты (data/README.md). */
export const TILE_CHARS = '#.@F^SLlPD';
```

Стало:

```ts
/** Знаки карты (data/README.md). */
export const TILE_CHARS = '#.@F^SLlPDQERG';
```

### 1.5. `src/core/solver/solve.ts` — ключ склейки веток

Было:

```ts
    left,
    b.run.doorOpen ? 1 : 0,
  ].join(' ');
```

Стало:

```ts
    left,
    (b.run.doorOpen[0] ? 1 : 0) | (b.run.doorOpen[1] ? 2 : 0) | (b.run.doorOpen[2] ? 4 : 0),
  ].join(' ');
```

### 1.6. `src/game/palette.ts` — в конец файла

После списка `CONFETTI` — пустая строка и:

```ts
/**
 * Цвета пар плит и дверей (M1-01): пара 0 (P и D) — цвета прототипа, 1 (Q и E) — голубая, 2 (R и G) — фиолетовая
 * (не зелёная: зелёная плита сливалась с травой и флагом).
 */
export const PAIR_COLORS = [
  { door: PAL.door, doorDark: PAL.doorDark, plate: PAL.plate, plateDark: PAL.plateDark, platePressed: PAL.platePressed },
  { door: 0x5aa9ff, doorDark: 0x2f7fd6, plate: 0x8cc8ff, plateDark: 0x4a8fd1, platePressed: 0xc2e2ff },
  { door: 0xa66bff, doorDark: 0x7a45d6, plate: 0xc9a6ff, plateDark: 0x8f63db, platePressed: 0xe2d1ff },
] as const;
```

### 1.7. `src/game/level-view.ts` — заменить целиком

```ts
import { Container } from 'pixi.js';
import { PLATE_CHARS } from '../core/grid';
import type { Run } from '../core/run';
import { drawBlob } from './blob';
import type { HeroLook } from './hero-anim';
import { PAIR_COLORS, PAL } from './palette';
import { Pen } from './pen';

const solidTile = (t: string): boolean => t === '#' || PLATE_CHARS.includes(t);

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
    for (const p of g.plates) b.rect(p.c + 0.08, p.r, 0.84, 0.34).fill(PAIR_COLORS[p.pair]!.plateDark);
    for (const d of g.doors) {
      const dark = PAIR_COLORS[d.pair]!.doorDark;
      b.rect(d.c + 0.08, d.r, 0.1, 1).fill(dark);
      b.rect(d.c + 0.82, d.r, 0.1, 1).fill(dark);
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
   * Меняющаяся часть: t — время для покачивания флага и облаков (с), doorAnim — открытость дверей каждой пары 0…1,
   * bodyAge(i) — сколько секунд назад застыло тело i (для «вспышки» формы), look — вид желейки.
   */
  sync(run: Run, t: number, doorAnim: readonly number[], bodyAge: (i: number) => number, look: HeroLook | null): void {
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
      const col = PAIR_COLORS[p.pair]!;
      d.roundRect(p.c + 0.05, p.r - 0.04, 0.9, pressed ? 0.18 : 0.3, 0.06).fill(pressed ? col.platePressed : col.plate);
    });
    for (const dr of g.doors) {
      const hgt = 1 - (doorAnim[dr.pair] ?? 0);
      if (hgt <= 0.02) continue;
      d.roundRect(dr.c + 0.14, dr.r, 0.72, hgt, 0.05).fill(PAIR_COLORS[dr.pair]!.door);
      d.rect(dr.c + 0.2, dr.r + 0.08 * hgt, 0.12, hgt * 0.85).fill({ color: 0xffffff, alpha: 0.35 });
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

### 1.8. `src/game/scene.ts` — заменить целиком

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
  private doorOpenAnim: number[] = [];
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
    this.doorOpenAnim = run.doorOpen.map((open) => (open ? 1 : 0));
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

  /** Открытость дверей каждой пары для рисунка 0…1: догоняет состояние попытки. */
  private doorAnim(dt: number): number[] {
    const k = Math.min(1, dt * 12);
    this.doorOpenAnim = this.run.doorOpen.map((open, i) => {
      const a = this.doorOpenAnim[i] ?? 0;
      return a + ((open ? 1 : 0) - a) * k;
    });
    return this.doorOpenAnim;
  }

  private cameraTarget(): number {
    const f = FIELD[this.layout];
    return Camera.target(this.run.hero.x, f.cell, f.w, this.run.grid.cols, this.tune.cameraLead);
  }
}
```

### 1.9. `src/debug.ts` — поле `doorOpen` по парам

Было:

```ts
  bodies: Array<{ c: number; r: number }>;
  doorOpen: boolean;
  lasers: Array<{ on: boolean; warn: boolean; end: number }>;
```

Стало:

```ts
  bodies: Array<{ c: number; r: number }>;
  /** Открыты ли двери пары 0, 1, 2 (P и D, Q и E, R и G). */
  doorOpen: boolean[];
  lasers: Array<{ on: boolean; warn: boolean; end: number }>;
```

### 1.10. `src/main.ts` — 2 правки: версия и `doorOpen` в отладке

Правка 1. Было:

```ts
const VERSION = '0.0.6';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
```

Стало:

```ts
const VERSION = '0.0.7';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
```

Правка 2. Было:

```ts
    bodies: run.bodies.map(({ c, r }) => ({ c, r })),
    doorOpen: run.doorOpen,
    lasers: run.grid.lasers.map((_, i) => ({ on: run.laserOn(i), warn: run.laserWarn(i), end: run.beamEnds[i] ?? run.grid.rows })),
```

Стало:

```ts
    bodies: run.bodies.map(({ c, r }) => ({ c, r })),
    doorOpen: run.doorOpen.slice(),
    lasers: run.grid.lasers.map((_, i) => ({ on: run.laserOn(i), warn: run.laserWarn(i), end: run.beamEnds[i] ?? run.grid.rows })),
```

### 1.11. `tools/data-check.mjs` — 2 правки

Правка 1. Было:

```js
// --- уровни ---
const TILES = new Set(['#', '.', '@', 'F', '^', 'S', 'L', 'l', 'P', 'D']);
const levelIds = new Set();
```

Стало:

```js
// --- уровни ---
const TILES = new Set(['#', '.', '@', 'F', '^', 'S', 'L', 'l', 'P', 'D', 'Q', 'E', 'R', 'G']);
// Пары плит и дверей (M1-01): плита PLATES[k] открывает двери DOORS[k].
const PLATES = ['P', 'Q', 'R'];
const DOORS = ['D', 'E', 'G'];
const levelIds = new Set();
```

Правка 2. Было:

```js
    const below = sr + 1 < ROWS ? lv.map[sr + 1][sc] : undefined;
    if (below !== '#' && below !== 'P') err(`${at}: под стартом ${lv.id} нет земли или плиты`);
  }
  if ((count.D ?? 0) > 0 && !(count.P > 0)) err(`${at}: в ${lv.id} есть дверь D, но нет плиты P`);
  if ((count.P ?? 0) > 0 && !(count.D > 0)) err(`${at}: в ${lv.id} есть плита P, но нет двери D`);
  needText(`level.${lv.id}.name`, at);
```

Стало:

```js
    const below = sr + 1 < ROWS ? lv.map[sr + 1][sc] : undefined;
    if (below !== '#' && !PLATES.includes(below)) err(`${at}: под стартом ${lv.id} нет земли или плиты`);
  }
  PLATES.forEach((p, k) => {
    const d = DOORS[k];
    if ((count[d] ?? 0) > 0 && !(count[p] > 0)) err(`${at}: в ${lv.id} есть дверь ${d}, но нет плиты ${p}`);
    if ((count[p] ?? 0) > 0 && !(count[d] > 0)) err(`${at}: в ${lv.id} есть плита ${p}, но нет двери ${d}`);
  });
  needText(`level.${lv.id}.name`, at);
```

### 1.12. Версия

В `package.json` — `"version": "0.0.7"`, затем `npm install` (обновит версию в `package-lock.json`, зависимости те же).

### 1.13. Порт предпросмотра для смоука — `package.json` и `playwright.config.ts`

Смоук берёт сервер, который уже отвечает по адресу (`reuseExistingServer: true`). На 4173 — порту Vite по умолчанию — может отвечать предпросмотр другого проекта, и тогда смоук молча проверит чужую сборку: так случилось в пробной сборке этой задачи, где рядом шла другая проверка. У «Желейного легиона» порт свой — 4273.

В `package.json` строку скрипта `preview`:

```json
    "preview": "vite preview --host --port 4173 --strictPort",
```

заменить на:

```json
    "preview": "vite preview --host --port 4273 --strictPort",
```

`playwright.config.ts` — 3 правки:

Правка 1. Было:

```ts
// PW_CHROMIUM — путь к своему Chromium, если браузер Playwright не скачан (на ноутбуке не нужен).
const executablePath = process.env.PW_CHROMIUM || undefined;
```

Стало:

```ts
// PW_CHROMIUM — путь к своему Chromium, если браузер Playwright не скачан (на ноутбуке не нужен).
// Порт предпросмотра — 4273, а не 4173 по умолчанию Vite: на 4173 может отвечать предпросмотр другого проекта,
// и смоук молча проверил бы чужую сборку (reuseExistingServer берёт любой сервер, что уже отвечает по адресу).
const executablePath = process.env.PW_CHROMIUM || undefined;
```

Правка 2. Было:

```ts
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: executablePath ? { executablePath } : {},
```

Стало:

```ts
  use: {
    baseURL: 'http://localhost:4273',
    launchOptions: executablePath ? { executablePath } : {},
```

Правка 3. Было:

```ts
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
```

Стало:

```ts
    command: 'npm run preview',
    url: 'http://localhost:4273',
    reuseExistingServer: true,
```

## 2. Тесты

### 2.1. `tests/unit/mechanisms.test.ts` — заменить целиком, дословно

Прежние тесты плит и дверей — на массиве пар; новые — на маленькой карте прямо в тесте: знаки трёх пар, тело на плите открывает только двери своей пары, желейка в двери держит открытой только дверь своей пары, закрытая дверь твёрдая по парам, «Заново» закрывает двери всех пар.

```ts
import { describe, expect, it } from 'vitest';
import { Grid } from '../../src/core/grid';
import { newHero, type Hero } from '../../src/core/hero';
import { allLevels } from '../../src/core/levels';
import { doorsOpen, platePressed } from '../../src/core/mechanisms';
import { Run } from '../../src/core/run';
import { DATA } from '../../src/data';
import { EMPTY, GROUND, P, level } from './maps';

const grid = (id: string): Grid => new Grid(allLevels(DATA).find((l) => l.id === id)!, P.laserAltPhase);
const noBody = (): boolean => false;
const CLOSED = [false, false, false];

describe('плиты и двери', () => {
  const g = grid('p-02');
  const plate = g.plates[0]!;
  const onPlate: Hero = { ...newHero(g.start, P), x: 12.5, y: 11 - P.half - 0.001, grounded: true };

  it('плита: желейка на ней или тело над ней', () => {
    expect(plate).toEqual({ c: 12, r: 11, pair: 0 });
    expect(platePressed(plate, onPlate, noBody, P)).toBe(true);
    expect(platePressed(plate, { ...onPlate, x: 13.5 }, noBody, P)).toBe(false);
    expect(platePressed(plate, { ...onPlate, grounded: false }, noBody, P)).toBe(false);
    const body = (c: number, r: number): boolean => c === 12 && r === 10;
    expect(platePressed(plate, { ...onPlate, alive: false }, body, P)).toBe(true);
  });

  it('открытая дверь не закрывается, пока в ней живая желейка', () => {
    const h = { ...newHero(g.start, P), y: 9.6 };
    expect(doorsOpen(g, { ...h, x: 13.5 }, noBody, [true, false, false], P)).toEqual([true, false, false]);
    expect(doorsOpen(g, { ...h, x: 13.5 }, noBody, CLOSED, P)).toEqual(CLOSED);
    expect(doorsOpen(g, { ...h, x: 11.5 }, noBody, [true, false, false], P)).toEqual(CLOSED);
  });

  it('без плит двери закрыты', () => {
    const g1 = grid('p-01');
    expect(doorsOpen(g1, newHero(g1.start, P), noBody, CLOSED, P)).toEqual(CLOSED);
  });
});

describe('парные плиты и двери (M1-01)', () => {
  // Плиты в полу (ряд 10): R (пара 2) — столбец 3, Q (пара 1) — 6, P (пара 0) — 10. Двери в рядах 7…9:
  // E (пара 1) — столбец 14, D (пара 0) — 17, G (пара 2) — 19.
  const doorRow = '..............E..D.G....';
  const map = [...Array<string>(7).fill(EMPTY), doorRow, doorRow, '.@............E..D.G.F..', '###R##Q###P#############', GROUND, GROUND];
  const def = level(map);
  const g = new Grid(def, P.laserAltPhase);
  const far: Hero = { ...newHero(g.start, P), x: 1.5 };
  const bodyAt =
    (...cells: Array<[number, number]>) =>
    (c: number, r: number): boolean =>
      cells.some(([bc, br]) => bc === c && br === r);

  it('знаки пар: P и D — пара 0, Q и E — 1, R и G — 2', () => {
    expect(g.plates).toEqual([
      { c: 3, r: 10, pair: 2 },
      { c: 6, r: 10, pair: 1 },
      { c: 10, r: 10, pair: 0 },
    ]);
    const doorCols = (pair: number): number[] => g.doors.filter((d) => d.pair === pair).map((d) => d.c);
    expect([doorCols(0), doorCols(1), doorCols(2)]).toEqual([
      [17, 17, 17],
      [14, 14, 14],
      [19, 19, 19],
    ]);
    expect(g.doors.filter((d) => d.pair === 1).map((d) => d.r)).toEqual([7, 8, 9]);
    expect(g.tile(3, 10)).toBe('R');
    expect(g.tile(14, 8)).toBe('E');
    expect(g.tile(19, 8)).toBe('G');
    expect(g.isDoor(19, 8)).toBe(true);
    expect(g.isDoor(6, 10)).toBe(false);
  });

  it('тело на плите открывает только двери своей пары', () => {
    expect(doorsOpen(g, far, bodyAt([6, 9]), CLOSED, P)).toEqual([false, true, false]);
    expect(doorsOpen(g, far, bodyAt([10, 9]), CLOSED, P)).toEqual([true, false, false]);
    expect(doorsOpen(g, far, bodyAt([3, 9]), CLOSED, P)).toEqual([false, false, true]);
    expect(doorsOpen(g, far, bodyAt([6, 9], [10, 9]), CLOSED, P)).toEqual([true, true, false]);
  });

  it('желейка в двери держит открытой только дверь своей пары', () => {
    const inE: Hero = { ...far, x: 14.5, y: 9.6 };
    expect(doorsOpen(g, inE, noBody, [true, true, true], P)).toEqual([false, true, false]);
  });

  it('закрытая дверь твёрдая, открытая — нет, по парам', () => {
    const run = new Run(def, P);
    expect([run.isSolid(17, 8), run.isSolid(14, 8), run.isSolid(19, 8)]).toEqual([true, true, true]);
    run.doorOpen = [false, true, false];
    expect([run.isSolid(17, 8), run.isSolid(14, 8), run.isSolid(19, 8)]).toEqual([true, false, true]);
    run.doorOpen = [true, false, true];
    expect([run.isSolid(17, 8), run.isSolid(14, 8), run.isSolid(19, 8)]).toEqual([false, true, false]);
    // Плиты всех пар — твёрдые клетки пола.
    expect([run.isSolid(10, 10), run.isSolid(6, 10), run.isSolid(3, 10)]).toEqual([true, true, true]);
  });

  it('«Заново» закрывает двери всех пар', () => {
    const run = new Run(def, P);
    run.doorOpen = [true, true, true];
    run.restart();
    expect(run.doorOpen).toEqual(CLOSED);
  });
});
```

### 2.2. `tests/unit/grid.test.ts` — у плиты и дверей «Плиты» пара 0

Было:

```ts
    expect(g.lasers).toEqual([{ c: 12, r: 9, phase: 0 }]);
    expect(g.plates).toEqual([{ c: 12, r: 11 }]);
    expect(g.doors).toEqual([
      { c: 13, r: 7 },
      { c: 13, r: 8 },
      { c: 13, r: 9 },
    ]);
```

Стало:

```ts
    expect(g.lasers).toEqual([{ c: 12, r: 9, phase: 0 }]);
    expect(g.plates).toEqual([{ c: 12, r: 11, pair: 0 }]);
    expect(g.doors).toEqual([
      { c: 13, r: 7, pair: 0 },
      { c: 13, r: 8, pair: 0 },
      { c: 13, r: 9, pair: 0 },
    ]);
```

### 2.3. `tests/unit/prototype.test.ts` — дверь прототипа — это пара 0

Было:

```ts
          const a = `${G.hero.x.toFixed(9)} ${G.hero.y.toFixed(9)} ${G.legion} ${G.frozen.map((b: { c: number; r: number }) => `${b.c},${b.r}`).join(';')} ${G.doorOpen} ${G.state === 'done'}`;
          const b = `${run.hero.x.toFixed(9)} ${run.hero.y.toFixed(9)} ${run.legion} ${run.bodies.map((x) => `${x.c},${x.r}`).join(';')} ${run.doorOpen} ${run.state === 'done'}`;
          if (a !== b) {
```

Стало:

```ts
          const a = `${G.hero.x.toFixed(9)} ${G.hero.y.toFixed(9)} ${G.legion} ${G.frozen.map((b: { c: number; r: number }) => `${b.c},${b.r}`).join(';')} ${G.doorOpen} ${G.state === 'done'}`;
          const b = `${run.hero.x.toFixed(9)} ${run.hero.y.toFixed(9)} ${run.legion} ${run.bodies.map((x) => `${x.c},${x.r}`).join(';')} ${run.doorOpen[0]} ${run.state === 'done'}`;
          if (a !== b) {
```

### 2.4. `tests/unit/solve.test.ts` — тайм-аут теста «стена до неба»

Перебор этого теста — самый долгий в `npm run test` (несколько секунд); после правки двери стали массивом, и на медленной машине он мог упереться в стандартные 5 с.

Было:

```ts
  it('стена до неба: в пределах поиска не решается', () => {
    const wall = '...........#............';
```

Стало:

```ts
  it('стена до неба: в пределах поиска не решается', { timeout: 30_000 }, () => {
    const wall = '...........#............';
```

### 2.5. `tests/e2e/smoke.spec.ts` — версия

Было:

```ts
  // Язык страницы берётся из браузера: ru — «Желейный легион», иначе «Jelly Legion».
  await expect(page.getByTestId('debug-line')).toContainText(/(Желейный легион|Jelly Legion) 0\.0\.6/);
```

Стало:

```ts
  // Язык страницы берётся из браузера: ru — «Желейный легион», иначе «Jelly Legion».
  await expect(page.getByTestId('debug-line')).toContainText(/(Желейный легион|Jelly Legion) 0\.0\.7/);
```

## 3. Порядок
1. Файлы и правки §1, `npm install`, `npm run data` — строка `data-check: ok (таблиц: 4, строк перевода: 32, уровней: 6, файлов уровней: 1)`.
2. Тесты §2, `npm run check`.
3. `npm run solve` — вывод как после M0-05 (§4), `data/solutions/proto.json` не меняется: `git status` не показывает его изменённым.

## 4. Ожидаемый вывод `npm run solve`

Тот же, что после M0-05. Сверять строки программы — от `solve: уровней` до `solve: ok`; на ноутбуке может отличаться только столбец «мс» (здесь — «…»), в строках без замечаний после него — пробелы до ширины столбца:

```
solve: уровней 6; бот с запасом — нажатие раз в 6 шагов, окно от 6 шагов, короткий тап 1…6 шагов; строгий — нажатие раз в 3 шага; удержание 1 и 30 шагов, до 3 прыжков за жизнь, до 8 гибелей
уровень  пар    бот    строго  время    окно   перебор               мс      замечания
p-01     1      1      1       6.7 с    12     17318 / 6             …
p-02     1      1      1       7.7 с    —      194201 / 17           …
p-03     0      0      0       5.5 с    12     140064 / 1            …
p-04     2      2      2       12.4 с   10     1696009 / 76          …
p-05     1      1      0       5.5 с    6      23006 / 7             …
p-06     2      2      1       12.6 с   12     32058424 / 668        …
пар — в файле уровня; бот — найденный ботом с запасом; строго — без запаса (точность 1/60 с); время — решения
бота с запасом; окно — наименьший запас нажатия в своей жизни, шагов по 1/60 с (12 — это 12 и больше);
перебор — шагов желейки / состояний уровня у бота с запасом; мс — оба бота.
solve: решения записаны в data/solutions/proto.json
solve: ok — пар каждого уровня равен найденному ботом с запасом
```

## 5. Критерии готовности
- Файлы §1.1, 1.2, 1.7, 1.8 и тест §2.1 — дословно, правки — как написано.
- `npm run check` зелёный: Vitest — 22 файла, как после M0-05, тестов 118 (было 113: плюс пять тестов пар); `npm run test` — до 30 с; сборка до 3 МБ; Playwright — 15 passed, 1 skipped, предпросмотр — на порту 4273.
- `npm run solve` — код выхода 0, вывод как в §4, `data/solutions/proto.json` не изменился.
- `npm run publish -- --dry-run` — строка `publish: Желейный легион 0.0.7 (<хеш>+), …`.
- В `docs/tasks/README.md` — строка M1-01 «сделано ДД.ММ».

## Если что-то не так
- Если `npm run solve` даёт другие числа или меняет `data/solutions/proto.json` — ничего не подгоняй: приложи вывод целиком и `git diff data/solutions`.
- Если тест «стена до неба» или весь `npm run test` идёт дольше 30 с — напиши, сколько (`npx vitest run --reporter=verbose`).

## Отчёт
Что сделано; итоговые строки `npm run check`; вывод `npm run solve` целиком; строка `publish --dry-run`; что не получилось и почему.
