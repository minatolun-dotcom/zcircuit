import { describe, expect, it } from 'vitest';
import {
  MAINS_FREQUENCY_HZ,
  peakFromRms,
  rmsOfSeries,
  waveformPoint,
  waveformSeries,
} from './waveform';

const P = { vRms: 230, iRms: 60 / 230 };

describe('waveformPoint (synthesized sinusoids)', () => {
  it('is zero at t = 0 and at every half cycle', () => {
    expect(waveformPoint(0, P).voltageV).toBeCloseTo(0, 9);
    expect(waveformPoint(10, P).voltageV).toBeCloseTo(0, 9); // half period
    expect(waveformPoint(20, P).voltageV).toBeCloseTo(0, 9); // full period
  });

  it('hits the peak at a quarter period (t = 5 ms)', () => {
    const p = waveformPoint(5, P);
    expect(p.voltageV).toBeCloseTo(Math.SQRT2 * 230, 6);
    expect(p.currentA).toBeCloseTo(Math.SQRT2 * (60 / 230), 6);
  });

  it('current follows the same 50 Hz phase as voltage', () => {
    const a = waveformPoint(2.5, P);
    const b = waveformPoint(2.5, P);
    expect(a.tMs).toBe(b.tMs);
    expect(a.currentA / a.voltageV).toBeCloseTo(P.iRms / P.vRms, 6);
  });
});

describe('peakFromRms', () => {
  it('reports sqrt(2) x the RMS magnitude', () => {
    expect(peakFromRms(230)).toBeCloseTo(Math.SQRT2 * 230, 6);
    expect(peakFromRms(60 / 230)).toBeCloseTo(Math.SQRT2 * (60 / 230), 6);
  });
});

describe('waveformSeries', () => {
  it('produces the requested number of evenly spaced samples', () => {
    const s = waveformSeries(0, 100, 500, P);
    expect(s).toHaveLength(500);
    expect(s[1].tMs - s[0].tMs).toBeCloseTo(0.2, 9);
  });

  it('one full 20 ms cycle sampled densely returns the analytic RMS', () => {
    const cycle = waveformSeries(0, 20, 2000, P);
    const { vRms, iRms } = rmsOfSeries(cycle);
    expect(vRms).toBeCloseTo(230, 1);
    expect(iRms).toBeCloseTo(60 / 230, 1);
  });

  it('one 20 ms cycle swings positive then negative (50 Hz)', () => {
    const cycle = waveformSeries(0, 20, 401, P);
    const vs = cycle.map((p) => p.voltageV);
    const max = Math.max(...vs);
    const min = Math.min(...vs);
    expect(max).toBeCloseTo(Math.SQRT2 * 230, 2);
    expect(min).toBeCloseTo(-Math.SQRT2 * 230, 2);
    // Peak at 5 ms, trough at 15 ms: a half period apart.
    const tMax = cycle.find((p) => p.voltageV === max)!.tMs;
    const tMin = cycle.find((p) => p.voltageV === min)!.tMs;
    expect(tMax).toBeCloseTo(5, 1);
    expect(tMin).toBeCloseTo(15, 1);
    expect(Math.abs(tMax - tMin)).toBeCloseTo(1000 / (2 * MAINS_FREQUENCY_HZ), 1);
  });
});