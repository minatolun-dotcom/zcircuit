import type { Edge, Node } from '@xyflow/react';

/** The seven electrical components supported by the practice library. */
export type ComponentType = 'mcb' | 'switch' | 'bulb' | 'fan' | 'inverter' | 'switchboard' | 'socket';

/** IEC-context terminal roles. Used for colour coding now and polarity/ground validation later. */
export type TerminalRole = 'L' | 'N' | 'PE';

/** Semantics of a terminal with respect to current flow. Informational in Wave 1;
 *  the simulation engine (Todo 5) and validation (Todo 6) consume these roles. */
export type TerminalKind = 'input' | 'output' | 'bidirectional';

export type PaletteCategoryId = 'protection' | 'controls' | 'lighting' | 'power' | 'auxiliary';

export interface TerminalDef {
  /** Id unique within the component, e.g. `'l-in'`. */
  id: string;
  label: string;
  role: TerminalRole;
  kind: TerminalKind;
  /** Terminal anchor in px, relative to the node box origin (top-left). */
  x: number;
  y: number;
}

/** Editable electrical properties shown in the properties panel. */
export interface ComponentProps {
  /** User-editable name, e.g. "Kitchen lights". */
  name?: string;
  /** Rated current in A (MCB). */
  ratedCurrentA?: number;
  /** Rated/operating voltage in V. */
  voltageV?: number;
  /** Rated power in W (bulb/fan loads). */
  wattageW?: number;
  /** Continuous power capacity in VA (inverter). */
  capacityVA?: number;
  /** Open/closed for switches and MCB; mains/battery mode for inverter. */
  state?: 'on' | 'off';
  /** Number of outgoing ways (switchboard). */
  ways?: number;
}

export interface ComponentTypeMeta {
  type: ComponentType;
  /** Display name shown in the palette and under the node. */
  label: string;
  /** Fixed node box size in px. Symbol and terminals are authored in this box. */
  width: number;
  height: number;
  category: PaletteCategoryId;
  blurb: string;
  defaultProps: ComponentProps;
  terminals: TerminalDef[];
}

/** Data carried by every React Flow node that represents a component. */
export type ComponentNodeData = {
  componentType: ComponentType;
  props: ComponentProps;
};

export type ComponentNode = Node<ComponentNodeData, 'component'>;

/** Terminal ids (node-scoped) captured when the wire was drawn. */
export type WireEdgeData = {
  fromTerminal: string;
  toTerminal: string;
};

export type WireEdge = Edge<WireEdgeData, 'wire'>;

/** Data payload placed on the clipboard during palette drag-and-drop. */
export type PalettePayload = { type: ComponentType };

export const PALETTE_MIME = 'application/x-zcircuit-component';

/** A handle id is node-scoped inside React Flow, so only the terminal id is needed. */
export const SRC_SUFFIX = '::src';
export const TGT_SUFFIX = '::tgt';

export function terminalFromHandle(handle: string | null | undefined): string {
  return handle?.replace(SRC_SUFFIX, '').replace(TGT_SUFFIX, '') ?? '';
}

/** Colour coding per IEC conductor convention (L brown, N blue, PE green/yellow). */
export const ROLE_COLOR: Record<TerminalRole, string> = {
  L: '#b45309',
  N: '#2563eb',
  PE: '#15803d',
};

export const ROLE_LABEL: Record<TerminalRole, string> = {
  L: 'Line (L)',
  N: 'Neutral (N)',
  PE: 'Earth (PE)',
};
