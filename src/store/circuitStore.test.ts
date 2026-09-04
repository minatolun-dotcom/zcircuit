import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from './circuitStore';
import { parseCircuitDoc, serializeCircuit } from './serialization';

function reset() {
  useCircuitStore.setState({
    nodes: [],
    edges: [],
    notice: null,
    past: [],
    future: [],
    simulationRunning: false,
    simulationSpeed: 1,
  });
}

beforeEach(reset);

describe('circuit store', () => {
  it('adds components at the requested position', () => {
    const id = useCircuitStore.getState().addComponent('mcb', { x: 40, y: 60 });
    const node = useCircuitStore.getState().nodes[0];
    expect(node.id).toBe(id);
    expect(node.data.componentType).toBe('mcb');
    expect(node.position).toEqual({ x: 40, y: 60 });
    expect(node.data.props.ratedCurrentA).toBe(16);
  });

  it('connects two terminals of different components', () => {
    const { addComponent, connect } = useCircuitStore.getState();
    const a = addComponent('mcb', { x: 0, y: 0 });
    const b = addComponent('bulb', { x: 300, y: 0 });
    const ok = connect({
      source: a,
      target: b,
      sourceHandle: 'l-out::src',
      targetHandle: 'l-in::tgt',
    });
    expect(ok).toBe(true);
    const edge = useCircuitStore.getState().edges[0];
    expect(edge.source).toBe(a);
    expect(edge.target).toBe(b);
    expect(edge.data).toEqual({ fromTerminal: 'l-out', toTerminal: 'l-in' });
  });

  it('rejects wires within the same component', () => {
    const { addComponent, connect } = useCircuitStore.getState();
    const a = addComponent('inverter', { x: 0, y: 0 });
    const ok = connect({
      source: a,
      target: a,
      sourceHandle: 'out-l::src',
      targetHandle: 'ac-l-in::tgt',
    });
    expect(ok).toBe(false);
    expect(useCircuitStore.getState().notice).toMatch(/different components/i);
    expect(useCircuitStore.getState().edges).toHaveLength(0);
  });

  it('rejects duplicate connections in either direction', () => {
    const { addComponent, connect } = useCircuitStore.getState();
    const a = addComponent('switch', { x: 0, y: 0 });
    const b = addComponent('bulb', { x: 300, y: 0 });
    const first = connect({
      source: a,
      target: b,
      sourceHandle: 'l-out::src',
      targetHandle: 'l-in::tgt',
    });
    expect(first).toBe(true);
    const reverse = connect({
      source: b,
      target: a,
      sourceHandle: 'l-in::src',
      targetHandle: 'l-out::tgt',
    });
    expect(reverse).toBe(false);
    expect(useCircuitStore.getState().edges).toHaveLength(1);
  });

  it('updates component properties', () => {
    const { addComponent, updateProps } = useCircuitStore.getState();
    const a = addComponent('bulb', { x: 0, y: 0 });
    updateProps(a, { wattageW: 100, name: 'Porch' });
    const node = useCircuitStore.getState().nodes.find((n) => n.id === a);
    expect(node?.data.props).toMatchObject({ wattageW: 100, name: 'Porch' });
  });

  it('removes wires when one of their nodes is removed', () => {
    const { addComponent, connect, deleteNode } = useCircuitStore.getState();
    const a = addComponent('mcb', { x: 0, y: 0 });
    const b = addComponent('bulb', { x: 300, y: 0 });
    connect({ source: a, target: b, sourceHandle: 'l-out::src', targetHandle: 'l-in::tgt' });
    expect(useCircuitStore.getState().edges).toHaveLength(1);
    deleteNode(b);
    expect(useCircuitStore.getState().nodes).toHaveLength(1);
    expect(useCircuitStore.getState().edges).toHaveLength(0);
  });

  it('deletes a single edge', () => {
    const { addComponent, connect, deleteEdge } = useCircuitStore.getState();
    const a = addComponent('mcb', { x: 0, y: 0 });
    const b = addComponent('bulb', { x: 300, y: 0 });
    connect({ source: a, target: b, sourceHandle: 'l-out::src', targetHandle: 'l-in::tgt' });
    const edgeId = useCircuitStore.getState().edges[0].id;
    deleteEdge(edgeId);
    expect(useCircuitStore.getState().edges).toHaveLength(0);
  });
});

describe('undo / redo', () => {
  it('undoes an add and redoes it', () => {
    const s = useCircuitStore.getState();
    const id = s.addComponent('mcb', { x: 32, y: 32 });
    expect(useCircuitStore.getState().nodes).toHaveLength(1);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().nodes).toHaveLength(0);
    useCircuitStore.getState().redo();
    const node = useCircuitStore.getState().nodes.find((n) => n.id === id);
    expect(node?.data.componentType).toBe('mcb');
    expect(node?.position).toEqual({ x: 32, y: 32 });
  });

  it('undoes connect, delete and drag records as one step each', () => {
    const { addComponent, connect, deleteEdge, recordDrag } = useCircuitStore.getState();
    const a = addComponent('mcb', { x: 0, y: 0 });
    const b = addComponent('bulb', { x: 300, y: 0 });
    connect({ source: a, target: b, sourceHandle: 'l-out::src', targetHandle: 'l-in::tgt' });
    const edgeId = useCircuitStore.getState().edges[0].id;

    recordDrag(); // e.g. drag started
    useCircuitStore.setState((s) => ({
      nodes: s.nodes.map((n) => (n.id === a ? { ...n, position: { x: 48, y: 96 } } : n)),
    }));

    deleteEdge(edgeId);
    expect(useCircuitStore.getState().edges).toHaveLength(0);

    // One undo restores the deleted wire.
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().edges).toHaveLength(1);
    // Second undo restores the pre-drag position of the MCB.
    useCircuitStore.getState().undo();
    const moved = useCircuitStore.getState().nodes.find((n) => n.id === a);
    expect(moved?.position).toEqual({ x: 0, y: 0 });
    // Redo replays the move.
    useCircuitStore.getState().redo();
    const reMoved = useCircuitStore.getState().nodes.find((n) => n.id === a);
    expect(reMoved?.position).toEqual({ x: 48, y: 96 });
  });

  it('keeps at most 50 history entries', () => {
    const { addComponent } = useCircuitStore.getState();
    for (let i = 0; i < 60; i++) {
      addComponent('bulb', { x: i, y: 0 });
    }
    const { past } = useCircuitStore.getState();
    expect(past.length).toBeLessThanOrEqual(50);
    // Undo repeatedly unwinds back to the first ten adds (dropped from history).
    while (useCircuitStore.getState().past.length > 0) {
      useCircuitStore.getState().undo();
    }
    expect(useCircuitStore.getState().nodes.length).toBe(60 - 50);
  });
});

describe('serialization', () => {
  it('round-trips a circuit through JSON', () => {
    const { addComponent, connect } = useCircuitStore.getState();
    const a = addComponent('switch', { x: 16, y: 16 });
    const b = addComponent('bulb', { x: 240, y: 32 });
    connect({ source: a, target: b, sourceHandle: 'l-out::src', targetHandle: 'l-in::tgt' });
    useCircuitStore.getState().updateProps(b, { wattageW: 100, name: 'Porch' });

    const s = useCircuitStore.getState();
    const json = JSON.stringify(serializeCircuit(s.nodes, s.edges));
    const parsed = parseCircuitDoc(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
    const bulb = parsed.nodes.find((n) => n.data.componentType === 'bulb');
    expect(bulb?.data.props).toMatchObject({ wattageW: 100, name: 'Porch' });
    expect(parsed.edges[0].data).toEqual({ fromTerminal: 'l-out', toTerminal: 'l-in' });
  });

  it('rejects malformed documents', () => {
    expect(parseCircuitDoc('not json').ok).toBe(false);
    expect(parseCircuitDoc('{"app":"other"}').ok).toBe(false);
    expect(parseCircuitDoc('{"app":"zcircuit","version":1,"nodes":[]}').ok).toBe(false);
  });

  it('drops edges whose endpoints do not exist', () => {
    const bad = JSON.stringify({
      app: 'zcircuit',
      version: 1,
      nodes: [{ id: 'n1', type: 'component', position: { x: 0, y: 0 }, data: { componentType: 'mcb', props: {} } }],
      edges: [{ id: 'e1', source: 'n1', target: 'ghost', sourceHandle: 'l-out::src', targetHandle: 'l-in::src' }],
    });
    const parsed = parseCircuitDoc(bad);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.nodes).toHaveLength(1);
      expect(parsed.edges).toHaveLength(0);
    }
  });
});

describe('persistence & simulation', () => {
  it('saves to and loads from localStorage', () => {
    localStorage.clear();
    const { addComponent, connect, saveCircuit, loadCircuit } = useCircuitStore.getState();
    const a = addComponent('mcb', { x: 32, y: 32 });
    const b = addComponent('socket', { x: 288, y: 32 });
    connect({ source: a, target: b, sourceHandle: 'l-out::src', targetHandle: 'l-in::tgt' });
    saveCircuit();

    // Wipe the canvas, then restore.
    useCircuitStore.setState({ nodes: [], edges: [], past: [], future: [] });
    expect(useCircuitStore.getState().nodes).toHaveLength(0);
    loadCircuit();
    expect(useCircuitStore.getState().nodes).toHaveLength(2);
    expect(useCircuitStore.getState().edges).toHaveLength(1);
    expect(useCircuitStore.getState().past).toHaveLength(0);
  });

  it('notifies when nothing is saved yet', () => {
    localStorage.clear();
    useCircuitStore.getState().loadCircuit();
    expect(useCircuitStore.getState().notice).toMatch(/no saved circuit/i);
  });

  it('manages simulation running state and speed within bounds', () => {
    const { setSimulationRunning, setSimulationSpeed } = useCircuitStore.getState();
    setSimulationRunning(true);
    expect(useCircuitStore.getState().simulationRunning).toBe(true);
    setSimulationSpeed(100);
    expect(useCircuitStore.getState().simulationSpeed).toBe(8);
    setSimulationSpeed(0.01);
    expect(useCircuitStore.getState().simulationSpeed).toBe(0.1);
    setSimulationSpeed(2.5);
    expect(useCircuitStore.getState().simulationSpeed).toBe(2.5);
  });

  it('clears history and circuit on newCircuit', () => {
    useCircuitStore.getState().addComponent('fan', { x: 0, y: 0 });
    useCircuitStore.getState().newCircuit();
    const s = useCircuitStore.getState();
    expect(s.nodes).toHaveLength(0);
    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(0);
  });
});
