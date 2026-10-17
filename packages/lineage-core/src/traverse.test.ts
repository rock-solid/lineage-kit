import { describe, expect, it } from 'vitest';

import { adjacency, trace, walk } from './traverse';

// a → b → c → d, and b → e; f stands alone; c and g link to each other
const links = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
  { source: 'c', target: 'd' },
  { source: 'b', target: 'e' },
  { source: 'c', target: 'g' },
  { source: 'g', target: 'c' },
];
const { up, down } = adjacency(links);

describe('adjacency', () => {
  it('lists each node’s dependencies and users, in link order', () => {
    expect(up.get('c')).toEqual(['b', 'g']);
    expect(down.get('b')).toEqual(['c', 'e']);
    expect(up.get('a')).toBeUndefined();
  });

  it('grows linearly with a node’s links, not quadratically', () => {
    // A hub with 100,000 links: copying its list for each link took several seconds
    const star = Array.from({ length: 100_000 }, (_, i) => ({ source: 'hub', target: `leaf${i}` }));
    const start = performance.now();
    const { down: out } = adjacency(star);
    expect(out.get('hub')).toHaveLength(100_000);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('walk', () => {
  it('goes as many levels as asked, not counting the start', () => {
    expect([...walk('b', down, 1)].sort()).toEqual(['c', 'e']);
    expect([...walk('b', down, 2)].sort()).toEqual(['c', 'd', 'e', 'g']);
    expect([...walk('d', up)].sort()).toEqual(['a', 'b', 'c', 'g']);
    expect(walk('b', down, 0).size).toBe(0);
  });

  it('walks each node once when paths converge, however many lead to it', () => {
    // 18 layers of 2 nodes, each linking to both nodes in the next: 2^18 paths, 38 nodes
    const converging = [
      { source: 'root', target: '0a' },
      { source: 'root', target: '0b' },
    ];
    for (let l = 0; l < 18; l++) {
      for (const a of ['a', 'b']) {
        for (const b of ['a', 'b']) converging.push({ source: `${l}${a}`, target: `${l + 1}${b}` });
      }
    }
    const next = adjacency(converging).down;
    let lookups = 0;
    const counted = new Map(next);
    counted.get = (id: string) => {
      lookups++;
      return next.get(id);
    };
    expect(walk('root', counted).size).toBe(38);
    expect(lookups).toBeLessThanOrEqual(39);
  });

  it('stops in a cycle', () => {
    expect([...walk('c', down)].sort()).toEqual(['d', 'g']);
  });
});

describe('trace', () => {
  it('is the node and everything upstream and downstream of it', () => {
    expect([...trace('e', links)].sort()).toEqual(['a', 'b', 'e']);
    expect([...trace('f', links)]).toEqual(['f']);
  });
});
