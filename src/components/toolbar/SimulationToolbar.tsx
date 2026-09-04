import { useCircuitStore } from '../../store/circuitStore';

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8];

function CountBadge({ errors, warnings, label }: { errors: number; warnings: number; label: string }) {
  const total = errors + warnings;
  return (
    <span
      data-testid={`${label}-count`}
      className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
        errors > 0
          ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
          : warnings > 0
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
      }`}
    >
      {total > 0 ? `${total}` : '✓'}
    </span>
  );
}

/**
 * Bottom toolbar: simulation transport (play/pause, speed) plus the analysis
 * and canvas toggles. Results appear on the canvas (readouts, highlighting)
 * and in the AnalysisRail overlay; the status line shows the solver summary.
 */
export function SimulationToolbar() {
  const running = useCircuitStore((s) => s.simulationRunning);
  const speed = useCircuitStore((s) => s.simulationSpeed);
  const setRunning = useCircuitStore((s) => s.setSimulationRunning);
  const setSpeed = useCircuitStore((s) => s.setSimulationSpeed);
  const validationEnabled = useCircuitStore((s) => s.validationEnabled);
  const optimizationEnabled = useCircuitStore((s) => s.optimizationEnabled);
  const gridVisible = useCircuitStore((s) => s.gridVisible);
  const waveformOpen = useCircuitStore((s) => s.waveformOpen);
  const toggleValidation = useCircuitStore((s) => s.toggleValidation);
  const toggleOptimization = useCircuitStore((s) => s.toggleOptimization);
  const toggleGrid = useCircuitStore((s) => s.toggleGrid);
  const toggleWaveform = useCircuitStore((s) => s.toggleWaveform);
  const simMessage = useCircuitStore((s) => s.simResult?.message ?? null);
  const validationErrors = useCircuitStore(
    (s) => s.validation?.counts.error ?? 0,
  );
  const validationWarnings = useCircuitStore(
    (s) => s.validation?.counts.warning ?? 0,
  );
  const optimizationCount = useCircuitStore(
    (s) => s.optimization?.suggestions.length ?? 0,
  );

  const toggleCls = (on: boolean) =>
    `flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
      on
        ? 'border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
        : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
    }`;

  return (
    <div
      data-testid="simulation-toolbar"
      className="flex h-11 shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="sim-play-btn"
          onClick={() => setRunning(!running)}
          title={running ? 'Pause the simulation' : 'Run the simulation'}
          className={`flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-semibold transition-colors ${
            running
              ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300'
              : 'border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300'
          }`}
        >
          {running ? '⏸ Pause' : '▶ Run'}
        </button>

        <label className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="sr-only">Simulation speed</span>
          <select
            data-testid="sim-speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded border border-slate-300 bg-white px-1 py-1 text-[11px] text-slate-700 outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>

      <span aria-hidden="true" className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="validation-toggle"
          onClick={toggleValidation}
          title="Check the circuit for wiring faults"
          className={toggleCls(validationEnabled)}
        >
          Validation
          <CountBadge errors={validationErrors} warnings={validationWarnings} label="validation" />
        </button>
        <button
          type="button"
          data-testid="optimization-toggle"
          onClick={toggleOptimization}
          title="Show wiring and conductor-size suggestions"
          className={toggleCls(optimizationEnabled)}
        >
          Optimize
          <span
            data-testid="optimization-count"
            className="rounded-full bg-slate-200 px-1.5 py-px text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {optimizationCount}
          </span>
        </button>
        <button
          type="button"
          data-testid="grid-toggle"
          onClick={toggleGrid}
          title={gridVisible ? 'Hide the routing grid' : 'Show the routing grid'}
          className={toggleCls(gridVisible)}
        >
          Grid
        </button>
        <button
          type="button"
          data-testid="waveform-toggle"
          onClick={toggleWaveform}
          title="Show the oscilloscope waveform drawer"
          className={toggleCls(waveformOpen)}
        >
          Scope
        </button>
      </div>

      <span aria-hidden="true" className="hidden h-5 w-px bg-slate-200 sm:block dark:bg-slate-700" />

      <p
        data-testid="sim-status"
        className="min-w-0 flex-1 truncate text-[11px] text-slate-500 dark:text-slate-400"
        title={simMessage ?? undefined}
      >
        {simMessage ?? 'Press ▶ Run to solve the circuit (steady-state 230 V RMS).'}
      </p>
    </div>
  );
}
