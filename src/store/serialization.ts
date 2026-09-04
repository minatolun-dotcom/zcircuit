import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, ComponentProps, ComponentType, WireEdge } from '../types/circuit';

export interface CircuitDocNode {
  id: string;
  type: 'component';
  position: { x: number; y: number };
  data: { componentType: ComponentType; props: ComponentProps };
}

export interface CircuitDocEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  data: { fromTerminal: string; toTerminal: string };
}

export interface CircuitDoc {
  app: 'zcircuit';
  version: 1;
  nodes: CircuitDocNode[];
  edges: CircuitDocEdge[];
}

export const CIRCUIT_DOC_VERSION = 1 as const;
export const STORAGE_KEY = 'zcircuit.circuit.v1';

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Strip runtime-only fields (selection, measurements) into a clean doc. */
export function serializeCircuit(nodes: ComponentNode[], edges: WireEdge[]): CircuitDoc {
  return {
    app: 'zcircuit',
    version: CIRCUIT_DOC_VERSION,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: 'component' as const,
      position: { x: n.position.x, y: n.position.y },
      data: {
        componentType: n.data.componentType,
        props: { ...n.data.props },
      },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      data: { fromTerminal: e.data?.fromTerminal ?? '', toTerminal: e.data?.toTerminal ?? '' },
    })),
  };
}

export type ParseResult =
  | { ok: true; nodes: ComponentNode[]; edges: WireEdge[] }
  | { ok: false; message: string };

export function parseCircuitDoc(text: string): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, message: 'Saved circuit is not valid JSON.' };
  }
  if (!doc || typeof doc !== 'object') return { ok: false, message: 'Saved circuit is empty.' };
  const d = doc as Partial<CircuitDoc>;
  if (d.app !== 'zcircuit' || d.version !== CIRCUIT_DOC_VERSION) {
    return { ok: false, message: 'Unsupported circuit file version.' };
  }
  if (!Array.isArray(d.nodes)) return { ok: false, message: 'Circuit file has no components.' };

  const nodes: ComponentNode[] = [];
  for (const raw of d.nodes as unknown[]) {
    const n = raw as Partial<CircuitDocNode>;
    const componentType = n.data?.componentType as ComponentType | undefined;
    const meta = componentType ? CATALOG[componentType] : undefined;
    if (!meta) continue; // unknown component -> drop
    if (
      typeof n.id !== 'string' ||
      !n.position ||
      !isFiniteNumber(n.position.x) ||
      !isFiniteNumber(n.position.y)
    ) {
      continue;
    }
    const props: ComponentProps = { ...meta.defaultProps, ...(n.data?.props ?? {}) };
    nodes.push({
      id: n.id,
      type: 'component',
      position: { x: n.position.x, y: n.position.y },
      data: { componentType: meta.type, props },
    });
  }
  if (nodes.length === 0) return { ok: false, message: 'Saved circuit has no usable components.' };

  const ids = new Set(nodes.map((n) => n.id));
  const edges: WireEdge[] = [];
  for (const raw of Array.isArray(d.edges) ? d.edges : []) {
    const e = raw as Partial<CircuitDocEdge>;
    if (
      typeof e.id !== 'string' ||
      typeof e.source !== 'string' ||
      typeof e.target !== 'string' ||
      !ids.has(e.source) ||
      !ids.has(e.target)
    ) {
      continue;
    }
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      type: 'wire',
      selectable: false,
      data: {
        fromTerminal: e.data?.fromTerminal ?? '',
        toTerminal: e.data?.toTerminal ?? '',
      },
    });
  }

  return { ok: true, nodes, edges };
}
