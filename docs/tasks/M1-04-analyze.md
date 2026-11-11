# M1-04 — разбор уровней ботом: `npm run analyze`

**Цель.** Проба головоломок (0.0.9, 11.11) — Никита: «уровни достаточно понятные, догадаться до решения не сложно, надо лишь потратить время на решение, или вовремя нажать прыжок, чтобы желе умерло в нужном месте, а как таковой головоломки нет, это больше подходит для вводных уровней». Решение Никиты 11.11 (GDD, раздел «Решения», строка «Сложность уровней»): уровни делаем по методу «ИИ придумывает — бот судит — формула ставит на кривую — Никита калибрует». Эта задача добавляет судью — разбор уровня ботом с запасом: сколько разных мест первой гибели и сколько из них оставляют пар, сколько разных построек из тел дают пар, сколько гибелей тратит «простой игрок», сколько тел он бы не положил и сложность по формуле. Раньше разбор жил только в песочнице Claude и пропал вместе с ней; теперь он в репозитории.

**Что изменится в игре.** Ничего. Новая команда для разработки: `npm run analyze -- <набор>`, например `npm run analyze -- pz`. Версия остаётся 0.0.9.

Перед началом прочитай `CLAUDE.md`, в `docs/GDD.md` разделы «Уровни и миры» (правила «Как строим уровни», таблицы проб) и «Бот-решатель», а также `src/core/solver/robust.ts` и `src/core/solver/solve.ts`: разбор собран из их частей (`searchLife`, `LifeOracle`, `solveRobust`) и их не меняет.

**Проверка до передачи.** Код написан Claude 11.11 поверх файлов ноутбука после M1-03 (скопированы в песочницу 11.11; M1-03 принята по коду: все файлы — как в её тексте). `npm run analyze -- pz` даёт те же числа, что таблица «Головоломки — проба» в GDD (их считал прежний инструмент песочницы 10.10): первые тела 7/3, 7/1, 4/1, 5/1, 7/1, 4/1, «простой игрок» 2, 8, 3, 4, 5 и «не дошёл». `npm run test` — 23 файла, 145 тестов. Из 4 намеренных поломок (вес скрытых тел в формуле, счёт хороших первых тел, выбор «простого игрока», цена «простой» гибели) Vitest ловит все четыре.

**Условие.** M1-03 сделана (в `docs/tasks/README.md` у M1-03 стоит «сделано …»). Если нет — остановись и напиши об этом в отчёте.

## 1. Файлы

Как это устроено. `Analyzer` перебирает жизни желейки от состояния уровня (тела и фаза лазеров) тем же перебором, что бот с запасом, но без отсечки по времени: из каждого состояния — все исходы жизни, где у каждого нажатия есть запас (окно и тап — как у пара). Из этого строится граф состояний до глубины пара: «хорошие» узлы — те, откуда за оставшиеся гибели жизнь с запасом доходит до флага. «Не жать» — жизнь без нажатий; «подальше» — флаг, если он достижим, иначе гибель с телом правее всех (при равенстве — с меньшим числом нажатий); «простой игрок» в каждой жизни выбирает одно из двух. «Скрыто» — сколько гибелей самое меньшее приходится делать не «простыми» жизнями в решениях за пар (у уровня, где «простой игрок» берёт пар, — 0). Формула сложности — `difficulty()`; веса стартовые, их подгоняют по пробам Никиты.

Файлы §1.1–§1.3 — новые, дословно целиком. В `package.json` — правка «было → стало»: блок «было» встречается в файле ровно один раз, его надо заменить блоком «стало», остальное не трогать.

### 1.1. `src/core/solver/analyze.ts` — новый, дословно

```ts
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
```

### 1.2. `tools/analyze.ts` — новый, дословно

```ts
// Разбор уровней ботом с запасом: `npm run analyze -- <набор>` (например, `npm run analyze -- pz2`), без набора — все.
// Для каждого уровня — пар и запас нажатия (как у npm run solve), первые тела: сколько разных и сколько оставляют пар,
// сколько разных построек из тел дают пар, гибели «простого игрока» и сложность по формуле
// (GDD «Уровни и миры», «Как строим уровни»). Ничего не пишет; код выхода 1 — нет такого набора.
// Тяжёлый: на уровень от секунд до минут — запускать на один набор.
import { analyzeLevel } from '../src/core/solver/analyze';
import { allLevels } from '../src/core/levels';
import { physicsFrom } from '../src/core/physics';
import { robustOptions } from '../src/core/solver/robust';
import { DATA } from '../src/data';

const P = physicsFrom(DATA);
const opt = robustOptions(P, DATA.num('par_window_s'), DATA.num('par_tap_s'));
const set = process.argv[2];
const levels = allLevels(DATA).filter((l) => set === undefined || l.file === set);
if (levels.length === 0) {
  console.error(`analyze: нет набора «${set}» — наборы: ${DATA.worlds.map((w) => w.file).join(', ')}`);
  process.exit(1);
}
console.log(`analyze: ${set === undefined ? 'все наборы' : `набор ${set}`}, уровней ${levels.length}; жизни — с запасом, как у npm run solve`);
const widths = [9, 5, 6, 10, 8, 8, 10, 9, 8, 6, 6];
const row = (cells: string[]): string => cells.map((c, i) => (i < widths.length ? c.padEnd(widths[i]!) : c)).join('');
const n = (v: number | null): string => (v === null ? '—' : String(v));
console.log(row(['уровень', 'пар', 'окно', 'первые', 'решений', 'не жать', 'подальше', 'простой', 'скрыто', 'D', 'мс']));
for (const def of levels) {
  const t0 = performance.now();
  const a = analyzeLevel(def, P, opt);
  const ms = Math.round(performance.now() - t0);
  console.log(
    row([
      def.id,
      a.par >= 0 ? String(a.par) : '—',
      n(a.minWindow),
      `${a.first} / ${a.firstGood}`,
      String(a.solutions),
      n(a.passive),
      n(a.greedy),
      n(a.simple),
      String(a.hidden),
      a.d.toFixed(1),
      String(ms),
    ]),
  );
}
console.log('пар и окно — как у npm run solve; первые — разных мест первой гибели / сколько из них оставляют пар;');
console.log('решений — разных наборов тел, с которыми уровень проходится за пар; не жать, подальше, простой — гибелей');
console.log('до флага, если ни разу не жать, если в каждой жизни уходить как можно правее и если в каждой жизни выбирать');
console.log('одно из двух (— — не дошёл за 8 гибелей); скрыто — сколько гибелей решения за пар самое меньшее не из этих двух;');
console.log('D = пар + 1,5 × скрыто + log₂(первые / хорошие) + 0,5 × [окно < 9] − 2 × [простой ≤ пар].');
```

### 1.3. `tools/analyze.config.ts` — новый, дословно

```ts
import { defineConfig } from 'vite';

// Сборка разбора уровней для Node: `npm run analyze` собирает tools/analyze.ts в build/analyze/analyze.mjs и запускает
// его — как tools/solve.config.ts у бота-решателя.
export default defineConfig({
  logLevel: 'warn',
  build: {
    ssr: 'tools/analyze.ts',
    outDir: 'build/analyze',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'analyze.mjs' } },
  },
});
```

### 1.4. `package.json` — команда `analyze`

Было:

```json
    "solve": "vite build --config tools/solve.config.ts && node build/solve/solve.mjs"
  },
```

Стало:

```json
    "solve": "vite build --config tools/solve.config.ts && node build/solve/solve.mjs",
    "analyze": "vite build --config tools/analyze.config.ts && node build/analyze/analyze.mjs"
  },
```

## 2. Тесты

### 2.1. `tests/unit/analyze.test.ts` — новый, дословно

Тест разбирает три быстрых уровня (около 2 с): «Подставку» и «Мост в воздухе» из пробы головоломок и «Пилу за мостом» мира 1 — там жизнь «подальше» сама кладёт нужное тело.

```ts
import { describe, expect, it } from 'vitest';
import { allLevels } from '../../src/core/levels';
import { physicsFrom } from '../../src/core/physics';
import { analyzeLevel, difficulty } from '../../src/core/solver/analyze';
import { robustOptions } from '../../src/core/solver/robust';
import { DATA } from '../../src/data';

const P = physicsFrom(DATA);
const OPT = robustOptions(P, DATA.num('par_window_s'), DATA.num('par_tap_s'));
const level = (id: string) => allLevels(DATA).find((l) => l.id === id)!;

describe('разбор уровня ботом (npm run analyze)', () => {
  it('формула сложности: пар, скрытые тела, доля хороших первых тел, тесное окно, простой игрок', () => {
    const base = { par: 2, steps: 600, minWindow: 12, first: 8, firstGood: 1, solutions: 1, passive: null, greedy: null, simple: null, hidden: 1 };
    expect(difficulty(base)).toBe(6.5); // 2 + 1,5 + log₂ 8
    expect(difficulty({ ...base, minWindow: 8 })).toBe(7); // окно < 9 шагов — +0,5
    expect(difficulty({ ...base, simple: 2 })).toBe(4.5); // простой игрок берёт пар — −2
    expect(difficulty({ ...base, firstGood: 0, par: 0, hidden: 0 })).toBe(0);
  });

  it('«Подставка» (pz-01): семь первых тел, три оставляют пар — три решения; простой игрок тратит 2', () => {
    expect(analyzeLevel(level('pz-01'), P, OPT)).toEqual({
      par: 1,
      steps: 381,
      minWindow: 12,
      first: 7,
      firstGood: 3,
      solutions: 3,
      passive: null,
      greedy: 2,
      simple: 2,
      hidden: 1,
      d: 3.7,
    });
  });

  it('«Пила за мостом» (w1-09): жизнь «подальше» сама кладёт нужное тело — скрытых тел нет, простой игрок берёт пар', () => {
    expect(analyzeLevel(level('w1-09'), P, OPT)).toMatchObject({
      par: 1,
      first: 5,
      firstGood: 2,
      solutions: 2,
      passive: null,
      greedy: 1,
      simple: 1,
      hidden: 0,
      d: 0.3,
    });
  });

  it('«Мост в воздухе» (pz-04): пять первых тел, к пару ведёт одно; без нажатий не дойти', () => {
    expect(analyzeLevel(level('pz-04'), P, OPT)).toMatchObject({
      par: 1,
      minWindow: 7,
      first: 5,
      firstGood: 1,
      solutions: 1,
      passive: null,
      simple: 4,
      hidden: 1,
      d: 5.3,
    });
  });
});
```

## 3. Порядок
1. Файлы §1 и тест §2. `npm run test` — зелёный.
2. `npm run analyze -- pz` (около 30 с) — вывод сверить с §4.
3. `npm run check`.

## 4. Ожидаемый вывод `npm run analyze -- pz`

Сверять от строки `analyze: набор pz` до конца. На ноутбуке может отличаться только столбец «мс» (здесь — «…»); остальное — точно так:

```
analyze: набор pz, уровней 6; жизни — с запасом, как у npm run solve
уровень  пар  окно  первые    решений не жать подальше  простой  скрыто  D     мс
pz-01    1    12    7 / 3     3       —       2         2        1       3.7   …
pz-02    1    12    7 / 1     1       —       —         8        1       5.3   …
pz-03    1    11    4 / 1     1       —       3         3        1       4.5   …
pz-04    1    7     5 / 1     1       —       4         4        1       5.3   …
pz-05    2    12    7 / 1     1       —       5         5        2       7.8   …
pz-06    2    7     4 / 1     1       —       —         —        2       7.5   …
пар и окно — как у npm run solve; первые — разных мест первой гибели / сколько из них оставляют пар;
решений — разных наборов тел, с которыми уровень проходится за пар; не жать, подальше, простой — гибелей
до флага, если ни разу не жать, если в каждой жизни уходить как можно правее и если в каждой жизни выбирать
одно из двух (— — не дошёл за 8 гибелей); скрыто — сколько гибелей решения за пар самое меньшее не из этих двух;
D = пар + 1,5 × скрыто + log₂(первые / хорошие) + 0,5 × [окно < 9] − 2 × [простой ≤ пар].
```

## 5. Критерии готовности
- Файлы §1.1–§1.3 и §2.1 — дословно, правка §1.4 — как написано; `src/core/solver/robust.ts`, `solve.ts` и `replay.ts` не изменились.
- `npm run analyze -- pz` — код выхода 0, вывод — как в §4; `npm run analyze -- xx` — код выхода 1 и строка `analyze: нет набора «xx» — наборы: proto, w1, pz`.
- `npm run check` зелёный: Vitest — 23 файла, 145 тестов (было 141: плюс четыре теста разбора); сборка до 3 МБ; Playwright — 15 passed, 1 skipped.
- В `docs/tasks/README.md` — строка M1-04 «сделано ДД.ММ».

## Если что-то не так
- Если числа `npm run analyze -- pz` другие — ничего не подгоняй: приложи вывод целиком.
- Если `npm run analyze -- pz` идёт дольше 2 минут или `npm run test` дольше 30 с — напиши, сколько.

## Отчёт
Что сделано; вывод `npm run analyze -- pz` целиком; итоговые строки `npm run check`; что не получилось и почему.
