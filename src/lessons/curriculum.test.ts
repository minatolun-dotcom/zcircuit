import { describe, expect, it } from 'vitest';
import type { WireEdge } from '../types/circuit';
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
    targetHandle: `${toTerminal}::tgt`,
    data: { fromTerminal, toTerminal },
  } as unknown as WireEdge;
}

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
    default:
      return null;
  }
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
});

describe('level solvability (reference solutions)', () => {
  for (const level of LEVELS) {
    it(`${level.id} "${level.title}" is solvable with 3 stars`, () => {
      const ref = referenceFor(level.id);
      expect(ref, `reference solution for ${level.id}`).not.toBeNull();
      const starter = buildStarter(level);
      const { nodes, edges } = referenceFor(level.id)!;
      expect(nodes).toEqual(starter.nodes); // reference keeps the starter intact
      const r = evaluateLevel(nodes as never, edges, level);
      expect(r.passed, `objectives: ${JSON.stringify(r.objectives.map((o) => o.detail))}`).toBe(true);
      expect(r.stars, `stars for ${level.id}`).toBe(3);
    });
  }
});