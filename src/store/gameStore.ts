import { create } from 'zustand';
import { CATEGORIES, LEVELS, levelById, nextLevelId, orderedLevelIds } from '../lessons/curriculum';
import { buildStarter } from '../lessons/starter';
import { BADGES, RANKS, type BadgeDef, type LevelProgress, type LevelResult, type RankDef } from '../lessons/types';
import type { CircuitDoc } from './serialization';
import { parseCircuitDoc, serializeCircuit } from './serialization';
import { useCircuitStore } from './circuitStore';

/**
 * Lesson-game store (PLAN.md Part 2). Holds the mode ('lessons' | 'playground'),
 * the in-lessons screen stack, the active level attempt, and the persisted
 * progress (per-level best stars, earned badges, remembered mode).
 *
 * Progress persists to localStorage (`zcircuit.progress`). Unlocking is a
 * strictly linear chain over the whole curriculum (orderedLevelIds): a level
 * is unlocked when its predecessor earned >= 1 star; the first level is always
 * unlocked. Playground circuits are snapshotted when a level starts and
 * restored when the player leaves for the Playground.
 */

export type Mode = 'lessons' | 'playground';
export type LessonsView = 'home' | 'select';

export const PROGRESS_KEY = 'zcircuit.progress';

/** Persisted shape: everything that should survive a reload. */
export interface SavedProgress {
  mode: Mode;
  levels: Record<string, LevelProgress>;
  badges: string[];
}

interface GameStoreState extends SavedProgress {
  /** Lessons screen below the level view (level view = activeLevelId set). */
  lessonsView: LessonsView;
  activeLevelId: string | null;
  /** Hints revealed on the current attempt (resets with start/restart). */
  hintsUsed: number;
  /** Bumped on every start/restart so one-shot completions never re-fire. */
  attempt: number;
  /** Intro card shown when a level starts (dismissed per level; restart keeps it dismissed). */
  showIntro: boolean;
  /** Latest judge evaluation of the active level (null outside a level). */
  levelResult: LevelResult | null;
  /** Completion payload shown in the modal; null = no modal. */
  completion: {
    levelId: string;
    result: LevelResult;
    earnedBadges: BadgeDef[];
    nextLevelId: string | null;
  } | null;
  /** Circuit the player had before the level started (restored on quit). */
  playgroundBackup: CircuitDoc | null;

  setMode: (mode: Mode) => void;
  openLessonsHome: () => void;
  openLevelSelect: () => void;
  startLevel: (levelId: string) => void;
  restartLevel: () => void;
  quitLevel: () => void;
  revealHint: () => void;
  dismissIntro: () => void;
  setLevelResult: (result: LevelResult) => void;
  completeLevel: (result: LevelResult) => void;
  dismissCompletion: () => void;
  nextFromCompletion: () => void;
}

/* ---------------------------------------------------------------------------
 * Pure progress helpers (exported for tests / rank UI)
 * ------------------------------------------------------------------------- */

export function starsTotal(levels: Record<string, LevelProgress>): number {
  return Object.values(levels).reduce((sum, p) => sum + (p.stars ?? 0), 0);
}

/** Max stars the current curriculum can award (63 once all 21 levels ship). */
export function maxStars(): number {
  return orderedLevelIds().length * 3;
}

/** Linear unlock chain: level unlocked when its predecessor has >= 1 star. */
export function isLevelUnlocked(
  levels: Record<string, LevelProgress>,
  levelId: string,
): boolean {
  const chain = orderedLevelIds();
  const idx = chain.indexOf(levelId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prev = levels[chain[idx - 1]];
  return (prev?.stars ?? 0) >= 1;
}

export function rankForTotalStars(total: number): RankDef {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (total >= rank.minStars) current = rank;
  }
  return current;
}

/** Rank above `total` stars (undefined at the top of the ladder). */
export function nextRank(total: number): RankDef | undefined {
  return RANKS.find((r) => r.minStars > total);
}

/** Stars banked inside the current rank, for a progress bar to the next rank. */
export function progressWithinRank(total: number): { into: number; span: number; next?: RankDef } {
  const current = rankForTotalStars(total);
  const next = nextRank(total);
  const span = (next?.minStars ?? maxStars()) - current.minStars;
  return { into: Math.max(0, Math.min(span, total - current.minStars)), span, next };
}

/**
 * Badge rules (PLAN.md Part 2). Each returns true when the current progress
 * satisfies it; categories/levels that do not exist yet simply never fire.
 */
function badgeConditions(levels: Record<string, LevelProgress>): Record<string, boolean> {
  const stars = (id: string) => levels[id]?.stars ?? 0;

  const categoryComplete = (categoryId: string, minStars: number) => {
    const cat = CATEGORIES.find((c) => c.id === categoryId);
    if (!cat || cat.levelIds.length === 0) return false;
    return cat.levelIds.every((id) => stars(id) >= minStars && levels[id] !== undefined);
  };

  const faultClinicClean = LEVELS.some(
    (l) => l.categoryId === 'fault-clinic' && stars(l.id) >= 1 && (levels[l.id]?.hintsUsed ?? 1) === 0,
  );

  // The finale badge targets only count once the full 21-level curriculum
  // exists (finale id 'master-builder.21' arrives with the Wave G3 content).
  const hasGrandDesign = LEVELS.some((l) => l.id === 'master-builder.21');
  return {
    sparky: categoryComplete('first-circuit', 1),
    'clean-hands': faultClinicClean,
    perfectionist: CATEGORIES.some((c) => c.levelIds.length > 0 && categoryComplete(c.id, 3)),
    'full-house': hasGrandDesign && stars('master-builder.21') >= 3,
    'master-electrician':
      hasGrandDesign && LEVELS.every((l) => stars(l.id) === 3),
  };
}

/** Ids of every badge currently earned by the given progress. */
export function earnedBadgeIds(levels: Record<string, LevelProgress>): string[] {
  const conds = badgeConditions(levels);
  return BADGES.filter((b) => conds[b.id]).map((b) => b.id);
}

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { mode: 'lessons', levels: {}, badges: [] };
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    if (parsed.mode !== 'lessons' && parsed.mode !== 'playground') return { mode: 'lessons', levels: {}, badges: [] };
    return {
      mode: parsed.mode ?? 'lessons',
      levels: (parsed.levels ?? {}) as Record<string, LevelProgress>,
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
    };
  } catch {
    return { mode: 'lessons', levels: {}, badges: [] };
  }
}

/* ---------------------------------------------------------------------------
 * Store
 * ------------------------------------------------------------------------- */

const initial = loadProgress();

export const useGameStore = create<GameStoreState>()((set, get) => ({
  mode: initial.mode,
  levels: initial.levels,
  badges: initial.badges,
  lessonsView: 'home',
  activeLevelId: null,
  hintsUsed: 0,
  attempt: 0,
  showIntro: false,
  levelResult: null,
  completion: null,
  playgroundBackup: null,

  setMode: (mode) => {
    // Leaving an unfinished level for the Playground discards the attempt and
    // restores the pre-lesson circuit (App asks for confirmation first).
    if (get().activeLevelId && mode === 'playground') {
      get().quitLevel();
    }
    set({ mode });
    const { levels, badges } = get();
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ mode, levels, badges } satisfies SavedProgress));
    } catch {
      /* storage unavailable - progress stays in memory */
    }
  },

  openLessonsHome: () => set({ mode: 'lessons', lessonsView: 'home' }),
  openLevelSelect: () => set({ mode: 'lessons', lessonsView: 'select' }),

  startLevel: (levelId) => {
    const level = levelById(levelId);
    if (!level) return;
    if (!isLevelUnlocked(get().levels, levelId)) return;

    // Snapshot whatever circuit is on the canvas (the Playground's work or an
    // empty one) so it can be restored when the player leaves for Playground.
    // Kept only once per lesson session: replaying/advancing levels must not
    // overwrite it with a previous level's solved circuit.
    const cs = useCircuitStore.getState();
    const backup = get().playgroundBackup ?? serializeCircuit(cs.nodes, cs.edges);
    set({ playgroundBackup: backup });

    const starter = buildStarter(level);
    cs.importCircuit(starter.nodes, starter.edges);
    set({
      mode: 'lessons',
      lessonsView: 'select',
      activeLevelId: levelId,
      hintsUsed: 0,
      attempt: get().attempt + 1,
      showIntro: true,
      levelResult: null,
      completion: null,
    });
  },

  restartLevel: () => {
    const levelId = get().activeLevelId;
    const level = levelId ? levelById(levelId) : undefined;
    if (!level) return;
    const starter = buildStarter(level);
    useCircuitStore.getState().importCircuit(starter.nodes, starter.edges);
    set({ hintsUsed: 0, attempt: get().attempt + 1, levelResult: null, completion: null });
  },

  quitLevel: () => {
    const backup = get().playgroundBackup;
    const cs = useCircuitStore.getState();
    if (backup) {
      const restored = parseCircuitDoc(JSON.stringify(backup));
      if (restored.ok) {
        cs.importCircuit(restored.nodes, restored.edges);
      } else {
        cs.newCircuit();
      }
    } else {
      cs.newCircuit();
    }
    set({
      activeLevelId: null,
      hintsUsed: 0,
      showIntro: false,
      levelResult: null,
      completion: null,
      playgroundBackup: null,
    });
  },

  revealHint: () => {
    const level = levelById(get().activeLevelId ?? '');
    if (!level) return;
    set({ hintsUsed: Math.min(get().hintsUsed + 1, level.hints.length) });
  },

  dismissIntro: () => set({ showIntro: false }),

  setLevelResult: (result) => set({ levelResult: result }),

  completeLevel: (result) => {
    if (!result.passed) return;
    const levelId = result.levelId;
    const prev = get().levels[levelId];
    const prevStars = prev?.stars ?? 0;
    const improved = result.stars > prevStars;

    // Keep the best stars; on a tie keep the run with fewer hints.
    const hintsUsed = get().hintsUsed;
    const nextLevels: Record<string, LevelProgress> = {
      ...get().levels,
      [levelId]: {
        stars: Math.max(prevStars, result.stars),
        hintsUsed:
          improved || prev === undefined
            ? hintsUsed
            : Math.min(prev.hintsUsed ?? 0, hintsUsed),
        completedAt: prev?.completedAt ?? Date.now(),
      },
    };

    const had = new Set(get().badges);
    const earned = earnedBadgeIds(nextLevels).filter((id) => !had.has(id));
    const nextBadges = [...get().badges, ...earned];

    set({ levels: nextLevels, badges: nextBadges });

    try {
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({ mode: get().mode, levels: nextLevels, badges: nextBadges } satisfies SavedProgress),
      );
    } catch {
      /* ignore */
    }

    const next = nextLevelId(levelId);
    set({
      completion: {
        levelId,
        result,
        earnedBadges: BADGES.filter((b) => earned.includes(b.id)),
        nextLevelId: next ?? null,
      },
    });
  },

  dismissCompletion: () => set({ completion: null }),

  nextFromCompletion: () => {
    const next = get().completion?.nextLevelId;
    get().dismissCompletion();
    if (next) get().startLevel(next);
  },
}));
