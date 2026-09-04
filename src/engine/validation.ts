import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, WireEdge } from '../types/circuit';
import { terminalFromHandle } from '../types/circuit';
import { simulateCircuit } from './simulation';
import type { SimulationResult } from './simulation';

/**
 * Circuit validation pipeline (Todo 6). Runs as a pure function over
 * (nodes, edges, props) and never mutates circuit state; callers re-run it
 * whenever the canvas changes (reactive, never blocks the simulation loop).
 *
 * Electrical model used here matches the simulation conventions:
 *  - terminals joined by wires, plus closed switch/MCB contacts and the
 *    switchboard internal buses, form conductor-only nets (Union-Find);
 *  - a source stamps its L / N (and the switchboard its PE) pole onto the net
 *    its terminal belongs to;
 *  - a net carrying more than one pole is a dead short (L joined to N or PE
 *    with no load in between - loads are NOT conductors, so a working L->load->N
 *    path never merges poles);
 *  - endpoint semantics: socket outlets, spare switchboard ways and open
 *    switches are valid open terminals. A "floating wire" is a wire whose far
 *    end attaches to nothing (missing component / terminal), never a designed
 *    open endpoint.
 *
 * KCL/KVL are enforced by construction inside the MNA core (its rows are KCL
 * equations and its source rows KVL equations), so no tolerance-sensitive
 * re-derivation is needed here; the pipeline audits the solver output for
 * numeric sanity and power conservation (supplied == consumed within ~1e-6).
 */

export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationCode =
  | 'SHORT_CIRCUIT'
  | 'FLOATING_WIRE'
  | 'SELF_CONNECTION'
  | 'DUPLICATE_CONNECTION'
  | 'ROLE_MISMATCH'
  | 'INCOMPLETE_LOAD'
  | 'MISSING_EARTH'
  | 'UNPROTECTED_CIRCUIT'
  | 'NO_POWER_SOURCE'
  | 'POWER_BALANCE';

export interface ValidationFinding {
  id: string;
  code: ValidationCode;
  severity: ValidationSeverity;
  message: string;
  /** Component this finding refers to (for canvas highlighting). */
  nodeId?: string;
  terminalId?: string;
  edgeId?: string;
}

export interface ValidationReport {
  ok: boolean;
  findings: ValidationFinding[];
  counts: Record<ValidationSeverity, number>;
}

/** Relative/absolute tolerance used by the numeric audits (~1e-6). */
export const TOLERANCE = 1e-6;

const POLE_NAME: Record<'L' | 'N' | 'PE', string> = {
  L: 'live',
  N: 'neutral',
  PE: 'earth',
};

function isSwitchable(type: string): boolean {
  return type === 'mcb' || type === 'switch';
}

function isLoad(type: string): boolean {
  return type === 'bulb' || type === 'fan';
}

/* ---------------------------------------------------------------------------
 * Small Union-Find over terminal keys
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

function terminalKey(nodeId: string, terminal: string): string {
  return `${nodeId}:${terminal}`;
}

/* ---------------------------------------------------------------------------
 * Validation
 * ------------------------------------------------------------------------- */

export function validateCircuit(
  nodes: ComponentNode[],
  edges: WireEdge[],
  sim?: SimulationResult,
): ValidationReport {
  const findings: ValidationFinding[] = [];
  const counts: Record<ValidationSeverity, number> = { error: 0, warning: 0, info: 0 };
  const addFinding = (f: Omit<ValidationFinding, 'id'>) => {
    counts[f.severity] += 1;
    findings.push({ id: `f${findings.length + 1}`, ...f });
  };

  if (nodes.length === 0) return { ok: true, findings, counts };

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const net = new NetUnion();
  for (const n of nodes) {
    for (const t of CATALOG[n.data.componentType].terminals) {
      net.add(terminalKey(n.id, t.id));
    }
  }

  // --- Connection integrity pass ------------------------------------------
  const seenPairs = new Set<string>();
  const validEdges: WireEdge[] = [];
  for (const e of edges) {
    const from = e.data?.fromTerminal ?? terminalFromHandle(e.sourceHandle);
    const to = e.data?.toTerminal ?? terminalFromHandle(e.targetHandle);
    const nodeA = nodeById.get(e.source);
    const nodeB = nodeById.get(e.target);

    if (!nodeA || !nodeB) {
      // Far end attaches to nothing - a floating/broken wire.
      addFinding({
        code: 'FLOATING_WIRE',
        severity: 'warning',
        message: `Wire "${e.id}" connects to a component that is not on the canvas.`,
        edgeId: e.id,
      });
      continue;
    }
    const termA = CATALOG[nodeA.data.componentType].terminals.find((t) => t.id === from);
    const termB = CATALOG[nodeB.data.componentType].terminals.find((t) => t.id === to);
    if (!termA || !termB) {
      addFinding({
        code: 'FLOATING_WIRE',
        severity: 'warning',
        message: `Wire "${e.id}" attaches to a terminal that does not exist (${from ?? '?'} / ${to ?? '?'}).`,
        edgeId: e.id,
      });
      continue;
    }
    if (e.source === e.target) {
      addFinding({
        code: 'SELF_CONNECTION',
        severity: 'error',
        message: `${CATALOG[nodeA.data.componentType].label} is connected to itself; wires must join two different components.`,
        nodeId: e.source,
        edgeId: e.id,
      });
      continue;
    }
    const pairKey = [terminalKey(e.source, from), terminalKey(e.target, to)].sort().join('|');
    if (seenPairs.has(pairKey)) {
      addFinding({
        code: 'DUPLICATE_CONNECTION',
        severity: 'warning',
        message: `Two wires connect the same pair of terminals; the duplicate is redundant.`,
        edgeId: e.id,
      });
      continue;
    }
    seenPairs.add(pairKey);
    validEdges.push(e);
    net.union(terminalKey(e.source, from), terminalKey(e.target, to));
  }

  // --- Conductor-only nets (wires + closed devices + busbars) --------------
  for (const n of nodes) {
    const meta = CATALOG[n.data.componentType];
    if (meta.type === 'switchboard') {
      // L bus ties all L ways; N and PE buses tie their own rails.
      for (const [a, b] of [
        ['l-in', 'way-1-l'],
        ['l-in', 'way-2-l'],
        ['n-in', 'n-out'],
        ['pe-in', 'pe-out'],
      ] as const) {
        net.union(terminalKey(n.id, a), terminalKey(n.id, b));
      }
    } else if (isSwitchable(meta.type) && n.data.props.state !== 'off') {
      // A closed switch/MCB is a conductor between its two terminals.
      net.union(terminalKey(n.id, 'l-in'), terminalKey(n.id, 'l-out'));
    }
  }

  const rootOf = (nodeId: string, terminal: string): string =>
    net.find(terminalKey(nodeId, terminal));

  // --- Source poles on nets -------------------------------------------------
  // pole -> set of net roots carrying it; root -> set of poles on that root.
  const polesOnRoot = new Map<string, Set<'L' | 'N' | 'PE'>>();
  const addPole = (root: string, pole: 'L' | 'N' | 'PE') => {
    let set = polesOnRoot.get(root);
    if (!set) {
      set = new Set();
      polesOnRoot.set(root, set);
    }
    set.add(pole);
  };
  const sourceOwners: { owner: string; plus: string; minus: string; pe?: string }[] = [];
  for (const n of nodes) {
    const meta = CATALOG[n.data.componentType];
    if (meta.type === 'switchboard') {
      sourceOwners.push({ owner: n.id, plus: 'l-in', minus: 'n-in', pe: 'pe-in' });
    } else if (meta.type === 'inverter' && n.data.props.state !== 'off') {
      sourceOwners.push({ owner: n.id, plus: 'out-l', minus: 'out-n' });
    }
  }
  for (const s of sourceOwners) {
    addPole(rootOf(s.owner, s.plus), 'L');
    addPole(rootOf(s.owner, s.minus), 'N');
    if (s.pe) addPole(rootOf(s.owner, s.pe), 'PE');
  }
  const hasAnyPole = polesOnRoot.size > 0;

  // Nets that contain an open switch/MCB terminal or an off inverter's output
  // (a designed "off" cut - loads behind it are intentionally de-energized).
  const openDeviceRoots = new Set<string>();
  for (const n of nodes) {
    const meta = CATALOG[n.data.componentType];
    const isOffCut =
      (isSwitchable(meta.type) && n.data.props.state === 'off') ||
      (meta.type === 'inverter' && n.data.props.state === 'off');
    if (!isOffCut) continue;
    for (const t of meta.terminals) {
      openDeviceRoots.add(rootOf(n.id, t.id));
    }
  }
  const netHasOpenDevice = (root: string): boolean => openDeviceRoots.has(root);

  // --- Dead shorts: a net carrying two or more different poles -------------
  const shortedRoots = new Set<string>();
  for (const [root, poles] of polesOnRoot) {
    if (poles.size < 2) continue;
    shortedRoots.add(root);
    const names = [...poles].map((p) => POLE_NAME[p]);
    const scope = sourceOwners.find(
      (s) => rootOf(s.owner, s.plus) === root || rootOf(s.owner, s.minus) === root || (s.pe && rootOf(s.owner, s.pe) === root),
    );
    addFinding({
      code: 'SHORT_CIRCUIT',
      severity: 'error',
      message: `${names[0][0].toUpperCase()}${names[0].slice(1)} and ${names.slice(1).join(' and ')} are joined directly with no load between them - short circuit.`,
      nodeId: scope?.owner,
    });
  }

  // --- Terminal role vs net polarity ---------------------------------------
  for (const n of nodes) {
    const meta = CATALOG[n.data.componentType];
    for (const t of meta.terminals) {
      const root = rootOf(n.id, t.id);
      const poles = polesOnRoot.get(root);
      if (!poles || poles.size !== 1) continue; // isolated (0) or shorted (>=2)
      const pole = [...poles][0];
      if (pole === t.role) continue;
      addFinding({
        code: 'ROLE_MISMATCH',
        severity: 'error',
        message: `${meta.label} ${t.label.toLowerCase()} terminal sits on a ${POLE_NAME[pole]} net; ${POLE_NAME[t.role]} should only connect to ${POLE_NAME[t.role]} wiring.`,
        nodeId: n.id,
        terminalId: t.id,
      });
    }
  }

  const mcbCount = nodes.filter((n) => n.data.componentType === 'mcb').length;

  /** Does any load/socket on this canvas see the live pole at its L terminal? */
  const hasLiveEndpoint = (): boolean => {
    for (const n of nodes) {
      if (!isLoad(n.data.componentType) && n.data.componentType !== 'socket') continue;
      const t = CATALOG[n.data.componentType].terminals.find((x) => x.role === 'L');
      if (!t) continue;
      if (polesOnRoot.get(rootOf(n.id, t.id))?.has('L')) return true;
    }
    return false;
  };

  // --- Power-dependent checks ----------------------------------------------
  if (hasAnyPole) {
    // No overcurrent protection anywhere on a powered circuit.
    if (mcbCount === 0 && hasLiveEndpoint()) {
      addFinding({
        code: 'UNPROTECTED_CIRCUIT',
        severity: 'warning',
        message: `This circuit has no MCB - add overcurrent protection on the live feed.`,
      });
    }

    // Incomplete loads: a side that reaches no pole and no designed open cut.
    for (const n of nodes) {
      if (!isLoad(n.data.componentType)) continue;
      const meta = CATALOG[n.data.componentType];
      const missing: string[] = [];
      for (const t of meta.terminals) {
        const root = rootOf(n.id, t.id);
        const poles = polesOnRoot.get(root);
        if (!poles && !netHasOpenDevice(root)) {
          missing.push(t.label.toLowerCase());
        }
      }
      if (missing.length > 0) {
        addFinding({
          code: 'INCOMPLETE_LOAD',
          severity: 'warning',
          message: `${meta.label} is not connected on its ${missing.join(' and ')} side${missing.length > 1 ? 's' : ''} - the circuit will not power it.`,
          nodeId: n.id,
        });
      }
    }

    // Protective earth on energized sockets (3-pin outlets must be earthed).
    for (const n of nodes) {
      if (n.data.componentType !== 'socket') continue;
      const lPoles = polesOnRoot.get(rootOf(n.id, 'l-in'));
      const nPoles = polesOnRoot.get(rootOf(n.id, 'n-in'));
      const energized =
        rootOf(n.id, 'l-in') !== rootOf(n.id, 'n-in') &&
        lPoles?.has('L') === true &&
        nPoles?.has('N') === true;
      if (!energized) continue;
      const pePoles = polesOnRoot.get(rootOf(n.id, 'pe-in'));
      if (!pePoles?.has('PE')) {
        addFinding({
          code: 'MISSING_EARTH',
          severity: 'warning',
          message: `Socket is energized but its earth (PE) terminal is not connected to the switchboard PE bus - protective earth is required.`,
          nodeId: n.id,
          terminalId: 'pe-in',
        });
      }
    }
  } else if (edges.length > 0) {
    addFinding({
      code: 'NO_POWER_SOURCE',
      severity: 'warning',
      message: `Nothing is powered: no switchboard or live inverter is connected to the circuit.`,
    });
  }

  // --- Numeric audit of the solver output (KCL/KVL hold by construction;
  //     this guards power conservation and float sanity) ---------------------
  const result = sim ?? simulateCircuit(nodes, validEdges);
  const isFinite = (v: number) => Number.isFinite(v) && v >= -TOLERANCE;
  for (const c of result.components) {
    if (!isFinite(c.currentA) || !isFinite(c.voltageV) || !isFinite(c.powerW)) {
      addFinding({
        code: 'POWER_BALANCE',
        severity: 'error',
        message: `${CATALOG[c.type].label} produced a non-finite result (${c.currentA} A, ${c.voltageV} V) - numerical error in the solve.`,
        nodeId: c.nodeId,
      });
    }
  }
  const supplied = result.components
    .filter((c) => c.status === 'on' && (c.type === 'switchboard' || c.type === 'inverter'))
    .reduce((sum, c) => sum + c.powerW, 0);
  const consumed = result.components
    .filter((c) => c.status === 'on' && !(c.type === 'switchboard' || c.type === 'inverter'))
    .reduce((sum, c) => sum + c.powerW, 0);
  if (supplied > TOLERANCE) {
    const scale = Math.max(supplied, consumed, 1);
    if (Math.abs(supplied - consumed) > TOLERANCE * scale) {
      addFinding({
        code: 'POWER_BALANCE',
        severity: 'error',
        message: `Power conservation violated: sources deliver ${supplied.toFixed(3)} W but loads consume ${consumed.toFixed(3)} W.`,
      });
    }
  }

  return { ok: counts.error === 0, findings, counts };
}
