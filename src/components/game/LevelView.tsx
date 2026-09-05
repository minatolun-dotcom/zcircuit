import { FlowCanvas } from '../canvas/FlowCanvas';
import { Palette } from '../sidebar/Palette';
import { PropertiesPanel } from '../sidebar/PropertiesPanel';
import { SimulationToolbar } from '../toolbar/SimulationToolbar';
import { levelById } from '../../lessons/curriculum';
import { useGameStore } from '../../store/gameStore';
import { useLevelJudge } from '../../hooks/useLevelJudge';
import { LevelCompleteModal } from './LevelCompleteModal';
import { LevelHUD } from './LevelHUD';

/**
 * In-level screen: the Playground canvas/palette/properties layout with the
 * lesson HUD strip, live judging (useLevelJudge), the shrunk lesson toolbar
 * (Run/Pause/speed only - the analysis toggles would spoil answers) and the
 * completion modal once all objectives turn green.
 */
export function LevelView() {
  const activeLevelId = useGameStore((s) => s.activeLevelId);
  const attempt = useGameStore((s) => s.attempt);
  useLevelJudge();
  const level = activeLevelId ? levelById(activeLevelId) : undefined;

  if (!level) return null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <Palette />
        <main className="flex min-w-0 flex-1 flex-col bg-slate-200/70 dark:bg-slate-900">
          <LevelHUD level={level} />
          <div className="relative min-h-0 flex-1">
            <FlowCanvas key={`${level.id}-${attempt}`} />
            <LevelCompleteModal />
          </div>
        </main>
        <PropertiesPanel />
      </div>
      <SimulationToolbar variant="lesson" />
    </div>
  );
}
