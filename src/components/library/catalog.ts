import type { ComponentType, ComponentTypeMeta, PaletteCategoryId } from '../../types/circuit';

const CATEGORY_ORDER: PaletteCategoryId[] = [
  'protection',
  'controls',
  'lighting',
  'power',
  'auxiliary',
];

export const CATEGORY_LABEL: Record<PaletteCategoryId, string> = {
  protection: 'Protection',
  controls: 'Controls',
  lighting: 'Lighting',
  power: 'Power',
  auxiliary: 'Auxiliary',
};

/**
 * Catalogue of the seven IEC 60617-style practice components.
 *
 * Terminals are authored in px inside a fixed box of `width` x `height` and sit
 * on the box border so wires start/end cleanly at the node edge.
 */
export const CATALOG: Record<ComponentType, ComponentTypeMeta> = {
  mcb: {
    type: 'mcb',
    label: 'MCB',
    width: 110,
    height: 64,
    category: 'protection',
    blurb: 'Miniature circuit breaker (single-pole)',
    defaultProps: { name: '', ratedCurrentA: 16, voltageV: 230, state: 'on' },
    terminals: [
      { id: 'l-in', label: 'L in', role: 'L', kind: 'input', x: 0, y: 32 },
      { id: 'l-out', label: 'L out', role: 'L', kind: 'output', x: 110, y: 32 },
    ],
  },
  switch: {
    type: 'switch',
    label: 'Switch',
    width: 110,
    height: 64,
    category: 'controls',
    blurb: 'Single-pole switch',
    defaultProps: { name: '', voltageV: 230, state: 'off' },
    terminals: [
      { id: 'l-in', label: 'L in', role: 'L', kind: 'input', x: 0, y: 32 },
      { id: 'l-out', label: 'L out', role: 'L', kind: 'output', x: 110, y: 32 },
    ],
  },
  bulb: {
    type: 'bulb',
    label: 'Bulb',
    width: 110,
    height: 64,
    category: 'lighting',
    blurb: 'Incandescent / LED lamp',
    defaultProps: { name: '', wattageW: 60, voltageV: 230 },
    terminals: [
      { id: 'l-in', label: 'L in', role: 'L', kind: 'input', x: 0, y: 32 },
      { id: 'n-out', label: 'N out', role: 'N', kind: 'output', x: 110, y: 32 },
    ],
  },
  fan: {
    type: 'fan',
    label: 'Fan',
    width: 110,
    height: 64,
    category: 'power',
    blurb: 'Ceiling / pedestal fan (single-phase motor)',
    defaultProps: { name: '', wattageW: 75, voltageV: 230 },
    terminals: [
      { id: 'l-in', label: 'L in', role: 'L', kind: 'input', x: 0, y: 32 },
      { id: 'n-out', label: 'N out', role: 'N', kind: 'output', x: 110, y: 32 },
    ],
  },
  inverter: {
    type: 'inverter',
    label: 'Inverter',
    width: 140,
    height: 72,
    category: 'power',
    blurb: 'UPS / solar inverter (mains + battery)',
    defaultProps: { name: '', capacityVA: 1000, voltageV: 230, state: 'on' },
    terminals: [
      { id: 'ac-l-in', label: 'L in', role: 'L', kind: 'input', x: 0, y: 18 },
      { id: 'ac-n-in', label: 'N in', role: 'N', kind: 'input', x: 0, y: 54 },
      { id: 'out-l', label: 'L out', role: 'L', kind: 'output', x: 140, y: 18 },
      { id: 'out-n', label: 'N out', role: 'N', kind: 'output', x: 140, y: 54 },
    ],
  },
  switchboard: {
    type: 'switchboard',
    label: 'Switchboard',
    width: 150,
    height: 88,
    category: 'power',
    blurb: 'Distribution board with L/N buses',
    defaultProps: { name: '', ways: 2, voltageV: 230 },
    terminals: [
      { id: 'l-in', label: 'L bus in', role: 'L', kind: 'input', x: 0, y: 24 },
      { id: 'n-in', label: 'N bus in', role: 'N', kind: 'input', x: 0, y: 66 },
      { id: 'way-1-l', label: 'Way 1 L', role: 'L', kind: 'output', x: 150, y: 16 },
      { id: 'way-2-l', label: 'Way 2 L', role: 'L', kind: 'output', x: 150, y: 40 },
      { id: 'n-out', label: 'N bus out', role: 'N', kind: 'output', x: 150, y: 66 },
    ],
  },
  socket: {
    type: 'socket',
    label: 'Socket',
    width: 110,
    height: 76,
    category: 'power',
    blurb: 'Socket / docket outlet (3-pin)',
    defaultProps: { name: '', voltageV: 230 },
    terminals: [
      { id: 'l-in', label: 'L in', role: 'L', kind: 'input', x: 0, y: 16 },
      { id: 'n-in', label: 'N in', role: 'N', kind: 'input', x: 0, y: 38 },
      { id: 'pe-in', label: 'PE in', role: 'PE', kind: 'input', x: 0, y: 60 },
    ],
  },
};

export const COMPONENT_TYPES = Object.keys(CATALOG) as ComponentType[];

/** Ordered (type, meta) pairs per palette category, skipping empty categories. */
export function paletteGroups(): { category: PaletteCategoryId; items: ComponentTypeMeta[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: COMPONENT_TYPES.filter((t) => CATALOG[t].category === category).map((t) => CATALOG[t]),
  })).filter((group) => group.items.length > 0);
}
