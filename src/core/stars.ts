/** Звёзды за уровень: 3 — легион ≤ пар, 2 — легион ≤ пар + extra, 1 — пройден. */
export function starsFor(legion: number, par: number, extra: number): 1 | 2 | 3 {
  if (legion <= par) return 3;
  if (legion <= par + extra) return 2;
  return 1;
}
