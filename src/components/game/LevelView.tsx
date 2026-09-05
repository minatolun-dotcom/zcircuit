import { useEffect } from 'react';
import { FlowCanvas } from '../canvas/FlowCanvas';
import { Palette } from '../sidebar/Palette';
import { PropertiesPanel } from '../sidebar/PropertiesPanel';
import { SimulationToolbar } from '../toolbar/SimulationToolbar';
import { levelById } from '../../lessons/curriculum';
import { useCircuitStore } from '../../store/circuitStore';
import { useGameStore } from '../../store/gameStore';
import { useLevelJudge } from '../../hooks/useLevelJudge';
import { LevelCompleteModal } from './LevelCompleteModal';
import { LevelHUD } from './LevelHUD';
import { LevelIntroCard } from './LevelIntroCard';

/**
 * In-level screen: the Playground canvas/palette/properties layout with the
 * lesson HUD strip, live judging (useLevelJudge), the shrunk lesson toolbar
 * (Run/Pause/speed only - the analysis toggles would spoil answers) and the
 * completion modal once all objectives turn green.
 */
export function LevelView() {
  const activeLevelId = useGameStore((s) => s.activeLevelId);
  const attempt = useGameStore((s) => s.attempt);
  const completion = useGameStore((s) => s.completion);
  const showIntro = useGameStore((s) => s.showIntro);
  const dismissIntro = useGameStore((s) => s.dismissIntro);
  const revealHint = useGameStore((s) => s.revealHint);
  const restartLevel = useGameStore((s) => s.restartLevel);
  const quitLevel = useGameStore((s) => s.quitLevel);
  const openLevelSelect = useGameStore((s) => s.openLevelSelect);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  useLevelJudge();
  const level = activeLevelId ? levelById(activeLevelId) : undefined;

  // In-level keyboard shortcuts (h hint, r restart, u undo, y redo, Esc exit).
  // Ignored while typing in a field or when the completion modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (completion) return;
      const key = e.key.toLowerCase();
      if (showIntro) {
        if (key === 'escape') {
          e.preventDefault();
          dismissIntro();
        }
        return;
      }
      switch (key) {
        case 'h':
          e.preventDefault();
          revealHint();
          break;
        case 'r':
          e.preventDefault();
          restartLevel();
          break;
        case 'u':
          e.preventDefault();
          undo();
          break;
        case 'y':
          e.preventDefault();
          redo();
          break;
        case 'escape':
          e.preventDefault();
          quitLevel();
          openLevelSelect();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [completion, showIntro, dismissIntro, revealHint, restartLevel, quitLevel, openLevelSelect, undo, redo]);

  if (!level) return null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <Palette />
        <main className="flex min-w-0 flex-1 flex-col bg-slate-200/70 dark:bg-slate-900">
          <LevelHUD level={level} />
          <div className="relative min-h-0 flex-1">
            <FlowCanvas key={`${level.id}-${attempt}`} />
            <LevelIntroCard level={level} />
            <LevelCompleteModal />
          </div>
        </main>
        <PropertiesPanel />
      </div>
      <SimulationToolbar variant="lesson" />
    </div>
  );
}
