/**
 * Minimal Modified Nodal Analysis (MNA) numeric core.
 *
 * Consumes stamps over opaque electrical node ids and returns node voltages and
 * per-stamp currents:
 *
 *   - resistor stamps { a, b, g, owner }       ideal conductor a<->b
 *   - source stamps   { plus, minus, voltage } ideal voltage source
 *
 * Nodes connected through stamps are grouped into independent blocks that are
 * solved one at a time; a block without a voltage source stays floating (no
 * voltages are assigned to it). Each block is solved with LU decomposition and
 * scaled partial pivoting.
 *
 * The module is deliberately free of circuit-domain knowledge so it can be unit
 * tested against textbook networks (voltage divider, parallel resistors) and,
 * per the PLAN.md upgrade seam, replaced by a complex-arithmetic core later
 * without touching the modelling layer that feeds it stamps.
 */

/** Near-zero tolerance for matrix scaling / singularity checks. */
export const MNA_EPS = 1e-9;

export interface ResistorStamp {
  /** Electrical node on one side. */
  a: string;
  /** Electrical node on the other side. */
  b: string;
  /** Conductance in siemens. */
  g: number;
  /** Id of the circuit component this stamp models (for current reporting). */
  owner: string;
}

export interface SourceStamp {
  plus: string;
  minus: string;
  /** Ideal source voltage (V), plus above minus. */
  voltage: number;
  owner: string;
}

export interface NetworkSolution {
  /** Node id -> voltage above the block datum (V). Unsolved nodes absent. */
  voltages: Record<string, number>;
  /** Stamp owner -> signed through-current (A), positive from a to b. */
  currents: Map<string, number>;
  /** Source owner -> signed current (A) leaving the plus terminal. */
  sourceCurrents: Map<string, number>;
  /** Electrical nodes that received a voltage in this solve. */
  solvedNodes: Set<string>;
}

/**
 * Solve A x = b with LU decomposition and scaled partial pivoting.
 * Returns null when the matrix is numerically singular.
 */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0) return [];
  if (b.length !== n) throw new Error('solveLinear: b must match A in length');

  // Augmented matrix + row scales (infinity-norm of each row).
  const M = A.map((row, i) => [...row, b[i]]);
  const scale = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let max = 0;
    for (let j = 0; j < n; j++) max = Math.max(max, Math.abs(M[i][j]));
    if (max < MNA_EPS) return null;
    scale[i] = 1 / max;
  }

  const order = Array.from({ length: n }, (_, i) => i);
  for (let col = 0; col < n; col++) {
    let best = col;
    let bestScore = -1;
    for (let r = col; r < n; r++) {
      const score = Math.abs(M[order[r]][col]) * scale[order[r]];
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    if (bestScore < MNA_EPS) return null;
    [order[col], order[best]] = [order[best], order[col]];

    const pivotRow = order[col];
    const pivot = M[pivotRow][col];
    for (let r = col + 1; r < n; r++) {
      const rr = order[r];
      const factor = M[rr][col] / pivot;
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) M[rr][j] -= factor * M[pivotRow][j];
    }
  }

  // Back substitution: x[j] for j > i is already known at step i.
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const pivotRow = order[i];
    let sum = M[pivotRow][n];
    for (let j = i + 1; j < n; j++) sum -= M[pivotRow][j] * x[j];
    x[i] = sum / M[pivotRow][i];
  }
  return x;
}

/** Solve every source-driven block of a resistor/source network. */
export function solveNetwork(resistors: ResistorStamp[], sources: SourceStamp[]): NetworkSolution {
  const voltages: Record<string, number> = {};
  const currents = new Map<string, number>();
  const sourceCurrents = new Map<string, number>();
  const solvedNodes = new Set<string>();

  // Connectivity over stamp endpoints.
  const adjacency = new Map<string, Set<string>>();
  const touch = (node: string) => {
    if (!adjacency.has(node)) adjacency.set(node, new Set());
  };
  for (const r of resistors) {
    touch(r.a);
    touch(r.b);
    adjacency.get(r.a)!.add(r.b);
    adjacency.get(r.b)!.add(r.a);
  }
  for (const s of sources) {
    touch(s.plus);
    touch(s.minus);
    adjacency.get(s.plus)!.add(s.minus);
    adjacency.get(s.minus)!.add(s.plus);
  }

  const visited = new Set<string>();
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    // Flood-fill this connected block.
    const block: string[] = [];
    const stack = [start];
    visited.add(start);
    while (stack.length > 0) {
      const node = stack.pop() as string;
      block.push(node);
      for (const nb of adjacency.get(node) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          stack.push(nb);
        }
      }
    }

    const inBlock = new Set(block);
    const blockSources = sources.filter((s) => inBlock.has(s.plus) && inBlock.has(s.minus));
    if (blockSources.length === 0) continue; // passive cluster: floating

    // Merge parallel sources between the same terminal pair into one ideal
    // source; the branch current is later shared evenly across the group
    // (two identical 230 V feeds tied to one bus must not be singular).
    const groups = new Map<string, SourceStamp[]>();
    for (const s of blockSources) {
      const key = `${s.plus}\u0000${s.minus}`;
      const group = groups.get(key);
      if (group) group.push(s);
      else groups.set(key, [s]);
    }
    const pairs = [...groups.values()];
    const blockRes = resistors.filter((r) => inBlock.has(r.a) && inBlock.has(r.b));

    // Datum: the minus terminal of the first source in the block.
    const datum = pairs[0][0].minus;
    const nodes = block.filter((node) => node !== datum);
    const idx = new Map(nodes.map((node, i) => [node, i]));
    const n = nodes.length;
    const m = pairs.length;
    const size = n + m;
    const A: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    const b = new Array<number>(size).fill(0);

    // KCL rows at every non-datum node: conductance matrix.
    for (const r of blockRes) {
      const ra = idx.get(r.a);
      const rb = idx.get(r.b);
      if (ra !== undefined) A[ra][ra] += r.g;
      if (rb !== undefined) A[rb][rb] += r.g;
    }
    for (const r of blockRes) {
      const ra = idx.get(r.a);
      const rb = idx.get(r.b);
      if (ra !== undefined && rb !== undefined) {
        A[ra][rb] -= r.g;
        A[rb][ra] -= r.g;
      }
    }
    // Source current columns in the KCL rows: +1 at the plus node, -1 at minus.
    pairs.forEach((group, gi) => {
      const col = n + gi;
      const rp = idx.get(group[0].plus);
      const rm = idx.get(group[0].minus);
      if (rp !== undefined) A[rp][col] += 1;
      if (rm !== undefined) A[rm][col] -= 1;
    });
    // Source rows enforce V(plus) - V(minus) = voltage.
    pairs.forEach((group, gi) => {
      const row = n + gi;
      const s = group[0];
      const rp = idx.get(s.plus);
      const rm = idx.get(s.minus);
      if (rp !== undefined) A[row][rp] += 1;
      if (rm !== undefined) A[row][rm] -= 1;
      b[row] = s.voltage;
    });

    const x = solveLinear(A, b);
    if (x === null) continue; // singular: leave this block floating

    voltages[datum] = 0;
    nodes.forEach((node, i) => {
      voltages[node] = x[i];
    });
    for (const node of block) solvedNodes.add(node);

    for (const r of blockRes) {
      const va = voltages[r.a] ?? 0;
      const vb = voltages[r.b] ?? 0;
      currents.set(r.owner, (va - vb) * r.g);
    }
    pairs.forEach((group, gi) => {
      const total = x[n + gi];
      const share = total / group.length;
      for (const s of group) sourceCurrents.set(s.owner, share);
    });
  }

  return { voltages, currents, sourceCurrents, solvedNodes };
}
