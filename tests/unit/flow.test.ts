import { describe, expect, it } from 'vitest';
import { DATA } from '../../src/data';
import { LevelFlow } from '../../src/game/flow';

describe('переход по уровням', () => {
  const delay = DATA.num('done_input_delay_s');
  it('во время попытки нажатие — команда попытке', () => {
    const f = new LevelFlow(delay);
    f.frame(5, 'play');
    expect(f.onPress('ready')).toBe('run');
    expect(f.onPress('play')).toBe('run');
  });
  it('после финиша — пауза delay, потом следующий уровень', () => {
    const f = new LevelFlow(delay);
    f.frame(delay * 0.5, 'done');
    expect(f.onPress('done')).toBe('wait');
    f.frame(delay * 0.5, 'done');
    expect(f.onPress('done')).toBe('next');
    f.reset();
    expect(f.onPress('done')).toBe('wait');
  });
  it('пауза считается заново после каждого финиша', () => {
    const f = new LevelFlow(delay);
    f.frame(delay, 'done');
    f.frame(0.016, 'play');
    f.frame(delay * 0.9, 'done');
    expect(f.onPress('done')).toBe('wait');
  });
});
