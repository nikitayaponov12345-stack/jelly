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
