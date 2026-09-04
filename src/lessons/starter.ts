import { parseCircuitDoc } from '../store/serialization';
import type { ComponentNode, WireEdge } from '../types/circuit';
import type { LevelDef } from './types';

export interface StarterCircuit {
  nodes: ComponentNode[];
  edges: WireEdge[];
}

/**
 * Materialize a level's starter circuit. Starters are stored in the exact
 * save/load JSON format, so the trusted parseCircuitDoc validator does the
 * lifting: unknown components are dropped, props merge over catalog defaults,
 * and edges to missing nodes are discarded. Levels without a starter start on
 * an empty canvas.
 */
export function buildStarter(level: LevelDef): StarterCircuit {
  if (!level.starter) return { nodes: [], edges: [] };
  const result = parseCircuitDoc(JSON.stringify(level.starter));
  if (!result.ok) {
    throw new Error(`Level "${level.id}" starter circuit is invalid: ${result.message}`);
  }
  return { nodes: result.nodes, edges: result.edges };
}