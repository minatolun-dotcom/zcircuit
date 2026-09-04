/**
 * Waveform synthesis (Todo 9). The oscilloscope plot is NOT a time-stepped
 * simulation - it is an analytical visualisation of the steady-state solver
 * results: y(t) = v2 * V_rms * sin(2 * pi * f * t) for voltage and current.
 * The MNA core is never re-run here (see PLAN.md "Waveforms" convention).
 *
 * Pure functions only, so the trace geometry is unit-testable; the Canvas
 * component just samples these at display resolution.
 */

/** IEC mains frequency used by the whole app (Hz). */
export const MAINS_FREQUENCY_HZ = 50;

export interface WaveformParams {
  /** RMS voltage of the channel (V). */
  vRms: number;
  /** RMS current of the channel (A). */
  iRms: number;
  frequencyHz?: number;
}

export interface WaveformPoint {
  /** Simulated time (ms). */
  tMs: number;
  /** Instantaneous voltage (V). */
  voltageV: number;
  /** Instantaneous current (A). */
  currentA: number;
}

/** Instantaneous value of both channels at simulated time tMs. */
export function waveformPoint(tMs: number, p: WaveformParams): WaveformPoint {
  const f = p.frequencyHz ?? MAINS_FREQUENCY_HZ;
  const w = (2 * Math.PI * f) / 1000; // radians per ms
  const phase = w * tMs;
  return {
    tMs,
    voltageV: Math.SQRT2 * p.vRms * Math.sin(phase),
    currentA: Math.SQRT2 * p.iRms * Math.sin(phase),
  };
}

/** Peak value for an RMS magnitude (sqrt(2) x for a sinusoid). */
export function peakFromRms(rms: number): number {
  return Math.SQRT2 * rms;
}

/**
 * Sample a time window [startMs, startMs + durationMs) into `count` evenly
 * spaced points - the exact series a canvas trace is drawn from.
 */
export function waveformSeries(
  startMs: number,
  durationMs: number,
  count: number,
  p: WaveformParams,
): WaveformPoint[] {
  if (count <= 0) return [];
  const step = durationMs / count;
  const out: WaveformPoint[] = new Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = waveformPoint(startMs + i * step, p);
  }
  return out;
}

/** Discrete RMS of a sampled series (approaches the analytic value with enough samples). */
export function rmsOfSeries(points: WaveformPoint[]): { vRms: number; iRms: number } {
  if (points.length === 0) return { vRms: 0, iRms: 0 };
  let v2 = 0;
  let i2 = 0;
  for (const p of points) {
    v2 += p.voltageV * p.voltageV;
    i2 += p.currentA * p.currentA;
  }
  const n = points.length;
  return { vRms: Math.sqrt(v2 / n), iRms: Math.sqrt(i2 / n) };
}