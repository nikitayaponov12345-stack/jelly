# M0-03 — строка счёта, надписи и окна

**Цель.** Набор из шести уровней проходится как игра: строка счёта (уровень и название, легион и пар, время), надпись «Уровень N — название» в начале уровня, плашка подсказки, «Нажми, чтобы начать», окно итога уровня («Уровень пройден!», звёзды, желейки и пар, время с десятыми, «Ещё раз» и «Дальше») и итог набора после шестого уровня (желейки, время, звёзды из возможных, «Сначала») — GDD «Экраны и интерфейс». Окна принимают нажатия через done_input_delay_s (0,6 с), чтобы прыжок у флага не нажал «Дальше».

**Что изменится в игре.** Сверху — строка счёта: «Уровень 1 · Яма», «Легион: 0 / пар 3», «0:00» и кнопка «↻». В начале уровня над полем на 2,2 с — «Уровень 1 — Яма» (при запуске игры над ней — название игры «Желейный легион»), потом плашка подсказки «Прыгай позже… или не прыгай». Пока первая желейка ждёт — посередине поля мигает «Нажми, чтобы начать», на первом уровне под ней — «Тап — прыжок · держи — выше». У флага — окно итога: три звезды (жёлтые — заработанные), «Желеек: 1 (пар 1)», «Время: 0:07,7», кнопки «Ещё раз» и «Дальше» (на шестом уровне — «Итоги»); первые 0,6 с кнопки неактивны. Касание поля, пробел, ↑ или W в окне — «Дальше», R — «Ещё раз». После шестого уровня — «Набор пройден!» с суммами и кнопкой «Сначала». Версия 0.0.4. В портрете строка счёта — в две строки, кнопка «↻» — справа в ней.

Перед началом прочитай `CLAUDE.md`, `docs/ARCHITECTURE.md` (§2, §5, §9) и в `docs/GDD.md` разделы «Экраны и интерфейс» и «Звёзды, пар и время».

**Проверка до передачи.** Код ниже написан Claude и прогнан 09.10.2026 в песочнице поверх M0-02 (состояние ноутбука после коммита `ef6ded1`, вместе с тестами M0-01 от Claude Code): `npm run check` зелёный, Vitest — 18 файлов, 81 тест; Playwright — 15 сценариев и 1 пропущен намеренно (камера — только в проекте `phone`); снимки обеих раскладок просмотрены. Браузер песочницы рисовал программно, 2–8 кадров в секунду, поэтому сценарии ждут условий (`expect.poll`, `toBeEnabled`, тайм-ауты), а не фиксированного времени. Пробная сборка независимым исполнителем по этому тексту: около 11 минут, `npm run check` зелёный с первого раза; по её итогам добавлены название игры в первой надписи (GDD «Экраны и интерфейс»), проверка «окно целиком на экране» (TESTPLAN, «Интерфейс до вехи арта»), непрозрачные окна и уточнены описания снимков. Ядро эта задача не меняет.

**Условие.** M0-02 сделана (в `docs/tasks/README.md` у M0-02 стоит «сделано …»). Если нет — остановись и напиши об этом в отчёте.

## 1. Файлы — дословно

Все файлы ниже переносятся как есть. `src/ui/play-ui.ts` (кнопка и надпись M0-02) удалить — его заменяют `restart-button.ts` и `hud.ts`.

Как это устроено. `PackFlow` (`src/game/flow.ts`) — ход по набору без DOM: финиш попытки запоминает итог уровня и открывает окно итога; `press()` говорит, что значит одна кнопка сейчас; `next()`, `retry()`, `fromStart()` — действия окон; пауза окон — во времени кадров. Вёрстка — DOM поверх холста в «слое дизайна» (`DesignLayer`): это прямоугольник экрана дизайна 1280 × 720 или 720 × 1280, вписанный, как холст; CSS берёт масштаб из переменной `--u` (CSS-пикселей в точке дизайна) и раскладку из `data-layout`, поэтому строка счёта, надписи и окна стоят на своих местах в обеих раскладках. Кнопки — в CSS-пикселях не меньше 44–48, чтобы на телефоне попадать пальцем. Кнопки окон, касание поля и клавиши зовут одни и те же действия в `main.ts`; окно, не готовое к нажатиям, их не примет. Интерфейс — рабочая заготовка (CLAUDE.md, правило 9), текст — из `translations/strings.csv` (строки уже есть с этапа 0).

### 1.1. `src/game/flow.ts` — заменить целиком

```ts
import type { RunState } from '../core/run';

/** Итог пройденного уровня: гибели, время (с) и звёзды. */
export interface LevelResult {
  legion: number;
  time: number;
  stars: number;
}

/** Что на экране: идёт уровень, окно итога уровня или итог набора. */
export type Screen = 'level' | 'result' | 'pack';

/** Что значит нажатие одной кнопки сейчас. */
export type PressAction = 'run' | 'next' | 'from-start' | 'wait';

/**
 * Ход по набору уровней (рабочая заготовка до карты миров M1): финиш попытки открывает окно итога,
 * «Дальше» — следующий уровень, после последнего — итог набора, «Сначала» — первый уровень с чистыми итогами.
 * Окна принимают нажатия не раньше delay секунд после появления — чтобы прыжок у флага не нажал «Дальше».
 * Логика без DOM: её проверяют тесты, кнопки и клавиши только вызывают методы.
 */
export class PackFlow {
  index = 0;
  screen: Screen = 'level';
  private shown = 0;
  private readonly results: Array<LevelResult | null>;

  constructor(
    readonly count: number,
    private readonly delay: number,
  ) {
    this.results = new Array<LevelResult | null>(count).fill(null);
  }

  /** Раз в кадр: dt — время кадра, с. Финиш попытки запоминает итог уровня и открывает окно итога. */
  frame(dt: number, run: { state: RunState; legion: number; time: number; stars: number }): void {
    if (this.screen === 'level') {
      if (run.state === 'done') {
        this.results[this.index] = { legion: run.legion, time: run.time, stars: run.stars };
        this.open('result');
      }
      return;
    }
    this.shown += dt;
  }

  /** Окно принимает нажатия (на уровне — всегда). */
  get ready(): boolean {
    return this.screen === 'level' || this.shown >= this.delay;
  }

  get isLast(): boolean {
    return this.index === this.count - 1;
  }

  /** Одна кнопка: на уровне — команда попытке, в окне итога — «Дальше», в итоге набора — «Сначала». */
  press(): PressAction {
    if (this.screen === 'level') return 'run';
    if (!this.ready) return 'wait';
    return this.screen === 'result' ? 'next' : 'from-start';
  }

  /** «Дальше»: номер следующего уровня (новая попытка) или null — после последнего открыт итог набора. */
  next(): number | null {
    if (this.isLast) {
      this.open('pack');
      return null;
    }
    this.index++;
    this.screen = 'level';
    return this.index;
  }

  /** «Ещё раз» и «Заново»: тот же уровень с начала. */
  retry(): void {
    this.screen = 'level';
  }

  /** «Сначала»: итоги стёрты, первый уровень. */
  fromStart(): void {
    this.results.fill(null);
    this.index = 0;
    this.screen = 'level';
  }

  /** Уровень i с начала (отладка и тесты). */
  goTo(i: number): void {
    this.index = i;
    this.screen = 'level';
  }

  /** Итог уровня i, если он пройден. */
  result(i = this.index): LevelResult | null {
    return this.results[i] ?? null;
  }

  /** Итог набора: суммы по пройденным уровням (у каждого — последнее прохождение). */
  totals(): { legion: number; time: number; stars: number; maxStars: number; passed: number } {
    let legion = 0;
    let time = 0;
    let stars = 0;
    let passed = 0;
    for (const r of this.results) {
      if (!r) continue;
      legion += r.legion;
      time += r.time;
      stars += r.stars;
      passed++;
    }
    return { legion, time, stars, maxStars: this.count * 3, passed };
  }

  private open(screen: Screen): void {
    this.screen = screen;
    this.shown = 0;
  }
}
```

### 1.2. `src/ui/format.ts`

```ts
/**
 * Время уровня для строки счёта и окон: «м:сс» (строка счёта) или «м:сс,д» с десятыми (окно итога).
 * Доли отбрасываются, а не округляются: на строке счёта 7,9 с — ещё «0:07». Разделитель десятых — из языка.
 */
export function formatTime(seconds: number, tenths: boolean, decimal = '.'): string {
  const total = Math.max(0, seconds);
  if (tenths) {
    const d = Math.floor(total * 10 + 1e-6);
    const s = Math.floor(d / 10);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${decimal}${d % 10}`;
  }
  const s = Math.floor(total + 1e-6);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
```

### 1.3. `src/ui/design-layer.ts`

```ts
import { DESIGN, fitDesign, type Layout } from '../game/layout';

/**
 * Слой вёрстки в точках дизайна: прямоугольник экрана дизайна поверх холста, как его вписал fitDesign.
 * CSS берёт масштаб из переменной --u (CSS-пикселей в точке дизайна) и раскладку из data-layout:
 * строка счёта, надписи и окна стоят на своих местах в обеих раскладках и на любом окне.
 */
export class DesignLayer {
  readonly el: HTMLDivElement;
  private key = '';

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'design-layer';
    host.appendChild(this.el);
  }

  /** Раз в кадр (дёшево, пока размеры окна те же). */
  fit(layout: Layout, width: number, height: number): void {
    const key = `${layout} ${width} ${height}`;
    if (key === this.key) return;
    this.key = key;
    const f = fitDesign(width, height, layout);
    const d = DESIGN[layout];
    const s = this.el.style;
    s.left = `${f.x}px`;
    s.top = `${f.y}px`;
    s.width = `${d.w * f.scale}px`;
    s.height = `${d.h * f.scale}px`;
    s.setProperty('--u', String(f.scale));
    this.el.dataset.layout = layout;
  }
}

/** Элемент с классом и data-testid. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, testid?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (testid) e.dataset.testid = testid;
  return e;
}

/** Текст элемента меняется, только если он другой (не трогаем DOM каждый кадр). */
export function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

/** Видимость элемента через hidden, только при изменении. */
export function setShown(e: HTMLElement, shown: boolean): void {
  if (e.hidden === shown) e.hidden = !shown;
}
```

### 1.4. `src/ui/hud.ts`

```ts
import { el, setShown, setText } from './design-layer';
import { formatTime } from './format';

/** Что показывает строка счёта и надписи над полем в этом кадре. */
export interface HudState {
  /** Номер уровня в наборе, с 1. */
  levelNo: number;
  name: string;
  hint: string;
  legion: number;
  par: number;
  /** Время уровня, с. */
  time: number;
  /** Первая желейка ждёт нажатия. */
  waiting: boolean;
  /** Первый уровень набора: под «Нажми, чтобы начать» — строка про управление. */
  first: boolean;
  /** Идёт уровень (окно итога и итог набора прячут надписи). */
  playing: boolean;
  /** Строка счёта видна (в итоге набора её нет: уровня уже нет). */
  bar: boolean;
}

type Text = (key: string, vars?: Readonly<Record<string, string | number>>) => string;

/**
 * Строка счёта (уровень и название, легион и пар, время) и надписи над полем: «Уровень N — название»
 * первые intro секунд после открытия уровня (при запуске игры — ещё и название игры над ней), потом плашка
 * подсказки; «Нажми, чтобы начать», пока первая желейка ждёт. Рабочая заготовка до M3 (GDD «Экраны и интерфейс»),
 * текст — из строк перевода.
 */
export class Hud {
  private readonly level = el('div', 'hud-level', 'hud-level');
  private readonly legion = el('div', 'hud-legion', 'hud-legion');
  private readonly time = el('div', 'hud-time', 'hud-time');
  private readonly bar = el('div', 'hud', 'hud');
  private readonly intro = el('div', 'plaque intro', 'intro');
  private readonly introGame = el('div', 'intro-game');
  private readonly introLevel = el('div', 'intro-level');
  private readonly hint = el('div', 'plaque hint', 'hint');
  private readonly tap = el('div', 'tap-msg', 'tap-msg');
  private readonly tapMain = el('div', 'tap-main');
  private readonly tapSub = el('div', 'tap-sub');
  private introLeft = 0;
  private hintIn = 0;
  private withTitle = false;

  constructor(
    layer: HTMLElement,
    private readonly t: Text,
    private readonly introSeconds: number,
  ) {
    this.bar.append(this.level, this.legion, this.time);
    this.intro.append(this.introGame, this.introLevel);
    this.tap.append(this.tapMain, this.tapSub);
    this.intro.hidden = true;
    this.hint.hidden = true;
    this.tap.hidden = true;
    layer.append(this.bar, this.intro, this.hint, this.tap);
  }

  /** Уровень открыт: надпись с названием на introSeconds, подсказка — после неё; withTitle — при запуске игры. */
  startIntro(withTitle = false): void {
    this.introLeft = this.introSeconds;
    this.hintIn = 0;
    this.withTitle = withTitle;
  }

  /** Раз в кадр: dt — время кадра, с. */
  update(s: HudState, dt: number): void {
    setShown(this.bar, s.bar);
    setText(this.level, `${this.t('ui.level', { n: s.levelNo })} · ${s.name}`);
    setText(this.legion, this.t('ui.legion_par', { n: s.legion, par: s.par }));
    setText(this.time, formatTime(s.time, false));
    if (this.introLeft > 0) this.introLeft = Math.max(0, this.introLeft - dt);
    if (this.introLeft === 0) this.hintIn = Math.min(1, this.hintIn + dt / 0.3); // подсказка проявляется за 0,3 с
    const introOn = s.playing && this.introLeft > 0;
    setShown(this.intro, introOn);
    if (introOn) {
      setText(this.introGame, this.withTitle ? this.t('game.title') : '');
      setShown(this.introGame, this.withTitle);
      setText(this.introLevel, this.t('ui.level_title', { n: s.levelNo, name: s.name }));
      // Как drawIntro прототипа: появляется за 0,25 с, гаснет за последние 0,4 с.
      const a = Math.min(1, this.introLeft / 0.4, (this.introSeconds - this.introLeft) / 0.25 + 0.01);
      this.intro.style.opacity = a.toFixed(2);
    }
    const hintOn = s.playing && this.introLeft === 0 && s.hint !== '';
    setShown(this.hint, hintOn);
    if (hintOn) {
      setText(this.hint, s.hint);
      this.hint.style.opacity = (this.hintIn * 0.9).toFixed(2);
    }
    setShown(this.tap, s.playing && s.waiting);
    setText(this.tapMain, this.t('ui.tap_to_start'));
    setText(this.tapSub, s.first ? this.t('ui.tap_jump') : '');
    setShown(this.tapSub, s.first);
  }
}
```

### 1.5. `src/ui/windows.ts`

```ts
import type { LevelResult } from '../game/flow';
import { el, setShown, setText } from './design-layer';
import { formatTime } from './format';

type Text = (key: string, vars?: Readonly<Record<string, string | number>>) => string;

export interface WindowActions {
  retry(): void;
  next(): void;
  fromStart(): void;
}

function button(cls: string, testid: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', `win-btn ${cls}`, testid);
  b.type = 'button';
  b.addEventListener('click', () => {
    onClick();
    b.blur(); // пробел после щелчка — команда игре, а не повторный щелчок по кнопке
  });
  return b;
}

/**
 * Окна поверх поля: итог уровня («Уровень пройден!», звёзды, желейки и пар, время с десятыми, «Ещё раз» и
 * «Дальше» / «Итоги») и итог набора (желейки, время, звёзды из возможных, «Сначала»). Кнопки неактивны,
 * пока окно не готово принимать нажатия (done_input_delay_s). Рабочая заготовка до M3.
 */
export class Windows {
  private readonly result = el('div', 'window', 'result');
  private readonly rTitle = el('div', 'win-title');
  private readonly rStars = el('div', 'win-stars', 'stars');
  private readonly rUsed = el('div', 'win-line', 'result-used');
  private readonly rTime = el('div', 'win-line', 'result-time');
  private readonly rRetry: HTMLButtonElement;
  private readonly rNext: HTMLButtonElement;
  private readonly pack = el('div', 'window', 'pack');
  private readonly pTitle = el('div', 'win-title');
  private readonly pUsed = el('div', 'win-line', 'pack-used');
  private readonly pTime = el('div', 'win-line', 'pack-time');
  private readonly pStars = el('div', 'win-line', 'pack-stars');
  private readonly pAgain: HTMLButtonElement;
  private readonly starEls: HTMLSpanElement[] = [];

  /** decimal — разделитель десятых в языке игры («,» или «.»). */
  constructor(
    layer: HTMLElement,
    private readonly t: Text,
    private readonly decimal: string,
    actions: WindowActions,
  ) {
    for (let i = 0; i < 3; i++) {
      const s = el('span', 'star');
      s.textContent = '★';
      this.starEls.push(s);
      this.rStars.append(s);
    }
    this.rRetry = button('secondary', 'retry', () => actions.retry());
    this.rNext = button('primary', 'next', () => actions.next());
    const rButtons = el('div', 'win-buttons');
    rButtons.append(this.rRetry, this.rNext);
    this.result.append(this.rTitle, this.rStars, this.rUsed, this.rTime, rButtons);
    this.pAgain = button('primary', 'from-start', () => actions.fromStart());
    const pButtons = el('div', 'win-buttons');
    pButtons.append(this.pAgain);
    this.pack.append(this.pTitle, this.pUsed, this.pTime, this.pStars, pButtons);
    this.result.hidden = true;
    this.pack.hidden = true;
    layer.append(this.result, this.pack);
  }

  /** Окно итога уровня (r = null — спрятать). */
  showResult(r: LevelResult | null, par: number, last: boolean, ready: boolean): void {
    setShown(this.result, r !== null);
    if (!r) return;
    setText(this.rTitle, this.t('ui.level_done'));
    this.starEls.forEach((s, i) => s.classList.toggle('on', i < r.stars));
    setText(this.rUsed, this.t('ui.used', { n: r.legion, par }));
    setText(this.rTime, this.t('ui.time', { t: formatTime(r.time, true, this.decimal) }));
    setText(this.rRetry, this.t('ui.retry'));
    setText(this.rNext, this.t(last ? 'ui.results' : 'ui.next'));
    this.rRetry.disabled = !ready;
    this.rNext.disabled = !ready;
  }

  /** Итог набора (null — спрятать). */
  showPack(totals: { legion: number; time: number; stars: number; maxStars: number } | null, ready: boolean): void {
    setShown(this.pack, totals !== null);
    if (!totals) return;
    setText(this.pTitle, this.t('ui.pack_done'));
    setText(this.pUsed, this.t('ui.total_jellies', { n: totals.legion }));
    setText(this.pTime, this.t('ui.total_time', { t: formatTime(totals.time, true, this.decimal) }));
    setText(this.pStars, this.t('ui.total_stars', { n: totals.stars, max: totals.maxStars }));
    setText(this.pAgain, this.t('ui.from_start'));
    this.pAgain.disabled = !ready;
  }
}
```

### 1.6. `src/ui/restart-button.ts`

```ts
/** Кнопка «Заново» справа в строке счёта (слой дизайна); размер в CSS-пикселях — на телефоне не меньше 48 × 48. */
export class RestartButton {
  private readonly btn: HTMLButtonElement;

  constructor(host: HTMLElement, label: string, onRestart: () => void) {
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'restart-btn';
    this.btn.dataset.testid = 'restart';
    this.btn.textContent = '↻';
    this.btn.title = label;
    this.btn.setAttribute('aria-label', label);
    this.btn.addEventListener('click', () => {
      onRestart();
      this.btn.blur(); // пробел после щелчка — прыжок, а не повторный щелчок по кнопке
    });
    host.append(this.btn);
  }

  /** В итоге набора кнопки нет: начинать там нечего. */
  setShown(shown: boolean): void {
    if (this.btn.hidden === shown) this.btn.hidden = !shown;
  }
}
```

### 1.7. `src/main.ts` — заменить целиком

```ts
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

const VERSION = '0.0.4';
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
```

### 1.8. `src/debug.ts` — два поля в конец интерфейса `GameDebug`, после `pauseCore`

```ts
  /** Что на экране: уровень, окно итога уровня или итог набора. */
  screen(): 'level' | 'result' | 'pack';
  /** Открыть итог набора с теми итогами уровней, что уже есть (снимки и проверки окна). */
  showPack(): void;
```

### 1.9. `index.html` — заменить целиком

Стили строки счёта, надписей и окон; кнопка «Заново» теперь стоит в строке счёта (в слое дизайна).

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <title>Желейный легион</title>
    <link rel="icon" href="data:," />
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #f6f1ff;
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      #game {
        position: fixed;
        inset: 0;
      }
      #game canvas {
        display: block;
      }
      #ui {
        position: fixed;
        inset: 0;
        pointer-events: none;
        font-family: system-ui, sans-serif;
        color: #3b2a55;
      }
      #ui button {
        pointer-events: auto;
        font: inherit;
        touch-action: manipulation;
        cursor: pointer;
      }
      #ui [hidden] {
        display: none !important;
      }
      /* Кнопка «Заново» — в строке счёта справа, в CSS-пикселях: на телефоне не меньше 48 × 48. */
      #ui .restart-btn {
        position: absolute;
        z-index: 2;
        width: 48px;
        height: 48px;
        border: 0;
        border-radius: 12px;
        background: #7c5cff;
        color: #fff;
        font-size: 28px;
        line-height: 48px;
        padding: 0;
      }
      /* Слой в точках дизайна: --u — CSS-пикселей в точке дизайна (src/ui/design-layer.ts). */
      #ui .design-layer {
        position: absolute;
        --u: 1;
      }
      #ui .hud {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        box-sizing: border-box;
        display: grid;
        align-items: center;
        font-weight: 800;
        white-space: nowrap;
      }
      #ui .hud-level,
      #ui .hud-legion {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #ui .hud-legion {
        color: #d64f8f;
      }
      #ui .design-layer[data-layout='landscape'] .restart-btn {
        right: calc(var(--u) * 16px);
        top: max(0px, calc(var(--u) * 28px - 24px));
      }
      #ui .design-layer[data-layout='portrait'] .restart-btn {
        right: calc(var(--u) * 16px);
        top: calc(var(--u) * 60px - 24px);
      }
      #ui .design-layer[data-layout='landscape'] .hud {
        height: calc(var(--u) * 56px);
        padding: 0 calc(var(--u) * 32px + 48px) 0 calc(var(--u) * 40px);
        grid-template-columns: 1fr auto 1fr;
        column-gap: calc(var(--u) * 24px);
        font-size: calc(var(--u) * 24px);
      }
      #ui .design-layer[data-layout='landscape'] .hud-time {
        justify-self: end;
      }
      #ui .design-layer[data-layout='portrait'] .hud {
        height: calc(var(--u) * 120px);
        padding: calc(var(--u) * 8px) calc(var(--u) * 32px + 48px) calc(var(--u) * 8px) calc(var(--u) * 24px);
        grid-template-columns: 1fr auto;
        grid-template-areas: 'level time' 'legion legion';
        column-gap: calc(var(--u) * 20px);
        font-size: calc(var(--u) * 34px);
      }
      #ui .design-layer[data-layout='portrait'] .hud-level {
        grid-area: level;
      }
      #ui .design-layer[data-layout='portrait'] .hud-time {
        grid-area: time;
      }
      #ui .design-layer[data-layout='portrait'] .hud-legion {
        grid-area: legion;
      }
      #ui .plaque,
      #ui .tap-msg {
        position: absolute;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        font-weight: 800;
      }
      #ui .plaque {
        box-sizing: border-box;
        max-width: 88%;
        padding: calc(var(--u) * 10px) calc(var(--u) * 22px);
        border-radius: calc(var(--u) * 16px);
      }
      #ui .intro {
        background: rgba(255, 255, 255, 0.92);
        font-size: calc(var(--u) * 30px);
        white-space: nowrap;
      }
      #ui .intro-game {
        color: #7c5cff;
        font-size: calc(var(--u) * 44px);
        font-weight: 900;
      }
      #ui .hint {
        width: max-content;
        background: rgba(255, 255, 255, 0.7);
        color: #7c6a94;
        font-size: calc(var(--u) * 22px);
      }
      #ui .design-layer[data-layout='landscape'] .plaque {
        top: calc(var(--u) * 136px);
      }
      #ui .design-layer[data-layout='portrait'] .plaque {
        top: calc(var(--u) * 210px);
      }
      #ui .design-layer[data-layout='portrait'] .intro {
        font-size: calc(var(--u) * 38px);
      }
      #ui .design-layer[data-layout='portrait'] .intro-game {
        font-size: calc(var(--u) * 52px);
      }
      #ui .design-layer[data-layout='portrait'] .hint {
        font-size: calc(var(--u) * 30px);
      }
      #ui .tap-msg {
        width: max-content;
        max-width: 90%;
        color: #7c5cff;
        animation: tap-blink 1.6s ease-in-out infinite;
      }
      #ui .tap-main {
        font-size: calc(var(--u) * 30px);
      }
      #ui .tap-sub {
        margin-top: calc(var(--u) * 8px);
        color: #7c6a94;
        font-size: calc(var(--u) * 20px);
      }
      #ui .design-layer[data-layout='landscape'] .tap-msg {
        top: calc(var(--u) * 306px);
      }
      #ui .design-layer[data-layout='portrait'] .tap-msg {
        top: calc(var(--u) * 400px);
      }
      #ui .design-layer[data-layout='portrait'] .tap-main {
        font-size: calc(var(--u) * 40px);
      }
      #ui .design-layer[data-layout='portrait'] .tap-sub {
        font-size: calc(var(--u) * 28px);
      }
      @keyframes tap-blink {
        50% {
          opacity: 0.35;
        }
      }
      #ui .window {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        box-sizing: border-box;
        width: calc(var(--u) * 560px);
        padding: calc(var(--u) * 28px) calc(var(--u) * 32px);
        border: calc(var(--u) * 3px) solid #b89cff;
        border-radius: calc(var(--u) * 28px);
        background: #ffffff;
        box-shadow: 0 calc(var(--u) * 10px) calc(var(--u) * 30px) rgba(59, 42, 85, 0.25);
        text-align: center;
        animation: win-pop 0.3s ease-out;
      }
      #ui .design-layer[data-layout='portrait'] .window {
        width: calc(var(--u) * 640px);
      }
      @keyframes win-pop {
        from {
          opacity: 0;
          transform: translate(-50%, -44%);
        }
      }
      #ui .win-title {
        font-size: calc(var(--u) * 40px);
        font-weight: 900;
      }
      #ui .win-stars {
        margin: calc(var(--u) * 6px) 0;
        font-size: calc(var(--u) * 64px);
        line-height: 1.2;
      }
      #ui .star {
        margin: 0 calc(var(--u) * 6px);
        color: #d9d2e6;
      }
      #ui .star.on {
        color: #ffc93c;
      }
      #ui .win-line {
        margin: calc(var(--u) * 6px) 0;
        color: #7c6a94;
        font-size: calc(var(--u) * 26px);
        font-weight: 700;
      }
      #ui .win-buttons {
        display: flex;
        justify-content: center;
        gap: calc(var(--u) * 20px);
        margin-top: calc(var(--u) * 22px);
      }
      #ui .win-btn {
        min-width: calc(var(--u) * 200px);
        min-height: max(44px, calc(var(--u) * 64px));
        padding: 0 calc(var(--u) * 28px);
        border: 0;
        border-radius: calc(var(--u) * 16px);
        color: #fff;
        font-size: calc(var(--u) * 26px);
        font-weight: 800;
      }
      #ui .win-btn.primary {
        background: #7c5cff;
      }
      #ui .win-btn.secondary {
        background: #b89cff;
      }
      #ui .win-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }
      #ui .design-layer[data-layout='portrait'] .win-title {
        font-size: calc(var(--u) * 48px);
      }
      #ui .design-layer[data-layout='portrait'] .win-line {
        font-size: calc(var(--u) * 32px);
      }
      #ui .design-layer[data-layout='portrait'] .win-btn {
        font-size: calc(var(--u) * 32px);
      }
      #ui .debug-line {
        position: absolute;
        left: 8px;
        bottom: 8px;
        max-width: calc(100% - 16px);
        padding: 4px 8px;
        border-radius: 6px;
        background: rgba(59, 42, 85, 0.72);
        color: #fff;
        font-size: 12px;
        line-height: 1.3;
      }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <div id="ui"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### 1.10. Версия

В `package.json` — `"version": "0.0.4"`, затем `npm install` (обновит версию в `package-lock.json`, зависимости те же).

## 2. Тесты — дословно

### 2.1. `tests/unit/flow.test.ts` — заменить целиком

```ts
import { describe, expect, it } from 'vitest';
import { DATA } from '../../src/data';
import { PackFlow } from '../../src/game/flow';

const delay = DATA.num('done_input_delay_s');
const play = { state: 'play' as const, legion: 0, time: 1, stars: 0 };
const done = (legion: number, time: number, stars: number) => ({ state: 'done' as const, legion, time, stars });

describe('ход по набору уровней', () => {
  it('на уровне нажатие — команда попытке', () => {
    const f = new PackFlow(3, delay);
    f.frame(5, play);
    expect(f.screen).toBe('level');
    expect(f.ready).toBe(true);
    expect(f.press()).toBe('run');
  });

  it('финиш открывает окно итога и запоминает итог уровня', () => {
    const f = new PackFlow(3, delay);
    f.frame(0.016, done(2, 7.5, 2));
    expect(f.screen).toBe('result');
    expect(f.result()).toEqual({ legion: 2, time: 7.5, stars: 2 });
    expect(f.result(1)).toBeNull();
  });

  it('окно итога не принимает нажатия первые delay секунд', () => {
    const f = new PackFlow(3, delay);
    f.frame(0.016, done(0, 5, 3));
    expect(f.ready).toBe(false);
    expect(f.press()).toBe('wait');
    f.frame(delay / 2, done(0, 5, 3));
    expect(f.press()).toBe('wait');
    f.frame(delay / 2, done(0, 5, 3));
    expect(f.ready).toBe(true);
    expect(f.press()).toBe('next');
  });

  it('«Дальше» — следующий уровень, после последнего — итог набора', () => {
    const f = new PackFlow(2, delay);
    f.frame(0, done(1, 4, 3));
    expect(f.isLast).toBe(false);
    expect(f.next()).toBe(1);
    expect(f.screen).toBe('level');
    expect(f.index).toBe(1);
    f.frame(0, done(3, 6, 2));
    expect(f.isLast).toBe(true);
    expect(f.next()).toBeNull();
    expect(f.screen).toBe('pack');
    expect(f.press()).toBe('wait');
    f.frame(delay, play);
    expect(f.press()).toBe('from-start');
    expect(f.totals()).toEqual({ legion: 4, time: 10, stars: 5, maxStars: 6, passed: 2 });
  });

  it('«Ещё раз» — тот же уровень; новый финиш заменяет итог', () => {
    const f = new PackFlow(3, delay);
    f.frame(0, done(4, 9, 1));
    f.retry();
    expect(f.screen).toBe('level');
    expect(f.index).toBe(0);
    f.frame(0.016, play);
    expect(f.screen).toBe('level');
    f.frame(0.016, done(1, 6, 3));
    expect(f.result()).toEqual({ legion: 1, time: 6, stars: 3 });
    expect(f.totals()).toMatchObject({ legion: 1, stars: 3, passed: 1 });
  });

  it('«Сначала» стирает итоги и открывает первый уровень', () => {
    const f = new PackFlow(2, delay);
    f.frame(0, done(1, 4, 3));
    f.next();
    f.frame(0, done(2, 5, 3));
    f.next();
    f.fromStart();
    expect(f.screen).toBe('level');
    expect(f.index).toBe(0);
    expect(f.totals()).toEqual({ legion: 0, time: 0, stars: 0, maxStars: 6, passed: 0 });
  });

  it('пауза окна считается заново для каждого окна', () => {
    const f = new PackFlow(3, delay);
    f.frame(0, done(0, 5, 3));
    f.frame(delay, play);
    expect(f.ready).toBe(true);
    f.next();
    f.frame(0, done(0, 5, 3));
    f.frame(delay * 0.9, play);
    expect(f.press()).toBe('wait');
  });
});
```

### 2.2. `tests/unit/format.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { formatTime } from '../../src/ui/format';

describe('время на экране', () => {
  it('строка счёта: минуты и секунды, доли отбрасываются', () => {
    expect(formatTime(0, false)).toBe('0:00');
    expect(formatTime(7.9, false)).toBe('0:07');
    expect(formatTime(65.2, false)).toBe('1:05');
    expect(formatTime(600, false)).toBe('10:00');
    expect(formatTime(-1, false)).toBe('0:00');
  });

  it('окно итога: с десятыми и разделителем языка', () => {
    expect(formatTime(464 / 60, true)).toBe('0:07.7');
    expect(formatTime(464 / 60, true, ',')).toBe('0:07,7');
    expect(formatTime(59.99, true)).toBe('0:59.9');
    expect(formatTime(0.3, true)).toBe('0:00.3');
    expect(formatTime(61, true)).toBe('1:01.0');
  });
});
```

### 2.3. `tests/e2e/play.spec.ts` — заменить целиком

Настоящие нажатия, как в M0-02; новые сценарии — строка счёта и надписи, окно итога («Ещё раз», «Дальше» одной кнопкой), итог набора (`__game.showPack()` открывает его с теми итогами, что есть) и «Сначала»; окна целиком на экране в обеих раскладках. Долгие сценарии — с тайм-аутом 90 с.

```ts
import { expect, test, type Page } from '@playwright/test';

// Ввод одной кнопкой, строка счёта и окна в собранной игре — настоящими нажатиями (клавиатура на ПК, касания на телефоне).
// Паузы интерфейса (надпись уровня, пауза окна) идут во времени кадров: в медленном headless-браузере — дольше, отсюда тайм-ауты.

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });
  return errors;
}

/** Нажатие кнопки прыжка тем способом, каким играют в этой раскладке: пробел на ПК, касание поля на телефоне. */
async function tap(page: Page, phone: boolean): Promise<void> {
  if (phone) {
    const p = await page.evaluate(() => window.__game!.toScreen(12, 4));
    await page.touchscreen.tap(p.x, p.y);
  } else await page.keyboard.press('Space');
}

/** Окно целиком на экране (TESTPLAN, «Интерфейс до вехи арта»). */
async function fitsScreen(page: Page, testid: string): Promise<void> {
  const box = (await page.getByTestId(testid).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
}

/** «Плита» с начала до финиша: старт одной кнопкой, без прыжков (первая желейка держит плиту). */
async function finishPlate(page: Page, phone: boolean): Promise<void> {
  await tap(page, phone);
  await page.evaluate(() => window.__game!.advance(8000));
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('done');
}

test('первое нажатие — старт, следующее — прыжок', async ({ page }, info) => {
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('ready');
  await expect(page.getByTestId('tap-msg')).toBeVisible();
  await tap(page, phone);
  await page.waitForFunction(() => window.__game!.state().state === 'play');
  await expect(page.getByTestId('tap-msg')).toBeHidden();
  // Первое нажатие не прыгает: желейка бежит по земле.
  await page.waitForFunction(() => window.__game!.state().hero.x > 2);
  expect((await page.evaluate(() => window.__game!.state())).hero.grounded).toBe(true);
  await tap(page, phone);
  await page.waitForFunction(() => !window.__game!.state().hero.grounded, null, { timeout: 2000 });
  expect(errors).toEqual([]);
});

test('«Заново» — клавишей R и кнопкой', async ({ page }, info) => {
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  await tap(page, phone);
  await page.evaluate(() => window.__game!.advance(3000)); // первая желейка гибнет на шипах «Ямы»
  expect((await page.evaluate(() => window.__game!.state())).bodies.length).toBeGreaterThan(0);
  if (phone) await page.getByTestId('restart').tap();
  else await page.keyboard.press('KeyR');
  const s = await page.evaluate(() => window.__game!.state());
  expect(s.state).toBe('ready');
  expect(s.bodies).toEqual([]);
  expect(s.legion).toBe(0);
  await page.getByTestId('restart').click();
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('ready');
  expect(errors).toEqual([]);
});

test('строка счёта, надпись уровня и подсказка', async ({ page }, info) => {
  test.setTimeout(90_000); // долгий сценарий: в медленном headless-браузере кадры редкие
  const errors = await open(page);
  await expect(page.getByTestId('hud-level')).toContainText(/(Уровень|Level) 1 · (Яма|The Pit)/);
  await expect(page.getByTestId('hud-legion')).toContainText(/0 \/ (пар|par) \d+/);
  await expect(page.getByTestId('hud-time')).toHaveText('0:00');
  await expect(page.getByTestId('intro')).toContainText(/(Уровень|Level) 1 — (Яма|The Pit)/);
  await expect(page.getByTestId('intro')).toContainText(/(Желейный легион|Jelly Legion)/); // при запуске — и название игры
  // После надписи (intro_s) — плашка подсказки уровня.
  await expect(page.getByTestId('hint')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('intro')).toBeHidden();
  await expect(page.getByTestId('hint')).toContainText(/(Прыгай позже|Jump later)/);
  // Счёт идёт за попыткой: гибель на шипах — легион 1, время — минуты и секунды.
  await page.evaluate(() => {
    const g = window.__game!;
    g.command.press();
    g.command.release();
    g.advance(2500);
  });
  await expect(page.getByTestId('hud-legion')).toContainText(/1 \/ (пар|par) \d+/);
  await expect(page.getByTestId('hud-time')).toHaveText('0:02');
  await page.screenshot({ path: `build/shots/m0-03_hud_${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('«Плита»: окно итога, «Ещё раз» и «Дальше»', async ({ page }, info) => {
  test.setTimeout(90_000); // долгий сценарий: в медленном headless-браузере кадры редкие
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  await page.evaluate(() => window.__game!.setLevel('p-02'));
  await finishPlate(page, phone);
  const result = page.getByTestId('result');
  await expect(result).toBeVisible();
  expect(await page.evaluate(() => window.__game!.screen())).toBe('result');
  await expect(page.getByTestId('result-used')).toContainText(/1 \((пар|par) 1\)/);
  await expect(page.locator('[data-testid=stars] .star.on')).toHaveCount(3);
  await expect(page.getByTestId('result-time')).toContainText(/0:07[.,]7/);
  await fitsScreen(page, 'result');
  // Пауза окна (done_input_delay_s): кнопки неактивны, потом нажимаются.
  await expect(page.getByTestId('next')).toBeEnabled({ timeout: 10_000 });
  await page.screenshot({ path: `build/shots/m0-03_result_${info.project.name}.png` });
  // «Ещё раз» — тот же уровень с начала.
  await page.getByTestId('retry').click();
  await expect(result).toBeHidden();
  const again = await page.evaluate(() => window.__game!.state());
  expect(again.level).toBe('p-02');
  expect(again.state).toBe('ready');
  expect(again.bodies).toEqual([]);
  // Снова финиш; одна кнопка (пробел или касание поля) — «Дальше»: «Лазер», третий уровень набора.
  await finishPlate(page, phone);
  await expect(page.getByTestId('next')).toBeEnabled({ timeout: 10_000 });
  await tap(page, phone);
  const next = await page.evaluate(() => window.__game!.state());
  expect(next.level).toBe('p-03');
  expect(next.state).toBe('ready');
  expect(await page.evaluate(() => window.__game!.screen())).toBe('level');
  await expect(result).toBeHidden();
  await expect(page.getByTestId('intro')).toContainText(/(Уровень|Level) 3/);
  await expect(page.getByTestId('intro')).not.toContainText(/(Желейный легион|Jelly Legion)/); // название игры — только при запуске
  expect(errors).toEqual([]);
});

test('итог набора и «Сначала»', async ({ page }, info) => {
  test.setTimeout(90_000); // долгий сценарий: в медленном headless-браузере кадры редкие
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  await page.evaluate(() => window.__game!.setLevel('p-02'));
  await finishPlate(page, phone);
  await expect(page.getByTestId('result')).toBeVisible();
  await page.evaluate(() => window.__game!.showPack());
  const pack = page.getByTestId('pack');
  await expect(pack).toBeVisible();
  await expect(page.getByTestId('result')).toBeHidden();
  await expect(page.getByTestId('restart')).toBeHidden();
  await expect(page.getByTestId('hud')).toBeHidden();
  await expect(page.getByTestId('pack-used')).toContainText('1');
  await expect(page.getByTestId('pack-time')).toContainText(/0:07[.,]7/);
  await expect(page.getByTestId('pack-stars')).toContainText(/3 (из|of) 18/);
  await fitsScreen(page, 'pack');
  await expect(page.getByTestId('from-start')).toBeEnabled({ timeout: 10_000 });
  await page.screenshot({ path: `build/shots/m0-03_pack_${info.project.name}.png` });
  await page.getByTestId('from-start').click();
  await expect(pack).toBeHidden();
  await expect(page.getByTestId('restart')).toBeVisible();
  await expect(page.getByTestId('hud-level')).toContainText(/(Уровень|Level) 1 · (Яма|The Pit)/);
  const s = await page.evaluate(() => window.__game!.state());
  expect(s.level).toBe('p-01');
  expect(s.state).toBe('ready');
  expect(await page.evaluate(() => window.__game!.screen())).toBe('level');
  expect(errors).toEqual([]);
});

test('портрет: камера идёт за желейкой', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'камера двигается только в портрете');
  const errors = await open(page);
  expect(await page.evaluate(() => window.__game!.camera())).toBe(0);
  // Ядро на паузе: старт касанием и ровно 1,2 с игры — желейка у края ямы «Ямы» (x ≈ 6,9); кадры идут, камера догоняет.
  await page.evaluate(() => window.__game!.pauseCore(true));
  await tap(page, true);
  await page.evaluate(() => window.__game!.advance(1200));
  // Камера догнала: желейка на доле camera_lead (0,38) ширины окна поля; поле в портрете — во всю ширину экрана.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = window.__game!;
          const h = g.state().hero;
          return g.toScreen(h.x, h.y).x / window.innerWidth;
        }),
      { timeout: 10_000 },
    )
    .toBeCloseTo(0.38, 2);
  expect(await page.evaluate(() => window.__game!.camera())).toBeGreaterThan(50);
  await page.screenshot({ path: `build/shots/m0-03_camera_${info.project.name}.png` });
  expect(errors).toEqual([]);
});
```

### 2.4. `tests/e2e/smoke.spec.ts` — заменить целиком

От M0-02 два отличия: версия 0.0.4 и снимок `m0-03_*` (экран сменился, TESTPLAN §3).

```ts
import { expect, test } from '@playwright/test';

// Смоук собранной игры: страница открывается без ошибок, холст есть, раскладка верная, ядро уровня шагает.
test('игра запускается и рисует сцену', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });

  const canvas = page.locator('#game canvas');
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);

  // Ядро шагает в тикере: 0,3 с игрового времени. Без жёсткого окна в 1 с — в медленном headless-браузере кадры редкие.
  const before = await page.evaluate(() => window.__game!.gameMs());
  await page.waitForFunction((b) => window.__game!.gameMs() > b + 300, before, { timeout: 10_000 });

  const layout = await page.evaluate(() => window.__game!.layout());
  expect(layout).toBe(info.project.name === 'phone' ? 'portrait' : 'landscape');

  const calls = await page.evaluate(() => window.__game!.platformLog().map((c) => c.name));
  expect(calls).toContain('loadingFinished');

  // Сборка `npm run check` идёт без метки публикации.
  expect(await page.evaluate(() => window.__game!.build)).toBe('dev');
  // Язык страницы берётся из браузера: ru — «Желейный легион», иначе «Jelly Legion».
  await expect(page.getByTestId('debug-line')).toContainText(/(Желейный легион|Jelly Legion) 0\.0\.4/);

  await page.screenshot({ path: `build/shots/m0-03_${info.project.name}.png` });
  expect(errors).toEqual([]);
});

// Ядро в собранной игре: первая желейка ждёт нажатия; «Плита» проходится без прыжков с одной гибелью.
test('ядро уровня: старт по нажатию и «Плита» без прыжков', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });

  expect(await page.evaluate(() => window.__game!.levels())).toEqual(['p-01', 'p-02', 'p-03', 'p-04', 'p-05', 'p-06']);
  const s0 = await page.evaluate(() => window.__game!.state());
  expect(s0.level).toBe('p-01');
  expect(s0.state).toBe('ready');
  await page.evaluate(() => window.__game!.advance(1000));
  expect(await page.evaluate(() => window.__game!.state().hero.x)).toBe(1.5); // ждёт на старте

  const s1 = await page.evaluate(() => {
    const g = window.__game!;
    g.setLevel('p-02');
    g.command.press();
    g.command.release();
    g.advance(8000);
    return g.state();
  });
  expect(s1.state).toBe('done');
  expect(s1.legion).toBe(1);
  expect(s1.stars).toBe(3);
  expect(s1.bodies).toEqual([{ c: 12, r: 10 }]);
  expect(s1.time).toBeCloseTo(7.7333, 3);
  expect(errors).toEqual([]);
});
```

## 3. Снимки — посмотреть глазами
Надписи на снимках английские: у Playwright язык браузера по умолчанию английский (по-русски — «Уровень 1 · Яма», «Нажми, чтобы начать», «Уровень пройден!», «Набор пройден!»). Надпись уровня живёт 2,2 с по времени кадров: в медленном браузере снимок может попасть уже на плашку подсказки — это не ошибка.
- `build/shots/m0-03_desktop.png` — «Яма» до старта: сверху строка «Level 1 · The Pit», розовое «Legion: 0 / par 3», «0:00», справа фиолетовая кнопка «↻»; над полем — надпись: фиолетовое «Jelly Legion», под ним «Level 1 — The Pit» (или уже плашка «Jump later… or don't jump at all»); посередине поля — «Tap to start» и под ней «Tap to jump · hold to jump higher».
- `build/shots/m0-03_phone.png` — то же в портрете: строка счёта в две строки (уровень и время, под ними легион), «↻» справа в ней; надпись или подсказка над полем, «Tap to start» со строкой про управление; под полем — карта уровня с рамкой слева.
- `build/shots/m0-03_hud_desktop.png` и `m0-03_hud_phone.png` — та же «Яма» после гибели: «Legion: 1 / par 3», время «0:02» или «0:03», над полем — плашка «Jump later… or don't jump at all», тело на дне ямы.
- `build/shots/m0-03_result_desktop.png` и `m0-03_result_phone.png` — «Плита» (уровень 2): белое окно «Level complete!», три жёлтые звезды, «Jellies: 1 (par 1)», «Time: 0:07.7», кнопки «Retry» (светлее) и «Next»; окно посередине экрана и целиком на нём.
- `build/shots/m0-03_pack_desktop.png` и `m0-03_pack_phone.png` — окно «Pack complete!»: «Jellies used: 1», «Total time: 0:07.7», «Stars: 3 of 18», кнопка «Start over»; строки счёта и кнопки «↻» нет.
- `build/shots/m0-03_camera_phone.png` — «Яма» в портрете: желейка у края ямы примерно на 0,38 ширины экрана, справа яма с шипами, рамка на карте сдвинута вправо от левого края; сверху строка счёта.

## 4. Сборка по ссылке — без отправки
`npm run publish -- --dry-run` — ожидается строка `publish: Желейный легион 0.0.4 (<хеш>+), файлов N, адрес https://github.com/nikitayaponov12345-stack/jelly-play.git — push не делался`.

## 5. Критерии готовности
- Файлы §1 и тесты §2 — дословно (§1.8 — два поля); `src/ui/play-ui.ts` удалён.
- `npm run check` зелёный: Vitest — прежние файлы и `format.test.ts` (на ноутбуке после M0-02 было 17 файлов, станет 18); сборка до 3 МБ; Playwright — 15 passed, 1 skipped (камера — только `phone`).
- Снимки §3 соответствуют описанию.
- `npm run publish -- --dry-run` — строка §4.
- В `docs/tasks/README.md` — строка M0-03 «сделано ДД.ММ».

## Если что-то не так
- Если снимок не совпадает с описанием — приложи его и опиши, что видно; вёрстку не перерисовывай на свой вкус (вид — рабочая заготовка до M3).
- Если падает сценарий Playwright — приложи текст ошибки и папку `test-results\`; ожидания в сценариях не удлиняй и проверки не ослабляй без отчёта.

## Отчёт
Что сделано; итоговые строки `npm run check`; что видно на снимках §3; строка `publish --dry-run`; что не получилось и почему.
