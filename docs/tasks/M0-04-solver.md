# M0-04 — бот-решатель и пар

**Цель.** Бот играет настоящим ядром игры без отрисовки и ищет наименьшее число гибелей, с которым уровень проходится, — это пар (GDD «Бот-решатель», «Звёзды, пар и время»). Команда `npm run solve` решает все уровни, печатает отчёт и пишет решения в `data/solutions/<набор>.json`; тест в `npm run test` повторяет каждое решение ядром — сторож того, что правка правил или карты не сломала уровень. Пар шести уровней прототипа заменяется числами бота (по GDD: «с появлением бота в файл уровня пишется его число»).

**Что изменится в игре.** Пар уровней прототипа: «Яма» 3 → 1, «Плита» 1, «Лазер» 1 → 0, «Лестница» 2, «Пилы» 3 → 0, «Всё вместе» 4 → 1. Строка счёта и окно итога покажут новые числа, звёзды считаются по ним. Версия 0.0.5. Остальное в игре не меняется.

Перед началом прочитай `CLAUDE.md`, `docs/ARCHITECTURE.md` (§2, §10), `docs/TESTPLAN.md` (§5), `data/README.md` (разделы про уровни и решения) и в `docs/GDD.md` раздел «Бот-решатель».

**Проверка до передачи.** Код ниже написан Claude и прогнан 09.10.2026 в песочнице поверх M0-03: `npm run solve` — около 20 с, вывод — как в §4; `npm run check` зелёный, Vitest — 21 файл, 98 тестов; Playwright — 15 сценариев и 1 пропущен. Пределы поиска подобраны замером: нажатие раз в 3 шага находит тот же пар, что и каждый шаг (проверено на всех шести уровнях; каждый шаг — в 15 раз дольше). Пробная сборка независимым исполнителем по этому тексту: около 10 минут, всё с первого раза, вывод `npm run solve` и `proto.json` совпали с §4 байт в байт; после неё полное удержание бота стало 30 шагов вместо 15 (удержание действует 16 шагов: время копится шагами по 1/60), тесты повтора вынесены в `replay.test.ts`, уточнены §4 и замечание «решение короче 15 с».

**Условие.** M0-03 сделана (в `docs/tasks/README.md` у M0-03 стоит «сделано …»). Если нет — остановись и напиши об этом в отчёте.

## 1. Файлы — дословно

Как это устроено. Состояние уровня — тела и фаза лазеров к рождению желейки; бот перебирает их в ширину по числу гибелей и склеивает одинаковые. Жизнь желейки — перебор нажатий (до трёх прыжков, удержание короткое или полное) со склейкой одинаковых состояний желейки на каждом шаге; ветки идут копиями попытки (`Run.clone()`). Первое число гибелей, при котором жизнь доходит до флага, — пар; из решений с этим числом берётся самое быстрое. «Окно» — запас нажатия: сколько подряд шагов годятся для каждого нажатия решения (6 шагов = 0,1 с; меньше — пометка «узкое окно»). Пометка «решение короче 15 с» (GDD: решение — 15–40 с) для набора `proto` не ставится: уровни прототипа короткие, 4–12 с. Бот подаёт те же команды `press`/`release`, что палец (CLAUDE.md, правило 7). `npm run solve` собирается Vite (`tools/solve.config.ts`), потому что ядро — TypeScript, а таблицы и уровни подключаются через `?raw`.

### 1.1. `src/core/run.ts` — заменить целиком

Две правки к M0-01: конструктор принимает готовую сетку (`grid?`), и метод `clone()` — копия попытки, которая делит сетку.

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

  /** Копия попытки для перебора ботом: своя желейка, тела, время и нажатия, сетка общая, событий нет. */
  clone(): Run {
    const r = new Run(this.def, this.P, this.grid);
    r.state = this.state;
    r.hero = { ...this.hero };
    r.bodies = this.bodies.slice();
    r.bodyKeys = new Set(this.bodyKeys);
    r.legion = this.legion;
    r.time = this.time;
    r.doorOpen = this.doorOpen;
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
```

### 1.2. `src/core/solver/solve.ts`

```ts
import type { Cell } from '../grid';
import type { LevelDef } from '../levels';
import type { Physics } from '../physics';
import { Run } from '../run';

/** Нажатие: шаг уровня (от первого нажатия, 60 шагов в секунду) и сколько шагов держать. */
export interface Tap {
  at: number;
  hold: number;
}

export interface SolveOptions {
  /** Нажатия пробуются на шагах, кратных этому числу. */
  pressEvery: number;
  /** Длины удержания, шагов: короткое и полное (дольше hold_max_s — до конца действия удержания). */
  holds: readonly number[];
  /** Прыжков за одну жизнь желейки, не больше. */
  maxJumps: number;
  /** Шагов одной жизни, не больше. */
  maxLifeSteps: number;
  /** Гибелей, не больше: дальше поиск сдаётся. */
  maxDeaths: number;
}

/**
 * Пределы поиска M0-04, подобраны замером на уровнях прототипа: нажатие раз в 3 шага (0,05 с) находит тот же пар,
 * что и каждый шаг, при переборе в разы меньше; три прыжка за жизнь хватает всем шести уровням.
 * Полное удержание — вдвое дольше hold_max_s: удержание действует, пока с отрыва прошло меньше hold_max_s
 * (это 16 шагов, а не 15: время копится шагами по 1/60), а держать дольше — то же самое.
 */
export function solverOptions(P: Physics): SolveOptions {
  return { pressEvery: 3, holds: [1, Math.round(P.holdMax * 60) * 2], maxJumps: 3, maxLifeSteps: 900, maxDeaths: 8 };
}

export interface Solution {
  found: boolean;
  /** Наименьшее число гибелей (пар); −1 — не найдено в пределах поиска. */
  par: number;
  /** Время уровня у решения, шагов. */
  steps: number;
  taps: Tap[];
  /** Состояний уровня (тела и фаза лазеров к рождению желейки) разобрано. */
  nodes: number;
  /** Шагов желейки просчитано. */
  states: number;
}

const STEP_MS = 1000 / 60;

interface Node {
  run: Run;
  step: number;
  taps: Tap[];
}

interface Branch {
  run: Run;
  taps: Tap[];
  releaseAt: number;
  jumps: number;
}

/** Состояние живой желейки и нажатий на шаге f: одинаковые ветки дальше идут одинаково и склеиваются. */
function branchKey(b: Branch, f: number): string {
  const h = b.run.hero;
  const left = b.releaseAt > f ? b.releaseAt - f : 0;
  return [
    Math.round(h.x * 1e6),
    Math.round(h.y * 1e6),
    Math.round(h.vy * 1e5),
    h.grounded ? 1 : 0,
    Math.round(h.coyote * 1e4),
    Math.round(h.holdT * 1e4),
    h.jumping ? 1 : 0,
    Math.round(h.stuckT * 1e3),
    Math.round(h.maxX * 1e4),
    b.run.ctl.held ? 1 : 0,
    left,
    b.run.doorOpen ? 1 : 0,
  ].join(' ');
}

function bodiesKey(bodies: readonly Cell[]): string {
  return bodies
    .map((b) => b.r * 100 + b.c)
    .sort((a, b) => a - b)
    .join(',');
}

/**
 * Бот-решатель (GDD «Бот-решатель»): играет настоящим ядром (Run) теми же командами press/release, что палец.
 * Поиск в ширину по числу гибелей: состояние уровня — тела и фаза лазеров к рождению желейки, одинаковые склеиваются.
 * Жизнь желейки — перебор нажатий (не больше maxJumps прыжков, удержание из holds) со склейкой одинаковых
 * состояний на каждом шаге. Первое число гибелей, при котором жизнь доходит до флага, — пар; из решений с этим
 * числом гибелей берётся самое быстрое.
 */
export function solve(def: LevelDef, P: Physics, opt: SolveOptions = solverOptions(P)): Solution {
  const periodSteps = Math.round(P.laserPeriod * 60);
  const root = new Run(def, P);
  const lasers = root.grid.lasers.length > 0;
  root.press(); // первая желейка ждёт: первое нажатие только запускает бег
  root.release();
  root.drainEvents();
  let frontier: Node[] = [{ run: root, step: 0, taps: [] }];
  const seen = new Set<string>(['|0']);
  let nodes = 0;
  let states = 0;
  for (let deaths = 0; deaths <= opt.maxDeaths; deaths++) {
    let best: { steps: number; taps: Tap[] } | null = null;
    const next = new Map<string, Node>();
    for (const node of frontier) {
      nodes++;
      let live = new Map<string, Branch>([['', { run: node.run.clone(), taps: [], releaseAt: -1, jumps: 0 }]]);
      for (let f = node.step; live.size > 0 && f < node.step + opt.maxLifeSteps; f++) {
        if (best && f >= best.steps) break; // быстрее найденного решения эта жизнь уже не успеет
        const after = new Map<string, Branch>();
        for (const b of live.values()) {
          const h = b.run.hero;
          const canJump = f % opt.pressEvery === 0 && b.jumps < opt.maxJumps && b.releaseAt <= f && (h.grounded || h.coyote > 0);
          const choices: Array<number | null> = canJump ? [null, ...opt.holds] : [null];
          for (let i = 0; i < choices.length; i++) {
            const hold = choices[i]!;
            const run = i === choices.length - 1 ? b.run : b.run.clone();
            const nb: Branch = { run, taps: b.taps, releaseAt: b.releaseAt, jumps: b.jumps };
            if (nb.releaseAt === f) run.release();
            if (hold !== null) {
              run.press();
              nb.taps = [...b.taps, { at: f, hold }];
              nb.releaseAt = f + hold;
              nb.jumps++;
            }
            run.step(STEP_MS);
            states++;
            if (run.state === 'done') {
              if (!best || f + 1 < best.steps) best = { steps: f + 1, taps: [...node.taps, ...nb.taps] };
              continue;
            }
            if (!run.hero.alive) {
              // Гибель: отпустить кнопку и дождаться рождения следующей желейки — это новое состояние уровня.
              run.release();
              let g = f + 1;
              while (!run.hero.alive) {
                run.step(STEP_MS);
                g++;
              }
              run.drainEvents();
              const key = `${bodiesKey(run.bodies)}|${lasers ? g % periodSteps : 0}`;
              if (!seen.has(key) && !next.has(key)) next.set(key, { run, step: g, taps: [...node.taps, ...nb.taps] });
              continue;
            }
            run.drainEvents();
            const k = branchKey(nb, f + 1);
            const old = after.get(k);
            if (!old || old.jumps > nb.jumps) after.set(k, nb);
          }
        }
        live = after;
      }
    }
    if (best) return { found: true, par: deaths, steps: best.steps, taps: best.taps, nodes, states };
    for (const k of next.keys()) seen.add(k);
    frontier = [...next.values()];
    if (frontier.length === 0) break;
  }
  return { found: false, par: -1, steps: 0, taps: [], nodes, states };
}
```

### 1.3. `src/core/solver/replay.ts`

```ts
import type { LevelDef } from '../levels';
import type { Physics } from '../physics';
import { Run } from '../run';
import type { Tap } from './solve';

const STEP_MS = 1000 / 60;

export interface ReplayResult {
  done: boolean;
  legion: number;
  /** Шагов до флага (или до предела). */
  steps: number;
}

/**
 * Повтор решения с начала уровня теми же командами, что у пальца: первое нажатие — старт, затем на шаге f
 * сначала release() (кончилось удержание), потом press(), потом step — как в прогонах тестов и у бота.
 */
export function replay(def: LevelDef, P: Physics, taps: readonly Tap[], maxSteps = 6000): ReplayResult {
  const run = new Run(def, P);
  run.press();
  run.release();
  const releases = new Set(taps.map((t) => t.at + t.hold));
  const presses = new Set(taps.map((t) => t.at));
  let f = 0;
  for (; f < maxSteps && run.state !== 'done'; f++) {
    if (releases.has(f)) run.release();
    if (presses.has(f)) run.press();
    run.step(STEP_MS);
  }
  return { done: run.state === 'done', legion: run.legion, steps: f };
}

/**
 * Запас решения: для каждого нажатия — сколько подряд шагов (включая найденный) можно нажать раньше или позже,
 * и уровень всё так же проходится с тем же числом гибелей. Остальные нажатия при этом на месте; считаем до cap.
 * Окно в 1 шаг — нажатие «кадр в кадр», живому игроку почти недоступно; 6 шагов — 0,1 с.
 */
export function pressWindows(def: LevelDef, P: Physics, taps: readonly Tap[], cap = 12): number[] {
  const base = replay(def, P, taps);
  const ok = (moved: Tap[]): boolean => {
    const r = replay(def, P, moved);
    return r.done && r.legion === base.legion;
  };
  return taps.map((_, i) => {
    let width = 1;
    for (const dir of [-1, 1]) {
      for (let d = dir; width < cap; d += dir) {
        const moved = taps.map((t, j) => (j === i ? { at: t.at + d, hold: t.hold } : t));
        if (moved[i]!.at < 0 || !ok(moved)) break;
        width++;
      }
    }
    return width;
  });
}

/** Отпечаток карты уровня (FNV-1a по строкам карты): сохранённое решение верно, только пока карта та же. */
export function mapHash(def: LevelDef): string {
  let h = 0x811c9dc5;
  for (const ch of def.map.join('\n')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
```

### 1.4. `tools/solve.ts`

```ts
// Бот-решатель всех уровней игры: `npm run solve` (GDD «Бот-решатель», TESTPLAN §5).
// Для каждого уровня — пар (наименьшее число гибелей), время решения, запас нажатий и объём перебора;
// решения пишутся в data/solutions/<набор>.json (их проверяет tests/unit/solutions.test.ts). Код выхода 1 —
// пар в файле уровня не равен найденному или уровень не решён в пределах поиска.
// Собирается Vite (tools/solve.config.ts): ядро — TypeScript, таблицы и уровни подключаются через ?raw.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allLevels } from '../src/core/levels';
import { physicsFrom } from '../src/core/physics';
import { mapHash, pressWindows } from '../src/core/solver/replay';
import { solve, solverOptions } from '../src/core/solver/solve';
import { DATA } from '../src/data';

/** Запас нажатия, который по силам живому игроку: 6 шагов = 0,1 с. Меньше — пометка «узкое окно». */
const HUMAN_WINDOW = 6;

const P = physicsFrom(DATA);
const opt = solverOptions(P);
const levels = allLevels(DATA);

console.log(
  `solve: уровней ${levels.length}; нажатие раз в ${opt.pressEvery} шага, удержание ${opt.holds.join(' и ')} шагов, ` +
    `до ${opt.maxJumps} прыжков за жизнь, до ${opt.maxDeaths} гибелей`,
);
const widths = [9, 7, 9, 9, 7, 22, 8];
const row = (cells: string[]): string => cells.map((c, i) => (i < widths.length ? c.padEnd(widths[i]!) : c)).join('');
console.log(row(['уровень', 'пар', 'бот', 'время', 'окно', 'перебор', 'мс', 'замечания']));

let failed = 0;
const sets = new Map<string, string[]>();
for (const def of levels) {
  const t0 = performance.now();
  const s = solve(def, P, opt);
  const ms = Math.round(performance.now() - t0);
  const windows = s.found ? pressWindows(def, P, s.taps) : [];
  const minWindow = windows.length > 0 ? Math.min(...windows) : null;
  const notes: string[] = [];
  if (!s.found) notes.push(`не решён за ${opt.maxDeaths} гибелей`);
  else if (s.par !== def.par) notes.push(`пар в файле ${def.par}, у бота ${s.par}: поправь par в data/levels/${def.file}.txt`);
  if (minWindow !== null && minWindow < HUMAN_WINDOW) notes.push('узкое окно нажатия');
  if (s.found && def.file !== 'proto' && s.steps / 60 < 15) notes.push('решение короче 15 с');
  if (!s.found || s.par !== def.par) failed++;
  console.log(
    row([
      def.id,
      String(def.par),
      s.found ? String(s.par) : '—',
      s.found ? `${(s.steps / 60).toFixed(1)} с` : '—',
      minWindow === null ? '—' : String(minWindow),
      `${s.states} / ${s.nodes}`,
      String(ms),
      notes.join('; '),
    ]),
  );
  const entry = s.found
    ? { map: mapHash(def), par: s.par, steps: s.steps, windows, taps: s.taps.map((t) => [t.at, t.hold]) }
    : { map: mapHash(def), par: -1 };
  const lines = sets.get(def.file) ?? [];
  lines.push(`    ${JSON.stringify(def.id)}: ${JSON.stringify(entry)}`);
  sets.set(def.file, lines);
}
console.log('пар — в файле уровня; бот — найденный; время — решения бота; окно — наименьший запас нажатия, шагов по 1/60 с;');
console.log('перебор — шагов желейки / состояний уровня.');

mkdirSync(join(process.cwd(), 'data', 'solutions'), { recursive: true });
for (const [file, lines] of sets) {
  const text = `{\n  "note": "Решения бота-решателя: пишет npm run solve, руками не править.",\n  "levels": {\n${lines.join(',\n')}\n  }\n}\n`;
  writeFileSync(join(process.cwd(), 'data', 'solutions', `${file}.json`), text);
  console.log(`solve: решения записаны в data/solutions/${file}.json`);
}
if (failed > 0) {
  console.error(`solve: расхождений ${failed}`);
  process.exit(1);
}
console.log('solve: ok — пар каждого уровня равен найденному ботом');
```

### 1.5. `tools/solve.config.ts`

```ts
import { defineConfig } from 'vite';

// Сборка бота-решателя для Node: `npm run solve` собирает tools/solve.ts в build/solve/solve.mjs и запускает его.
// Vite нужен, потому что ядро — TypeScript, а таблицы и уровни подключаются через ?raw (src/data.ts).
export default defineConfig({
  logLevel: 'warn',
  build: {
    ssr: 'tools/solve.ts',
    outDir: 'build/solve',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'solve.mjs' } },
  },
});
```

### 1.6. `package.json` — скрипт и версия

В `"scripts"` после `"publish"` — строка (запятая после строки `"publish"`):

```json
    "solve": "vite build --config tools/solve.config.ts && node build/solve/solve.mjs"
```

`"version": "0.0.5"`, затем `npm install` (обновит версию в `package-lock.json`, зависимости те же).

### 1.7. `tsconfig.json`

В `"include"` добавить `"tools/**/*.ts"` (проверка типов `tsc` берёт и бота):

```json
  "include": ["src", "tests", "tools/**/*.ts", "vite.config.ts", "playwright.config.ts"]
```

### 1.8. `src/main.ts` — версия

`const VERSION = '0.0.5';`

### 1.9. `data/levels/proto.txt` — пар по боту

После строки `# Название и подсказка уровня — …` добавить строку комментария:

```
# Пар — число бота-решателя (npm run solve, M0-04); в прототипе было 3, 1, 1, 2, 3, 4.
```

И поменять строки `par` (карты не трогать): `p-01` — `par 1`, `p-02` — `par 1` (как было), `p-03` — `par 0`, `p-04` — `par 2` (как было), `p-05` — `par 0`, `p-06` — `par 1`. Затем `npm run data` — ok.

## 2. Тесты

### 2.1. `tests/unit/solve.test.ts` — дословно

Копия попытки и бот на маленьких картах прямо в тесте: ровный пол, яма без дна, широкая яма с шипами, стена до неба.

```ts
import { describe, expect, it } from 'vitest';
import { parseLevels, type LevelDef } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { Run } from '../../src/core/run';
import { replay } from '../../src/core/solver/replay';
import { solve, solverOptions } from '../../src/core/solver/solve';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
const STEP = 1000 / 60;
const AIR = '........................';
const GROUND = '########################';

/** Уровень из 13 строк карты прямо в тесте. */
function levelOf(map: readonly string[]): LevelDef {
  return parseLevels(`level t-1\npar 0\nmap\n${map.join('\n')}\nend\n`, 'test', 24, 13)[0]!;
}

/** Ряды 0…8 — воздух, ряд 9 — старт (1, 9) и флаг (21, 9), ряды 10…12 — пол floor (на дне — bottom). */
function lvl(floor: string, bottom = floor): LevelDef {
  return levelOf([...Array<string>(9).fill(AIR), '.@...................F..', floor, floor, bottom]);
}

/** Яма шириной n со столбца 8: без дна или с шипами на дне. */
const gap = (n: number): string => '#'.repeat(8) + '.'.repeat(n) + '#'.repeat(24 - 8 - n);

describe('копия попытки', () => {
  it('копия идёт сама по себе, а одинаковые команды дают одно и то же', () => {
    const def = lvl(gap(6));
    const a = new Run(def, P);
    a.press();
    a.release();
    for (let i = 0; i < 60; i++) a.step(STEP);
    const b = a.clone();
    expect(b.grid).toBe(a.grid);
    for (let i = 0; i < 90; i++) b.step(STEP);
    expect(a.time).toBeCloseTo(1, 9);
    expect(b.bodies.length).toBe(1);
    expect(a.bodies.length).toBe(0);
    for (let i = 0; i < 90; i++) a.step(STEP);
    expect(a.hero).toEqual(b.hero);
    expect(a.bodies).toEqual(b.bodies);
    expect(a.legion).toBe(b.legion);
    expect(a.drainEvents().map((e) => e.type)).toContain('death');
    expect(b.drainEvents().map((e) => e.type)).toContain('death');
  });
});

describe('бот-решатель', () => {
  it('ровный пол: пар 0, без нажатий', () => {
    const def = lvl(GROUND);
    const s = solve(def, P);
    expect(s.found).toBe(true);
    expect(s.par).toBe(0);
    expect(s.taps).toEqual([]);
    expect(s.steps).toBe(replay(def, P, []).steps);
  });

  it('яма без дна в 4 клетки: перепрыгивается без гибелей', () => {
    const def = lvl(gap(4));
    expect(replay(def, P, []).legion).toBeGreaterThan(0); // без прыжков яму заполняют телами
    const s = solve(def, P);
    expect(s.par).toBe(0);
    expect(s.taps.length).toBeGreaterThan(0);
    const r = replay(def, P, s.taps);
    expect(r).toEqual({ done: true, legion: 0, steps: s.steps });
  });

  it('широкая яма с шипами: без тел не пройти, решение повторяется', () => {
    const pit = '#'.repeat(7) + '.'.repeat(8) + '#'.repeat(9);
    const def = lvl(pit, '#'.repeat(7) + '^'.repeat(8) + '#'.repeat(9));
    const s = solve(def, P);
    expect(s.found).toBe(true);
    expect(s.par).toBeGreaterThanOrEqual(1);
    const r = replay(def, P, s.taps);
    expect(r.done).toBe(true);
    expect(r.legion).toBe(s.par);
    expect(r.steps).toBe(s.steps);
  });

  it('стена до неба: в пределах поиска не решается', () => {
    const wall = '...........#............';
    const def = levelOf([...Array<string>(9).fill(wall), '.@.........#.........F..', GROUND, GROUND, GROUND]);
    const s = solve(def, P, { ...solverOptions(P), maxDeaths: 2 });
    expect(s.found).toBe(false);
    expect(s.par).toBe(-1);
    expect(s.nodes).toBeGreaterThan(1);
  });
});
```

### 2.2. `tests/unit/replay.test.ts` — дословно

Повтор решения, запас нажатий (окна сверены с числами тестов M0-01: яма в 4 клетки с полным удержанием проходится при нажатии на шагах 77…96) и отпечаток карты.

```ts
import { describe, expect, it } from 'vitest';
import { parseLevels, type LevelDef } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { Run } from '../../src/core/run';
import { mapHash, pressWindows, replay } from '../../src/core/solver/replay';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
const AIR = '........................';
const GROUND = '########################';

/** Ряды 0…8 — воздух, ряд 9 — старт (1, 9) и флаг (21, 9), ряды 10…12 — пол floor. */
function lvl(floor: string): LevelDef {
  const map = [...Array<string>(9).fill(AIR), '.@...................F..', floor, floor, floor];
  return parseLevels(`level t-1\npar 0\nmap\n${map.join('\n')}\nend\n`, 'test', 24, 13)[0]!;
}

/** Яма без дна шириной n со столбца 8 — как gapMap в тестах M0-01. */
const gap = (n: number): string => '#'.repeat(8) + '.'.repeat(n) + '#'.repeat(24 - 8 - n);

describe('повтор решения', () => {
  it('без нажатий — тот же прогон, что у ядра', () => {
    const def = lvl(GROUND);
    const run = new Run(def, P);
    run.press();
    run.release();
    let steps = 0;
    while (run.state !== 'done') {
      run.step(1000 / 60);
      steps++;
    }
    expect(replay(def, P, [])).toEqual({ done: true, legion: 0, steps });
  });

  it('предел шагов: прогон обрывается', () => {
    expect(replay(lvl(GROUND), P, [], 10)).toEqual({ done: false, legion: 0, steps: 10 });
  });

  it('яма без дна: без прыжков её заполняют телами, прыжок вовремя — без гибелей', () => {
    const def = lvl(gap(4));
    expect(replay(def, P, []).legion).toBeGreaterThan(0);
    expect(replay(def, P, [{ at: 86, hold: 30 }])).toMatchObject({ done: true, legion: 0 });
  });
});

describe('запас нажатий', () => {
  it('у решения без нажатий окон нет', () => {
    expect(pressWindows(lvl(GROUND), P, [])).toEqual([]);
  });

  it('яма в 4 клетки, полное удержание: нажатие годится на шагах 77…96 (как в тестах M0-01)', () => {
    const def = lvl(gap(4));
    expect(pressWindows(def, P, [{ at: 77, hold: 30 }], 30)).toEqual([20]);
    expect(pressWindows(def, P, [{ at: 96, hold: 30 }], 30)).toEqual([20]);
    expect(pressWindows(def, P, [{ at: 86, hold: 30 }])).toEqual([12]); // предел cap = 12
    // Удержание 15 шагов чуть короче полного (действует 16 шагов): окно на шаг уже.
    expect(pressWindows(def, P, [{ at: 78, hold: 15 }], 30)).toEqual([19]);
  });
});

describe('отпечаток карты', () => {
  it('тот же для той же карты и другой для другой', () => {
    expect(mapHash(lvl(GROUND))).toBe(mapHash(lvl(GROUND)));
    expect(mapHash(lvl(gap(4)))).not.toBe(mapHash(lvl(gap(5))));
    expect(mapHash(lvl(GROUND))).toMatch(/^[0-9a-f]{8}$/);
  });
});
```

### 2.3. `tests/unit/solutions.test.ts` — дословно

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { mapHash, replay } from '../../src/core/solver/replay';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);

interface Stored {
  map: string;
  par: number;
  steps: number;
  taps: Array<[number, number]>;
}

/**
 * Сторож уровней (GDD «Бот-решатель»): решение бота из data/solutions/<набор>.json повторяется настоящим ядром
 * и доходит до флага ровно с паром из файла уровня. Правка правил, которая ломает уровень, роняет этот тест;
 * правка карты — тоже (отпечаток карты): после неё — `npm run solve`.
 */
describe('решения бота', () => {
  for (const def of allLevels(DATA)) {
    it(`${def.id}: решение доходит до флага с паром ${def.par}`, () => {
      const file = JSON.parse(readFileSync(new URL(`../../data/solutions/${def.file}.json`, import.meta.url), 'utf8')) as {
        levels: Record<string, Stored>;
      };
      const s = file.levels[def.id];
      expect(s, `нет решения ${def.id} — запусти npm run solve`).toBeDefined();
      expect(s!.map, `карта ${def.id} изменилась — запусти npm run solve`).toBe(mapHash(def));
      expect(s!.par, `пар в файле уровня не равен пару бота`).toBe(def.par);
      const r = replay(def, P, s!.taps.map(([at, hold]) => ({ at, hold })));
      expect(r).toEqual({ done: true, legion: def.par, steps: s!.steps });
    });
  }
});
```

### 2.4. `tests/unit/levels.test.ts` — одна правка

В тесте «шесть уровней прототипа» (его писал Claude Code по рецепту M0-01) пар — новые числа:

```ts
    expect(levels.map((l) => l.par)).toEqual([1, 1, 0, 2, 0, 1]);
```

### 2.5. `tests/e2e/smoke.spec.ts` — одна правка

Версия в проверке отладочной строки — `/(Желейный легион|Jelly Legion) 0\.0\.5/`.

## 3. Порядок
1. Файлы §1 и правки §2.4–2.5, `npm install`, `npm run data`.
2. `npm run solve` — создаст `data/solutions/proto.json`; вывод сверить с §4.
3. Тесты §2.1–2.3, `npm run check`.

## 4. Ожидаемый вывод `npm run solve`

Сверять строки программы — от `solve: уровней` до `solve: ok` (выше npm печатает свои строки `> jelly@0.0.5 solve` и команду сборки). На ноутбуке может отличаться только столбец «мс» — время работы бота; в строках без замечаний после него — пробелы до ширины столбца. Остальное — точно так:

```
solve: уровней 6; нажатие раз в 3 шага, удержание 1 и 30 шагов, до 3 прыжков за жизнь, до 8 гибелей
уровень  пар    бот      время    окно   перебор               мс      замечания
p-01     1      1        6.7 с    3      31390 / 6             …       узкое окно нажатия
p-02     1      1        7.7 с    —      829007 / 31           …
p-03     0      0        5.4 с    12     104940 / 1            …
p-04     2      2        12.0 с   2      6526109 / 164         …       узкое окно нажатия
p-05     0      0        4.3 с    6      2679 / 1              …
p-06     1      1        7.8 с    1      4975652 / 138         …       узкое окно нажатия
пар — в файле уровня; бот — найденный; время — решения бота; окно — наименьший запас нажатия, шагов по 1/60 с;
перебор — шагов желейки / состояний уровня.
solve: решения записаны в data/solutions/proto.json
solve: ok — пар каждого уровня равен найденному ботом
```

`data/solutions/proto.json` должен совпасть с этим текстом:

```json
{
  "note": "Решения бота-решателя: пишет npm run solve, руками не править.",
  "levels": {
    "p-01": {"map":"010773f3","par":1,"steps":399,"windows":[3,12,4],"taps":[[57,1],[219,1],[276,1]]},
    "p-02": {"map":"7823ae22","par":1,"steps":464,"windows":[],"taps":[]},
    "p-03": {"map":"a6c51560","par":0,"steps":324,"windows":[12],"taps":[[156,1]]},
    "p-04": {"map":"308c86e7","par":2,"steps":720,"windows":[11,12,2],"taps":[[402,1],[567,1],[612,30]]},
    "p-05": {"map":"04c8533a","par":0,"steps":258,"windows":[6,9,11],"taps":[[18,1],[69,1],[120,30]]},
    "p-06": {"map":"242974c3","par":1,"steps":465,"windows":[1,9,2,2],"taps":[[42,30],[246,1],[297,1],[423,30]]}
  }
}
```

## 5. Критерии готовности
- Файлы §1 и тесты §2.1–2.3 — дословно, правки §1.6–1.9 и §2.4–2.5 — как написано.
- `npm run solve` — код выхода 0, вывод и `data/solutions/proto.json` — как в §4.
- `npm run check` зелёный: Vitest — прежние файлы и три новых (`solve.test.ts`, `replay.test.ts`, `solutions.test.ts`; на ноутбуке после M0-03 было 18 файлов, станет 21), `npm run test` — до 30 с; сборка до 3 МБ; Playwright — 15 passed, 1 skipped.
- `npm run publish -- --dry-run` — строка `publish: Желейный легион 0.0.5 (<хеш>+), …`.
- В `docs/tasks/README.md` — строка M0-04 «сделано ДД.ММ».

## Если что-то не так
- Если `npm run solve` даёт другие пар, время или решения — ничего не подгоняй: приложи вывод целиком и `data/solutions/proto.json`.
- Если `npm run test` дольше 30 с — напиши, сколько идёт каждый файл (`npx vitest run --reporter=verbose`).

## Отчёт
Что сделано; вывод `npm run solve` целиком; итоговые строки `npm run check`; строка `publish --dry-run`; что не получилось и почему.
