# M1-02 — мир 1 «Карамельный цех»

**Цель.** 15 уровней мира 1 (GDD «Уровни и миры», таблица мира 1): прыжок и удержание, мост из тела на шипах, яма без дна, плита и дверь, пилы, ступенька, парные плиты. Пар — по боту с запасом (от 0 до 3), сложность уровня «Лестница» из прототипа — не раньше второй половины мира (проба Никиты 09.10). Игра идёт по миру 1; уровни прототипа остаются для тестов — адрес игры с `?set=proto`. `npm run solve` теперь решает 21 уровень; чтобы он не стал втрое дольше, строгий бот ищет только решения с меньшим числом гибелей, чем у бота с запасом: решение с запасом — тоже решение строгого бота, поэтому строгий пар не может быть больше.

**Что изменится в игре.** При запуске — «Уровень 1 · Прыжок» мира 1 вместо «Ямы» прототипа; после 15-го уровня — итог набора. Названия и подсказки уровней — на русском и английском, как прежде. Версия 0.0.8. Уровни прототипа — по адресу игры с `?set=proto` (например, `http://localhost:5173/?set=proto`).

Перед началом прочитай `CLAUDE.md`, `data/README.md` (уровни, знаки карты, решения бота), `docs/ARCHITECTURE.md` (§4, §10), `docs/TESTPLAN.md` (§3, §5) и в `docs/GDD.md` раздел «Уровни и миры».

**Проверка до передачи.** Уровни построены Claude 09.10.2026 и проверены обоими ботами: пар в файле — число бота с запасом, строгий бот на мире 1 находит те же числа (проходов «кадр в кадр» с меньшим числом гибелей нет); в каждой жизни решения — не больше трёх прыжков (предел бота); первые две клетки после старта — безопасный пол. Код и уровни прогнаны в песочнице поверх M1-01: `npm run solve` — около 3 минут (из них «Всё вместе» — около минуты, «Три цвета» и «Карамельный цех» — около 40 и 30 с), вывод — как в §4; `npm run check` зелёный, Vitest — 22 файла, 134 теста; Playwright — 15 passed, 1 skipped; снимки первого уровня в обеих раскладках и уровни с парными плитами просмотрены. Из 8 намеренных поломок (пар и карта уровня, решение бота, нет решения, нет строки мира, файл мира не подключён, нет строки подсказки, мир по умолчанию) ловят все: `npm run test` — шесть, `npm run data` — пропуск строки, смоук — мир по умолчанию. Пробная сборка независимым исполнителем по этому тексту (09.10, около 18 минут): все файлы совпали с эталоном байт в байт, вывод `npm run solve` и `data/solutions/w1.json` — как в §4, `npm run check` зелёный. По её итогам в §3 — точная строка `npm run data`, в GDD уточнено, как заполняется «Глубокая яма»; общий порт смоука, на который она наткнулась, исправлен в M1-01.

**Условие.** M1-01 сделана (в `docs/tasks/README.md` у M1-01 стоит «сделано …»). Если нет — остановись и напиши об этом в отчёте.

## 1. Файлы

Как это устроено. Мир — строка в `data/worlds.csv` (id, порядок, файл уровней, ключ названия) и файл уровней `data/levels/<файл>.txt`, подключённый в `src/data.ts`. `src/main.ts` берёт уровни одного мира: адрес `?set=<id мира>`, без него — `w1`; так — до карты миров (M1, пачка 5). Название мира, названия и подсказки уровней — строки `translations/strings.csv`. Решения бота для мира 1 пишет `npm run solve` в `data/solutions/w1.json`, а `tests/unit/solutions.test.ts` повторяет их ядром, как решения прототипа. В `tools/solve.ts` два отличия от M0-05: строгий бот ищет только решения с меньшим числом гибелей, чем у бота с запасом (если не нашёл — строгий пар равен пару с запасом), а замечание «решение короче 15 с» пишется только для миров 2–4: прототип и учебный мир 1 короче (GDD «Уровни и миры», «Как строим уровни»).

Файлы §1.1 и §1.6 — дословно целиком, строки §1.2 и §1.3 — дословно в конец файла. В остальных — правки «было → стало»: блок «было» встречается в файле ровно один раз, его надо заменить блоком «стало», остальное в файле не трогать.

### 1.1. `data/levels/w1.txt` — новый, дословно

Карты — ровно 13 строк по 24 знака; строки внутри карты, начинающиеся с `#`, — ряды земли.

```
# Мир 1 «Карамельный цех» — 15 уровней (M1-02, GDD «Уровни и миры»): ямы с шипами и без дна, тела-мосты
# и ступеньки, плита и дверь, неподвижные пилы, парные плиты. Формат — data/README.md, раздел «Уровни».
# Пар — число бота с запасом (npm run solve).

level w1-01
par 0
map
........................
........................
........................
........................
........................
........................
........................
........................
........................
.@....................F.
########...#####...#####
########...#####...#####
########^^^#####^^^#####
end

level w1-02
par 0
map
........................
........................
........................
........................
........................
........................
.....................F..
..............##########
......###.....##########
.@....###.....##########
########################
########################
########################
end

level w1-03
par 1
map
........................
........................
........................
........................
........................
........................
........................
........................
........................
.@....................F.
#######........#########
#######........#########
#######^^^^^^^^#########
end

level w1-04
par 1
map
........................
........................
........................
........................
........................
........................
........................
........................
........................
.@....................F.
#######....###......####
#######....###......####
#######....###^^^^^^####
end

level w1-05
par 1
map
...............#........
...............#........
...............#........
...............#........
...............#........
...............#........
...............#........
...............D........
...............D........
.@.............D.....F..
########.###############
########P###############
########################
end

level w1-06
par 2
map
..................#.....
..................#.....
..................#.....
..................#.....
..................#.....
..................#.....
..................#.....
..................D.....
..................D.....
.@................D...F.
#####......###.#########
#####......###P#########
#####^^^^^^#############
end

level w1-07
par 0
map
........................
........................
........................
........................
........................
........................
..............S.........
........................
........................
.@.....S.............F..
#############...########
#############...########
#############^^^########
end

level w1-08
par 1
map
........................
........................
........................
........................
........................
.....................F..
............############
............############
............############
.@..........############
########################
########################
########################
end

level w1-09
par 1
map
........................
........................
........................
........................
........................
........................
........................
........................
........................
.@...............S....F.
######........##########
######........##########
######^^^^^^^^##########
end

level w1-10
par 1
map
...................#....
...................#....
...................#....
...................#....
...................#....
...................#....
...................#....
.......#.##........D....
.......#P##........D....
.@.....####........D..F.
########################
########################
########################
end

level w1-11
par 2
map
..............#...#.....
..............#...#.....
..............#...#.....
..............#...#.....
..............#...#.....
..............#...#.....
..............#...#.....
..............E...D.....
..............E...D.....
.@............E...D...F.
######.###.#############
######Q###P#############
########################
end

level w1-12
par 2
map
...................#....
...................#....
...................#....
...................D....
...................D....
...................D..F.
...........#####.#######
...........#####P#######
...........#############
.@.........#############
########################
########################
########################
end

level w1-13
par 1
map
........................
........................
........................
........................
........................
........................
........................
........................
........................
.@....................F.
#######......###########
#######......###########
#######......###########
end

level w1-14
par 3
map
......#.......#....#....
......#.......#....#....
......#.......#....#....
......#.......#....#....
......#.......#....#....
......#.......#....#....
......#.......#....#....
......D.......E....G....
......D.......E....G....
.@....D.......E....G..F.
####.###...#.####.######
####P###...#Q####R######
########^^^#############
end

level w1-15
par 3
map
.......#............#...
.......#............#...
.......#............#...
.......#............E...
.......#............E...
.......#......S.....E.F.
.......#...######.######
.......D...######Q######
.......D...#############
.@.....D...#############
####.###################
####P###################
########################
end
```

### 1.2. `data/worlds.csv` — строка в конец

```
w1,1,w1,world.w1.name
```

### 1.3. `translations/strings.csv` — 31 строка в конец

Кавычки — как здесь: текст с запятой — в кавычках.

```
world.w1.name,Карамельный цех,Caramel Workshop
level.w1-01.name,Прыжок,Jump
level.w1-01.hint,Тап — и яма позади,Tap — and the pit is behind you
level.w1-02.name,Повыше,Higher
level.w1-02.hint,Держи кнопку — прыгнешь выше,Hold the button to jump higher
level.w1-03.name,Мост,Bridge
level.w1-03.hint,Упади на шипы — станешь мостом,Fall on the spikes and become a bridge
level.w1-04.name,Без дна,Bottomless
level.w1-04.hint,"Яму без дна перепрыгни, шипы — засыпь","Jump the bottomless pit, fill the spikes"
level.w1-05.name,Плита,Plate
level.w1-05.hint,Тело на плите держит дверь,A body on the plate holds the door open
level.w1-06.name,Плита за мостом,Plate Past the Bridge
level.w1-06.hint,"Сначала мост, потом плита","Bridge first, then the plate"
level.w1-07.name,Пила,Saw
level.w1-07.hint,"Через пилу — прыжком, под пилой — тапом","Jump over a saw, tap to pass under one"
level.w1-08.name,Ступенька,Step
level.w1-08.hint,Упрись в стену — станешь ступенькой,Stuck at a wall? Become a step
level.w1-09.name,Пила за мостом,Saw Past the Bridge
level.w1-09.hint,За мостом не спеши,Don't rush past the bridge
level.w1-10.name,Плита на столбе,Plate on a Pillar
level.w1-10.hint,Плита наверху — запрыгни к ней,The plate is up top — jump to it
level.w1-11.name,Два цвета,Two Colors
level.w1-11.hint,Цвет плиты — цвет её двери,A plate's color is its door's color
level.w1-12.name,Ступенька и плита,Step and Plate
level.w1-12.hint,"Ступенька, а за ней плита","A step, then a plate"
level.w1-13.name,Глубокая яма,Deep Pit
level.w1-13.hint,Тело на дне — ступенька наверх,A body at the bottom is a step up
level.w1-14.name,Три цвета,Three Colors
level.w1-14.hint,Каждой двери — своя плита,Every door has its own plate
level.w1-15.name,Карамельный цех,Caramel Workshop
level.w1-15.hint,"Всё, чему научился",Everything you've learned
```

### 1.4. `src/data.ts` — подключить файл уровней мира 1

Правка 1. Было:

```ts
import proto from '../data/levels/proto.txt?raw';
import { loadTables, type RawTables, type Tables } from './core/data/tables';
```

Стало:

```ts
import proto from '../data/levels/proto.txt?raw';
import w1 from '../data/levels/w1.txt?raw';
import { loadTables, type RawTables, type Tables } from './core/data/tables';
```

Правка 2. Было:

```ts
 */
export const RAW: Readonly<RawTables> = { constants, worlds, ads, strings, levels: { proto } };
```

Стало:

```ts
 */
export const RAW: Readonly<RawTables> = { constants, worlds, ads, strings, levels: { proto, w1 } };
```

### 1.5. `src/main.ts` — 3 правки: уровни одного мира, версия

Правка 1. Было:

```ts
import { FixedStep, STEP_MS } from './core/clock';
import { allLevels } from './core/levels';
import { physicsFrom } from './core/physics';
```

Стало:

```ts
import { FixedStep, STEP_MS } from './core/clock';
import { allLevels, type LevelDef } from './core/levels';
import { physicsFrom } from './core/physics';
```

Правка 2. Было:

```ts
const VERSION = '0.0.7';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
const BUILD = import.meta.env.VITE_BUILD ?? 'dev';
```

Стало:

```ts
const VERSION = '0.0.8';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
const BUILD = import.meta.env.VITE_BUILD ?? 'dev';

/**
 * Уровни игры — один мир из data/worlds.csv: по умолчанию мир 1 (M1-02), `?set=<id мира>` — другой
 * (`?set=proto` — уровни прототипа для сценариев Playwright и отладки).
 */
function levelSet(): LevelDef[] {
  const id = new URLSearchParams(window.location.search).get('set') ?? 'w1';
  const world = DATA.worlds.find((w) => w.id === id);
  if (!world) throw new Error(`нет мира ${id} в data/worlds.csv`);
  return allLevels(DATA).filter((l) => l.file === world.file);
}
```

Правка 3. Было:

```ts
  const levels = allLevels(DATA);
  const P = physicsFrom(DATA);
```

Стало:

```ts
  const levels = levelSet();
  const P = physicsFrom(DATA);
```

### 1.6. `tools/solve.ts` — заменить целиком

```ts
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
/** Наборы, где решение короче 15 с — норма: прототип и учебный мир 1 (GDD «Уровни и миры», «Как строим уровни»). */
const SHORT_OK = new Set(['proto', 'w1']);

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
```

### 1.7. Версия

В `package.json` — `"version": "0.0.8"`, затем `npm install` (обновит версию в `package-lock.json`, зависимости те же).

## 2. Тесты

### 2.1. `tests/unit/levels.test.ts` — заменить целиком, дословно

Тест «шесть уровней прототипа» берёт только файл `proto`; новый тест — 15 уровней мира 1 и их пар; в тесте повтора id портится только файл прототипа.

```ts
import { describe, expect, it } from 'vitest';
import { loadTables } from '../../src/core/data/tables';
import { allLevels, parseLevels } from '../../src/core/levels';
import { DATA, RAW } from '../../src/data';
import { EMPTY, FLAT } from './maps';

const parse = (text: string): unknown => parseLevels(text, 'x', 24, 13);
const text = (map: readonly string[], head = 'par 1'): string => `level t-1\n${head}\nmap\n${map.join('\n')}\nend\n`;

describe('разбор уровней', () => {
  it('шесть уровней прототипа', () => {
    const levels = allLevels(DATA).filter((l) => l.file === 'proto');
    expect(levels.map((l) => l.id)).toEqual(['p-01', 'p-02', 'p-03', 'p-04', 'p-05', 'p-06']);
    expect(levels.map((l) => l.par)).toEqual([1, 1, 0, 2, 1, 2]);
    for (const l of levels) {
      expect(l.limit).toBeNull();
      expect(l.file).toBe('proto');
      expect(l.map).toHaveLength(13);
      for (const row of l.map) expect(row).toHaveLength(24);
    }
    // Строка карты, которая начинается с #, — ряд, а не комментарий.
    expect(levels[0]!.map[12]).toBe('#######^^^^^^^^#########');
  });

  it('мир 1 — 15 уровней Карамельного цеха, пар 0–3', () => {
    const levels = allLevels(DATA).filter((l) => l.file === 'w1');
    expect(levels.map((l) => l.id)).toEqual(Array.from({ length: 15 }, (_, i) => `w1-${String(i + 1).padStart(2, '0')}`));
    expect(levels.map((l) => l.par)).toEqual([0, 0, 1, 1, 1, 2, 0, 1, 1, 1, 2, 2, 1, 3, 3]);
    expect(DATA.worlds.map((w) => w.id)).toEqual(['proto', 'w1']);
    for (const l of levels) {
      expect(l.limit).toBeNull();
      expect(DATA.text(`level.${l.id}.name`, 'ru')).not.toBe('');
    }
  });

  it('ошибки называют файл и причину', () => {
    expect(() => parse('﻿' + text(FLAT))).toThrow('data/levels/x.txt: BOM в начале файла');
    expect(() => parse(text(FLAT, ''))).toThrow('нет строки par');
    expect(() => parse(text(FLAT.slice(1)))).toThrow('12 строк вместо 13');
    expect(() => parse(text([EMPTY.slice(1), ...FLAT.slice(1)]))).toThrow('23 знаков вместо 24');
    expect(() => parse(text(['X' + EMPTY.slice(1), ...FLAT.slice(1)]))).toThrow('неизвестный знак «X»');
    expect(() => parse(text(['@' + EMPTY.slice(1), ...FLAT.slice(1)]))).toThrow('старт @ — 2 раз');
    expect(() => parse(text(FLAT.map((r) => r.replace('F', '.'))))).toThrow('флаг F — 0 раз');
    expect(() => parse(text(FLAT).replace(/end\n$/, ''))).toThrow('последний уровень не закрыт строкой end');
    expect(() => parse(text(FLAT, 'par 1\nspeed 3'))).toThrow('неизвестная строка «speed 3»');
    expect(() => parse('par 1\n' + text(FLAT))).toThrow('строка вне уровня');
    expect(() => parse(text(FLAT, 'par -1'))).toThrow('par = «-1» — нужно целое ≥ 0');
  });

  it('повтор id уровня', () => {
    const t = loadTables({ ...RAW, levels: { ...RAW.levels, proto: RAW.levels.proto + '\n' + RAW.levels.proto } });
    expect(() => allLevels(t)).toThrow('повтор id уровня p-01');
  });
});
```

### 2.2. `tests/unit/data.test.ts` — миры: прототип и мир 1

Было:

```ts
  it('мир прототипа и его файл уровней', () => {
    expect(DATA.worlds.map((w) => w.id)).toEqual(['proto']);
    expect(DATA.worlds[0]?.file).toBe('proto');
    expect(DATA.levelFiles.proto).toContain('level p-01');
  });
```

Стало:

```ts
  it('миры: прототип и мир 1, у каждого свой файл уровней', () => {
    expect(DATA.worlds.map((w) => [w.id, w.file])).toEqual([
      ['proto', 'proto'],
      ['w1', 'w1'],
    ]);
    expect(DATA.levelFiles.proto).toContain('level p-01');
    expect(DATA.levelFiles.w1).toContain('level w1-01');
  });
```

### 2.3. `tests/e2e/play.spec.ts` — сценарии идут на уровнях прототипа

Правка 1. Было:

```ts
async function open(page: Page): Promise<string[]> {
```

Стало:

```ts
/** Игра с уровнями прототипа (`?set=proto`): сценарии ниже написаны на них. */
async function open(page: Page): Promise<string[]> {
```

Правка 2. Было:

```ts
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });
```

Стало:

```ts
  });
  await page.goto('/?set=proto');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });
```

### 2.4. `tests/e2e/smoke.spec.ts` — по умолчанию мир 1, снимок `m1-02_*`

Было:

```ts
  // Язык страницы берётся из браузера: ru — «Желейный легион», иначе «Jelly Legion».
  await expect(page.getByTestId('debug-line')).toContainText(/(Желейный легион|Jelly Legion) 0\.0\.7/);

  await page.screenshot({ path: `build/shots/m0-03_${info.project.name}.png` });
  expect(errors).toEqual([]);
});

// Ядро в собранной игре: первая желейка ждёт нажатия; «Плита» проходится без прыжков с одной гибелью.
test('ядро уровня: старт по нажатию и «Плита» без прыжков', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });
```

Стало:

```ts
  // Язык страницы берётся из браузера: ru — «Желейный легион», иначе «Jelly Legion».
  await expect(page.getByTestId('debug-line')).toContainText(/(Желейный легион|Jelly Legion) 0\.0\.8/);

  // По умолчанию — мир 1: 15 уровней, первый — «Прыжок».
  expect(await page.evaluate(() => window.__game!.levels().length)).toBe(15);
  expect(await page.evaluate(() => window.__game!.state().level)).toBe('w1-01');
  await expect(page.getByTestId('hud-level')).toContainText(/(Уровень|Level) 1 · (Прыжок|Jump)/);

  await page.screenshot({ path: `build/shots/m1-02_${info.project.name}.png` });
  expect(errors).toEqual([]);
});

// Ядро в собранной игре: первая желейка ждёт нажатия; «Плита» прототипа (`?set=proto`) проходится без прыжков с одной гибелью.
test('ядро уровня: старт по нажатию и «Плита» без прыжков', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?set=proto');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });
```

## 3. Порядок
1. Файлы и правки §1, `npm install`, `npm run data` — строка `data-check: ok (таблиц: 4, строк перевода: 63, уровней: 21, файлов уровней: 2)`. До шага 2 `npm run test` падает: в `tests/unit/solutions.test.ts` нет решений мира 1 (`data/solutions/w1.json` ещё нет) — это ожидаемо.
2. `npm run solve` — запишет `data/solutions/w1.json`, `data/solutions/proto.json` не изменится; вывод сверить с §4.
3. Тесты §2, `npm run check`.

## 4. Ожидаемый вывод `npm run solve`

Сверять строки программы — от `solve: уровней` до `solve: ok`. На ноутбуке может отличаться только столбец «мс» (здесь — «…»); в строках без замечаний после него — пробелы до ширины столбца. Остальное — точно так:

```
solve: уровней 21; бот с запасом — нажатие раз в 6 шагов, окно от 6 шагов, короткий тап 1…6 шагов; строгий — нажатие раз в 3 шага; удержание 1 и 30 шагов, до 3 прыжков за жизнь, до 8 гибелей
уровень  пар    бот    строго  время    окно   перебор               мс      замечания
p-01     1      1      1       6.7 с    12     17318 / 6             …
p-02     1      1      1       7.7 с    —      194201 / 17           …
p-03     0      0      0       5.5 с    12     140064 / 1            …
p-04     2      2      2       12.4 с   10     1696009 / 76          …
p-05     1      1      0       5.5 с    6      23006 / 7             …
p-06     2      2      1       12.6 с   12     32058424 / 668        …
w1-01    0      0      0       4.5 с    12     5090 / 1              …
w1-02    0      0      0       4.3 с    12     428863 / 1            …
w1-03    1      1      1       6.9 с    12     18093 / 6             …
w1-04    1      1      1       8.0 с    9      65691 / 9             …
w1-05    1      1      1       8.9 с    —      251562 / 6            …
w1-06    2      2      2       12.0 с   11     1059177 / 30          …
w1-07    0      0      0       4.3 с    7      3901 / 1              …
w1-08    1      1      1       9.6 с    11     282227 / 5            …
w1-09    1      1      1       6.9 с    12     15783 / 6             …
w1-10    1      1      1       9.1 с    12     2497798 / 9           …
w1-11    2      2      2       13.8 с   —      2267284 / 33          …
w1-12    2      2      2       16.0 с   6      1826376 / 18          …
w1-13    1      1      1       6.6 с    7      29374 / 6             …
w1-14    3      3      3       20.4 с   12     16453962 / 131        …
w1-15    3      3      3       20.9 с   12     11158867 / 98         …
пар — в файле уровня; бот — найденный ботом с запасом; строго — без запаса (точность 1/60 с); время — решения
бота с запасом; окно — наименьший запас нажатия в своей жизни, шагов по 1/60 с (12 — это 12 и больше);
перебор — шагов желейки / состояний уровня у бота с запасом; мс — оба бота.
solve: решения записаны в data/solutions/proto.json
solve: решения записаны в data/solutions/w1.json
solve: ok — пар каждого уровня равен найденному ботом с запасом
```

`data/solutions/w1.json` должен совпасть с этим текстом:

```json
{
  "note": "Решения бота с запасом: пишет npm run solve, руками не править.",
  "levels": {
    "w1-01": {"map":"536b148b","par":0,"strict":0,"steps":271,"windows":[12,12],"taps":[[96,1],[198,1]]},
    "w1-02": {"map":"bc5886c3","par":0,"strict":0,"steps":258,"windows":[12,12],"taps":[[42,1],[138,30]]},
    "w1-03": {"map":"e1f32fa3","par":1,"strict":1,"steps":412,"windows":[12,12,12],"taps":[[48,30],[216,1],[276,30]]},
    "w1-04": {"map":"fab0b429","par":1,"strict":1,"steps":481,"windows":[9,12,9,12],"taps":[[66,30],[126,1],[288,1],[408,30]]},
    "w1-05": {"map":"7ba3a2cc","par":1,"strict":1,"steps":535,"windows":[],"taps":[]},
    "w1-06": {"map":"5a566754","par":2,"strict":2,"steps":718,"windows":[11,12,12],"taps":[[6,1],[168,30],[528,30]]},
    "w1-07": {"map":"e5b263b0","par":0,"strict":0,"steps":258,"windows":[12,7],"taps":[[66,1],[162,1]]},
    "w1-08": {"map":"ca4a6233","par":1,"strict":1,"steps":575,"windows":[12,11,12],"taps":[[282,1],[402,30],[444,1]]},
    "w1-09": {"map":"0b4f4f6a","par":1,"strict":1,"steps":412,"windows":[12,12,12,12],"taps":[[48,30],[210,1],[276,1],[342,1]]},
    "w1-10": {"map":"747e4d30","par":1,"strict":1,"steps":548,"windows":[12,12],"taps":[[48,30],[324,30]]},
    "w1-11": {"map":"03254b6d","par":2,"strict":2,"steps":825,"windows":[],"taps":[]},
    "w1-12": {"map":"4fe7c5fc","par":2,"strict":2,"steps":959,"windows":[6,7,12,7,12],"taps":[[270,1],[378,1],[414,30],[762,1],[798,30]]},
    "w1-13": {"map":"52c81859","par":1,"strict":1,"steps":394,"windows":[7,12],"taps":[[24,30],[228,30]]},
    "w1-14": {"map":"eae4a104","par":3,"strict":3,"steps":1222,"windows":[12,12,12],"taps":[[318,1],[648,1],[1044,1]]},
    "w1-15": {"map":"842a6e7e","par":3,"strict":3,"steps":1255,"windows":[12,12,12,12,12,12],"taps":[[612,1],[660,30],[720,1],[1038,1],[1086,30],[1146,1]]}
  }
}
```

## 5. Снимки — посмотреть глазами
Надписи на снимках английские: у Playwright язык браузера по умолчанию английский (по-русски — «Уровень 1 · Прыжок», «Тап — и яма позади»).
- `build/shots/m1-02_desktop.png` — «Прыжок» до старта: сверху «Level 1 · Jump», розовое «Legion: 0 / par 0», «0:00», фиолетовая кнопка «↻»; над полем — надпись уровня или плашка «Tap — and the pit is behind you»; посередине — «Tap to start» и под ней «Tap to jump · hold to jump higher»; внизу — пол, две ямы с шипами шириной в 3 клетки и флаг справа.
- `build/shots/m1-02_phone.png` — то же в портрете: строка счёта в две строки, «↻» справа в ней; под полем — карта уровня с двумя ямами и флагом, рамка камеры — слева.

## 6. Критерии готовности
- Файлы §1.1 и §1.6 и тест §2.1 — дословно, строки §1.2 и §1.3 — дословно в конец, правки — как написано.
- `npm run solve` — код выхода 0, вывод и `data/solutions/w1.json` — как в §4, `data/solutions/proto.json` не изменился.
- `npm run check` зелёный: Vitest — 22 файла (новых файлов тестов нет), тестов 134 (было 118: плюс тест мира 1 и 15 решений мира 1); `npm run test` — до 30 с; сборка до 3 МБ; Playwright — 15 passed, 1 skipped.
- Снимки §5 соответствуют описанию.
- `npm run publish -- --dry-run` — строка `publish: Желейный легион 0.0.8 (<хеш>+), …`.
- В `docs/tasks/README.md` — строка M1-02 «сделано ДД.ММ».

## Если что-то не так
- Если `npm run solve` даёт другие пар, время или решения — ничего не подгоняй (ни карты, ни `par`): приложи вывод целиком и `data/solutions/w1.json`.
- Если `npm run solve` идёт дольше 6 минут или `npm run test` дольше 30 с — напиши, сколько (столбец «мс»; для тестов — `npx vitest run --reporter=verbose`).

## Отчёт
Что сделано; вывод `npm run solve` целиком; итоговые строки `npm run check`; что видно на снимках §5; строка `publish --dry-run`; что не получилось и почему.
