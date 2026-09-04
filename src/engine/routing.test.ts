import { describe, expect, it } from 'vitest';
import {
  GRID,
  orthogonalPath,
  pathToSvg,
  simplifyPath,
  type Pt,
  type Rect,
} from './routing';

function segmentHitsRect(a: Pt, b: Pt, rect: Rect): boolean {
  // Sample the segment; fine for axis-aligned routes.
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
      return true;
    }
  }
  return false;
}

function isAxisAligned(points: Pt[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i].x - points[i - 1].x);
    const dy = Math.abs(points[i].y - points[i - 1].y);
    if (dx > 0.01 && dy > 0.01) return false;
  }
  return true;
}

describe('orthogonalPath', () => {
  it('routes straight on the grid when there is no obstacle', () => {
    // y = 32 is a grid line; the run should stay exactly on it.
    const pts = orthogonalPath({ x: 0, y: 32 }, { x: 256, y: 32 }, []);
    expect(pts[0]).toEqual({ x: 0, y: 32 });
    expect(pts[pts.length - 1]).toEqual({ x: 256, y: 32 });
    expect(pts.every((p) => p.y === 32)).toBe(true);
    expect(isAxisAligned(pts)).toBe(true);
  });

  it('snaps long runs onto grid lines for off-grid terminals', () => {
    // y = 20 is NOT a grid line: the router must jog up/down to y = 16 or 32.
    const pts = orthogonalPath({ x: 0, y: 20 }, { x: 256, y: 20 }, []);
    expect(pts[0]).toEqual({ x: 0, y: 20 });
    expect(pts[pts.length - 1]).toEqual({ x: 256, y: 20 });
    expect(isAxisAligned(pts)).toBe(true);
    // Interior runs must sit on world grid lines.
    for (let i = 1; i < pts.length - 1; i++) {
      expect(pts[i].x % GRID === 0 || pts[i].y % GRID === 0).toBe(true);
    }
  });

  it('keeps a clean elbow when endpoints are offset', () => {
    const pts = orthogonalPath({ x: 0, y: 0 }, { x: 224, y: 128 }, []);
    expect(isAxisAligned(pts)).toBe(true);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 224, y: 128 });
  });

  it('detours around an obstacle in the direct path', () => {
    const obstacle: Rect = { x: 96, y: 16, width: 96, height: 32 };
    const pts = orthogonalPath({ x: 0, y: 32 }, { x: 320, y: 32 }, [obstacle]);
    expect(pts[0]).toEqual({ x: 0, y: 32 });
    expect(pts[pts.length - 1]).toEqual({ x: 320, y: 32 });
    const avoided: Rect = {
      x: obstacle.x - 6,
      y: obstacle.y - 6,
      width: obstacle.width + 12,
      height: obstacle.height + 12,
    };
    for (let i = 1; i < pts.length; i++) {
      expect(segmentHitsRect(pts[i - 1], pts[i], avoided)).toBe(false);
    }
    // The detour must actually leave the straight line.
    expect(pts.some((p) => p.y !== 32)).toBe(true);
  });

  it('squeezes between two vertically separated obstacles', () => {
    const top: Rect = { x: 96, y: 0, width: 96, height: 16 };
    const bottom: Rect = { x: 96, y: 80, width: 96, height: 16 };
    const pts = orthogonalPath({ x: 0, y: 32 }, { x: 320, y: 32 }, [top, bottom]);
    const avoidTop: Rect = { x: top.x - 6, y: -20, width: top.width + 12, height: top.height + 6 + 20 };
    const avoidBottom: Rect = { x: bottom.x - 6, y: bottom.y - 6, width: bottom.width + 12, height: bottom.height + 26 };
    for (let i = 1; i < pts.length; i++) {
      expect(segmentHitsRect(pts[i - 1], pts[i], avoidTop)).toBe(false);
      expect(segmentHitsRect(pts[i - 1], pts[i], avoidBottom)).toBe(false);
    }
    expect(isAxisAligned(pts)).toBe(true);
  });

  it('returns an orthogonal fallback when the target cell is unreachable', () => {
    const wall: Rect = { x: 96, y: -4000, width: 16, height: 8000 };
    const pts = orthogonalPath({ x: 0, y: 32 }, { x: 288, y: 32 }, [wall]);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[0]).toEqual({ x: 0, y: 32 });
    expect(pts[pts.length - 1]).toEqual({ x: 288, y: 32 });
    expect(isAxisAligned(pts)).toBe(true);
  });

  it('handles a zero-length route', () => {
    const pts = orthogonalPath({ x: 32, y: 32 }, { x: 32, y: 32 }, []);
    expect(pts).toHaveLength(2);
  });
});

describe('simplifyPath', () => {
  it('removes collinear intermediate points', () => {
    const pts = simplifyPath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ]);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('removes consecutive duplicates', () => {
    const pts = simplifyPath([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });
});

describe('pathToSvg', () => {
  it('builds a straight SVG segment', () => {
    const d = pathToSvg([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(d).toBe('M 0 0 L 100 0');
  });

  it('rounds corners with quadratic curves', () => {
    const d = pathToSvg([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]);
    expect(d).toContain('Q');
    expect(d.startsWith('M 0 0')).toBe(true);
  });

  it('returns an empty string for too few points', () => {
    expect(pathToSvg([{ x: 0, y: 0 }])).toBe('');
  });
});
