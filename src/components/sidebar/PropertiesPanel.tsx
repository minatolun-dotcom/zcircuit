import { useCircuitStore } from '../../store/circuitStore';
import { ROLE_COLOR, type ComponentProps, type ComponentType } from '../../types/circuit';
import { CATALOG } from '../library/catalog';

const MCB_RATINGS = [6, 10, 16, 20, 32];
const INVERTER_SIZES = [500, 1000, 2000, 3000];

function NumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs outline-none focus:border-sky-400"
        />
        {unit && <span className="text-[10px] text-slate-400">{unit}</span>}
      </div>
    </label>
  );
}

function ToggleField({
  label,
  onLabel,
  offLabel,
  value,
  onChange,
}: {
  label: string;
  onLabel: string;
  offLabel: string;
  value: 'on' | 'off' | undefined;
  onChange: (v: 'on' | 'off') => void;
}) {
  return (
    <div>
      <span className="mb-0.5 block text-[11px] font-medium text-slate-500">{label}</span>
      <div className="grid grid-cols-2 gap-1" role="group">
        {(['on', 'off'] as const).map((state) => (
          <button
            key={state}
            type="button"
            data-state={state}
            onClick={() => onChange(state)}
            className={`rounded border px-1 py-0.5 text-[11px] ${
              value === state
                ? 'border-sky-400 bg-sky-50 font-semibold text-sky-700'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {state === 'on' ? onLabel : offLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function fieldsFor(type: ComponentType, props: ComponentProps, onChange: (p: ComponentProps) => void) {
  switch (type) {
    case 'mcb':
      return (
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-slate-500">Rated current</span>
          <select
            value={props.ratedCurrentA ?? 16}
            onChange={(e) => onChange({ ratedCurrentA: Number(e.target.value) })}
            className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs outline-none focus:border-sky-400"
          >
            {MCB_RATINGS.map((a) => (
              <option key={a} value={a}>
                {a} A
              </option>
            ))}
          </select>
        </label>
      );
    case 'switch':
      return (
        <ToggleField
          label="Switch position"
          onLabel="Closed"
          offLabel="Open"
          value={props.state ?? 'off'}
          onChange={(state) => onChange({ state })}
        />
      );
    case 'bulb':
    case 'fan':
      return (
        <NumberField
          label="Rated power"
          unit="W"
          value={props.wattageW}
          onChange={(wattageW) => onChange({ wattageW })}
        />
      );
    case 'inverter':
      return (
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-slate-500">Capacity</span>
          <select
            value={props.capacityVA ?? 1000}
            onChange={(e) => onChange({ capacityVA: Number(e.target.value) })}
            className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs outline-none focus:border-sky-400"
          >
            {INVERTER_SIZES.map((va) => (
              <option key={va} value={va}>
                {va} VA
              </option>
            ))}
          </select>
        </label>
      );
    case 'socket':
    case 'switchboard':
      return (
        <NumberField
          label="Rated voltage"
          unit="V"
          value={props.voltageV}
          onChange={(voltageV) => onChange({ voltageV })}
        />
      );
  }
}

export function PropertiesPanel() {
  const nodes = useCircuitStore((s) => s.nodes);
  const updateProps = useCircuitStore((s) => s.updateProps);

  const selected = nodes.filter((n) => n.selected);

  if (selected.length === 0) {
    return (
      <aside className="flex w-64 shrink-0 flex-col border-l border-slate-200 bg-white" data-testid="properties-panel">
        <div className="border-b border-slate-200 px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Properties</h2>
        </div>
        <p className="px-3 py-3 text-[11px] leading-relaxed text-slate-400">
          Select a component on the canvas to view and edit its properties.
        </p>
      </aside>
    );
  }

  const node = selected[selected.length - 1];
  const meta = CATALOG[node.data.componentType];
  const props = node.data.props;
  const change = (patch: ComponentProps) => updateProps(node.id, patch);

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white" data-testid="properties-panel">
      <div className="border-b border-slate-200 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Properties</h2>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div>
          <h3 className="text-sm font-semibold">{meta.label}</h3>
          <p className="text-[11px] text-slate-400">{meta.blurb}</p>
        </div>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-slate-500">Name</span>
          <input
            type="text"
            value={props.name ?? ''}
            placeholder={meta.label}
            onChange={(e) => change({ name: e.target.value })}
            className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs outline-none focus:border-sky-400"
          />
        </label>
        <NumberField label="Voltage" unit="V" value={props.voltageV} onChange={(voltageV) => change({ voltageV })} />
        {fieldsFor(meta.type, props, change)}
        <div>
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Terminals</span>
          <ul className="space-y-1">
            {meta.terminals.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: ROLE_COLOR[t.role] }}
                />
                <span className="font-medium">{t.label}</span>
                <span className="text-slate-400">
                  {t.role} · {t.kind}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
