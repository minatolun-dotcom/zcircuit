import { EdgeLabelRenderer, useNodes, type EdgeProps } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { orthogonalPath, pathToSvg, type Pt } from '../../engine/routing';
import { useCircuitStore } from '../../store/circuitStore';
import { CATALOG } from '../library/catalog';
import type { ComponentNode, WireEdge as WireEdgeType } from '../../types/circuit';

function fmt(v: number): number {
  return Math.round(v * 2) / 2;
}

function nodeRects(nodes: ComponentNode[]): { id: string; rect: { x: number; y: number; width: number; height: number } }[] {
  return nodes.map((n) => {
    const meta = CATALOG[n.data.componentType];
    const measured = n.measured;
    return {
      id: n.id,
      rect: {
        x: n.position.x,
        y: n.position.y,
        width: measured?.width ?? meta.width,
        height: measured?.height ?? meta.height + 16,
      },
    };
  });
}

/**
 * Renders a terminal-to-terminal wire as an obstacle-avoiding orthogonal
 * polyline. Small glowing dots travel along the path (source -> target) to
 * visualise the direction of current flow.
 */
export function WireEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
}: EdgeProps<WireEdgeType>) {
  const nodes = useNodes<ComponentNode>();
  const deleteEdge = useCircuitStore((s) => s.deleteEdge);
  const selectEdge = useCircuitStore((s) => s.selectEdge);
  const toggleSelect = (e: React.PointerEvent) => {
    e.stopPropagation();
    selectEdge(id, !selected);
  };
  const [hovered, setHovered] = useState(false);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [dots, setDots] = useState<Pt[]>([]);

  const path = useMemo(() => {
    const others = nodeRects(nodes).filter((n) => n.id !== source && n.id !== target);
    const pts = orthogonalPath(
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
      others.map((o) => o.rect),
    );
    return { pts, d: pathToSvg(pts) };
  }, [sourceX, sourceY, targetX, targetY, source, target, nodes]);

  useEffect(() => {
    const el = pathRef.current;
    if (!el || path.d === '') {
      setDots([]);
      return;
    }
    let raf = 0;
    let duration = 0;
    const tick = (now: number) => {
      if (duration === 0) {
        const len = el.getTotalLength();
        duration = Math.min(2600, Math.max(700, len * 4));
      }
      const len = el.getTotalLength();
      const count = 2;
      const positions: Pt[] = [];
      for (let i = 0; i < count; i++) {
        const phase = ((now % duration) / duration + i / count) % 1;
        const p = el.getPointAtLength(phase * len);
        positions.push({ x: fmt(p.x), y: fmt(p.y) });
      }
      setDots(positions);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [path.d]);

  const color = selected ? '#0284c7' : '#475569';
  const width = selected ? 3 : 2;

  const mid = path.pts[Math.floor(path.pts.length / 2)] ?? { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };

  return (
    <g
      data-testid="wire-edge"
      data-edge-id={id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {path.d && (
        <>
          {/* Hit areas: an invisible wide path plus the visible stroke. React
              Flow's own selection is disabled for wires (selectable:false), so
              selection is toggled here. The animated dots are purely decorative
              and must never intercept pointer events. */}
          <path
            d={path.d}
            className="react-flow__edge-interaction"
            fill="none"
            stroke="transparent"
            strokeWidth={16}
            onPointerDown={toggleSelect}
          />
          <path
            ref={pathRef}
            d={path.d}
            className="react-flow__edge-path"
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onPointerDown={toggleSelect}
            data-testid="wire-path"
            data-polyline={JSON.stringify(path.pts)}
          />
          {dots.map((dot, i) => (
            <circle
              key={i}
              data-testid="flow-dot"
              cx={dot.x}
              cy={dot.y}
              r={selected ? 3 : 2.4}
              fill={color}
              opacity={0.85}
              style={{ pointerEvents: 'none' }}
            />
          ))}
        </>
      )}
      {(hovered || selected) && path.d && (
        <EdgeLabelRenderer>
          <button
            type="button"
            aria-label="Delete wire"
            data-testid="delete-wire"
            onClick={(e) => {
              e.stopPropagation();
              deleteEdge(id);
            }}
            style={{
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan absolute z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-xs leading-none text-slate-600 shadow hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}
