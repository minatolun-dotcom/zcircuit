import { describe, expect, it } from 'vitest';
import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, ComponentProps, ComponentType, WireEdge } from '../types/circuit';
import { simulateCircuit } from './simulation';
import { validateCircuit } from './validation';
import type { ValidationCode, ValidationReport } from './validation';

/* ---------------------------------------------------------------------------
 * Fixture builders (mirror src/engine/simulation.test.ts).
 * ------------------------------------------------------------------------- */

function comp(
  id: string,
  type: ComponentType,
  props: Partial<ComponentProps> = {},
  x = 0,
  y = 0,
): ComponentNode {
  return {
    id,
    type: 'component',
    position: { x, y },
    data: { componentType: type, props: { ...CATALOG[type].defaultProps, ...props } },
  } as unknown as ComponentNode;
}

function wire(id: string, source: string, fromTerminal: string, target: string, toTerminal: string): WireEdge {
  return {
    id,
    source,
    target,
    sourceHandle: `${fromTerminal}::src`,
    targetHandle: `${toTerminal}::tgt`,
    data: { fromTerminal, toTerminal },
  } as unknown as WireEdge;
}

function codesOf(report: ValidationReport): ValidationCode[] {
  return report.findings.map((f) => f.code);
}

const has = (report: ValidationReport, code: ValidationCode): boolean =>
  codesOf(report).includes(code);

/** Correct lighting circuit: switchboard -> MCB(16A) -> switch(on) -> 60 W bulb. */
function cleanLightCircuit(overrides: { switchState?: 'on' | 'off' } = {}) {
  const { switchState = 'on' } = overrides;
  return {
    nodes: [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
      comp('sw', 'switch', { state: switchState }, 360, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 520, 0),
    ],
    edges: [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'sw', 'l-in'),
      wire('w3', 'sw', 'l-out', 'lamp', 'l-in'),
      wire('w4', 'lamp', 'n-out', 'sb', 'n-out'),
    ],
  };
}

/** Correct socket circuit: switchboard -> MCB -> socket, with N and PE returns. */
function cleanSocketCircuit(pe = true) {
  const edges = [
    wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
    wire('w2', 'brk', 'l-out', 'soc', 'l-in'),
    wire('w3', 'soc', 'n-in', 'sb', 'n-out'),
  ];
  if (pe) edges.push(wire('w4', 'soc', 'pe-in', 'sb', 'pe-out'));
  return {
    nodes: [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
      comp('soc', 'socket', {}, 400, 0),
    ],
    edges,
  };
}

describe('validateCircuit', () => {
  it('accepts a correctly wired lighting circuit (KCL/KVL/power pass)', () => {
    const { nodes, edges } = cleanLightCircuit();
    const r = validateCircuit(nodes, edges);
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
    expect(r.counts.error).toBe(0);
  });

  it('accepts a correctly earthed socket circuit', () => {
    const { nodes, edges } = cleanSocketCircuit(true);
    const r = validateCircuit(nodes, edges);
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it('flags an energized socket whose PE terminal is not earthed', () => {
    const { nodes, edges } = cleanSocketCircuit(false);
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'MISSING_EARTH')).toBe(true);
    const f = r.findings.find((x) => x.code === 'MISSING_EARTH');
    expect(f?.nodeId).toBe('soc');
    expect(f?.severity).toBe('warning');
  });

  it('does not flag a socket fed only on L (endpoint semantics, not energized)', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
      comp('soc', 'socket', {}, 400, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'soc', 'l-in'),
    ];
    const r = validateCircuit(nodes, edges);
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it('detects a dead short across the MCB (live to neutral, no load)', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'sb', 'n-in'),
    ];
    const r = validateCircuit(nodes, edges);
    expect(r.ok).toBe(false);
    const shorts = r.findings.filter((f) => f.code === 'SHORT_CIRCUIT');
    expect(shorts.length).toBeGreaterThan(0);
    expect(shorts[0].severity).toBe('error');
  });

  it('detects live joined to earth when a breaker output is wired to the PE bus', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'sb', 'pe-out'), // live rail bridged to earth
    ];
    const r = validateCircuit(nodes, edges);
    expect(r.ok).toBe(false);
    expect(has(r, 'SHORT_CIRCUIT')).toBe(true);
    // The short subsumes role checking on that net.
    expect(r.findings.some((f) => f.code === 'ROLE_MISMATCH')).toBe(false);
  });

  it('flags a PE terminal wired onto a live net (energized earth pin)', () => {
    const nodes = [comp('sb', 'switchboard', {}, 0, 0), comp('soc', 'socket', {}, 200, 0)];
    const edges = [wire('w1', 'sb', 'way-1-l', 'soc', 'pe-in')];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'SHORT_CIRCUIT')).toBe(false); // only live is on the net
    expect(has(r, 'ROLE_MISMATCH')).toBe(true);
    expect(r.findings.find((x) => x.code === 'ROLE_MISMATCH')?.terminalId).toBe('pe-in');
    expect(r.ok).toBe(false);
  });

  it('flags a wire to a component that is not on the canvas (floating)', () => {
    const nodes = [comp('lamp', 'bulb', { wattageW: 60 }, 0, 0)];
    const edges = [wire('w1', 'ghost', 'l-in', 'lamp', 'n-out')];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'FLOATING_WIRE')).toBe(true);
    expect(r.findings[0].severity).toBe('warning');
  });

  it('flags a wire to a terminal that does not exist', () => {
    const nodes = [
      comp('brk', 'mcb', { state: 'on' }, 0, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 200, 0),
    ];
    const edges = [wire('w1', 'brk', 'l-in', 'lamp', 'no-such-terminal')];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'FLOATING_WIRE')).toBe(true);
  });

  it('rejects a wire that connects a component to itself', () => {
    const nodes = [comp('inv', 'inverter', {}, 0, 0)];
    const edges = [wire('w1', 'inv', 'out-l', 'inv', 'out-n')];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'SELF_CONNECTION')).toBe(true);
    expect(r.ok).toBe(false);
  });

  it('warns on duplicate wires between the same terminal pair', () => {
    const nodes = [
      comp('brk', 'mcb', { state: 'on' }, 0, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 200, 0),
    ];
    const edges = [
      wire('w1', 'brk', 'l-out', 'lamp', 'l-in'),
      wire('w2', 'lamp', 'l-in', 'brk', 'l-out'), // same pair, reversed
    ];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'DUPLICATE_CONNECTION')).toBe(true);
  });

  it('catches a neutral terminal wired onto a live net (role mismatch)', () => {
    const nodes = [comp('sb', 'switchboard', {}, 0, 0), comp('soc', 'socket', {}, 200, 0)];
    const edges = [wire('w1', 'sb', 'way-1-l', 'soc', 'n-in')];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'ROLE_MISMATCH')).toBe(true);
    const f = r.findings.find((x) => x.code === 'ROLE_MISMATCH');
    expect(f?.nodeId).toBe('soc');
    expect(f?.terminalId).toBe('n-in');
    expect(r.ok).toBe(false);
  });

  it('warns when a bulb has a live feed but no neutral return', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { state: 'on' }, 200, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 400, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'lamp', 'l-in'),
      // lamp.n-out -> nothing
    ];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'INCOMPLETE_LOAD')).toBe(true);
    expect(r.findings.some((f) => f.severity === 'error')).toBe(false);
  });

  it('does not flag a bulb behind an open switch (designed open endpoint)', () => {
    const { nodes, edges } = cleanLightCircuit({ switchState: 'off' });
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'INCOMPLETE_LOAD')).toBe(false);
    expect(has(r, 'ROLE_MISMATCH')).toBe(false);
    expect(r.ok).toBe(true);
  });

  it('warns when a powered circuit has no MCB protection', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 200, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'lamp', 'l-in'),
      wire('w2', 'lamp', 'n-out', 'sb', 'n-out'),
    ];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'UNPROTECTED_CIRCUIT')).toBe(true);
    expect(r.ok).toBe(true); // advisory only
  });

  it('warns when wired components exist but no source is present', () => {
    const nodes = [
      comp('lamp1', 'bulb', { wattageW: 60 }, 0, 0),
      comp('lamp2', 'bulb', { wattageW: 60 }, 200, 0),
    ];
    const edges = [
      wire('w1', 'lamp1', 'l-in', 'lamp2', 'l-in'),
      wire('w2', 'lamp1', 'n-out', 'lamp2', 'n-out'),
    ];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'NO_POWER_SOURCE')).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('does not flag a lamp fed from an inverter that is switched off', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('inv', 'inverter', { state: 'off' }, 220, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 440, 0),
    ];
    const edges = [
      wire('w1', 'inv', 'out-l', 'lamp', 'l-in'),
      wire('w2', 'lamp', 'n-out', 'inv', 'out-n'),
    ];
    const r = validateCircuit(nodes, edges);
    expect(has(r, 'INCOMPLETE_LOAD')).toBe(false);
    expect(r.findings).toEqual([]);
  });

  it('flags power conservation violations when the solver result is tampered', () => {
    const { nodes, edges } = cleanLightCircuit();
    const sim = simulateCircuit(nodes, edges);
    const sb = sim.components.find((c) => c.nodeId === 'sb')!;
    sim.components = sim.components.map((c) =>
      c.nodeId === 'sb' ? { ...c, powerW: sb.powerW * 10 } : c,
    );
    const r = validateCircuit(nodes, edges, sim);
    expect(has(r, 'POWER_BALANCE')).toBe(true);
    expect(r.ok).toBe(false);
  });

  it('returns an empty, clean report for an empty canvas', () => {
    const r = validateCircuit([], []);
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
  });
});
