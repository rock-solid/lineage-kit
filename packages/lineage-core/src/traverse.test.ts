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

describe('walk', () => {
  it('goes as many levels as asked, not counting the start', () => {
    expect([...walk('b', down, 1)].sort()).toEqual(['c', 'e']);
    expect([...walk('b', down, 2)].sort()).toEqual(['c', 'd', 'e', 'g']);
    expect([...walk('d', up)].sort()).toEqual(['a', 'b', 'c', 'g']);
    expect(walk('b', down, 0).size).toBe(0);
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
