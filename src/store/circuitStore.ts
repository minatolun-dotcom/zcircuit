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

interface CircuitState {
  nodes: ComponentNode[];
  edges: WireEdge[];
  /** Transient user-facing message (invalid connection, hint, ...). */
  notice: string | null;

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
  setNotice: (message: string | null) => void;
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

export const useCircuitStore = create<CircuitState>()((set, get) => ({
  nodes: [],
  edges: [],
  notice: null,

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
    set((s) => ({ nodes: [...s.nodes, node] }));
    return id;
  },

  onNodesChange: (changes) => {
    const removedIds = changes
      .filter((c) => c.type === 'remove')
      .map((c) => c.id);
    // Single-selection discipline: selecting a node clears wire selection.
    const nodeSelected = changes.some((c) => c.type === 'select' && c.selected);
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes),
      edges: nodeSelected
        ? s.edges.map((e) => ({ ...e, selected: false }))
        : removedIds.length > 0
          ? s.edges.filter(
              (e) => !removedIds.includes(e.source) && !removedIds.includes(e.target),
            )
          : s.edges,
    }));
  },

  onEdgesChange: (changes) => {
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
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
    set((s) => ({ edges: addEdge(edge, s.edges) as WireEdge[] }));
    return true;
  },

  updateProps: (nodeId, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, props: { ...n.data.props, ...patch } } } : n,
      ),
    }));
  },

  deleteNode: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
  },

  deleteEdge: (edgeId) => {
    set((s) => ({ edges: s.edges.filter((e) => e.id !== edgeId) }));
  },

  selectEdge: (edgeId, selected) => {
    set((s) => ({
      edges: s.edges.map((e) => (e.id === edgeId ? { ...e, selected } : e)),
      // Single-selection discipline: selecting a wire clears node selection.
      nodes: selected ? s.nodes.map((n) => ({ ...n, selected: false })) : s.nodes,
    }));
  },
}));
