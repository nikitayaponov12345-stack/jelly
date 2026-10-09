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
