import type { Tables } from './data/tables';

/** Уровень из файла data/levels/<набор>.txt — как есть, до разбора на клетки. */
export interface LevelDef {
  id: string;
  par: number;
  /** Лимит легиона (мир 4); null — без лимита. */
  limit: number | null;
  /** grid_rows строк по grid_cols знаков. */
  map: readonly string[];
  /** Набор (файл без .txt) и строка `level …` — для сообщений об ошибках. */
  file: string;
  line: number;
}

/** Знаки карты (data/README.md). */
export const TILE_CHARS = '#.@F^SLlPD';

/**
 * Разбор файла уровней по тем же правилам, что tools/data-check.mjs. Комментарии `#` — только вне карты:
 * внутри `map … end` каждая строка — ряд карты. Ошибка — Error(`<файл>:<строка>: …`).
 */
export function parseLevels(text: string, file: string, cols: number, rows: number): LevelDef[] {
  const rel = `data/levels/${file}.txt`;
  if (text.charCodeAt(0) === 0xfeff) throw new Error(`${rel}: BOM в начале файла`);
  const lines = text.split('\n').map((s) => s.replace(/\r$/, ''));
  const out: LevelDef[] = [];
  let cur: { id: string; line: number; par: number | null; limit: number | null; map: string[] } | null = null;
  let inMap = false;
  const fail = (line: number, msg: string): never => {
    throw new Error(`${rel}:${line}: ${msg}`);
  };
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (inMap && cur) {
      if (raw !== 'end') {
        cur.map.push(raw);
        return;
      }
      inMap = false;
      out.push(finish(cur, rel, cols, rows));
      cur = null;
      return;
    }
    const s = raw.trim();
    if (s === '' || s.startsWith('#')) return;
    const [word = '', ...rest] = s.split(/\s+/);
    if (word === 'level') {
      if (cur) fail(line, `уровень ${cur.id} не закрыт строкой end`);
      cur = { id: rest.join(' '), line, par: null, limit: null, map: [] };
    } else if (!cur) fail(line, `строка вне уровня: «${s}»`);
    else if (word === 'par' || word === 'limit') {
      const n = Number(rest[0]);
      const min = word === 'par' ? 0 : 1;
      if (rest.length !== 1 || !Number.isInteger(n) || n < min) fail(line, `${word} = «${rest.join(' ')}» — нужно целое ≥ ${min}`);
      if (word === 'par') cur.par = n;
      else cur.limit = n;
    } else if (word === 'map') inMap = true;
    else fail(line, `неизвестная строка «${s}»`);
  });
  if (cur) throw new Error(`${rel}: последний уровень не закрыт строкой end`);
  return out;
}

function finish(
  lv: { id: string; line: number; par: number | null; limit: number | null; map: string[] },
  rel: string,
  cols: number,
  rows: number,
): LevelDef {
  const at = `${rel}:${lv.line}`;
  if (lv.par === null) throw new Error(`${at}: у уровня ${lv.id} нет строки par`);
  if (lv.map.length !== rows) throw new Error(`${at}: в карте ${lv.id} ${lv.map.length} строк вместо ${rows}`);
  let starts = 0;
  let flags = 0;
  lv.map.forEach((row, r) => {
    if (row.length !== cols) throw new Error(`${at}: строка ${r} карты ${lv.id} — ${row.length} знаков вместо ${cols}`);
    for (const ch of row) {
      if (!TILE_CHARS.includes(ch)) throw new Error(`${at}: в карте ${lv.id} неизвестный знак «${ch}» (строка ${r})`);
      if (ch === '@') starts++;
      if (ch === 'F') flags++;
    }
  });
  if (starts !== 1) throw new Error(`${at}: в карте ${lv.id} старт @ — ${starts} раз, нужен один`);
  if (flags !== 1) throw new Error(`${at}: в карте ${lv.id} флаг F — ${flags} раз, нужен один`);
  const file = rel.slice('data/levels/'.length, -'.txt'.length);
  return { id: lv.id, par: lv.par, limit: lv.limit, map: lv.map, file, line: lv.line };
}

/** Все уровни игры: миры в порядке worlds.csv, уровни — в порядке файла. Повтор id — ошибка. */
export function allLevels(t: Tables): LevelDef[] {
  const cols = t.num('grid_cols');
  const rows = t.num('grid_rows');
  const out: LevelDef[] = [];
  const seen = new Set<string>();
  for (const w of t.worlds) {
    const text = t.levelFiles[w.file];
    if (text === undefined) throw new Error(`worlds.csv: у мира ${w.id} нет файла data/levels/${w.file}.txt`);
    for (const lv of parseLevels(text, w.file, cols, rows)) {
      if (seen.has(lv.id)) throw new Error(`data/levels/${w.file}.txt:${lv.line}: повтор id уровня ${lv.id}`);
      seen.add(lv.id);
      out.push(lv);
    }
  }
  return out;
}
