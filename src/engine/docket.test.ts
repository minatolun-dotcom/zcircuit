import { describe, expect, it } from 'vitest';
import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, ComponentProps, ComponentType, WireEdge } from '../types/circuit';
import { buildDocket, exportJson, exportPdf, exportSvg } from './docket';

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

function lightCircuit() {
  return {
    nodes: [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { ratedCurrentA: 16, state: 'on' }, 220, 0),
      comp('sw', 'switch', { state: 'on' }, 420, 0),
      comp('lamp', 'bulb', { wattageW: 60 }, 620, 0),
    ],
    edges: [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'sw', 'l-in'),
      wire('w3', 'sw', 'l-out', 'lamp', 'l-in'),
      wire('w4', 'lamp', 'n-out', 'sb', 'n-out'),
    ],
  };
}

describe('buildDocket', () => {
  it('summarizes components, wires and lengths', () => {
    const { nodes, edges } = lightCircuit();
    const d = buildDocket(nodes, edges);
    expect(d.summary.componentCount).toBe(4);
    expect(d.summary.wireCount).toBe(4);
    expect(d.summary.totalWirePx).toBeGreaterThan(0);
    expect(d.summary.totalWireM).toBeCloseTo(d.summary.totalWirePx / 100, 6);
    expect(d.components.map((c) => c.type)).toEqual(['switchboard', 'mcb', 'switch', 'bulb']);
  });

  it('lists electrical ratings and simulation results per component', () => {
    const { nodes, edges } = lightCircuit();
    const d = buildDocket(nodes, edges, undefined, undefined, undefined);
    expect(d.components.find((c) => c.type === 'mcb')?.rating).toBe('16 A');
    expect(d.components.find((c) => c.type === 'bulb')?.rating).toBe('60 W');
  });

  it('produces a conductor gauge schedule for used MCB branches', () => {
    const { nodes, edges } = lightCircuit();
    const d = buildDocket(nodes, edges);
    expect(d.conductorSchedule).toHaveLength(1);
    expect(d.conductorSchedule[0]).toMatchObject({ designA: 16, sizeMm2: 1.5, adequate: true });
  });

  it('derives a gauge for an unprotected feed from the load current', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('lamp', 'bulb', { wattageW: 2000 }, 300, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'lamp', 'l-in'),
      wire('w2', 'lamp', 'n-out', 'sb', 'n-out'),
    ];
    const d = buildDocket(nodes, edges);
    expect(d.conductorSchedule).toHaveLength(1);
    // 2000 W / 230 V = 8.7 A x 1.25 = 10.9 A -> 1.5 mm2 (ampacity 17.5).
    expect(d.conductorSchedule[0].designA).toBeCloseTo((2000 / 230) * 1.25, 3);
    expect(d.conductorSchedule[0].sizeMm2).toBe(1.5);
  });
});

describe('exportJson', () => {
  it('contains the full circuit state plus live results', () => {
    const { nodes, edges } = lightCircuit();
    const doc = JSON.parse(exportJson(nodes, edges)) as {
      app: string;
      circuit: { nodes: unknown[]; edges: unknown[] };
      simulation: { ok: boolean; message: string };
      validation: { counts: { error: number } };
      optimization: { suggestions: unknown[] };
      docket: { summary: { wireCount: number } };
      frequencyHz: number;
    };
    expect(doc.app).toBe('zcircuit');
    expect(doc.circuit.nodes).toHaveLength(4);
    expect(doc.circuit.edges).toHaveLength(4);
    expect(doc.simulation.ok).toBe(true);
    expect(doc.simulation.message).toContain('1 load powered');
    expect(doc.validation.counts.error).toBe(0);
    expect(doc.optimization.suggestions.length).toBeGreaterThan(0);
    expect(doc.docket.summary.wireCount).toBe(4);
    expect(doc.frequencyHz).toBe(50);
  });
});

describe('exportSvg', () => {
  it('produces a valid, self-contained wiring diagram', () => {
    const { nodes, edges } = lightCircuit();
    const svg = exportSvg(nodes, edges);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('MCB');
    expect(svg).toContain('Bulb');
    expect(svg).toContain('<path'); // routed wires
    expect(svg).toContain('data-node="lamp"');
    expect(svg).toContain('</g>');
  });

  it('escapes user-provided names', () => {
    const { nodes, edges } = lightCircuit();
    nodes[3].data.props.name = 'Kitchen <3 & more';
    const svg = exportSvg(nodes, edges);
    expect(svg).not.toContain('<3');
    expect(svg).toContain('Kitchen &lt;3 &amp; more');
  });
});

describe('exportPdf', () => {
  it('produces a valid PDF document', () => {
    const { nodes, edges } = lightCircuit();
    const doc = exportPdf(nodes, edges);
    const out = new Uint8Array(doc.output('arraybuffer'));
    expect(String.fromCharCode(out[0], out[1], out[2], out[3])).toBe('%PDF');
  });

  it('reports validation findings when present', () => {
    const nodes = [
      comp('sb', 'switchboard', {}, 0, 0),
      comp('brk', 'mcb', { state: 'on' }, 220, 0),
    ];
    const edges = [
      wire('w1', 'sb', 'way-1-l', 'brk', 'l-in'),
      wire('w2', 'brk', 'l-out', 'sb', 'n-in'),
    ];
    const doc = exportPdf(nodes, edges);
    const text = new TextDecoder().decode(new Uint8Array(doc.output('arraybuffer')));
    expect(text).toContain('SHORT_CIRCUIT');
  });
});