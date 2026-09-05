import { CATEGORIES, LEVELS, levelById, orderedLevelIds } from '../../lessons/curriculum';
import { BADGES, rankForStars } from '../../lessons/types';
import { progressWithinRank, starsTotal, useGameStore } from '../../store/gameStore';

/** First curriculum level without any stars yet (drives the "Continue" card). */
function nextUnbeatenLevelId(levels: Record<string, number | undefined>): string | undefined {
  return orderedLevelIds().find((id) => (levels[id] ?? 0) < 1);
}

export function HomeScreen() {
  const setMode = useGameStore((s) => s.setMode);
  const openLevelSelect = useGameStore((s) => s.openLevelSelect);
  const levels = useGameStore((s) => s.levels);
  const badges = useGameStore((s) => s.badges);

  const total = starsTotal(levels);
  const rank = rankForStars(total);
  const bar = progressWithinRank(total);
  const next = nextUnbeatenLevelId(
    Object.fromEntries(Object.entries(levels).map(([id, p]) => [id, p.stars])),
  );
  const nextLevel = next ? levelById(next) : undefined;
  const categoryCount = CATEGORIES.reduce((n, c) => n + c.levelIds.length, 0);

  return (
    <div data-testid="home-screen" className="panel-scroll flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-10">
        <header className="text-center">
          <p className="text-4xl">⚡</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Wiring Practice</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Build real circuits, learn by doing, earn your stripes.
          </p>
        </header>

        {/* Rank + badges summary */}
        <div
          data-testid="rank-card"
          className="w-full rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Rank
              </p>
              <p className="text-lg font-bold" data-testid="rank-title">{rank.title}</p>
            </div>
            <p className="text-right text-sm font-semibold" data-testid="rank-stars">
              ★ {total}
              <span className="text-slate-400 dark:text-slate-500"> / {bar.next ? `${bar.next.minStars} (${bar.next.title})` : 'MAX'}</span>
            </p>
          </div>
          {bar.next && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  data-testid="rank-progress"
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${Math.round((bar.into / bar.span) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                {bar.span - bar.into} star{bar.span - bar.into === 1 ? '' : 's'} to {bar.next.title}
              </p>
            </div>
          )}
          {badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              {BADGES.filter((b) => badges.includes(b.id)).map((b) => (
                <span
                  key={b.id}
                  data-testid="earned-badge"
                  title={b.description}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                >
                  {b.icon} {b.title}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Mode cards */}
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <button
            type="button"
            data-testid="home-lessons-card"
            onClick={openLevelSelect}
            className="group rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 text-left transition hover:border-indigo-400 hover:shadow-md dark:border-indigo-900 dark:from-indigo-950/60 dark:to-slate-900 dark:hover:border-indigo-600"
          >
            <p className="text-2xl">🎓</p>
            <h3 className="mt-2 text-lg font-bold">Guided Lessons</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {LEVELS.length} levels across {CATEGORIES.filter((c) => c.levelIds.length > 0).length} categories -
              wire circuits, fix faults and beat the par.
            </p>
            {nextLevel ? (
              <p className="mt-3 inline-block rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                Continue: {nextLevel.title} ▶
              </p>
            ) : (
              <p className="mt-3 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                {categoryCount > 0 ? 'All levels beaten - replay any level' : 'Start learning'}
              </p>
            )}
          </button>

          <button
            type="button"
            data-testid="home-playground-card"
            onClick={() => setMode('playground')}
            className="group rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 text-left transition hover:border-sky-400 hover:shadow-md dark:border-sky-900 dark:from-sky-950/60 dark:to-slate-900 dark:hover:border-sky-600"
          >
            <p className="text-2xl">🛠️</p>
            <h3 className="mt-2 text-lg font-bold">Playground</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Free build &amp; simulate anything - drag components, wire them up, run the solver. No
              objectives, no limits.
            </p>
            <p className="mt-3 inline-block rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
              Open the sandbox ▶
            </p>
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600">
          {categoryCount} level{categoryCount === 1 ? '' : 's'} · ★1 all objectives · ★★ zero errors · ★★★ beat the par
        </p>
      </div>
    </div>
  );
}
