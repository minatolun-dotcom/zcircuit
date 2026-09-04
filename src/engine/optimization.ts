import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, WireEdge } from '../types/circuit';
import { terminalFromHandle } from '../types/circuit';
import { orthogonalPath, type Pt, type Rect } from './routing';
import { simulateCircuit } from './simulation';
import type { SimulationResult } from './simulation';

/**
 * Wiring-optimization engine (Todo 7). Pure and advisory only - it never
 * mutates circuit state and never auto-applies a change; every suggestion is
 * ranked (warning before info) and the UI lets the user apply or dismiss it.
 *
 * Checks mirror the renderer's geometry so findings match what is on canvas:
 * wire paths are re-derived with the same A* router over the same obstacles,
 * and conductors are sized against IEC 60228 copper sizes (1.5/2.5/4/6 mm²)
 * using conservative IEC 60364 ampacities - never AWG.
 *
 * Rule of thumb used for gauge: a conductor is sized so its ampacity covers
 * the *design current* of its circuit - the MCB rating when one protects the
 * branch (the breaker caps the current), otherwise the connected load current
 * with a 1.25 x safety margin for continuous resistive loads.
 */

export type SuggestionPriority = 'critical' | 'warning' | 'info';
export type SuggestionCode =
  | 'OVERLOAD_BRANCH'
  | 'CROSSING'
  | 'GAUGE'
  | 'LONG_WIRE'
  | 'UNSWITCHED_LOAD';

export interface OptimizationSuggestion {
  id: string;
  code: SuggestionCode;
  priority: SuggestionPriority;
  title: string;
  detail: string;
  /** Components involved (for canvas highlighting / user decision). */
  nodeIds?: string[];
  edgeIds?: string[];
}

export interface WireMetric {
  edgeId: string;
  source: string;
  target: string;
  /** Routed orthogonal length in px. */
  lengthPx: number;
  /** Minimum possible orthogonal length (Manhattan) between the terminals. */
  idealPx: number;
}

export interface OptimizationMetrics {
  wireCount: number;
  /** Sum of every routed wire length in px (for the docket). */
  totalWirePx: number;
  longestWirePx: number;
  /** Distinct pairs of wires whose routed runs cross. */
  crossingCount: number;
}

export interface OptimizationReport {
  suggestions: OptimizationSuggestion[];
  metrics: OptimizationMetrics;
}

/* ---------------------------------------------------------------------------
 * IEC 60228 conductor sizes with conservative copper ampacity
 * (PVC insulation, two loaded conductors, reference method C, 30 °C).
 * ------------------------------------------------------------------------- */

export interface ConductorSize {
  sizeMm2: number;
  /** Safe carrying capacity in A. */
  ampacityA: number;
}

export const IEC_60228_SIZES: ConductorSize[] = [
  { sizeMm2: 1.5, ampacityA: 17.5 },
  { sizeMm2: 2.5, ampacityA: 24 },
  { sizeMm2: 4, ampacityA: 32 },
  { sizeMm2: 6, ampacityA: 41 },
];

export interface GaugeChoice {
  sizeMm2: number;
  label: string;
  ampacityA: number;
  /** False when even the largest size in scope cannot carry the current. */
  adequate: boolean;
  /** designCurrent / ampacity of the chosen size (<=1 while adequate). */
  utilization: number;
}

/**
 * Smallest IEC 60228 size whose ampacity covers `designCurrentA`. The caller
 * passes the design current (MCB rating, or load current x margin) so the
 * choice always keeps an adequate ampacity margin.
 */
export function recommendGauge(designCurrentA: number): GaugeChoice {
  for (const s of IEC_60228_SIZES) {
    if (s.ampacityA >= designCurrentA) {
      return { sizeMm2: s.sizeMm2, label: `${s.sizeMm2} mm²`, ampacityA: s.ampacityA, adequate: true, utilization: designCurrentA / s.ampacityA };
    }
  }
  const last = IEC_60228_SIZES[IEC_60228_SIZES.length - 1];
  return { sizeMm2: last.sizeMm2, label: `${last.sizeMm2} mm²`, ampacityA: last.ampacityA, adequate: false, utilization: designCurrentA / last.ampacityA };
}

/* ---------------------------------------------------------------------------
 * Geometry (mirrors WireEdge's rendering inputs)
 * ------------------------------------------------------------------------- */

const PRIORITY_ORDER: Record<SuggestionPriority, number> = { critical: 0, warning: 1, info: 2 };

function nodeBox(n: ComponentNode): Rect {
  const meta = CATALOG[n.data.componentType];
  return {
    x: n.position.x,
    y: n.position.y,
    width: n.measured?.width ?? meta.width,
    height: n.measured?.height ?? meta.height + 16,
  };
}

function terminalAnchor(n: ComponentNode, terminalId: string): Pt | null {
  const t = CATALOG[n.data.componentType].terminals.find((x) => x.id === terminalId);
  if (!t) return null;
  return { x: n.position.x + t.x, y: n.position.y + t.y };
}

/** Route one wire exactly like WireEdge does (same obstacles, same router). */
function routeEdge(edge: WireEdge, nodeById: Map<string, ComponentNode>): Pt[] | null {
  const from = edge.data?.fromTerminal ?? terminalFromHandle(edge.sourceHandle);
  const to = edge.data?.toTerminal ?? terminalFromHandle(edge.targetHandle);
  const nodeA = nodeById.get(edge.source);
  const nodeB = nodeById.get(edge.target);
  if (!nodeA || !nodeB || !from || !to) return null;
  const a = terminalAnchor(nodeA, from);
  const b = terminalAnchor(nodeB, to);
  if (!a || !b) return null;
  const obstacles = [...nodeById.values()]
    .filter((n) => n.id !== edge.source && n.id !== edge.target)
    .map(nodeBox);
  return orthogonalPath(a, b, obstacles);
}

function pathLength(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return len;
}

interface Segment {
  a: Pt;
  b: Pt;
}

function toSegments(points: Pt[]): Segment[] {
  const segs: Segment[] = [];
  for (let i = 1; i < points.length; i++) segs.push({ a: points[i - 1], b: points[i] });
  return segs;
}

const EPS = 1e-6;

/** Interior intersection of a horizontal run with a vertical run, if any. */
function runIntersection(h: Segment, v: Segment): Pt | null {
  const hMinX = Math.min(h.a.x, h.b.x);
  const hMaxX = Math.max(h.a.x, h.b.x);
  const vMinY = Math.min(v.a.y, v.b.y);
  const vMaxY = Math.max(v.a.y, v.b.y);
  const x = v.a.x;
  const y = h.a.y;
  const onH = x > hMinX + EPS && x < hMaxX - EPS;
  const onV = y > vMinY + EPS && y < vMaxY - EPS;
  return onH && onV ? { x, y } : null;
}

function wiresCross(p1: Pt[], p2: Pt[]): boolean {
  const endpoints = new Set<string>();
  for (const p of [...p1, ...p2]) endpoints.add(`${Math.round(p.x)},${Math.round(p.y)}`);
  for (const s1 of toSegments(p1)) {
    for (const s2 of toSegments(p2)) {
      const h = s1.a.y === s1.b.y ? s1 : s2;
      const v = h === s1 ? s2 : s1;
      if (h.a.y !== h.b.y || v.a.x !== v.b.x) continue; // parallel runs: skip
      const hit = runIntersection(h, v);
      if (!hit) continue;
      // A shared vertex is a junction (wires fanning from one terminal),
      // not a crossing over another conductor.
      if (endpoints.has(`${Math.round(hit.x)},${Math.round(hit.y)}`)) continue;
      return true;
    }
  }
  return false;
}

/* ---------------------------------------------------------------------------
 * Entry point
 * ------------------------------------------------------------------------- */

/** Longest routed run (px) that triggers a shorten-wire suggestion. */
export const LONG_WIRE_MIN_PX = 400;
/** Breaker current / rating ratio above which a branch is reported overloaded. */
export const OVERLOAD_RATIO = 0.8;
/** Continuous-load safety margin used when no MCB caps the branch current. */
export const LOAD_MARGIN = 1.25;

export function analyzeCircuit(
  nodes: ComponentNode[],
  edges: WireEdge[],
  sim?: SimulationResult,
): OptimizationReport {
  const suggestions: OptimizationSuggestion[] = [];
  const push = (s: Omit<OptimizationSuggestion, 'id'>) => {
    suggestions.push({ id: `s${suggestions.length + 1}`, ...s });
  };

  const result = sim ?? simulateCircuit(nodes, edges);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  /* ---- Geometry pass ------------------------------------------------------ */
  const routed = new Map<string, { pts: Pt[]; edge: WireEdge }>();
  for (const e of edges) {
    const pts = routeEdge(e, nodeById);
    if (pts && pts.length > 1) routed.set(e.id, { pts, edge: e });
  }

  const metrics: OptimizationMetrics = {
    wireCount: routed.size,
    totalWirePx: 0,
    longestWirePx: 0,
    crossingCount: 0,
  };
  const wiresById = new Map<string, { pts: Pt[]; lengthPx: number; idealPx: number }>();

  for (const [id, { pts, edge }] of routed) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    const lengthPx = pathLength(pts);
    const idealPx = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    wiresById.set(id, { pts, lengthPx, idealPx });
    metrics.totalWirePx += lengthPx;
    metrics.longestWirePx = Math.max(metrics.longestWirePx, lengthPx);

    if (lengthPx >= LONG_WIRE_MIN_PX) {
      push({
        code: 'LONG_WIRE',
        priority: 'info',
        title: 'Very long wire',
        detail: `Wire "${id}" runs ${Math.round(lengthPx)} px - keep the components closer together to shorten the run.`,
        nodeIds: [edge.source, edge.target],
        edgeIds: [id],
      });
    }
  }

  // Distinct pairs of wires whose runs cross each other.
  const crossingPairs: [string, string][] = [];
  const ids = [...wiresById.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (wiresCross(wiresById.get(ids[i])!.pts, wiresById.get(ids[j])!.pts)) {
        crossingPairs.push([ids[i], ids[j]]);
      }
    }
  }
  metrics.crossingCount = crossingPairs.length;
  if (crossingPairs.length > 0) {
    push({
      code: 'CROSSING',
      priority: 'warning',
      title: 'Wires cross each other',
      detail: `${crossingPairs.length} pair${crossingPairs.length === 1 ? '' : 's'} of wires cross: ${crossingPairs
        .map(([a, b]) => `${a} × ${b}`)
        .join(', ')}. Move the components apart to reduce crossings.`,
      edgeIds: [...new Set(crossingPairs.flat())],
    });
  }

  /* ---- Power distribution: overloaded branches --------------------------- */
  const simByNode = new Map(result.components.map((c) => [c.nodeId, c]));
  for (const n of nodes) {
    if (n.data.componentType !== 'mcb') continue;
    const rating = n.data.props.ratedCurrentA ?? 16;
    const sim = simByNode.get(n.id);
    const closed = n.data.props.state !== 'off';
    const wired = edges.some((e) => e.source === n.id || e.target === n.id);
    if (!closed || !wired || !sim || sim.status !== 'on' || sim.currentA < EPS) continue;
    const utilization = sim.currentA / rating;
    if (utilization >= OVERLOAD_RATIO) {
      push({
        code: 'OVERLOAD_BRANCH',
        priority: 'warning',
        title: 'Branch close to its MCB rating',
        detail: `Branch draws ${sim.currentA.toFixed(1)} A - ${Math.round(utilization * 100)}% of the ${rating} A MCB rating. Split the load across another way or upsize the breaker.`,
        nodeIds: [n.id],
      });
    }
  }

  /* ---- Gauge selection (per protected branch / unprotected feed) ---------- */
  const branchIsUsed = (n: ComponentNode): boolean => {
    const touches = (termId: string): boolean =>
      edges.some((e) => {
        const t = e.data?.fromTerminal ?? terminalFromHandle(e.sourceHandle);
        const u = e.data?.toTerminal ?? terminalFromHandle(e.targetHandle);
        return (e.source === n.id && t === termId) || (e.target === n.id && u === termId);
      });
    return touches('l-in') && touches('l-out');
  };
  for (const n of nodes) {
    if (n.data.componentType !== 'mcb' || !branchIsUsed(n)) continue;
    const rating = n.data.props.ratedCurrentA ?? 16;
    const g = recommendGauge(rating);
    push({
      code: 'GAUGE',
      priority: 'info',
      title: `Conductor size for the ${rating} A circuit`,
      detail: `Branch protected at ${rating} A needs at least ${g.label} (ampacity ${g.ampacityA} A, utilisation ${Math.round(g.utilization * 100)}%)${g.adequate ? '' : ' - exceeds the sizes in scope'}.`,
      nodeIds: [n.id],
    });
  }

  // No MCB anywhere: size the feed for the connected load current x margin.
  const mcbCount = nodes.filter((n) => n.data.componentType === 'mcb').length;
  if (mcbCount === 0) {
    const loadCurrent = Math.max(
      0,
      ...result.components
        .filter((c) => (c.type === 'bulb' || c.type === 'fan') && c.status === 'on')
        .map((c) => c.currentA),
    );
    if (loadCurrent > EPS) {
      const design = loadCurrent * LOAD_MARGIN;
      const g = recommendGauge(design);
      push({
        code: 'GAUGE',
        priority: 'info',
        title: 'Conductor size for the unprotected feed',
        detail: `No MCB protects this circuit (draws up to ${loadCurrent.toFixed(1)} A); size the feed at ${design.toFixed(1)} A (1.25 x margin) -> at least ${g.label} (ampacity ${g.ampacityA} A).`,
      });
    }
  }

  /* ---- Best-practice tips ------------------------------------------------- */
  const loadsOn = result.components.some(
    (c) => (c.type === 'bulb' || c.type === 'fan') && c.status === 'on',
  );
  const anySwitchConducting = result.components.some(
    (c) => c.type === 'switch' && c.status === 'on' && c.currentA >= EPS,
  );
  if (loadsOn && !anySwitchConducting) {
    push({
      code: 'UNSWITCHED_LOAD',
      priority: 'info',
      title: 'Add a switch for manual control',
      detail: `A light or fan is powered directly - put a single-pole switch on its live conductor so it can be turned off without pulling the MCB.`,
    });
  }

  suggestions.sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  return { suggestions, metrics };
}
