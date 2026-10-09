/**
 * Цвета прототипа: PAL и цвета, записанные прямо в drawWorld и частицах docs/research/prototype.html. Свои — только поле
 * (один цвет вместо градиента bg0 → bg1) и рамка карты уровня (цвет кнопок PAL.btn). До вехи арта (M3) — рабочая палитра.
 */
export const PAL = {
  bg: 0xf6f1ff,
  field: 0xefe6ff,
  ground: 0x3b2a55,
  grass: 0x8ee3a0,
  grassDark: 0x5fc47a,
  spike: 0xf1eff6,
  spikeEdge: 0x8e8aa3,
  laser: 0xff5050,
  laserCore: 0xff5a5a,
  laserWarn: 0xff5a5a,
  lampOff: 0x7a5c8f,
  lampWarn: 0xffb0b0,
  door: 0xff9f43,
  doorDark: 0xd97a1f,
  plate: 0xffd166,
  plateDark: 0xc99a2e,
  platePressed: 0xffe28a,
  flag: 0x58d68d,
  hero: 0xff6fae,
  heroDark: 0xd64f8f,
  heroLight: 0xffd1e6,
  frozen: 0xc99bb5,
  frozenDark: 0x9f7591,
  ink: 0x3b2a55,
  saw: 0xdcd9e6,
  sawDark: 0x6b6880,
  star: 0xffc93c,
  cloud: 0xffffff,
  hill: 0xbeaae6,
  minimapFrame: 0x7c5cff,
} as const;

export const CONFETTI = [0xff6fae, 0x7c5cff, 0x58d68d, 0xffd166, 0xff9f43, 0x6fd3ff] as const;

/**
 * Цвета пар плит и дверей (M1-01): пара 0 (P и D) — цвета прототипа, 1 (Q и E) — голубая, 2 (R и G) — фиолетовая
 * (не зелёная: зелёная плита сливалась с травой и флагом).
 */
export const PAIR_COLORS = [
  { door: PAL.door, doorDark: PAL.doorDark, plate: PAL.plate, plateDark: PAL.plateDark, platePressed: PAL.platePressed },
  { door: 0x5aa9ff, doorDark: 0x2f7fd6, plate: 0x8cc8ff, plateDark: 0x4a8fd1, platePressed: 0xc2e2ff },
  { door: 0xa66bff, doorDark: 0x7a45d6, plate: 0xc9a6ff, plateDark: 0x8f63db, platePressed: 0xe2d1ff },
] as const;
