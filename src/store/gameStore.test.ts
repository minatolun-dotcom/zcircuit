import { beforeEach, describe, expect, it } from 'vitest';
import type { LevelResult, ObjectiveResult, StarCheck } from '../lessons/types';
import { useCircuitStore } from './circuitStore';
import { earnedBadgeIds, isLevelUnlocked, PROGRESS_KEY, starsTotal, useGameStore } from './gameStore';

function reset() {
  localStorage.clear();
  useCircuitStore.setState({
    nodes: [],
    edges: [],
    notice: null,
    past: [],
    future: [],
    simulationRunning: false,
    simulationSpeed: 1,
    simResult: null,
    validation: null,
    optimization: null,
    validationEnabled: false,
    optimizationEnabled: false,
    gridVisible: true,
    waveformOpen: false,
  });
  useGameStore.setState({
    mode: 'lessons',
    levels: {},
    badges: [],
    lessonsView: 'home',
    activeLevelId: null,
    hintsUsed: 0,
    attempt: 0,
    showIntro: false,
    levelResult: null,
    completion: null,
    playgroundBackup: null,
  });
}

beforeEach(reset);

function starChecks(stars: number): StarCheck[] {
  return [1, 2, 3].map((s) => ({
    star: s as 1 | 2 | 3,
    pass: s <= stars,
    reason: '',
  }));
}

function result(levelId: string, stars: number): LevelResult {
  const objectives: ObjectiveResult[] = [{ ref: { kind: 'noTrips' }, pass: stars >= 1, detail: '' }];
  return {
    levelId,
    passed: stars >= 1,
    objectives,
    stars,
    starChecks: starChecks(stars),
  };
}

describe('game store: mode & screens', () => {
  it('boots to lessons home by default', () => {
    const s = useGameStore.getState();
    expect(s.mode).toBe('lessons');
    expect(s.lessonsView).toBe('home');
    expect(s.activeLevelId).toBeNull();
  });

  it('switches to playground and persists the mode', () => {
    useGameStore.getState().setMode('playground');
    expect(useGameStore.getState().mode).toBe('playground');
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}');
    expect(saved.mode).toBe('playground');
  });
});

describe('game store: level lifecycle', () => {
  it('startLevel loads the starter circuit and snapshots the canvas', () => {
    // A Playground circuit exists before the level starts.
    const { addComponent } = useCircuitStore.getState();
    addComponent('mcb', { x: 10, y: 10 });
    expect(useCircuitStore.getState().nodes).toHaveLength(1);

    useGameStore.getState().startLevel('first-circuit.1');
    const s = useGameStore.getState();
    expect(s.activeLevelId).toBe('first-circuit.1');
    expect(s.attempt).toBe(1);
    expect(useCircuitStore.getState().nodes).toHaveLength(2); // switchboard + bulb
    expect(useCircuitStore.getState().edges).toHaveLength(0);
    expect(s.playgroundBackup).not.toBeNull();
  });

  it('refuses locked levels', () => {
    useGameStore.getState().startLevel('first-circuit.2');
    expect(useGameStore.getState().activeLevelId).toBeNull();
    expect(useCircuitStore.getState().nodes).toHaveLength(0);
  });

  it('restarts reset the hints and circuit', () => {
    useGameStore.getState().startLevel('first-circuit.1');
    useGameStore.getState().revealHint();
    useGameStore.getState().restartLevel();
    const s = useGameStore.getState();
    expect(s.hintsUsed).toBe(0);
    expect(s.attempt).toBe(2);
    expect(useCircuitStore.getState().nodes).toHaveLength(2);
  });

  it('the intro card shows on start and stays dismissed across restarts', () => {
    useGameStore.getState().startLevel('first-circuit.1');
    expect(useGameStore.getState().showIntro).toBe(true);
    useGameStore.getState().dismissIntro();
    expect(useGameStore.getState().showIntro).toBe(false);
    useGameStore.getState().restartLevel();
    expect(useGameStore.getState().showIntro).toBe(false); // no re-brief on retry
  });

  it('advancing to the next level re-shows the intro card', () => {
    useGameStore.getState().startLevel('first-circuit.1');
    useGameStore.getState().dismissIntro();
    useGameStore.getState().completeLevel(result('first-circuit.1', 1));
    useGameStore.getState().nextFromCompletion();
    expect(useGameStore.getState().activeLevelId).toBe('first-circuit.2');
    expect(useGameStore.getState().showIntro).toBe(true);
  });

  it('quitLevel restores the pre-level circuit', () => {
    const { addComponent } = useCircuitStore.getState();
    addComponent('fan', { x: 40, y: 40 });
    useGameStore.getState().startLevel('first-circuit.1');
    expect(useCircuitStore.getState().nodes).toHaveLength(2);

    useGameStore.getState().quitLevel();
    const s = useGameStore.getState();
    expect(s.activeLevelId).toBeNull();
    expect(s.playgroundBackup).toBeNull();
    expect(useCircuitStore.getState().nodes).toHaveLength(1);
    expect(useCircuitStore.getState().nodes[0].data.componentType).toBe('fan');
  });

  it('revealHint caps at the level hint count', () => {
    useGameStore.getState().startLevel('first-circuit.1');
    const { revealHint } = useGameStore.getState();
    revealHint();
    revealHint();
    revealHint();
    expect(useGameStore.getState().hintsUsed).toBe(2); // L1 has two hints
  });

  it('switching to playground while in a level quits it', () => {
    useGameStore.getState().startLevel('first-circuit.1');
    useGameStore.getState().completeLevel(result('first-circuit.1', 2));
    useGameStore.getState().setMode('playground');
    const s = useGameStore.getState();
    expect(s.mode).toBe('playground');
    expect(s.activeLevelId).toBeNull();
  });
});

describe('game store: stars, unlocks & badges', () => {
  it('records the best stars and unlocks the next level', () => {
    const g = useGameStore.getState();
    g.startLevel('first-circuit.1');
    g.completeLevel(result('first-circuit.1', 2));
    expect(useGameStore.getState().levels['first-circuit.1']?.stars).toBe(2);
    expect(isLevelUnlocked(useGameStore.getState().levels, 'first-circuit.2')).toBe(true);
    expect(isLevelUnlocked(useGameStore.getState().levels, 'first-circuit.3')).toBe(false);
  });

  it('keeps the best run when replaying with fewer stars', () => {
    const g = useGameStore.getState();
    g.startLevel('first-circuit.1');
    g.completeLevel(result('first-circuit.1', 3));
    g.restartLevel();
    g.completeLevel(result('first-circuit.1', 1));
    expect(useGameStore.getState().levels['first-circuit.1']?.stars).toBe(3);
  });

  it('awards the Sparky badge when the first category is finished', () => {
    const g = useGameStore.getState();
    for (const id of ['first-circuit.1', 'first-circuit.2', 'first-circuit.3', 'first-circuit.4']) {
      g.startLevel(id);
      g.completeLevel(result(id, 1));
    }
    const badges = useGameStore.getState().badges;
    expect(badges).toContain('sparky');
    expect(useGameStore.getState().completion?.earnedBadges.map((b) => b.id)).toContain('sparky');
    expect(earnedBadgeIds(useGameStore.getState().levels)).toContain('sparky');
  });

  it('persists progress to localStorage on completion', () => {
    const g = useGameStore.getState();
    g.startLevel('first-circuit.1');
    g.completeLevel(result('first-circuit.1', 3));
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}');
    expect(saved.levels['first-circuit.1']?.stars).toBe(3);
    expect(starsTotal(useGameStore.getState().levels)).toBe(3);
  });

  it('completion drives the modal payload with earned badges', () => {
    const g = useGameStore.getState();
    g.startLevel('first-circuit.1');
    g.completeLevel(result('first-circuit.1', 3));
    const c = useGameStore.getState().completion;
    expect(c?.levelId).toBe('first-circuit.1');
    expect(c?.nextLevelId).toBe('first-circuit.2');
    expect(c?.result.stars).toBe(3);
  });

  it('nextFromCompletion starts the next level', () => {
    const g = useGameStore.getState();
    g.startLevel('first-circuit.1');
    g.completeLevel(result('first-circuit.1', 1));
    g.nextFromCompletion();
    expect(useGameStore.getState().activeLevelId).toBe('first-circuit.2');
    expect(useGameStore.getState().completion).toBeNull();
  });
});
