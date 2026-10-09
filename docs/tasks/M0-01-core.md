# M0-01 — ядро уровня: разбор уровней, желейка, гибель и застывание

**Цель.** Правила игры живут в ядре `src/core/` и совпадают с прототипом (`docs/research/prototype.html`) шаг в шаг: разбор файлов уровней, сетка уровня, бег и прыжок желейки с удержанием, буфером и койот-временем, шипы, пилы, лазеры, падение, лопание от стресса, застывание тел, плиты и двери, возрождение, легион, звёзды. Первая желейка уровня ждёт нажатия (решение Никиты 09.10). Отрисовки уровня ещё нет — это M0-02.

**Что изменится в игре.** На экране пока заглушка этапа 0. В отладочной строке слева внизу добавятся уровень, состояние попытки, легион и время: «… · p-01 · ready · легион 0 · 0.0 с». Нажатия пока ни на что не действуют: ввод одной кнопкой, вид уровня, камера и карта уровня в портрете — задача M0-02. Через `window.__game` уровень можно пройти командами: например, «Плита» (`p-02`) без единого прыжка проходится за 7,7 с с одной гибелью — первая желейка гибнет в лазере над плитой и держит дверь, вторая доходит до флага. Версия — 0.0.2.

Перед началом прочитай `CLAUDE.md`, `docs/ARCHITECTURE.md` (§1–6), `data/README.md` и в `docs/GDD.md` разделы «Желейка и физика», «Застывание», «Элементы уровня».

**Проверка до передачи.** Код ядра ниже написан Claude и сверен с самим прототипом 09.10.2026: на 240 случайных сценариях нажатий (по 40 на уровень, 40 с каждый) положение желейки совпадает с прототипом до 9 знаков после запятой на каждом шаге, тела, легион и двери — тоже; расходятся только 17 сценариев, где прототип ставит тело в клетку пилы, — это правка M0 (GDD, «Застывание»). Сверка входит в тесты задачи (§3.1). Числа в рецептах тестов §3 получены прогоном этого кода. Пробная сборка независимым исполнителем по этому тексту: 68 тестов в 14 файлах с первого запуска, `npm run check` зелёный, около 17 минут; по её итогам уточнены рецепты (старт карт `gapMap` и `wallMap`, удержание в проверке койот-времени, длина прогонов без нажатий, текст ошибки «нет end») и добавлен рецепт «тело накрывает шипы» (§3.5) — без него удаление `!isBody(c, r)` из проверки шипов не ловилось. Число строк в файлах совпадёт только там, где код дан дословно.

## 1. Ядро — файлы дословно

Код ниже переносится как есть, без «улучшений» (CLAUDE.md, правило 5). Порядок действий в шаге и формулы — прототипа: `moveHero` — это `updateHero` без анимации, `checkHazards` — `checkHazards`, `placeBody` — `placeFrozen`, `Run.step` — `Proto.update`. Отличия от прототипа, все — по GDD:

- первая желейка стоит на старте до первого `press()`; это нажатие только запускает бег (без прыжка); время уровня и цикл лазеров идут с этого момента; `restart()` возвращает в это состояние;
- тело не встаёт в клетку старта, двери, излучателя лазера и пилы (`placeBody`);
- открытая дверь не закрывается, пока в ней живая желейка (`doorsOpen`).

### 1.1. `src/core/levels.ts` — разбор файлов уровней (те же правила и тексты ошибок, что в `tools/data-check.mjs`)

```ts
import type { Tables } from './data/tables';

/** Уровень из файла data/levels/<набор>.txt — как есть, до разбора на клетки. */
export interface LevelDef {
  id: string;
  par: number;
  /** Лимит легиона (мир 4); null — без лимита. */
  limit: number | null;
  /** grid_rows строк по grid_cols знаков. */
  map: readonly string[];
  /** Набор (файл без .txt) и строка `level …` — для сообщений об ошибках. */
  file: string;
  line: number;
}

/** Знаки карты (data/README.md). */
export const TILE_CHARS = '#.@F^SLlPD';

/**
 * Разбор файла уровней по тем же правилам, что tools/data-check.mjs. Комментарии `#` — только вне карты:
 * внутри `map … end` каждая строка — ряд карты. Ошибка — Error(`<файл>:<строка>: …`).
 */
export function parseLevels(text: string, file: string, cols: number, rows: number): LevelDef[] {
  const rel = `data/levels/${file}.txt`;
  if (text.charCodeAt(0) === 0xfeff) throw new Error(`${rel}: BOM в начале файла`);
  const lines = text.split('\n').map((s) => s.replace(/\r$/, ''));
  const out: LevelDef[] = [];
  let cur: { id: string; line: number; par: number | null; limit: number | null; map: string[] } | null = null;
  let inMap = false;
  const fail = (line: number, msg: string): never => {
    throw new Error(`${rel}:${line}: ${msg}`);
  };
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (inMap && cur) {
      if (raw !== 'end') {
        cur.map.push(raw);
        return;
      }
      inMap = false;
      out.push(finish(cur, rel, cols, rows));
      cur = null;
      return;
    }
    const s = raw.trim();
    if (s === '' || s.startsWith('#')) return;
    const [word = '', ...rest] = s.split(/\s+/);
    if (word === 'level') {
      if (cur) fail(line, `уровень ${cur.id} не закрыт строкой end`);
      cur = { id: rest.join(' '), line, par: null, limit: null, map: [] };
    } else if (!cur) fail(line, `строка вне уровня: «${s}»`);
    else if (word === 'par' || word === 'limit') {
      const n = Number(rest[0]);
      const min = word === 'par' ? 0 : 1;
      if (rest.length !== 1 || !Number.isInteger(n) || n < min) fail(line, `${word} = «${rest.join(' ')}» — нужно целое ≥ ${min}`);
      if (word === 'par') cur.par = n;
      else cur.limit = n;
    } else if (word === 'map') inMap = true;
    else fail(line, `неизвестная строка «${s}»`);
  });
  if (cur) throw new Error(`${rel}: последний уровень не закрыт строкой end`);
  return out;
}

function finish(
  lv: { id: string; line: number; par: number | null; limit: number | null; map: string[] },
  rel: string,
  cols: number,
  rows: number,
): LevelDef {
  const at = `${rel}:${lv.line}`;
  if (lv.par === null) throw new Error(`${at}: у уровня ${lv.id} нет строки par`);
  if (lv.map.length !== rows) throw new Error(`${at}: в карте ${lv.id} ${lv.map.length} строк вместо ${rows}`);
  let starts = 0;
  let flags = 0;
  lv.map.forEach((row, r) => {
    if (row.length !== cols) throw new Error(`${at}: строка ${r} карты ${lv.id} — ${row.length} знаков вместо ${cols}`);
    for (const ch of row) {
      if (!TILE_CHARS.includes(ch)) throw new Error(`${at}: в карте ${lv.id} неизвестный знак «${ch}» (строка ${r})`);
      if (ch === '@') starts++;
      if (ch === 'F') flags++;
    }
  });
  if (starts !== 1) throw new Error(`${at}: в карте ${lv.id} старт @ — ${starts} раз, нужен один`);
  if (flags !== 1) throw new Error(`${at}: в карте ${lv.id} флаг F — ${flags} раз, нужен один`);
  const file = rel.slice('data/levels/'.length, -'.txt'.length);
  return { id: lv.id, par: lv.par, limit: lv.limit, map: lv.map, file, line: lv.line };
}

/** Все уровни игры: миры в порядке worlds.csv, уровни — в порядке файла. Повтор id — ошибка. */
export function allLevels(t: Tables): LevelDef[] {
  const cols = t.num('grid_cols');
  const rows = t.num('grid_rows');
  const out: LevelDef[] = [];
  const seen = new Set<string>();
  for (const w of t.worlds) {
    const text = t.levelFiles[w.file];
    if (text === undefined) throw new Error(`worlds.csv: у мира ${w.id} нет файла data/levels/${w.file}.txt`);
    for (const lv of parseLevels(text, w.file, cols, rows)) {
      if (seen.has(lv.id)) throw new Error(`data/levels/${w.file}.txt:${lv.line}: повтор id уровня ${lv.id}`);
      seen.add(lv.id);
      out.push(lv);
    }
  }
  return out;
}
```

### 1.2. `src/core/physics.ts` — числа физики из таблиц

```ts
import type { Tables } from './data/tables';

/** Числа физики и угроз из constants.csv (единицы — клетки и секунды). */
export interface Physics {
  cols: number;
  rows: number;
  run: number;
  gravity: number;
  gravityHold: number;
  holdMax: number;
  /** Скорость отрыва = √(2 × gravity × jump_height). */
  jumpV: number;
  vmax: number;
  half: number;
  inset: number;
  coyote: number;
  jumpBuffer: number;
  respawn: number;
  stuck: number;
  progressEps: number;
  fallOutMargin: number;
  spikeX0: number;
  spikeX1: number;
  spikeY0: number;
  spikeInset: number;
  sawRadius: number;
  laserPeriod: number;
  laserOn: number;
  laserWarn: number;
  laserAltPhase: number;
  laserX0: number;
  laserX1: number;
  laserInset: number;
  laserMinDy: number;
  laserFreezeDy: number;
  plateEps: number;
  plateEdge: number;
  flagX0: number;
  stars2Extra: number;
}

export function physicsFrom(t: Tables): Physics {
  const n = (k: string): number => t.num(k);
  return {
    cols: n('grid_cols'),
    rows: n('grid_rows'),
    run: n('run_speed'),
    gravity: n('gravity'),
    gravityHold: n('gravity_hold'),
    holdMax: n('hold_max_s'),
    jumpV: Math.sqrt(2 * n('gravity') * n('jump_height')),
    vmax: n('fall_speed_max'),
    half: n('hero_half'),
    inset: n('collide_inset'),
    coyote: n('coyote_s'),
    jumpBuffer: n('jump_buffer_s'),
    respawn: n('respawn_s'),
    stuck: n('stuck_s'),
    progressEps: n('progress_eps'),
    fallOutMargin: n('fall_out_margin'),
    spikeX0: n('spike_x0'),
    spikeX1: n('spike_x1'),
    spikeY0: n('spike_y0'),
    spikeInset: n('spike_hero_inset'),
    sawRadius: n('saw_radius'),
    laserPeriod: n('laser_period_s'),
    laserOn: n('laser_on_s'),
    laserWarn: n('laser_warn_s'),
    laserAltPhase: n('laser_alt_phase_s'),
    laserX0: n('laser_x0'),
    laserX1: n('laser_x1'),
    laserInset: n('laser_hero_inset'),
    laserMinDy: n('laser_min_dy'),
    laserFreezeDy: n('laser_freeze_dy'),
    plateEps: n('plate_eps'),
    plateEdge: n('plate_edge'),
    flagX0: n('flag_x0'),
    stars2Extra: n('stars_2_extra'),
  };
}
```

### 1.3. `src/core/grid.ts` — неподвижная часть уровня

```ts
import type { LevelDef } from './levels';

export interface Cell {
  c: number;
  r: number;
}

export interface Laser extends Cell {
  /** Сдвиг цикла, с: `L` — 0, `l` — laser_alt_phase_s. */
  phase: number;
}

/**
 * Неподвижная часть уровня: клетки земли, шипов, плит и дверей и места элементов.
 * Как в прототипе (parseLevel): знаки @ F S L l в сетке клеток становятся воздухом, P и D остаются.
 */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly start: Cell;
  readonly flag: Cell;
  readonly saws: readonly Cell[];
  readonly lasers: readonly Laser[];
  readonly plates: readonly Cell[];
  readonly doors: readonly Cell[];
  private readonly tiles: string[][];

  constructor(def: LevelDef, laserAltPhase: number) {
    this.rows = def.map.length;
    this.cols = def.map[0]?.length ?? 0;
    const saws: Cell[] = [];
    const lasers: Laser[] = [];
    const plates: Cell[] = [];
    const doors: Cell[] = [];
    let start: Cell = { c: 0, r: 0 };
    let flag: Cell = { c: 0, r: 0 };
    this.tiles = def.map.map((row, r) =>
      [...row].map((ch, c) => {
        if (ch === 'L' || ch === 'l') lasers.push({ c, r, phase: ch === 'l' ? laserAltPhase : 0 });
        else if (ch === 'S') saws.push({ c, r });
        else if (ch === 'P') plates.push({ c, r });
        else if (ch === 'D') doors.push({ c, r });
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

  /** Знак клетки: '#', '.', '^', 'P' или 'D'. За левым и правым краем — '#', выше и ниже поля — '.'. */
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
    return this.tile(c, r) === 'D';
  }
}
```

### 1.4. `src/core/hero.ts` — движение желейки

```ts
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
```

### 1.5. `src/core/hazards.ts` — угрозы, лазеры и флаг

```ts
import type { Grid, Laser } from './grid';
import type { Hero, Solid } from './hero';
import type { Physics } from './physics';

export type DeathCause = 'spike' | 'saw' | 'laser' | 'fall' | 'burst';

/** Лазер горит: (время уровня + сдвиг) mod период < laser_on_s. */
export function laserOn(time: number, l: Laser, P: Physics): boolean {
  return (time + l.phase) % P.laserPeriod < P.laserOn;
}

/** Пунктир перед включением: до конца цикла меньше laser_warn_s. */
export function laserWarn(time: number, l: Laser, P: Physics): boolean {
  return (time + l.phase) % P.laserPeriod > P.laserPeriod - P.laserWarn;
}

/** Ряд, где обрывается луч: первая твёрдая клетка под излучателем (тела тоже), или rows. */
export function beamEnd(l: Laser, solid: Solid, rows: number): number {
  let r = l.r + 1;
  while (r < rows && !solid(l.c, r)) r++;
  return r;
}

/** Желейка, урезанная на inset, пересекает прямоугольник [x0, x1) × [y0, y1). */
export function overlapRect(h: Hero, x0: number, y0: number, x1: number, y1: number, inset: number, half: number): boolean {
  return h.x + half - inset > x0 && h.x - half + inset < x1 && h.y + half - inset > y0 && h.y - half + inset < y1;
}

export type Hit = { kind: 'death'; cause: Exclude<DeathCause, 'burst'>; laser: Laser | null } | { kind: 'flag' };

/**
 * Угрозы и флаг — дословно checkHazards прототипа, в том же порядке: падение, шипы, пилы, лазеры, флаг.
 * beamEnds[i] — ряд обрыва луча лазера grid.lasers[i] в этом шаге.
 */
export function checkHazards(
  h: Hero,
  grid: Grid,
  isBody: (c: number, r: number) => boolean,
  time: number,
  beamEnds: readonly number[],
  P: Physics,
): Hit | null {
  const hh = P.half;
  if (h.y - hh > grid.rows + P.fallOutMargin) return { kind: 'death', cause: 'fall', laser: null };
  const c0 = Math.floor(h.x - hh);
  const c1 = Math.floor(h.x + hh);
  const r0 = Math.floor(h.y - hh);
  const r1 = Math.floor(h.y + hh);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (grid.tile(c, r) === '^' && !isBody(c, r) && overlapRect(h, c + P.spikeX0, r + P.spikeY0, c + P.spikeX1, r + 1, P.spikeInset, hh)) {
        return { kind: 'death', cause: 'spike', laser: null };
      }
    }
  }
  for (const s of grid.saws) {
    const dx = h.x - (s.c + 0.5);
    const dy = h.y - (s.r + 0.5);
    if (dx * dx + dy * dy < P.sawRadius * P.sawRadius) return { kind: 'death', cause: 'saw', laser: null };
  }
  for (let i = 0; i < grid.lasers.length; i++) {
    const l = grid.lasers[i]!;
    const end = beamEnds[i] ?? grid.rows;
    if (
      laserOn(time, l, P) &&
      h.x + hh - P.laserInset > l.c + P.laserX0 &&
      h.x - hh + P.laserInset < l.c + P.laserX1 &&
      h.y >= l.r + P.laserMinDy &&
      h.y < end
    ) {
      return { kind: 'death', cause: 'laser', laser: l };
    }
  }
  if (overlapRect(h, grid.flag.c + P.flagX0, grid.flag.r, grid.flag.c + 1, grid.flag.r + 1, 0, hh)) return { kind: 'flag' };
  return null;
}
```

### 1.6. `src/core/freeze.ts` — где застывает тело

```ts
import type { Cell, Grid, Laser } from './grid';
import type { Hero, Solid } from './hero';
import type { DeathCause } from './hazards';
import type { Physics } from './physics';

/** Порядок поиска свободной клетки вокруг опорной (dc, dr): она сама, выше, левее, правее, ниже, … — как в прототипе. */
export const FREEZE_ORDER: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [0, -2], [-1, 1], [1, 1],
];

/** Опорная точка тела по причине гибели (killHero прототипа). */
export function freezeAnchor(cause: DeathCause, h: Hero, laser: Laser | null, P: Physics): { x: number; y: number } {
  if (cause === 'fall') return { x: h.x, y: P.rows - 0.5 };
  if (cause === 'laser' && laser) return { x: laser.c + 0.5, y: Math.max(laser.r + P.laserFreezeDy, h.y) };
  return { x: h.x, y: h.y };
}

/**
 * Клетка, где застывает тело (placeFrozen прототипа), или null — тела не будет.
 * Свободна клетка поля, которая не твёрдая, не шипы и не флаг (прототип), а также не старт, не дверь,
 * не излучатель и не пила (правки M0, GDD «Застывание»). Нет свободной, а в опорной шипы — тело накрывает шипы.
 */
export function placeBody(x: number, y: number, grid: Grid, solid: Solid): Cell | null {
  const c = Math.max(0, Math.min(grid.cols - 1, Math.floor(x)));
  const r = Math.max(0, Math.min(grid.rows - 1, Math.floor(y)));
  const free = (cc: number, rr: number): boolean =>
    cc >= 0 &&
    cc < grid.cols &&
    rr >= 0 &&
    rr < grid.rows &&
    !solid(cc, rr) &&
    grid.tile(cc, rr) !== '^' &&
    !grid.isFlag(cc, rr) &&
    !grid.isStart(cc, rr) &&
    !grid.isDoor(cc, rr) &&
    !grid.isEmitter(cc, rr) &&
    !grid.isSaw(cc, rr);
  for (const [dc, dr] of FREEZE_ORDER) if (free(c + dc, r + dr)) return { c: c + dc, r: r + dr };
  if (grid.tile(c, r) === '^' && !solid(c, r)) return { c, r };
  return null;
}
```

### 1.7. `src/core/mechanisms.ts` — плиты и двери

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

/** Живая желейка задевает клетку какой-нибудь двери. */
export function heroInDoor(h: Hero, grid: Grid, P: Physics): boolean {
  if (!h.alive) return false;
  return grid.doors.some((d) => h.x + P.half > d.c && h.x - P.half < d.c + 1 && h.y + P.half > d.r && h.y - P.half < d.r + 1);
}

/**
 * Двери открыты, пока нажата хоть одна плита (в M0 все плиты открывают все двери).
 * Правка M0 (GDD «Застывание»): открытая дверь не закрывается, пока в ней живая желейка.
 */
export function doorsOpen(grid: Grid, h: Hero, isBody: (c: number, r: number) => boolean, wasOpen: boolean, P: Physics): boolean {
  const pressed = grid.plates.length > 0 && grid.plates.some((p) => platePressed(p, h, isBody, P));
  return pressed || (wasOpen && heroInDoor(h, grid, P));
}
```

### 1.8. `src/core/stars.ts` — звёзды

```ts
/** Звёзды за уровень: 3 — легион ≤ пар, 2 — легион ≤ пар + extra, 1 — пройден. */
export function starsFor(legion: number, par: number, extra: number): 1 | 2 | 3 {
  if (legion <= par) return 3;
  if (legion <= par + extra) return 2;
  return 1;
}
```

### 1.9. `src/core/run.ts` — попытка уровня

```ts
import { Grid, type Cell, type Laser } from './grid';
import { beamEnd, checkHazards, laserOn as isLaserOn, laserWarn as isLaserWarn, type DeathCause } from './hazards';
import { freezeAnchor, placeBody } from './freeze';
import { moveHero, newHero, type Control, type Hero } from './hero';
import type { LevelDef } from './levels';
import { doorsOpen, platePressed } from './mechanisms';
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
  doorOpen = false;
  respawnT = 0;
  stars: 0 | 1 | 2 | 3 = 0;
  /** Ряд обрыва луча каждого лазера (grid.lasers) на этом шаге. */
  beamEnds: number[];
  readonly ctl: Control = { jumpBuf: 0, held: false };
  private bodyKeys = new Set<number>();
  private events: RunEvent[] = [];

  constructor(
    readonly def: LevelDef,
    readonly P: Physics,
  ) {
    this.grid = new Grid(def, P.laserAltPhase);
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
    this.doorOpen = false;
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
    this.doorOpen = doorsOpen(this.grid, this.hero, this.isBody, this.doorOpen, this.P);
  }

  /** Твёрдая клетка: земля, плита, закрытая дверь, тело; за краями слева и справа — стена (isSolid прототипа). */
  readonly isSolid = (c: number, r: number): boolean => {
    if (c < 0 || c >= this.grid.cols) return true;
    if (r < 0 || r >= this.grid.rows) return false;
    const t = this.grid.tile(c, r);
    if (t === '#' || t === 'P') return true;
    if (t === 'D') return !this.doorOpen;
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
```

## 2. Подключение — `src/debug.ts`, `src/main.ts`, версия

Оба файла заменить целиком (дословно). `main.ts` создаёт попытку первого уровня и шагает её в тикере; вид уровня и ввод — M0-02, поэтому заглушка `StubView` остаётся, а события шага пока просто вычитываются. В `package.json` — `"version": "0.0.2"`, затем `npm install` (обновит версию в `package-lock.json`, зависимости те же).

### 2.1. `src/debug.ts`

```ts
import type { RunState } from './core/run';
import type { Layout } from './game/layout';
import type { PlatformCall } from './platform/platform';

/** Состояние попытки для тестов и ботов (только чтение). */
export interface DebugState {
  level: string;
  state: RunState;
  legion: number;
  /** Время уровня, с. */
  time: number;
  stars: number;
  hero: { x: number; y: number; vx: number; vy: number; alive: boolean; grounded: boolean };
  bodies: Array<{ c: number; r: number }>;
  doorOpen: boolean;
  lasers: Array<{ on: boolean; warn: boolean; end: number }>;
}

/**
 * Отладочный доступ к игре для тестов Playwright и ботов: `window.__game`.
 * Чтение состояния и команды — те же, что подаёт слой ввода; расширяется задачами.
 */
export interface GameDebug {
  ready: boolean;
  version: string;
  /** Метка сборки: хеш коммита (с '+' при незакоммиченных правках) или 'dev'. */
  build: string;
  layout(): Layout;
  /** Игровое время с запуска, мс (все шаги ядра, на любом уровне). */
  gameMs(): number;
  platformLog(): PlatformCall[];
  /** Id уровней игры по порядку. */
  levels(): string[];
  /** Новая попытка на уровне id (состояние ready). Нет такого уровня — исключение. */
  setLevel(id: string): void;
  state(): DebugState;
  command: { press(): void; release(): void; restart(): void };
  /** Прогнать ядро на ms игрового времени сразу, без кадров: round(ms / шаг) шагов. */
  advance(ms: number): void;
}

declare global {
  interface Window {
    __game?: GameDebug;
  }
}
```

### 2.2. `src/main.ts`

```ts
import './debug';
import { FixedStep, STEP_MS } from './core/clock';
import { allLevels } from './core/levels';
import { physicsFrom } from './core/physics';
import { Run } from './core/run';
import { DATA } from './data';
import type { DebugState } from './debug';
import { Stage } from './game/stage';
import { StubView } from './game/view';
import { StubPlatform } from './platform/stub';
import { DebugLine } from './ui/debug-line';

const VERSION = '0.0.2';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
const BUILD = import.meta.env.VITE_BUILD ?? 'dev';

async function boot(): Promise<void> {
  const platform = new StubPlatform();
  await platform.init();
  const lang = platform.language() === 'ru' ? 'ru' : 'en';

  const stage = new Stage();
  await stage.init(document.getElementById('game')!);
  // Вид уровня — M0-02; пока заглушка этапа 0.
  const view = new StubView(stage.root);
  view.build(stage.layout);
  stage.onLayout = (layout) => view.build(layout);

  const levels = allLevels(DATA);
  const P = physicsFrom(DATA);
  let run = new Run(levels[0]!, P);
  let gameMs = 0;
  const step = (dt: number): void => {
    run.step(dt);
    gameMs += dt;
  };

  const clock = new FixedStep();
  const line = new DebugLine(document.getElementById('ui')!);
  const title = DATA.text('game.title', lang);

  stage.app.ticker.add((ticker) => {
    clock.advance(ticker.deltaMS, step);
    run.drainEvents(); // события читает вид уровня (M0-02)
    view.sync(gameMs);
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
      const def = levels.find((l) => l.id === id);
      if (!def) throw new Error(`нет уровня ${id}`);
      run = new Run(def, P);
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
  };
  platform.loadingFinished();
}

boot().catch((err: unknown) => {
  console.error('boot failed', err);
});
```

## 3. Тесты Vitest

Уровни для тестов механики — маленькие карты прямо в тесте через `parseLevels(text, 'test', 24, 13)` (файл в сообщениях — `data/levels/test.txt`). Помощник для тестов (в каждом файле свой или общий `tests/unit/maps.ts`):

```ts
const EMPTY = '........................';
const GROUND = '########################';
/** Уровень из 13 строк карты, id t-1. */
function level(map: string[], par = 0): LevelDef {
  return parseLevels(`level t-1\npar ${par}\nmap\n${map.join('\n')}\nend\n`, 'test', 24, 13)[0]!;
}
/** Ровный пол: ряды 10–12 — земля, старт (1, 9), флаг (22, 9). */
const FLAT = [...Array(9).fill(EMPTY), '.@....................F.', GROUND, GROUND, GROUND];
/** Ровный пол и яма без дна в столбцах 8 … 8+n−1 (все три ряда пустые), старт (1, 9), флаг (21, 9). */
function gapMap(n: number): string[];
/** Ровный пол и стена высотой h в столбцах 10–23 (ряды 10−h … 9), старт (1, 9), флаг (21, 9−h). */
function wallMap(h: number): string[];
/** Старт: press() и release() — в ready это только запуск бега. */
function started(def: LevelDef): Run;
```

Шаги считаются с нуля после старта: «шаг f» — `f`-й вызов `run.step(1000 / 60)` после `press()` + `release()`; «нажатие на шаге f» — `press()` перед этим вызовом, «удержание h шагов» — `release()` перед шагом f + h. Так же устроена сверка с прототипом, и все числа ниже получены именно так.

### 3.1. Сверка с прототипом — `tests/unit/prototype.ts` и `tests/unit/prototype.test.ts` (дословно)

`prototype.ts` запускает скрипты `docs/research/prototype.html` без браузера (заглушки DOM и холста). Тест гоняет по 40 случайных сценариев нажатий на каждом из шести уровней и сравнивает на каждом шаге положение желейки (строки `toFixed(9)` — до 9 знаков после запятой), легион, тела, двери и финиш. Сценарий останавливается, когда прототип ставит тело в клетку, которую ядро исключает (правка M0): таких ровно 17. Сравнено ровно 307 106 шагов — это сторож: правка физики или уровней прототипа меняет число.

```ts
import { readFileSync } from 'node:fs';

/**
 * Прототип docs/research/prototype.html без браузера: скрипты страницы с заглушками DOM и холста.
 * Нужен только тестам сверки ядра с прототипом (TESTPLAN §1). Шаг — 1/60 с, как в ядре.
 */
export interface Prototype {
  /** Состояние игры прототипа: G.state, G.hero {x, y, alive}, G.legion, G.frozen [{c, r}], G.doorOpen. */
  G(): any;
  loadLevel(index: number): void;
  step(): void;
  press(): void;
  release(): void;
}

export function loadPrototype(path = 'docs/research/prototype.html'): Prototype {
  const html = readFileSync(path, 'utf8');
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n;\n');
  const ctx: any = new Proxy(
    {},
    {
      get: (t: any, k) => (k in t ? t[k] : () => ({ addColorStop() {}, width: 10 })),
      set: (t: any, k, v) => ((t[k] = v), true),
    },
  );
  const canvas = { getContext: () => ctx, addEventListener() {}, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }), style: {} };
  const win: any = { innerWidth: 960, innerHeight: 540, devicePixelRatio: 1, addEventListener() {} };
  const doc = { getElementById: (id: string) => (id === 'c' ? canvas : { textContent: '' }) };
  const perf = { now: () => 0 };
  const raf = () => 0;
  const run = new Function('window', 'document', 'performance', 'requestAnimationFrame', `${code}\n;return Proto;`);
  const Proto = run(win, doc, perf, raf);
  const game = win.__proto.game;
  Proto.onKey('Enter', true); // со стартового экрана прототипа — в игру
  return {
    G: () => game.G,
    loadLevel: (i) => game.loadLevel(i),
    step: () => Proto.update(1 / 60),
    press: () => Proto.onKey(' ', true),
    release: () => Proto.onKey(' ', false),
  };
}
```

```ts
import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { Run } from '../../src/core/run';
import { DATA } from '../../src/data';
import { loadPrototype } from './prototype';

const P = physicsFrom(DATA);
const LEVELS = allLevels(DATA);
const STEPS = 60 * 40;
/** Сколько шагов сравнено при проверке до передачи (09.10.2026). */
const COMPARED = 307_106;

/** Случайный сценарий нажатий: нажатие через 5–94 шага, удержание 1–25 шагов (тот же генератор, что при проверке до передачи). */
function script(seed: number): { press: Set<number>; release: Set<number> } {
  let s = seed >>> 0;
  const rnd = (): number => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const press = new Set<number>();
  const release = new Set<number>();
  let f = 0;
  while (f < STEPS) {
    f += 5 + Math.floor(rnd() * 90);
    press.add(f);
    const hold = 1 + Math.floor(rnd() * 25);
    release.add(f + hold);
    f += hold;
  }
  return { press, release };
}

describe('ядро против прототипа', () => {
  it('шесть уровней × 40 сценариев: на каждом шаге то же положение, гибели, тела и двери', () => {
    const proto = loadPrototype();
    let compared = 0;
    let stoppedByDesign = 0;
    const mismatches: string[] = [];
    for (let li = 0; li < 6; li++) {
      const def = LEVELS[li]!;
      for (let seed = 1; seed <= 40; seed++) {
        const sc = script(seed * 7919 + li);
        proto.loadLevel(li);
        const run = new Run(def, P);
        run.press(); // в ядре первая желейка ждёт нажатия; прототип бежит сразу
        run.release();
        for (let f = 0; f < STEPS; f++) {
          if (sc.release.has(f)) {
            proto.release();
            run.release();
          }
          if (sc.press.has(f)) {
            proto.press();
            run.press();
          }
          const before = proto.G().frozen.length;
          proto.step();
          run.step(1000 / 60);
          const G = proto.G();
          // Правка M0: тело не встаёт в клетку старта, двери, излучателя и пилы — дальше уровни расходятся намеренно.
          const nb = G.frozen.length > before ? G.frozen.at(-1) : null;
          if (nb && (run.grid.isStart(nb.c, nb.r) || run.grid.isDoor(nb.c, nb.r) || run.grid.isEmitter(nb.c, nb.r) || run.grid.isSaw(nb.c, nb.r))) {
            stoppedByDesign++;
            break;
          }
          const a = `${G.hero.x.toFixed(9)} ${G.hero.y.toFixed(9)} ${G.legion} ${G.frozen.map((b: { c: number; r: number }) => `${b.c},${b.r}`).join(';')} ${G.doorOpen} ${G.state === 'done'}`;
          const b = `${run.hero.x.toFixed(9)} ${run.hero.y.toFixed(9)} ${run.legion} ${run.bodies.map((x) => `${x.c},${x.r}`).join(';')} ${run.doorOpen} ${run.state === 'done'}`;
          if (a !== b) {
            mismatches.push(`L${li + 1} seed ${seed} step ${f}: прототип «${a}», ядро «${b}»`);
            break;
          }
          compared++;
          if (G.state !== 'play') break;
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(stoppedByDesign).toBe(17);
    expect(compared).toBe(COMPARED);
  });
});
```

### 3.2. `tests/unit/levels.test.ts`

- `allLevels(DATA)`: id `p-01` … `p-06`, пар `[3, 1, 1, 2, 3, 4]`, у всех `limit` = null, карта 13 строк по 24 знака, `file` = `'proto'`; `p-01.map[12]` = `'#######^^^^^^^^#########'` (строка карты, которая начинается с `#`, — ряд, а не комментарий).
- Ошибки `parseLevels` (текст ошибки содержит): BOM — `data/levels/x.txt: BOM в начале файла`; нет `par` — `нет строки par`; 12 рядов — `12 строк вместо 13`; ряд из 23 знаков — `23 знаков вместо 24`; знак `X` — `неизвестный знак «X»`; два `@` — `старт @ — 2 раз`; нет `F` — `флаг F — 0 раз`; нет `end` в конце файла — `последний уровень не закрыт строкой end`; строка `speed 3` — `неизвестная строка «speed 3»`; строка до первого `level` — `строка вне уровня`; `par -1` — `par = «-1» — нужно целое ≥ 0`.
- Повтор id: `allLevels(loadTables({ ...RAW, levels: { proto: RAW.levels.proto + '\n' + RAW.levels.proto } }))` — ошибка с `повтор id уровня p-01`.

### 3.3. `tests/unit/grid.test.ts`

- `p-02`: старт (1, 9), флаг (21, 9), лазеры `[{ c: 12, r: 9, phase: 0 }]`, плиты `[(12, 11)]`, двери (13, 7), (13, 8), (13, 9), пил нет. `tile(12, 9)` = `'.'` (клетка излучателя — воздух), `tile(13, 7)` = `'D'`, `tile(12, 11)` = `'P'`, `tile(-1, 5)` и `tile(24, 5)` = `'#'`, `tile(5, -1)` и `tile(5, 13)` = `'.'`.
- `p-03`: лазер `l` в (10, 2), `phase` = `DATA.num('laser_alt_phase_s')`.
- `p-05`: пилы по порядку обхода карты (по рядам сверху, в ряду слева): (12, 7), (19, 8), (5, 9), (8, 9); `isSaw(8, 9)` — да.

### 3.4. `tests/unit/hero.test.ts` — движение (через `Run` на картах из теста)

- `physicsFrom(DATA).jumpV` = √(2 × gravity × jump_height) из `DATA` (≈ 12,2474487).
- **Прыжок на ровном полу** (`FLAT`): нажатие на шаге 10, удержание h шагов. Событие `jump` — на шаге 10; событие `land` — на шаге 58 / 60 / 62 / 68 / 69 для h = 1 / 3 / 6 / 15 / 30; наибольший подъём (9,599 минус наименьший `hero.y` после прыжка) — 2,478979 / 2,634770 / 2,852228 / 3,398724 / 3,448724 (`toBeCloseTo(…, 5)`); `x` при приземлении минус `x` после шага прыжка — 3,6 / 3,75 / 3,9 / 4,35 / 4,425.
- **Стены** (`wallMap(h)`): для каждого шага нажатия k = 0 … 199 и удержания 1 или 30 шагов — попытка до 600 шагов; «проход» — `state` стало `done` раньше первой гибели. Число проходов: h = 2 — 126 при удержании 1 (шаги нажатия 74 … 199), 140 при 30 (60 … 199); h = 3 — 0 и 132 (68 … 199); h = 4 — 0 и 0.
- **Ямы без дна** (`gapMap(n)`), так же: n = 3 — 23 (74 … 96) и 33 (64 … 96); n = 4 — 10 (87 … 96) и 20 (77 … 96); n = 5 — 0 и 7 (90 … 96); n = 6 — 0 и 0. Эти числа совпадают с перебором на самом прототипе (GDD, «Желейка и физика»).
- **Койот-время.** Карта: земля в столбцах 0–9 и 14–23 (ряды 10–12), яма без дна в 10–13, старт (1, 9), флаг (21, 9). Без нажатий последний шаг на опоре — 117. Нажатие на 1 шаг на шаге 117 + k даёт событие `jump` (на том же шаге) при k = 0 … 5 и не даёт при k = 6 … 8 — смотреть до первой гибели.
- **Буфер прыжка** (`FLAT`): нажатие на шаге 10 на 1 шаг → `land` на шаге 58. Второе нажатие (на 1 шаг) на шаге 58 − n: при n = 0 … 5 второй прыжок — на шаге 59; при n = 6 … 9 второго прыжка нет (до шага 64).
- **Частота кадров.** `gapMap(10)`, без нажатий: попытка, которую шагает `FixedStep` кадрами 1000/30, 1000/60 и 1000/144 мс в сумме на 3000 мс, приходит в одно и то же: `hero.x` = 3,9, `hero.y` = 9,599, легион 1, `time` = 3 (до 1e-9), тела `[(10, 12)]`.

### 3.5. `tests/unit/hazards.test.ts`

- `laserOn` / `laserWarn` у лазера со сдвигом 0: горит при t = 0 и 1,4, не горит при 1,5 и 2,9; пунктир при 2,66, нет при 2,64 и 0,5. Со сдвигом 1,5: не горит при 0 и 1,49, горит при 1,5 и 2,99.
- `beamEnd` у лазера `p-02`: 11 (ряд плиты); с телом в (12, 10) — 10.
- `checkHazards` (желейка — `newHero` с заменёнными x, y; тел нет; лучи — `beamEnd` по уровню): `p-01` (9,5; 11,9) — `spike`, (9,5; 11,8) — нет; `p-05` (5,5 − 0,71; 9,5) — `saw`, (5,5 − 0,73; 9,5) — нет; `p-02` (20,81; 9,6) — `flag`, (20,79; 9,6) — нет; `p-02` (12,5; 10,6) при t = 0 — `laser` (с этим лазером), при t = 2 — нет, (12,5; 9,6) при t = 0 — нет (желейка на земле выше луча); `p-01` (9,5; 13,71) — `fall`, (9,5; 13,69) — нет. **Тело накрывает шипы:** `p-01` (9,5; 11,9) с телом в клетке шипов (9, 12) (`isBody` = да только для неё) — нет гибели; без тела — `spike`.

### 3.6. `tests/unit/freeze.test.ts`

Твёрдость для `placeBody` — как `Run.isSolid` (земля, плита, закрытая дверь, тело).
- `p-01`, тел нет: (9,3; 11,9) → (9, 11); (9,3; 12,5) → (9, 11) (опорная — шипы, выше свободно); с телом в (9, 11): (9,3; 11,9) → (9, 10); старт: (1,5; 9,6) → (1, 8).
- `p-02`: дверь (13,5; 8,5) → (12, 8); излучатель (12,5; 9,5) → (12, 8). `p-05`: пила (8,4; 9,2) → (8, 8).
- Замкнутые шипы — карта: ряд 7 — `'.....#..................'`, ряды 8 и 9 — `'....###.................'`, ряд 10 — `'....#^#.................'`, ряд 11 — `'.@..###..............F..'`, ряд 12 — `GROUND`, остальные пустые. (5,5; 10,5) → (5, 10) — тело накрывает шипы; (5,5; 9,5) → `null`.
- `freezeAnchor`: `fall` → (x желейки, 12,5); `laser` лазера (12, 9) при y = 9,6 → (12,5; 10,5), при y = 11,2 → (12,5; 11,2); `spike`, `saw`, `burst` → (x, y) желейки.

### 3.7. `tests/unit/mechanisms.test.ts`

- `p-02`, плита (12, 11): желейка стоит на плите (x 12,5; y = 11 − hero_half − 0,001; на опоре) — нажата; x 13,5 — нет; не на опоре — нет; мёртвая желейка и тело в (12, 10) — нажата.
- `doorsOpen` на `p-02` без нажатых плит: была открыта и живая желейка в двери (13,5; 9,6) — открыта; была закрыта — закрыта; желейка в (11,5; 9,6) — закрыта. На `p-01` (плит нет) — закрыта.

### 3.8. `tests/unit/stars.test.ts`

`starsFor(legion, par, DATA.num('stars_2_extra'))`: пар 3 — легион 0 … 3 → 3, 4 и 5 → 2, 6 → 1; пар 0 — 0 → 3, 1 и 2 → 2, 3 → 1.

### 3.9. `tests/unit/run.test.ts`

- `ready`: новая попытка `p-01`, 120 шагов — `hero.x` = 1,5, `time` = 0, событий нет. `press()` — `state` = `play` и событие `start`; после первого шага событий нет, `vy` = 0, на опоре, `x` = 1,575. Второе `press()` — событие `jump` на следующем шаге.
- `p-02` без нажатий после старта, события по шагам: 160 — `land` (12,599; 10,599 — на плите); 180 — `death` (`laser`) и `freeze` (12, 10); 205 — `respawn` (через 25 шагов); 463 — `finish` (легион 1, звёзды 3, `time` = 464/60 до 1e-9). После финиша `step` ничего не меняет.
- `p-01` без нажатий, первые восемь гибелей: на шагах 100, 226, 386, 546, 733, 920, 1134 (`spike`) и 1491 (`burst`); тела по порядку (9, 11), (8, 11), (11, 11), (10, 11), (13, 11), (12, 11), (14, 11), (14, 10).
- `p-03` без нажатий, первые восемь гибелей — лопания (`burst`), восьмое тело — (1, 8): клетка старта (1, 9) телу не достаётся (в прототипе там было тело).
- `p-05` без нажатий: первая гибель — `saw` на шаге 43, тело (4, 9).
- Стена: `FLAT` и стена `#` в столбце 10, ряды 5–9 — гибель `burst` на шаге 264, тело (9, 9), `hero.x` = 9,599.
- `restart()` после 300 шагов `p-01` (два тела): `state` = `ready`, тел нет, легион 0, `time` = 0, желейка на старте, последнее событие — `restart`.
- Два прогона `p-06` с одним и тем же сценарием (7 нажатий, 1800 шагов; легион должен выйти больше нуля) — одинаковые тела, легион и `time`.

## 4. Смоук — `tests/e2e/smoke.spec.ts` (дословно)

Первый тест — прежний смоук с версией 0.0.2. Второй — ядро в собранной игре: в `ready` желейка стоит; «Плита» без прыжков — финиш, легион 1, три звезды, тело (12, 10), время 7,7333 с.

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

  const before = await page.evaluate(() => window.__game!.gameMs());
  await page.waitForTimeout(1000);
  const after = await page.evaluate(() => window.__game!.gameMs());
  expect(after).toBeGreaterThan(before + 300);

  const layout = await page.evaluate(() => window.__game!.layout());
  expect(layout).toBe(info.project.name === 'phone' ? 'portrait' : 'landscape');

  const calls = await page.evaluate(() => window.__game!.platformLog().map((c) => c.name));
  expect(calls).toContain('loadingFinished');

  // Сборка `npm run check` идёт без метки публикации.
  expect(await page.evaluate(() => window.__game!.build)).toBe('dev');
  // Язык страницы берётся из браузера: ru — «Желейный легион», иначе «Jelly Legion».
  await expect(page.getByTestId('debug-line')).toContainText(/(Желейный легион|Jelly Legion) 0\.0\.2/);

  await page.screenshot({ path: `build/shots/s0_${info.project.name}.png` });
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

## 5. Критерии готовности
- Файлы §1, §2 и §3.1, §4 — дословно; остальные тесты §3 — по рецептам, числа — как в рецептах.
- `npm run check` зелёный: data-check как прежде; Vitest — все файлы зелёные, в том числе сверка с прототипом (17 остановок по правке, 307 106 шагов); сборка до 3 МБ; Playwright `4 passed`.
- `npm run test` — до 30 с.
- В `docs/tasks/README.md` — строка M0-01 «сделано ДД.ММ».

## Если что-то не так
- Если рецепт теста не сходится с кодом §1 — не правь код ядра под тест: проверь, так ли устроен тест (нумерация шагов, нажатие перед шагом), и опиши расхождение в отчёте с числами.
- Если сверка с прототипом падает — приложи первые строки `mismatches`.

## Отчёт
Что сделано; итоговые строки `npm run check` (число тестов, размер сборки, Playwright); какие рецепты потребовали толкования и как ты их понял; что не получилось и почему.
