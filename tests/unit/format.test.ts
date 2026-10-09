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
