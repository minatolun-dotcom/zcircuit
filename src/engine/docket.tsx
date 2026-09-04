import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import { SymbolView } from '../components/library/symbols';
import { CATALOG } from '../components/library/catalog';
import type { ComponentNode, ComponentProps, WireEdge } from '../types/circuit';
import { ROLE_COLOR, terminalFromHandle } from '../types/circuit';
import { serializeCircuit } from '../store/serialization';
import { analyzeCircuit, recommendGauge, type OptimizationReport } from './optimization';
import { orthogonalPath, pathToSvg, type Pt, type Rect } from './routing';
import { simulateCircuit, type SimulationResult } from './simulation';
import { validateCircuit, type ValidationReport } from './validation';
import { MAINS_FREQUENCY_HZ } from './waveform';

/**
 * Wiring docket generation (Todo 10). All exports are self-contained and
 * produced entirely in the browser - no external services:
 *
 *  - JSON: full circuit state (same document as save/load) plus live
 *    simulation, validation and optimization results and the docket itself;
 *  - SVG: a wiring diagram with the real component symbols and routed wires;
 *  - PDF: a jsPDF wiring report (component list, wire lengths, conductor
 *    gauge schedule, validation summary, optimization suggestions).
 *
 * Scale used for lengths: DOCKET_PX_PER_M pixels of canvas = 1 m of cable.
 */

/** Canvas pixels per metre of cable (for the length report). */
export const DOCKET_PX_PER_M = 100;

export interface DocketComponentRow {
  id: string;
  type: string;
  label: string;
  /** Human-readable electrical rating, e.g. "16 A", "60 W", "230 V". */
  rating: string;
  sim?: {
    status: 'on' | 'off' | 'tripped';
    currentA: number;
    voltageV: number;
    powerW: number;
    reason?: string;
  };
}

export interface DocketWireRow {
  id: string;
  from: string;
  fromTerminal: string;
  to: string;
  toTerminal: string;
  lengthPx: number;
  lengthM: number;
}

export interface DocketConductorRow {
  label: string;
  designA: number;
  sizeMm2: number;
  ampacityA: number;
  adequate: boolean;
}

export interface DocketSummary {
  componentCount: number;
  wireCount: number;
  totalWirePx: number;
  totalWireM: number;
  sourceCount: number;
  errorCount: number;
  warningCount: number;
}

export interface DocketData {
  app: 'zcircuit';
  version: 1;
  summary: DocketSummary;
  components: DocketComponentRow[];
  wires: DocketWireRow[];
  conductorSchedule: DocketConductorRow[];
  validation: ValidationReport | null;
  optimization: OptimizationReport | null;
}

function ratingFor(type: string, props: ComponentProps): string {
  switch (type) {
    case 'mcb':
      return `${props.ratedCurrentA ?? 16} A`;
    case 'bulb':
    case 'fan':
      return props.wattageW ? `${props.wattageW} W` : '—';
    case 'switch':
      return 'SP switch';
    case 'inverter':
      return props.capacityVA ? `${props.capacityVA} VA` : '—';
    default:
      return props.voltageV ? `${props.voltageV} V` : '—';
  }
}

function nodeBox(n: ComponentNode): Rect {
  const meta = CATALOG[n.data.componentType];
  return {
    x: n.position.x,
    y: n.position.y,
    width: n.measured?.width ?? meta.width,
    height: n.measured?.height ?? meta.height + 16,
  };
}

function terminalAnchor(n: ComponentNode, terminalId: string): Pt | null {
  const t = CATALOG[n.data.componentType].terminals.find((x) => x.id === terminalId);
  if (!t) return null;
  return { x: n.position.x + t.x, y: n.position.y + t.y };
}

function routeEdge(edge: WireEdge, nodeById: Map<string, ComponentNode>): Pt[] | null {
  const from = edge.data?.fromTerminal ?? terminalFromHandle(edge.sourceHandle);
  const to = edge.data?.toTerminal ?? terminalFromHandle(edge.targetHandle);
  const nodeA = nodeById.get(edge.source);
  const nodeB = nodeById.get(edge.target);
  if (!nodeA || !nodeB || !from || !to) return null;
  const a = terminalAnchor(nodeA, from);
  const b = terminalAnchor(nodeB, to);
  if (!a || !b) return null;
  const obstacles = [...nodeById.values()]
    .filter((n) => n.id !== edge.source && n.id !== edge.target)
    .map(nodeBox);
  return orthogonalPath(a, b, obstacles);
}

function lengthOf(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return len;
}

/** Build the full docket for the current circuit (engines run fresh when no
 *  results are supplied, so every export is always complete and consistent). */
export function buildDocket(
  nodes: ComponentNode[],
  edges: WireEdge[],
  sim?: SimulationResult,
  validation?: ValidationReport,
  optimization?: OptimizationReport,
): DocketData {
  const simResult = sim ?? simulateCircuit(nodes, edges);
  const validationResult = validation ?? validateCircuit(nodes, edges, simResult);
  const optimizationResult = optimization ?? analyzeCircuit(nodes, edges, simResult);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const components: DocketComponentRow[] = nodes.map((n) => {
    const meta = CATALOG[n.data.componentType];
    const row: DocketComponentRow = {
      id: n.id,
      type: meta.type,
      label: n.data.props.name?.trim() || meta.label,
      rating: ratingFor(meta.type, n.data.props),
    };
    const s = simResult.components.find((c) => c.nodeId === n.id);
    if (s) {
      row.sim = {
        status: s.status,
        currentA: s.currentA,
        voltageV: s.voltageV,
        powerW: s.powerW,
        reason: s.reason,
      };
    }
    return row;
  });

  const wires: DocketWireRow[] = [];
  let totalWirePx = 0;
  for (const e of edges) {
    const pts = routeEdge(e, nodeById);
    if (!pts) continue;
    const len = lengthOf(pts);
    totalWirePx += len;
    wires.push({
      id: e.id,
      from: e.source,
      fromTerminal: e.data?.fromTerminal ?? terminalFromHandle(e.sourceHandle),
      to: e.target,
      toTerminal: e.data?.toTerminal ?? terminalFromHandle(e.targetHandle),
      lengthPx: len,
      lengthM: len / DOCKET_PX_PER_M,
    });
  }

  // Conductor gauge schedule: per used MCB branch (sized to the breaker) or,
  // without an MCB, the connected load current with the 1.25 x margin.
  const conductorSchedule: DocketConductorRow[] = [];
  const touches = (n: ComponentNode, termId: string): boolean =>
    edges.some((e) => {
      const t = e.data?.fromTerminal ?? terminalFromHandle(e.sourceHandle);
      const u = e.data?.toTerminal ?? terminalFromHandle(e.targetHandle);
      return (e.source === n.id && t === termId) || (e.target === n.id && u === termId);
    });
  for (const n of nodes) {
    if (n.data.componentType !== 'mcb') continue;
    if (!touches(n, 'l-in') || !touches(n, 'l-out')) continue;
    const rating = n.data.props.ratedCurrentA ?? 16;
    const g = recommendGauge(rating);
    conductorSchedule.push({
      label: n.data.props.name?.trim() || 'MCB branch',
      designA: rating,
      sizeMm2: g.sizeMm2,
      ampacityA: g.ampacityA,
      adequate: g.adequate,
    });
  }
  if (conductorSchedule.length === 0) {
    const loadCurrent = Math.max(
      0,
      ...simResult.components
        .filter((c) => (c.type === 'bulb' || c.type === 'fan') && c.status === 'on')
        .map((c) => c.currentA),
    );
    if (loadCurrent > 1e-6) {
      const design = loadCurrent * 1.25;
      const g = recommendGauge(design);
      conductorSchedule.push({
        label: 'Unprotected feed',
        designA: design,
        sizeMm2: g.sizeMm2,
        ampacityA: g.ampacityA,
        adequate: g.adequate,
      });
    }
  }

  const summary: DocketSummary = {
    componentCount: nodes.length,
    wireCount: wires.length,
    totalWirePx,
    totalWireM: totalWirePx / DOCKET_PX_PER_M,
    sourceCount: simResult.sourceCount,
    errorCount: validationResult.counts.error,
    warningCount: validationResult.counts.warning,
  };

  return {
    app: 'zcircuit',
    version: 1,
    summary,
    components,
    wires,
    conductorSchedule,
    validation: validationResult,
    optimization: optimizationResult,
  };
}

/** Run the engines fresh and bundle circuit + results into one document. */
function computeAll(nodes: ComponentNode[], edges: WireEdge[]) {
  const sim = simulateCircuit(nodes, edges);
  const validation = validateCircuit(nodes, edges, sim);
  const optimization = analyzeCircuit(nodes, edges, sim);
  return { sim, validation, optimization };
}

/** Self-contained JSON export: full circuit state + live results + docket. */
export function exportJson(nodes: ComponentNode[], edges: WireEdge[]): string {
  const { sim, validation, optimization } = computeAll(nodes, edges);
  const doc = {
    app: 'zcircuit',
    version: 1,
    exportedAt: new Date().toISOString(),
    circuit: serializeCircuit(nodes, edges),
    simulation: sim,
    validation,
    optimization,
    docket: buildDocket(nodes, edges, sim, validation, optimization),
    frequencyHz: MAINS_FREQUENCY_HZ,
  };
  return JSON.stringify(doc, null, 2);
}

/* ---------------------------------------------------------------------------
 * SVG export
 * ------------------------------------------------------------------------- */

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Wiring diagram export: real component symbols + routed wires (valid SVG). */
export function exportSvg(nodes: ComponentNode[], edges: WireEdge[]): string {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const routed = new Map<string, Pt[]>();
  for (const e of edges) {
    const pts = routeEdge(e, nodeById);
    if (pts && pts.length > 1) routed.set(e.id, pts);
  }

  // Bounds.
  const boxes = nodes.map(nodeBox);
  const xs = [0, 1200, ...boxes.map((b) => b.x), ...boxes.map((b) => b.x + b.width)];
  const ys = [0, 800, ...boxes.map((b) => b.y), ...boxes.map((b) => b.y + b.height)];
  const minX = Math.min(...xs) - 24;
  const minY = Math.min(...ys) - 24;
  const maxX = Math.max(...xs) + 24;
  const maxY = Math.max(...ys) + 24;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" font-family="ui-sans-serif, sans-serif">`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
  ];

  for (const [id, pts] of routed) {
    parts.push(
      `<path data-wire="${esc(id)}" d="${pathToSvg(pts)}" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }

  for (const n of nodes) {
    const meta = CATALOG[n.data.componentType];
    const name = esc(n.data.props.name?.trim() || meta.label);
    const symbol = renderToStaticMarkup(
      <SymbolView type={meta.type} props={n.data.props} width={meta.width} height={meta.height} />,
    );
    const terminals = meta.terminals
      .map(
        (t) =>
          `<circle cx="${t.x}" cy="${t.y}" r="3.2" fill="${ROLE_COLOR[t.role]}" stroke="#0f172a" stroke-width="0.8"/>`,
      )
      .join('');
    parts.push(
      `<g data-node="${esc(n.id)}" transform="translate(${n.position.x} ${n.position.y})">`,
      `<rect width="${meta.width}" height="${meta.height + 14}" rx="4" fill="#f8fafc" stroke="#64748b" stroke-width="1.2"/>`,
      `${symbol.replace('<svg', '<svg class="pointer-events-none"')}`,
      terminals,
      `<text x="${meta.width / 2}" y="${meta.height + 10}" text-anchor="middle" font-size="9" fill="#334155">${name}</text>`,
      '</g>',
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
}

/* ---------------------------------------------------------------------------
 * PDF export (jsPDF, produced fully in-browser)
 * ------------------------------------------------------------------------- */

function pdfLine(doc: jsPDF, text: string, y: number, opts: { size?: number; style?: 'normal' | 'bold' } = {}) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 18) {
    doc.addPage();
    return 14;
  }
  doc.setFontSize(opts.size ?? 9);
  doc.setFont('helvetica', opts.style ?? 'normal');
  doc.text(text, 14, y);
  return y + (opts.size ?? 9) * 0.42 + 1;
}

/** PDF wiring report (component list, wire lengths, gauge schedule, results). */
export function exportPdf(nodes: ComponentNode[], edges: WireEdge[]): jsPDF {
  const { sim, validation, optimization } = computeAll(nodes, edges);
  const docket = buildDocket(nodes, edges, sim, validation, optimization);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let y = 16;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Wiring Docket', 14, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `zcircuit practice docket · ${new Date().toLocaleString()} · ${docket.components.length} components · ${docket.wires.length} wires · ~${docket.summary.totalWireM.toFixed(1)} m of cable`,
    14,
    y,
  );
  y += 4;

  y = pdfLine(doc, 'Components', y, { size: 11, style: 'bold' });
  for (const c of docket.components) {
    const simTxt = c.sim ? ` | ${c.sim.status}${c.sim.currentA > 1e-4 ? ` ${c.sim.currentA.toFixed(2)} A` : ''}` : '';
    y = pdfLine(doc, `- ${c.label} (${c.type}) - ${c.rating}${simTxt}`, y);
  }
  y += 2;

  y = pdfLine(doc, 'Wires & lengths', y, { size: 11, style: 'bold' });
  for (const w of docket.wires) {
    y = pdfLine(doc, `- ${w.from} ${w.fromTerminal} -> ${w.to} ${w.toTerminal}  ${w.lengthM.toFixed(2)} m`, y);
  }
  y += 2;

  if (docket.conductorSchedule.length > 0) {
    y = pdfLine(doc, 'Conductor gauge schedule (IEC 60228)', y, { size: 11, style: 'bold' });
    for (const s of docket.conductorSchedule) {
      y = pdfLine(
        doc,
        `- ${s.label}: ${s.designA.toFixed(1)} A design -> ${s.sizeMm2} mm2 (ampacity ${s.ampacityA} A)${s.adequate ? '' : ' - INSUFFICIENT'}`,
        y,
      );
    }
    y += 2;
  }

  y = pdfLine(doc, 'Validation', y, { size: 11, style: 'bold' });
  if (!validation || validation.findings.length === 0) {
    y = pdfLine(doc, 'No problems found.', y);
  } else {
    for (const f of validation.findings.slice(0, 25)) {
      y = pdfLine(doc, `[${f.severity.toUpperCase()}] ${f.code}: ${f.message}`, y);
    }
    if (validation.findings.length > 25) y = pdfLine(doc, `... and ${validation.findings.length - 25} more`, y);
  }
  y += 2;

  y = pdfLine(doc, 'Optimization suggestions', y, { size: 11, style: 'bold' });
  if (!optimization || optimization.suggestions.length === 0) {
    pdfLine(doc, 'No suggestions.', y);
  } else {
    for (const s of optimization.suggestions) {
      y = pdfLine(doc, `[${s.priority.toUpperCase()}] ${s.title}: ${s.detail}`, y);
    }
  }

  return doc;
}