import type { Tables } from './data/tables';

/** Числа физики и угроз из constants.csv (единицы — клетки и секунды). */
export interface Physics {
  cols: number;
  rows: number;
  run: number;
  gravity: number;
  gravityHold: number;
  holdMax: number;
  /** Скорость отрыва = √(2 × gravity × jump_height). */
  jumpV: number;
  vmax: number;
  half: number;
  inset: number;
  coyote: number;
  jumpBuffer: number;
  respawn: number;
  stuck: number;
  progressEps: number;
  fallOutMargin: number;
  spikeX0: number;
  spikeX1: number;
  spikeY0: number;
  spikeInset: number;
  sawRadius: number;
  laserPeriod: number;
  laserOn: number;
  laserWarn: number;
  laserAltPhase: number;
  laserX0: number;
  laserX1: number;
  laserInset: number;
  laserMinDy: number;
  laserFreezeDy: number;
  plateEps: number;
  plateEdge: number;
  flagX0: number;
  stars2Extra: number;
}

export function physicsFrom(t: Tables): Physics {
  const n = (k: string): number => t.num(k);
  return {
    cols: n('grid_cols'),
    rows: n('grid_rows'),
    run: n('run_speed'),
    gravity: n('gravity'),
    gravityHold: n('gravity_hold'),
    holdMax: n('hold_max_s'),
    jumpV: Math.sqrt(2 * n('gravity') * n('jump_height')),
    vmax: n('fall_speed_max'),
    half: n('hero_half'),
    inset: n('collide_inset'),
    coyote: n('coyote_s'),
    jumpBuffer: n('jump_buffer_s'),
    respawn: n('respawn_s'),
    stuck: n('stuck_s'),
    progressEps: n('progress_eps'),
    fallOutMargin: n('fall_out_margin'),
    spikeX0: n('spike_x0'),
    spikeX1: n('spike_x1'),
    spikeY0: n('spike_y0'),
    spikeInset: n('spike_hero_inset'),
    sawRadius: n('saw_radius'),
    laserPeriod: n('laser_period_s'),
    laserOn: n('laser_on_s'),
    laserWarn: n('laser_warn_s'),
    laserAltPhase: n('laser_alt_phase_s'),
    laserX0: n('laser_x0'),
    laserX1: n('laser_x1'),
    laserInset: n('laser_hero_inset'),
    laserMinDy: n('laser_min_dy'),
    laserFreezeDy: n('laser_freeze_dy'),
    plateEps: n('plate_eps'),
    plateEdge: n('plate_edge'),
    flagX0: n('flag_x0'),
    stars2Extra: n('stars_2_extra'),
  };
}
