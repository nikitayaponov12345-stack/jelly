import { parseCsv } from './csv';

export type Lang = 'ru' | 'en';

export interface ConstantRow {
  key: string;
  value: number;
  unit: string;
  note: string;
}

export interface WorldRow {
  id: string;
  order: number;
  /** Имя файла уровней в data/levels/ без .txt. */
  file: string;
  nameKey: string;
}

export type AdKind = 'rewarded' | 'interstitial';

export interface AdRow {
  place: string;
  kind: AdKind;
  reward: string | null;
  firstAfterS: number | null;
  cooldownS: number | null;
  afterLevels: number | null;
  note: string;
}

/** Текст таблиц как есть: CSV и файлы уровней. */
export interface RawTables {
  constants: string;
  worlds: string;
  ads: string;
  strings: string;
  /** Файлы data/levels/*.txt: имя файла без .txt → текст. Разбор уровней — src/core/levels.ts (M0-01). */
  levels: Readonly<Record<string, string>>;
}

export interface Tables {
  readonly constants: readonly ConstantRow[];
  /** Миры в порядке `order`. */
  readonly worlds: readonly WorldRow[];
  readonly ads: readonly AdRow[];
  /** Текст файлов уровней: имя файла без .txt → текст. */
  readonly levelFiles: Readonly<Record<string, string>>;
  /** Значение из constants.csv; нет ключа → throw Error('constants.csv: нет ключа <key>'). */
  num(key: string): number;
  /** Строка перевода; нет ключа → throw Error('strings.csv: нет строки <key>'). */
  text(key: string, lang: Lang): string;
  hasText(key: string): boolean;
  /** Строка перевода с подстановкой: «{n}» → vars.n. Нет переменной → throw. */
  format(key: string, lang: Lang, vars: Readonly<Record<string, string | number>>): string;
}

type Row = Readonly<Record<string, string>> & { readonly __line: number };

const CONSTANTS_HEADER = ['key', 'value', 'unit', 'note'] as const;
const WORLDS_HEADER = ['id', 'order', 'file', 'name_key'] as const;
const ADS_HEADER = ['place', 'kind', 'reward', 'first_after_s', 'cooldown_s', 'after_levels', 'note'] as const;
const STRINGS_HEADER = ['key', 'ru', 'en'] as const;

function table(text: string, file: string, header: readonly string[]): Row[] {
  const rows = parseCsv(text, file);
  const head = rows.shift() ?? [];
  if (head.join(',') !== header.join(',')) {
    throw new Error(`${file}: заголовок «${head.join(',')}», ожидался «${header.join(',')}»`);
  }
  return rows.map((r, i) => {
    if (r.length !== header.length) throw new Error(`${file}: строка ${i + 2} — ${r.length} полей вместо ${header.length}`);
    const o: Record<string, string | number> = { __line: i + 2 };
    header.forEach((h, j) => (o[h] = (r[j] ?? '').trim()));
    return o as Row;
  });
}

function cell(r: Row, col: string): string {
  return r[col] ?? '';
}

function num(r: Row, col: string, file: string): number {
  const v = cell(r, col);
  const n = Number(v);
  if (v === '' || !Number.isFinite(n)) throw new Error(`${file}: строка ${r.__line}, ${col} = «${v}» — не число`);
  return n;
}

function optNum(r: Row, col: string, file: string): number | null {
  return cell(r, col) === '' ? null : num(r, col, file);
}

function adKind(r: Row): AdKind {
  const k = cell(r, 'kind');
  if (k !== 'rewarded' && k !== 'interstitial') throw new Error(`ads.csv: строка ${r.__line}, kind = «${k}»`);
  return k;
}

/** Таблицы из текста; ошибка формата — исключение с именем файла и строкой. */
export function loadTables(raw: RawTables): Tables {
  const constants: ConstantRow[] = table(raw.constants, 'constants.csv', CONSTANTS_HEADER).map((r) => ({
    key: cell(r, 'key'),
    value: num(r, 'value', 'constants.csv'),
    unit: cell(r, 'unit'),
    note: cell(r, 'note'),
  }));
  const byKey = new Map(constants.map((c) => [c.key, c.value]));

  const worlds: WorldRow[] = table(raw.worlds, 'worlds.csv', WORLDS_HEADER)
    .map((r) => ({
      id: cell(r, 'id'),
      order: num(r, 'order', 'worlds.csv'),
      file: cell(r, 'file'),
      nameKey: cell(r, 'name_key'),
    }))
    .sort((a, b) => a.order - b.order);
  for (const w of worlds) {
    if (raw.levels[w.file] === undefined) throw new Error(`worlds.csv: у мира ${w.id} нет файла data/levels/${w.file}.txt`);
  }

  const ads: AdRow[] = table(raw.ads, 'ads.csv', ADS_HEADER).map((r) => ({
    place: cell(r, 'place'),
    kind: adKind(r),
    reward: cell(r, 'reward') || null,
    firstAfterS: optNum(r, 'first_after_s', 'ads.csv'),
    cooldownS: optNum(r, 'cooldown_s', 'ads.csv'),
    afterLevels: optNum(r, 'after_levels', 'ads.csv'),
    note: cell(r, 'note'),
  }));

  const strings = new Map<string, { ru: string; en: string }>();
  for (const r of table(raw.strings, 'strings.csv', STRINGS_HEADER)) {
    strings.set(cell(r, 'key'), { ru: cell(r, 'ru'), en: cell(r, 'en') });
  }

  const text = (key: string, lang: Lang): string => {
    const s = strings.get(key);
    if (!s) throw new Error(`strings.csv: нет строки ${key}`);
    return s[lang];
  };

  return {
    constants,
    worlds,
    ads,
    levelFiles: raw.levels,
    num(key) {
      const v = byKey.get(key);
      if (v === undefined) throw new Error(`constants.csv: нет ключа ${key}`);
      return v;
    },
    text,
    hasText: (key) => strings.has(key),
    format(key, lang, vars) {
      return text(key, lang).replace(/\{(\w+)\}/g, (_, name: string) => {
        const v = vars[name];
        if (v === undefined) throw new Error(`strings.csv: в строке ${key} нет значения для {${name}}`);
        return String(v);
      });
    },
  };
}
