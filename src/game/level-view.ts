import { Container } from 'pixi.js';
import type { Run } from '../core/run';
import { drawBlob } from './blob';
import type { HeroLook } from './hero-anim';
import { PAL } from './palette';
import { Pen } from './pen';

const solidTile = (t: string): boolean => t === '#' || t === 'P';

/**
 * Уровень в клетках: контейнер `root` масштабируется на сторону клетки, всё рисуется в единицах клетки
 * (как ctx.scale(cs, cs) в прототипе) через Pen. Неподвижное (земля, трава, основания плит, косяки дверей, пилы)
 * рисуется в build; шипы и тела — в sync, только когда меняются тела; плиты, двери, лучи, флаг и желейка — каждый кадр.
 */
export class LevelView {
  readonly root = new Container();
  private readonly decor = new Pen();
  private readonly back = new Pen();
  private readonly sawLayer = new Container();
  private readonly spikes = new Pen();
  private readonly dyn = new Pen();
  private readonly bodyLayer = new Pen();
  private readonly hero = new Pen();
  private saws: Pen[] = [];
  /** Сколько тел нарисовано (−1 — перерисовать) и шла ли «вспышка» последнего тела. */
  private drawnBodies = -1;
  private drawnFlash = false;

  constructor(private readonly withDecor: boolean) {
    this.root.addChild(this.decor.g, this.back.g, this.sawLayer, this.spikes.g, this.dyn.g, this.bodyLayer.g, this.hero.g);
  }

  /** Неподвижная часть уровня попытки run. */
  build(run: Run): void {
    const g = run.grid;
    this.drawnBodies = -1;
    const b = this.back.clear();
    // Земля: подряд идущие твёрдые клетки ряда — одним прямоугольником (без швов).
    for (let r = 0; r < g.rows; r++) {
      let c = 0;
      while (c < g.cols) {
        if (!solidTile(g.tile(c, r))) {
          c++;
          continue;
        }
        let c2 = c;
        while (c2 < g.cols && solidTile(g.tile(c2, r))) c2++;
        b.rect(c - 0.01, r - 0.01, c2 - c + 0.02, 1.03).fill(PAL.ground);
        c = c2;
      }
    }
    // Трава на открытых сверху участках.
    for (let r = 1; r < g.rows; r++) {
      let c = 0;
      while (c < g.cols) {
        const exposed = (cc: number): boolean => solidTile(g.tile(cc, r)) && !solidTile(g.tile(cc, r - 1));
        if (!exposed(c)) {
          c++;
          continue;
        }
        let c2 = c;
        while (c2 < g.cols && exposed(c2)) c2++;
        b.rect(c, r, c2 - c, 0.26).fill(PAL.grassDark);
        b.roundRect(c - 0.02, r - 0.06, c2 - c + 0.04, 0.24, 0.1).fill(PAL.grass);
        c = c2;
      }
    }
    for (const p of g.plates) b.rect(p.c + 0.08, p.r, 0.84, 0.34).fill(PAL.plateDark);
    for (const d of g.doors) {
      b.rect(d.c + 0.08, d.r, 0.1, 1).fill(PAL.doorDark);
      b.rect(d.c + 0.82, d.r, 0.1, 1).fill(PAL.doorDark);
    }
    // Пилы — отдельные фигуры: в sync они только вращаются.
    for (const old of this.sawLayer.removeChildren()) old.destroy();
    this.saws = g.saws.map((s) => {
      const saw = new Pen();
      const pts: number[] = [];
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        const rad = i % 2 ? 0.34 : 0.46;
        pts.push(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      saw.poly(pts).fill(PAL.saw).stroke({ width: 0.04, color: PAL.sawDark });
      saw.circle(0, 0, 0.13).fill(PAL.sawDark);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        saw.moveTo(Math.cos(a) * 0.3, Math.sin(a) * 0.3).lineTo(-Math.cos(a) * 0.3, -Math.sin(a) * 0.3);
      }
      saw.stroke({ width: 0.05, color: PAL.sawDark, alpha: 0.5 });
      saw.g.position.set(s.c + 0.5, s.r + 0.5);
      this.sawLayer.addChild(saw.g);
      return saw;
    });
  }

  /**
   * Меняющаяся часть: t — время для покачивания флага и облаков (с), doorAnim — открытость двери 0…1,
   * bodyAge(i) — сколько секунд назад застыло тело i (для «вспышки» формы), look — вид желейки.
   */
  sync(run: Run, t: number, doorAnim: number, bodyAge: (i: number) => number, look: HeroLook | null): void {
    const g = run.grid;
    if (this.withDecor) this.drawDecor(g.cols, t);
    // Тела застывают по одному, поэтому «вспыхивает» только последнее.
    const n = run.bodies.length;
    const flash = n > 0 && bodyAge(n - 1) < 0.3;
    if (n !== this.drawnBodies || flash || this.drawnFlash) {
      this.drawBodies(run, bodyAge);
      this.drawnBodies = n;
      this.drawnFlash = flash;
    }
    const d = this.dyn.clear();
    g.plates.forEach((p, i) => {
      const pressed = run.platePressed(i);
      d.roundRect(p.c + 0.05, p.r - 0.04, 0.9, pressed ? 0.18 : 0.3, 0.06).fill(pressed ? PAL.platePressed : PAL.plate);
    });
    const hgt = 1 - doorAnim;
    if (hgt > 0.02) {
      for (const dr of g.doors) {
        d.roundRect(dr.c + 0.14, dr.r, 0.72, hgt, 0.05).fill(PAL.door);
        d.rect(dr.c + 0.2, dr.r + 0.08 * hgt, 0.12, hgt * 0.85).fill({ color: 0xffffff, alpha: 0.35 });
      }
    }
    g.lasers.forEach((l, i) => {
      const on = run.laserOn(i);
      const warn = run.laserWarn(i);
      const x = l.c + 0.5;
      const y0 = l.r + 0.5;
      const y1 = run.beamEnds[i] ?? g.rows;
      if (on) {
        const fl = 1 + Math.sin(run.time * 50) * 0.12;
        d.rect(x - 0.19 * fl, y0, 0.38 * fl, y1 - y0).fill({ color: PAL.laser, alpha: 0.32 });
        d.rect(x - 0.05, y0, 0.1, y1 - y0).fill(PAL.laserCore);
        d.rect(x - 0.02, y0, 0.04, y1 - y0).fill({ color: 0xffffff, alpha: 0.8 });
        d.ellipse(x, y1, 0.3, 0.1).fill({ color: 0xff7878, alpha: 0.5 });
      } else if (warn) {
        for (let y = y0; y < y1; y += 0.26) d.moveTo(x, y).lineTo(x, Math.min(y1, y + 0.12));
        d.stroke({ width: 0.04, color: PAL.laserWarn, alpha: 0.45 });
      }
      d.roundRect(l.c + 0.18, l.r + 0.04, 0.64, 0.46, 0.1).fill(PAL.ground);
      d.circle(x, l.r + 0.44, on ? 0.14 : 0.11).fill(on ? PAL.laserCore : warn ? PAL.lampWarn : PAL.lampOff);
    });
    for (const saw of this.saws) saw.g.rotation = run.time * 5;
    // Флаг: древко и полотнище; после финиша — цвета звезды.
    const f = g.flag;
    const fx = f.c + 0.28;
    const wave = Math.sin(t * 6) * 0.06;
    d.moveTo(fx, f.r + 1).lineTo(fx, f.r + 0.02).stroke({ width: 0.08, color: PAL.ground, cap: 'round' });
    d.poly([fx, f.r + 0.04, fx + 0.68 + wave, f.r + 0.3 - wave, fx, f.r + 0.56]).fill(run.state === 'done' ? PAL.star : PAL.flag);
    const h = this.hero.clear();
    if (look) drawBlob(h, look.x, look.footY, look.sx, look.sy, false, look.lookY);
  }

  /** Шипы, которые не накрыло тело, и тела: первые 0,3 с форма тела «вспыхивает» (как в прототипе). */
  private drawBodies(run: Run, bodyAge: (i: number) => number): void {
    const g = run.grid;
    const s = this.spikes.clear();
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        if (g.tile(c, r) !== '^' || run.isBody(c, r)) continue;
        for (let k = 0; k < 3; k++) {
          const x0 = c + k / 3;
          s.poly([x0 + 0.02, r + 1, x0 + 1 / 6, r + 0.15, x0 + 1 / 3 - 0.02, r + 1]);
        }
        s.fill(PAL.spike).stroke({ width: 0.035, color: PAL.spikeEdge });
      }
    }
    const b = this.bodyLayer.clear();
    run.bodies.forEach((body, i) => {
      const age = bodyAge(i);
      const k = age < 0.3 ? 1 + (0.3 - age) * 0.9 : 1;
      drawBlob(b, body.c + 0.5, body.r + 1, k, 2 - k, true);
    });
  }

  private drawDecor(cols: number, t: number): void {
    const g = this.decor.clear();
    for (let i = 0; i < 5; i++) g.ellipse(i * 5.5 + 2, 10.4, 3.6, 1.6).fill({ color: PAL.hill, alpha: 0.28 });
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 6.3 + t * 0.12) % (cols + 6)) - 3;
      const cy = 1 + (i % 2) * 1.6;
      g.ellipse(cx, cy, 1.5, 0.5).fill({ color: PAL.cloud, alpha: 0.55 });
      g.ellipse(cx + 0.9, cy - 0.25, 0.9, 0.45).fill({ color: PAL.cloud, alpha: 0.55 });
    }
  }
}
