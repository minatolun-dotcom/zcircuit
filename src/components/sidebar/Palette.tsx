import { CATEGORY_LABEL, paletteGroups } from '../library/catalog';
import { SymbolView } from '../library/symbols';
import { PALETTE_MIME, type PalettePayload } from '../../types/circuit';

export function Palette() {
  return (
    <aside
      className="panel-scroll flex w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      data-testid="component-palette"
    >
      <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Components
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">Drag onto the canvas</p>
      </div>
      {paletteGroups().map(({ category, items }) => (
        <section key={category} className="px-3 py-2">
          <h3 className="mb-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {CATEGORY_LABEL[category]}
          </h3>
          <ul className="space-y-1">
            {items.map((meta) => (
              <li key={meta.type}>
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  data-testid={`palette-item-${meta.type}`}
                  data-component-type={meta.type}
                  onDragStart={(e) => {
                    const payload: PalettePayload = { type: meta.type };
                    e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(payload));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  title={meta.blurb}
                  className="flex cursor-grab items-center gap-2 rounded-md border border-slate-200 px-1.5 py-1 text-slate-700 hover:border-sky-400 hover:bg-sky-50 active:cursor-grabbing dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-slate-800"
                >
                  <span className="shrink-0 text-slate-600 dark:text-slate-300">
                    <SymbolView type={meta.type} width={44} height={28} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{meta.label}</span>
                    <span className="block truncate text-[10px] text-slate-400 dark:text-slate-500">
                      {meta.blurb}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
