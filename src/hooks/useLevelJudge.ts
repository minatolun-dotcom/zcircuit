import { useEffect, useRef } from 'react';
import { analyzeCircuit } from '../engine/optimization';
import { simulateCircuit } from '../engine/simulation';
import { validateCircuit } from '../engine/validation';
import { evaluateLevel } from '../lessons/judge';
import { levelById } from '../lessons/curriculum';
import { useCircuitStore } from '../store/circuitStore';
import { useGameStore } from '../store/gameStore';

/**
 * Live lesson judging (PLAN.md Part 2). While a level is active, every circuit
 * change re-runs the pure engines (simulate / validate / optimize) and the
 * level judge over them, so the objective checklist updates the instant wiring
 * changes - no Submit step. The simulation result is mirrored into the circuit
 * store so node readouts render live; validation/optimization reports are NOT
 * (their toggles are hidden in lessons and exposing them would spoil
 * fault-finding levels). The first time all objectives turn green it calls
 * completeLevel() once per attempt, which opens the completion modal.
 */
export function useLevelJudge(): void {
  const nodes = useCircuitStore((s) => s.nodes);
  const edges = useCircuitStore((s) => s.edges);
  const activeLevelId = useGameStore((s) => s.activeLevelId);
  const hintsUsed = useGameStore((s) => s.hintsUsed);
  const attempt = useGameStore((s) => s.attempt);

  const wasPassed = useRef(false);
  const completedAttempt = useRef<number | null>(null);

  const level = activeLevelId ? levelById(activeLevelId) : undefined;

  useEffect(() => {
    if (!level) return;
    const sim = simulateCircuit(nodes, edges);
    const validation = validateCircuit(nodes, edges, sim);
    const optimization = analyzeCircuit(nodes, edges, sim);

    // Mirror only the simulation result: node readouts / glow stay live,
    // while validation findings stay off-canvas so fault levels aren't spoiled.
    useCircuitStore.setState({ simResult: sim });

    const result = evaluateLevel(nodes, edges, level, { sim, validation, optimization, hintsUsed });
    useGameStore.getState().setLevelResult(result);

    const passed = result.passed;
    const fire = passed && !wasPassed.current && completedAttempt.current !== attempt;
    wasPassed.current = passed;
    if (fire) {
      completedAttempt.current = attempt;
      useGameStore.getState().completeLevel(result);
    }
  }, [nodes, edges, level, hintsUsed, attempt]);
}
