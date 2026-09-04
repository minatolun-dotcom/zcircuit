import { useEffect } from 'react';
import { analyzeCircuit } from '../engine/optimization';
import { simulateCircuit } from '../engine/simulation';
import { validateCircuit } from '../engine/validation';
import { useCircuitStore } from './circuitStore';

/**
 * Live analyses: while the simulation is running or an analysis panel is open,
 * recompute the solver / validation / optimization reports whenever the
 * circuit changes. The engines stay pure - this hook only refreshes derived
 * results kept next to the circuit state, so the UI (node readouts, colour
 * highlighting, panel lists) reacts to edits without blocking anything.
 */
export function useLiveAnalyses(): void {
  const nodes = useCircuitStore((s) => s.nodes);
  const edges = useCircuitStore((s) => s.edges);
  const running = useCircuitStore((s) => s.simulationRunning);
  const validationEnabled = useCircuitStore((s) => s.validationEnabled);
  const optimizationEnabled = useCircuitStore((s) => s.optimizationEnabled);

  useEffect(() => {
    if (!running && !validationEnabled && !optimizationEnabled) return;
    const { nodes: n, edges: e } = useCircuitStore.getState();
    const sim = simulateCircuit(n, e);
    const patch: {
      simResult: typeof sim;
      validation?: ReturnType<typeof validateCircuit>;
      optimization?: ReturnType<typeof analyzeCircuit>;
    } = { simResult: sim };
    if (validationEnabled) patch.validation = validateCircuit(n, e, sim);
    if (optimizationEnabled) patch.optimization = analyzeCircuit(n, e, sim);
    useCircuitStore.setState(patch);
  }, [nodes, edges, running, validationEnabled, optimizationEnabled]);
}
