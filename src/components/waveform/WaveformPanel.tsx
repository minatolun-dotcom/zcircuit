import { useEffect, useMemo, useRef, useState } from 'react';
import { MAINS_FREQUENCY_HZ, peakFromRms, waveformPoint } from '../../engine/waveform';
import { useCircuitStore } from '../../store/circuitStore';

const HEIGHT = 176;
const MIN_WINDOW_MS = 20;
const MAX_WINDOW_MS = 400;
const DEFAULT_WINDOW_MS = 100;

interface TraceParams {
  vRms: number;
  iRms: number;
}

/**
 * Oscilloscope-style waveform drawer. Traces are synthesized sinusoids
 * y(t) = sqrt(2) * RMS * sin(2 * pi * 50 * t) sampled from the steady-state
 * solver results (labeled "idealized" - the MNA core is never re-run here).
 * The trace scrolls in simulated time at simulationSpeed x wall-clock time;
 * the time axis can be zoomed in/out. Nothing is drawn while paused.
 */
export function WaveformPanel() {
  const running = useCircuitStore((s) => s.simulationRunning);
  const speed = useCircuitStore((s) => s.simulationSpeed);
  const sim = useCircuitStore((s) => s.simResult);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [windowMs, setWindowMs] = useState(DEFAULT_WINDOW_MS);
  const [width, setWidth] = useState(600);
  const simTimeRef = useRef(0);

  // Responsive canvas size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(320, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset the time base when a new run starts.
  useEffect(() => {
    if (running) simTimeRef.current = 0;
  }, [running]);

  const params = useMemo<TraceParams | null>(() => {
    const sources = sim?.components.filter(
      (c) => (c.type === 'switchboard' || c.type === 'inverter') && c.status === 'on',
    );
    return sources && sources.length > 0
      ? {
          vRms: sources[0].voltageV || 0,
          iRms: sources.reduce((sum, s) => sum + s.currentA, 0),
        }
      : null;
  }, [sim]);

  // Animation loop - draws only while running.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !running || !params) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dtMs = Math.min(200, now - last);
      last = now;
      simTimeRef.current += dtMs * speed;
      draw(ctx, width, HEIGHT, simTimeRef.current, windowMs, params);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, width, HEIGHT);
    };
  }, [running, params, windowMs, width, speed]);

  const vPeak = params ? peakFromRms(params.vRms) : 0;
  const iPeak = params ? peakFromRms(params.iRms) : 0;

  return (
    <div
      ref={wrapRef}
      data-testid="waveform-panel"
      className="shrink-0 border-t border-slate-200 bg-slate-950 px-3 pb-2 pt-1 dark:border-slate-800"
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Oscilloscope</h2>
          <span
            data-testid="waveform-idealized"
            className="rounded bg-slate-800 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-300"
          >
            idealized
          </span>
          <span className="hidden text-[11px] text-slate-500 sm:inline">
            V {params ? `${params.vRms.toFixed(0)} V RMS · ${vPeak.toFixed(0)} V peak` : '—'}
            <span aria-hidden="true" className="mx-1.5 text-slate-600">
              |
            </span>
            I {params ? `${params.iRms.toFixed(2)} A RMS · ${iPeak.toFixed(2)} A peak` : '—'}
            <span aria-hidden="true" className="mx-1.5 text-slate-600">
              |
            </span>
            {MAINS_FREQUENCY_HZ} Hz
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span data-testid="waveform-window" className="text-[10px] text-slate-500">
            {windowMs} ms window
          </span>
          <button
            type="button"
            data-testid="waveform-zoom-out"
            title="Zoom out on the time axis"
            onClick={() => setWindowMs((w) => Math.min(MAX_WINDOW_MS, w * 2))}
            className="rounded border border-slate-700 bg-slate-800 px-1.5 text-[11px] text-slate-300 hover:bg-slate-700"
          >
            −
          </button>
          <button
            type="button"
            data-testid="waveform-zoom-in"
            title="Zoom in on the time axis"
            onClick={() => setWindowMs((w) => Math.max(MIN_WINDOW_MS, w / 2))}
            className="rounded border border-slate-700 bg-slate-800 px-1.5 text-[11px] text-slate-300 hover:bg-slate-700"
          >
            +
          </button>
        </div>
      </div>

      <div className="relative" style={{ height: HEIGHT }}>
        <canvas
          ref={canvasRef}
          data-testid="waveform-canvas"
          className="block w-full"
          style={{ height: HEIGHT, display: running && params ? 'block' : 'none' }}
        />
        {(!running || !params) && (
          <div
            data-testid="waveform-placeholder"
            className="absolute inset-0 flex items-center justify-center text-[12px] text-slate-500"
          >
            {!running
              ? 'Paused — press ▶ Run to display the waveform'
              : 'No powered source on the canvas to display'}
          </div>
        )}
      </div>
    </div>
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tNow: number,
  windowMs: number,
  p: TraceParams,
) {
  const dpr = window.devicePixelRatio || 1;
  const canvas = ctx.canvas;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Grid: one 10 ms division, center dashed line.
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
  ctx.lineWidth = 1;
  const divMs = 10;
  const tStart = tNow - windowMs;
  const firstDiv = Math.ceil(tStart / divMs) * divMs;
  ctx.beginPath();
  for (let t = firstDiv; t <= tNow; t += divMs) {
    const x = ((t - tStart) / windowMs) * w;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Channels, each normalized to its own peak about the vertical center.
  const trace = (rms: number, color: string, read: (pt: { voltageV: number; currentA: number }) => number) => {
    if (rms < 1e-9) return;
    const peak = peakFromRms(rms);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const samples = Math.max(80, Math.round(w / 3));
    for (let i = 0; i <= samples; i++) {
      const t = tStart + (i / samples) * windowMs;
      const pt = waveformPoint(t, { vRms: p.vRms, iRms: p.iRms });
      const y = h / 2 - (read(pt) / peak) * (h / 2 - 10);
      const x = (i / samples) * w;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  trace(p.vRms, '#f59e0b', (pt) => pt.voltageV);
  trace(p.iRms, '#38bdf8', (pt) => pt.currentA);

  // Axis labels.
  ctx.fillStyle = 'rgba(203, 213, 225, 0.85)';
  ctx.font = '9px ui-sans-serif, sans-serif';
  ctx.fillText(`+${Math.round(peakFromRms(p.vRms))} V`, 4, 11);
  ctx.fillText(`-${Math.round(peakFromRms(p.vRms))} V`, 4, h - 4);
  ctx.fillStyle = 'rgba(125, 211, 252, 0.9)';
  ctx.fillText(`+${peakFromRms(p.iRms).toFixed(2)} A`, w - 44, 11);
  ctx.fillText(`-${peakFromRms(p.iRms).toFixed(2)} A`, w - 46, h - 4);
}