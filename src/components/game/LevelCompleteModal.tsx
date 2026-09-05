import { useEffect } from 'react';
import { progressWithinRank, rankForTotalStars, starsTotal, useGameStore } from '../../store/gameStore';
import { levelById } from '../../lessons/curriculum';
import type { LevelResult } from '../../lessons/types';

/** CSS-only confetti burst - tiny coloured squares that fall once on mount. */
function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => i);
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 12) * 0.06}s`,
            animationDuration: `${0.9 + (i % 5) * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

export function LevelCompleteModal() {
  const completion = useGameStore((s) => s.completion);
  const dismissCompletion = useGameStore((s) => s.dismissCompletion);
  const nextFromCompletion = useGameStore((s) => s.nextFromCompletion);
  const restartLevel = useGameStore((s) => s.restartLevel);
  const quitLevel = useGameStore((s) => s.quitLevel);
  const openLevelSelect = useGameStore((s) => s.openLevelSelect);
  const levels = useGameStore((s) => s.levels);

  const result: LevelResult | null = completion?.result ?? null;
  const total = starsTotal(levels);
  const levelTitle = completion ? levelById(completion.levelId)?.title ?? completion.levelId : '';

  useEffect(() => {
    if (!completion) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && completion.nextLevelId) nextFromCompletion();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [completion, nextFromCompletion]);

  if (!completion || !result) return null;
  const stars = result.stars;
  const rank = rankForTotalStars(total);
  const bar = progressWithinRank(total);

  const menu = () => {
    quitLevel();
    openLevelSelect();
  };

  return (
    <div
      data-testid="level-complete-modal"
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Level complete"
    >
      <Confetti />
      <div className="relative w-80 max-w-[90%] rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-emerald-500">
          Level complete
        </p>
        <h3 className="mt-1 text-center text-lg font-bold" data-testid="completion-title">
          {levelTitle}
        </h3>

        {/* Star reveal */}
        <div data-testid="completion-stars" className="mt-3 flex justify-center gap-1 text-4xl">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              data-testid={`completion-star-${i}`}
              data-filled={i <= stars ? 'true' : 'false'}
              className={`${i <= stars ? 'completion-star-pop text-amber-400' : 'text-slate-300 dark:text-slate-700'}`}
              style={i <= stars ? { animationDelay: `${0.25 + i * 0.2}s` } : undefined}
            >
              ★
            </span>
          ))}
        </div>

        {/* What each star required */}
        <ul className="mt-3 space-y-1">
          {result.starChecks.map((c) => (
            <li key={c.star} className="flex items-start gap-1.5 text-[11px]">
              <span
                data-testid={`star-check-${c.star}`}
                className={c.pass ? 'font-bold text-emerald-500' : 'text-slate-300 dark:text-slate-600'}
              >
                ★{c.star}
              </span>
              <span className={c.pass ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}>
                {c.reason}
              </span>
            </li>
          ))}
        </ul>

        {/* Badges earned */}
        {completion.earnedBadges.length > 0 && (
          <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-700">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Badges earned</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {completion.earnedBadges.map((b) => (
                <span
                  key={b.id}
                  data-testid="completion-badge"
                  title={b.description}
                  className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                >
                  {b.icon} {b.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rank progress */}
        <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-700">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {rank.title} · ★ {total}
            </span>
            <span>{bar.next ? `${bar.span - bar.into} to ${bar.next.title}` : 'MAX RANK'}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-700"
              style={{ width: `${bar.next ? Math.round((bar.into / bar.span) * 100) : 100}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          {completion.nextLevelId && (
            <button
              type="button"
              data-testid="next-level-btn"
              onClick={nextFromCompletion}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"
            >
              Next level ▶
            </button>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-testid="replay-btn"
              onClick={() => {
                dismissCompletion();
                restartLevel();
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ↺ Replay
            </button>
            <button
              type="button"
              data-testid="back-to-levels-btn"
              onClick={menu}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Back to levels
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
