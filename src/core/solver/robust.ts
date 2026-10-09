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
