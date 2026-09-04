import { useEffect, useState } from 'react';
import { FlowCanvas } from './components/canvas/FlowCanvas';
import { Palette } from './components/sidebar/Palette';
import { PropertiesPanel } from './components/sidebar/PropertiesPanel';
import { downloadJson, downloadPdf, downloadSvg } from './components/export/exportActions';
import { SimulationToolbar } from './components/toolbar/SimulationToolbar';
import { WaveformPanel } from './components/waveform/WaveformPanel';
import { useLiveAnalyses } from './store/analyses';
import { useCircuitStore } from './store/circuitStore';

const THEME_KEY = 'zcircuit.theme';
type Theme = 'dark' | 'light';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function ToolButton({
  label,
  title,
  onClick,
  disabled,
  testId,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="h-5 w-px bg-slate-300 dark:bg-slate-700" />;
}

export default function App() {
  const nodes = useCircuitStore((s) => s.nodes.length);
  const edges = useCircuitStore((s) => s.edges.length);
  const notice = useCircuitStore((s) => s.notice);
  const canUndo = useCircuitStore((s) => s.past.length > 0);
  const canRedo = useCircuitStore((s) => s.future.length > 0);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  const newCircuit = useCircuitStore((s) => s.newCircuit);
  const saveCircuit = useCircuitStore((s) => s.saveCircuit);
  const loadCircuit = useCircuitStore((s) => s.loadCircuit);
  const waveformOpen = useCircuitStore((s) => s.waveformOpen);
  const [theme, toggleTheme] = useTheme();
  useLiveAnalyses();

  return (
    <div className="relative flex h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header
        className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900"
        data-testid="app-header"
      >
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-sm font-bold tracking-tight">⚡ Wiring Practice</h1>
          <span className="hidden text-[11px] text-slate-400 dark:text-slate-500 sm:inline">
            IEC 60617 · drag, wire, simulate
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-2 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400"
            data-testid="canvas-status"
          >
            <span>
              {nodes} component{nodes === 1 ? '' : 's'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {edges} wire{edges === 1 ? '' : 's'}
            </span>
          </span>
          <Divider />
          <ToolButton label="↶" title="Undo (last circuit change)" onClick={undo} disabled={!canUndo} testId="undo-btn" />
          <ToolButton label="↷" title="Redo" onClick={redo} disabled={!canRedo} testId="redo-btn" />
          <Divider />
          <ToolButton label="New" title="Clear the canvas (new circuit)" onClick={newCircuit} testId="new-btn" />
          <ToolButton label="Save" title="Save circuit to this browser" onClick={saveCircuit} testId="save-btn" />
          <ToolButton label="Open" title="Load the saved circuit" onClick={loadCircuit} testId="open-btn" />
          <Divider />
          <ToolButton label="JSON" title="Export the circuit + results as JSON" onClick={downloadJson} testId="export-json-btn" />
          <ToolButton label="SVG" title="Export the wiring diagram as SVG" onClick={downloadSvg} testId="export-svg-btn" />
          <ToolButton label="PDF" title="Generate the wiring docket PDF" onClick={() => void downloadPdf()} testId="export-pdf-btn" />
          <Divider />
          <ToolButton
            label={theme === 'dark' ? '☀' : '☾'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
            testId="theme-toggle"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Palette />
        <main className="flex min-w-0 flex-1 flex-col bg-slate-200/70 dark:bg-slate-900">
          <div className="min-h-0 flex-1">
            <FlowCanvas />
          </div>
          {waveformOpen && <WaveformPanel />}
          <SimulationToolbar />
        </main>
        <PropertiesPanel />
      </div>

      {notice && (
        <div
          data-testid="notice"
          className="pointer-events-none absolute bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
