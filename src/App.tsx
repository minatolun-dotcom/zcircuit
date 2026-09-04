import { FlowCanvas } from './components/canvas/FlowCanvas';
import { Palette } from './components/sidebar/Palette';
import { PropertiesPanel } from './components/sidebar/PropertiesPanel';
import { useCircuitStore } from './store/circuitStore';

export default function App() {
  const nodes = useCircuitStore((s) => s.nodes.length);
  const edges = useCircuitStore((s) => s.edges.length);
  const notice = useCircuitStore((s) => s.notice);

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      <header
        className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4"
        data-testid="app-header"
      >
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-bold tracking-tight">⚡ Wiring Practice</h1>
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            IEC 60617 · drag, wire, simulate
          </span>
        </div>
        <div
          className="flex items-center gap-2 text-[11px] text-slate-500"
          data-testid="canvas-status"
        >
          <span>{nodes} component{nodes === 1 ? '' : 's'}</span>
          <span aria-hidden="true">·</span>
          <span>{edges} wire{edges === 1 ? '' : 's'}</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Palette />
        <main className="min-w-0 flex-1">
          <FlowCanvas />
        </main>
        <PropertiesPanel />
      </div>

      {notice && (
        <div
          data-testid="notice"
          className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
