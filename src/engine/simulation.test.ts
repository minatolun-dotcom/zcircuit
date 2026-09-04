import { describe, expect, it } from 'vitest';
import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, ComponentProps, ComponentType, WireEdge } from '../types/circuit';
import { simulateCircuit } from './simulation';
import type { ComponentSim, SimulationResult } from './simulation';

/* ---------------------------------------------------------------------------
 * Fixture builders (positions are irrelevant to the solver).
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

function simOf(result: SimulationResult, id: string): ComponentSim {
  const found = result.components.find((c) => c.nodeId === id);
  if (!found) throw new Error(`no result for component ${id}`);
  return found;
}

const approx = (actual: number, expected: number, digits = 4) =>
  expect(actual).toBeCloseTo(expected, digits);

/** 60 W / 230 V lamp current (plan's textbook house-wiring numbers). */
const LAMP_I = 60 / 230;

/** A canonical circuit: switchboard -> MCB(16A) -> switch -> 60 W bulb. */
function lightCircuit(switchState: 'on' | 'off' = 'on') {
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

describe('simulateCircuit', () => {
  it('lights a 60 W bulb through a closed MCB and switch at 230 V', () => {
    const { nodes, edges } = lightCircuit('on');
    const r = simulateCircuit(nodes, edges);
    expect(r.ok).toBe(true);
    expect(r.trippedMcbIds).toEqual([]);
    expect(r.sourceCount).toBe(1);

    const lamp = simOf(r, 'lamp');
    approx(lamp.currentA, LAMP_I);
    approx(lamp.voltageV, 230, 2);
    approx(lamp.powerW, 60, 2);
    expect(lamp.status).toBe('on');
    expect(lamp.powerFactor).toBe(1);

    // Closed MCB and switch carry the same current, with ~0 V across contacts.
    const brk = simOf(r, 'brk');
    const sw = simOf(r, 'sw');
    approx(brk.currentA, LAMP_I);
    approx(sw.currentA, LAMP_I);
    approx(brk.voltageV, 0, 3); // small contact drop: I x 1 mOhm
    approx(sw.voltageV, 0, 3);
    expect(brk.status).toBe('on');
    expect(sw.status).toBe('on');

    const sb = simOf(r, 'sb');
    approx(sb.currentA, LAMP_I);
    expect(r.message).toContain('1 load powered');
  });

  it('open circuit: an open switch stops current and sees 230 V across it', () => {
    const { nodes, edges } = lightCircuit('off');
    const r = simulateCircuit(nodes, edges);
    expect(r.ok).toBe(true);

    const sw = simOf(r, 'sw');
    expect(sw.status).toBe('off');
    approx(sw.voltageV, 230, 2);

    const lamp = simOf(r, 'lamp');
    expect(lamp.status).toBe('off');
    approx(lamp.currentA, 0);
    approx(lamp.voltageV, 0, 6);
    approx(lamp.powerW, 0, 6);

    // The closed MCB upstream stays closed but carries nothing.
    const brk = simOf(r, 'brk');
    expect(brk.status).toBe('on');
    approx(brk.currentA, 0, 6);
    expect(r.message).toContain('no load powered');
  });

  it('parallel loads: MCB current is the sum of the branch currents', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
      comp('lamp1', 'bulb', { wattageW: 60 }, 400, -80),
      comp('lamp2', 'bulb', { wattageW: 100 }, 400, 80),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'lamp1', 'l-in'),
      wire('w3', 'brk', 'l-out', 'lamp2', 'l-in'),
      wire('w4', 'lamp1', 'n-out', 'sb', 'n-out'),
      wire('w5', 'lamp2', 'n-out', 'sb', 'n-out'),
    ];
    const r = simulateCircuit(nodes, edges);
    expect(r.ok).toBe(true);

    approx(simOf(r, 'brk').currentA, (60 + 100) / 230);
    approx(simOf(r, 'lamp1').currentA, 60 / 230);
    approx(simOf(r, 'lamp2').currentA, 100 / 230);
  });

  it('short circuit: MCB trips, opens and reports the overload reason', () => {
    // Dead short straight across the breaker: its L-out is wired to the N bus.
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'sb', 'n-in'),
    ];
    const r = simulateCircuit(nodes, edges);
    expect(r.ok).toBe(false);
    expect(r.trippedMcbIds).toEqual(['brk']);
    expect(r.message).toContain('MCB tripped');

    const brk = simOf(r, 'brk');
    expect(brk.status).toBe('tripped');
    approx(brk.currentA, 0, 6); // open after the trip
    approx(brk.voltageV, 230, 2); // sustains line voltage across the gap
    expect(brk.reason).toMatch(/overload \d+(\.\d+)? A > 16 A rating/);
  });

  it('socket: energized only when both L and N are part of a solved loop', () => {
    // Fully wired: L through MCB, N straight back to the switchboard bus.
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
      comp('soc', 'socket', {}, 400, 0),
    ];
    const wiredEdges = [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'soc', 'l-in'),
      wire('w3', 'soc', 'n-in', 'sb', 'n-out'),
    ];
    const wired = simulateCircuit(nodes, wiredEdges);
    const soc1 = simOf(wired, 'soc');
    expect(soc1.status).toBe('on');
    approx(soc1.voltageV, 230, 2);
    approx(soc1.currentA, 0, 6); // an outlet draws nothing by itself
    expect(wired.message).toContain('socket energized');

    // L only, N floating: no closed loop, so the outlet must report off.
    const floatingEdges = [wiredEdges[0], wiredEdges[1]];
    const floating = simulateCircuit(nodes, floatingEdges);
    const soc2 = simOf(floating, 'soc');
    expect(soc2.status).toBe('off');
    approx(soc2.voltageV, 0, 6);
  });

  it('open return path: a lamp whose neutral is not wired draws zero current', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 400, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'lamp', 'l-in'),
      // lamp.n-out -> nothing: open circuit
    ];
    const r = simulateCircuit(nodes, edges);
    const lamp = simOf(r, 'lamp');
    expect(lamp.status).toBe('off');
    approx(lamp.currentA, 0, 6);
    approx(lamp.powerW, 0, 6);
    expect(r.ok).toBe(true);
  });

  it('inverter can power a load off-grid', () => {
    const nodes = [
      comp('inv', 'inverter', { state: 'on', capacityVA: 1000 }, 0, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 260, 0),
    ];
    const edges = [
      wire('w1', 'inv', 'out-l', 'lamp', 'l-in'),
      wire('w2', 'lamp', 'n-out', 'inv', 'out-n'),
    ];
    const r = simulateCircuit(nodes, edges);
    expect(r.sourceCount).toBe(1);
    approx(simOf(r, 'lamp').currentA, LAMP_I);
    expect(simOf(r, 'lamp').status).toBe('on');
    approx(simOf(r, 'inv').currentA, LAMP_I);
    expect(simOf(r, 'inv').status).toBe('on');
  });

  it('no power source anywhere: loads stay off and the message says so', () => {
    const nodes = [comp('lamp', 'bulb', { wattageW: 60 }, 0, 0)];
    const r = simulateCircuit(nodes, []);
    expect(simOf(r, 'lamp').status).toBe('off');
    expect(r.message).toContain('no power source');
    expect(r.ok).toBe(true); // modelling is fine; the shortfall is a validation concern
  });

  it('a source whose L and N buses are joined is flagged as short-circuited', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 400, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'lamp', 'l-in'),
      wire('w2', 'lamp', 'n-out', 'sb', 'n-out'),
      // Bogus edge the UI would never allow (self-connection): joins the buses.
      wire('w3', 'sb', 'way-2-l', 'sb', 'n-in'),
    ];
    const r = simulateCircuit(nodes, edges);
    expect(r.ok).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/short-circuited/);
    expect(simOf(r, 'sb').status).toBe('off');
    expect(simOf(r, 'lamp').status).toBe('off');
  });

  it('empty canvas returns a friendly no-op result', () => {
    const r = simulateCircuit([], []);
    expect(r.ok).toBe(true);
    expect(r.components).toEqual([]);
    expect(r.sourceCount).toBe(0);
  });
});
