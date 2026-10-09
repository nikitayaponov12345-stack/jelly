import './debug';
import { FixedStep, STEP_MS } from './core/clock';
import { allLevels } from './core/levels';
import { physicsFrom } from './core/physics';
import { Run } from './core/run';
import { DATA } from './data';
import type { DebugState } from './debug';
import { Stage } from './game/stage';
import { StubView } from './game/view';
import { StubPlatform } from './platform/stub';
import { DebugLine } from './ui/debug-line';

const VERSION = '0.0.2';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
const BUILD = import.meta.env.VITE_BUILD ?? 'dev';

async function boot(): Promise<void> {
  const platform = new StubPlatform();
  await platform.init();
  const lang = platform.language() === 'ru' ? 'ru' : 'en';

  const stage = new Stage();
  await stage.init(document.getElementById('game')!);
  // Вид уровня — M0-02; пока заглушка этапа 0.
  const view = new StubView(stage.root);
  view.build(stage.layout);
  stage.onLayout = (layout) => view.build(layout);

  const levels = allLevels(DATA);
  const P = physicsFrom(DATA);
  let run = new Run(levels[0]!, P);
  let gameMs = 0;
  const step = (dt: number): void => {
    run.step(dt);
    gameMs += dt;
  };

  const clock = new FixedStep();
  const line = new DebugLine(document.getElementById('ui')!);
  const title = DATA.text('game.title', lang);

  stage.app.ticker.add((ticker) => {
    clock.advance(ticker.deltaMS, step);
    run.drainEvents(); // события читает вид уровня (M0-02)
    view.sync(gameMs);
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
      const def = levels.find((l) => l.id === id);
      if (!def) throw new Error(`нет уровня ${id}`);
      run = new Run(def, P);
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
  };
  platform.loadingFinished();
}

boot().catch((err: unknown) => {
  console.error('boot failed', err);
});
