import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, ComponentProps, ComponentType, WireEdge } from '../types/circuit';
import { solveNetwork } from './mna';
import type { NetworkSolution } from './mna';

/**
 * Steady-state resistive (RMS-equivalent) simulation of house-wiring circuits.
 * See PLAN.md "Simulation & component modeling conventions":
 *  - mains is modelled as an ideal 230 V RMS single-phase source per L-N loop
 *    (the exactness argument: for purely resistive loads this equals a phasor
 *    solve, so no complex arithmetic is needed in v1);
 *  - loads are resistive (R = V²/P); closed switches/MCBs are small conductors;
 *  - an MCB opens when |I_rms| exceeds its rating and reports the reason;
 *  - the PE rail never carries current; each solved block uses the first
 *    source's minus (neutral) terminal as its 0 V datum.
 *
 * The pure numeric core lives in ./mna.ts; this module maps components and
 * wires onto that core's stamps (Union-Find over terminals joined by wires).
 */

export const MAINS_VOLTAGE = 230;
/** Resistance of a closed switch/MCB contact, kept tiny but non-zero. */
export const CONTACT_RESISTANCE = 1e-3;
/** Current tolerance (A) used when deciding whether a load is powered. */
export const EPS = 1e-6;
/** Upper bound on the MCB trip/re-solve loop. */
const MAX_TRIP_ITERATIONS = 10;
/** A socket is "energized" when more than this many volts sit across L-N. */
const ENERGIZED_THRESHOLD_V = 0.5;

export interface ComponentSim {
  nodeId: string;
  type: ComponentType;
  /** on = carrying/supplying power, off = open or unpowered, tripped = MCB opened. */
  status: 'on' | 'off' | 'tripped';
  /** RMS current magnitude through the device (A). */
  currentA: number;
  /** RMS voltage across the device terminals (V). */
  voltageV: number;
  /** Real power (W). */
  powerW: number;
  /** Always 1.0 for the resistive models in scope (see upgrade seam in plan). */
  powerFactor: number;
  /** Set when an MCB tripped on overload. */
  reason?: string;
}

export interface SimulationResult {
  /** False when the circuit shows a modelling anomaly or a tripped breaker. */
  ok: boolean;
  /** Human-readable summary for the notice bar. */
  message: string;
  components: ComponentSim[];
  trippedMcbIds: string[];
  /** Number of power sources feeding the circuit (switchboards, live inverters). */
  sourceCount: number;
  warnings: string[];
}

/** A component modelled as a conductor between two electrical nodes. */
interface DeviceStamp {
  owner: string;
  a: string;
  b: string;
  g: number;
  kind: 'mcb' | 'switch' | 'load';
}

/* ---------------------------------------------------------------------------
 * Union-Find over terminal keys (componentNodeId:terminalId)
 * ------------------------------------------------------------------------- */

class UnionFind {
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
 * Modelling helpers
 * ------------------------------------------------------------------------- */

/** Equivalent resistance of a rated load at its rated voltage (R = V²/P). */
function deviceResistance(props: ComponentProps): number | null {
  const wattage = props.wattageW;
  const voltage = props.voltageV ?? MAINS_VOLTAGE;
  if (!wattage || wattage <= 0 || !(voltage > 0)) return null;
  return (voltage * voltage) / wattage;
}

function emptySolution(): NetworkSolution {
  return { voltages: {}, currents: new Map(), sourceCurrents: new Map(), solvedNodes: new Set() };
}

/* ---------------------------------------------------------------------------
 * Entry point
 * ------------------------------------------------------------------------- */

export function simulateCircuit(nodes: ComponentNode[], edges: WireEdge[]): SimulationResult {
  const warnings: string[] = [];
  const byId = new Map<string, ComponentNode>(nodes.map((n) => [n.id, n]));

  const components: ComponentSim[] = nodes.map((n) => ({
    nodeId: n.id,
    type: n.data.componentType,
    status: 'off',
    currentA: 0,
    voltageV: 0,
    powerW: 0,
    powerFactor: 1,
  }));

  if (nodes.length === 0) {
    return {
      ok: true,
      message: 'Canvas is empty.',
      components,
      trippedMcbIds: [],
      sourceCount: 0,
      warnings,
    };
  }

  // 1) Electrical nodes: terminals joined by wires (+ switchboard busbars).
  const uf = new UnionFind();
  for (const n of nodes) {
    for (const t of CATALOG[n.data.componentType].terminals) {
      uf.add(terminalKey(n.id, t.id));
    }
  }
  for (const e of edges) {
    const from = e.data?.fromTerminal;
    const to = e.data?.toTerminal;
    if (!from || !to) continue;
    uf.union(terminalKey(e.source, from), terminalKey(e.target, to));
  }
  // Switchboard internal buses: L-in ties all L ways; N-in ties the N bus out.
  for (const n of nodes) {
    if (n.data.componentType !== 'switchboard') continue;
    uf.union(terminalKey(n.id, 'l-in'), terminalKey(n.id, 'way-1-l'));
    uf.union(terminalKey(n.id, 'l-in'), terminalKey(n.id, 'way-2-l'));
    uf.union(terminalKey(n.id, 'n-in'), terminalKey(n.id, 'n-out'));
  }
  const rootOf = (key: string): string => uf.find(key);
  const nodeRoot = (nodeId: string, terminal: string): string =>
    uf.find(terminalKey(nodeId, terminal));

  // 2) Build the stamps from the component models.
  const devices: DeviceStamp[] = [];
  const sources: { plus: string; minus: string; voltage: number; owner: string }[] = [];
  const shortedSourceOwners = new Set<string>();
  /** Closed MCBs, in the order they may trip (rated current per device). */
  const mcbCandidates: { id: string; ratingA: number }[] = [];

  const shortCircuitWarn = (nodeId: string, what: string) => {
    shortedSourceOwners.add(nodeId);
    warnings.push(`${CATALOG[byId.get(nodeId)!.data.componentType].label} ${what} is short-circuited (L and N joined).`);
  };

  for (const n of nodes) {
    const meta = CATALOG[n.data.componentType];
    const props = n.data.props;
    const key = (t: string) => rootOf(terminalKey(n.id, t));

    switch (n.data.componentType) {
      case 'mcb':
      case 'switch': {
        if (props.state !== 'off') {
          const a = key('l-in');
          const b = key('l-out');
          if (a !== b) {
            devices.push({ owner: n.id, a, b, g: 1 / CONTACT_RESISTANCE, kind: n.data.componentType });
            if (n.data.componentType === 'mcb') {
              mcbCandidates.push({ id: n.id, ratingA: props.ratedCurrentA ?? 16 });
            }
          }
        }
        break;
      }
      case 'bulb':
      case 'fan': {
        const r = deviceResistance(props);
        if (r === null) {
          warnings.push(`${meta.label} has no usable wattage and is treated as an open circuit.`);
          break;
        }
        const a = key('l-in');
        const b = key('n-out');
        if (a !== b) devices.push({ owner: n.id, a, b, g: 1 / r, kind: 'load' });
        break;
      }
      case 'switchboard': {
        const plus = key('l-in');
        const minus = key('n-in');
        if (plus === minus) shortCircuitWarn(n.id, 'supply');
        else sources.push({ plus, minus, voltage: MAINS_VOLTAGE, owner: n.id });
        break;
      }
      case 'inverter': {
        // v1 model: a live inverter behaves as an ideal 230 V source on its output.
        if (props.state !== 'off') {
          const plus = key('out-l');
          const minus = key('out-n');
          if (plus === minus) shortCircuitWarn(n.id, 'output');
          else sources.push({ plus, minus, voltage: MAINS_VOLTAGE, owner: n.id });
        }
        break;
      }
      case 'socket':
        // Endpoint only: no stamp; it carries whatever its wiring provides.
        break;
    }
  }

  // 3) Solve with an MCB trip loop: reopen overloaded breakers and re-solve
  //    until a full iteration opens nothing new.
  const openMcbIds = new Set<string>();
  const trips: { id: string; currentA: number; ratingA: number }[] = [];
  let solution = emptySolution();

  for (let iter = 0; iter < MAX_TRIP_ITERATIONS; iter++) {
    const active = devices
      .filter((d) => !(d.kind === 'mcb' && openMcbIds.has(d.owner)))
      .map((d) => ({ a: d.a, b: d.b, g: d.g, owner: d.owner }));
    solution = solveNetwork(active, sources);

    let openedAny = false;
    for (const mcb of mcbCandidates) {
      if (openMcbIds.has(mcb.id)) continue;
      const current = Math.abs(solution.currents.get(mcb.id) ?? 0);
      if (current > mcb.ratingA + EPS) {
        openMcbIds.add(mcb.id);
        trips.push({ id: mcb.id, currentA: current, ratingA: mcb.ratingA });
        openedAny = true;
      }
    }
    if (!openedAny) break;
  }

  // 4) Report per-component results from the final (converged) solution.
  const V = (nodeId: string, terminal: string): number =>
    solution.voltages[nodeRoot(nodeId, terminal)] ?? 0;
  /** Raw potential difference across two terminals (floating sides read 0).
   *  Used for open devices: the side behind an open contact legitimately reads
   *  the bus potential difference across the gap. */
  const across = (nodeId: string, t1: string, t2: string): number =>
    Math.abs(V(nodeId, t1) - V(nodeId, t2));
  /** Potential of a terminal, or null when it is not part of a solved block. */
  const solvedPotential = (nodeId: string, terminal: string): number | null => {
    const root = nodeRoot(nodeId, terminal);
    return solution.solvedNodes.has(root) ? (solution.voltages[root] ?? 0) : null;
  };
  /** Voltage across two terminals, or null when either side is floating
   *  (not part of a solved network) - used to avoid implying power where no
   *  closed loop exists. */
  const acrossSolved = (nodeId: string, t1: string, t2: string): number | null => {
    const v1 = solvedPotential(nodeId, t1);
    const v2 = solvedPotential(nodeId, t2);
    if (v1 === null || v2 === null) return null;
    return Math.abs(v1 - v2);
  };
  const simOf = (id: string): ComponentSim => components.find((c) => c.nodeId === id)!;

  for (const n of nodes) {
    const meta = CATALOG[n.data.componentType];
    const props = n.data.props;
    const sim = simOf(n.id);

    switch (n.data.componentType) {
      case 'mcb':
      case 'switch': {
        const contactVoltage = across(n.id, meta.terminals[0].id, meta.terminals[1].id);
        if (trips.some((t) => t.id === n.id)) {
          const trip = trips.find((t) => t.id === n.id)!;
          sim.status = 'tripped';
          sim.voltageV = contactVoltage;
          sim.reason = `overload ${trip.currentA.toFixed(1)} A > ${trip.ratingA} A rating`;
        } else if (props.state === 'off') {
          sim.status = 'off';
          sim.voltageV = contactVoltage;
        } else {
          const i = Math.abs(solution.currents.get(n.id) ?? 0);
          sim.status = 'on';
          sim.currentA = i;
          sim.voltageV = contactVoltage;
          sim.powerW = contactVoltage * i;
        }
        break;
      }
      case 'bulb':
      case 'fan': {
        const i = Math.abs(solution.currents.get(n.id) ?? 0);
        const v = acrossSolved(n.id, meta.terminals[0].id, meta.terminals[1].id) ?? 0;
        sim.currentA = i;
        sim.voltageV = v;
        sim.powerW = v * i;
        sim.status = i >= EPS ? 'on' : 'off';
        break;
      }
      case 'switchboard':
      case 'inverter': {
        const isSource = sources.some((s) => s.owner === n.id);
        const isShorted = shortedSourceOwners.has(n.id);
        if (isSource && !isShorted) {
          sim.status = 'on';
          sim.currentA = Math.abs(solution.sourceCurrents.get(n.id) ?? 0);
          sim.voltageV = MAINS_VOLTAGE;
          sim.powerW = sim.voltageV * sim.currentA;
        } else {
          sim.status = 'off';
          sim.voltageV = isShorted ? 0 : MAINS_VOLTAGE;
        }
        break;
      }
      case 'socket': {
        // Energized only when both pins sit in the solved network (a real
        // L-N loop); an L-only socket reports off even though its L pin is hot.
        const v = acrossSolved(n.id, 'l-in', 'n-in');
        sim.voltageV = v ?? 0;
        sim.status = v !== null && v > ENERGIZED_THRESHOLD_V ? 'on' : 'off';
        break;
      }
    }
  }

  // 5) Summary message + health.
  const activeLoads = components.filter(
    (c) => (c.type === 'bulb' || c.type === 'fan') && c.currentA >= EPS,
  ).length;
  const energizedSockets = components.filter(
    (c) => c.type === 'socket' && c.status === 'on',
  ).length;
  const parts: string[] = [];
  if (trips.length > 0) parts.push(`${trips.length} MCB${trips.length === 1 ? '' : 's'} tripped`);
  if (sources.length === 0) parts.push('no power source');
  if (activeLoads > 0) {
    parts.push(`${activeLoads} ${activeLoads === 1 ? 'load' : 'loads'} powered`);
  } else if (energizedSockets > 0) {
    parts.push(`${energizedSockets} ${energizedSockets === 1 ? 'socket' : 'sockets'} energized`);
  } else if (nodes.length > 0) {
    parts.push('no load powered');
  }
  const message = parts.join(' · ');

  return {
    ok: warnings.length === 0 && trips.length === 0,
    message,
    components,
    trippedMcbIds: trips.map((t) => t.id),
    sourceCount: sources.length,
    warnings,
  };
}
