import type { LevelDef } from './levels';

export interface Cell {
  c: number;
  r: number;
}

/** Плита или дверь и номер её пары: 0 — `P` и `D`, 1 — `Q` и `E`, 2 — `R` и `G` (GDD «Элементы уровня»). */
export interface PairCell extends Cell {
  pair: number;
}

/** Знаки плит и дверей по парам: плита PLATE_CHARS[k] открывает двери DOOR_CHARS[k]. */
export const PLATE_CHARS = 'PQR';
export const DOOR_CHARS = 'DEG';

export interface Laser extends Cell {
  /** Сдвиг цикла, с: `L` — 0, `l` — laser_alt_phase_s. */
  phase: number;
}

/**
 * Неподвижная часть уровня: клетки земли, шипов, плит и дверей и места элементов.
 * Как в прототипе (parseLevel): знаки @ F S L l в сетке клеток становятся воздухом, плиты и двери остаются.
 */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly start: Cell;
  readonly flag: Cell;
  readonly saws: readonly Cell[];
  readonly lasers: readonly Laser[];
  readonly plates: readonly PairCell[];
  readonly doors: readonly PairCell[];
  private readonly tiles: string[][];

  constructor(def: LevelDef, laserAltPhase: number) {
    this.rows = def.map.length;
    this.cols = def.map[0]?.length ?? 0;
    const saws: Cell[] = [];
    const lasers: Laser[] = [];
    const plates: PairCell[] = [];
    const doors: PairCell[] = [];
    let start: Cell = { c: 0, r: 0 };
    let flag: Cell = { c: 0, r: 0 };
    this.tiles = def.map.map((row, r) =>
      [...row].map((ch, c) => {
        if (ch === 'L' || ch === 'l') lasers.push({ c, r, phase: ch === 'l' ? laserAltPhase : 0 });
        else if (ch === 'S') saws.push({ c, r });
        else if (PLATE_CHARS.includes(ch)) plates.push({ c, r, pair: PLATE_CHARS.indexOf(ch) });
        else if (DOOR_CHARS.includes(ch)) doors.push({ c, r, pair: DOOR_CHARS.indexOf(ch) });
        else if (ch === '@') start = { c, r };
        else if (ch === 'F') flag = { c, r };
        return ch === 'L' || ch === 'l' || ch === 'S' || ch === '@' || ch === 'F' ? '.' : ch;
      }),
    );
    this.start = start;
    this.flag = flag;
    this.saws = saws;
    this.lasers = lasers;
    this.plates = plates;
    this.doors = doors;
  }

  /** Знак клетки: '#', '.', '^', плита (P Q R) или дверь (D E G). За левым и правым краем — '#', выше и ниже поля — '.'. */
  tile(c: number, r: number): string {
    if (c < 0 || c >= this.cols) return '#';
    if (r < 0 || r >= this.rows) return '.';
    return this.tiles[r]?.[c] ?? '.';
  }

  isStart(c: number, r: number): boolean {
    return c === this.start.c && r === this.start.r;
  }

  isFlag(c: number, r: number): boolean {
    return c === this.flag.c && r === this.flag.r;
  }

  isSaw(c: number, r: number): boolean {
    return this.saws.some((s) => s.c === c && s.r === r);
  }

  isEmitter(c: number, r: number): boolean {
    return this.lasers.some((l) => l.c === c && l.r === r);
  }

  isDoor(c: number, r: number): boolean {
    return DOOR_CHARS.includes(this.tile(c, r));
  }
}
