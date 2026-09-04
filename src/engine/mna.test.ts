import { describe, expect, it } from 'vitest';
import { solveLinear, solveNetwork } from './mna';
import type { ResistorStamp, SourceStamp } from './mna';

const approx = (actual: number, expected: number, digits = 6) =>
  expect(actual).toBeCloseTo(expected, digits);

describe('solveLinear (LU with scaled partial pivoting)', () => {
  it('solves a 2x2 system', () => {
    const x = solveLinear(
      [
        [4, 1],
        [1, 3],
      ],
      [1, 2],
    );
    expect(x).not.toBeNull();
    approx(x![0], 1 / 11);
    approx(x![1], 7 / 11);
  });

  it('solves a 3x3 system with row swaps', () => {
    // Deliberately ordered so the first pivot is tiny without pivoting.
    const x = solveLinear(
      [
        [1e-12, 1, 0],
        [1, 1, 1],
        [0, 1, 2],
      ],
      [1, 4, 5],
    );
    expect(x).not.toBeNull();
    approx(x![0], 1);
    approx(x![1], 1);
    approx(x![2], 2);
  });

  it('returns null for a singular matrix', () => {
    expect(
      solveLinear(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toBeNull();
  });

  it('solves an empty system', () => {
    expect(solveLinear([], [])).toEqual([]);
  });
});

describe('solveNetwork (MNA over resistor/source stamps)', () => {
  const R = (owner: string, a: string, b: string, ohms: number): ResistorStamp => ({
    owner,
    a,
    b,
    g: 1 / ohms,
  });
  const S = (owner: string, plus: string, minus: string, voltage: number): SourceStamp => ({
    owner,
    plus,
    minus,
    voltage,
  });

  it('voltage divider: 220 V in, two 1 kΩ resistors -> 110 V out (plan QA gate)', () => {
    const sol = solveNetwork(
      [
        R('r1', 'n0', 'n1', 1000),
        R('r2', 'n1', 'n2', 1000),
      ],
      [S('src', 'n0', 'n2', 220)],
    );
    approx(sol.voltages['n1'] ?? 0, 110);
    approx(sol.voltages['n0'] ?? 0, 220);
    approx(sol.voltages['n2'] ?? 0, 0);
    approx(Math.abs(sol.currents.get('r1') ?? 0), 0.11);
    approx(Math.abs(sol.currents.get('r2') ?? 0), 0.11);
  });

  it('series resistors: single loop current V / (R1 + R2)', () => {
    const sol = solveNetwork(
      [
        R('r1', 'n0', 'n1', 1000),
        R('r2', 'n1', 'n2', 1000),
        R('r3', 'n2', 'n3', 500),
      ],
      [S('src', 'n0', 'n3', 230)],
    );
    approx(Math.abs(sol.currents.get('r1') ?? 0), 230 / 2500);
    approx(Math.abs(sol.currents.get('r2') ?? 0), 230 / 2500);
    // Midpoint of the two 1 kΩ resistors sits half-way up.
    approx((sol.voltages['n1'] ?? 0) - (sol.voltages['n2'] ?? 0), 230 * (1000 / 2500));
  });

  it('parallel resistors: branch currents split, source carries the sum', () => {
    const sol = solveNetwork(
      [
        R('r1', 'n0', 'n1', 1000),
        R('r2', 'n0', 'n1', 1000),
      ],
      [S('src', 'n0', 'n1', 230)],
    );
    approx(Math.abs(sol.currents.get('r1') ?? 0), 0.23);
    approx(Math.abs(sol.currents.get('r2') ?? 0), 0.23);
    approx(Math.abs(sol.sourceCurrents.get('src') ?? 0), 0.46);
  });

  it('a lone source with no load draws no current and holds its voltage', () => {
    const sol = solveNetwork([], [S('src', 'n0', 'n1', 230)]);
    approx(sol.voltages['n0'] ?? 0, 230);
    approx(sol.voltages['n1'] ?? 0, 0);
    approx(Math.abs(sol.sourceCurrents.get('src') ?? 0), 0);
  });

  it('islands without a source stay floating (no voltages assigned)', () => {
    const sol = solveNetwork([R('r1', 'a', 'b', 1000)], [S('src', 'n0', 'n1', 230)]);
    expect(sol.voltages['a']).toBeUndefined();
    expect(sol.voltages['b']).toBeUndefined();
    expect(sol.currents.has('r1')).toBe(false);
  });

  it('parallel identical sources feeding one bus are not singular and share current', () => {
    // Two 230 V feeds tied to the same L/N bus (e.g. inverter + switchboard).
    const sol = solveNetwork(
      [R('load', 'busL', 'busN', 230)],
      [S('swb', 'busL', 'busN', 230), S('inv', 'busL', 'busN', 230)],
    );
    approx(sol.voltages['busL'] ?? 0, 230);
    approx(Math.abs(sol.currents.get('load') ?? 0), 1);
    approx(Math.abs(sol.sourceCurrents.get('swb') ?? 0), 0.5);
    approx(Math.abs(sol.sourceCurrents.get('inv') ?? 0), 0.5);
  });
});
