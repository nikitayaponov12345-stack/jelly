import { describe, expect, it } from 'vitest';
import { JUMP_KEYS, OneButton, RESTART_KEY } from '../../src/game/input';

function setup(): { log: string[]; b: OneButton } {
  const log: string[] = [];
  const b = new OneButton({ press: () => log.push('press'), release: () => log.push('release'), restart: () => log.push('restart') });
  return { log, b };
}

describe('одна кнопка', () => {
  it('касание — нажатие, отпускание — release', () => {
    const { log, b } = setup();
    b.pointerDown(1);
    b.pointerUp(1);
    expect(log).toEqual(['press', 'release']);
  });

  it('второй палец — новое нажатие; release — когда отпущены все', () => {
    const { log, b } = setup();
    b.pointerDown(1);
    b.pointerDown(2);
    b.pointerUp(1);
    expect(log).toEqual(['press', 'press']);
    b.pointerUp(2);
    expect(log).toEqual(['press', 'press', 'release']);
  });

  it('клавиши прыжка по коду, автоповтор не нажатие, палец и клавиша вместе', () => {
    const { log, b } = setup();
    expect(JUMP_KEYS).toEqual(['Space', 'ArrowUp', 'KeyW']);
    expect(b.keyDown('Space', false)).toBe(true);
    expect(b.keyDown('Space', true)).toBe(true);
    b.pointerDown(1);
    expect(b.keyUp('Space')).toBe(true);
    expect(log).toEqual(['press', 'press']);
    b.pointerUp(1);
    expect(log).toEqual(['press', 'press', 'release']);
  });

  it('R — заново (без автоповтора), чужие клавиши не наши', () => {
    const { log, b } = setup();
    expect(b.keyDown(RESTART_KEY, false)).toBe(true);
    expect(b.keyDown(RESTART_KEY, true)).toBe(true);
    expect(b.keyDown('KeyQ', false)).toBe(false);
    expect(b.keyUp('KeyQ')).toBe(false);
    expect(log).toEqual(['restart']);
  });

  it('потеря фокуса отпускает всё; отпускание без нажатия ничего не шлёт', () => {
    const { log, b } = setup();
    b.pointerUp(5);
    b.keyUp('ArrowUp');
    expect(log).toEqual([]);
    b.keyDown('KeyW', false);
    b.blur();
    b.blur();
    expect(log).toEqual(['press', 'release']);
  });
});
