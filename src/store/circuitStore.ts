import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { create } from 'zustand';
import { CATALOG } from '../components/library/catalog';
import type {
  ComponentNode,
  ComponentProps,
  ComponentType,
  WireEdge,
} from '../types/circuit';
import { terminalFromHandle } from '../types/circuit';
import { uid } from '../utils/uid';
import type { OptimizationReport } from '../engine/optimization';
import type { SimulationResult } from '../engine/simulation';
import type { ValidationReport } from '../engine/validation';
import { parseCircuitDoc, serializeCircuit, STORAGE_KEY } from './serialization';

const HISTORY_LIMIT = 50;

interface Snapshot {
  nodes: ComponentNode[];
  edges: WireEdge[];
}

interface CircuitState {
  nodes: ComponentNode[];
  edges: WireEdge[];
  /** Transient user-facing message (invalid connection, save/load, ...). */
  notice: string | null;

  // Undo / redo history ------------------------------------------------
  past: Snapshot[];
  future: Snapshot[];

  // Simulation state (consumed by the engine from Wave 3 onwards) -------
  simulationRunning: boolean;
  simulationSpeed: number;

  // Live analysis results (recomputed by useLiveAnalyses, never mutated by
  // the engines themselves) ----------------------------------------------
  simResult: SimulationResult | null;
  validation: ValidationReport | null;
  optimization: OptimizationReport | null;
  validationEnabled: boolean;
  optimizationEnabled: boolean;
  gridVisible: boolean;
  /** Oscilloscope drawer (Todo 9) - visible when running. */
  waveformOpen: boolean;

  addComponent: (type: ComponentType, position: { x: number; y: number }) => string;
  onNodesChange: (changes: NodeChange<ComponentNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WireEdge>[]) => void;
  /** Connect two terminals; returns false and sets a notice when the connection is invalid. */
  connect: (connection: Connection) => boolean;
  updateProps: (nodeId: string, patch: ComponentProps) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  /** Toggle a wire's selection (React Flow does not manage wire selection itself). */
  selectEdge: (edgeId: string, selected: boolean) => void;
  /** Called once when a node drag begins, so one undo reverts the whole move. */
  recordDrag: () => void;

  undo: () => void;
  redo: () => void;

  /** Start a fresh, empty circuit (clears history). */
  newCircuit: () => void;
  /** Replace the whole circuit (levels load their starters through this). */
  importCircuit: (nodes: ComponentNode[], edges: WireEdge[]) => void;
  /** Serialize the circuit into localStorage. */
  saveCircuit: () => void;
  /** Restore the circuit previously saved in localStorage. */
  loadCircuit: () => void;

  setSimulationRunning: (running: boolean) => void;
  setSimulationSpeed: (speed: number) => void;

  toggleValidation: () => void;
  toggleOptimization: () => void;
  toggleGrid: () => void;
  toggleWaveform: () => void;
  /** Select exactly one component (clears wire + other node selection). */
  selectNode: (nodeId: string | null) => void;

  setNotice: (message: string | null) => void;
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

/** Immutable push of the current state onto the undo stack (cap HISTORY_LIMIT). */
function withHistory(s: CircuitState): Pick<CircuitState, 'past' | 'future'> {
  return {
    past: [...s.past.slice(-(HISTORY_LIMIT - 1)), { nodes: s.nodes, edges: s.edges }],
    future: [],
  };
}

export const useCircuitStore = create<CircuitState>()((set, get) => ({
  nodes: [],
  edges: [],
  notice: null,
  past: [],
  future: [],
  simulationRunning: false,
  simulationSpeed: 1,
  simResult: null,
  validation: null,
  optimization: null,
  validationEnabled: false,
  optimizationEnabled: false,
  gridVisible: true,
  waveformOpen: false,

  setNotice: (message) => {
    if (noticeTimer) clearTimeout(noticeTimer);
    set({ notice: message });
    if (message) {
      noticeTimer = setTimeout(() => set({ notice: null }), 4000);
    }
  },

  addComponent: (type, position) => {
    const meta = CATALOG[type];
    const id = uid('n');
    const node: ComponentNode = {
      id,
      type: 'component',
      position,
      data: { componentType: type, props: { ...meta.defaultProps, name: '' } },
    };
    set((s) => ({ ...withHistory(s), nodes: [...s.nodes, node] }));
    return id;
  },

  onNodesChange: (changes) => {
    const removedIds = changes.filter((c) => c.type === 'remove').map((c) => c.id);
    const nodeSelected = changes.some((c) => c.type === 'select' && c.selected);
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes),
      edges: nodeSelected
        ? s.edges.map((e) => ({ ...e, selected: false }))
        : removedIds.length > 0
          ? s.edges.filter((e) => !removedIds.includes(e.source) && !removedIds.includes(e.target))
          : s.edges,
      // Record a single history entry for RF-originated deletions.
      ...(removedIds.length > 0 ? withHistory(s) : {}),
    }));
  },

  onEdgesChange: (changes) => {
    const removed = changes.some((c) => c.type === 'remove');
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges),
      ...(removed ? withHistory(s) : {}),
    }));
  },

  connect: (connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    const fromTerminal = terminalFromHandle(sourceHandle);
    const toTerminal = terminalFromHandle(targetHandle);

    if (!source || !target || !fromTerminal || !toTerminal) {
      get().setNotice('Connection is incomplete.');
      return false;
    }
    if (source === target) {
      get().setNotice('A wire must connect two different components.');
      return false;
    }
    const duplicates = get().edges.filter((e) => {
      const from = e.data?.fromTerminal ?? '';
      const to = e.data?.toTerminal ?? '';
      const a = [e.source, from].join('::');
      const b = [e.target, to].join('::');
      const c = [source, fromTerminal].join('::');
      const d = [target, toTerminal].join('::');
      return (a === c && b === d) || (a === d && b === c);
    });
    if (duplicates.length > 0) {
      get().setNotice('Those terminals are already connected.');
      return false;
    }

    const edge: WireEdge = {
      id: uid('e'),
      source,
      target,
      sourceHandle,
      targetHandle,
      type: 'wire',
      // Wire selection is handled by the app (see selectEdge), not React Flow.
      selectable: false,
      data: { fromTerminal, toTerminal },
    };
    set((s) => ({ ...withHistory(s), edges: addEdge(edge, s.edges) as WireEdge[] }));
    return true;
  },

  updateProps: (nodeId, patch) => {
    // Property edits are deliberately not part of undo history: they are
    // continuous form input, not discrete circuit actions.
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, props: { ...n.data.props, ...patch } } } : n,
      ),
    }));
  },

  deleteNode: (nodeId) => {
    set((s) => ({
      ...withHistory(s),
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
  },

  deleteEdge: (edgeId) => {
    set((s) => ({
      ...withHistory(s),
      edges: s.edges.filter((e) => e.id !== edgeId),
    }));
  },

  selectEdge: (edgeId, selected) => {
    set((s) => ({
      edges: s.edges.map((e) => (e.id === edgeId ? { ...e, selected } : e)),
      // Single-selection discipline: selecting a wire clears node selection.
      nodes: selected ? s.nodes.map((n) => ({ ...n, selected: false })) : s.nodes,
    }));
  },

  recordDrag: () => {
    set((s) => withHistory(s));
  },

  undo: () => {
    const s = get();
    if (s.past.length === 0) return;
    const previous = s.past[s.past.length - 1];
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      past: s.past.slice(0, -1),
      future: [...s.future.slice(-(HISTORY_LIMIT - 1)), { nodes: s.nodes, edges: s.edges }],
      notice: null,
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[s.future.length - 1];
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [...s.past.slice(-(HISTORY_LIMIT - 1)), { nodes: s.nodes, edges: s.edges }],
      future: s.future.slice(0, -1),
      notice: null,
    });
  },

  newCircuit: () => {
    set({
      nodes: [],
      edges: [],
      past: [],
      future: [],
      notice: null,
      simulationRunning: false,
      simResult: null,
      validation: null,
      optimization: null,
    });
    get().setNotice('New circuit started.');
  },

  saveCircuit: () => {
    const doc = serializeCircuit(get().nodes, get().edges);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      get().setNotice('Circuit saved to this browser.');
    } catch {
      get().setNotice('Could not save: storage unavailable.');
    }
  },

  importCircuit: (nodes, edges) => {
    set({
      nodes,
      edges,
      past: [],
      future: [],
      simulationRunning: false,
      simResult: null,
      validation: null,
      optimization: null,
      notice: null,
    });
  },

  loadCircuit: () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      get().setNotice('No saved circuit found.');
      return;
    }
    const parsed = parseCircuitDoc(raw);
    if (!parsed.ok) {
      get().setNotice(parsed.message);
      return;
    }
    get().importCircuit(parsed.nodes, parsed.edges);
    get().setNotice('Saved circuit loaded.');
  },

  setSimulationRunning: (running) => set({ simulationRunning: running }),
  setSimulationSpeed: (speed) =>
    set({ simulationSpeed: Math.min(8, Math.max(0.1, speed)) }),

  toggleValidation: () => set((s) => ({ validationEnabled: !s.validationEnabled })),
  toggleOptimization: () => set((s) => ({ optimizationEnabled: !s.optimizationEnabled })),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleWaveform: () => set((s) => ({ waveformOpen: !s.waveformOpen })),
  selectNode: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, selected: n.id === nodeId })),
      edges: s.edges.map((e) => ({ ...e, selected: false })),
    })),
}));
