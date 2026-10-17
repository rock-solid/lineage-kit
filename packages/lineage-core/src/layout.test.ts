import { describe, expect, it } from 'vitest';

import { layout, layoutInput, type LayoutOptions } from './layout';

const options: LayoutOptions = { layerSpacing: 80, nodeSpacing: 16, placement: 'NETWORK_SIMPLEX' };
const nodes = ['a', 'b', 'c'].map((id) => ({ id, width: 100, height: 40 }));

describe('layoutInput', () => {
  const input = layoutInput(
    nodes,
    [
      { source: 'a', target: 'b', priority: 10 },
      { source: 'b', target: 'a' },
      { source: 'c', target: 'c' },
    ],
    options,
  );

  it('passes the options to ELK as a left-to-right layered layout', () => {
    expect(input.layoutOptions).toEqual({
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '16',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    });
  });

  it('leaves out self-links, and sets a priority only where one is given', () => {
    expect(input.edges).toEqual([
      {
        id: 'e0',
        sources: ['a'],
        targets: ['b'],
        layoutOptions: { 'elk.layered.priority.direction': '10' },
      },
      { id: 'e1', sources: ['b'], targets: ['a'] },
    ]);
  });
});

describe('layout', () => {
  it('places a chain left to right', async () => {
    const positions = await layout(
      nodes,
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
      options,
    );
    const x = (id: string) => positions.get(id)!.x;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
  });

  it('keeps the higher-priority edge pointing forward when it breaks a cycle', async () => {
    // block → page is the blocks field; page → block is a link back, which should run backwards
    const positions = await layout(
      [
        { id: 'block', width: 100, height: 40 },
        { id: 'page', width: 100, height: 40 },
      ],
      [
        { source: 'page', target: 'block', priority: 0 },
        { source: 'block', target: 'page', priority: 10 },
      ],
      options,
    );
    expect(positions.get('block')!.x).toBeLessThan(positions.get('page')!.x);
  });
});
