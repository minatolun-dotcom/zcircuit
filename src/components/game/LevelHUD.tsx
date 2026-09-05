import { buildStarter } from '../../lessons/starter';
import { objectiveLabel } from '../../lessons/objectiveText';
import type { LevelDef } from '../../lessons/types';
import { useCircuitStore } from '../../store/circuitStore';
import { useGameStore } from '../../store/gameStore';
import { serializeCircuit } from '../../store/serialization';

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1 w-1 rounded-full ${i <= level ? 'bg-slate-400 dark:bg-slate-300' : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      ))}
    </span>
  );
}

/**
 * In-level HUD (PLAN.md Part 2): a strip across the top of the canvas showing
 * the live objective checklist (✓/○ per objective), the hint revealer,
 * and Restart / Undo / Redo / Exit actions. Judging is live (useLevelJudge),
 * so rows update the moment wiring changes.
 */
export function LevelHUD({ level }: { level: LevelDef }) {
  const result = useGameStore((s) => s.levelResult);
  const hintsUsed = useGameStore((s) => s.hintsUsed);
  const revealHint = useGameStore((s) => s.revealHint);
  const restartLevel = useGameStore((s) => s.restartLevel);
  const quitLevel = useGameStore((s) => s.quitLevel);
  const openLevelSelect = useGameStore((s) => s.openLevelSelect);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  const canUndo = useCircuitStore((s) => s.past.length > 0);
  const canRedo = useCircuitStore((s) => s.future.length > 0);

  const passedCount = result?.objectives.filter((o) => o.pass).length ?? 0;
  const total = level.objectives.length;
  const allPassed = result?.passed ?? false;

  const exit = () => {
    // Completed stars are already persisted; only warn when discarding unsolved
    // work (canvas differs from the starter circuit).
    if (allPassed) {
      quitLevel();
      openLevelSelect();
      return;
    }
    const cs = useCircuitStore.getState();
    const current = JSON.stringify(serializeCircuit(cs.nodes, cs.edges));
    const pristine = buildStarter(level);
    const starterJson = JSON.stringify(serializeCircuit(pristine.nodes, pristine.edges));
    const dirty = current !== starterJson;
    if (!dirty || window.confirm('Leave this level? Your unfinished wiring will be lost.')) {
      quitLevel();
      openLevelSelect();
    }
  };

  return (
    <div
      data-testid="level-hud"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {level.categoryId.replace('-', ' ')}
        </span>
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100" data-testid="level-title">
          {level.title}
        </h2>
        <DifficultyDots level={level.difficulty} />
      </div>

      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
        {level.objectives.map((obj, i) => {
          const row = result?.objectives[i];
          const pass = row?.pass ?? false;
          return (
            <li
              key={i}
              data-testid="objective-row"
              data-pass={pass ? 'true' : 'false'}
              title={row?.detail ?? objectiveLabel(obj, level)}
              className={`flex items-center gap-1 text-[11px] ${pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}
            >
              <span aria-hidden="true" className={pass ? 'font-bold' : ''}>
                {pass ? '✓' : '○'}
              </span>
              <span className="max-w-[10rem] truncate">{objectiveLabel(obj, level)}</span>
            </li>
          );
        })}
      </ul>

      <span
        data-testid="level-progress"
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
          allPassed
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}
      >
        {passedCount}/{total}
      </span>

      <div className="flex items-center gap-1.5">
        {hintsUsed > 0 && (
          <span
            data-testid="level-hint-count"
            title="Using a hint caps this level at two stars"
            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >
            💡 {hintsUsed}
          </span>
        )}
        <button
          type="button"
          data-testid="level-hint-btn"
          onClick={revealHint}
          disabled={hintsUsed >= level.hints.length}
          className="rounded border border-amber-300 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
        >
          💡 Hint
        </button>
        <button
          type="button"
          data-testid="level-undo-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
          className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ↶
        </button>
        <button
          type="button"
          data-testid="level-redo-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
          className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ↷
        </button>
        <button
          type="button"
          data-testid="level-restart-btn"
          onClick={restartLevel}
          title="Restart the level from its starter circuit"
          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ↺ Restart
        </button>
        <button
          type="button"
          data-testid="level-exit-btn"
          onClick={exit}
          title="Leave the level"
          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ✕ Exit
        </button>
      </div>
    </div>
  );
}
