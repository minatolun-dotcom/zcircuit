import { describe, expect, it } from 'vitest';
import type { ComponentNode, WireEdge } from '../types/circuit';
import { analyzeCircuit } from '../engine/optimization';
import { CATEGORIES, LEVELS, levelById, nextLevelId, orderedLevelIds } from './curriculum';
import { buildStarter } from './starter';
import { evaluateLevel } from './judge';
import type { Objective } from './types';

/** Reference solutions - the wiring a correct player produces. */
function refWire(id: string, source: string, fromTerminal: string, target: string, toTerminal: string): WireEdge {
  return {
    id,
    source,
    target,
    sourceHandle: `${fromTerminal}::src`,
    targetHandle: `${toTerminal}::src`,
    data: { fromTerminal, toTerminal },
  } as unknown as WireEdge;
}

/**
 * Reference circuit for a level. `nodes` may differ from the starter in props
 * (re-rated MCB, re-wattaged lamp) and may add components (an extra MCB) -
 * what must hold is that every starter node survives with the same id, type
 * and position (see sameLayout).
 */
function referenceFor(levelId: string): { nodes: unknown[]; edges: WireEdge[] } | null {
  switch (levelId) {
    case 'first-circuit.1':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'lamp', 'l-in'),
          refWire('w2', 'lamp', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'first-circuit.2':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'sw', 'l-in'),
          refWire('w2', 'sw', 'l-out', 'lamp', 'l-in'),
          refWire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'first-circuit.3':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'lamp', 'l-in'),
          refWire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'first-circuit.4':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'sw1', 'l-in'),
          refWire('w3', 'sw1', 'l-out', 'lamp', 'l-in'),
          refWire('w4', 'lamp', 'n-out', 'sb', 'n-out'),
          refWire('w5', 'mcb', 'l-out', 'sw2', 'l-in'),
          refWire('w6', 'sw2', 'l-out', 'fan', 'l-in'),
          refWire('w7', 'fan', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'getting-wired.5':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'b1', 'l-in'),
          refWire('w2', 'b1', 'n-out', 'b2', 'l-in'),
          refWire('w3', 'b2', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'getting-wired.6':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'b1', 'l-in'),
          refWire('w2', 'sb', 'way-1-l', 'b2', 'l-in'),
          refWire('w3', 'b1', 'n-out', 'sb', 'n-out'),
          refWire('w4', 'b2', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'getting-wired.7':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'sw', 'l-in'),
          refWire('w3', 'sw', 'l-out', 'bulb', 'l-in'),
          refWire('w4', 'sw', 'l-out', 'fan', 'l-in'),
          refWire('w5', 'bulb', 'n-out', 'sb', 'n-out'),
          refWire('w6', 'fan', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'getting-wired.8':
      return {
        nodes: (buildStarter(levelById(levelId)!).nodes as ComponentNode[]).map((n) =>
          n.id === 'sw1' || n.id === 'sw2' ? { ...n, data: { ...n.data, props: { ...n.data.props, state: 'on' } } } : n,
        ),
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'sw1', 'l-in'),
          refWire('w3', 'mcb', 'l-out', 'sw2', 'l-in'),
          refWire('w4', 'sw1', 'l-out', 'lamp', 'l-in'),
          refWire('w5', 'sw2', 'l-out', 'lamp', 'l-in'),
          refWire('w6', 'lamp', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'safety-first.9':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'lamp', 'l-in'),
          refWire('w2', 'lamp', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'safety-first.10':
      return {
        nodes: (buildStarter(levelById(levelId)!).nodes as ComponentNode[]).map((n) =>
          n.id === 'lamp' ? { ...n, data: { ...n.data, props: { ...n.data.props, wattageW: 4000 } } } : n,
        ),
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'lamp', 'l-in'),
          refWire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'safety-first.11':
      return {
        nodes: (buildStarter(levelById(levelId)!).nodes as ComponentNode[]).map((n) =>
          n.id === 'mcb' ? { ...n, data: { ...n.data, props: { ...n.data.props, ratedCurrentA: 32 } } } : n,
        ),
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'lamp', 'l-in'),
          refWire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'safety-first.12':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'socket', 'l-in'),
          refWire('w3', 'socket', 'n-in', 'sb', 'n-out'),
          refWire('w4', 'socket', 'pe-in', 'sb', 'pe-out'),
        ],
      };
    case 'fault-clinic.13':
    case 'fault-clinic.14':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'lamp', 'l-in'),
          refWire('w3', 'lamp', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'fault-clinic.15':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'socket', 'l-in'),
          refWire('w3', 'socket', 'n-in', 'sb', 'n-out'),
          refWire('w4', 'socket', 'pe-in', 'sb', 'pe-out'),
        ],
      };
    case 'fault-clinic.16':
      return {
        nodes: [
          ...buildStarter(levelById(levelId)!).nodes,
          { id: 'mcb2', type: 'component', position: { x: 790, y: 160 }, data: { componentType: 'mcb', props: {} } },
        ],
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'lamp1', 'l-in'),
          refWire('w3', 'lamp1', 'n-out', 'sb', 'n-out'),
          refWire('w4', 'sb', 'way-2-l', 'mcb2', 'l-in'),
          refWire('w5', 'mcb2', 'l-out', 'lamp2', 'l-in'),
          refWire('w6', 'lamp2', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'master-builder.17':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'sw', 'l-in'),
          refWire('w3', 'sw', 'l-out', 'lamp', 'l-in'),
          refWire('w4', 'lamp', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'master-builder.18':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'sw1', 'l-in'),
          refWire('w3', 'sw1', 'l-out', 'lamp', 'l-in'),
          refWire('w4', 'lamp', 'n-out', 'sb', 'n-out'),
          refWire('w5', 'mcb', 'l-out', 'sw2', 'l-in'),
          refWire('w6', 'sw2', 'l-out', 'fan', 'l-in'),
          refWire('w7', 'fan', 'n-out', 'sb', 'n-out'),
        ],
      };
    case 'master-builder.19':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'sw1', 'l-in'),
          refWire('w3', 'sw1', 'l-out', 'bulb', 'l-in'),
          refWire('w4', 'bulb', 'n-out', 'sb', 'n-out'),
          refWire('w5', 'mcb', 'l-out', 'sw2', 'l-in'),
          refWire('w6', 'sw2', 'l-out', 'fan', 'l-in'),
          refWire('w7', 'fan', 'n-out', 'sb', 'n-out'),
          refWire('w8', 'mcb', 'l-out', 'socket', 'l-in'),
          refWire('w9', 'socket', 'n-in', 'sb', 'n-out'),
          refWire('w10', 'socket', 'pe-in', 'sb', 'pe-out'),
        ],
      };
    case 'master-builder.20':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'inv', 'out-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'bulb', 'l-in'),
          refWire('w3', 'mcb', 'l-out', 'fan', 'l-in'),
          refWire('w4', 'bulb', 'n-out', 'inv', 'out-n'),
          refWire('w5', 'fan', 'n-out', 'inv', 'out-n'),
        ],
      };
    case 'master-builder.21':
      return {
        nodes: buildStarter(levelById(levelId)!).nodes,
        edges: [
          refWire('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
          refWire('w2', 'mcb', 'l-out', 'sw1', 'l-in'),
          refWire('w3', 'sw1', 'l-out', 'bulb', 'l-in'),
          refWire('w4', 'bulb', 'n-out', 'sb', 'n-out'),
          refWire('w5', 'mcb', 'l-out', 'sw2', 'l-in'),
          refWire('w6', 'sw2', 'l-out', 'fan', 'l-in'),
          refWire('w7', 'fan', 'n-out', 'sb', 'n-out'),
          refWire('w8', 'mcb', 'l-out', 'socket1', 'l-in'),
          refWire('w9', 'socket1', 'l-in', 'socket2', 'l-in'),
          refWire('w10', 'socket1', 'n-in', 'sb', 'n-out'),
          refWire('w11', 'socket1', 'pe-in', 'sb', 'pe-out'),
          refWire('w12', 'socket2', 'n-in', 'sb', 'n-out'),
          refWire('w13', 'socket2', 'pe-in', 'sb', 'pe-out'),
        ],
      };
    default:
      return null;
  }
}

/**
 * The reference must keep every starter component at its id/type/position;
 * props may differ (re-rating) and extra components may be added (an MCB for
 * the overload fix).
 */
function sameLayout(starterNodes: unknown[], refNodes: unknown[]): boolean {
  const byId = new Map((refNodes as { id: string }[]).map((n) => [n.id, n]));
  for (const s of starterNodes as { id: string; type: string; position: { x: number; y: number } }[]) {
    const r = byId.get(s.id) as { type?: string; position?: { x: number; y: number } } | undefined;
    if (!r || r.type !== s.type || r.position?.x !== s.position.x || r.position?.y !== s.position.y) {
      return false;
    }
  }
  return true;
}

/** Collect every nodeId a level's objectives reference (recursively). */
function referencedIds(objectives: Objective[]): string[] {
  const ids: string[] = [];
  const walk = (list: Objective[]) => {
    for (const o of list) {
      switch (o.kind) {
        case 'powered':
        case 'off':
        case 'tripped':
        case 'energized':
        case 'currentUnder':
        case 'gaugeAtLeast':
          ids.push(o.nodeId);
          break;
        case 'wired':
          ids.push(o.from, o.to);
          break;
        case 'switchControls':
        case 'protectedBy':
          ids.push(o.loadNodeId);
          break;
        case 'all':
        case 'any':
          walk(o.items);
          break;
        default:
          break;
      }
    }
  };
  walk(objectives);
  return ids;
}

describe('curriculum structure', () => {
  it('category and level ids are unique', () => {
    const catIds = new Set(CATEGORIES.map((c) => c.id));
    expect(catIds.size).toBe(CATEGORIES.length);
    const levelIds = new Set(LEVELS.map((l) => l.id));
    expect(levelIds.size).toBe(LEVELS.length);
  });

  it('every level belongs to an existing category and appears exactly once in its chain', () => {
    for (const level of LEVELS) {
      const cat = CATEGORIES.find((c) => c.id === level.categoryId);
      expect(cat, `${level.id} category`).toBeDefined();
      const occurrences = (cat?.levelIds ?? []).filter((id) => id === level.id).length;
      expect(occurrences, `${level.id} in ${cat?.id}`).toBe(1);
    }
  });

  it('category level chains only reference existing levels', () => {
    for (const cat of CATEGORIES) {
      for (const id of cat.levelIds) expect(levelById(id), `${cat.id} -> ${id}`).toBeDefined();
    }
  });

  it('every level has objectives, hints, an intro and a sane difficulty', () => {
    for (const level of LEVELS) {
      expect(level.objectives.length, `${level.id} objectives`).toBeGreaterThan(0);
      expect(level.hints.length, `${level.id} hints`).toBeGreaterThan(0);
      expect(level.intro.trim().length, `${level.id} intro`).toBeGreaterThan(0);
      expect(level.difficulty).toBeGreaterThanOrEqual(1);
      expect(level.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it('id-based objectives always target components present in the starter', () => {
    for (const level of LEVELS) {
      if (!level.starter) continue;
      const starterIds = new Set(level.starter.nodes.map((n) => n.id));
      for (const id of referencedIds(level.objectives)) {
        expect(starterIds.has(id), `${level.id} references ${id}`).toBe(true);
      }
    }
  });

  it('the linear unlock chain covers every level exactly once', () => {
    const chain = orderedLevelIds();
    expect(new Set(chain).size).toBe(chain.length);
    expect(chain).toHaveLength(LEVELS.length);
    expect(nextLevelId(chain[chain.length - 1])).toBeUndefined();
  });

  it('max stars is 63 across the 21-level curriculum', () => {
    expect(orderedLevelIds()).toHaveLength(21);
  });
});

describe('level solvability (reference solutions)', () => {
  for (const level of LEVELS) {
    it(`${level.id} "${level.title}" is solvable with 3 stars`, () => {
      const ref = referenceFor(level.id);
      expect(ref, `reference solution for ${level.id}`).not.toBeNull();
      const starter = buildStarter(level);
      const { nodes, edges } = referenceFor(level.id)!;
      expect(sameLayout(starter.nodes, nodes), `reference keeps the starter layout for ${level.id}`).toBe(true);

      const r = evaluateLevel(nodes as never, edges, level);
      // For tuning: when a reference misses, surface exactly which objectives,
      // star checks and optimization suggestions (crossings etc.) failed.
      const optimization = analyzeCircuit(nodes as ComponentNode[], edges);
      const debug = [
        r.passed ? '' : `objectives: ${JSON.stringify(r.objectives.map((o) => `${o.pass ? 'OK' : 'FAIL'} ${o.detail}`))}`,
        r.stars < 3 ? `starChecks: ${JSON.stringify(r.starChecks)}` : '',
        optimization.suggestions.length > 0
          ? `suggestions: ${JSON.stringify(optimization.suggestions.map((s) => `${s.code} ${s.title} :: ${s.detail}`))}`
          : '',
        `totalWirePx: ${optimization.metrics.totalWirePx}`,
      ]
        .filter(Boolean)
        .join(' | ');
      expect(r.passed, `objectives for ${level.id}: ${debug}`).toBe(true);
      expect(r.stars, `stars for ${level.id}: ${debug}`).toBe(3);
    });
  }
});