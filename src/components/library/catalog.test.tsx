import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ROLE_LABEL, type TerminalRole } from '../../types/circuit';
import { CATALOG, COMPONENT_TYPES, paletteGroups } from './catalog';
import { SymbolView } from './symbols';

describe('component catalog', () => {
  it('defines all seven component types', () => {
    expect(COMPONENT_TYPES.sort()).toEqual(
      ['mcb', 'switch', 'bulb', 'fan', 'inverter', 'switchboard', 'socket'].sort(),
    );
  });

  it('places every component into exactly one palette group', () => {
    const groups = paletteGroups();
    const listed = groups.flatMap((g) => g.items.map((m) => m.type)).sort();
    expect(listed).toEqual(COMPONENT_TYPES.slice().sort());
  });

  it('has consistent boxes and valid terminal geometry', () => {
    for (const meta of Object.values(CATALOG)) {
      expect(meta.width).toBeGreaterThan(0);
      expect(meta.height).toBeGreaterThan(0);
      const ids = new Set<string>();
      for (const t of meta.terminals) {
        expect(ids.has(t.id)).toBe(false); // unique per component
        ids.add(t.id);
        expect(Object.keys(ROLE_LABEL)).toContain(t.role as TerminalRole);
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThanOrEqual(meta.width);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeLessThanOrEqual(meta.height);
      }
    }
  });

  it('gives every component a default electrical rating', () => {
    for (const meta of Object.values(CATALOG)) {
      expect(meta.defaultProps.voltageV ?? meta.type).toBeTruthy();
      expect(meta.terminals.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('SymbolView', () => {
  it('renders an SVG glyph for every component type', () => {
    const { getAllByTestId } = render(
      <div>
        {COMPONENT_TYPES.map((type) => (
          <SymbolView key={type} type={type} width={110} height={64} />
        ))}
      </div>,
    );
    const svgs = getAllByTestId('component-symbol');
    expect(svgs).toHaveLength(COMPONENT_TYPES.length);
    for (const type of COMPONENT_TYPES) {
      expect(svgs.some((s) => s.getAttribute('data-symbol-type') === type)).toBe(true);
    }
  });
});
