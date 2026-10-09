// Проверка таблиц и уровней: `npm run data`. Без зависимостей, Node 22+.
// Читает data/*.csv, data/levels/*.txt и translations/strings.csv: заголовки, типы, уникальность, ссылки, карты уровней.
// Любая ошибка — строка «data-check: …» и код выхода 1; всё хорошо — «data-check: ok …».
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const errors = [];
const err = (msg) => errors.push(msg);

/** CSV по RFC 4180: запятая, кавычки, "" внутри кавычек; CRLF и LF равны (и внутри кавычек); BOM в начале файла запрещён. */
export function parseCsv(text, file) {
  if (text.charCodeAt(0) === 0xfeff) err(`${file}: файл начинается с BOM — сохранить как UTF-8 без BOM`);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else if (ch === '\r' && text[i + 1] === '\n') {
        cell += '\n';
        i++;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function read(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8');
  } catch {
    err(`${rel}: файла нет`);
    return null;
  }
}

function load(rel, header) {
  const text = read(rel);
  if (text === null) return [];
  const rows = parseCsv(text, rel);
  const head = rows.shift() ?? [];
  if (head.join(',') !== header.join(',')) err(`${rel}: заголовок «${head.join(',')}», ожидался «${header.join(',')}»`);
  return rows.map((r, i) => {
    if (r.length !== header.length) err(`${rel}: строка ${i + 2} — ${r.length} полей вместо ${header.length}`);
    const o = { __line: i + 2, __file: rel };
    header.forEach((h, j) => (o[h] = (r[j] ?? '').trim()));
    return o;
  });
}

const where = (r) => `${r.__file}:${r.__line}`;
function num(r, col, { min = -Infinity, max = Infinity, int = false, optional = false } = {}) {
  const v = r[col];
  if (v === '') {
    if (!optional) err(`${where(r)}: пустое поле ${col}`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) err(`${where(r)}: ${col} = «${v}» — не число`);
  else if (int && !Number.isInteger(n)) err(`${where(r)}: ${col} = ${v} — нужно целое`);
  else if (n < min || n > max) err(`${where(r)}: ${col} = ${v} вне [${min}, ${max}]`);
  return n;
}
function unique(rows, keyFn, file) {
  const seen = new Set();
  for (const r of rows) {
    const k = keyFn(r);
    if (seen.has(k)) err(`${file}: повтор «${k}» (${where(r)})`);
    seen.add(k);
  }
}

// --- строки перевода ---
const strings = load('translations/strings.csv', ['key', 'ru', 'en']);
unique(strings, (r) => r.key, 'translations/strings.csv');
const stringKeys = new Set(strings.map((r) => r.key));
for (const r of strings) {
  if (!/^[a-z0-9_.-]+$/.test(r.key)) err(`${where(r)}: ключ «${r.key}» — только a–z, 0–9, точка, дефис, подчёркивание`);
  if (r.ru === '') err(`${where(r)}: пустая строка ru у ${r.key}`);
  if (r.en === '') err(`${where(r)}: пустая строка en у ${r.key}`);
}
const needText = (key, at) => {
  if (!stringKeys.has(key)) err(`${at}: нет строки перевода ${key}`);
};

// --- константы ---
const REQUIRED_CONSTANTS = [
  'grid_cols', 'grid_rows', 'run_speed', 'gravity', 'gravity_hold', 'hold_max_s', 'jump_height', 'fall_speed_max',
  'hero_half', 'collide_inset', 'coyote_s', 'jump_buffer_s', 'respawn_s', 'stuck_s', 'stuck_warn_s', 'progress_eps',
  'fall_out_margin', 'spike_x0', 'spike_x1', 'spike_y0', 'spike_hero_inset', 'saw_radius', 'laser_period_s', 'laser_on_s',
  'laser_warn_s', 'laser_alt_phase_s', 'laser_x0', 'laser_x1', 'laser_hero_inset', 'laser_min_dy', 'laser_freeze_dy',
  'plate_eps', 'plate_edge', 'flag_x0', 'stars_2_extra', 'intro_s', 'done_input_delay_s', 'camera_lead', 'camera_smooth',
  'skip_after_extra_deaths', 'skip_after_s', 'extra_jellies', 'par_window_s', 'par_tap_s',
];
const constants = load('data/constants.csv', ['key', 'value', 'unit', 'note']);
unique(constants, (r) => r.key, 'data/constants.csv');
const C = {};
for (const r of constants) {
  if (!/^[a-z0-9_]+$/.test(r.key)) err(`${where(r)}: ключ «${r.key}» — только a–z, 0–9, подчёркивание`);
  C[r.key] = num(r, 'value');
}
for (const k of REQUIRED_CONSTANTS) if (!(k in C)) err(`data/constants.csv: нет ключа ${k}`);
const COLS = C.grid_cols;
const ROWS = C.grid_rows;
if (C.laser_on_s !== undefined && C.laser_period_s !== undefined && !(C.laser_on_s < C.laser_period_s)) err('data/constants.csv: laser_on_s должен быть меньше laser_period_s');
if (C.laser_warn_s !== undefined && C.laser_on_s !== undefined && C.laser_period_s !== undefined && !(C.laser_warn_s < C.laser_period_s - C.laser_on_s)) {
  err('data/constants.csv: laser_warn_s должен помещаться в выключенную часть цикла');
}
if (C.gravity_hold !== undefined && C.gravity !== undefined && !(C.gravity_hold < C.gravity)) err('data/constants.csv: gravity_hold должен быть меньше gravity');

// --- реклама ---
const ads = load('data/ads.csv', ['place', 'kind', 'reward', 'first_after_s', 'cooldown_s', 'after_levels', 'note']);
unique(ads, (r) => r.place, 'data/ads.csv');
for (const r of ads) {
  if (r.kind !== 'rewarded' && r.kind !== 'interstitial') err(`${where(r)}: kind = «${r.kind}» — rewarded или interstitial`);
  num(r, 'first_after_s', { min: 0, optional: true });
  const cd = num(r, 'cooldown_s', { min: 0, optional: true });
  num(r, 'after_levels', { min: 0, int: true, optional: true });
  if (r.kind === 'rewarded' && r.reward === '') err(`${where(r)}: у rewarded нужна награда (reward)`);
  if (r.kind === 'interstitial' && !(cd >= 180)) err(`${where(r)}: межстраничная — не чаще раза в 180 с (cooldown_s ≥ 180)`);
}

// --- миры ---
const worlds = load('data/worlds.csv', ['id', 'order', 'file', 'name_key']);
unique(worlds, (r) => r.id, 'data/worlds.csv');
unique(worlds, (r) => r.order, 'data/worlds.csv');
let levelFiles = [];
try {
  levelFiles = readdirSync(join(ROOT, 'data/levels')).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4));
} catch {
  err('data/levels: папки нет');
}
for (const r of worlds) {
  num(r, 'order', { min: 0, int: true });
  needText(r.name_key, where(r));
  if (!levelFiles.includes(r.file)) err(`${where(r)}: нет файла data/levels/${r.file}.txt`);
}
for (const f of levelFiles) if (!worlds.some((w) => w.file === f)) err(`data/levels/${f}.txt: файла нет в data/worlds.csv`);

// --- уровни ---
const TILES = new Set(['#', '.', '@', 'F', '^', 'S', 'L', 'l', 'P', 'D', 'Q', 'E', 'R', 'G']);
// Пары плит и дверей (M1-01): плита PLATES[k] открывает двери DOORS[k].
const PLATES = ['P', 'Q', 'R'];
const DOORS = ['D', 'E', 'G'];
const levelIds = new Set();
let levelCount = 0;
function checkLevel(file, lv) {
  const at = `${file}:${lv.line}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(lv.id)) err(`${at}: id уровня «${lv.id}» — только a–z, 0–9 и дефисы`);
  if (levelIds.has(lv.id)) err(`${at}: повтор id уровня ${lv.id}`);
  levelIds.add(lv.id);
  levelCount++;
  if (lv.par === undefined) err(`${at}: у уровня ${lv.id} нет строки par`);
  if (lv.map.length !== ROWS) {
    err(`${at}: в карте ${lv.id} ${lv.map.length} строк вместо ${ROWS}`);
    return;
  }
  const count = {};
  lv.map.forEach((row, r) => {
    if (row.length !== COLS) err(`${at}: строка ${r} карты ${lv.id} — ${row.length} знаков вместо ${COLS}`);
    for (const ch of row) {
      if (!TILES.has(ch)) err(`${at}: в карте ${lv.id} неизвестный знак «${ch}» (строка ${r})`);
      count[ch] = (count[ch] ?? 0) + 1;
    }
  });
  if (count['@'] !== 1) err(`${at}: в карте ${lv.id} старт @ — ${count['@'] ?? 0} раз, нужен один`);
  if (count.F !== 1) err(`${at}: в карте ${lv.id} флаг F — ${count.F ?? 0} раз, нужен один`);
  const sr = lv.map.findIndex((row) => row.includes('@'));
  if (sr >= 0) {
    const sc = lv.map[sr].indexOf('@');
    const below = sr + 1 < ROWS ? lv.map[sr + 1][sc] : undefined;
    if (below !== '#' && !PLATES.includes(below)) err(`${at}: под стартом ${lv.id} нет земли или плиты`);
  }
  PLATES.forEach((p, k) => {
    const d = DOORS[k];
    if ((count[d] ?? 0) > 0 && !(count[p] > 0)) err(`${at}: в ${lv.id} есть дверь ${d}, но нет плиты ${p}`);
    if ((count[p] ?? 0) > 0 && !(count[d] > 0)) err(`${at}: в ${lv.id} есть плита ${p}, но нет двери ${d}`);
  });
  needText(`level.${lv.id}.name`, at);
  needText(`level.${lv.id}.hint`, at);
}

for (const f of levelFiles) {
  const rel = `data/levels/${f}.txt`;
  const text = read(rel);
  if (text === null) continue;
  if (text.charCodeAt(0) === 0xfeff) err(`${rel}: файл начинается с BOM — сохранить как UTF-8 без BOM`);
  const lines = text.replace(/^﻿/, '').split('\n').map((s) => s.replace(/\r$/, ''));
  let lv = null;
  let inMap = false;
  let levelsInFile = 0;
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (inMap) {
      if (raw === 'end') {
        inMap = false;
        checkLevel(rel, lv);
        lv = null;
      } else lv.map.push(raw);
      return;
    }
    const s = raw.trim();
    if (s === '' || s.startsWith('#')) return;
    const [word, ...rest] = s.split(/\s+/);
    if (word === 'level') {
      if (lv) err(`${rel}:${line}: уровень ${lv.id} не закрыт строкой end`);
      lv = { id: rest.join(' '), line, map: [], par: undefined };
      levelsInFile++;
    } else if (!lv) err(`${rel}:${line}: строка вне уровня: «${s}»`);
    else if (word === 'par' || word === 'limit') {
      const n = Number(rest[0]);
      if (rest.length !== 1 || !Number.isInteger(n) || n < (word === 'par' ? 0 : 1)) err(`${rel}:${line}: ${word} = «${rest.join(' ')}» — нужно целое ${word === 'par' ? '≥ 0' : '≥ 1'}`);
      lv[word] = n;
    } else if (word === 'map') inMap = true;
    else err(`${rel}:${line}: неизвестная строка «${s}»`);
  });
  if (inMap || lv) err(`${rel}: последний уровень не закрыт строкой end`);
  if (levelsInFile === 0) err(`${rel}: в файле нет уровней`);
}

if (errors.length) {
  for (const e of errors) console.error(`data-check: ${e}`);
  process.exit(1);
}
console.log(`data-check: ok (таблиц: 4, строк перевода: ${strings.length}, уровней: ${levelCount}, файлов уровней: ${levelFiles.length})`);
