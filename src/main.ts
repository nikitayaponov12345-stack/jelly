import './debug';
import { FixedStep, STEP_MS } from './core/clock';
import { allLevels } from './core/levels';
import { physicsFrom } from './core/physics';
import { Run } from './core/run';
import { DATA } from './data';
import type { DebugState } from './debug';
import { LevelFlow } from './game/flow';
import { OneButton, bindOneButton } from './game/input';
import { designToScreen } from './game/layout';
import { Scene } from './game/scene';
import { Stage } from './game/stage';
import { StubPlatform } from './platform/stub';
import { DebugLine } from './ui/debug-line';
import { PlayUi } from './ui/play-ui';

const VERSION = '0.0.3';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
const BUILD = import.meta.env.VITE_BUILD ?? 'dev';

async function boot(): Promise<void> {
  const platform = new StubPlatform();
  await platform.init();
  const lang = platform.language() === 'ru' ? 'ru' : 'en';
  const text = (key: string): string => DATA.text(key, lang);

  const stage = new Stage();
  await stage.init(document.getElementById('game')!);

  const levels = allLevels(DATA);
  const P = physicsFrom(DATA);
  let index = 0;
  let run = new Run(levels[0]!, P);
  let gameMs = 0;
  const flow = new LevelFlow(DATA.num('done_input_delay_s'));
  const step = (dt: number): void => {
    run.step(dt);
    gameMs += dt;
  };

  const scene = new Scene(stage.root, run, P, {
    cameraLead: DATA.num('camera_lead'),
    cameraSmooth: DATA.num('camera_smooth'),
    stuckWarn: DATA.num('stuck_warn_s'),
  });
  scene.build(stage.layout);
  stage.onLayout = (layout) => scene.build(layout);

  const setLevel = (i: number): void => {
    index = i;
    run = new Run(levels[i]!, P);
    flow.reset();
    scene.setRun(run);
  };

  // Одна кнопка: в done (после паузы) — следующий уровень набора, иначе — команда попытки.
  const input = new OneButton({
    press: () => {
      const what = flow.onPress(run.state);
      if (what === 'next') setLevel((index + 1) % levels.length);
      else if (what === 'run') run.press();
    },
    release: () => run.release(),
    restart: () => run.restart(),
  });
  bindOneButton(stage.app.canvas, input);
  const ui = document.getElementById('ui')!;
  const playUi = new PlayUi(ui, text, () => run.restart());
  const line = new DebugLine(ui);
  const title = text('game.title');
  const clock = new FixedStep();
  let corePaused = false;

  stage.app.ticker.add((ticker) => {
    if (!corePaused) clock.advance(ticker.deltaMS, step);
    flow.frame(ticker.deltaMS / 1000, run.state);
    scene.sync(ticker.deltaMS);
    playUi.update(run.state, stage.layout);
    line.update(
      performance.now(),
      `${title} ${VERSION} (${BUILD}) · ${stage.layout} · ${Math.round(ticker.FPS)} к/с · ${run.def.id} · ${run.state}` +
        ` · легион ${run.legion} · ${run.time.toFixed(1)} с`,
    );
  });

  const state = (): DebugState => ({
    level: run.def.id,
    state: run.state,
    legion: run.legion,
    time: run.time,
    stars: run.stars,
    hero: { x: run.hero.x, y: run.hero.y, vx: run.hero.vx, vy: run.hero.vy, alive: run.hero.alive, grounded: run.hero.grounded },
    bodies: run.bodies.map(({ c, r }) => ({ c, r })),
    doorOpen: run.doorOpen,
    lasers: run.grid.lasers.map((_, i) => ({ on: run.laserOn(i), warn: run.laserWarn(i), end: run.beamEnds[i] ?? run.grid.rows })),
  });

  window.__game = {
    ready: true,
    version: VERSION,
    build: BUILD,
    layout: () => stage.layout,
    gameMs: () => gameMs,
    platformLog: () => platform.log.slice(),
    levels: () => levels.map((l) => l.id),
    setLevel: (id) => {
      const i = levels.findIndex((l) => l.id === id);
      if (i < 0) throw new Error(`нет уровня ${id}`);
      setLevel(i);
    },
    state,
    command: {
      press: () => run.press(),
      release: () => run.release(),
      restart: () => run.restart(),
    },
    advance: (ms) => {
      for (let i = Math.round(ms / STEP_MS); i > 0; i--) step(STEP_MS);
    },
    toScreen: (x, y) => {
      const d = scene.cellToDesign(x, y);
      return designToScreen(d.x, d.y, window.innerWidth, window.innerHeight, stage.layout);
    },
    camera: () => scene.camera.x,
    pauseCore: (on) => {
      corePaused = on;
    },
  };
  platform.loadingFinished();
}

boot().catch((err: unknown) => {
  console.error('boot failed', err);
});
