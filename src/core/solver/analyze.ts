import type { Cell } from '../grid';
import type { LevelDef } from '../levels';
import type { Physics } from '../physics';
import { lifeWindows } from './replay';
import { LifeOracle, solveRobust, type RobustOptions } from './robust';
import { levelKey, rootNode, searchLife, type LifeNode, type Tap } from './solve';

/**
 * Разбор уровня ботом с запасом (GDD «Уровни и миры», «Как строим уровни»; claude/jelly-level-design-method.md):
 * сколько мест первой гибели и сколько из них оставляют пар, сколько разных построек из тел дают пар, сколько
 * гибелей тратит «простой игрок» и сколько тел решения он бы не положил. Все жизни — с запасом, как у пара.
 */
export interface Analysis {
  /** Пар бота с запасом; −1 — не решён за maxDeaths. */
  par: number;
  /** Время решения бота с запасом, шагов. */
  steps: number;
  /** Наименьший запас нажатия решения, шагов (до 12); null — решение без нажатий или не решён. */
  minWindow: number | null;
  /** Разных первых тел (состояний уровня после первой гибели), до которых доходит жизнь с запасом. */
  first: number;
  /** Из них — те, после которых уровень ещё проходится за пар. */
  firstGood: number;
  /** Разных наборов тел, с которыми последняя жизнь доходит до флага, — при паре гибелей. */
  solutions: number;
  /** Гибелей, если ни разу не жать; null — не дошёл за maxDeaths. */
  passive: number | null;
  /** Гибелей, если в каждой жизни уходить как можно правее; null — не дошёл. */
  greedy: number | null;
  /** «Простой игрок»: в каждой жизни не жмёт или уходит как можно правее — лучший из таких путей; null — не дошёл. */
  simple: number | null;
  /** Скрытые тела: сколько гибелей самое меньшее не «простые» (не без нажатий и не «подальше») в решениях за пар. */
  hidden: number;
  /** Сложность по формуле (стартовые веса, подгоняются по пробам Никиты). */
  d: number;
}

/** Чем кончается жизнь от состояния уровня: флаг или новое состояние. */
interface Expansion {
  /** Есть жизнь с запасом до флага. */
  finish: boolean;
  /** Состояния после гибели, куда ведёт жизнь с запасом: ключ состояния → новое состояние. */
  children: Map<string, Child>;
  /** Жизнь без нажатий: 'flag' или ключ состояния после гибели. */
  passive: string;
  /** Жизнь «подальше»: 'flag' или ключ состояния после гибели. */
  greedy: string;
}

/**
 * Сложность (claude/jelly-level-design-method.md, стартовые веса):
 * D = пар + 1,5 · скрытые + log₂(первые / хорошие) + 0,5 · [окно < 9 шагов] − 2 · [простой игрок берёт пар].
 */
export function difficulty(a: Omit<Analysis, 'd'>): number {
  const ratio = a.firstGood > 0 ? Math.log2(a.first / a.firstGood) : 0;
  const tight = a.minWindow !== null && a.minWindow < 9 ? 0.5 : 0;
  const easy = a.simple !== null && a.simple <= a.par ? 2 : 0;
  return Math.round((a.par + 1.5 * a.hidden + ratio + tight - easy) * 10) / 10;
}

/** Новое состояние уровня после гибели: узел, новое тело (null — желейка лопнула без следа) и число нажатий жизни. */
interface Child {
  node: LifeNode;
  body: Cell | null;
  presses: number;
}

/** Разбор одного уровня: исходы жизней кешируются по состоянию уровня (тела и фаза лазеров). */
export class Analyzer {
  private readonly cache = new Map<string, Expansion>();
  /** Узлы по ключу состояния: корень и дети разобранных узлов. */
  private readonly nodes = new Map<string, LifeNode>();
  private readonly period: number;

  constructor(
    readonly def: LevelDef,
    readonly P: Physics,
    readonly opt: RobustOptions,
  ) {
    this.period = Math.round(P.laserPeriod * 60);
  }

  key(node: LifeNode): string {
    return levelKey(node.run, node.step, this.period);
  }

  /** Все исходы одной жизни от узла: перебор бота с запасом без отсечки по времени, запас — у каждой жизни. */
  expand(node: LifeNode): Expansion {
    const k = this.key(node);
    const known = this.cache.get(k);
    if (known) return known;
    const oracle = new LifeOracle(node, this.opt.maxLifeSteps);
    const finishes: Array<{ steps: number; life: Tap[] }> = [];
    const deaths = new Map<string, Tap[][]>();
    searchLife(node, this.opt, {
      limit: () => Infinity,
      finish: (steps, life) => finishes.push({ steps, life }),
      death: (run, g, life) => {
        const key = levelKey(run, g, this.period);
        let list = deaths.get(key);
        if (!list) deaths.set(key, (list = []));
        if (list.length < this.opt.maxCandidates) list.push(life);
      },
    });
    finishes.sort((a, b) => a.steps - b.steps);
    const finish = finishes.some((f) => oracle.robust(f.life, 'flag', this.opt));
    const before = new Set(node.run.bodies.map((b) => b.r * 1000 + b.c));
    const children = new Map<string, Child>();
    for (const [key, lives] of [...deaths].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      for (const life of lives) {
        const outcome = oracle.outcome(life);
        if (!oracle.robust(life, outcome, this.opt)) continue;
        const child = oracle.rebirth(life);
        const body = child.run.bodies.find((b) => !before.has(b.r * 1000 + b.c)) ?? null;
        children.set(key, { node: child, body, presses: life.length });
        break;
      }
    }
    const still = oracle.outcome([]);
    const passive = still === 'flag' ? 'flag' : this.key(oracle.rebirth([]));
    let greedy = finish ? 'flag' : passive;
    if (!finish) {
      let best: { col: number; presses: number; key: string } | null = null;
      for (const [key, ch] of children) {
        const col = ch.body ? ch.body.c : -1;
        if (!best || col > best.col || (col === best.col && (ch.presses < best.presses || (ch.presses === best.presses && key < best.key)))) {
          best = { col, presses: ch.presses, key };
        }
      }
      if (best) greedy = best.key;
    }
    const e: Expansion = { finish, children, passive, greedy };
    this.cache.set(k, e);
    return e;
  }

  node(key: string): LifeNode {
    const n = this.nodes.get(key);
    if (!n) throw new Error(`разбор: нет узла ${key}`);
    return n;
  }

  private remember(n: LifeNode): string {
    const k = this.key(n);
    if (!this.nodes.has(k)) this.nodes.set(k, n);
    return k;
  }

  /** Дети узла (жизни с запасом до гибели); их узлы запоминаются по ключу. */
  private children(key: string): Map<string, Child> {
    const e = this.expand(this.node(key));
    for (const [k, ch] of e.children) if (!this.nodes.has(k)) this.nodes.set(k, ch.node);
    return e.children;
  }

  /** Гибелей до флага, если в каждой жизни выбирать только из choose(узел); null — не дошёл за maxDeaths. */
  private walk(root: string, choose: (e: Expansion) => string[]): number | null {
    let frontier = [root];
    const seen = new Set(frontier);
    for (let deaths = 0; deaths <= this.opt.maxDeaths; deaths++) {
      const next: string[] = [];
      for (const k of frontier) {
        this.children(k);
        const picks = choose(this.expand(this.node(k)));
        if (picks.includes('flag')) return deaths;
        for (const p of picks) {
          if (p === 'flag' || seen.has(p)) continue;
          // Жизнь без нажатий всегда с запасом, но перебор мог склеить её с другой веткой — узел берётся повтором.
          if (!this.nodes.has(p)) this.nodes.set(p, new LifeOracle(this.node(k), this.opt.maxLifeSteps).rebirth([]));
          seen.add(p);
          next.push(p);
        }
      }
      if (next.length === 0) return null;
      frontier = next;
    }
    return null;
  }

  run(): Analysis {
    const s = solveRobust(this.def, this.P, this.opt);
    const root = rootNode(this.def, this.P);
    const rootKey = this.remember(root);
    const first = this.children(rootKey);
    // Граф состояний с запасом до глубины пара: хорошие — откуда за оставшиеся гибели доходит жизнь с запасом.
    const depthOf = new Map<string, number>([[rootKey, 0]]);
    const layers: string[][] = [[rootKey]];
    const par = s.found ? s.par : -1;
    for (let d = 0; d < par; d++) {
      const next: string[] = [];
      for (const k of layers[d]!) {
        for (const ck of this.children(k).keys()) {
          if (depthOf.has(ck)) continue;
          depthOf.set(ck, d + 1);
          next.push(ck);
        }
      }
      layers.push(next);
    }
    // Хорошие узлы и цена: сколько гибелей не «простых» (не без нажатий и не «подальше») нужно до флага за пар.
    const cost = new Map<string, number>();
    const finals = new Set<string>();
    if (par >= 0) {
      for (const k of layers[par] ?? []) {
        if (!this.expand(this.node(k)).finish) continue;
        cost.set(k, 0);
        finals.add(k.split('|')[0]!);
      }
      for (let d = par - 1; d >= 0; d--) {
        for (const k of layers[d]!) {
          const e = this.expand(this.node(k));
          for (const ck of this.children(k).keys()) {
            const rest = depthOf.get(ck) === d + 1 ? cost.get(ck) : undefined;
            if (rest === undefined) continue;
            const c = rest + (ck === e.passive || ck === e.greedy ? 0 : 1);
            if (c < (cost.get(k) ?? Infinity)) cost.set(k, c);
          }
        }
      }
    }
    const firstGood = par >= 1 ? [...first.keys()].filter((k) => depthOf.get(k) === 1 && cost.has(k)).length : 0;
    const passive = this.walk(rootKey, (e) => [e.passive]);
    const greedy = this.walk(rootKey, (e) => [e.greedy]);
    const simple = this.walk(rootKey, (e) => (e.passive === e.greedy ? [e.passive] : [e.passive, e.greedy]));
    const hidden = cost.get(rootKey) ?? 0;
    const windows = s.found ? lifeWindows(this.def, this.P, s.taps) : [];
    const base = {
      par,
      steps: s.found ? s.steps : 0,
      minWindow: windows.length > 0 ? Math.min(...windows) : null,
      first: first.size,
      firstGood,
      solutions: par === 0 ? 1 : finals.size,
      passive,
      greedy,
      simple,
      hidden,
    };
    return { ...base, d: difficulty(base) };
  }
}

/** Разбор уровня: пар и решение бота с запасом, граф состояний до пара, «простой игрок», скрытые тела, сложность. */
export function analyzeLevel(def: LevelDef, P: Physics, opt: RobustOptions): Analysis {
  return new Analyzer(def, P, opt).run();
}
