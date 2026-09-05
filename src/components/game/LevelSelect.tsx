import { CATEGORIES, levelById, levelsInCategory } from '../../lessons/curriculum';
import { isLevelUnlocked, useGameStore } from '../../store/gameStore';

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= level ? 'bg-slate-500 dark:bg-slate-300' : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      ))}
    </span>
  );
}

function Stars({ id, earned }: { id: string; earned: number }) {
  return (
    <span data-testid={`level-stars-${id}`} className="text-sm tracking-tighter">
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= earned ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}>
          ★
        </span>
      ))}
    </span>
  );
}

function LevelCard({ levelId, index }: { levelId: string; index: number }) {
  const levels = useGameStore((s) => s.levels);
  const startLevel = useGameStore((s) => s.startLevel);
  const level = levelById(levelId);
  const unlocked = isLevelUnlocked(levels, levelId);
  const entry = levels[levelId];
  if (!level) return null;

  return (
    <button
      type="button"
      data-testid={`level-card-${level.id}`}
      data-locked={unlocked ? undefined : 'true'}
      disabled={!unlocked}
      onClick={() => unlocked && startLevel(level.id)}
      title={unlocked ? level.intro : 'Complete the previous level to unlock this one'}
      className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition ${
        unlocked
          ? 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500'
          : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300">
          {index + 1}
        </span>
        {unlocked ? <Stars id={level.id} earned={entry?.stars ?? 0} /> : <span className="text-slate-400">🔒</span>}
      </div>
      <span className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">{level.title}</span>
      <DifficultyDots level={level.difficulty} />
    </button>
  );
}

export function LevelSelect() {
  const openLessonsHome = useGameStore((s) => s.openLessonsHome);
  const levels = useGameStore((s) => s.levels);

  return (
    <div data-testid="level-select" className="panel-scroll flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">🎓 Choose a lesson</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Beat each level to unlock the next one in the chain.
            </p>
          </div>
          <button
            type="button"
            data-testid="back-home-btn"
            onClick={openLessonsHome}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ← Home
          </button>
        </div>

        {CATEGORIES.map((cat, catIndex) => {
          const catLevels = levelsInCategory(cat.id);
          const beat = catLevels.filter((l) => (levels[l.id]?.stars ?? 0) >= 1).length;
          const allThree = catLevels.length > 0 && catLevels.every((l) => (levels[l.id]?.stars ?? 0) >= 3);
          const firstLocked = catLevels.length > 0 && !isLevelUnlocked(levels, catLevels[0].id);

          return (
            <section key={cat.id} data-testid={`category-${cat.id}`} className="mb-8">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {cat.icon} {cat.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{cat.tagline}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                  {catLevels.length > 0 &&
                    (firstLocked ? (
                      <span data-testid={`category-locked-${cat.id}`}>🔒 locked</span>
                    ) : (
                      <>
                        <span data-testid={`category-progress-${cat.id}`}>
                          {beat}/{catLevels.length} done
                        </span>
                        {allThree && <span className="font-semibold text-amber-500">★ perfect</span>}
                      </>
                    ))}
                  {catLevels.length === 0 && (
                    <span>
                      {catIndex === 0
                        ? 'coming soon'
                        : `unlocks after ${CATEGORIES[catIndex - 1].title}`}
                    </span>
                  )}
                </div>
              </div>

              {catLevels.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  {catIndex === 0
                    ? 'Levels coming soon.'
                    : `Complete ${CATEGORIES[catIndex - 1].title} to unlock this category.`}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid={`level-grid-${cat.id}`}>
                  {catLevels.map((l, i) => (
                    <LevelCard key={l.id} levelId={l.id} index={i} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
