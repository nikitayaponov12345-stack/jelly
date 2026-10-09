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
