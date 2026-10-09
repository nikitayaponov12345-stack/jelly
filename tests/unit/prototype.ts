import { readFileSync } from 'node:fs';

/**
 * Прототип docs/research/prototype.html без браузера: скрипты страницы с заглушками DOM и холста.
 * Нужен только тестам сверки ядра с прототипом (TESTPLAN §1). Шаг — 1/60 с, как в ядре.
 */
export interface Prototype {
  /** Состояние игры прототипа: G.state, G.hero {x, y, alive}, G.legion, G.frozen [{c, r}], G.doorOpen. */
  G(): any;
  loadLevel(index: number): void;
  step(): void;
  press(): void;
  release(): void;
}

export function loadPrototype(path = 'docs/research/prototype.html'): Prototype {
  const html = readFileSync(path, 'utf8');
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n;\n');
  const ctx: any = new Proxy(
    {},
    {
      get: (t: any, k) => (k in t ? t[k] : () => ({ addColorStop() {}, width: 10 })),
      set: (t: any, k, v) => ((t[k] = v), true),
    },
  );
  const canvas = { getContext: () => ctx, addEventListener() {}, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }), style: {} };
  const win: any = { innerWidth: 960, innerHeight: 540, devicePixelRatio: 1, addEventListener() {} };
  const doc = { getElementById: (id: string) => (id === 'c' ? canvas : { textContent: '' }) };
  const perf = { now: () => 0 };
  const raf = () => 0;
  const run = new Function('window', 'document', 'performance', 'requestAnimationFrame', `${code}\n;return Proto;`);
  const Proto = run(win, doc, perf, raf);
  const game = win.__proto.game;
  Proto.onKey('Enter', true); // со стартового экрана прототипа — в игру
  return {
    G: () => game.G,
    loadLevel: (i) => game.loadLevel(i),
    step: () => Proto.update(1 / 60),
    press: () => Proto.onKey(' ', true),
    release: () => Proto.onKey(' ', false),
  };
}
