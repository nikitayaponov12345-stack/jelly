import { describe, expect, it } from 'vitest';
import { loadTables } from '../../src/core/data/tables';
import { DATA, RAW } from '../../src/data';

describe('таблицы', () => {
  it('сторож ключевых чисел constants.csv (как в прототипе)', () => {
    expect(DATA.num('grid_cols')).toBe(24);
    expect(DATA.num('grid_rows')).toBe(13);
    expect(DATA.num('run_speed')).toBe(4.5);
    expect(DATA.num('gravity')).toBe(30);
    expect(DATA.num('gravity_hold')).toBe(18);
    expect(DATA.num('hold_max_s')).toBe(0.25);
    expect(DATA.num('jump_height')).toBe(2.5);
    expect(DATA.num('respawn_s')).toBe(0.4);
    expect(DATA.num('stuck_s')).toBe(2.6);
    expect(DATA.num('laser_period_s')).toBe(3);
    expect(DATA.num('laser_on_s')).toBe(1.5);
  });

  it('нет ключа — понятная ошибка', () => {
    expect(() => DATA.num('no_such_key')).toThrow('constants.csv: нет ключа no_such_key');
    expect(() => DATA.text('no.such', 'ru')).toThrow('strings.csv: нет строки no.such');
  });

  it('строки на двух языках и подстановка', () => {
    expect(DATA.text('game.title', 'ru')).toBe('Желейный легион');
    expect(DATA.text('game.title', 'en')).toBe('Jelly Legion');
    expect(DATA.format('ui.used', 'ru', { n: 2, par: 3 })).toBe('Желеек: 2 (пар 3)');
    expect(DATA.format('ui.used', 'en', { n: 2, par: 3 })).toBe('Jellies: 2 (par 3)');
    expect(() => DATA.format('ui.used', 'ru', { n: 2 })).toThrow('{par}');
  });

  it('миры: прототип, мир 1 и проба головоломок, у каждого свой файл уровней', () => {
    expect(DATA.worlds.map((w) => [w.id, w.file])).toEqual([
      ['proto', 'proto'],
      ['w1', 'w1'],
      ['pz', 'pz'],
    ]);
    expect(DATA.levelFiles.proto).toContain('level p-01');
    expect(DATA.levelFiles.w1).toContain('level w1-01');
    expect(DATA.levelFiles.pz).toContain('level pz-01');
  });

  it('места рекламы из GDD: межстраничная не чаще раза в 180 с и не раньше 3-го уровня', () => {
    const next = DATA.ads.find((a) => a.place === 'next_level');
    expect(next).toMatchObject({ kind: 'interstitial', cooldownS: 180, afterLevels: 3 });
    expect(DATA.ads.filter((a) => a.kind === 'rewarded').map((a) => a.place)).toEqual(['skip_level', 'ghost_hint', 'extra_jellies']);
  });

  it('ошибки формата называют файл', () => {
    expect(() => loadTables({ ...RAW, constants: RAW.constants.replace('key,value', 'key,val') })).toThrow('constants.csv: заголовок');
    expect(() => loadTables({ ...RAW, constants: RAW.constants.replace('run_speed,4.5', 'run_speed,быстро') })).toThrow(
      'constants.csv: строка 4, value = «быстро» — не число',
    );
    expect(() => loadTables({ ...RAW, strings: '﻿' + RAW.strings })).toThrow('strings.csv: BOM в начале файла');
    expect(() => loadTables({ ...RAW, levels: {} })).toThrow('worlds.csv: у мира proto нет файла data/levels/proto.txt');
  });
});
