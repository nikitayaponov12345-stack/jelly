import { Container, Graphics } from 'pixi.js';
import type { Physics } from '../core/physics';
import type { Run } from '../core/run';
import { Camera } from './camera';
import { Fx } from './fx';
import { HeroAnim } from './hero-anim';
import { DESIGN, FIELD, MINIMAP, type Layout } from './layout';
import { LevelView } from './level-view';
import { PAL } from './palette';
import { Pen } from './pen';

export interface SceneTuning {
  cameraLead: number;
  cameraSmooth: number;
  /** За сколько секунд до лопания от стресса желейка дрожит (stuck_warn_s). */
  stuckWarn: number;
}

/**
 * Сцена: фон, окно поля (в портрете — с камерой и маской), карта всего уровня под полем в портрете,
 * частицы и тряска. Читает попытку и её события; правил не решает.
 */
export class Scene {
  private readonly bg = new Graphics();
  private readonly fieldBox = new Container();
  private readonly fieldBg = new Graphics();
  private readonly fieldMask = new Graphics();
  private readonly main = new LevelView(true);
  private readonly fxLayer = new Pen();
  private readonly miniBox = new Container();
  private readonly miniBg = new Graphics();
  private readonly mini = new LevelView(false);
  private readonly miniFrame = new Graphics();
  private readonly anim = new HeroAnim();
  private readonly fx = new Fx();
  private bodyBorn: number[] = [];
  private doorOpenAnim: number[] = [];
  private time = 0;
  private frame = 0;
  private layout: Layout = 'landscape';
  readonly camera = new Camera();

  constructor(
    root: Container,
    private run: Run,
    private readonly P: Physics,
    private readonly tune: SceneTuning,
  ) {
    this.main.root.addChild(this.fxLayer.g);
    this.fieldBox.addChild(this.fieldBg, this.main.root, this.fieldMask);
    this.fieldBox.mask = this.fieldMask;
    this.miniBox.addChild(this.miniBg, this.mini.root, this.miniFrame);
    root.addChild(this.bg, this.fieldBox, this.miniBox);
  }

  /** Раскладка экрана: фон, окно поля, карта уровня (только в портрете). */
  build(layout: Layout): void {
    this.layout = layout;
    const d = DESIGN[layout];
    const f = FIELD[layout];
    this.bg.clear().rect(0, 0, d.w, d.h).fill(PAL.bg);
    this.fieldBox.position.set(f.x, f.y);
    this.fieldBg.clear().rect(0, 0, f.w, f.h).fill(PAL.field);
    this.fieldMask.clear().rect(0, 0, f.w, f.h).fill(0xffffff);
    this.main.root.scale.set(f.cell);
    this.miniBox.visible = layout === 'portrait';
    this.miniBox.position.set(MINIMAP.x, MINIMAP.y);
    this.miniBg.clear().rect(0, 0, MINIMAP.w, MINIMAP.h).fill(PAL.field);
    this.mini.root.scale.set(MINIMAP.cell);
    this.setRun(this.run);
  }

  /** Новая попытка (другой уровень): неподвижная часть заново, камера — сразу к желейке. */
  setRun(run: Run): void {
    this.run = run;
    this.main.build(run);
    this.mini.build(run);
    this.bodyBorn = run.bodies.map(() => this.time - 1);
    this.doorOpenAnim = run.doorOpen.map((open) => (open ? 1 : 0));
    this.fx.clear();
    this.camera.snap(this.cameraTarget());
  }

  /** Кадр: события попытки → анимация и частицы, камера, отрисовка. dtMs — время кадра. */
  sync(dtMs: number): void {
    const run = this.run;
    const dt = dtMs / 1000;
    this.time += dt;
    this.frame++;
    for (const e of run.drainEvents()) {
      this.anim.onEvent(e);
      if (e.type === 'jump') this.fx.puff(e.x, e.y + this.P.half, 5, 0xffffff, 0.8, 2, 1.5);
      else if (e.type === 'land') this.fx.puff(e.x, e.y + this.P.half, 8, PAL.ground, 0.45, 3, 1.2);
      else if (e.type === 'death') this.fx.splash(e.x, e.y);
      else if (e.type === 'freeze') this.bodyBorn.push(this.time);
      else if (e.type === 'finish') this.fx.confettiBurst(run.grid.flag.c + 0.5, run.grid.flag.r + 0.3);
      else if (e.type === 'respawn') this.camera.snap(this.cameraTarget());
      else if (e.type === 'restart') {
        this.bodyBorn = [];
        this.fx.clear();
        this.camera.snap(this.cameraTarget());
      }
    }
    this.fx.update(dt);
    const look = this.anim.update(run, dt, this.P.vmax, this.P.stuck - this.tune.stuckWarn);
    if (run.hero.alive) this.camera.follow(this.cameraTarget(), dt, this.tune.cameraSmooth);
    const f = FIELD[this.layout];
    const sx = this.fx.shake > 0 ? Math.sin(this.frame * 1.7) * this.fx.shake * 12 : 0;
    const sy = this.fx.shake > 0 ? Math.cos(this.frame * 2.3) * this.fx.shake * 8 : 0;
    this.main.root.position.set(-this.camera.x + sx, sy);
    const age = (i: number): number => this.time - (this.bodyBorn[i] ?? this.time - 1);
    const doorAnim = this.doorAnim(dt);
    this.main.sync(run, this.time, doorAnim, age, look);
    this.fx.draw(this.fxLayer);
    if (this.layout === 'portrait') {
      this.mini.sync(run, this.time, doorAnim, age, look);
      const m = MINIMAP.cell / f.cell;
      this.miniFrame.clear().rect(this.camera.x * m, 0, f.w * m, MINIMAP.h).stroke({ width: 3, color: PAL.minimapFrame, alpha: 0.8 });
    }
  }

  /** Точка уровня (клетки) → точка дизайна с учётом камеры. */
  cellToDesign(x: number, y: number): { x: number; y: number } {
    const f = FIELD[this.layout];
    return { x: f.x + x * f.cell - this.camera.x, y: f.y + y * f.cell };
  }

  get particles(): number {
    return this.fx.count;
  }

  /** Открытость дверей каждой пары для рисунка 0…1: догоняет состояние попытки. */
  private doorAnim(dt: number): number[] {
    const k = Math.min(1, dt * 12);
    this.doorOpenAnim = this.run.doorOpen.map((open, i) => {
      const a = this.doorOpenAnim[i] ?? 0;
      return a + ((open ? 1 : 0) - a) * k;
    });
    return this.doorOpenAnim;
  }

  private cameraTarget(): number {
    const f = FIELD[this.layout];
    return Camera.target(this.run.hero.x, f.cell, f.w, this.run.grid.cols, this.tune.cameraLead);
  }
}
