import { describe, expect, it } from 'vitest';

import { layerColumns } from './columns';

// Listed for matching, as in a real config: the narrow `ui` match before `components`, utilities last
const layers = [{ id: 'primitive' }, { id: 'component' }, { id: 'page' }, { id: 'utility' }];
const files: Record<string, string> = {
  'button.tsx': 'primitive',
  'card.tsx': 'primitive',
  'hero.tsx': 'component',
  'home.tsx': 'page',
  'about.tsx': 'page',
  'cx.ts': 'utility',
};
const edges = [
  { source: 'cx.ts', target: 'button.tsx' },
  { source: 'cx.ts', target: 'hero.tsx' },
  { source: 'button.tsx', target: 'hero.tsx' },
  { source: 'card.tsx', target: 'hero.tsx' },
  { source: 'hero.tsx', target: 'home.tsx' },
  { source: 'button.tsx', target: 'about.tsx' },
];
const order = (columns: Map<string, number>) =>
  [...columns].sort((a, b) => a[1] - b[1]).map(([id]) => id);

describe('layerColumns', () => {
  it('orders the layers by their imports, not by how they are listed', () => {
    expect(order(layerColumns(layers, (f) => files[f], edges))).toEqual([
      'utility',
      'primitive',
      'component',
      'page',
    ]);
  });

  it('keeps the order with fewer imports running backwards when layers import each other', () => {
    // A page imported by one component: 1 import back against the 2 forwards
    const withCycle = [...edges, { source: 'home.tsx', target: 'hero.tsx' }];
    expect(order(layerColumns(layers, (f) => files[f], withCycle))).toEqual([
      'utility',
      'primitive',
      'component',
      'page',
    ]);
  });

  it('keeps the listed order for layers with no imports between them', () => {
    expect(order(layerColumns(layers, (f) => files[f], []))).toEqual([
      'primitive',
      'component',
      'page',
      'utility',
    ]);
  });

  it('puts a layer with a `column` at that position, the rest in their order around it', () => {
    const pinned = layers.map((l) => (l.id === 'utility' ? { ...l, column: 3 } : l));
    expect(order(layerColumns(pinned, (f) => files[f], edges))).toEqual([
      'primitive',
      'component',
      'page',
      'utility',
    ]);
    const first = layers.map((l) => (l.id === 'page' ? { ...l, column: 0 } : l));
    expect(order(layerColumns(first, (f) => files[f], edges))).toEqual([
      'page',
      'utility',
      'primitive',
      'component',
    ]);
  });

  it('ignores imports within a layer and files without one', () => {
    const extra = [
      { source: 'card.tsx', target: 'button.tsx' },
      { source: 'unknown.ts', target: 'hero.tsx' },
    ];
    expect(order(layerColumns(layers, (f) => files[f], [...edges, ...extra]))).toEqual([
      'utility',
      'primitive',
      'component',
      'page',
    ]);
  });
});
