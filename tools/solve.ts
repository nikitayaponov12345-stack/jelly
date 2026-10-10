// Бот-решатель всех уровней игры: `npm run solve` (GDD «Бот-решатель», TESTPLAN §5).
// Для каждого уровня — пар бота с запасом (у каждого нажатия окно не меньше 0,1 с с тем же исходом жизни, короткий
// тап — любой длины до 0,1 с), строгий пар (без запаса), время решения, запас нажатий и объём перебора; решения бота
// с запасом пишутся в data/solutions/<набор>.json (их проверяет tests/unit/solutions.test.ts). Код выхода 1 —
// пар в файле уровня не равен найденному или уровень не решён.
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
/** Наборы, где решение короче 15 с — норма: прототип, учебный мир 1 и проба головоломок (GDD «Уровни и миры», «Как строим уровни»). */
const SHORT_OK = new Set(['proto', 'w1', 'pz']);

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
  // Решение с запасом — тоже решение строгого бота (нажатия на его сетке, те же удержания и пределы), поэтому
  // строгий пар не больше; строгий бот ищет только решение с меньшим числом гибелей (M1-02: так в разы быстрее).
  const fewer = s.found && s.par > 0 ? solve(def, P, { ...strictOpt, maxDeaths: s.par - 1 }) : null;
  const strictPar = !s.found ? -1 : fewer?.found ? fewer.par : s.par;
  const ms = Math.round(performance.now() - t0);
  const windows = s.found ? lifeWindows(def, P, s.taps) : [];
  const minWindow = windows.length > 0 ? Math.min(...windows) : null;
  const notes: string[] = [];
  if (!s.found) notes.push(`не решён с запасом за ${opt.maxDeaths} гибелей`);
  else if (s.par !== def.par) notes.push(`пар в файле ${def.par}, у бота ${s.par}: поправь par в data/levels/${def.file}.txt`);
  if (s.found && !SHORT_OK.has(def.file) && s.steps / 60 < 15) notes.push('решение короче 15 с');
  if (!s.found || s.par !== def.par) failed++;
  console.log(
    row([
      def.id,
      String(def.par),
      s.found ? String(s.par) : '—',
      strictPar >= 0 ? String(strictPar) : '—',
      s.found ? `${(s.steps / 60).toFixed(1)} с` : '—',
      minWindow === null ? '—' : String(minWindow),
      `${s.states} / ${s.nodes}`,
      String(ms),
      notes.join('; '),
    ]),
  );
  const entry = s.found
    ? { map: mapHash(def), par: s.par, strict: strictPar, steps: s.steps, windows, taps: s.taps.map((t) => [t.at, t.hold]) }
    : { map: mapHash(def), par: -1, strict: -1 };
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
