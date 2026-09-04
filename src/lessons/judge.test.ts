import { describe, expect, it } from 'vitest';
import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, ComponentProps, ComponentType, WireEdge } from '../types/circuit';
import { evaluateLevel } from './judge';
import type { LevelDef, Objective } from './types';

/* ---------------------------------------------------------------------------
 * Fixtures (same shapes the store/parse layer produce)
 * ------------------------------------------------------------------------- */

function comp(id: string, type: ComponentType, props: Partial<ComponentProps> = {}, x = 0, y = 120): ComponentNode {
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

function lampCircuit() {
  return {
    nodes: [comp('sb', 'switchboard'), comp('lamp', 'bulb', {}, 420)],
    edges: [
      wire('w1', 'sb', 'way-1-l', 'lamp', 'l-in'),
      wire('w2', 'lamp', 'n-out', 'sb', 'n-out'),
    ],
  };
}

function mcbLampCircuit() {
  return {
    nodes: [comp('sb', 'switchboard'), comp('mcb', 'mcb', {}, 260), comp('lamp', 'bulb', {}, 500)],
    edges: [
      wire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
      wire('w2', 'mcb', 'l-out', 'lamp', 'l-in'),
      wire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
    ],
  };
}

function switchLampCircuit(state: 'on' | 'off' = 'on') {
  return {
    nodes: [comp('sb', 'switchboard'), comp('sw', 'switch', { state }, 260), comp('lamp', 'bulb', {}, 500)],
    edges: [
      wire('w1', 'sb', 'way-1-l', 'sw', 'l-in'),
      wire('w2', 'sw', 'l-out', 'lamp', 'l-in'),
      wire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
    ],
  };
}

/** Dead short across a closed MCB: L and N joined through the breaker only. */
function deadShortCircuit() {
  return {
    nodes: [comp('sb', 'switchboard'), comp('mcb', 'mcb', {}, 260)],
    edges: [
      wire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
      wire('w2', 'mcb', 'l-out', 'sb', 'n-in'),
    ],
  };
}

function socketCircuit(liveOnly = false) {
  const edges = [wire('w1', 'sb', 'way-1-l', 'sock', 'l-in')];
  if (!liveOnly) edges.push(wire('w2', 'sock', 'n-in', 'sb', 'n-out'));
  return { nodes: [comp('sb', 'switchboard'), comp('sock', 'socket', {}, 260)], edges };
}

function lvl(objectives: Objective[], overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test-level',
    categoryId: 'test',
    title: 'Test level',
    difficulty: 1,
    intro: '',
    objectives,
    hints: ['hint'],
    ...overrides,
  };
}

/* ---------------------------------------------------------------------------
 * Objective kinds
 * ------------------------------------------------------------------------- */

describe('objective kinds', () => {
  it('powered: passes when the component sim is on, fails when unwired', () => {
    const { nodes, edges } = lampCircuit();
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'powered', nodeId: 'lamp' }])).passed).toBe(true);
    expect(evaluateLevel(nodes, [], lvl([{ kind: 'powered', nodeId: 'lamp' }])).passed).toBe(false);
  });

  it('off: passes for an open switch', () => {
    const { nodes, edges } = switchLampCircuit('off');
    const r = evaluateLevel(nodes, edges, lvl([{ kind: 'off', nodeId: 'sw' }]));
    expect(r.passed).toBe(true);
  });

  it('tripped + noTrips: a dead short trips the MCB', () => {
    const { nodes, edges } = deadShortCircuit();
    const r = evaluateLevel(nodes, edges, lvl([{ kind: 'tripped', nodeId: 'mcb' }]));
    expect(r.passed).toBe(true);
    expect(r.objectives[0].detail).toContain('tripped');
    const r2 = evaluateLevel(nodes, edges, lvl([{ kind: 'noTrips' }]));
    expect(r2.passed).toBe(false);
  });

  it('energized: socket with live L-N loop; L-only socket stays off', () => {
    const full = socketCircuit();
    expect(evaluateLevel(full.nodes, full.edges, lvl([{ kind: 'energized', nodeId: 'sock' }])).passed).toBe(true);
    const liveOnly = socketCircuit(true);
    expect(evaluateLevel(liveOnly.nodes, liveOnly.edges, lvl([{ kind: 'energized', nodeId: 'sock' }])).passed).toBe(false);
  });

  it('wired: direction-agnostic, fails when missing', () => {
    const { nodes, edges } = lampCircuit();
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'wired', from: 'lamp', to: 'sb' }])).passed).toBe(true);
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'wired', from: 'lamp', to: 'ghost' }])).passed).toBe(false);
  });

  it('noFindings: defaults to no errors; honours a severity', () => {
    const clean = lampCircuit();
    expect(evaluateLevel(clean.nodes, clean.edges, lvl([{ kind: 'noFindings' }])).passed).toBe(true);
    const bad = deadShortCircuit();
    expect(evaluateLevel(bad.nodes, bad.edges, lvl([{ kind: 'noFindings' }])).passed).toBe(false);
    // A short is an error, not a warning-only situation: severity filter applies.
    expect(evaluateLevel(bad.nodes, bad.edges, lvl([{ kind: 'noFindings', severity: 'warning' }])).passed).toBe(true);
  });

  it('currentUnder: compares the RMS current against the cap', () => {
    const { nodes, edges } = lampCircuit(); // 60 W bulb -> 0.2609 A
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'currentUnder', nodeId: 'lamp', maxA: 1 }])).passed).toBe(true);
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'currentUnder', nodeId: 'lamp', maxA: 0.2 }])).passed).toBe(false);
  });

  it('wireLengthUnder: uses the routed total wire length', () => {
    const { nodes, edges } = lampCircuit();
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'wireLengthUnder', maxPx: 10000 }])).passed).toBe(true);
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'wireLengthUnder', maxPx: 50 }])).passed).toBe(false);
  });

  it('gaugeAtLeast: sizes a wired-in MCB branch by IEC 60228', () => {
    const { nodes, edges } = mcbLampCircuit(); // 16 A -> 1.5 mm2
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'gaugeAtLeast', nodeId: 'mcb', sizeMm2: 1.5 }])).passed).toBe(true);
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'gaugeAtLeast', nodeId: 'mcb', sizeMm2: 2.5 }])).passed).toBe(false);
    // An MCB that is not wired in cannot be sized.
    const bare = { nodes: [comp('sb', 'switchboard'), comp('mcb', 'mcb', {}, 260)], edges: [] as WireEdge[] };
    expect(evaluateLevel(bare.nodes, bare.edges, lvl([{ kind: 'gaugeAtLeast', nodeId: 'mcb', sizeMm2: 1.5 }])).passed).toBe(false);
  });

  it('componentCount: exact and atLeast bounds', () => {
    const { nodes, edges } = lampCircuit(); // 2 components
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'componentCount', exact: 2 }])).passed).toBe(true);
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'componentCount', exact: 3 }])).passed).toBe(false);
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'componentCount', atLeast: 1 }])).passed).toBe(true);
    expect(evaluateLevel(nodes, edges, lvl([{ kind: 'componentCount', atLeast: 3 }])).passed).toBe(false);
  });

  it('switchControls: requires a conducting switch on the load\u2019s live path', () => {
    const through = switchLampCircuit('on');
    expect(evaluateLevel(through.nodes, through.edges, lvl([{ kind: 'switchControls', loadNodeId: 'lamp' }])).passed).toBe(true);

    // Directly-fed lamp: no switch at all.
    const direct = lampCircuit();
    expect(evaluateLevel(direct.nodes, direct.edges, lvl([{ kind: 'switchControls', loadNodeId: 'lamp' }])).passed).toBe(false);

    // Switch present but wired into a dead branch (carries no current).
    const deadBranch = {
      nodes: [comp('sb', 'switchboard'), comp('sw', 'switch', { state: 'on' }, 260), comp('lamp', 'bulb', {}, 500)],
      edges: [
        wire('w1', 'sb', 'way-1-l', 'sw', 'l-in'),
        wire('w2', 'sb', 'way-2-l', 'lamp', 'l-in'),
        wire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
      ],
    };
    expect(evaluateLevel(deadBranch.nodes, deadBranch.edges, lvl([{ kind: 'switchControls', loadNodeId: 'lamp' }])).passed).toBe(false);

    // Switch open: not conducting.
    const open = switchLampCircuit('off');
    expect(evaluateLevel(open.nodes, open.edges, lvl([{ kind: 'switchControls', loadNodeId: 'lamp' }])).passed).toBe(false);
  });

  it('protectedBy: requires a conducting MCB on the load\u2019s live path', () => {
    const protected_ = mcbLampCircuit();
    expect(evaluateLevel(protected_.nodes, protected_.edges, lvl([{ kind: 'protectedBy', loadNodeId: 'lamp' }])).passed).toBe(true);

    // No MCB anywhere.
    const direct = lampCircuit();
    expect(evaluateLevel(direct.nodes, direct.edges, lvl([{ kind: 'protectedBy', loadNodeId: 'lamp' }])).passed).toBe(false);

    // MCB present but on a dead branch (carries no current).
    const deadBranch = {
      nodes: [comp('sb', 'switchboard'), comp('mcb', 'mcb', {}, 260), comp('lamp', 'bulb', {}, 500)],
      edges: [
        wire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
        wire('w2', 'sb', 'way-2-l', 'lamp', 'l-in'),
        wire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
      ],
    };
    expect(evaluateLevel(deadBranch.nodes, deadBranch.edges, lvl([{ kind: 'protectedBy', loadNodeId: 'lamp' }])).passed).toBe(false);

    // MCB open between board and lamp: the load is not powered and not protected.
    const open = {
      nodes: [comp('sb', 'switchboard'), comp('mcb', 'mcb', { state: 'off' }, 260), comp('lamp', 'bulb', {}, 500)],
      edges: [
        wire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
        wire('w2', 'mcb', 'l-out', 'lamp', 'l-in'),
        wire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
      ],
    };
    expect(evaluateLevel(open.nodes, open.edges, lvl([{ kind: 'protectedBy', loadNodeId: 'lamp' }])).passed).toBe(false);
  });

  it('warningsUnder: counts optimization warnings (overload branch at >=80%)', () => {
    // 3000 W bulb on a 16 A MCB: 13.04 A -> 81.5% utilisation -> OVERLOAD_BRANCH.
    const overload = {
      nodes: [comp('sb', 'switchboard'), comp('mcb', 'mcb', {}, 260), comp('lamp', 'bulb', { wattageW: 3000 }, 500)],
      edges: [
        wire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
        wire('w2', 'mcb', 'l-out', 'lamp', 'l-in'),
        wire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
      ],
    };
    expect(evaluateLevel(overload.nodes, overload.edges, lvl([{ kind: 'warningsUnder', max: 0 }])).passed).toBe(false);
    expect(evaluateLevel(overload.nodes, overload.edges, lvl([{ kind: 'warningsUnder', max: 1 }])).passed).toBe(true);
  });
});

/* ---------------------------------------------------------------------------
 * Compound objectives
 * ------------------------------------------------------------------------- */

describe('compound objectives', () => {
  it('all: requires every item', () => {
    const { nodes, edges } = lampCircuit();
    const r = evaluateLevel(
      nodes,
      edges,
      lvl([{ kind: 'all', items: [{ kind: 'powered', nodeId: 'lamp' }, { kind: 'wired', from: 'lamp', to: 'sb' }] }]),
    );
    expect(r.passed).toBe(true);
    const bad = evaluateLevel(
      nodes,
      edges,
      lvl([{ kind: 'all', items: [{ kind: 'powered', nodeId: 'lamp' }, { kind: 'wired', from: 'lamp', to: 'ghost' }] }]),
    );
    expect(bad.passed).toBe(false);
  });

  it('any: passes when at least one item passes', () => {
    const { nodes, edges } = lampCircuit();
    const r = evaluateLevel(
      nodes,
      edges,
      lvl([{ kind: 'any', items: [{ kind: 'wired', from: 'lamp', to: 'ghost' }, { kind: 'powered', nodeId: 'lamp' }] }]),
    );
    expect(r.passed).toBe(true);
  });
});

/* ---------------------------------------------------------------------------
 * Robustness + star logic
 * ------------------------------------------------------------------------- */

describe('robustness', () => {
  it('never throws on objectives targeting removed components', () => {
    const { nodes, edges } = lampCircuit();
    const r = evaluateLevel(
      nodes,
      edges,
      lvl([{ kind: 'powered', nodeId: 'ghost' }, { kind: 'protectedBy', loadNodeId: 'ghost' }, { kind: 'gaugeAtLeast', nodeId: 'ghost', sizeMm2: 1.5 }]),
    );
    expect(r.passed).toBe(false);
    expect(r.objectives).toHaveLength(3);
    for (const o of r.objectives) expect(o.pass).toBe(false);
  });

  it('an empty objective list is not a pass', () => {
    const { nodes, edges } = lampCircuit();
    expect(evaluateLevel(nodes, edges, lvl([])).passed).toBe(false);
  });
});

describe('star logic', () => {
  it('a perfect run earns 3 stars', () => {
    const { nodes, edges } = mcbLampCircuit();
    const r = evaluateLevel(
      nodes,
      edges,
      lvl([
        { kind: 'powered', nodeId: 'lamp' },
        { kind: 'protectedBy', loadNodeId: 'lamp' },
        { kind: 'noTrips' },
      ]),
    );
    expect(r.passed).toBe(true);
    expect(r.stars).toBe(3);
    expect(r.starChecks.every((s) => s.pass)).toBe(true);
  });

  it('using a hint caps stars at 2', () => {
    const { nodes, edges } = mcbLampCircuit();
    const l = lvl([{ kind: 'powered', nodeId: 'lamp' }]);
    const r = evaluateLevel(nodes, edges, l, { hintsUsed: 1 });
    expect(r.stars).toBe(2);
    expect(r.starChecks[2].pass).toBe(false);
    expect(r.starChecks[2].reason).toContain('Hints');
  });

  it('a validation error caps stars at 1 even when objectives pass', () => {
    const { nodes, edges } = deadShortCircuit();
    // Objective passes (the MCB tripped), but the short is a validation error.
    const r = evaluateLevel(nodes, edges, lvl([{ kind: 'tripped', nodeId: 'mcb' }]));
    expect(r.passed).toBe(true);
    expect(r.stars).toBe(1);
  });

  it('failing objectives earns 0 stars', () => {
    const { nodes, edges } = deadShortCircuit();
    const r = evaluateLevel(nodes, edges, lvl([{ kind: 'noTrips' }]));
    expect(r.passed).toBe(false);
    expect(r.stars).toBe(0);
  });

  it('a tight wire budget fails the third star only', () => {
    const { nodes, edges } = mcbLampCircuit();
    const r = evaluateLevel(nodes, edges, lvl([{ kind: 'powered', nodeId: 'lamp' }], { par: { wireBudgetPx: 1 } }));
    expect(r.passed).toBe(true);
    expect(r.stars).toBe(2);
    expect(r.starChecks[2].reason).toContain('Wire length');
  });
});