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
