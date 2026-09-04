import type { CircuitDoc } from '../store/serialization';

/**
 * Guided-lesson game (PLAN.md Part 2). A level is a starter circuit (or empty
 * canvas) plus a set of machine-checkable objectives. The level judge
 * (judge.ts) evaluates objectives against the same pure engines that power the
 * Playground - simulation, validation, optimization - so a level never needs
 * bespoke simulation logic, only assertions on engine output.
 */

/**
 * Objective grammar. Every kind is judgeable from (nodes, edges) plus the
 * engine reports; id-based kinds reference components from the level's starter
 * circuit (players add their own components with runtime ids, which is why
 * 'protectedBy' exists - it finds any conducting MCB on the load's live path).
 */
export type Objective =
  | { kind: 'powered'; nodeId: string }
  | { kind: 'off'; nodeId: string }
  | { kind: 'tripped'; nodeId: string }
  | { kind: 'noTrips' }
  | { kind: 'energized'; nodeId: string }
  | { kind: 'wired'; from: string; to: string }
  | { kind: 'noFindings'; severity?: 'error' | 'warning' | 'info' }
  | { kind: 'currentUnder'; nodeId: string; maxA: number }
  | { kind: 'wireLengthUnder'; maxPx: number }
  | { kind: 'gaugeAtLeast'; nodeId: string; sizeMm2: number }
  | { kind: 'componentCount'; atLeast?: number; exact?: number }
  | { kind: 'switchControls'; loadNodeId: string }
  | { kind: 'protectedBy'; loadNodeId: string }
  | { kind: 'warningsUnder'; max: number }
  | { kind: 'all'; items: Objective[] }
  | { kind: 'any'; items: Objective[] };

/** Efficiency budgets for the third star. Omitted sides fall back to defaults. */
export interface LevelPar {
  /** Max total routed wire length in px (default: generous 4000). */
  wireBudgetPx?: number;
  /** Max optimization warnings (crossings, overloads; default 0). */
  warningAllowance?: number;
}

export interface LevelDef {
  /** Unique id, e.g. 'first-circuit.1'. */
  id: string;
  categoryId: string;
  title: string;
  /** 1 (easiest) .. 5 (hardest), shown as dots on the level card. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** One-two sentence context/story shown on the intro card. */
  intro: string;
  objectives: Objective[];
  /** Progressive hints, revealed one at a time; using any caps stars at 2. */
  hints: string[];
  /** Starter circuit in the save/load JSON format; absent = empty canvas. */
  starter?: CircuitDoc;
  par?: LevelPar;
}

export interface CategoryDef {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  /** Level ids in play order - the linear unlock chain runs through these. */
  levelIds: string[];
}

/* --------------------------------------------------------------------------- */

export interface LevelProgress {
  /** Best stars earned (1-3); absent means not completed. */
  stars: number;
  /** Hints used on the best (star) run. */
  hintsUsed: number;
  completedAt?: number;
}

export interface ProgressState {
  levels: Record<string, LevelProgress>;
  /** Earned badge ids. */
  badges: string[];
  mode: 'lessons' | 'playground';
  activeLevelId: string | null;
  /** Hints revealed during the current attempt (reset on start/restart). */
  hintsUsed: number;
}

/** Per-objective outcome with a human-readable explanation for the HUD. */
export interface ObjectiveResult {
  ref: Objective;
  pass: boolean;
  detail: string;
}

export interface StarCheck {
  star: 1 | 2 | 3;
  pass: boolean;
  reason: string;
}

export interface LevelResult {
  levelId: string;
  passed: boolean;
  objectives: ObjectiveResult[];
  stars: number;
  starChecks: StarCheck[];
}

/* --------------------------------------------------------------------------- */

export interface RankDef {
  id: string;
  title: string;
  /** Total stars needed to reach this rank. */
  minStars: number;
}

export interface BadgeDef {
  id: string;
  title: string;
  icon: string;
  description: string;
}

/** Rank ladder driven by total stars (21 levels x 3 stars = 63 max). */
export const RANKS: RankDef[] = [
  { id: 'apprentice', title: 'Apprentice', minStars: 0 },
  { id: 'helper', title: 'Helper', minStars: 10 },
  { id: 'journeyman', title: 'Journeyman', minStars: 20 },
  { id: 'electrician', title: 'Electrician', minStars: 30 },
  { id: 'lead', title: 'Lead', minStars: 40 },
  { id: 'master', title: 'Master', minStars: 50 },
];

export const BADGES: BadgeDef[] = [
  { id: 'sparky', title: 'Sparky', icon: '🐣', description: 'Finish the First Circuit category.' },
  { id: 'clean-hands', title: 'Clean hands', icon: '🧼', description: 'Finish a Fault Clinic level without using hints.' },
  { id: 'perfectionist', title: 'Perfectionist', icon: '💯', description: 'Earn 3 stars on every level of a category.' },
  { id: 'full-house', title: 'Full house', icon: '🏠', description: 'Earn 3 stars on Grand design.' },
  { id: 'master-electrician', title: 'Master electrician', icon: '👑', description: 'Earn 3 stars on every level.' },
];

export function rankForStars(stars: number): RankDef {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (stars >= rank.minStars) current = rank;
  }
  return current;
}

/** Generous defaults used when a level declares no par for that side. */
export const DEFAULT_WIRE_BUDGET_PX = 4000;
export const DEFAULT_WARNING_ALLOWANCE = 0;