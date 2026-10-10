import constants from '../data/constants.csv?raw';
import worlds from '../data/worlds.csv?raw';
import ads from '../data/ads.csv?raw';
import strings from '../translations/strings.csv?raw';
import proto from '../data/levels/proto.txt?raw';
import w1 from '../data/levels/w1.txt?raw';
import pz from '../data/levels/pz.txt?raw';
import { loadTables, type RawTables, type Tables } from './core/data/tables';

/**
 * Текст таблиц и уровней как есть: Vite встраивает его в сборку, сетевых запросов нет.
 * Новый файл уровней — импорт здесь и строка в data/worlds.csv. Тесты портят копию RAW для проверки ошибок.
 */
export const RAW: Readonly<RawTables> = { constants, worlds, ads, strings, levels: { proto, w1, pz } };

export const DATA: Tables = loadTables(RAW);
