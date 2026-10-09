import type { RunState } from './core/run';
import type { Layout } from './game/layout';
import type { PlatformCall } from './platform/platform';

/** Состояние попытки для тестов и ботов (только чтение). */
export interface DebugState {
  level: string;
  state: RunState;
  legion: number;
  /** Время уровня, с. */
  time: number;
  stars: number;
  hero: { x: number; y: number; vx: number; vy: number; alive: boolean; grounded: boolean };
  bodies: Array<{ c: number; r: number }>;
  /** Открыты ли двери пары 0, 1, 2 (P и D, Q и E, R и G). */
  doorOpen: boolean[];
  lasers: Array<{ on: boolean; warn: boolean; end: number }>;
}

/**
 * Отладочный доступ к игре для тестов Playwright и ботов: `window.__game`.
 * Чтение состояния и команды — те же, что подаёт слой ввода; расширяется задачами.
 */
export interface GameDebug {
  ready: boolean;
  version: string;
  /** Метка сборки: хеш коммита (с '+' при незакоммиченных правках) или 'dev'. */
  build: string;
  layout(): Layout;
  /** Игровое время с запуска, мс (все шаги ядра, на любом уровне). */
  gameMs(): number;
  platformLog(): PlatformCall[];
  /** Id уровней игры по порядку. */
  levels(): string[];
  /** Новая попытка на уровне id (состояние ready). Нет такого уровня — исключение. */
  setLevel(id: string): void;
  state(): DebugState;
  command: { press(): void; release(): void; restart(): void };
  /** Прогнать ядро на ms игрового времени сразу, без кадров: round(ms / шаг) шагов. */
  advance(ms: number): void;
  /** Точка уровня (клетки) → точка окна (CSS-пиксели) с учётом раскладки и камеры. */
  toScreen(x: number, y: number): { x: number; y: number };
  /** Сдвиг камеры окна поля, точки дизайна (в горизонтали всегда 0). */
  camera(): number;
  /** Остановить (true) или продолжить шаги ядра в тикере; кадры, камера и анимация идут, advance работает. */
  pauseCore(on: boolean): void;
  /** Что на экране: уровень, окно итога уровня или итог набора. */
  screen(): 'level' | 'result' | 'pack';
  /** Открыть итог набора с теми итогами уровней, что уже есть (снимки и проверки окна). */
  showPack(): void;
}

declare global {
  interface Window {
    __game?: GameDebug;
  }
}
