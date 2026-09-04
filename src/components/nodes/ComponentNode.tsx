import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ComponentNode, TerminalRole } from '../../types/circuit';
import { ROLE_COLOR, SRC_SUFFIX } from '../../types/circuit';
import { CATALOG } from '../library/catalog';
import { SymbolView } from '../library/symbols';
import { useCircuitStore } from '../../store/circuitStore';
import type { ComponentSim } from '../../engine/simulation';

function roleChar(role: TerminalRole): string {
  return role === 'PE' ? 'E' : role;
}

function handleStyle(y: number, x: number) {
  return {
    top: y - 5,
    left: x - 5,
    width: 10,
    height: 10,
    minWidth: 0,
    minHeight: 0,
  };
}

const HANDLE_BASE: React.CSSProperties = {
  borderRadius: '50%',
  border: '2px solid #fff',
  boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.35)',
  zIndex: 1,
};

function fmt(v: number): string {
  return v >= 100 ? `${Math.round(v)}` : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/** Short live readout for a component's simulation state (null = hide). */
function readoutFor(type: string, sim: ComponentSim, state: string | undefined): { text: string; value?: number } | null {
  switch (type) {
    case 'mcb':
    case 'switch':
      if (sim.status === 'tripped') return { text: 'TRIPPED' };
      if (state === 'off') return { text: 'OPEN' };
      if (sim.currentA > 1e-4) return { text: `${fmt(sim.currentA)} A`, value: sim.currentA };
      return null;
    case 'bulb':
    case 'fan':
      if (sim.status === 'on' && sim.currentA > 1e-4) {
        return { text: `${fmt(sim.currentA)} A · ${fmt(sim.powerW)} W`, value: sim.currentA };
      }
      return null;
    case 'switchboard':
    case 'inverter':
      if (sim.status === 'on' && sim.currentA > 1e-4) {
        return { text: `${fmt(sim.currentA)} A`, value: sim.currentA };
      }
      return null;
    case 'socket':
      if (sim.status === 'on' && sim.voltageV > 0.5) {
        return { text: `${Math.round(sim.voltageV)} V`, value: sim.voltageV };
      }
      return null;
    default:
      return null;
  }
}

/**
 * Renders one catalog component on the canvas. Every terminal is a single
 * handle that can both start and end a wire (React Flow runs in loose
 * connection mode, and the handle is marked connectable both ways), so wiring
 * is truly terminal-to-terminal in either direction.
 *
 * When live analyses are present the node shows a colour-coded border
 * (validation errors / warnings) and a small readout of its simulated state.
 */
export function ComponentNode({ id, data, selected }: NodeProps<ComponentNode>) {
  const meta = CATALOG[data.componentType];
  const name = data.props.name?.trim();
  const simResult = useCircuitStore((s) => s.simResult);
  const validation = useCircuitStore((s) => s.validation);

  const sim = simResult?.components.find((c) => c.nodeId === id);
  const validationErrors =
    validation?.findings.filter((f) => f.nodeId === id && f.severity === 'error').length ?? 0;
  const validationWarnings =
    validation?.findings.filter((f) => f.nodeId === id && f.severity === 'warning').length ?? 0;

  const readout = sim ? readoutFor(data.componentType, sim, data.props.state) : null;

  let borderCls = selected
    ? 'border-sky-500 shadow-md ring-2 ring-sky-400/40'
    : 'border-slate-300 dark:border-slate-600';
  if (validationErrors > 0 || sim?.status === 'tripped') {
    borderCls = selected
      ? 'border-red-500 ring-2 ring-red-400/40'
      : 'border-red-400 ring-1 ring-red-300/70 dark:border-red-500';
  } else if (validationWarnings > 0) {
    borderCls = selected
      ? 'border-amber-400 ring-2 ring-amber-300/40'
      : 'border-amber-400 ring-1 ring-amber-300/60 dark:border-amber-400';
  }

  return (
    <div
      data-testid="component-node"
      data-node-id={id}
      data-node-type={data.componentType}
      data-sim-status={sim?.status ?? ''}
      data-validation-error={validationErrors > 0 ? validationErrors : undefined}
      data-validation-warning={validationWarnings > 0 ? validationWarnings : undefined}
      style={{ width: meta.width }}
      className={`rounded-md border bg-white text-slate-800 shadow-sm transition-shadow dark:bg-slate-800 dark:text-slate-100 ${borderCls}`}
    >
      <div className="relative" style={{ height: meta.height }}>
        <div className="pointer-events-none absolute inset-0 text-slate-700 dark:text-slate-200">
          <SymbolView type={data.componentType} props={data.props} width={meta.width} height={meta.height} />
        </div>
        {meta.terminals.map((t) => {
          const side = t.x === 0 ? Position.Left : Position.Right;
          const style: React.CSSProperties = {
            ...handleStyle(t.y, t.x),
            ...HANDLE_BASE,
            background: ROLE_COLOR[t.role],
          };
          return (
            <div key={t.id}>
              <Handle
                id={`${t.id}${SRC_SUFFIX}`}
                type="source"
                position={side}
                style={style}
                isConnectableStart
                isConnectableEnd
                title={`${t.label} (${t.role})`}
              />
              {/* Role letter chip so the connection points are unmistakable */}
              <span
                data-testid="terminal-chip"
                className="pointer-events-none absolute flex select-none items-center justify-center rounded-full font-bold text-white"
                style={{
                  left: t.x === 0 ? t.x + 7 : meta.width - 16,
                  top: t.y - 5,
                  width: 10,
                  height: 10,
                  background: ROLE_COLOR[t.role],
                  fontSize: 7,
                  lineHeight: '10px',
                }}
              >
                {roleChar(t.role)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-200 px-1 pb-0.5 pt-0.5 text-center text-[10px] font-medium leading-tight dark:border-slate-700">
        {name || meta.label}
      </div>
      {readout && (
        <div
          data-testid="sim-readout"
          data-sim-value={readout.value ?? ''}
          className={`border-t px-1 py-px text-center text-[9px] font-semibold leading-tight ${
            sim?.status === 'tripped'
              ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400'
              : sim?.status === 'on'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'
                : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-400'
          }`}
          title={sim?.reason ?? undefined}
        >
          {readout.text}
        </div>
      )}
    </div>
  );
}
