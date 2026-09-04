import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from './circuitStore';

function reset() {
  useCircuitStore.setState({ nodes: [], edges: [], notice: null });
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
