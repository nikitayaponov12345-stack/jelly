import './debug';
import { FixedStep, STEP_MS } from './core/clock';
import { allLevels } from './core/levels';
import { physicsFrom } from './core/physics';
import { Run } from './core/run';
import { DATA } from './data';
import type { DebugState } from './debug';
import { PackFlow } from './game/flow';
import { OneButton, bindOneButton } from './game/input';
import { designToScreen } from './game/layout';
import { Scene } from './game/scene';
import { Stage } from './game/stage';
import { StubPlatform } from './platform/stub';
import { DebugLine } from './ui/debug-line';
import { DesignLayer } from './ui/design-layer';
import { Hud } from './ui/hud';
import { RestartButton } from './ui/restart-button';
import { Windows } from './ui/windows';

const VERSION = '0.0.5';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
const BUILD = import.meta.env.VITE_BUILD ?? 'dev';

async function boot(): Promise<void> {
  const platform = new StubPlatform();
  await platform.init();
  const lang = platform.language() === 'ru' ? 'ru' : 'en';
  const t = (key: string, vars?: Readonly<Record<string, string | number>>): string =>
    vars ? DATA.format(key, lang, vars) : DATA.text(key, lang);

  const stage = new Stage();
  await stage.init(document.getElementById('game')!);

  const levels = allLevels(DATA);
  const P = physicsFrom(DATA);
  const flow = new PackFlow(levels.length, DATA.num('done_input_delay_s'));
  let run = new Run(levels[0]!, P);
  let gameMs = 0;
  let corePaused = false;
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

  const ui = document.getElementById('ui')!;
  const layer = new DesignLayer(ui);
  const hud = new Hud(layer.el, t, DATA.num('intro_s'));

  /** Новая попытка на уровне i: сцена заново, надпись с названием уровня. */
  const openLevel = (i: number): void => {
    run = new Run(levels[i]!, P);
    scene.setRun(run);
    hud.startIntro();
  };
  // Кнопки окон, клавиши и касания поля зовут одни и те же действия; окно, не готовое к нажатиям, их не примет.
  const actions = {
    retry: (): void => {
      if (flow.screen !== 'result' || !flow.ready) return;
      flow.retry();
      run.restart();
    },
    next: (): void => {
      if (flow.screen !== 'result' || !flow.ready) return;
      const i = flow.next();
      if (i !== null) openLevel(i);
    },
    fromStart: (): void => {
      if (flow.screen !== 'pack' || !flow.ready) return;
      flow.fromStart();
      openLevel(0);
    },
  };
  /** «Заново» (R и ↻): на уровне — попытка с начала, в окне итога — «Ещё раз», в итоге набора — ничего. */
  const restart = (): void => {
    if (flow.screen === 'level') run.restart();
    else if (flow.screen === 'result') actions.retry();
  };
  const windows = new Windows(layer.el, t, lang === 'ru' ? ',' : '.', actions);
  const restartButton = new RestartButton(layer.el, t('ui.restart'), restart);

  // Одна кнопка: на уровне — команда попытке, в окне итога — «Дальше», в итоге набора — «Сначала».
  const input = new OneButton({
    press: () => {
      const a = flow.press();
      if (a === 'run') run.press();
      else if (a === 'next') actions.next();
      else if (a === 'from-start') actions.fromStart();
    },
    release: () => run.release(),
    restart,
  });
  bindOneButton(stage.app.canvas, input);
  const line = new DebugLine(ui);
  const title = t('game.title');
  const clock = new FixedStep();
  hud.startIntro(true); // при запуске игры — название игры над надписью уровня (GDD «Экраны и интерфейс»)

  stage.app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    if (!corePaused) clock.advance(ticker.deltaMS, step);
    flow.frame(dt, run);
    scene.sync(ticker.deltaMS);
    layer.fit(stage.layout, window.innerWidth, window.innerHeight);
    const id = run.def.id;
    hud.update(
      {
        levelNo: flow.index + 1,
        name: t(`level.${id}.name`),
        hint: t(`level.${id}.hint`),
        legion: run.legion,
        par: run.def.par,
        time: run.time,
        waiting: run.state === 'ready',
        first: flow.index === 0,
        playing: flow.screen === 'level',
        bar: flow.screen !== 'pack',
      },
      dt,
    );
    windows.showResult(flow.screen === 'result' ? flow.result() : null, run.def.par, flow.isLast, flow.ready);
    windows.showPack(flow.screen === 'pack' ? flow.totals() : null, flow.ready);
    restartButton.setShown(flow.screen !== 'pack');
    line.update(
      performance.now(),
      `${title} ${VERSION} (${BUILD}) · ${stage.layout} · ${Math.round(ticker.FPS)} к/с · ${id} · ${run.state} · ${flow.screen}` +
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
      flow.goTo(i);
      openLevel(i);
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
    screen: () => flow.screen,
    showPack: () => {
      flow.goTo(levels.length - 1);
      flow.next();
    },
  };
  platform.loadingFinished();
}

boot().catch((err: unknown) => {
  console.error('boot failed', err);
});
