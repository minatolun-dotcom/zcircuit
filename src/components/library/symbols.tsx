import type { ComponentProps, ComponentType } from '../../types/circuit';
import { CATALOG } from './catalog';

interface SymbolViewProps {
  type: ComponentType;
  props?: ComponentProps;
  /** Render size in px; art is authored at catalog scale and scaled to fit. */
  width: number;
  height: number;
}

/* Device illustration palette */
const C = {
  plastic: '#f8fafc',
  metal: '#cbd5e1',
  metalDark: '#94a3b8',
  chassis: '#e2e8f0',
  line: '#64748b',
  deep: '#334155',
  accent: '#0ea5e9',
  amber: '#f59e0b',
  glass: '#fef9c3',
  filament: '#b45309',
};

const SW = 1.4;

function terminalPairX(W: number, ys: number[]) {
  return ys.map((y) => (
    <g key={`tp-${y}`}>
      <circle cx={10} cy={y} r={3.2} fill={C.metalDark} stroke={C.deep} strokeWidth={1} />
      <line x1={5} y1={y} x2={10} y2={y} stroke={C.deep} strokeWidth={1.2} />
      <circle cx={W - 10} cy={y} r={3.2} fill={C.metalDark} stroke={C.deep} strokeWidth={1} />
      <line x1={W - 5} y1={y} x2={W - 10} y2={y} stroke={C.deep} strokeWidth={1.2} />
    </g>
  ));
}

function McbArt(props: ComponentProps) {
  const closed = props.state !== 'off';
  return (
    <g>
      {/* DIN housing */}
      <rect x={16} y={8} width={78} height={42} rx={3} fill={C.plastic} stroke={C.line} strokeWidth={SW} />
      <line x1={18} y1={46} x2={92} y2={46} stroke={C.metalDark} strokeWidth={1} />
      {/* DIN rail clip */}
      <rect x={44} y={50} width={22} height={6} rx={1} fill={C.metal} stroke={C.metalDark} strokeWidth={1} />
      {/* toggle handle */}
      <rect x={20} y={14} width={22} height={30} rx={2} fill={C.chassis} stroke={C.metalDark} strokeWidth={1} />
      <rect x={24} y={closed ? 16 : 26} width={14} height={16} rx={3} fill={C.accent} />
      {/* rating window */}
      <rect x={48} y={14} width={38} height={30} rx={2} fill="#f1f5f9" stroke={C.metalDark} strokeWidth={1} />
      <text x={55} y={33} fontSize={13} fontWeight={700} fill={C.deep} fontFamily="ui-sans-serif, sans-serif">
        {props.ratedCurrentA ?? 16}
      </text>
      <text x={80} y={33} fontSize={8} fill={C.line}>
        A
      </text>
      <text x={67} y={12} fontSize={7} fill={C.line} textAnchor="middle">
        MCB
      </text>
    </g>
  );
}

function SwitchArt(props: ComponentProps) {
  const closed = props.state !== 'off';
  return (
    <g>
      {/* wall plate */}
      <rect x={14} y={6} width={82} height={52} rx={8} fill={C.plastic} stroke={C.line} strokeWidth={SW} />
      {/* mounting screws */}
      <circle cx={22} cy={14} r={1.8} fill={C.metalDark} />
      <circle cx={88} cy={14} r={1.8} fill={C.metalDark} />
      <circle cx={22} cy={50} r={1.8} fill={C.metalDark} />
      <circle cx={88} cy={50} r={1.8} fill={C.metalDark} />
      {/* rocker */}
      <rect x={28} y={17} width={54} height={30} rx={6} fill={C.chassis} stroke={C.metalDark} strokeWidth={1.2} />
      <rect
        x={28}
        y={closed ? 17 : 31}
        width={54}
        height={16}
        rx={6}
        fill={closed ? C.accent : '#cbd5e1'}
        opacity={closed ? 1 : 0.9}
      />
      <line x1={28} y1={31} x2={82} y2={31} stroke="#94a3b8" strokeWidth={1} />
    </g>
  );
}

function BulbArt() {
  return (
    <g>
      {/* lead stubs */}
      <line x1={2} y1={32} x2={18} y2={32} stroke={C.line} strokeWidth={1.6} />
      <line x1={92} y1={32} x2={108} y2={32} stroke={C.line} strokeWidth={1.6} />
      {/* screw base */}
      <rect x={16} y={24} width={14} height={16} rx={2} fill={C.metal} stroke={C.metalDark} strokeWidth={1} />
      <line x1={19} y1={26} x2={19} y2={38} stroke={C.metalDark} strokeWidth={1} />
      <line x1={23} y1={26} x2={23} y2={38} stroke={C.metalDark} strokeWidth={1} />
      <line x1={27} y1={26} x2={27} y2={38} stroke={C.metalDark} strokeWidth={1} />
      {/* glass */}
      <path
        d="M 32 24 A 30 22 0 0 1 92 24 Z"
        fill={C.glass}
        stroke={C.amber}
        strokeWidth={1.4}
        opacity={0.95}
      />
      {/* filament */}
      <path
        d="M 55 34 L 62 26 L 69 34 L 62 42 Z"
        fill="none"
        stroke={C.filament}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <circle cx={47} cy={22} r={10} fill="#ffffff" opacity={0.5} />
    </g>
  );
}

function FanArt() {
  return (
    <g>
      {/* terminal stubs */}
      <line x1={4} y1={32} x2={22} y2={32} stroke={C.line} strokeWidth={1.6} />
      <line x1={88} y1={32} x2={106} y2={32} stroke={C.line} strokeWidth={1.6} />
      {/* motor housing */}
      <circle cx={55} cy={32} r={30} fill={C.plastic} stroke={C.line} strokeWidth={SW} />
      {/* blades (underside view) */}
      <g fill={C.metal} stroke={C.metalDark} strokeWidth={1}>
        <path d="M 55 32 L 66 14 A 4 4 0 0 0 60 9 L 49 27 Z" />
        <path d="M 55 32 L 79 24 A 4 4 0 0 0 76 16 L 58 26 Z" />
        <path d="M 55 32 L 76 50 A 4 4 0 0 0 66 55 L 50 38 Z" />
        <path d="M 55 32 L 34 46 A 4 4 0 0 0 40 52 L 55 36 Z" />
      </g>
      {/* hub */}
      <circle cx={55} cy={32} r={8} fill={C.deep} />
      <circle cx={55} cy={32} r={3} fill="#cbd5e1" />
    </g>
  );
}

function InverterArt() {
  return (
    <g>
      {/* chassis */}
      <rect x={22} y={10} width={96} height={52} rx={6} fill={C.plastic} stroke={C.line} strokeWidth={SW} />
      <rect x={22} y={10} width={96} height={52} rx={6} fill="none" stroke={C.deep} strokeWidth={0.5} />
      {/* vents */}
      <g stroke={C.metalDark} strokeWidth={1.6}>
        <line x1={100} y1={22} x2={110} y2={22} />
        <line x1={100} y1={28} x2={110} y2={28} />
        <line x1={100} y1={34} x2={110} y2={34} />
        <line x1={100} y1={40} x2={110} y2={40} />
        <line x1={100} y1={46} x2={110} y2={46} />
      </g>
      {/* status LEDs */}
      <circle cx={34} cy={18} r={2.2} fill="#22c55e" />
      <circle cx={42} cy={18} r={2.2} fill="#f59e0b" />
      {/* display */}
      <rect x={28} y={26} width={40} height={26} rx={2} fill={C.deep} />
      <text x={31} y={42} fontSize={8} fill="#7dd3fc" fontFamily="ui-monospace, monospace">
        ON 230V
      </text>
      <text x={72} y={16} fontSize={7} fill={C.line}>
        INV
      </text>
    </g>
  );
}

function SwitchboardArt() {
  return (
    <g>
      {/* enclosure */}
      <rect x={12} y={8} width={126} height={72} rx={5} fill={C.chassis} stroke={C.line} strokeWidth={SW} />
      <rect x={12} y={8} width={126} height={8} rx={5} fill="#cbd5e1" />
      {/* door */}
      <rect x={22} y={18} width={106} height={56} rx={3} fill={C.plastic} stroke={C.metalDark} strokeWidth={1.2} />
      {/* DIN rail with two breaker silhouettes */}
      <rect x={30} y={28} width={14} height={32} rx={2} fill={C.plastic} stroke={C.metalDark} strokeWidth={1} />
      <rect x={32} y={30} width={10} height={14} rx={2} fill={C.accent} />
      <rect x={30} y={56} width={14} height={4} fill={C.deep} />
      <rect x={48} y={28} width={14} height={32} rx={2} fill={C.plastic} stroke={C.metalDark} strokeWidth={1} />
      <rect x={50} y={30} width={10} height={14} rx={2} fill={C.accent} />
      <rect x={48} y={56} width={14} height={4} fill={C.deep} />
      <rect x={48} y={60} width={60} height={8} rx={1} fill={C.metal} stroke={C.metalDark} strokeWidth={0.8} />
      {/* door handle */}
      <circle cx={112} cy={46} r={4} fill={C.metalDark} stroke={C.deep} strokeWidth={1} />
      <text x={118} y={14} fontSize={7} fill={C.line} textAnchor="end">
        DB
      </text>
    </g>
  );
}

function SocketArt() {
  return (
    <g>
      {/* face plate */}
      <rect x={16} y={8} width={78} height={60} rx={7} fill={C.plastic} stroke={C.line} strokeWidth={SW} />
      {/* mounting screws */}
      <circle cx={24} cy={16} r={1.8} fill={C.metalDark} />
      <circle cx={86} cy={16} r={1.8} fill={C.metalDark} />
      <circle cx={24} cy={60} r={1.8} fill={C.metalDark} />
      <circle cx={86} cy={60} r={1.8} fill={C.metalDark} />
      {/* twin outlet cutouts */}
      {[26, 52].map((cx) => (
        <g key={cx}>
          <rect x={cx - 7} y={24} width={14} height={22} rx={3} fill="#f1f5f9" stroke={C.metalDark} strokeWidth={1} />
          <rect x={cx - 3} y={28} width={6} height={10} rx={2} fill={C.deep} />
          <rect x={cx - 3} y={42} width={6} height={2} rx={1} fill={C.deep} />
        </g>
      ))}
      {/* switch (right side) */}
      <rect x={66} y={18} width={20} height={14} rx={7} fill={C.chassis} stroke={C.metalDark} strokeWidth={1} />
      <circle cx={71} cy={25} r={3} fill="#22c55e" />
    </g>
  );
}

function DeviceArt({ type, props = {} }: { type: ComponentType; props?: ComponentProps }) {
  const W = CATALOG[type].width;
  switch (type) {
    case 'mcb':
      return (
        <g>
          {terminalPairX(W, [32])}
          <McbArt {...props} />
        </g>
      );
    case 'switch':
      return (
        <g>
          {terminalPairX(W, [32])}
          <SwitchArt {...props} />
        </g>
      );
    case 'bulb':
      return <BulbArt />;
    case 'fan':
      return <FanArt />;
    case 'inverter':
      return (
        <g>
          {terminalPairX(W, [18, 54])}
          <InverterArt />
        </g>
      );
    case 'switchboard':
      return (
        <g>
          {terminalPairX(W, [24, 66])}
          <SwitchboardArt />
        </g>
      );
    case 'socket':
      return (
        <g>
          {terminalPairX(W, [16, 38, 60])}
          <SocketArt />
        </g>
      );
  }
}

/**
 * Realistic-looking device illustration for each catalog component. Terminal
 * plates are drawn so the L/N/PE connection points (which the React Flow
 * handles sit on) are obvious; the role letters are overlaid by ComponentNode.
 */
export function SymbolView({ type, props = {}, width, height }: SymbolViewProps) {
  const meta = CATALOG[type];
  const W = meta.width;
  const H = meta.height;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={width}
      height={height}
      data-symbol-type={type}
      data-testid="component-symbol"
      role="img"
      aria-label={meta.label}
      className="block"
    >
      <DeviceArt type={type} props={props} />
    </svg>
  );
}
