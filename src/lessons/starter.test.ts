import { describe, expect, it } from 'vitest';
import { CATALOG } from '../components/library/catalog';
import type { LevelDef } from './types';
import { buildStarter } from './starter';

function levelWith(starter: LevelDef['starter']): LevelDef {
  return {
    id: 't',
    categoryId: 'test',
    title: 'T',
    difficulty: 1,
    intro: '',
    objectives: [{ kind: 'powered', nodeId: 'lamp' }],
    hints: ['h'],
    starter,
  };
}

describe('buildStarter', () => {
  it('returns an empty circuit for a level without a starter', () => {
    const { nodes, edges } = buildStarter(levelWith(undefined));
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it('parses starter nodes with props merged over catalog defaults', () => {
    const { nodes } = buildStarter(
      levelWith({
        app: 'zcircuit',
        version: 1,
        nodes: [
          { id: 'sw', type: 'component', position: { x: 10, y: 20 }, data: { componentType: 'switch', props: { state: 'on' } } },
          { id: 'lamp', type: 'component', position: { x: 300, y: 20 }, data: { componentType: 'bulb', props: {} } },
        ],
        edges: [],
      }),
    );
    expect(nodes).toHaveLength(2);
    const sw = nodes.find((n) => n.id === 'sw')!;
    expect(sw.position).toEqual({ x: 10, y: 20 });
    expect(sw.data.props.state).toBe('on');
    expect(sw.data.props.voltageV).toBe(CATALOG.switch.defaultProps.voltageV);
    const lamp = nodes.find((n) => n.id === 'lamp')!;
    expect(lamp.data.props.wattageW).toBe(60); // catalog default
  });

  it('preserves starter wires with their terminal data', () => {
    const { edges } = buildStarter(
      levelWith({
        app: 'zcircuit',
        version: 1,
        nodes: [
          { id: 'sb', type: 'component', position: { x: 0, y: 0 }, data: { componentType: 'switchboard', props: {} } },
          { id: 'lamp', type: 'component', position: { x: 300, y: 0 }, data: { componentType: 'bulb', props: {} } },
        ],
        edges: [
          {
            id: 'w1',
            source: 'sb',
            target: 'lamp',
            sourceHandle: 'way-1-l::src',
            targetHandle: 'l-in::tgt',
            data: { fromTerminal: 'way-1-l', toTerminal: 'l-in' },
          },
        ],
      }),
    );
    expect(edges).toHaveLength(1);
    expect(edges[0].data).toEqual({ fromTerminal: 'way-1-l', toTerminal: 'l-in' });
  });

  it('drops edges that reference missing nodes and unknown component types', () => {
    const { nodes, edges } = buildStarter(
      levelWith({
        app: 'zcircuit',
        version: 1,
        nodes: [
          { id: 'sb', type: 'component', position: { x: 0, y: 0 }, data: { componentType: 'switchboard', props: {} } },
          { id: 'ghost', type: 'component', position: { x: 0, y: 0 }, data: { componentType: 'nope' as never, props: {} } },
        ],
        edges: [
          {
            id: 'w1',
            source: 'sb',
            target: 'ghost',
            sourceHandle: 'way-1-l::src',
            targetHandle: 'l-in::tgt',
            data: { fromTerminal: 'way-1-l', toTerminal: 'l-in' },
          },
        ],
      }),
    );
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });

  it('throws on a starter that fails validation', () => {
    const bad = levelWith({ app: 'zcircuit', version: 99 as 1, nodes: [], edges: [] });
    expect(() => buildStarter(bad)).toThrow(/invalid/);
  });
});