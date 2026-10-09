import './debug';
import { FixedStep } from './core/clock';
import { DATA } from './data';
import { Stage } from './game/stage';
import { StubView } from './game/view';
import { StubPlatform } from './platform/stub';
import { DebugLine } from './ui/debug-line';

const VERSION = '0.0.1';
/** Метка сборки: короткий хеш коммита от `npm run publish`, иначе 'dev'. */
const BUILD = import.meta.env.VITE_BUILD ?? 'dev';

async function boot(): Promise<void> {
  const platform = new StubPlatform();
  await platform.init();
  const lang = platform.language() === 'ru' ? 'ru' : 'en';

  const stage = new Stage();
  await stage.init(document.getElementById('game')!);
  const view = new StubView(stage.root);
  view.build(stage.layout);
  stage.onLayout = (layout) => view.build(layout);

  const clock = new FixedStep();
  let gameMs = 0;
  const line = new DebugLine(document.getElementById('ui')!);
  const title = DATA.text('game.title', lang);

  stage.app.ticker.add((ticker) => {
    clock.advance(ticker.deltaMS, (dt) => {
      gameMs += dt;
    });
    view.sync(gameMs);
    line.update(performance.now(), `${title} ${VERSION} (${BUILD}) · ${stage.layout} · ${Math.round(ticker.FPS)} к/с · ${(gameMs / 1000).toFixed(1)} с`);
  });

  window.__game = {
    ready: true,
    version: VERSION,
    build: BUILD,
    layout: () => stage.layout,
    gameMs: () => gameMs,
    platformLog: () => platform.log.slice(),
  };
  platform.loadingFinished();
}

boot().catch((err: unknown) => {
  console.error('boot failed', err);
});
