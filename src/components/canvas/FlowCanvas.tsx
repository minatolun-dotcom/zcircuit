import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';
import { useCircuitStore } from '../../store/circuitStore';
import { CATALOG } from '../library/catalog';
import { PALETTE_MIME, type PalettePayload } from '../../types/circuit';
import { WireEdge } from '../edges/WireEdge';
import { ComponentNode } from '../nodes/ComponentNode';

// xyflow's NodeTypes/EdgeTypes are typed against the untyped base node/edge;
// our nodes/edges carry strict domain data, so the registry entries are cast.
const nodeTypes: NodeTypes = { component: ComponentNode as NodeTypes[string] };
const edgeTypes: EdgeTypes = { wire: WireEdge as EdgeTypes[string] };

function Canvas() {
  const nodes = useCircuitStore((s) => s.nodes);
  const edges = useCircuitStore((s) => s.edges);
  const onNodesChange = useCircuitStore((s) => s.onNodesChange);
  const onEdgesChange = useCircuitStore((s) => s.onEdgesChange);
  const onConnect = useCircuitStore((s) => s.connect);
  const addComponent = useCircuitStore((s) => s.addComponent);
  const { screenToFlowPosition } = useReactFlow();
  const [dragOver, setDragOver] = useState(false);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes(PALETTE_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const raw = event.dataTransfer.getData(PALETTE_MIME);
      if (!raw) return;
      const payload = JSON.parse(raw) as PalettePayload;
      if (!CATALOG[payload.type]) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addComponent(payload.type, position);
    },
    [addComponent, screenToFlowPosition],
  );

  // Delete/Backspace removes whatever is selected, no matter where focus is.
  // (React Flow already handles this when the canvas itself has focus.)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const state = useCircuitStore.getState();
      const nodeIds = state.nodes.filter((n) => n.selected).map((n) => n.id);
      const edgeIds = state.edges.filter((e) => e.selected).map((e) => e.id);
      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      event.preventDefault();
      for (const id of nodeIds) state.deleteNode(id);
      for (const id of edgeIds) state.deleteEdge(id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative h-full w-full" data-testid="wiring-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        // Loose mode + dual-capable handles makes every terminal usable as
        // both a wire start and a wire end.
        connectionMode={ConnectionMode.Loose}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionLineType={ConnectionLineType.Step}
        snapToGrid
        snapGrid={[8, 8]}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className={dragOver ? 'bg-sky-50' : ''}
      >
        <Background variant={BackgroundVariant.Lines} gap={16} size={1} color="#cbd5e1" />
        <Controls />
        <MiniMap pannable zoomable nodeColor="#475569" maskColor="rgba(148, 163, 184, 0.15)" />
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="max-w-sm text-center text-sm text-slate-400">
              Drag components from the palette onto the canvas, then connect them{' '}
              <span className="font-medium">terminal to terminal</span> to build a circuit.
            </p>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
