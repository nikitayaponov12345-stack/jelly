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
