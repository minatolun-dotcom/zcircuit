import type { CircuitDoc, CircuitDocEdge, CircuitDocNode } from '../store/serialization';
import type { ComponentProps, ComponentType } from '../types/circuit';
import type { CategoryDef, LevelDef } from './types';

/**
 * Lesson curriculum (PLAN.md Part 2). Content is plain typed data so adding a
 * level is adding an entry; the judge, starter and game UI never change.
 * Wave G1 ships Category 1 (First Circuit, L1-L4); later waves append the
 * remaining categories. Progress unlocks levels in one linear chain across the
 * categories in CATEGORIES order (see orderedLevelIds).
 */

function n(
  id: string,
  componentType: ComponentType,
  x: number,
  y: number,
  props: ComponentProps = {},
): CircuitDocNode {
  return { id, type: 'component', position: { x, y }, data: { componentType, props } };
}

function starter(nodes: CircuitDocNode[], edges: CircuitDocEdge[] = []): CircuitDoc {
  return { app: 'zcircuit', version: 1, nodes, edges };
}

/** A planted edge for a starter circuit (fault levels). */
function e(
  id: string,
  source: string,
  fromTerminal: string,
  target: string,
  toTerminal: string,
): CircuitDocEdge {
  return {
    id,
    source,
    target,
    sourceHandle: `${fromTerminal}::src`,
    targetHandle: `${toTerminal}::src`,
    data: { fromTerminal, toTerminal },
  };
}

/* ---------------------------------------------------------------------------
 * Categories
 * ------------------------------------------------------------------------- */

export const CATEGORIES: CategoryDef[] = [
  { id: 'first-circuit', title: 'First Circuit', tagline: 'Make something light up', icon: '⚡', levelIds: ['first-circuit.1', 'first-circuit.2', 'first-circuit.3', 'first-circuit.4'] },
  { id: 'getting-wired', title: 'Getting Wired', tagline: 'Series, parallel and branches', icon: '🔌', levelIds: ['getting-wired.5', 'getting-wired.6', 'getting-wired.7', 'getting-wired.8'] },
  { id: 'safety-first', title: 'Safety First', tagline: 'Protection, gauges and earthing', icon: '🛡️', levelIds: ['safety-first.9', 'safety-first.10', 'safety-first.11', 'safety-first.12'] },
  { id: 'fault-clinic', title: 'Fault Clinic', tagline: 'Find and fix the faults', icon: '🔧', levelIds: ['fault-clinic.13', 'fault-clinic.14', 'fault-clinic.15', 'fault-clinic.16'] },
  { id: 'master-builder', title: 'Master Builder', tagline: 'Efficient, clean, complete', icon: '🏆', levelIds: ['master-builder.17', 'master-builder.18', 'master-builder.19', 'master-builder.20', 'master-builder.21'] },
];

/* ---------------------------------------------------------------------------
 * Levels
 * ------------------------------------------------------------------------- */

export const LEVELS: LevelDef[] = [
  {
    id: 'first-circuit.1',
    categoryId: 'first-circuit',
    title: 'Make it glow',
    difficulty: 1,
    intro: 'A lamp and a distribution board are on the bench. Wire them so the lamp lights up - every circuit needs a loop: live out, neutral back.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'componentCount', exact: 2 },
    ],
    hints: [
      'A circuit is a loop: power flows out on live (L) and returns on neutral (N).',
      'Drag from the lamp\u2019s L pin to the board\u2019s Way 1 L, then from the lamp\u2019s N pin to the board\u2019s N bus.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('lamp', 'bulb', 420, 120)]),
  },
  {
    id: 'first-circuit.2',
    categoryId: 'first-circuit',
    title: 'Shut it off',
    difficulty: 1,
    intro: 'A bare lamp is no good - you want to turn it off without pulling the fuse. Add a switch on the live conductor so the lamp is controlled.',
    objectives: [
      { kind: 'switchControls', loadNodeId: 'lamp' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'A switch always sits on the live conductor, in series between the power source and the lamp.',
      'Wire: board Way 1 L \u2192 switch L in, switch L out \u2192 lamp L in, lamp N \u2192 board N bus.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('sw', 'switch', 260, 120, { state: 'on' }), n('lamp', 'bulb', 500, 120)]),
  },
  {
    id: 'first-circuit.3',
    categoryId: 'first-circuit',
    title: 'Safe power',
    difficulty: 2,
    intro: 'The lamp works - but a short anywhere in the wiring could melt the cables. Feed the lamp through an MCB so the branch is protected.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'protectedBy', loadNodeId: 'lamp' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'The MCB protects the whole branch, so it must sit on the live feed before the lamp.',
      'Wire: board Way 1 L \u2192 MCB L in, MCB L out \u2192 lamp L in, lamp N \u2192 board N bus.',
      'Leave the MCB closed (state \u201Con\u201D) - it only opens when current exceeds its 16 A rating.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('mcb', 'mcb', 260, 120), n('lamp', 'bulb', 500, 120)]),
  },
  {
    id: 'first-circuit.4',
    categoryId: 'first-circuit',
    title: 'Two rooms',
    difficulty: 2,
    intro: 'The house grows: a lamp in one room and a fan in another, each with its own switch, both protected by one MCB.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'powered', nodeId: 'fan' },
      { kind: 'switchControls', loadNodeId: 'lamp' },
      { kind: 'switchControls', loadNodeId: 'fan' },
      { kind: 'protectedBy', loadNodeId: 'lamp' },
      { kind: 'protectedBy', loadNodeId: 'fan' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 6 },
    ],
    hints: [
      'One MCB can feed both rooms - split its output into two switch branches.',
      'MCB L out wires to both switches\u2019 L in; each switch L out feeds its own load.',
      'Both loads return to the board\u2019s N bus.',
    ],
    starter: starter([
      n('sb', 'switchboard', 0, 140),
      n('mcb', 'mcb', 230, 140),
      n('sw1', 'switch', 420, 80, { state: 'on' }),
      n('sw2', 'switch', 420, 220, { state: 'on' }),
      n('lamp', 'bulb', 620, 80),
      n('fan', 'fan', 620, 220),
    ]),
  },
  {
    id: 'getting-wired.5',
    categoryId: 'getting-wired',
    title: 'Series of events',
    difficulty: 2,
    intro: 'Two lamps, one loop. Wire them in series - the current that leaves the board flows through the first lamp, then the second, then home. Watch the current drop.',
    objectives: [
      { kind: 'powered', nodeId: 'b1' },
      { kind: 'powered', nodeId: 'b2' },
      { kind: 'currentUnder', nodeId: 'b1', maxA: 0.2 },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'In series the same current flows through both lamps: board Way 1 L -> lamp 1 L in, lamp 1 N out -> lamp 2 L in, lamp 2 N out -> board N bus.',
      'Each lamp gets only half the voltage in a series loop - the current stays well under 0.2 A.',
      'A series pair dims both lamps: 60 W + 60 W on one loop draws about 0.13 A.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('b1', 'bulb', 420, 120), n('b2', 'bulb', 760, 120)]),
  },
  {
    id: 'getting-wired.6',
    categoryId: 'getting-wired',
    title: 'Parallel world',
    difficulty: 2,
    intro: 'Same two lamps - but now each gets its own full loop back to the board. Wire them in parallel so both shine at full brightness, like sockets around a house.',
    objectives: [
      { kind: 'powered', nodeId: 'b1' },
      { kind: 'powered', nodeId: 'b2' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'Parallel means each lamp has its own pair of wires to the board: board Way 1 L branches to both lamps, and both lamp neutrals return to the N bus.',
      'Two wires can leave the same terminal - branch Way 1 L to lamp 1 L in and lamp 2 L in.',
      'Each 60 W lamp draws its full 0.26 A in parallel - both shine at full power.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('b1', 'bulb', 420, 120), n('b2', 'bulb', 760, 120)]),
  },
  {
    id: 'getting-wired.7',
    categoryId: 'getting-wired',
    title: 'Fan & light',
    difficulty: 3,
    intro: 'One room, one switch: a ceiling light and a fan that must both turn off together from a single switch, fed through one MCB.',
    objectives: [
      { kind: 'powered', nodeId: 'bulb' },
      { kind: 'powered', nodeId: 'fan' },
      { kind: 'switchControls', loadNodeId: 'bulb' },
      { kind: 'switchControls', loadNodeId: 'fan' },
      { kind: 'protectedBy', loadNodeId: 'bulb' },
      { kind: 'protectedBy', loadNodeId: 'fan' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 5 },
    ],
    hints: [
      'The switch sits between the MCB and both loads - its output branches to the light and the fan.',
      'Wire: MCB L out -> switch L in, switch L out -> bulb L in AND fan L in.',
      'Both loads return to the board N bus. Close the switch (state on) or nothing flows.',
    ],
    starter: starter([
      n('sb', 'switchboard', 0, 140),
      n('mcb', 'mcb', 230, 140),
      n('sw', 'switch', 420, 140, { state: 'on' }),
      n('bulb', 'bulb', 620, 140),
      n('fan', 'fan', 900, 140),
    ]),
  },
  {
    id: 'getting-wired.8',
    categoryId: 'getting-wired',
    title: 'Second way',
    difficulty: 3,
    intro: 'Staircase light: you want to turn the lamp on or off from either end of the stairs. Wire two switches in parallel so either one can light the lamp.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'switchControls', loadNodeId: 'lamp' },
      { kind: 'protectedBy', loadNodeId: 'lamp' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 5 },
    ],
    hints: [
      'Two switches in parallel: both live inputs join the MCB output, and both outputs join the lamp live terminal.',
      'Close at least one switch (click it and set state on) to light the lamp - either switch works.',
      'Wire: MCB L out -> switch 1 L in and switch 2 L in; switch 1 L out and switch 2 L out -> lamp L in.',
    ],
    starter: starter([
      n('sb', 'switchboard', 0, 140),
      n('mcb', 'mcb', 230, 140),
      n('sw1', 'switch', 420, 80),
      n('sw2', 'switch', 420, 220),
      n('lamp', 'bulb', 650, 140),
    ]),
  },
  {
    id: 'safety-first.9',
    categoryId: 'safety-first',
    title: "Don't short it",
    difficulty: 2,
    intro: 'Power is unforgiving: joining live and neutral with no load in between is a dead short. Wire this lamp correctly and keep the live and neutral nets apart.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'noFindings', severity: 'error' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 2 },
    ],
    hints: [
      'A circuit is a loop: live out, through the lamp, neutral back. Never join L and N directly.',
      'Wire board Way 1 L -> lamp L in and lamp N out -> board N bus - the lamp sits between live and neutral.',
      'If live and neutral ever share a net with no load between them, you have a short circuit.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('lamp', 'bulb', 420, 120)]),
    par: { warningAllowance: 1 },
  },
  {
    id: 'safety-first.10',
    categoryId: 'safety-first',
    title: 'Breaker logic',
    difficulty: 3,
    intro: 'The MCB is the guard dog of the branch. Push this branch past its 16 A rating and watch the breaker trip to protect the wiring - then you will understand why it is there.',
    objectives: [
      { kind: 'tripped', nodeId: 'mcb' },
      { kind: 'off', nodeId: 'lamp' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'The MCB opens when the branch current exceeds its rating. Raise the lamp\u2019s rated power until it draws more than 16 A.',
      '16 A x 230 V is about 3680 W - select the lamp and set its rated power above that.',
      'A 4000 W lamp on the 16 A MCB draws ~17.4 A: the breaker trips and the lamp goes dark. That is protection working.',
    ],
    starter: starter([
      n('sb', 'switchboard', 0, 120),
      n('mcb', 'mcb', 230, 120),
      n('lamp', 'bulb', 620, 120),
    ]),
    par: { warningAllowance: 1 },
  },
  {
    id: 'safety-first.11',
    categoryId: 'safety-first',
    title: 'Sizing up',
    difficulty: 3,
    intro: 'Every conductor needs an ampacity above the current it can carry. IEC 60228 copper sizes: 1.5 mm² = 17.5 A, 2.5 mm² = 24 A, 4 mm² = 32 A, 6 mm² = 41 A. Size this branch to 4 mm² or better.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'gaugeAtLeast', nodeId: 'mcb', sizeMm2: 4 },
      { kind: 'noTrips' },
      { kind: 'noFindings' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'The gauge follows the MCB rating: the breaker caps the branch current, so the wire must carry at least that much.',
      'A 20 A branch only needs 2.5 mm² - you need a rating whose ampacity is 32 A or more: set the MCB to 32 A.',
      'With a 32 A MCB the branch sizes to 4 mm² - adequate and safe.',
    ],
    starter: starter([
      n('sb', 'switchboard', 0, 120),
      n('mcb', 'mcb', 230, 120),
      n('lamp', 'bulb', 620, 120),
    ]),
  },
  {
    id: 'safety-first.12',
    categoryId: 'safety-first',
    title: 'Earth it',
    difficulty: 3,
    intro: 'A socket needs more than power: its protective earth (PE) must reach the board\u2019s PE bus so a faulty appliance cannot electrify its case. Feed a socket through an MCB and earth it properly.',
    objectives: [
      { kind: 'energized', nodeId: 'socket' },
      { kind: 'noFindings', severity: 'warning' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'Wire the socket\u2019s L in and N in to live and neutral - and its PE in to the board\u2019s PE bus out.',
      'An energized socket without earth is flagged: PE in -> board PE bus is the third wire.',
      'Board Way 1 L -> MCB L in, MCB L out -> socket L in, socket N in -> board N bus, socket PE in -> board PE bus.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('mcb', 'mcb', 230, 120), n('socket', 'socket', 620, 120)]),
  },
  {
    id: 'fault-clinic.13',
    categoryId: 'fault-clinic',
    title: 'Loose wire',
    difficulty: 4,
    intro: 'Someone left a stray wire hanging between the board and the lamp, and the neutral never made it home. Find the loose wire, pull it, and finish the job.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'noFindings', severity: 'warning' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'The lamp\u2019s neutral side is not connected - the circuit is missing its return loop.',
      'One wire is a stray: select it and press Delete (or hover it and click \u00d7).',
      'After the stray wire is gone, wire lamp N out -> board N bus.',
    ],
    starter: starter(
      [n('sb', 'switchboard', 0, 120), n('mcb', 'mcb', 230, 120), n('lamp', 'bulb', 620, 120)],
      [
        e('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
        e('w2', 'mcb', 'l-out', 'lamp', 'l-in'),
        { id: 'w3', source: 'sb', target: 'lamp', sourceHandle: null, targetHandle: null, data: { fromTerminal: '', toTerminal: '' } },
      ],
    ),
  },
  {
    id: 'fault-clinic.14',
    categoryId: 'fault-clinic',
    title: 'Dead short',
    difficulty: 4,
    intro: 'A wire has been dropped across live and neutral - a dead short. The lamp cannot stay lit and the board flags the short. Find the offending wire and remove it.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'noFindings', severity: 'error' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'The lamp is dark and a short circuit is reported - look for a wire that joins the live side to the neutral side.',
      'The extra wire runs from the MCB\u2019s L out to the board\u2019s N bus. Select it and press Delete.',
      'With the short gone, live and neutral stay apart and the lamp powers up normally.',
    ],
    starter: starter(
      [n('sb', 'switchboard', 0, 120), n('mcb', 'mcb', 230, 120), n('lamp', 'bulb', 620, 120)],
      [
        e('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
        e('w2', 'mcb', 'l-out', 'lamp', 'l-in'),
        e('w3', 'lamp', 'n-out', 'sb', 'n-out'),
        e('w4', 'mcb', 'l-out', 'sb', 'n-out'),
      ],
    ),
  },
  {
    id: 'fault-clinic.15',
    categoryId: 'fault-clinic',
    title: 'No earth',
    difficulty: 4,
    intro: 'The socket is live but nobody earthed it - its PE terminal dangles. A modern socket without protective earth is dangerous. Add the missing earth wire.',
    objectives: [
      { kind: 'energized', nodeId: 'socket' },
      { kind: 'noFindings', severity: 'warning' },
      { kind: 'noTrips' },
      { kind: 'componentCount', exact: 3 },
    ],
    hints: [
      'The socket has L and N but its earth pin is unwired - the validation flags the missing protective earth.',
      'Wire socket PE in -> board PE bus out to complete the earthing.',
      'The socket is already energized - only the earth wire is missing.',
    ],
    starter: starter(
      [n('sb', 'switchboard', 0, 120), n('mcb', 'mcb', 230, 120), n('socket', 'socket', 620, 120)],
      [e('w1', 'sb', 'way-1-l', 'mcb', 'l-in'), e('w2', 'mcb', 'l-out', 'socket', 'l-in'), e('w3', 'socket', 'n-in', 'sb', 'n-out')],
    ),
  },
  {
    id: 'fault-clinic.16',
    categoryId: 'fault-clinic',
    title: 'Overloaded branch',
    difficulty: 4,
    intro: 'Two 2000 W halogen lamps were squeezed onto one 16 A branch - 17.4 A is more than the breaker can take. Split the load across a second protected branch.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp1' },
      { kind: 'powered', nodeId: 'lamp2' },
      { kind: 'noTrips' },
      { kind: 'protectedBy', loadNodeId: 'lamp1' },
      { kind: 'protectedBy', loadNodeId: 'lamp2' },
    ],
    hints: [
      'Two 2000 W lamps on one 16 A MCB draw ~17.4 A - the breaker trips. Each branch must stay under its rating.',
      'Add a second MCB from the palette and feed it from the board\u2019s Way 2 L.',
      'Move one lamp onto its own MCB: Way 2 L -> MCB 2 L in, MCB 2 L out -> lamp 2 L in, lamp 2 N out -> board N bus.',
    ],
    starter: starter(
      [
        n('sb', 'switchboard', 0, 120),
        n('mcb', 'mcb', 230, 120),
        n('lamp1', 'bulb', 620, 120, { wattageW: 2000 }),
        n('lamp2', 'bulb', 900, 120, { wattageW: 2000 }),
      ],
      [
        e('w1', 'sb', 'way-1-l', 'mcb', 'l-in'),
        e('w2', 'mcb', 'l-out', 'lamp1', 'l-in'),
        e('w3', 'mcb', 'l-out', 'lamp2', 'l-in'),
        e('w4', 'lamp1', 'n-out', 'sb', 'n-out'),
        e('w5', 'lamp2', 'n-out', 'sb', 'n-out'),
      ],
    ),
  },
  {
    id: 'master-builder.17',
    categoryId: 'master-builder',
    title: 'Shortest path',
    difficulty: 4,
    intro: 'Copper costs money and long runs waste it. Wire this switch-controlled, protected lamp with the shortest possible total wire length - every loop counts.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'switchControls', loadNodeId: 'lamp' },
      { kind: 'protectedBy', loadNodeId: 'lamp' },
      { kind: 'noTrips' },
      { kind: 'wireLengthUnder', maxPx: 1200 },
      { kind: 'componentCount', exact: 4 },
    ],
    hints: [
      'Keep the components close: the total wire length is measured on the routed paths, and every bend adds distance.',
      'A compact loop wins: board Way 1 L -> MCB -> switch -> lamp, with the lamp\u2019s neutral returning to the board N bus.',
      'If the lamp sits close under the switch, the return run stays short - the whole loop can fit in ~1000 px.',
    ],
    starter: starter([n('sb', 'switchboard', 0, 120), n('mcb', 'mcb', 230, 120), n('sw', 'switch', 420, 120, { state: 'on' }), n('lamp', 'bulb', 650, 120)]),
  },
  {
    id: 'master-builder.18',
    categoryId: 'master-builder',
    title: 'No crossings',
    difficulty: 4,
    intro: 'A tidy board is a safe board: wires that cross on the diagram are ambiguous and ugly. Power and switch two loads with zero wire crossings.',
    objectives: [
      { kind: 'powered', nodeId: 'lamp' },
      { kind: 'powered', nodeId: 'fan' },
      { kind: 'switchControls', loadNodeId: 'lamp' },
      { kind: 'switchControls', loadNodeId: 'fan' },
      { kind: 'protectedBy', loadNodeId: 'lamp' },
      { kind: 'protectedBy', loadNodeId: 'fan' },
      { kind: 'noTrips' },
      { kind: 'warningsUnder', max: 0 },
      { kind: 'noFindings' },
      { kind: 'componentCount', exact: 6 },
    ],
    hints: [
      'Plan the layout so branches fan out from the MCB and every return runs in its own corridor.',
      'Keep each load in its own row: MCB L out branches to switch 1 (lamp, top row) and switch 2 (fan, bottom row).',
      'Returns hug the edges - lamp N and fan N each run back to the board N bus without crossing the other branch.',
    ],
    starter: starter([
      n('sb', 'switchboard', 0, 140),
      n('mcb', 'mcb', 230, 140),
      n('sw1', 'switch', 420, 80, { state: 'on' }),
      n('sw2', 'switch', 420, 220, { state: 'on' }),
      n('lamp', 'bulb', 620, 80),
      n('fan', 'fan', 620, 220),
    ]),
  },
  {
    id: 'master-builder.19',
    categoryId: 'master-builder',
    title: 'Whole house',
    difficulty: 4,
    intro: 'Now build for real: one MCB, two switch-controlled loads, and an earthed socket - all powered, none tripped, nothing crossed, nothing flagged.',
    objectives: [
      { kind: 'powered', nodeId: 'bulb' },
      { kind: 'powered', nodeId: 'fan' },
      { kind: 'energized', nodeId: 'socket' },
      { kind: 'switchControls', loadNodeId: 'bulb' },
      { kind: 'switchControls', loadNodeId: 'fan' },
      { kind: 'protectedBy', loadNodeId: 'bulb' },
      { kind: 'protectedBy', loadNodeId: 'fan' },
      { kind: 'noTrips' },
      { kind: 'noFindings' },
      { kind: 'warningsUnder', max: 0 },
      { kind: 'componentCount', exact: 7 },
    ],
    hints: [
      'The MCB feeds three branches: two switches (one per load) and the socket. All neutrals and the earth return to the board.',
      'Put the switch branches in their own rows so their wires never cross the socket feeds.',
    ],
    starter: starter([
      n('sb', 'switchboard', 0, 140),
      n('mcb', 'mcb', 230, 140),
      n('sw1', 'switch', 420, 80, { state: 'on' }),
      n('sw2', 'switch', 420, 220, { state: 'on' }),
      n('bulb', 'bulb', 620, 140),
      n('fan', 'fan', 620, 220),
      n('socket', 'socket', 760, 340),
    ]),
    par: { wireBudgetPx: 4800 },
  },
  {
    id: 'master-builder.20',
    categoryId: 'master-builder',
    title: 'Inverter backup',
    difficulty: 4,
    intro: 'Power cuts happen. Feed this room from an inverter so the lights and fan keep running - still MCB-protected, still no trips.',
    objectives: [
      { kind: 'powered', nodeId: 'bulb' },
      { kind: 'powered', nodeId: 'fan' },
      { kind: 'protectedBy', loadNodeId: 'bulb' },
      { kind: 'protectedBy', loadNodeId: 'fan' },
      { kind: 'noTrips' },
      { kind: 'noFindings' },
      { kind: 'componentCount', exact: 4 },
    ],
    hints: [
      'A live inverter behaves like a 230 V source on its output: feed the MCB from inverter L out / N out.',
      'Wire: inverter L out -> MCB L in, MCB L out -> bulb L in and fan L in.',
      'Both loads return to the inverter\u2019s N out - the backup loop never touches the mains board.',
    ],
    starter: starter([
      n('inv', 'inverter', 0, 100),
      n('mcb', 'mcb', 280, 100),
      n('bulb', 'bulb', 540, 100),
      n('fan', 'fan', 800, 100),
    ]),
  },
  {
    id: 'master-builder.21',
    categoryId: 'master-builder',
    title: 'Grand design',
    difficulty: 5,
    intro: 'The final build: two switch-controlled loads plus two earthed sockets on one protected branch, cleanly laid out with no crossings, no findings, nothing tripped. Make it perfect.',
    objectives: [
      { kind: 'powered', nodeId: 'bulb' },
      { kind: 'powered', nodeId: 'fan' },
      { kind: 'energized', nodeId: 'socket1' },
      { kind: 'energized', nodeId: 'socket2' },
      { kind: 'switchControls', loadNodeId: 'bulb' },
      { kind: 'switchControls', loadNodeId: 'fan' },
      { kind: 'protectedBy', loadNodeId: 'bulb' },
      { kind: 'protectedBy', loadNodeId: 'fan' },
      { kind: 'noTrips' },
      { kind: 'noFindings' },
      { kind: 'warningsUnder', max: 0 },
      { kind: 'componentCount', exact: 8 },
    ],
    hints: [
      'One MCB can feed all four branches - chain the sockets: MCB L out -> socket 1 L in, socket 1 L in -> socket 2 L in.',
      'Every load and socket returns to the board N bus; both sockets\u2019 PE pins reach the PE bus.',
    ],
    starter: starter([
      n('sb', 'switchboard', 0, 140),
      n('mcb', 'mcb', 230, 140),
      n('sw1', 'switch', 420, 80, { state: 'on' }),
      n('sw2', 'switch', 420, 220, { state: 'on' }),
      n('bulb', 'bulb', 620, 140),
      n('fan', 'fan', 620, 220),
      n('socket1', 'socket', 760, 340),
      n('socket2', 'socket', 760, 460),
    ]),
    par: { wireBudgetPx: 6600 },
  },
];

/* ---------------------------------------------------------------------------
 * Lookups
 * ------------------------------------------------------------------------- */

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function categoryById(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function levelsInCategory(categoryId: string): LevelDef[] {
  const cat = categoryById(categoryId);
  if (!cat) return [];
  return cat.levelIds.map((id) => levelById(id)).filter((l): l is LevelDef => l !== undefined);
}

/** The complete linear unlock chain across every category, in play order. */
export function orderedLevelIds(): string[] {
  return CATEGORIES.flatMap((c) => c.levelIds);
}

/** Id of the level that unlocks after `levelId` (undefined for the finale). */
export function nextLevelId(levelId: string): string | undefined {
  const chain = orderedLevelIds();
  const i = chain.indexOf(levelId);
  return i >= 0 ? chain[i + 1] : undefined;
}