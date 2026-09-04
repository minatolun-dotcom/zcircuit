import { describe, expect, it } from 'vitest';
import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, ComponentProps, ComponentType, WireEdge } from '../types/circuit';
import { analyzeCircuit, recommendGauge } from './optimization';
import type { OptimizationReport, SuggestionCode } from './optimization';

/* ---------------------------------------------------------------------------
 * Fixture builders (mirror the other engine test files).
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

function codesOf(r: OptimizationReport): SuggestionCode[] {
  return r.suggestions.map((s) => s.code);
}

const has = (r: OptimizationReport, code: SuggestionCode): boolean => codesOf(r).includes(code);

/** Correct lighting circuit: switchboard -> MCB(16A) -> switch(on) -> 60 W bulb. */
function lightCircuit(wattage = 60, bulbX = 520) {
  return {
    nodes: [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
      comp('sw', 'switch', { state: 'on' }, 360, 0),
      comp('lamp', 'bulb', { wattageW: wattage }, bulbX, 0),
    ],
    edges: [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'sw', 'l-in'),
      wire('w3', 'sw', 'l-out', 'lamp', 'l-in'),
      wire('w4', 'lamp', 'n-out', 'sb', 'n-out'),
    ],
  };
}

describe('recommendGauge (IEC 60228 with conservative ampacity)', () => {
  it('picks the smallest size whose ampacity covers the design current', () => {
    expect(recommendGauge(10)).toMatchObject({ sizeMm2: 1.5, label: '1.5 mm²', adequate: true });
    expect(recommendGauge(16)).toMatchObject({ sizeMm2: 1.5, ampacityA: 17.5 });
    expect(recommendGauge(17.6)).toMatchObject({ sizeMm2: 2.5, ampacityA: 24 });
    expect(recommendGauge(25)).toMatchObject({ sizeMm2: 4, ampacityA: 32 });
    expect(recommendGauge(33)).toMatchObject({ sizeMm2: 6, ampacityA: 41 });
  });

  it('reports an inadequate choice with utilisation once the range is exceeded', () => {
    const g = recommendGauge(50);
    expect(g.adequate).toBe(false);
    expect(g.sizeMm2).toBe(6);
    expect(g.utilization).toBeCloseTo(50 / 41, 4);
  });

  it('keeps an adequate margin: utilisation is at most 1 while adequate', () => {
    for (const current of [5, 10, 16, 20, 30, 40]) {
      const g = recommendGauge(current);
      expect(g.adequate).toBe(true);
      expect(g.utilization).toBeLessThanOrEqual(1);
      expect(g.ampacityA).toBeGreaterThanOrEqual(current);
    }
  });

  it('a 16 A MCB branch resolves to 1.5 mm² (16 <= 17.5 A)', () => {
    expect(recommendGauge(16).sizeMm2).toBe(1.5);
  });
});

describe('analyzeCircuit', () => {
  it('suggests the right gauge for a protected lighting branch', () => {
    const { nodes, edges } = lightCircuit();
    const r = analyzeCircuit(nodes, edges);
    expect(r.metrics.wireCount).toBe(4);
    expect(has(r, 'GAUGE')).toBe(true);
    // No warnings in a healthy, protected, switched circuit (the N return
    // run to the board may still draw a length tip).
    expect(has(r, 'OVERLOAD_BRANCH')).toBe(false);
    expect(has(r, 'UNSWITCHED_LOAD')).toBe(false);
    expect(has(r, 'CROSSING')).toBe(false);
    const g = r.suggestions.find((s) => s.code === 'GAUGE')!;
    expect(g.priority).toBe('info');
    expect(g.detail).toContain('1.5 mm²');
    expect(g.detail).toContain('16 A');
  });

  it('flags a branch drawing over 80% of its MCB rating as overloaded', () => {
    // 3000 W bulb -> 13.04 A, which is ~82% of the 16 A rating.
    const { nodes, edges } = lightCircuit(3000);
    const r = analyzeCircuit(nodes, edges);
    expect(has(r, 'OVERLOAD_BRANCH')).toBe(true);
    const o = r.suggestions.find((s) => s.code === 'OVERLOAD_BRANCH')!;
    expect(o.priority).toBe('warning');
    expect(o.detail).toMatch(/82%/);
  });

  it('ranks warnings before info suggestions', () => {
    const { nodes, edges } = lightCircuit(3000, 1000); // overloaded AND very long
    const r = analyzeCircuit(nodes, edges);
    expect(has(r, 'OVERLOAD_BRANCH')).toBe(true);
    expect(has(r, 'LONG_WIRE')).toBe(true);
    expect(r.suggestions[0].priority).toBe('warning');
    expect(r.suggestions[0].code).toBe('OVERLOAD_BRANCH');
  });

  it('suggests a gauge and manual switch for an unprotected direct-fed bulb', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 300, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'lamp', 'l-in'),
      wire('w2', 'lamp', 'n-out', 'sb', 'n-out'),
    ];
    const r = analyzeCircuit(nodes, edges);
    expect(has(r, 'GAUGE')).toBe(true);
    expect(has(r, 'UNSWITCHED_LOAD')).toBe(true);
    expect(r.suggestions.find((s) => s.code === 'GAUGE')!.detail).toContain('1.25 x margin');
  });

  it('does not complain about missing control when a switch conducts', () => {
    const { nodes, edges } = lightCircuit();
    const r = analyzeCircuit(nodes, edges);
    expect(has(r, 'UNSWITCHED_LOAD')).toBe(false);
  });

  it('does not gauge a spare MCB that has no load-side connection', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 200, 0),
    ];
    const edges = [wire('w1', 'sb', 'way-1-l', 'brk', 'l-in')];
    const r = analyzeCircuit(nodes, edges);
    expect(has(r, 'GAUGE')).toBe(false);
  });

  it('reports a very long wire with its routed length in the metrics', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 2000, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'lamp', 'l-in'),
      wire('w2', 'lamp', 'n-out', 'sb', 'n-out'),
    ];
    const r = analyzeCircuit(nodes, edges);
    expect(has(r, 'LONG_WIRE')).toBe(true);
    expect(r.metrics.longestWirePx).toBeGreaterThanOrEqual(1900);
    expect(r.suggestions.find((s) => s.code === 'LONG_WIRE')?.priority).toBe('info');
  });

  it('detects two wires whose routed runs cross and counts them', () => {
    // Horizontal run from a1 (100,300) to a2 (300,300); vertical run from
    // b1 (255,100) to b2 (255,400) crosses it at (255,332).
    const nodes = [
      comp('a1', 'bulb', { wattageW: 60 }, 100, 300),
      comp('a2', 'bulb', { wattageW: 60 }, 300, 300),
      comp('b1', 'bulb', { wattageW: 60 }, 255, 100),
      comp('b2', 'bulb', { wattageW: 60 }, 255, 400),
    ];
    const edges = [
      wire('wA', 'a1', 'l-in', 'a2', 'n-out'),
      wire('wB', 'b1', 'l-in', 'b2', 'l-in'),
    ];
    const r = analyzeCircuit(nodes, edges);
    expect(r.metrics.crossingCount).toBe(1);
    expect(has(r, 'CROSSING')).toBe(true);
    const c = r.suggestions.find((s) => s.code === 'CROSSING')!;
    expect(c.priority).toBe('warning');
    expect(c.edgeIds).toEqual(expect.arrayContaining(['wA', 'wB']));
  });

  it('reports no crossing for parallel wires on different rows', () => {
    const nodes = [
      comp('a1', 'bulb', { wattageW: 60 }, 100, 100),
      comp('a2', 'bulb', { wattageW: 60 }, 600, 100),
      comp('b1', 'bulb', { wattageW: 60 }, 100, 400),
      comp('b2', 'bulb', { wattageW: 60 }, 600, 400),
    ];
    const edges = [
      wire('wA', 'a1', 'l-in', 'a2', 'n-out'),
      wire('wB', 'b1', 'l-in', 'b2', 'n-out'),
    ];
    const r = analyzeCircuit(nodes, edges);
    expect(r.metrics.crossingCount).toBe(0);
    expect(has(r, 'CROSSING')).toBe(false);
  });
});
