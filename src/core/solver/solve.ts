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
    (b.run.doorOpen[0] ? 1 : 0) | (b.run.doorOpen[1] ? 2 : 0) | (b.run.doorOpen[2] ? 4 : 0),
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
