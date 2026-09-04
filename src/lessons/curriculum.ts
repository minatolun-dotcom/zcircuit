import type { CircuitDoc, CircuitDocEdge, CircuitDocNode } from '../store/serialization';
import type { ComponentProps, ComponentType } from '../types/circuit';
import type { CategoryDef, LevelDef } from './types';

/**
 * Lesson curriculum (PLAN.md Part 2). Content is plain typed data so adding a
 * level is adding an entry; the judge, starter and game UI never change.
 * Wave G1 ships Category 1 (First Circuit, L1-L4); later waves append the
 * remaining categories. Progress unlocks levels in one linear chain across the
 * categories in CATEGORIES order (see orderedLevelIds).
 */

function n(
  id: string,
  componentType: ComponentType,
  x: number,
  y: number,
  props: ComponentProps = {},
): CircuitDocNode {
  return { id, type: 'component', position: { x, y }, data: { componentType, props } };
}

function starter(nodes: CircuitDocNode[], edges: CircuitDocEdge[] = []): CircuitDoc {
  return { app: 'zcircuit', version: 1, nodes, edges };
}

/* ---------------------------------------------------------------------------
 * Categories
 * ------------------------------------------------------------------------- */

export const CATEGORIES: CategoryDef[] = [
  { id: 'first-circuit', title: 'First Circuit', tagline: 'Make something light up', icon: '⚡', levelIds: ['first-circuit.1', 'first-circuit.2', 'first-circuit.3', 'first-circuit.4'] },
  { id: 'getting-wired', title: 'Getting Wired', tagline: 'Series, parallel and branches', icon: '🔌', levelIds: [] },
  { id: 'safety-first', title: 'Safety First', tagline: 'Protection, gauges and earthing', icon: '🛡️', levelIds: [] },
  { id: 'fault-clinic', title: 'Fault Clinic', tagline: 'Find and fix the faults', icon: '🔧', levelIds: [] },
  { id: 'master-builder', title: 'Master Builder', tagline: 'Efficient, clean, complete', icon: '🏆', levelIds: [] },
];

/* ---------------------------------------------------------------------------
 * Levels
 * ------------------------------------------------------------------------- */

export const LEVELS: LevelDef[] = [
  {
    id: 'first-circuit.1',
    categoryId: 'first-circuit',
    title: 'Make it glow',
    difficulty: 1,
    intro: 'A lamp and a distribution board are on the bench. Wire them so the lamp lights up - every circuit needs a loop: live out, neutral back.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'componentCount', exact: 2 },
    ],
    hints: [
      'A circuit is a loop: power flows out on live (L) and returns on neutral (N).',
      'Drag from the lamp\u2019s L pin to the board\u2019s Way 1 L, then from the lamp\u2019s N pin to the board\u2019s N bus.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('lamp', 'bulb', 420, 120)]),
  },
  {
    id: 'first-circuit.2',
    categoryId: 'first-circuit',
    title: 'Shut it off',
    difficulty: 1,
    intro: 'A bare lamp is no good - you want to turn it off without pulling the fuse. Add a switch on the live conductor so the lamp is controlled.',
    objectives: [
      { kind: 'switchControls', loadNodeId: 'lamp' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'A switch always sits on the live conductor, in series between the power source and the lamp.',
      'Wire: board Way 1 L \u2192 switch L in, switch L out \u2192 lamp L in, lamp N \u2192 board N bus.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('sw', 'switch', 260, 120, { state: 'on' }), n('lamp', 'bulb', 500, 120)]),
  },
  {
    id: 'first-circuit.3',
    categoryId: 'first-circuit',
    title: 'Safe power',
    difficulty: 2,
    intro: 'The lamp works - but a short anywhere in the wiring could melt the cables. Feed the lamp through an MCB so the branch is protected.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'protectedBy', loadNodeId: 'lamp' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'The MCB protects the whole branch, so it must sit on the live feed before the lamp.',
      'Wire: board Way 1 L \u2192 MCB L in, MCB L out \u2192 lamp L in, lamp N \u2192 board N bus.',
      'Leave the MCB closed (state \u201Con\u201D) - it only opens when current exceeds its 16 A rating.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('mcb', 'mcb', 260, 120), n('lamp', 'bulb', 500, 120)]),
  },
  {
    id: 'first-circuit.4',
    categoryId: 'first-circuit',
    title: 'Two rooms',
    difficulty: 2,
    intro: 'The house grows: a lamp in one room and a fan in another, each with its own switch, both protected by one MCB.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'powered', nodeId: 'fan' },
      { kind: 'switchControls', loadNodeId: 'lamp' },
      { kind: 'switchControls', loadNodeId: 'fan' },
      { kind: 'protectedBy', loadNodeId: 'lamp' },
      { kind: 'protectedBy', loadNodeId: 'fan' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 6 },
    ],
    hints: [
      'One MCB can feed both rooms - split its output into two switch branches.',
      'MCB L out wires to both switches\u2019 L in; each switch L out feeds its own load.',
      'Both loads return to the board\u2019s N bus.',
    ],
    starter: starter([
      n('sb', 'switchboard', 0, 140),
      n('mcb', 'mcb', 230, 140),
      n('sw1', 'switch', 420, 80, { state: 'on' }),
      n('sw2', 'switch', 420, 220, { state: 'on' }),
      n('lamp', 'bulb', 620, 80),
      n('fan', 'fan', 620, 220),
    ]),
  },
];

/* ---------------------------------------------------------------------------
 * Lookups
 * ------------------------------------------------------------------------- */

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function categoryById(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function levelsInCategory(categoryId: string): LevelDef[] {
  const cat = categoryById(categoryId);
  if (!cat) return [];
  return cat.levelIds.map((id) => levelById(id)).filter((l): l is LevelDef => l !== undefined);
}

/** The complete linear unlock chain across every category, in play order. */
export function orderedLevelIds(): string[] {
  return CATEGORIES.flatMap((c) => c.levelIds);
}

/** Id of the level that unlocks after `levelId` (undefined for the finale). */
export function nextLevelId(levelId: string): string | undefined {
  const chain = orderedLevelIds();
  const i = chain.indexOf(levelId);
  return i >= 0 ? chain[i + 1] : undefined;
}