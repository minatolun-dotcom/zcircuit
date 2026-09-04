import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, WireEdge } from '../types/circuit';
import { terminalFromHandle } from '../types/circuit';
import { analyzeCircuit } from '../engine/optimization';
import type { OptimizationReport } from '../engine/optimization';
import { recommendGauge } from '../engine/optimization';
import { EPS, simulateCircuit } from '../engine/simulation';
import type { SimulationResult } from '../engine/simulation';
import { validateCircuit } from '../engine/validation';
import type { ValidationReport } from '../engine/validation';
import {
  DEFAULT_WARNING_ALLOWANCE,
  DEFAULT_WIRE_BUDGET_PX,
  type LevelDef,
  type LevelResult,
  type Objective,
  type ObjectiveResult,
  type StarCheck,
} from './types';

/**
 * Level judge (PLAN.md Part 2). Pure function: evaluateLevel(nodes, edges,
 * level, opts) asserts the level's objectives against the Playground's own
 * engines (simulation / validation / optimization), which are recomputed here
 * only when the caller does not supply them (the live HUD passes the cached
 * reports). Never mutates state; never throws on missing starter components -
 * a deleted target fails its objective with an explanatory detail.
 *
 * Electrical assertions reuse engine semantics exactly: 'powered'/'off'/'tripped'
 * read ComponentSim.status, 'energized' reads the socket status, gauge sizing
 * uses the optimizer's IEC 60228 picker, and path-based checks ('switchControls',
 * 'protectedBy') trace terminal connectivity with a Union-Find that mirrors the
 * validation engine's conductor-only nets (wires + closed devices + busbars).
 */

/* ---------------------------------------------------------------------------
 * Terminal connectivity (mirrors validation.ts NetUnion)
 * ------------------------------------------------------------------------- */

class NetUnion {
  private parent = new Map<string, string>();

  add(key: string): void {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  find(key: string): string {
    let root = this.parent.get(key) ?? key;
    while (this.parent.get(root) !== root) {
      const next = this.parent.get(root) as string;
      this.parent.set(root, next);
      root = next;
    }
    this.parent.set(key, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

const key = (nodeId: string, terminal: string): string => `${nodeId}:${terminal}`;

interface CircuitView {
  nodeById: Map<string, ComponentNode>;
  sim: SimulationResult;
  validation: ValidationReport;
  optimization: OptimizationReport;
  /** Root terminal net for (nodeId, terminal). */
  rootOf: (nodeId: string, terminal: string) => string;
}

function buildView(
  nodes: ComponentNode[],
  edges: WireEdge[],
  opts: {
    sim?: SimulationResult;
    validation?: ValidationReport;
    optimization?: OptimizationReport;
  },
): CircuitView {
  const sim = opts.sim ?? simulateCircuit(nodes, edges);
  const validation = opts.validation ?? validateCircuit(nodes, edges, sim);
  const optimization = opts.optimization ?? analyzeCircuit(nodes, edges, sim);

  const net = new NetUnion();
  for (const n of nodes) {
    for (const t of CATALOG[n.data.componentType].terminals) net.add(key(n.id, t.id));
  }
  for (const e of edges) {
    const from = e.data?.fromTerminal ?? terminalFromHandle(e.sourceHandle);
    const to = e.data?.toTerminal ?? terminalFromHandle(e.targetHandle);
    if (!from || !to) continue;
    net.union(key(e.source, from), key(e.target, to));
  }
  for (const n of nodes) {
    const meta = CATALOG[n.data.componentType];
    if (meta.type === 'switchboard') {
      for (const [a, b] of [
        ['l-in', 'way-1-l'],
        ['l-in', 'way-2-l'],
        ['n-in', 'n-out'],
        ['pe-in', 'pe-out'],
      ] as const) {
        net.union(key(n.id, a), key(n.id, b));
      }
    } else if ((meta.type === 'mcb' || meta.type === 'switch') && n.data.props.state !== 'off') {
      net.union(key(n.id, 'l-in'), key(n.id, 'l-out'));
    }
  }

  return {
    nodeById: new Map(nodes.map((n) => [n.id, n])),
    sim,
    validation,
    optimization,
    rootOf: (nodeId: string, terminal: string) => net.find(key(nodeId, terminal)),
  };
}

/* ---------------------------------------------------------------------------
 * Objective evaluation
 * ------------------------------------------------------------------------- */

const labelOf = (view: CircuitView, nodeId: string): string => {
  const n = view.nodeById.get(nodeId);
  if (!n) return 'That component';
  return CATALOG[n.data.componentType].label;
};

/** Edges touching a component (either end). */
function edgesTouching(edges: WireEdge[], nodeId: string): WireEdge[] {
  return edges.filter((e) => e.source === nodeId || e.target === nodeId);
}

function evaluateObjective(view: CircuitView, edges: WireEdge[], obj: Objective): ObjectiveResult {
  const { sim, validation, optimization } = view;
  const fail = (detail: string): ObjectiveResult => ({ ref: obj, pass: false, detail });
  const pass = (detail: string): ObjectiveResult => ({ ref: obj, pass: true, detail });

  switch (obj.kind) {
    case 'powered': {
      const c = sim.components.find((x) => x.nodeId === obj.nodeId);
      if (!c) return fail(`${labelOf(view, obj.nodeId)} was removed - restart the level.`);
      return c.status === 'on'
        ? pass(`${labelOf(view, obj.nodeId)} is powered.`)
        : fail(`${labelOf(view, obj.nodeId)} is not powered - check its live and neutral connections.`);
    }
    case 'off': {
      const c = sim.components.find((x) => x.nodeId === obj.nodeId);
      if (!c) return fail(`${labelOf(view, obj.nodeId)} was removed - restart the level.`);
      return c.status === 'off'
        ? pass(`${labelOf(view, obj.nodeId)} is off.`)
        : fail(`${labelOf(view, obj.nodeId)} should be off - look for the fault.`);
    }
    case 'tripped': {
      const c = sim.components.find((x) => x.nodeId === obj.nodeId);
      if (!c) return fail(`${labelOf(view, obj.nodeId)} was removed - restart the level.`);
      return c.status === 'tripped'
        ? pass(`${labelOf(view, obj.nodeId)} tripped on overload - protection works.`)
        : fail(`${labelOf(view, obj.nodeId)} has not tripped - overload the circuit past its rating.`);
    }
    case 'noTrips':
      return sim.trippedMcbIds.length === 0
        ? pass('No circuit breaker has tripped.')
        : fail(`The circuit is overloaded - ${sim.trippedMcbIds.length} breaker(s) tripped.`);
    case 'energized': {
      const n = view.nodeById.get(obj.nodeId);
      const c = sim.components.find((x) => x.nodeId === obj.nodeId);
      if (!n || !c) return fail(`${labelOf(view, obj.nodeId)} was removed - restart the level.`);
      if (n.data.componentType !== 'socket') return fail(`${labelOf(view, obj.nodeId)} is not a socket.`);
      return c.status === 'on'
        ? pass(`Socket is energized (L-N loop live).`)
        : fail(`Socket is not energized - it needs a live L and N supply.`);
    }
    case 'wired': {
      const exists = edges.some(
        (e) =>
          (e.source === obj.from && e.target === obj.to) ||
          (e.source === obj.to && e.target === obj.from),
      );
      return exists
        ? pass(`${labelOf(view, obj.from)} and ${labelOf(view, obj.to)} are wired together.`)
        : fail(`Wire ${labelOf(view, obj.from)} -> ${labelOf(view, obj.to)} is missing.`);
    }
    case 'noFindings': {
      const count =
        obj.severity === undefined
          ? validation.counts.error
          : validation.counts[obj.severity];
      return count === 0
        ? pass(
            obj.severity === undefined
              ? 'No validation errors.'
              : `No ${obj.severity}-level validation findings.`,
          )
        : fail(
            obj.severity === undefined
              ? `${count} validation error(s) remain - inspect the highlighted components.`
              : `${count} ${obj.severity}-level finding(s) remain.`,
          );
    }
    case 'currentUnder': {
      const c = sim.components.find((x) => x.nodeId === obj.nodeId);
      if (!c) return fail(`${labelOf(view, obj.nodeId)} was removed - restart the level.`);
      return c.currentA < obj.maxA
        ? pass(`${labelOf(view, obj.nodeId)} draws ${c.currentA.toFixed(2)} A (< ${obj.maxA} A).`)
        : fail(`${labelOf(view, obj.nodeId)} draws ${c.currentA.toFixed(2)} A - must stay under ${obj.maxA} A.`);
    }
    case 'wireLengthUnder': {
      const total = optimization.metrics.totalWirePx;
      return total <= obj.maxPx
        ? pass(`Total wire length ${Math.round(total)} px (budget ${obj.maxPx} px).`)
        : fail(`Total wire length ${Math.round(total)} px exceeds the ${obj.maxPx} px budget - bring components closer.`);
    }
    case 'gaugeAtLeast': {
      const n = view.nodeById.get(obj.nodeId);
      if (!n) return fail(`${labelOf(view, obj.nodeId)} was removed - restart the level.`);
      if (n.data.componentType !== 'mcb') return fail(`Gauge checks apply to an MCB branch.`);
      const wiredIn = edgesTouching(edges, obj.nodeId).length >= 2;
      if (!wiredIn) return fail(`The MCB is not wired into the circuit.`);
      const rating = n.data.props.ratedCurrentA ?? 16;
      const gauge = recommendGauge(rating);
      return gauge.sizeMm2 >= obj.sizeMm2
        ? pass(`The ${rating} A branch sizes to ${gauge.sizeMm2} mm² (>= ${obj.sizeMm2} mm²).`)
        : fail(`The ${rating} A branch only needs ${gauge.sizeMm2} mm² - the level asks for ${obj.sizeMm2} mm² or more.`);
    }
    case 'componentCount': {
      const len = view.nodeById.size;
      const boundsOk =
        (obj.atLeast === undefined || len >= obj.atLeast) &&
        (obj.exact === undefined || len === obj.exact);
      const want =
        obj.exact !== undefined
          ? `exactly ${obj.exact}`
          : `at least ${obj.atLeast}`;
      return boundsOk
        ? pass(`Canvas has ${len} component(s) (${want}).`)
        : fail(`Canvas has ${len} component(s) - the level wants ${want}.`);
    }
    case 'switchControls': {
      const load = sim.components.find((x) => x.nodeId === obj.loadNodeId);
      if (!load) return fail(`${labelOf(view, obj.loadNodeId)} was removed - restart the level.`);
      if (load.status !== 'on') return fail(`${labelOf(view, obj.loadNodeId)} is not powered yet.`);
      const controlled = sim.components.some(
        (c) =>
          c.type === 'switch' &&
          c.status === 'on' &&
          c.currentA >= EPS &&
          view.rootOf(c.nodeId, 'l-out') === view.rootOf(obj.loadNodeId, 'l-in'),
      );
      return controlled
        ? pass(`${labelOf(view, obj.loadNodeId)} is controlled by a live switch.`)
        : fail(`${labelOf(view, obj.loadNodeId)} needs a switch on its live conductor to be controlled.`);
    }
    case 'protectedBy': {
      const load = sim.components.find((x) => x.nodeId === obj.loadNodeId);
      if (!load) return fail(`${labelOf(view, obj.loadNodeId)} was removed - restart the level.`);
      const protected_ = sim.components.some(
        (c) =>
          c.type === 'mcb' &&
          c.status === 'on' &&
          c.currentA >= EPS &&
          view.rootOf(c.nodeId, 'l-out') === view.rootOf(obj.loadNodeId, 'l-in'),
      );
      return protected_
        ? pass(`${labelOf(view, obj.loadNodeId)} is protected by a live MCB.`)
        : fail(`${labelOf(view, obj.loadNodeId)} must be fed through a closed MCB.`);
    }
    case 'warningsUnder': {
      const warnings = optimization.suggestions.filter((s) => s.priority === 'warning').length;
      return warnings <= obj.max
        ? pass(`Optimization warnings: ${warnings} (allowed ${obj.max}).`)
        : fail(`${warnings} optimization warning(s) - more than the ${obj.max} allowed.`);
    }
    case 'all': {
      const results = obj.items.map((item) => evaluateObjective(view, edges, item));
      const failed = results.filter((r) => !r.pass);
      return failed.length === 0
        ? pass('All sub-objectives met.')
        : fail(`${failed.length} sub-objective(s) not met yet.`);
    }
    case 'any': {
      const results = obj.items.map((item) => evaluateObjective(view, edges, item));
      const ok = results.find((r) => r.pass);
      return ok
        ? pass('One of the alternatives is met.')
        : fail('None of the alternatives are met yet.');
    }
  }
}

/* ---------------------------------------------------------------------------
 * Entry point + star logic
 * ------------------------------------------------------------------------- */

export function evaluateLevel(
  nodes: ComponentNode[],
  edges: WireEdge[],
  level: LevelDef,
  opts: {
    sim?: SimulationResult;
    validation?: ValidationReport;
    optimization?: OptimizationReport;
    hintsUsed?: number;
  } = {},
): LevelResult {
  const view = buildView(nodes, edges, opts);
  const objectives = level.objectives.map((obj) => evaluateObjective(view, edges, obj));

  const passed = objectives.length > 0 && objectives.every((o) => o.pass);
  const hintsUsed = opts.hintsUsed ?? 0;
  const budget = level.par?.wireBudgetPx ?? DEFAULT_WIRE_BUDGET_PX;
  const allowance = level.par?.warningAllowance ?? DEFAULT_WARNING_ALLOWANCE;
  const totalWirePx = view.optimization.metrics.totalWirePx;
  const warnings = view.optimization.suggestions.filter((s) => s.priority === 'warning').length;

  const starChecks: StarCheck[] = [
    {
      star: 1,
      pass: passed,
      reason: passed ? 'All objectives met.' : `${objectives.filter((o) => !o.pass).length} objective(s) remain.`,
    },
    {
      star: 2,
      pass: passed && view.validation.counts.error === 0,
      reason:
        view.validation.counts.error === 0
          ? 'No validation errors.'
          : `${view.validation.counts.error} validation error(s) - fix them for the second star.`,
    },
    {
      star: 3,
      pass:
        passed &&
        view.validation.counts.error === 0 &&
        hintsUsed === 0 &&
        totalWirePx <= budget &&
        warnings <= allowance,
      reason: [
        hintsUsed === 0 ? null : 'Hints were used.',
        totalWirePx <= budget ? null : `Wire length ${Math.round(totalWirePx)} px exceeds the ${budget} px par.`,
        warnings <= allowance ? null : `${warnings} optimization warning(s) exceed the ${allowance} par.`,
      ]
        .filter(Boolean)
        .join(' '),
    },
  ];
  const stars = starChecks.filter((s) => s.pass).length as 0 | 1 | 2 | 3;

  return { levelId: level.id, passed, objectives, stars, starChecks };
}