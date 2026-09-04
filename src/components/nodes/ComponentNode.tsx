import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ComponentNode } from '../../types/circuit';
import { ROLE_COLOR, SRC_SUFFIX } from '../../types/circuit';
import { CATALOG } from '../library/catalog';
import { SymbolView } from '../library/symbols';

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

/**
 * Renders one catalog component on the canvas. Every terminal is a single
 * handle that can both start and end a wire (React Flow runs in loose
 * connection mode, and the handle is marked connectable both ways), so wiring
 * is truly terminal-to-terminal in either direction.
 */
export function ComponentNode({ id, data, selected }: NodeProps<ComponentNode>) {
  const meta = CATALOG[data.componentType];
  const name = data.props.name?.trim();

  return (
    <div
      data-testid="component-node"
      data-node-id={id}
      data-node-type={data.componentType}
      style={{ width: meta.width }}
      className={`rounded-md border bg-white text-slate-800 shadow-sm transition-shadow dark:bg-slate-800 dark:text-slate-100 ${
        selected
          ? 'border-sky-500 shadow-md ring-2 ring-sky-400/40'
          : 'border-slate-300 dark:border-slate-600'
      }`}
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
            <Handle
              key={t.id}
              id={`${t.id}${SRC_SUFFIX}`}
              type="source"
              position={side}
              style={style}
              isConnectableStart
              isConnectableEnd
              title={`${t.label} (${t.role})`}
            />
          );
        })}
      </div>
      <div className="border-t border-slate-200 px-1 pb-0.5 pt-0.5 text-center text-[10px] font-medium leading-tight dark:border-slate-700">
        {name || meta.label}
      </div>
    </div>
  );
}
