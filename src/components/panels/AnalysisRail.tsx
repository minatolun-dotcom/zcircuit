import { useCircuitStore } from '../../store/circuitStore';
import type { OptimizationSuggestion, SuggestionPriority } from '../../engine/optimization';
import type { ValidationFinding, ValidationSeverity } from '../../engine/validation';

const SEV_STYLE: Record<ValidationSeverity, { dot: string; text: string; ring: string }> = {
  error: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', ring: 'border-red-200 dark:border-red-900' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', ring: 'border-amber-200 dark:border-amber-900' },
  info: { dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-400', ring: 'border-sky-200 dark:border-sky-900' },
};

const PRIORITY_STYLE: Record<SuggestionPriority, { chip: string; label: string }> = {
  critical: { chip: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', label: 'critical' },
  warning: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', label: 'warning' },
  info: { chip: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300', label: 'info' },
};

function PanelShell({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  return (
    <section
      data-testid={testId}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-1.5 dark:border-slate-700">
        <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      </header>
      <div className="max-h-44 overflow-y-auto">{children}</div>
    </section>
  );
}

function ValidationRow({ finding }: { finding: ValidationFinding }) {
  const selectNode = useCircuitStore((s) => s.selectNode);
  const style = SEV_STYLE[finding.severity];
  return (
    <button
      type="button"
      data-testid="validation-finding"
      data-severity={finding.severity}
      onClick={() => finding.nodeId && selectNode(finding.nodeId)}
      title={finding.nodeId ? 'Select the component on the canvas' : undefined}
      className={`flex w-full items-start gap-2 border-b border-slate-100 px-3 py-1.5 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${style.text}`}
    >
      <span aria-hidden="true" className={`mt-1 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold">{finding.code.replaceAll('_', ' ')}</span>
        <span className="block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{finding.message}</span>
      </span>
    </button>
  );
}

function ValidationSection() {
  const validation = useCircuitStore((s) => s.validation);
  if (!validation) return null;
  const { error, warning } = validation.counts;
  return (
    <PanelShell title={`Validation${validation.ok ? ' · no errors' : ''}`} testId="validation-panel">
      {validation.findings.length === 0 ? (
        <p className="px-3 py-2.5 text-[11px] text-slate-400 dark:text-slate-500">No problems found.</p>
      ) : (
        validation.findings.map((f) => <ValidationRow key={f.id} finding={f} />)
      )}
      {!validation.ok && (
        <p className="px-3 py-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          {error} error{error === 1 ? '' : 's'} · {warning} warning{warning === 1 ? '' : 's'}
        </p>
      )}
    </PanelShell>
  );
}

function SuggestionRow({ suggestion }: { suggestion: OptimizationSuggestion }) {
  const style = PRIORITY_STYLE[suggestion.priority];
  return (
    <div
      data-testid="optimization-suggestion"
      data-priority={suggestion.priority}
      className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-1.5 last:border-b-0 dark:border-slate-800"
    >
      <span className={`mt-0.5 shrink-0 rounded px-1 text-[9px] font-bold uppercase tracking-wide ${style.chip}`}>
        {style.label}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200">{suggestion.title}</span>
        <span className="block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{suggestion.detail}</span>
      </span>
    </div>
  );
}

function OptimizationSection() {
  const optimization = useCircuitStore((s) => s.optimization);
  if (!optimization) return null;
  return (
    <PanelShell title={`Optimization · ${optimization.suggestions.length} suggestion${optimization.suggestions.length === 1 ? '' : 's'}`} testId="optimization-panel">
      {optimization.suggestions.length === 0 ? (
        <p className="px-3 py-2.5 text-[11px] text-slate-400 dark:text-slate-500">
          No suggestions - the layout and conductor sizing look fine.
        </p>
      ) : (
        optimization.suggestions.map((s) => <SuggestionRow key={s.id} suggestion={s} />)
      )}
    </PanelShell>
  );
}

/**
 * Right-hand overlay listing the live validation findings and optimization
 * suggestions. Findings are color-coded (error / warning / info); clicking a
 * finding selects its component on the canvas.
 */
export function AnalysisRail() {
  const validationEnabled = useCircuitStore((s) => s.validationEnabled);
  const optimizationEnabled = useCircuitStore((s) => s.optimizationEnabled);
  if (!validationEnabled && !optimizationEnabled) return null;
  return (
    <div
      data-testid="analysis-rail"
      className="pointer-events-none absolute right-2 top-2 z-20 flex w-80 max-w-[60%] flex-col gap-2"
    >
      {validationEnabled && (
        <div className="pointer-events-auto">
          <ValidationSection />
        </div>
      )}
      {optimizationEnabled && (
        <div className="pointer-events-auto">
          <OptimizationSection />
        </div>
      )}
    </div>
  );
}
