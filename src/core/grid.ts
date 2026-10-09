import type { LevelDef } from './levels';

export interface Cell {
  c: number;
  r: number;
}

export interface Laser extends Cell {
  /** Сдвиг цикла, с: `L` — 0, `l` — laser_alt_phase_s. */
  phase: number;
}

/**
 * Неподвижная часть уровня: клетки земли, шипов, плит и дверей и места элементов.
 * Как в прототипе (parseLevel): знаки @ F S L l в сетке клеток становятся воздухом, P и D остаются.
 */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly start: Cell;
  readonly flag: Cell;
  readonly saws: readonly Cell[];
  readonly lasers: readonly Laser[];
  readonly plates: readonly Cell[];
  readonly doors: readonly Cell[];
  private readonly tiles: string[][];

  constructor(def: LevelDef, laserAltPhase: number) {
    this.rows = def.map.length;
    this.cols = def.map[0]?.length ?? 0;
    const saws: Cell[] = [];
    const lasers: Laser[] = [];
    const plates: Cell[] = [];
    const doors: Cell[] = [];
    let start: Cell = { c: 0, r: 0 };
    let flag: Cell = { c: 0, r: 0 };
    this.tiles = def.map.map((row, r) =>
      [...row].map((ch, c) => {
        if (ch === 'L' || ch === 'l') lasers.push({ c, r, phase: ch === 'l' ? laserAltPhase : 0 });
        else if (ch === 'S') saws.push({ c, r });
        else if (ch === 'P') plates.push({ c, r });
        else if (ch === 'D') doors.push({ c, r });
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

  /** Знак клетки: '#', '.', '^', 'P' или 'D'. За левым и правым краем — '#', выше и ниже поля — '.'. */
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
    return this.tile(c, r) === 'D';
  }
}
