# M0-05 — бот с запасом: пар, который человек может повторить

**Цель.** Пар и подсказка-призрак — по боту с запасом (решение Никиты 09.10; GDD «Звёзды, пар и время» и «Бот-решатель», пункт «Запас»). В его решении у каждого нажатия есть окно не меньше 0,1 с — 6 шагов подряд, где нажатие (при остальных нажатиях на месте) даёт тот же исход жизни желейки: тело в той же клетке или флаг. Короткий тап проходит с любой длиной до 0,1 с. Нажатие решения может стоять у края своего окна — середину окна для подсказки-призрака возьмёт M4. Строгий бот M0-04 (точность 1/60 с, тап 1/60 с) остаётся нижней границей: строгий пар не может быть больше пара с запасом. `npm run solve` считает оба и пишет решения бота с запасом; тест решений проверяет и запас; новый тест сторожит самого бота на быстрых уровнях прототипа.

**Что изменится в игре.** Пар «Пил» 0 → 1, «Всего вместе» 1 → 2; у остальных тот же (1, 1, 0, 2). Строка счёта и окно итога покажут новые числа, звёзды считаются по ним. Версия 0.0.6. Остальное в игре не меняется.

Перед началом прочитай `CLAUDE.md`, `docs/ARCHITECTURE.md` (§2, §10), `docs/TESTPLAN.md` (§5), `data/README.md` (раздел «Решения бота») и в `docs/GDD.md` разделы «Звёзды, пар и время» и «Бот-решатель».

**Проверка до передачи.** Код ниже написан Claude и прогнан 09.10.2026 в песочнице поверх M0-04 (состояние ноутбука после коммита `f484c80`): `npm run solve` — около 80 с (из них «Всё вместе» — около 63 с), вывод — как в §4; `npm run check` зелёный, Vitest — 22 файла, 113 тестов; Playwright — 15 сценариев и 1 пропущен. Строгий бот после выноса перебора жизни в общую функцию `searchLife` даёт те же решения и тот же перебор, что в M0-04, шаг в шаг. Решения бота с запасом перепроверены отдельной программой: прогон с начала уровня, окна нажатий и длины тапов по жизням. Из 23 намеренных поломок бота, копии попытки и данных тесты ловят 21; две оставшиеся — отпускание кнопки при гибели в повторе и окно жизни без нажатий следующих жизней — сейчас не меняют ни одного уровня. Пробная сборка независимым исполнителем по этому тексту: около 14 минут, всё с первого раза, вывод `npm run solve` и `proto.json` совпали с §4; по её итогам уточнено, что такое окно (окно не меньше 0,1 с, а не ±0,05 с вокруг самого нажатия), добавлена подпись «12 — это 12 и больше», предупреждение в §3 и «дословно» в заголовках §2.2–2.3.

**Условие.** M0-04 сделана (в `docs/tasks/README.md` у M0-04 стоит «сделано …»). Если нет — остановись и напиши об этом в отчёте.

## 1. Файлы — дословно

Как это устроено. Перебор одной жизни желейки (нажатия на сетке шагов, склейка одинаковых веток) вынесен из `solve()` в `searchLife()`; его зовут оба бота, а что делать с финишем и гибелью, решает вызывающий. Строгий бот — прежний поиск в ширину по числу гибелей. Бот с запасом идёт так же, но жизнь берёт в решение, только если у неё есть запас; проверку делает `LifeOracle` — прогоны жизни от того же состояния уровня копиями попытки, с памятью исходов. Проверка ленивая: финиши узла — от быстрого к медленному до первого с запасом; новые состояния уровня — только когда с этим числом гибелей прохода с запасом нет, и состояние берётся от первой жизни с запасом. Нажатие бот с запасом пробует раз в 6 шагов: в любом окне из 6 шагов такой шаг есть, поэтому решение с окном не меньше 6 не теряется, а перебор в 5 раз меньше, чем раз в 3 шага. Окно и тап — числа баланса `par_window_s` и `par_tap_s` в `data/constants.csv`. Повтор решения (`replay.ts`) идёт по жизням: какие нажатия в какую жизнь, чем она кончилась; гибель отпускает кнопку, как у бота; палец отпускает кнопку, прежде чем нажать снова (`fitHolds`). `lifeWindows` (вместо `pressWindows` M0-04) мерит запас нажатия внутри своей жизни, `tapSlack` — длины короткого тапа. В `data/solutions/proto.json` — решения бота с запасом и строгий пар (`strict`).

### 1.1. `src/core/solver/solve.ts` — заменить целиком

Перебор жизни — в `searchLife` с крючками `limit`, `finish`, `death`; ключ состояния уровня — `levelKey`; корень поиска — `rootNode`. Строгий бот считает то же, что в M0-04.

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

/** Состояние уровня к рождению желейки: попытка, шаг рождения и нажатия всех прежних жизней. */
export interface LifeNode {
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

/** Тела как строка: одинаковые наборы тел — одна строка. */
export function bodiesKey(bodies: readonly Cell[]): string {
  return bodies
    .map((b) => b.r * 100 + b.c)
    .sort((a, b) => a - b)
    .join(',');
}

/** Состояние уровня к рождению желейки на шаге g: тела и фаза лазеров (без лазеров фаза не важна). */
export function levelKey(run: Run, g: number, periodSteps: number): string {
  return `${bodiesKey(run.bodies)}|${run.grid.lasers.length > 0 ? g % periodSteps : 0}`;
}

/** Куда ведёт перебор жизни: предел по шагам, финиш и гибель. */
export interface LifeHooks {
  /** Шаг, дальше которого жизнь уже не нужна (найдено решение быстрее), или Infinity. */
  limit(): number;
  /** Желейка дошла до флага; steps — время уровня, шагов; taps — нажатия этой жизни. */
  finish(steps: number, taps: Tap[]): void;
  /** Желейка погибла; run — попытка к рождению следующей желейки (кнопка отпущена), g — шаг рождения. */
  death(run: Run, g: number, taps: Tap[]): void;
}

/**
 * Перебор одной жизни желейки от состояния уровня node: на шагах, кратных pressEvery, — без нажатия или нажатие
 * с удержанием из holds (не больше maxJumps прыжков); одинаковые ветки на каждом шаге склеиваются. Возвращает,
 * сколько шагов желейки просчитано.
 */
export function searchLife(node: LifeNode, opt: SolveOptions, hooks: LifeHooks): number {
  let states = 0;
  let live = new Map<string, Branch>([['', { run: node.run.clone(), taps: [], releaseAt: -1, jumps: 0 }]]);
  for (let f = node.step; live.size > 0 && f < node.step + opt.maxLifeSteps; f++) {
    if (f >= hooks.limit()) break; // быстрее найденного решения эта жизнь уже не успеет
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
          hooks.finish(f + 1, nb.taps);
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
          hooks.death(run, g, nb.taps);
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
  return states;
}

/** Корень поиска: первая желейка запущена (первое нажатие только запускает бег), шаг 0. */
export function rootNode(def: LevelDef, P: Physics): LifeNode {
  const root = new Run(def, P);
  root.press();
  root.release();
  root.drainEvents();
  return { run: root, step: 0, taps: [] };
}

/**
 * Строгий бот-решатель (GDD «Бот-решатель»): играет настоящим ядром (Run) теми же командами press/release, что палец.
 * Поиск в ширину по числу гибелей: состояние уровня — тела и фаза лазеров к рождению желейки, одинаковые склеиваются.
 * Первое число гибелей, при котором жизнь доходит до флага, — строгий пар; из решений с этим числом гибелей
 * берётся самое быстрое. Запаса нажатий он не требует — пар игры считает бот с запасом (robust.ts).
 */
export function solve(def: LevelDef, P: Physics, opt: SolveOptions = solverOptions(P)): Solution {
  const periodSteps = Math.round(P.laserPeriod * 60);
  const root = rootNode(def, P);
  let frontier: LifeNode[] = [root];
  const seen = new Set<string>([levelKey(root.run, 0, periodSteps)]);
  let nodes = 0;
  let states = 0;
  for (let deaths = 0; deaths <= opt.maxDeaths; deaths++) {
    let best = null as { steps: number; taps: Tap[] } | null;
    const next = new Map<string, LifeNode>();
    for (const node of frontier) {
      nodes++;
      states += searchLife(node, opt, {
        limit: () => best?.steps ?? Infinity,
        finish: (steps, taps) => {
          if (!best || steps < best.steps) best = { steps, taps: [...node.taps, ...taps] };
        },
        death: (run, g, taps) => {
          const key = levelKey(run, g, periodSteps);
          if (!seen.has(key) && !next.has(key)) next.set(key, { run, step: g, taps: [...node.taps, ...taps] });
        },
      });
    }
    if (best) return { found: true, par: deaths, steps: best.steps, taps: best.taps, nodes, states };
    for (const k of next.keys()) seen.add(k);
    frontier = [...next.values()];
    if (frontier.length === 0) break;
  }
  return { found: false, par: -1, steps: 0, taps: [], nodes, states };
}
```

### 1.2. `src/core/solver/robust.ts` — новый

```ts
import type { LevelDef } from '../levels';
import type { Physics } from '../physics';
import { fitHolds } from './replay';
import { bodiesKey, levelKey, rootNode, searchLife, solverOptions, type LifeNode, type Solution, type SolveOptions, type Tap } from './solve';

const STEP_MS = 1000 / 60;

export interface RobustOptions extends SolveOptions {
  /** Окно нажатия, шагов: у каждого нажатия столько шагов подряд дают тот же исход его жизни. */
  window: number;
  /** Короткий тап (удержание до tapMax шагов) даёт тот же исход с любой длиной 1…tapMax шагов. */
  tapMax: number;
  /** Жизней-кандидатов на одно новое состояние уровня, не больше. */
  maxCandidates: number;
}

/**
 * Пределы бота с запасом (M0-05, GDD «Бот-решатель»): окно и тап — из data/constants.csv (par_window_s, par_tap_s),
 * остальное — как у строгого бота, только нажатие раз в window шагов: в любых window шагах подряд такой шаг есть,
 * поэтому решение, где у каждого нажатия окно не меньше window, на этой сетке не теряется.
 */
export function robustOptions(P: Physics, windowS: number, tapS: number): RobustOptions {
  const window = Math.round(windowS * 60);
  return { ...solverOptions(P), pressEvery: window, window, tapMax: Math.round(tapS * 60), maxCandidates: 256 };
}

export interface RobustSolution extends Solution {
  /** Жизней проверено на запас. */
  checks: number;
}

/** Исходы жизней от одного состояния уровня, с памятью: 'flag', тела после гибели (bodiesKey) или 'none'. */
export class LifeOracle {
  private readonly memo = new Map<string, string>();

  constructor(
    private readonly node: LifeNode,
    private readonly maxSteps: number,
  ) {}

  /** Исход жизни с нажатиями life (шаги — от начала уровня, как у решения). */
  outcome(raw: readonly Tap[]): string {
    const life = fitHolds(raw);
    if (!life) return 'invalid';
    const key = life.map((t) => `${t.at}:${t.hold}`).join(',');
    const known = this.memo.get(key);
    if (known !== undefined) return known;
    const run = this.node.run.clone();
    let pending = -1;
    let next = 0;
    let out = 'none';
    for (let f = this.node.step; f < this.node.step + this.maxSteps; f++) {
      if (f === pending) {
        run.release();
        pending = -1;
      }
      if (next < life.length && life[next]!.at === f) {
        run.press();
        pending = f + life[next]!.hold;
        next++;
      }
      run.step(STEP_MS);
      if (run.state === 'done') {
        out = 'flag';
        break;
      }
      if (!run.hero.alive) {
        out = bodiesKey(run.bodies);
        break;
      }
    }
    this.memo.set(key, out);
    return out;
  }

  /** Окно нажатия i: сколько шагов подряд (включая своё, не больше cap) нажатие даёт тот же исход жизни. */
  window(life: readonly Tap[], i: number, outcome: string, cap: number): number {
    const at = life[i]!.at;
    const lowest = Math.max(this.node.step, i > 0 ? life[i - 1]!.at + 1 : this.node.step);
    const highest = i + 1 < life.length ? life[i + 1]!.at - 1 : Infinity;
    const moved = (d: number): Tap[] => life.map((t, j) => (j === i ? { at: at + d, hold: t.hold } : t));
    let lo = 0;
    let hi = 0;
    while (hi - lo + 1 < cap && at + lo - 1 >= lowest && this.outcome(moved(lo - 1)) === outcome) lo--;
    while (hi - lo + 1 < cap && at + hi + 1 <= highest && this.outcome(moved(hi + 1)) === outcome) hi++;
    return hi - lo + 1;
  }

  /** Жизнь с запасом: окно каждого нажатия не меньше opt.window, короткий тап — любой длины 1…opt.tapMax. */
  robust(life: readonly Tap[], outcome: string, opt: RobustOptions): boolean {
    for (let i = 0; i < life.length; i++) {
      if (this.window(life, i, outcome, opt.window) < opt.window) return false;
      if (life[i]!.hold > opt.tapMax) continue;
      for (let len = 1; len <= opt.tapMax; len++) {
        const changed = life.map((t, j) => (j === i ? { at: t.at, hold: len } : t));
        if (this.outcome(changed) !== outcome) return false;
      }
    }
    return true;
  }

  /** Состояние уровня после жизни life, которая кончается гибелью: попытка к рождению следующей желейки. */
  rebirth(life: readonly Tap[]): LifeNode {
    const fit = fitHolds(life)!;
    const run = this.node.run.clone();
    let pending = -1;
    let next = 0;
    let f = this.node.step;
    for (; run.hero.alive; f++) {
      if (f >= this.node.step + this.maxSteps) throw new Error('бот с запасом: жизнь-кандидат не кончилась гибелью');
      if (f === pending) {
        run.release();
        pending = -1;
      }
      if (next < fit.length && fit[next]!.at === f) {
        run.press();
        pending = f + fit[next]!.hold;
        next++;
      }
      run.step(STEP_MS);
    }
    run.release();
    while (!run.hero.alive) {
      run.step(STEP_MS);
      f++;
    }
    run.drainEvents();
    return { run, step: f, taps: [...this.node.taps, ...life] };
  }
}

interface Candidate {
  oracle: LifeOracle;
  life: Tap[];
  bodies: string;
}

/**
 * Бот с запасом (GDD «Бот-решатель», «Запас»): поиск в ширину по числу гибелей, как у строгого бота, но жизнь
 * идёт в решение, только если у каждого её нажатия есть окно не меньше window шагов с тем же исходом жизни
 * (тело в той же клетке или флаг), а короткий тап даёт тот же исход с любой длиной до tapMax. Запас проверяется
 * лениво: финиши узла — от быстрого к медленному до первого с запасом; новые состояния уровня — только когда
 * с этим числом гибелей прохода с запасом нет, и узел берётся от первой жизни с запасом.
 */
export function solveRobust(def: LevelDef, P: Physics, opt: RobustOptions): RobustSolution {
  const periodSteps = Math.round(P.laserPeriod * 60);
  const root = rootNode(def, P);
  let frontier: LifeNode[] = [root];
  const seen = new Set<string>([levelKey(root.run, 0, periodSteps)]);
  let nodes = 0;
  let states = 0;
  let checks = 0;
  for (let deaths = 0; deaths <= opt.maxDeaths; deaths++) {
    let best = null as { steps: number; taps: Tap[] } | null;
    const cands = new Map<string, Candidate[]>();
    for (const node of frontier) {
      nodes++;
      const oracle = new LifeOracle(node, opt.maxLifeSteps);
      const finishes: Array<{ steps: number; life: Tap[] }> = [];
      states += searchLife(node, opt, {
        limit: () => best?.steps ?? Infinity,
        finish: (steps, life) => {
          finishes.push({ steps, life });
        },
        death: (run, g, life) => {
          const key = levelKey(run, g, periodSteps);
          if (seen.has(key)) return;
          let list = cands.get(key);
          if (!list) cands.set(key, (list = []));
          if (list.length < opt.maxCandidates) list.push({ oracle, life, bodies: bodiesKey(run.bodies) });
        },
      });
      finishes.sort((a, b) => a.steps - b.steps);
      for (const c of finishes) {
        if (best && c.steps >= best.steps) break;
        checks++;
        if (oracle.robust(c.life, 'flag', opt)) {
          best = { steps: c.steps, taps: [...node.taps, ...c.life] };
          break;
        }
      }
    }
    if (best) return { found: true, par: deaths, steps: best.steps, taps: best.taps, nodes, states, checks };
    // С этим числом гибелей прохода с запасом нет: дальше — только состояния, куда ведёт жизнь с запасом.
    const next: LifeNode[] = [];
    for (const [key, list] of cands) {
      for (const c of list) {
        checks++;
        if (!c.oracle.robust(c.life, c.bodies, opt)) continue;
        const node = c.oracle.rebirth(c.life);
        if (levelKey(node.run, node.step, periodSteps) !== key) throw new Error(`бот с запасом: повтор жизни не сошёлся (${key})`);
        seen.add(key);
        next.push(node);
        break;
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return { found: false, par: -1, steps: 0, taps: [], nodes, states, checks };
}
```

### 1.3. `src/core/solver/replay.ts` — заменить целиком

`pressWindows` (запас по всему решению) заменён на `lifeWindows` (запас в своей жизни); добавлены `fitHolds`, `lives`, `tapSlack`.

```ts
import type { LevelDef } from '../levels';
import type { Physics } from '../physics';
import { Run } from '../run';
import { bodiesKey, type Tap } from './solve';

const STEP_MS = 1000 / 60;

export interface ReplayResult {
  done: boolean;
  legion: number;
  /** Шагов до флага (или до предела). */
  steps: number;
}

/** Жизнь желейки в прогоне решения. */
export interface Life {
  /** Шаг рождения желейки (у первой — 0). */
  from: number;
  /** Номера нажатий решения, сделанных в эту жизнь. */
  taps: number[];
  /** Исход: 'flag', тела после гибели (как bodiesKey) или 'none' — прогон кончился раньше. */
  outcome: string;
}

/**
 * Палец отпускает кнопку, прежде чем нажать снова: удержание — не дольше, чем до следующего нажатия.
 * Нажатия — по возрастанию шага; null — два нажатия на одном шаге или не по порядку.
 */
export function fitHolds(taps: readonly Tap[]): Tap[] | null {
  const out: Tap[] = [];
  for (let i = 0; i < taps.length; i++) {
    const t = taps[i]!;
    const next = taps[i + 1];
    const hold = next === undefined ? t.hold : Math.min(t.hold, next.at - t.at);
    if (hold < 1) return null;
    out.push({ at: t.at, hold });
  }
  return out;
}

/**
 * Прогон решения с начала уровня теми же командами, что у пальца и бота: первое нажатие — старт; на шаге f сначала
 * release() (кончилось удержание), потом press(), потом step; гибель отпускает кнопку — как у бота. Прогон
 * останавливается у флага, на пределе шагов или после гибели жизни номер stopAfter (с нуля).
 */
function play(def: LevelDef, P: Physics, taps: readonly Tap[], maxSteps: number, stopAfter: number): ReplayResult & { lives: Life[] } {
  const fit = fitHolds(taps);
  if (!fit) throw new Error('решение: нажатия не по порядку или два на одном шаге');
  const run = new Run(def, P);
  run.press();
  run.release();
  const lives: Life[] = [{ from: 0, taps: [], outcome: 'none' }];
  let pending = -1;
  let next = 0;
  let alive = true;
  let f = 0;
  for (; f < maxSteps; f++) {
    if (f === pending) {
      run.release();
      pending = -1;
    }
    if (next < fit.length && fit[next]!.at === f) {
      lives[lives.length - 1]!.taps.push(next);
      run.press();
      pending = f + fit[next]!.hold;
      next++;
    }
    run.step(STEP_MS);
    if (run.state === 'done') {
      lives[lives.length - 1]!.outcome = 'flag';
      return { done: true, legion: run.legion, steps: f + 1, lives };
    }
    if (alive && !run.hero.alive) {
      lives[lives.length - 1]!.outcome = bodiesKey(run.bodies);
      if (lives.length > stopAfter) return { done: false, legion: run.legion, steps: f + 1, lives };
      run.release();
      pending = -1;
    }
    if (!alive && run.hero.alive) lives.push({ from: f + 1, taps: [], outcome: 'none' });
    alive = run.hero.alive;
  }
  return { done: false, legion: run.legion, steps: f, lives };
}

/** Повтор решения: дошла ли попытка до флага, с каким легионом и за сколько шагов. */
export function replay(def: LevelDef, P: Physics, taps: readonly Tap[], maxSteps = 6000): ReplayResult {
  const r = play(def, P, taps, maxSteps, Infinity);
  return { done: r.done, legion: r.legion, steps: r.steps };
}

/** Жизни прогона решения: с какого шага, какие нажатия и чем кончилась каждая. */
export function lives(def: LevelDef, P: Physics, taps: readonly Tap[], maxSteps = 6000): Life[] {
  return play(def, P, taps, maxSteps, Infinity).lives;
}

/** Нажатия решения по жизням: исход жизни L при нажатиях moved (берутся нажатия до конца этой жизни). */
function lifeOutcome(def: LevelDef, P: Physics, moved: readonly Tap[], upto: number, L: number): string {
  const r = play(def, P, moved.slice(0, upto), 6000, L);
  return r.lives.length === L + 1 ? r.lives[L]!.outcome : 'other';
}

/**
 * Запас решения по жизням (GDD «Бот-решатель», «Запас»): для каждого нажатия — сколько шагов подряд (включая своё)
 * можно нажать раньше или позже, и его жизнь кончается так же — тело в той же клетке или флаг. Остальные нажатия
 * этой жизни на месте, следующие жизни не в счёт; считаем до cap. Окно в 1 шаг — нажатие «кадр в кадр».
 */
export function lifeWindows(def: LevelDef, P: Physics, taps: readonly Tap[], cap = 12): number[] {
  const out = taps.map(() => 0);
  lives(def, P, taps).forEach((life, L) => {
    const upto = life.taps.length > 0 ? Math.max(...life.taps) + 1 : 0;
    for (const i of life.taps) {
      const at = taps[i]!.at;
      const lowest = Math.max(life.from, i > 0 ? taps[i - 1]!.at + 1 : 0);
      const highest = i + 1 < upto ? taps[i + 1]!.at - 1 : Infinity;
      const same = (d: number): boolean =>
        lifeOutcome(def, P, taps.map((t, j) => (j === i ? { at: at + d, hold: t.hold } : t)), upto, L) === life.outcome;
      let lo = 0;
      let hi = 0;
      while (hi - lo + 1 < cap && at + lo - 1 >= lowest && same(lo - 1)) lo--;
      while (hi - lo + 1 < cap && at + hi + 1 <= highest && same(hi + 1)) hi++;
      out[i] = hi - lo + 1;
    }
  });
  return out;
}

/**
 * Короткие тапы решения (удержание до tapMax шагов): даёт ли каждый тот же исход своей жизни с любой длиной
 * 1…tapMax шагов — палец не нажмёт ровно на 1/60 с. Полные удержания — true.
 */
export function tapSlack(def: LevelDef, P: Physics, taps: readonly Tap[], tapMax: number): boolean[] {
  const out = taps.map(() => true);
  lives(def, P, taps).forEach((life, L) => {
    const upto = life.taps.length > 0 ? Math.max(...life.taps) + 1 : 0;
    for (const i of life.taps) {
      if (taps[i]!.hold > tapMax) continue;
      for (let len = 1; len <= tapMax; len++) {
        const changed = taps.map((t, j) => (j === i ? { at: t.at, hold: len } : t));
        if (lifeOutcome(def, P, changed, upto, L) !== life.outcome) out[i] = false;
      }
    }
  });
  return out;
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

### 1.4. `tools/solve.ts` — заменить целиком

```ts
// Бот-решатель всех уровней игры: `npm run solve` (GDD «Бот-решатель», TESTPLAN §5).
// Для каждого уровня — пар бота с запасом (у каждого нажатия окно не меньше 0,1 с с тем же исходом жизни, короткий
// тап — любой длины до 0,1 с), строгий пар (без запаса), время решения, запас нажатий и объём перебора; решения бота
// с запасом пишутся в data/solutions/<набор>.json (их проверяет tests/unit/solutions.test.ts). Код выхода 1 —
// пар в файле уровня не равен найденному, уровень не решён или строгий пар больше пара с запасом (ошибка бота).
// Собирается Vite (tools/solve.config.ts): ядро — TypeScript, таблицы и уровни подключаются через ?raw.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allLevels } from '../src/core/levels';
import { physicsFrom } from '../src/core/physics';
import { lifeWindows, mapHash } from '../src/core/solver/replay';
import { robustOptions, solveRobust } from '../src/core/solver/robust';
import { solve, solverOptions } from '../src/core/solver/solve';
import { DATA } from '../src/data';

const P = physicsFrom(DATA);
const strictOpt = solverOptions(P);
const opt = robustOptions(P, DATA.num('par_window_s'), DATA.num('par_tap_s'));
const levels = allLevels(DATA);

console.log(
  `solve: уровней ${levels.length}; бот с запасом — нажатие раз в ${opt.pressEvery} шагов, окно от ${opt.window} шагов, ` +
    `короткий тап 1…${opt.tapMax} шагов; строгий — нажатие раз в ${strictOpt.pressEvery} шага; удержание ${opt.holds.join(' и ')} шагов, ` +
    `до ${opt.maxJumps} прыжков за жизнь, до ${opt.maxDeaths} гибелей`,
);
const widths = [9, 7, 7, 8, 9, 7, 22, 8];
const row = (cells: string[]): string => cells.map((c, i) => (i < widths.length ? c.padEnd(widths[i]!) : c)).join('');
console.log(row(['уровень', 'пар', 'бот', 'строго', 'время', 'окно', 'перебор', 'мс', 'замечания']));

let failed = 0;
const sets = new Map<string, string[]>();
for (const def of levels) {
  const t0 = performance.now();
  const s = solveRobust(def, P, opt);
  const strict = solve(def, P, strictOpt);
  const ms = Math.round(performance.now() - t0);
  const windows = s.found ? lifeWindows(def, P, s.taps) : [];
  const minWindow = windows.length > 0 ? Math.min(...windows) : null;
  const notes: string[] = [];
  if (!s.found) notes.push(`не решён с запасом за ${opt.maxDeaths} гибелей`);
  else if (s.par !== def.par) notes.push(`пар в файле ${def.par}, у бота ${s.par}: поправь par в data/levels/${def.file}.txt`);
  if (s.found && strict.found && strict.par > s.par) notes.push('строгий пар больше пара с запасом — ошибка бота');
  if (s.found && def.file !== 'proto' && s.steps / 60 < 15) notes.push('решение короче 15 с');
  if (!s.found || s.par !== def.par || (strict.found && strict.par > s.par)) failed++;
  console.log(
    row([
      def.id,
      String(def.par),
      s.found ? String(s.par) : '—',
      strict.found ? String(strict.par) : '—',
      s.found ? `${(s.steps / 60).toFixed(1)} с` : '—',
      minWindow === null ? '—' : String(minWindow),
      `${s.states} / ${s.nodes}`,
      String(ms),
      notes.join('; '),
    ]),
  );
  const entry = s.found
    ? { map: mapHash(def), par: s.par, strict: strict.par, steps: s.steps, windows, taps: s.taps.map((t) => [t.at, t.hold]) }
    : { map: mapHash(def), par: -1, strict: strict.par };
  const lines = sets.get(def.file) ?? [];
  lines.push(`    ${JSON.stringify(def.id)}: ${JSON.stringify(entry)}`);
  sets.set(def.file, lines);
}
console.log('пар — в файле уровня; бот — найденный ботом с запасом; строго — без запаса (точность 1/60 с); время — решения');
console.log('бота с запасом; окно — наименьший запас нажатия в своей жизни, шагов по 1/60 с (12 — это 12 и больше);');
console.log('перебор — шагов желейки / состояний уровня у бота с запасом; мс — оба бота.');

mkdirSync(join(process.cwd(), 'data', 'solutions'), { recursive: true });
for (const [file, lines] of sets) {
  const text = `{\n  "note": "Решения бота с запасом: пишет npm run solve, руками не править.",\n  "levels": {\n${lines.join(',\n')}\n  }\n}\n`;
  writeFileSync(join(process.cwd(), 'data', 'solutions', `${file}.json`), text);
  console.log(`solve: решения записаны в data/solutions/${file}.json`);
}
if (failed > 0) {
  console.error(`solve: расхождений ${failed}`);
  process.exit(1);
}
console.log('solve: ok — пар каждого уровня равен найденному ботом с запасом');
```

### 1.5. `data/constants.csv` — две строки

После строки `stars_2_extra,…`:

```
par_window_s,0.1,с,Решение для пара: у каждого нажатия окно не меньше столько секунд подряд с тем же исходом жизни
par_tap_s,0.1,с,Решение для пара: короткий тап проходит с любой длиной до столько секунд
```

### 1.6. `tools/data-check.mjs` — две обязательные константы

В конец списка `REQUIRED_CONSTANTS` (после `'extra_jellies',`) — `'par_window_s', 'par_tap_s',`; последняя строка списка станет такой:

```js
  'skip_after_extra_deaths', 'skip_after_s', 'extra_jellies', 'par_window_s', 'par_tap_s',
```

### 1.7. `data/levels/proto.txt` — комментарий и пар

Строку комментария `# Пар — число бота-решателя (npm run solve, M0-04); …` заменить на:

```
# Пар — число бота с запасом (npm run solve, M0-05); строгий бот (M0-04) — 1, 1, 0, 2, 0, 1; в прототипе было 3, 1, 1, 2, 3, 4.
```

И поменять две строки `par` (карты не трогать): `p-05` — `par 1` (было 0), `p-06` — `par 2` (было 1). Затем `npm run data` — ok.

### 1.8. Версия

В `package.json` — `"version": "0.0.6"`, затем `npm install` (обновит версию в `package-lock.json`, зависимости те же). В `src/main.ts` — `const VERSION = '0.0.6';`.

## 2. Тесты

### 2.1. `tests/unit/robust.test.ts` — новый, дословно

Бот с запасом на маленьких картах прямо в тесте (окна ямы в 4 клетки сверены с тестами M0-01 и M0-04), фаза лазеров в состоянии уровня и сторож самого бота: на быстрых уровнях прототипа (p-01, p-02, p-03, p-05) оба бота находят ровно записанное в `data/solutions/proto.json`.

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allLevels, parseLevels, type LevelDef } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { replay, tapSlack } from '../../src/core/solver/replay';
import { LifeOracle, robustOptions, solveRobust } from '../../src/core/solver/robust';
import { levelKey, rootNode, solve } from '../../src/core/solver/solve';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
const OPT = robustOptions(P, DATA.num('par_window_s'), DATA.num('par_tap_s'));
const AIR = '........................';
const GROUND = '########################';

/** Ряды 0…8 — воздух, ряд 9 — старт (1, 9) и флаг (21, 9), ряды 10…12 — пол floor. */
function lvl(floor: string): LevelDef {
  const map = [...Array<string>(9).fill(AIR), '.@...................F..', floor, floor, floor];
  return parseLevels(`level t-1\npar 0\nmap\n${map.join('\n')}\nend\n`, 'test', 24, 13)[0]!;
}

/** Яма без дна шириной n со столбца 8. */
const gap = (n: number): string => '#'.repeat(8) + '.'.repeat(n) + '#'.repeat(24 - 8 - n);

describe('бот с запасом', () => {
  it('пределы M0-05: окно 6 шагов (0,1 с), нажатие раз в 6 шагов, короткий тап — до 6 шагов', () => {
    expect(OPT).toMatchObject({ window: 6, pressEvery: 6, tapMax: 6, holds: [1, 30], maxJumps: 3, maxDeaths: 8 });
  });

  it('ровный пол: пар 0, без нажатий', () => {
    const def = lvl(GROUND);
    const s = solveRobust(def, P, OPT);
    expect(s).toMatchObject({ found: true, par: 0, taps: [] });
    expect(s.steps).toBe(replay(def, P, []).steps);
  });

  it('яма в 4 клетки: окно короткого прыжка — 10 шагов, полного — 20; с запасом 6 годится короткий', () => {
    const def = lvl(gap(4));
    const oracle = new LifeOracle(rootNode(def, P), OPT.maxLifeSteps);
    expect(oracle.window([{ at: 96, hold: 1 }], 0, 'flag', 30)).toBe(10);
    expect(oracle.window([{ at: 86, hold: 30 }], 0, 'flag', 30)).toBe(20);
    expect(oracle.outcome([])).toBe('1210'); // без прыжка — тело на дне ямы
    expect(oracle.robust([{ at: 96, hold: 1 }], 'flag', OPT)).toBe(true);
    expect(solveRobust(def, P, OPT)).toMatchObject({ found: true, par: 0, steps: 258, taps: [{ at: 96, hold: 1 }] });
  });

  it('запас больше, чем даёт прыжок, — без гибели не пройти', () => {
    const def = lvl(gap(4));
    expect(solveRobust(def, P, { ...OPT, window: 12, pressEvery: 12 })).toMatchObject({ par: 0, taps: [{ at: 84, hold: 30 }] });
    const s = solveRobust(def, P, { ...OPT, window: 21, pressEvery: 21 });
    expect(s.par).toBe(1);
    expect(replay(def, P, s.taps)).toEqual({ done: true, legion: 1, steps: s.steps });
  });
});

describe('состояние уровня', () => {
  it('фаза лазеров — часть состояния, только если на уровне есть лазеры', () => {
    const laser = rootNode(allLevels(DATA).find((l) => l.id === 'p-03')!, P).run;
    expect(levelKey(laser, 0, 180)).not.toBe(levelKey(laser, 90, 180));
    expect(levelKey(laser, 0, 180)).toBe(levelKey(laser, 180, 180));
    const plain = rootNode(lvl(GROUND), P).run;
    expect(levelKey(plain, 0, 180)).toBe(levelKey(plain, 90, 180));
  });
});

interface Stored {
  par: number;
  strict: number;
  steps: number;
  taps: Array<[number, number]>;
}

/**
 * Сторож самого бота: на быстрых уровнях прототипа оба бота находят ровно то, что записано в data/solutions
 * (`npm run solve`). Правка бота, которая меняет его решения, роняет этот тест; после неё — `npm run solve`.
 */
describe('сторож бота: быстрые уровни прототипа', () => {
  const stored = (
    JSON.parse(readFileSync(new URL('../../data/solutions/proto.json', import.meta.url), 'utf8')) as {
      levels: Record<string, Stored>;
    }
  ).levels;
  for (const id of ['p-01', 'p-02', 'p-03', 'p-05']) {
    it(`${id}: бот с запасом и строгий бот находят записанное`, { timeout: 60_000 }, () => {
      const def = allLevels(DATA).find((l) => l.id === id)!;
      const want = stored[id]!;
      const s = solveRobust(def, P, OPT);
      expect({ par: s.par, steps: s.steps, taps: s.taps.map((t) => [t.at, t.hold]) }).toEqual({ par: want.par, steps: want.steps, taps: want.taps });
      expect(solve(def, P).par).toBe(want.strict);
    });
  }

  it('«Пилы»: строгий бот проходит без гибелей только тапами короче 0,1 с, с запасом нужна одна гибель', { timeout: 60_000 }, () => {
    const def = allLevels(DATA).find((l) => l.id === 'p-05')!;
    const strict = solve(def, P);
    expect(strict.par).toBe(0);
    expect(tapSlack(def, P, strict.taps, OPT.tapMax)).toContain(false);
    expect(solveRobust(def, P, OPT).par).toBe(1);
  });
});
```

### 2.2. `tests/unit/replay.test.ts` — заменить целиком, дословно

```ts
import { describe, expect, it } from 'vitest';
import { allLevels, parseLevels, type LevelDef } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { Run } from '../../src/core/run';
import { fitHolds, lifeWindows, lives, mapHash, replay, tapSlack } from '../../src/core/solver/replay';
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

  it('удержание — не дольше, чем до следующего нажатия; два нажатия на одном шаге — ошибка', () => {
    expect(fitHolds([{ at: 10, hold: 30 }, { at: 20, hold: 1 }])).toEqual([{ at: 10, hold: 10 }, { at: 20, hold: 1 }]);
    expect(fitHolds([{ at: 10, hold: 1 }, { at: 10, hold: 1 }])).toBeNull();
    expect(() => replay(lvl(GROUND), P, [{ at: 10, hold: 1 }, { at: 10, hold: 1 }])).toThrow();
  });
});

describe('жизни прогона', () => {
  it('яма без дна в 4 клетки без нажатий: тела заполняют яму, последняя желейка у флага', () => {
    const def = lvl(gap(4));
    const all = lives(def, P, []);
    expect(all.length).toBe(replay(def, P, []).legion + 1);
    expect(all[0]!.from).toBe(0);
    expect(all[0]!.outcome).toBe('1210'); // первое тело — на дне ямы, клетка (10, 12)
    expect(all.at(-1)!.outcome).toBe('flag');
    for (let i = 1; i < all.length; i++) expect(all[i]!.from).toBeGreaterThan(all[i - 1]!.from);
  });

  it('нажатия раскладываются по жизням', () => {
    const def = lvl(gap(4));
    // Первая желейка прыгает слишком рано и падает в яму, вторая перепрыгивает её по телу.
    const taps = [{ at: 30, hold: 1 }, { at: 260, hold: 30 }];
    const all = lives(def, P, taps);
    expect(all.map((l) => l.taps)).toEqual([[0], [1]]);
    expect(all.at(-1)!.outcome).toBe('flag');
  });
});

describe('запас нажатий', () => {
  it('у решения без нажатий окон нет', () => {
    expect(lifeWindows(lvl(GROUND), P, [])).toEqual([]);
  });

  it('яма в 4 клетки, полное удержание: нажатие годится на шагах 77…96 (как в тестах M0-01)', () => {
    const def = lvl(gap(4));
    expect(lifeWindows(def, P, [{ at: 77, hold: 30 }], 30)).toEqual([20]);
    expect(lifeWindows(def, P, [{ at: 96, hold: 30 }], 30)).toEqual([20]);
    expect(lifeWindows(def, P, [{ at: 86, hold: 30 }])).toEqual([12]); // предел cap = 12
    // Удержание 15 шагов чуть короче полного (действует 16 шагов): окно на шаг уже.
    expect(lifeWindows(def, P, [{ at: 78, hold: 15 }], 30)).toEqual([19]);
  });

  it('короткий тап: в яме в 4 клетки годится любая длина до 0,1 с', () => {
    expect(tapSlack(lvl(gap(4)), P, [{ at: 96, hold: 1 }], 6)).toEqual([true]);
  });

  it('«Пилы»: строгое решение M0-04 — окна 6, 9, 11, но первые два тапа проходят только короче 0,1 с', () => {
    const def = allLevels(DATA).find((l) => l.id === 'p-05')!;
    const strict = [{ at: 18, hold: 1 }, { at: 69, hold: 1 }, { at: 120, hold: 30 }];
    expect(replay(def, P, strict)).toEqual({ done: true, legion: 0, steps: 258 });
    expect(lifeWindows(def, P, strict)).toEqual([6, 9, 11]);
    expect(tapSlack(def, P, strict, 6)).toEqual([false, false, true]);
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

### 2.3. `tests/unit/solutions.test.ts` — заменить целиком, дословно

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { lifeWindows, mapHash, replay, tapSlack } from '../../src/core/solver/replay';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
/** Запас решения для пара (GDD «Бот-решатель», «Запас»): окно нажатия и длина короткого тапа, шагов. */
const WINDOW = Math.round(DATA.num('par_window_s') * 60);
const TAP = Math.round(DATA.num('par_tap_s') * 60);

interface Stored {
  map: string;
  par: number;
  strict: number;
  steps: number;
  windows: number[];
  taps: Array<[number, number]>;
}

/**
 * Сторож уровней (GDD «Бот-решатель»): решение бота с запасом из data/solutions/<набор>.json повторяется настоящим
 * ядром, доходит до флага ровно с паром из файла уровня и сохраняет запас: окно каждого нажатия — не меньше
 * par_window_s, короткий тап — любой длины до par_tap_s. Правка правил, которая ломает уровень, роняет этот тест;
 * правка карты — тоже (отпечаток карты): после неё — `npm run solve`.
 */
describe('решения бота', () => {
  for (const def of allLevels(DATA)) {
    it(`${def.id}: решение с запасом доходит до флага с паром ${def.par}`, () => {
      const file = JSON.parse(readFileSync(new URL(`../../data/solutions/${def.file}.json`, import.meta.url), 'utf8')) as {
        levels: Record<string, Stored>;
      };
      const s = file.levels[def.id];
      expect(s, `нет решения ${def.id} — запусти npm run solve`).toBeDefined();
      expect(s!.map, `карта ${def.id} изменилась — запусти npm run solve`).toBe(mapHash(def));
      expect(s!.par, `пар в файле уровня не равен пару бота`).toBe(def.par);
      expect(s!.strict, 'строгий пар больше пара с запасом').toBeLessThanOrEqual(s!.par);
      const taps = s!.taps.map(([at, hold]) => ({ at, hold }));
      expect(replay(def, P, taps)).toEqual({ done: true, legion: def.par, steps: s!.steps });
      const windows = lifeWindows(def, P, taps);
      expect(windows).toEqual(s!.windows);
      expect(windows.filter((w) => w < WINDOW), `окно нажатия меньше ${WINDOW} шагов`).toEqual([]);
      expect(tapSlack(def, P, taps, TAP), `короткий тап проходит не с любой длиной до ${TAP} шагов`).not.toContain(false);
    });
  }
});
```

### 2.4. `tests/unit/levels.test.ts` — одна правка

В тесте «шесть уровней прототипа» пар — новые числа:

```ts
    expect(levels.map((l) => l.par)).toEqual([1, 1, 0, 2, 1, 2]);
```

### 2.5. `tests/e2e/smoke.spec.ts` — одна правка

Версия в проверке отладочной строки — `/(Желейный легион|Jelly Legion) 0\.0\.6/`.

## 3. Порядок
1. Файлы §1 и правки §2.4–2.5, `npm install`, `npm run data`. До шага 3 `npm run test` и проверка типов падают: старый `replay.test.ts` зовёт удалённую `pressWindows` — это ожидаемо.
2. `npm run solve` — перепишет `data/solutions/proto.json`; вывод сверить с §4.
3. Тесты §2.1–2.3, `npm run check`.

## 4. Ожидаемый вывод `npm run solve`

Сверять строки программы — от `solve: уровней` до `solve: ok` (выше npm печатает свои строки `> jelly@0.0.6 solve` и команду сборки). На ноутбуке может отличаться только столбец «мс» — время работы ботов; в строках без замечаний после него — пробелы до ширины столбца. Остальное — точно так:

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

`data/solutions/proto.json` должен совпасть с этим текстом:

```json
{
  "note": "Решения бота с запасом: пишет npm run solve, руками не править.",
  "levels": {
    "p-01": {"map":"010773f3","par":1,"strict":1,"steps":399,"windows":[12,12,12],"taps":[[48,30],[216,1],[276,30]]},
    "p-02": {"map":"7823ae22","par":1,"strict":1,"steps":464,"windows":[],"taps":[]},
    "p-03": {"map":"a6c51560","par":0,"strict":0,"steps":329,"windows":[12],"taps":[[162,30]]},
    "p-04": {"map":"308c86e7","par":2,"strict":2,"steps":744,"windows":[12,10,12],"taps":[[144,1],[624,1],[642,30]]},
    "p-05": {"map":"04c8533a","par":1,"strict":0,"steps":327,"windows":[9,6,6],"taps":[[72,1],[120,1],[186,30]]},
    "p-06": {"map":"242974c3","par":2,"strict":1,"steps":754,"windows":[12,12,12,12,12,12,12],"taps":[[6,30],[132,1],[270,1],[306,30],[438,30],[606,1],[732,30]]}
  }
}
```

## 5. Критерии готовности
- Файлы §1.1–1.4 и тесты §2.1–2.3 — дословно, правки §1.5–1.8 и §2.4–2.5 — как написано.
- `npm run solve` — код выхода 0, вывод и `data/solutions/proto.json` — как в §4.
- `npm run check` зелёный: Vitest — прежние файлы и новый `robust.test.ts` (на ноутбуке после M0-04 был 21 файл, станет 22), `npm run test` — до 30 с; сборка до 3 МБ; Playwright — 15 passed, 1 skipped.
- `npm run publish -- --dry-run` — строка `publish: Желейный легион 0.0.6 (<хеш>+), …`.
- В `docs/tasks/README.md` — строка M0-05 «сделано ДД.ММ».

## Если что-то не так
- Если `npm run solve` даёт другие пар, время или решения — ничего не подгоняй: приложи вывод целиком и `data/solutions/proto.json`.
- Если `npm run solve` идёт дольше 3 минут или `npm run test` дольше 30 с — напиши, сколько (столбец «мс»; для тестов — `npx vitest run --reporter=verbose`).

## Отчёт
Что сделано; вывод `npm run solve` целиком; итоговые строки `npm run check`; строка `publish --dry-run`; что не получилось и почему.
