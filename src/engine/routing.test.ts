import { describe, expect, it } from 'vitest';
import {
  orthogonalPath,
  pathToSvg,
  simplifyPath,
  type Pt,
  type Rect,
} from './routing';

function segmentHitsRect(a: Pt, b: Pt, rect: Rect): boolean {
  // Sample the segment; good enough for axis-aligned routes on an 8px grid.
  const steps = 100;
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
  it('routes straight when there is no obstacle', () => {
    const pts = orthogonalPath({ x: 0, y: 40 }, { x: 240, y: 40 }, []);
    expect(pts[0]).toEqual({ x: 0, y: 40 });
    expect(pts[pts.length - 1]).toEqual({ x: 240, y: 40 });
    expect(pts.every((p) => p.y === 40)).toBe(true);
    expect(isAxisAligned(pts)).toBe(true);
  });

  it('keeps a clean elbow when endpoints are offset', () => {
    const pts = orthogonalPath({ x: 0, y: 0 }, { x: 200, y: 100 }, []);
    expect(isAxisAligned(pts)).toBe(true);
    // Two bends maximum for an unobstructed L route (start, corner(s), end).
    expect(pts.length).toBeLessThanOrEqual(4);
  });

  it('detours around an obstacle in the direct path', () => {
    const obstacle: Rect = { x: 100, y: 20, width: 80, height: 40 };
    const pts = orthogonalPath({ x: 0, y: 40 }, { x: 300, y: 40 }, [obstacle]);
    expect(pts[0]).toEqual({ x: 0, y: 40 });
    expect(pts[pts.length - 1]).toEqual({ x: 300, y: 40 });
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
    expect(pts.some((p) => p.y !== 40)).toBe(true);
  });

  it('keeps apart two obstacles when squeezing between them', () => {
    const a: Rect = { x: 100, y: 0, width: 60, height: 40 };
    const b: Rect = { x: 100, y: 60, width: 60, height: 40 };
    const pts = orthogonalPath({ x: 0, y: 20 }, { x: 300, y: 20 }, [a, b]);
    const gapTop: Rect = { x: a.x - 6, y: 0, width: a.width + 12, height: 40 + 6 };
    const gapBottom: Rect = { x: b.x - 6, y: 60 - 6, width: b.width + 12, height: 46 };
    for (let i = 1; i < pts.length; i++) {
      expect(segmentHitsRect(pts[i - 1], pts[i], gapTop)).toBe(false);
      expect(segmentHitsRect(pts[i - 1], pts[i], gapBottom)).toBe(false);
    }
  });

  it('returns an orthogonal fallback when the target cell is unreachable', () => {
    // A wall far taller than the routing grid: no route around it exists.
    const wall: Rect = { x: 40, y: -2000, width: 10, height: 4000 };
    const pts = orthogonalPath({ x: 0, y: 0 }, { x: 300, y: 0 }, [wall]);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 300, y: 0 });
    expect(isAxisAligned(pts)).toBe(true);
  });

  it('handles a zero-length route', () => {
    const pts = orthogonalPath({ x: 10, y: 10 }, { x: 10, y: 10 }, []);
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
