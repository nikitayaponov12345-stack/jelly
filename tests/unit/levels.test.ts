import { describe, expect, it } from 'vitest';
import { loadTables } from '../../src/core/data/tables';
import { allLevels, parseLevels } from '../../src/core/levels';
import { DATA, RAW } from '../../src/data';
import { EMPTY, FLAT } from './maps';

const parse = (text: string): unknown => parseLevels(text, 'x', 24, 13);
const text = (map: readonly string[], head = 'par 1'): string => `level t-1\n${head}\nmap\n${map.join('\n')}\nend\n`;

describe('разбор уровней', () => {
  it('шесть уровней прототипа', () => {
    const levels = allLevels(DATA);
    expect(levels.map((l) => l.id)).toEqual(['p-01', 'p-02', 'p-03', 'p-04', 'p-05', 'p-06']);
    expect(levels.map((l) => l.par)).toEqual([1, 1, 0, 2, 0, 1]);
    for (const l of levels) {
      expect(l.limit).toBeNull();
      expect(l.file).toBe('proto');
      expect(l.map).toHaveLength(13);
      for (const row of l.map) expect(row).toHaveLength(24);
    }
    // Строка карты, которая начинается с #, — ряд, а не комментарий.
    expect(levels[0]!.map[12]).toBe('#######^^^^^^^^#########');
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
    const t = loadTables({ ...RAW, levels: { proto: RAW.levels.proto + '\n' + RAW.levels.proto } });
    expect(() => allLevels(t)).toThrow('повтор id уровня p-01');
  });
});
