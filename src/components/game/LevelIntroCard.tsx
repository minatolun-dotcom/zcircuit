import { objectiveLabel } from '../../lessons/objectiveText';
import { categoryById } from '../../lessons/curriculum';
import type { LevelDef } from '../../lessons/types';
import { useGameStore } from '../../store/gameStore';

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= level ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      ))}
    </span>
  );
}

/**
 * Level intro card (PLAN.md Part 2): the mission brief shown the moment a
 * level starts - story, objectives checklist, difficulty dots and how many
 * hints are on offer. Dismissed with "Start building"; replaying a level
 * (Restart) skips it.
 */
export function LevelIntroCard({ level }: { level: LevelDef }) {
  const showIntro = useGameStore((s) => s.showIntro);
  const dismissIntro = useGameStore((s) => s.dismissIntro);
  const category = categoryById(level.categoryId);

  if (!showIntro) return null;

  return (
    <div
      data-testid="level-intro-modal"
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Level intro"
    >
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">
          {category?.icon} {category?.title ?? level.categoryId}
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold" data-testid="intro-title">
            {level.title}
          </h3>
          <DifficultyDots level={level.difficulty} />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300" data-testid="intro-story">
          {level.intro}
        </p>

        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Objectives
          </p>
          <ul className="mt-1.5 space-y-1">
            {level.objectives.map((obj, i) => (
              <li
                key={i}
                data-testid={`intro-objective-${i}`}
                className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                <span>{objectiveLabel(obj, level)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          💡 {level.hints.length} hint{level.hints.length === 1 ? '' : 's'} available - using any hint caps
          this level at ★★.
        </p>

        <button
          type="button"
          data-testid="intro-start-btn"
          onClick={dismissIntro}
          className="mt-4 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-indigo-500"
        >
          Start building ▶
        </button>
      </div>
    </div>
  );
}