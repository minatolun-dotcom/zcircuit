import type { ComponentProps, ComponentType } from '../../types/circuit';
import { CATALOG } from './catalog';

interface SymbolViewProps {
  type: ComponentType;
  props?: ComponentProps;
  /** Render width/height in px. The glyph is authored at catalog scale and scaled to fit. */
  width: number;
  height: number;
}

const SW = 2;

function Lead({ from, to }: { from: [number, number]; to: [number, number] }) {
  return <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />;
}

/**
 * Hand-drawn IEC 60617-style practice symbols. The glyph is stroked with
 * `currentColor` on a transparent background; terminal dots are rendered by the
 * React Flow handles in ComponentNode, colour-coded by conductor role.
 */
export function SymbolView({ type, props = {}, width, height }: SymbolViewProps) {
  const meta = CATALOG[type];
  const W = meta.width;
  const H = meta.height;
  const closed = props.state !== 'off';
  const closedSwitch = type === 'switch' ? closed : true;

  let glyph: React.ReactNode = null;

  switch (type) {
    case 'mcb': {
      glyph = (
        <g>
          <Lead from={[0, 32]} to={[44, 32]} />
          <Lead from={[66, 32]} to={[W, 32]} />
          <rect x={46} y={24} width={18} height={16} />
          <line x1={55} y1={26} x2={55} y2={38} />
          <line x1={48} y1={20} x2={62} y2={44} />
          <line x1={62} y1={20} x2={48} y2={44} />
          <text x={55} y={58} fontSize={7} textAnchor="middle">
            {props.ratedCurrentA ?? 16} A
          </text>
        </g>
      );
      break;
    }
    case 'switch': {
      glyph = (
        <g>
          <Lead from={[0, 32]} to={[42, 32]} />
          {/* Fixed contact tick */}
          <line x1={44} y1={26} x2={44} y2={38} />
          {closedSwitch ? (
            <Lead from={[44, 32]} to={[W, 32]} />
          ) : (
            <g>
              <line x1={44} y1={32} x2={60} y2={16} />
              <Lead from={[64, 32]} to={[W, 32]} />
            </g>
          )}
        </g>
      );
      break;
    }
    case 'bulb': {
      const cx = 60;
      const cy = 30;
      const r = 17;
      glyph = (
        <g>
          <Lead from={[0, 32]} to={[cx - r, 32]} />
          <Lead from={[cx + r, 32]} to={[W, 32]} />
          <circle cx={cx} cy={cy} r={r} />
          <line x1={cx - r + 5} y1={cy - r + 5} x2={cx + r - 5} y2={cy + r - 5} />
          <line x1={cx + r - 5} y1={cy - r + 5} x2={cx - r + 5} y2={cy + r - 5} />
        </g>
      );
      break;
    }
    case 'fan': {
      const cx = 46;
      const cy = 30;
      glyph = (
        <g>
          <Lead from={[0, 32]} to={[cx - 13, 32]} />
          <Lead from={[cx + 13, 32]} to={[W, 32]} />
          <circle cx={cx} cy={cy} r={13} />
          <text x={cx} y={cy + 3} fontSize={10} textAnchor="middle" stroke="none" fill="currentColor">
            M
          </text>
          {/* Three stylised blades to the right of the motor */}
          <path d="M 60 30 Q 70 22 78 24 Q 70 30 60 30" />
          <path d="M 60 32 Q 74 34 80 44 Q 70 38 60 33" />
          <path d="M 60 29 Q 70 40 76 51 Q 66 40 60 30" />
        </g>
      );
      break;
    }
    case 'inverter': {
      glyph = (
        <g>
          <Lead from={[0, 18]} to={[34, 18]} />
          <Lead from={[0, 54]} to={[34, 54]} />
          <Lead from={[106, 18]} to={[W, 18]} />
          <Lead from={[106, 54]} to={[W, 54]} />
          <rect x={34} y={8} width={72} height={56} rx={4} />
          <path d="M 44 42 C 50 24, 54 24, 60 36 S 70 48, 76 30 S 86 18, 96 26" />
          <text x={70} y={12} fontSize={7} textAnchor="middle">
            INV
          </text>
        </g>
      );
      break;
    }
    case 'switchboard': {
      glyph = (
        <g>
          {/* L bus at y=24, N bus at y=66 */}
          <Lead from={[0, 24]} to={[12, 24]} />
          <Lead from={[0, 66]} to={[12, 66]} />
          <rect x={12} y={14} width={W - 20} height={H - 28} rx={3} />
          <line x1={20} y1={24} x2={W - 8} y2={24} strokeWidth={SW + 1} />
          <line x1={20} y1={66} x2={W - 8} y2={66} strokeWidth={SW + 1} />
          {/* Way taps to the right border */}
          <line x1={W - 8} y1={16} x2={W - 8} y2={24} />
          <line x1={W - 8} y1={24} x2={W - 8} y2={40} />
          <text x={W / 2} y={48} fontSize={8} textAnchor="middle" stroke="none" fill="currentColor">
            DB
          </text>
        </g>
      );
      break;
    }
    case 'socket': {
      glyph = (
        <g>
          <Lead from={[0, 16]} to={[40, 16]} />
          <Lead from={[0, 38]} to={[40, 38]} />
          <Lead from={[0, 60]} to={[40, 60]} />
          <line x1={40} y1={8} x2={40} y2={68} />
          <circle cx={80} cy={38} r={15} />
          <line x1={76} y1={30} x2={76} y2={46} />
          <line x1={84} y1={30} x2={84} y2={46} />
        </g>
      );
      break;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={width}
      height={height}
      data-symbol-type={type}
      data-testid="component-symbol"
      role="img"
      aria-label={meta.label}
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      className="block"
    >
      {glyph}
    </svg>
  );
}
