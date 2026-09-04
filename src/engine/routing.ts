export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Routing grid cell size in px. */
export const GRID = 8;

/** Extra clearance kept around obstacles (per side). */
export const WIRE_MARGIN = 6;

/** Cells of padding left above the start anchor so routes have room to detour. */
const PAD_CELLS = 2;

function fmt(v: number): number {
  return Math.round(v * 2) / 2;
}

export function inflateRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}

function rectContainsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

interface Grid {
  cols: number;
  rows: number;
  ox: number;
  oy: number;
  blocked: Uint8Array;
}

function inBounds(grid: Grid, c: number, r: number): boolean {
  return c >= 0 && c < grid.cols && r >= 0 && r < grid.rows;
}

function isBlocked(grid: Grid, c: number, r: number): boolean {
  return !inBounds(grid, c, r) || grid.blocked[r * grid.cols + c] === 1;
}

/**
 * The grid origin is anchored so that a grid line runs exactly through the
 * start anchor (start.x - 4 is the first cell centre column, cell index
 * PAD_CELLS). This keeps the wire flat at the terminal instead of snapping to
 * an unrelated 8px lattice.
 */
function buildGrid(start: Pt, end: Pt, obstacles: Rect[]): Grid {
  const ox = start.x - GRID / 2 - PAD_CELLS * GRID;
  const oy = start.y - GRID / 2 - PAD_CELLS * GRID;

  const maxX = Math.max(start.x, end.x, ...obstacles.map((o) => o.x + o.width));
  const maxY = Math.max(start.y, end.y, ...obstacles.map((o) => o.y + o.height));
  const cols = Math.ceil((maxX - ox) / GRID) + PAD_CELLS + 1;
  const rows = Math.ceil((maxY - oy) / GRID) + PAD_CELLS + 1;

  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = ox + c * GRID + GRID / 2;
      const cy = oy + r * GRID + GRID / 2;
      if (obstacles.some((o) => rectContainsPoint(o, cx, cy))) {
        blocked[r * cols + c] = 1;
      }
    }
  }
  return { cols, rows, ox, oy, blocked };
}

/** Map a world point to its cell index (cells are [origin + 8k, origin + 8(k+1))). */
function toCell(grid: Grid, p: Pt): [number, number] {
  const c = Math.floor((p.x - grid.ox) / GRID);
  const r = Math.floor((p.y - grid.oy) / GRID);
  return [Math.max(0, Math.min(grid.cols - 1, c)), Math.max(0, Math.min(grid.rows - 1, r))];
}

interface NodeEntry {
  cell: number;
  f: number;
  g: number;
}

/** Minimal binary min-heap keyed on f. */
class MinHeap {
  private items: NodeEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(entry: NodeEntry): void {
    const items = this.items;
    items.push(entry);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): NodeEntry | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop() as NodeEntry;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < items.length && items[l].f < items[smallest].f) smallest = l;
        if (r < items.length && items[r].f < items[smallest].f) smallest = r;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

function manhattan(c1: number, r1: number, c2: number, r2: number): number {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2);
}

/** A* over the 4-connected grid; returns cell indices or null when unreachable. */
function aStarCells(grid: Grid, start: number, goal: number): number[] | null {
  const { cols, rows } = grid;
  const startR = Math.floor(start / cols);
  const startC = start % cols;
  const goalR = Math.floor(goal / cols);
  const goalC = goal % cols;

  const gScore = new Float64Array(cols * rows).fill(Infinity);
  const closed = new Uint8Array(cols * rows);
  const cameFrom = new Int32Array(cols * rows).fill(-1);
  const heap = new MinHeap();
  gScore[start] = 0;
  heap.push({ cell: start, f: manhattan(startC, startR, goalC, goalR), g: 0 });

  while (heap.size > 0) {
    const cur = heap.pop() as NodeEntry;
    if (cur.cell === goal) {
      const path: number[] = [];
      let cell: number = goal;
      while (cell !== -1) {
        path.push(cell);
        cell = cameFrom[cell];
      }
      return path.reverse();
    }
    if (closed[cur.cell]) continue;
    closed[cur.cell] = 1;

    const cr = Math.floor(cur.cell / cols);
    const cc = cur.cell % cols;
    const neighbors: Array<[number, number]> = [
      [cc + 1, cr],
      [cc - 1, cr],
      [cc, cr + 1],
      [cc, cr - 1],
    ];
    for (const [nc, nr] of neighbors) {
      if (isBlocked(grid, nc, nr)) continue;
      const next = nr * cols + nc;
      const tentative = cur.g + 1;
      if (tentative < gScore[next]) {
        gScore[next] = tentative;
        cameFrom[next] = cur.cell;
        heap.push({
          cell: next,
          f: tentative + manhattan(nc, nr, goalC, goalR),
          g: tentative,
        });
      }
    }
  }
  return null;
}

/** Whether every cell the horizontal/vertical run passes through is clear. */
function runIsClear(grid: Grid, a: Pt, b: Pt): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx !== 0 && dy !== 0) return false;
  const steps = Math.max(1, Math.round((Math.abs(dx) + Math.abs(dy)) / GRID));
  const [c0, r0] = toCell(grid, a);
  for (let i = 0; i <= steps; i++) {
    const c = dx !== 0 ? c0 + Math.sign(dx) * i : c0;
    const r = dy !== 0 ? r0 + Math.sign(dy) * i : r0;
    if (isBlocked(grid, c, r)) return false;
  }
  return true;
}

/**
 * Replace staircase wiggle with clean L corners wherever the corridor is
 * clear. Repeatedly tries to shortcut from point i straight to the farthest
 * possible point j via one of the two L corners.
 */
function smoothPath(grid: Grid, pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts;
  const out: Pt[] = [{ ...pts[0] }];
  let i = 0;
  while (i < pts.length - 1) {
    let shortcut = false;
    for (let j = pts.length - 1; j > i + 1; j--) {
      const a = pts[i];
      const b = pts[j];
      const corner1: Pt = { x: b.x, y: a.y };
      const corner2: Pt = { x: a.x, y: b.y };
      const via1 =
        runIsClear(grid, a, corner1) &&
        runIsClear(grid, corner1, b) &&
        (corner1.x !== b.x || corner1.y !== b.y);
      const via2 =
        runIsClear(grid, a, corner2) &&
        runIsClear(grid, corner2, b) &&
        (corner2.x !== b.x || corner2.y !== b.y);
      if (via1 || via2) {
        out.push(via1 ? corner1 : corner2);
        i = j;
        shortcut = true;
        break;
      }
    }
    if (!shortcut) {
      i++;
      out.push({ ...pts[i] });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

/**
 * Route an orthogonal polyline from `start` to `end`, avoiding (inflated)
 * obstacle rectangles. Guarantees an axis-aligned result even though terminal
 * anchors sit at arbitrary coordinates.
 */
export function orthogonalPath(start: Pt, end: Pt, obstacles: Rect[]): Pt[] {
  if (Math.abs(start.x - end.x) < 0.5 && Math.abs(start.y - end.y) < 0.5) {
    return [{ ...start }, { ...end }];
  }

  const inflated = obstacles.map((o) => inflateRect(o, WIRE_MARGIN));
  const grid = buildGrid(start, end, inflated);
  const [sc, sr] = toCell(grid, start);
  const [tc, tr] = toCell(grid, end);
  const cells = aStarCells(grid, sr * grid.cols + sc, tr * grid.cols + tc);

  let pts: Pt[];
  if (cells) {
    const centers = cells.map((cell) => {
      const c = cell % grid.cols;
      const r = Math.floor(cell / grid.cols);
      return { x: fmt(grid.ox + c * GRID + GRID / 2), y: fmt(grid.oy + r * GRID + GRID / 2) };
    });
    const raw: Pt[] = [{ ...start }, ...centers];
    // The start anchor lies exactly on a grid line (grid is anchored to it);
    // the end anchor may not, so add an elbow that guarantees an axis-aligned
    // approach to the terminal before smoothing.
    const lastCenter = centers[centers.length - 1];
    if (
      Math.abs(lastCenter.x - end.x) > 0.5 &&
      Math.abs(lastCenter.y - end.y) > 0.5
    ) {
      raw.push({ x: lastCenter.x, y: end.y });
    }
    raw.push({ ...end });
    pts = smoothPath(grid, raw);
  } else {
    // No route found (e.g. fully enclosed terminals): plain elbow fallback.
    pts = [{ ...start }, { x: start.x, y: end.y }, { ...end }];
  }

  return simplifyPath(pts);
}

/** Drop duplicate points, then collinear points that are not bends. */
export function simplifyPath(points: Pt[]): Pt[] {
  const uniq: Pt[] = [];
  for (const p of points) {
    const last = uniq[uniq.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) uniq.push({ ...p });
  }
  if (uniq.length <= 2) return uniq;
  const out: Pt[] = [{ ...uniq[0] }];
  for (let i = 1; i < uniq.length - 1; i++) {
    const a = uniq[i - 1];
    const b = uniq[i];
    const c = uniq[i + 1];
    const sameDir =
      (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) === 0 && // collinear
      Math.sign(b.x - a.x || 0) === Math.sign(c.x - b.x || 0) &&
      Math.sign(b.y - a.y || 0) === Math.sign(c.y - b.y || 0);
    if (!sameDir) out.push({ ...b });
  }
  out.push({ ...uniq[uniq.length - 1] });
  return out;
}

/** Build an SVG path string from a polyline, rounding corners with radius r. */
export function pathToSvg(points: Pt[], radius = 6): string {
  if (points.length < 2) return '';
  const segs: string[] = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    // Axis-aligned unit directions.
    const inX = Math.sign(cur.x - prev.x);
    const inY = Math.sign(cur.y - prev.y);
    const outX = Math.sign(next.x - cur.x);
    const outY = Math.sign(next.y - cur.y);
    const straight = (inX === outX && inX !== 0) || (inY === outY && inY !== 0);
    if (straight) {
      segs.push(`L ${fmt(cur.x)} ${fmt(cur.y)}`);
    } else {
      // A corner turns between two perpendicular segments: the usable radius
      // is bounded by the full length of the incoming and outgoing runs.
      const lenIn = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      const lenOut = Math.abs(next.x - cur.x) + Math.abs(next.y - cur.y);
      const r = Math.min(radius, lenIn / 2, lenOut / 2);
      const before: Pt = { x: cur.x - inX * r, y: cur.y - inY * r };
      segs.push(`L ${fmt(before.x)} ${fmt(before.y)}`);
      segs.push(
        `Q ${fmt(cur.x)} ${fmt(cur.y)} ${fmt(cur.x + outX * r)} ${fmt(cur.y + outY * r)}`,
      );
    }
  }
  const last = points[points.length - 1];
  segs.push(`L ${fmt(last.x)} ${fmt(last.y)}`);
  return segs.join(' ');
}
