import { CATALOG } from '../components/library/catalog';
import type { ComponentType } from '../types/circuit';
import type { LevelDef, Objective } from './types';

/**
 * Short human labels for level objectives (PLAN.md Part 2). Pure so the HUD
 * checklist can render stable titles while the judge supplies pass/fail detail.
 */
export function objectiveLabel(obj: Objective, level: LevelDef): string {
  const starterTypes = new Map<string, ComponentType>();
  for (const n of level.starter?.nodes ?? []) starterTypes.set(n.id, n.data.componentType);
  const name = (nodeId: string) => {
    const type = starterTypes.get(nodeId);
    return type ? CATALOG[type].label : 'the component';
  };
  switch (obj.kind) {
    case 'powered':
      return `Power ${name(obj.nodeId)}`;
    case 'off':
      return `Keep ${name(obj.nodeId)} off`;
    case 'tripped':
      return `Make ${name(obj.nodeId)} trip`;
    case 'noTrips':
      return 'Keep every MCB closed (no trips)';
    case 'energized':
      return `Energize ${name(obj.nodeId)}`;
    case 'wired':
      return `Wire ${name(obj.from)} to ${name(obj.to)}`;
    case 'noFindings':
      return obj.severity
        ? `No ${obj.severity}-level wiring problems`
        : 'No wiring problems';
    case 'currentUnder':
      return `Current through ${name(obj.nodeId)} < ${obj.maxA} A`;
    case 'wireLengthUnder':
      return `Total wire ≤ ${obj.maxPx} px`;
    case 'gaugeAtLeast':
      return `Feed ${name(obj.nodeId)} with ≥ ${obj.sizeMm2} mm²`;
    case 'componentCount':
      return obj.exact !== undefined
        ? `Exactly ${obj.exact} components on the board`
        : `At least ${obj.atLeast ?? 0} components`;
    case 'switchControls':
      return `${name(obj.loadNodeId)} has its own switch`;
    case 'protectedBy':
      return `${name(obj.loadNodeId)} is MCB-protected`;
    case 'warningsUnder':
      return `At most ${obj.max} optimisation warning(s)`;
    case 'all':
      return obj.items.map((o) => objectiveLabel(o, level)).join('; ');
    case 'any':
      return obj.items.map((o) => objectiveLabel(o, level)).join(' or ');
    default:
      return 'Objective';
  }
}
