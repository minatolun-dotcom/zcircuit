# Electrical Wiring Practice App - Work Plan

> **Complete, self-contained work plan** for building a web-based interactive electrical wiring simulation application. Ready for execution by any AI agent or developer.

---

## TL;DR (For humans)

**What you'll get:** A complete web-based electrical wiring practice application where you can drag-and-drop electrical components (MCBs, switches, bulbs, fans, inverters, switchboards, sockets) onto a canvas, wire them together interactively, run simulations that show current flow and check for errors like short circuits and floating wires, get suggestions for better wiring, and generate wiring dockets/reports.

**Why this approach:** React Flow + Zustand is the proven stack used by multiple production circuit simulators (ElectraSim, UBU Electrical Basic, CircuitSetu). A custom MNA solver is sufficient for house wiring practice and avoids unnecessary WASM complexity. IEC 60617 symbols give international-standard component representation.

**What it will NOT do:** Full SPICE-grade simulation, multi-user collaboration, mobile app, 3D visualization, real hardware integration, or professional certification features.

**Effort:** Large
**Risk:** Medium - dependency on React Flow ecosystem changes; simulation engine complexity for edge cases
**Decisions made for you:** IEC 60617 standards (international), student/hobbyist focus (educational), custom MNA over spice-ts/ngspice WASM, SVG for visualization. Simulation = steady-state resistive solve at 230 V RMS with synthesized 50 Hz waveforms (see "Simulation & component modeling conventions"). All documented in draft with reversible notes.

Your next move: Approve to proceed. Full execution detail follows below.

---

> TL;DR (machine): Large effort, Medium risk. 11 implementation todos across 7 waves. 6 major modules: wiring canvas, component library, simulation engine, validation system, optimization engine, docket generator. React 19 + TypeScript + Vite + Tailwind + React Flow + Zustand. IEC 60617, student/hobbyist.

---

## Scope

### Must have
- Interactive wiring canvas with drag-and-drop (React Flow)
- Component library: MCB, switch, bulb, fan, inverter, switchboard, socket/docket outlets
- Terminal-level wiring connections with orthogonal auto-routing
- Simulation engine: MNA solver, KCL/KVL validation, MCB trip logic, visual current flow animation
- Error validation: short-circuit detection, floating wire detection, missing ground, polarity errors
- Optimization suggestions: wire path optimization, gauge selection, best-practice wiring tips
- Docket/wiring report generation (JSON + SVG export)
- Undo/redo, circuit save/load, waveform display
- Component property editor panel

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Full SPICE-grade simulation
- Multi-user collaboration / cloud sync
- Mobile app (web-only)
- 3D visualization
- Real hardware / IoT integration
- AC transient analysis
- Professional certification features

---

## Verification strategy

> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + tests-after + Playwright E2E
- Framework: Vitest (unit/integration), Playwright (E2E)
- Evidence: `.omo/evidence/ulw/<session>/<goalId>/a<attempt>`

Key verification tests:
- Circuit validation: wire a complete bulb circuit → simulation runs, current flows correctly
- Short-circuit detection: connect live to neutral directly → error flagged
- Floating wire detection: wire end attached to nothing → warning shown (designed open endpoints like socket outlets are NOT flagged)
- MCB trip simulation: overload current → MCB opens circuit
- Optimization: suggest shorter wire path → wire length reduced
- Docket generation: export wiring report → JSON/SVG file created
- Save/load: save circuit → reload → identical state
- Undo/redo: perform 5 actions → undo 3 → state matches after 2 actions

---

## Execution strategy

### Parallel execution waves

> Waves are dependency-ordered checkpoints, not fixed-size batches. Waves 2/5/6/7 are intentionally single-todo because the chain state → simulation → validation → optimization is serial; never parallelize across those edges. Where a wave lists multiple todos (Waves 1, 3, 4), run them in parallel.

**Wave 1 (parallel):** Project foundation (todo 1 must land first) + Component library (2) + Wiring canvas (3)
**Wave 2:** State management (todo 4; depends on all of Wave 1)
**Wave 3:** Simulation engine (todo 5) → Validation system (todo 6; depends on Simulation)
**Wave 4 (parallel):** Optimization engine (todo 7; depends on Validation) + UI panels (todo 8; depends on State + Validation results)
**Wave 5:** Waveform display (todo 9; depends on Simulation)
**Wave 6:** Docket generator (todo 10; depends on UI + Waveform)
**Wave 7:** Integration & testing (todo 11; depends on all)

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. Project foundation | - | 2, 3 | - |
| 2. Component library | 1 | 4, 8 | 3 |
| 3. Wiring canvas | 1 | 4 (5 via 4) | 2 |
| 4. State management | 1, 2, 3 | 5, 8 | - |
| 5. Simulation engine | 4 | 6, 9 | - |
| 6. Validation system | 5 | 7, 8 | - |
| 7. Optimization engine | 6 | 10 | - |
| 8. UI panels and toolbar | 1, 2, 4, 6 | 10 | 7 |
| 9. Waveform display | 5 | 10 | - |
| 10. Docket generator | 8, 9 | 11 | - |
| 11. Integration and testing | 2,3,4,5,6,7,8,9,10 | - | - |

---

## Todos

> Implementation + Test = ONE todo. Never separate.

- [ ] 1. Project foundation: Initialize Vite + React 19 + TypeScript + Tailwind CSS project with ESLint, Prettier, Vitest config, Playwright config. Set up React Flow + Zustand. If no `.git` exists in the workspace yet, run `git init` before the first commit. Create base project structure: src/components (custom nodes, panels, toolbar), src/components/library (symbols), src/store, src/engine (solver), src/validation, src/optimization, src/waveform, src/docket, src/types, src/utils.
  What to do / Must NOT do: Create clean project scaffold with all build tooling. Package manager is pnpm everywhere - run scripts with `pnpm`, never `npm`. Naming note: "React Flow" is now distributed as `@xyflow/react` (v12); docs live at reactflow.dev / xyflow.com. Tailwind v4: install `tailwindcss` + `@tailwindcss/vite` and register the Vite plugin; the CSS entry uses `@import "tailwindcss";` (no tailwind.config.js required). Must NOT include any circuit logic yet.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2, 3, 4
  References (executor has NO interview context - be exhaustive): Vite React TypeScript template (vitejs.dev/guide/#react); React Flow docs (reactflow.dev); Zustand docs (zustand-demo.pmnd.rs); Tailwind CSS docs (tailwindcss.com/docs/installation) and @tailwindcss/vite plugin docs; Playwright browser install (playwright.dev/docs/browsers)
  Acceptance criteria: `pnpm run dev` starts dev server with hot reload. `pnpm test` runs Vitest. `pnpm exec playwright test` runs E2E (after `pnpm exec playwright install chromium`). React Flow canvas renders blank with zoom/pan working. TypeScript compiles without errors.
  QA scenarios: Playwright E2E: navigate to app → verify React Flow canvas renders → verify toolbar shows component palette. Vitest: verify project imports work.
  Commit: Y | chore(init): initialize project scaffold

- [ ] 2. Component library: Build IEC 60617 symbol components for MCB, single-pole switch, bulb, fan, inverter, switchboard (3-phase), socket/docket outlets. Each component is a React Flow custom node with terminal ports (input/output). Include properties panel (rated current, voltage, wattage). Support drag-from-palette to canvas.
  What to do / Must NOT do: Create reusable React components for each electrical symbol with port-based connections. Must NOT include simulation logic in components.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 4, 8
  References (executor has NO interview context - be exhaustive): NovaShang/sldeditor (github.com/NovaShang/sldeditor) - real IEC-style single-line-diagram editor worth studying for symbol + smart orthogonal-wiring ideas, but it is Angular and not a schematic library, so study only, do NOT import; ElectraSim's MCB/switch/bulb/fan node patterns (electrasim.com); React Flow custom nodes docs (reactflow.dev/docs/concepts/custom-nodes); IEC 60617 standard symbols (iec.ch/en/search-for-standards). Draw each symbol by hand as inline SVG per IEC 60617 - no verified ready-made schematic-symbol npm package exists (do not spend time hunting for one).
  Acceptance criteria: All 7 component types render as React Flow nodes with correct IEC 60617 symbols. Each has correct terminal ports. Drag-and-drop from palette to canvas works. Properties panel shows/edit component properties. Node deletion works.
  QA scenarios: Playwright: drag MCB from palette → verify node appears on canvas → verify ports visible → verify properties panel updates. Vitest: verify each component renders with correct SVG paths.
  Commit: Y | feat(components): add IEC 60617 component library

- [ ] 3. Wiring canvas: Implement terminal-level connections (not bounding-box) with orthogonal wire routing using A* pathfinding. Add wire animation (visual current flow). Support wire deletion by selecting and pressing delete. Add connection validation (no duplicate connections, no self-connection).
  What to do / Must NOT do: Wire connections must connect terminal-to-terminal. Must NOT use bounding-box connection logic.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 4 (5 through 4)
  References (executor has NO interview context - be exhaustive): React Flow edges documentation (reactflow.dev/docs/basics/edges); A* pathfinding algorithm implementation; CircuitFlow orthogonal routing approach (github.com/EV-OD/circuitflow); sldeditor auto-snap + orthogonal routing (npmjs.com/package/sldeditor)
  Acceptance criteria: Wires connect terminal-to-terminal with orthogonal routing. Wire animation shows current flow direction. Connecting a terminal to itself shows error. Duplicate connections are rejected. Wire deletion works.
  QA scenarios: Playwright: connect MCB output to bulb input → verify orthogonal wire renders → verify animation plays → verify wire follows terminal when node moves. Vitest: verify A* finds shortest path between two points.
  Commit: Y | feat(canvas): implement terminal-level wiring with A* routing

- [ ] 4. State management: Implement Zustand store with circuit state (nodes, edges, component properties), undo/redo stack (bounded to 50 actions), circuit save/load to localStorage, simulation state (running/paused, speed). Implement circuit serialization/deserialization to JSON.
  What to do / Must NOT do: All state management through Zustand. Must NOT use Redux or Context for circuit state.
  Parallelization: Wave 2 | Blocked by: 1, 2, 3 | Blocks: 5, 8
  References (executor has NO interview context - be exhaustive): React Flow + Zustand official guide (reactflow.dev/learn/advanced-use/state-management); Zustand docs (github.com/pmndrs/zustand); CircuitSetu state management pattern (github.com/r17e8h/CircuitSetu)
  Acceptance criteria: All circuit state in Zustand store. Undo/redo works for 50 actions. Circuit saves to localStorage and reloads correctly. JSON serialization/deserialization preserves full circuit state. Simulation state (running/paused/speed) managed through store.
  QA scenarios: Playwright: create circuit → save → reload → verify identical state → perform 5 actions → undo 3 → verify correct state. Vitest: verify Zustand store updates correctly.
  Commit: Y | feat(state): implement Zustand store with undo/redo and persistence

- [ ] 5. Simulation engine: Implement custom MNA (Modified Nodal Analysis) solver in TypeScript. Include: Union-Find for automatic node detection from wire connections, MNA matrix assembly from component stamps (resistor, voltage source, current source), LU decomposition with partial pivoting, Ohm's Law + Kirchhoff's Laws calculations, MCB trip logic (current > rated → open circuit), ground node detection, per-component current/voltage/power calculations.
  What to do / Must NOT do: Real-numbered steady-state MNA solver over the circuit graph derived from wire connections. Solve at RMS mains magnitude (230 V, 50 Hz; one source per L-N loop - see "Simulation & component modeling conventions"). Union-Find to merge terminals joined by wires into nodes, stamp and solve with LU decomposition (partial pivoting), then compute per-component I/V/P. MCB trips (opens and reports a reason) when |I_rms| > its rated current. The ground/PE rail is the reference node (0 V). Must NOT implement SPICE, AC phasors, or transient/time-stepping - Bhilai's Backward Euler solver is out of scope; borrow only its MNA assembly + Union-Find ideas.
  Parallelization: Wave 3 | Blocked by: 4 | Blocks: 6, 9
  References (executor has NO interview context - be exhaustive): Bhilai EE Simulator MNA solver (github.com/OpenLake/bhilaee-simulator/blob/main/src/simulation/MNASolver.js - MNA + Union-Find only); spice-ts GitHub (github.com/mfiumara/spice-ts) for a TypeScript MNA approach; Modified Nodal Analysis theory; Union-Find algorithm for node detection
  Acceptance criteria: MNA solver correctly calculates voltages and currents for simple circuits (voltage divider, parallel resistors, series circuit) and for standard house-wiring loops at 230 V RMS. MCB trips when |I_rms| exceeds its rated current. Ground node is correctly identified. Solution converges for standard house wiring configurations.
  QA scenarios: Unit test: voltage divider circuit (Vin=220V, R1=1k, R2=1k) → verify Vout=110V. Unit test: short circuit → verify MCB trips. Unit test: open circuit → verify zero current. Integration: simulate bulb circuit → verify bulb lights with correct voltage.
  Commit: Y | feat(engine): implement MNA simulation solver

- [ ] 6. Validation system: Build comprehensive circuit validation pipeline with: topological sort (Kahn's BFS) for cycle detection (prevents short circuits), DFS-based floating wire detection, KCL verification at every node (currents sum to ≈0), KVL verification for loops (voltages sum to ≈0), power conservation check (total supplied ≈ total consumed), ground presence check, MCB state validation, connection integrity check.
  What to do / Must NOT do: Validation runs as a pure function over (nodes, edges, component props) and never modifies circuit state. Must NOT block simulation - must be async/reactive. Respect endpoint semantics: sockets, spare switchboard ways, and open switches are VALID open terminals; a "floating wire" means a wire whose far end is attached to nothing, not an unconnected terminal of a device designed to be an endpoint. Allow a small numeric tolerance (~1e-6) in KCL/KVL/power checks to avoid float-noise false positives.
  Parallelization: Wave 3 | Blocked by: 5 | Blocks: 7, 8
  References (executor has NO interview context - be exhaustive): Kahn's algorithm for topological sort (en.wikipedia.org/wiki/Topological_sorting); DFS cycle detection; Kirchhoff's current and voltage laws (en.wikipedia.org/wiki/Kirchhoff%27s_circuit_laws); Bhilai EE Simulator validation approach (github.com/OpenLake/bhilaee-simulator)
  Acceptance criteria: Short circuit detection flags live-to-neutral direct connection. Floating wires trigger warnings. KCL violations reported at offending nodes. KVL violations reported for loops. Ground presence verified. Designed open endpoints (socket outlet, spare switchboard way, open switch) are NOT flagged. Validation results displayed on canvas (color-coded).
  QA scenarios: Playwright: create short circuit → verify error highlighted on canvas → verify error message. Vitest: verify KCL passes for a correctly wired circuit. Vitest: socket fed from MCB with nothing plugged in → NO "floating wire" error; a wire end attached to nothing → warning. Integration: wire incomplete circuit → verify "missing ground" or "floating wire" warning.
  Commit: Y | feat(validation): build circuit validation pipeline

- [ ] 7. Optimization engine: Implement wiring optimization suggestions including: wire path optimization (A* with obstacle avoidance for shorter paths), wire gauge selection based on current load, best-practice wiring tips (color coding, proper bundling, minimum bend radius), component placement suggestions (minimize wire crossings), power distribution analysis (identify overloaded branches).
  What to do / Must NOT do: Suggestions must be non-blocking and advisory. Must NOT auto-make changes - user must apply suggestions manually. Wire-gauge suggestions use IEC 60228 conductor sizes (1.5/2.5/4/6 mm²) with conservative copper ampacity at 230 V single-phase - not AWG.
  Parallelization: Wave 4 | Blocked by: 6 | Blocks: 10
  References (executor has NO interview context - be exhaustive): CircuitFlow A* pathfinding with obstacle avoidance (github.com/EV-OD/circuitflow); Electrical wiring best practices (iec.ch); IEC 60228 conductor sizes and IEC 60364 ampacity tables for gauge selection
  Acceptance criteria: Optimization engine suggests shorter wire paths. Wire gauge recommendations match current load. Best-practice tips displayed in UI. Suggestions are ranked by priority (critical/warning/info). User can apply suggestion to update wiring.
  QA scenarios: Playwright: create circuit with long wire → verify optimization suggestion appears → apply suggestion → verify wire shortened. Vitest: verify gauge selection returns the correct IEC 60228 mm² size with an adequate ampacity margin for a given current.
  Commit: Y | feat(optimization): build wiring optimization engine

- [ ] 8. UI panels and toolbar: Build the user interface: left sidebar component palette (categorized: protection, controls, lighting, power, auxiliary), right sidebar properties panel (component editing), bottom toolbar (simulation controls: play/pause/speed, validation toggle, optimization toggle), top toolbar (new/open/save/export, zoom controls, grid toggle). Responsive layout. Dark/light mode support.
  What to do / Must NOT do: All UI must be built with React + Tailwind. Must NOT use external UI component libraries for core functionality.
  Parallelization: Wave 4 | Blocked by: 1, 2, 4, 6 | Blocks: 10
  References (executor has NO interview context - be exhaustive): React Flow controls and minimap (reactflow.dev/docs/guides/controls); Tailwind CSS documentation (tailwindcss.com/docs); Common circuit simulator UI patterns (ElectraSim at electrasim.com, UBU Electrical Basic at github.com/ThummarosR/ubu-electrical-basic)
  Acceptance criteria: Component palette shows all 7 component types (MCB, switch, bulb, fan, inverter, switchboard, socket) grouped into the 5 categories (protection, controls, lighting, power, auxiliary). Properties panel updates when node selected. Simulation controls (play/pause/speed) work. Validation toggle highlights errors. Canvas zoom/pan smooth. Dark/light mode toggles correctly.
  QA scenarios: Playwright: verify all toolbar buttons work → verify palette categories display → verify properties panel updates. Vitest: verify toolbar state management.
  Commit: Y | feat(ui): build toolbar, palette, and properties panels

- [ ] 9. Waveform display: Build Canvas-based waveform chart showing voltage and current over time. Display oscilloscope-style view with multiple channels. Sync with simulation speed (play/pause). Show peak values, RMS values, frequency. Support zoom on time axis.
  What to do / Must NOT do: Waveform rendering uses Canvas API only (not SVG). Must NOT render during simulation pause. Waveforms are synthesized sinusoids y(t) = √2·V_rms·sin(2π·50·t) built from steady-state solver results - do NOT time-step the MNA solver (see "Simulation & component modeling conventions"); label the plot "idealized" in the UI.
  Parallelization: Wave 5 | Blocked by: 5 | Blocks: 10
  References (executor has NO interview context - be exhaustive): Canvas API documentation (developer.mozilla.org/en-US/docs/Web/API/Canvas_API); D3.js for data visualization (d3js.org); Bhilai EE Simulator oscilloscope implementation (github.com/OpenLake/bhilaee-simulator)
  Acceptance criteria: Waveform renders during simulation from synthesized 50 Hz sinusoids and is labeled "idealized". Shows voltage and current channels. Play/pause controls waveform. Zoom on time axis works. Peak (√2·RMS) and RMS values displayed; the frequency label reads the source's rated 50 Hz. Multiple channels supported.
  QA scenarios: Playwright: run simulation → verify waveform appears → verify play/pause controls waveform → verify zoom works. Vitest: verify data points calculated correctly.
  Commit: Y | feat(waveform): build Canvas-based waveform display

- [ ] 10. Docket generator: Build wiring report/docket generation. Export circuit as JSON (full state with components, connections, simulation results). Export as SVG (wiring diagram with symbols). Generate PDF-ready wiring report with component list, wire lengths, gauge specifications, connection diagram. Include validation summary and optimization suggestions in report.
  What to do / Must NOT do: Export formats must be self-contained (client-side only). Must NOT require external services. The PDF report is produced in-browser with jsPDF (no server). If jsPDF layout work grows too large, fall back to a print-stylesheet and let the browser (or Playwright) print to PDF.
  Parallelization: Wave 6 | Blocked by: 8, 9 | Blocks: 11
  References (executor has NO interview context - be exhaustive): ElectraSim export features (electrasim.com); SVG generation in browser (developer.mozilla.org/en-US/docs/Web/SVG); JSON Schema for circuit representation (json-schema.org)
  Acceptance criteria: JSON export contains full circuit state. SVG export shows wiring diagram with correct symbols. PDF report includes component list, wire specs, validation results. Export works for any circuit configuration.
  QA scenarios: Playwright: create circuit → export JSON → verify structure → export SVG → verify rendering → generate report → verify PDF content. Vitest: verify JSON schema compliance.
  Commit: Y | feat(docket): build export and docket generation

- [ ] 11. Integration and testing: End-to-end integration of all modules. Playwright E2E test suite covering: complete circuit creation workflow, simulation with error detection, optimization suggestions, docket generation, save/load, undo/redo. Vitest unit tests for MNA solver, validation algorithms, optimization logic. Component tests for React Flow integration. Code coverage target: 80%+.
  What to do / Must NOT do: Tests must be automated and reproducible. Must NOT leave any failing tests. Coverage is measured with Vitest's V8 provider over src/; Playwright E2E tests are excluded from the coverage denominator.
  Parallelization: Wave 7 | Blocked by: 2,3,4,5,6,7,8,9,10 | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): Vitest testing documentation (vitest.dev); Playwright E2E testing (playwright.dev); CircuitSetu test patterns (github.com/r17e8h/CircuitSetu); Bhilai EE Simulator tests (github.com/OpenLake/bhilaee-simulator)
  Acceptance criteria: All Playwright E2E tests pass. Vitest unit tests pass with 80%+ coverage. MNA solver tests verify voltage/current calculations. Validation tests catch all error types. Full circuit workflow (create → simulate → validate → optimize → export) works end-to-end.
  QA scenarios: Playwright E2E: full workflow test → create circuit → wire → simulate → detect errors → optimize → export. Vitest: MNA solver accuracy tests with known circuit solutions.
  Commit: Y | test(integration): complete E2E and unit test suite

---

## Simulation & component modeling conventions

> Read before implementing Todos 5, 6, 7, 9, and 10. These conventions keep the "custom MNA, no SPICE" decision coherent with 230 V AC house wiring.

- **Mains supply:** one ideal single-phase source per loop, 230 V RMS / 50 Hz (IEC context). A 3-phase switchboard renders L1/L2/L3/N/PE busbars, but each phase is simulated independently as its own 230 V L-N loop - do not build a 3-phase solver.
- **Solve domain:** steady-state resistive solve at RMS magnitude. For the resistive models in scope this is EXACT, not an approximation: V_rms = I·R and P = V_rms·I_rms, so every displayed quantity (current, power, MCB trip, gauge) equals what a full AC solve would return. The solver stays real-numbered; phase angles, reactive power, and transients are OUT of scope in v1.
- **Decision record (v2.1) - phasor AC rejected for v1:** phasor-domain (complex) analysis was considered and rejected. It changes results only when a load has reactance; the only candidate component is the fan motor, which v1 deliberately models resistively. Adopt phasor only if motor reactance / power factor become teaching goals.
- **Upgrade seam (keeps the decision reversible):** (a) simulation results are defined in phasor-ready terms - per-component RMS current/voltage magnitudes plus real power, with a powerFactor field that reads 1.0 in v1; (b) every load provides its stamp through one interface (resistance today, impedance later); (c) the numeric core is isolated behind solveCircuit(model) → CircuitResults. Swapping in a complex solver later is then contained to the engine module - validation thresholds, UI readouts, and the docket already consume RMS magnitudes.
- **Waveforms (Todo 9):** the oscilloscope plot is synthesized analytically - y(t) = √2·V_rms·sin(2π·50·t), same for current - purely a visualization of steady-state results. Label it "idealized" in the UI. Never time-step the MNA solver.
- **MCB trip:** trip (open + report reason) when |I_rms| > rated current. Instantaneous threshold - no time/thermal curve in v1.
- **Terminal roles:** every terminal is typed L / N / PE. Connections must form L→load→N paths; a direct L-to-N connection with no load in between is a short circuit; polarity checks use these roles.
- **Load models (equivalent stamps):**
  - Bulb / heater: fixed resistor R = V²/P at rated wattage.
  - Fan (single-phase motor): resistor model in v1 (P = wattage) - a deliberate choice (see Decision record), not a placeholder; an inductive (R+L) model would require the phasor solver and is the trigger for the upgrade seam.
  - Switch (1-pole): near-zero resistance conductor between its terminals when closed, open when not.
  - MCB: conductor + overcurrent relay; on trip it behaves like an open switch and reports the reason (overload).
  - Inverter (v1 simplification): passes through when its "mains available" input is live; otherwise acts as an AC source from its battery model at rated power. Practice-level only - no power-electronics detail.
  - Switchboard: junction box that routes busbars between its ports; ideal conductors in simulation.
  - Socket / docket outlet: an endpoint whose terminals are designed to be left open when nothing is plugged in.
- **Endpoint semantics (used by validation):** intentionally open terminals (socket outlets, spare switchboard ways, open switches) are VALID. "Floating" means a wire whose far end connects to nothing. Wires are ideal conductors (0 Ω) in v1; per-metre resistance is a later extension (docket still reports lengths).
- **Ground/earth:** the PE rail is the reference node (0 V); "missing ground" checks earth continuity from the switchboard PE to earthed appliances.

---

## Final verification wave

> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

---

## Commit strategy

- Each todo is its own commit with conventional commit format (`feat(...)`, `fix(...)`, `test(...)`, `chore(...)`, `docs(...)`)
- Feature branches per wave, named to match the Execution strategy above: `wave-1-foundation` (todos 1-3), `wave-2-state` (4), `wave-3-engine` (5-6), `wave-4-optimization-ui` (7-8), `wave-5-waveform` (9), `wave-6-docket` (10), `wave-7-integration` (11). Merge each branch to main once its wave's todos pass.
- If the workspace has no `.git` yet, run `git init` inside Todo 1 before its first commit.
- Final commit includes all test results and coverage report

---

## Success criteria

- All 11 todos completed with tests passing
- 80%+ code coverage achieved
- All 4 final verification items pass
- Complete working application with all 6 modules functional
- Playwright E2E tests pass for full circuit workflow
- MNA solver produces correct voltage/current for standard circuits
- Validation system correctly detects short circuits, floating wires, missing ground
- Docket generation produces valid JSON, SVG, and PDF outputs
- Application runs on `pnpm run dev` with hot reload

---

## Key Resources & Reference Projects

### Reference implementations to study
- **UBU Electrical Basic** (github.com/ThummarosR/ubu-electrical-basic): IEC 60617 motor-control diagrams with MCB, contactors, pilot lamps
- **ElectraSim** (electrasim.com): MCB, switches, bulbs, fans, auto-routing wires, JSON/SVG/PNG export
- **CircuitSetu** (github.com/r17e8h/CircuitSetu): React Flow + Zustand + C++ WASM architecture
- **CircuitFlow** (github.com/EV-OD/circuitflow): React 19, SVG, D3.js, ngspice WASM, A* pathfinding
- **Bhilai EE Simulator** (github.com/OpenLake/bhilaee-simulator): Pure JS MNA solver, Union-Find, Backward Euler
- **NovaShang/sldeditor** (github.com/NovaShang/sldeditor): IEC-style single-line-diagram editor; study for symbol + orthogonal-wiring ideas only (Angular, not a schematic lib)

### Key libraries to install
```bash
# Core
pnpm add react react-dom
pnpm add @xyflow/react zustand tailwindcss @tailwindcss/vite   # Tailwind v4 needs the Vite plugin

# Simulation
# Option A: Custom MNA (recommended - simpler, no WASM) - no extra runtime deps
# Option B: pnpm add @spice-ts/core (TypeScript-native SPICE) - only if the custom solver is abandoned

# Waveforms
pnpm add d3
pnpm add -D @types/d3

# Docket / PDF (client-side only, no server)
pnpm add jspdf

# Testing (unit/component: Vitest + jsdom + Testing Library; E2E: Playwright)
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
pnpm exec playwright install chromium
```

### Technology stack
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | React 19 + TypeScript | Most circuit simulators use this |
| Build | Vite | Fast HMR, ESM-first |
| UI Components | Tailwind CSS | Used by all reference implementations |
| Diagram Canvas | React Flow | Dominant choice, MIT, excellent node/edge API |
| State Management | Zustand | Official React Flow recommendation, lightweight |
| Simulation Engine | Custom MNA solver (TypeScript) | Sufficient for house wiring, no WASM dependency |
| Waveforms | Canvas API + D3.js | Used by Bhilai EE, CircuitFlow |
| Persistence | localStorage + JSON | Offline-first, used by most simulators |
| Testing | Vitest + Playwright | Used by CircuitSetu, Bhilai EE |
| Package Manager | pnpm | Fast, disk-efficient |

---

## Original Research Findings

**Project state:** `/home/popsickle/ktMedia/Media1/Project/zcircuit` is a completely empty workspace. Only `.codegraph` and `.omo` directories exist. No source files, no config, no package.json.

**React Flow dominance:** Used by CircuitSetu, UBU Electrical Basic, and ElectraSim as the diagramming canvas. MIT license, excellent React integration. Note: the package is now `@xyflow/react` (v12).

**Component libraries:** No verified ready-made IEC 60617 schematic-symbol npm package was found - npm candidates cited in earlier drafts (@skillpet/circuit, DeepCircuits) do not exist. NovaShang/sldeditor is a real IEC-style single-line-diagram editor (symbols + smart orthogonal wiring) worth studying, but it is Angular and JSON-only; do not import it. Plan: hand-draw each symbol as inline SVG per IEC 60617.

**Simulation engines:** spice-ts is TypeScript-native SPICE (MNA solver, sparse LU). Bhilai EE Simulator uses custom MNA with Union-Find for node detection. For house-wiring practice, a real-numbered steady-state MNA at RMS magnitude is sufficient and much simpler than full SPICE (see Modeling conventions).

**Validation algorithms:** textbook methods - Kahn's topological sort, DFS for cycle/floating-end detection, KCL/KVL checks with numeric tolerance, power conservation. See references in Todo 6.

**State management:** Zustand is the official React Flow recommendation. CircuitSetu uses Zustand + React Flow + C++ WASM.

---

*Plan generated by Prometheus (ulw-plan skill). Intent: CLEAR. Review: Not required. Metis gap analysis: Completed and all issues fixed.*

*Plan v2 (reviewed 2026-09-04): fixed the DC-vs-AC modeling contradiction (added "Simulation & component modeling conventions"), corrected dependency-matrix/blocking errors (todos 3/6/8), removed dead references (@skillpet/circuit, DeepCircuits, FlowForge, Utilix), switched gauge selection from AWG to IEC 60228 mm², unified on pnpm, added missing dependencies (Tailwind v4 Vite plugin, jsdom + Testing Library, @types/d3, jspdf, Playwright chromium), added git-init step, and corrected commit-branch naming. Reviewed and updated in place; NOT yet executed.*

*Plan v2.1 (2026-09-04): phasor-domain AC analysis explicitly reconsidered and rejected for v1 - RMS-equivalent is exact for the resistive models in scope, so a complex solver would add complexity with zero user-visible difference. Added a Decision record and an upgrade seam (magnitude-based results contract, unified load-stamp interface, isolated solver core) to the Modeling conventions so a complex solver can be swapped in later if motor reactance / power factor become teaching goals. NOT yet executed.*

---

# Part 2 — Guided Lessons Game Mode (the app's new main function)

> **Product decision (2026-09-04):** the app's main function becomes a fun, intuitive, well-designed **game of guided lessons**. The current free-build editor is renamed **Playground** and stays fully functional (always accessible). Part 1 (Todos 1–11) is the Playground's engine; Part 2 layers a lesson game on top of it, reusing the same canvas, palette, and pure engines (simulation / validation / optimization). NOT yet executed — plan only.

## TL;DR

- App boots into **Lessons** (game) as the default landing. Home screen offers two big cards: **Lessons** (continue) and **Playground** (free build, always unlocked).
- Lessons = a curated, linear curriculum of **5 categories → 21 levels**, each with its own **objectives** (checked live by the existing engines), **progressive hints** (using hints caps stars at 2), and a **1–3 star** rating with a **par** (efficiency budget).
- Meta layer: stars accumulate into a **rank ladder** (Apprentice → Master) and unlock **badges** for special feats. Progress persists in localStorage.
- Levels get progressively harder: beginner basics → wiring topology → safety/earthing → fault-finding → efficiency challenges.
- New dependencies: **none**. Confetti/celebrations are CSS-only; all judging reuses the pure engines.

## Product decisions (confirmed by user)

1. **Playground access:** free always — both modes available from the home screen; the game is just the default landing.
2. **Progression:** strictly linear chain — level N+1 unlocks when level N earns ≥1 star; the next category unlocks when its predecessor's last level is completed.
3. **Rewards:** stars + rank titles + badges.

## The game loop (per level)

1. **Level intro card** — story/context line, the objective list, difficulty dots, and a 💡 hint button.
2. Canvas preloads the level's **starter circuit** (or empty canvas for build-from-scratch levels).
3. Player builds/wires with the exact same palette + canvas as Playground. The pure engines recompute live; a **level judge** re-evaluates objectives on every change (no "Submit" step — feedback is instant).
4. **Level HUD** (bottom/right) — live objective checklist with ✓/✗ animations, hint reveal, Restart, Exit.
5. All objectives green → **Level Complete modal**: star reveal (1–3), rank-progress bar, badges earned, Next Level / Replay / Menu.
6. Progress auto-saved to localStorage (`zcircuit.progress`).

## Objective grammar (typed, judgeable by existing engines)

```ts
type Objective =
  | { kind: 'powered'; nodeId: string }               // sim status === 'on'
  | { kind: 'off'; nodeId: string }                   // sim status === 'off' (fault-fix levels)
  | { kind: 'tripped'; nodeId: string }               // that MCB tripped on overload
  | { kind: 'noTrips' }                               // no breaker tripped
  | { kind: 'energized'; nodeId: string }             // socket energized (L-N loop live)
  | { kind: 'wired'; from: string; to: string }       // a wire exists between two components
  | { kind: 'noFindings'; severity?: 'error' | 'warning' } // validation report clean at that level
  | { kind: 'currentUnder'; nodeId: string; maxA: number }
  | { kind: 'wireLengthUnder'; maxPx: number }        // total routed wire length budget
  | { kind: 'gaugeAtLeast'; nodeId: string; sizeMm2: number } // IEC 60228 size from optimizer
  | { kind: 'componentCount'; atLeast?: number; exact?: number }
  | { kind: 'switchControls'; loadNodeId: string }    // load's live path passes a conducting switch
  | { kind: 'warningsUnder'; max: number }            // optimization warnings (crossings, overload, ...)
  | { kind: 'all'; items: Objective[] }               // compound: every item must pass
  | { kind: 'any'; items: Objective[] }               // compound: at least one passes
```

**Judge:** pure `evaluateLevel(nodes, edges, reports, level) → { objectives: {ref, pass}[], passed, stars }` in `src/lessons/judge.ts`. Robust to deleted starter nodes (a missing nodeId fails that objective with a "component removed — restart level" hint, never throws).

**Star logic (uniform):**
- ★ 1 — all objectives pass.
- ★★ 2 — all objectives pass AND zero validation errors.
- ★★★ 3 — ★★ AND par met: no hints used AND total routed wire length ≤ level budget AND optimization warnings ≤ level allowance (budgets declared per level, defaulting to generous values).

## Curriculum (v1 content pack: 5 categories, 21 levels)

| # | Level | Objectives (abridged) | Teaches |
|---|-------|----------------------|---------|
| **⚡ First Circuit** (Beginner) |||
| 1 | Make it glow | powered(bulb) | the L→load→N loop |
| 2 | Shut it off | switchControls(bulb) | a switch on the live conductor |
| 3 | Safe power | componentCount(mcb≥1) · noTrips · powered | overcurrent protection |
| 4 | Two rooms | powered(bulb,fan) · switchControls(both) · noTrips | one protected branch, two loads |
| **🔌 Getting Wired** (Beginner) |||
| 5 | Series of events | powered(both bulbs) | series topology |
| 6 | Parallel world | powered(both bulbs) · wireLengthUnder | parallel topology + economy |
| 7 | Fan & light | powered(both) · switchControls(both) | independent control |
| 8 | Second way | powered(both) · noTrips | a second switchboard way + own MCB |
| **🛡️ Safety First** (Intermediate) |||
| 9 | Don't short it | noFindings(error) · powered · noTrips | find & remove a planted L–N short |
| 10 | Breaker logic | tripped(mcb) | watch the MCB trip on a 2 kW overload |
| 11 | Sizing up | gaugeAtLeast(mcb, 4 mm²) · noTrips | IEC 60228 sizing (25 A → 4 mm²) |
| 12 | Earth it | energized(socket) · noFindings | protective earth continuity |
| **🔧 Fault Clinic** (Advanced) |||
| 13 | The dark room | powered · noFindings | find & fix a planted floating wire |
| 14 | Tripping nuisance | noTrips · powered | find & fix a planted short |
| 15 | Hot socket | energized · noFindings | earth a planted unearthed socket |
| 16 | Overloaded | noTrips · powered(both) · noFindings | split a 90%-loaded branch |
| **🏆 Master Builder** (Advanced, par-driven) |||
| 17 | Shortest path | powered(both) · wireLengthUnder | layout economy |
| 18 | No crossings | powered(both) · warningsUnder(0) | clean topology |
| 19 | The whole house | powered · energized · noFindings · noTrips | full protected + earthed install |
| 20 | Inverter backup | powered(bulb) via live inverter | inverter as a source |
| 21 | Grand design (finale) | two protected branches, switch+light each, earthed socket, no errors/trips, wire + crossing budget | everything combined |

**Badges (v1):** 🐣 Sparky — finish First Circuit · 🧼 Clean hands — finish any Fault Clinic level without hints · 💯 Perfectionist — 3-star an entire category · 🏠 Full house — 3-star Grand design · 👑 Master electrician — 3-star every level.

**Ranks (total stars, 63 max):** 0–9 Apprentice · 10–19 Helper · 20–29 Journeyman · 30–39 Electrician · 40–49 Lead · 50–63 Master.

## Architecture (fits existing conventions)

New modules (all client-side, no new deps):

- `src/lessons/types.ts` — Objective, LevelDef, CategoryDef, ProgressState, LevelResult, rank/badge definitions.
- `src/lessons/curriculum.ts` — the 5 categories + 21 levels as **typed data** (content = data; more levels = more entries). Each LevelDef stores its starter circuit in the existing `serializeCircuit` JSON format.
- `src/lessons/starter.ts` — `buildStarter(level) → { nodes, edges }` via the existing `parseCircuit` validator.
- `src/lessons/judge.ts` — pure `evaluateLevel(...)` + star/par logic (unit-tested like the other engines).
- `src/store/gameStore.ts` — mode (`'lessons' | 'playground'`), activeLevelId, hintsUsed, progress (localStorage), actions: startLevel / completeLevel (computes stars, unlocks next, awards badges) / quitLevel / revealHint / setMode. Circuit state stays in `circuitStore`; starting a level loads its starter into it.
- `src/components/game/` — `HomeScreen` (Lessons + Playground cards), `LevelSelect` (category cards → level grid with stars/locks/difficulty), `LevelHUD` (live objective checklist + hints + restart/exit), `LevelCompleteModal` (CSS confetti star reveal + rank progress + badges), header mode tabs + rank bar.
- `src/hooks/useLevelJudge.ts` — memoized live evaluation on (nodes, edges, reports), same pattern as `useLiveAnalyses` (engines always on inside a level).

**Canvas inside a lesson:** same `FlowCanvas` + `Palette` (+ PropertiesPanel — some levels require re-rating an MCB). The SimulationToolbar shrinks to Run/Pause/Speed only inside lessons; Validation/Optimize/Scope toggles, Save/Open and Export are hidden (they'd spoil answers or are irrelevant). Undo/Redo stay (practice-friendly); Restart resets to the starter and clears history; Exit warns before discarding unsaved in-level work (completed stars are already persisted). Playground keeps the complete existing toolbar untouched.

## Testing

**Unit (Vitest):**
- `judge.test.ts` — every objective kind + compound all/any; star par logic (hint cap, wire budget, warning allowance); missing-node robustness (no throw).
- `curriculum.test.ts` — unique ids; linear-unlock chain consistency; every objective's nodeId exists in its level's starter; every level is **solvable** (a reference solution built with starter helpers passes all objectives); badge/rank definitions sane.
- `starter.test.ts` — buildStarter round-trips through parseCircuit.
- `gameStore.test.ts` — progress persistence, unlock chain, star computation, badge awards, hint cap.

**E2E (Playwright):**
- Home shows Lessons + Playground; Playground opens the full editor.
- L1 flow: open level → objectives listed → build bulb circuit → checklist greens → complete modal + stars → next level unlocked.
- Hints reveal 1→2→3 progressively; using one caps stars at 2.
- Fault level: planted short flagged → fix → complete.
- Progress persists across reload; badge awarded on category completion.
- Playground regression: all 12 existing E2E specs keep passing.

## Execution waves (Part 2)

| Wave | Branch | Contents | Commit |
|------|--------|----------|--------|
| G1 | `wave-g1-lessons-core` | types.ts, judge.ts, starter.ts, curriculum.ts (Category 1: L1–L4) + judge/curriculum/starter unit tests | `feat(lessons): level judge and curriculum framework` |
| G2 | `wave-g2-game-ui` | gameStore, HomeScreen, LevelSelect, LevelHUD, LevelCompleteModal, header tabs/rank bar, App integration; L1–L4 playable; store tests + first game E2E | `feat(game): lesson game shell and first levels` |
| G3 | `wave-g3-content` | Categories 2–5 (L5–L21) + per-level reference-solution tests + fault-level E2E | `feat(lessons): full curriculum content pack` |
| G4 | `wave-g4-polish` | badges + rank UI, confetti, level-intro cards, difficulty dots, shortcuts, full E2E + coverage, final verification (F1–F4 style) | `feat(game): polish, badges and final verification` |

Each wave gates on `tsc --noEmit` + `vitest run` + `eslint` + `playwright test` (full suite incl. playground regression) + `vite build`. Merge each wave to main, then push and rebuild the Docker preview once G4 lands.

## Success criteria (Part 2)

- App boots into Lessons; Playground is one click away and fully intact.
- 21 levels across 5 categories playable end-to-end: objectives, hints, stars, ranks, badges, linear unlocks, persisted progress.
- Every level's objectives are machine-checkable by the existing pure engines — no new simulation work.
- All existing Playground features and its 12 E2E specs keep passing.
- New unit + E2E suites green; pushed; Docker preview rebuilt.

*Plan Part 2 (2026-09-04): designed on top of the shipped Part 1 architecture; user confirmed Playground always free, linear unlock chain, stars + ranks + badges. NOT yet executed.*
