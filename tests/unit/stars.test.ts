import { describe, expect, it } from 'vitest';
import { starsFor } from '../../src/core/stars';
import { DATA } from '../../src/data';

const X = DATA.num('stars_2_extra');

describe('звёзды', () => {
  it('пар 3', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => starsFor(n, 3, X))).toEqual([3, 3, 3, 3, 2, 2, 1]);
  });
  it('пар 0', () => {
    expect([0, 1, 2, 3].map((n) => starsFor(n, 0, X))).toEqual([3, 2, 2, 1]);
  });
});
