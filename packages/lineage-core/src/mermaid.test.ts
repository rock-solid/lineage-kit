import { describe, expect, it } from 'vitest';

import { escapeLabel, toMermaidFlowchart } from './mermaid';

describe('toMermaidFlowchart', () => {
  it('writes nodes, edges by style and colours by group', () => {
    expect(
      toMermaidFlowchart({
        nodes: [
          { id: 'collection:media', label: 'Media', group: 'collection' },
          { id: 'block:hero', label: 'Hero', group: 'block' },
          { id: 'collection:pages', label: 'Pages', group: 'collection' },
        ],
        edges: [
          { source: 'collection:media', target: 'block:hero', style: 'dashed', label: 'image' },
          { source: 'block:hero', target: 'collection:pages', style: 'thick' },
          { source: 'collection:pages', target: 'collection:pages' },
        ],
        groups: [
          { id: 'collection', color: '#0f7c74' },
          { id: 'block', color: '#b4630c' },
          { id: 'global', color: '#6b4bb8' },
        ],
      }),
    ).toBe(
      [
        'flowchart LR',
        '  n0["Media"]',
        '  n1["Hero"]',
        '  n2["Pages"]',
        '  n0 -.->|"image"| n1',
        '  n1 ==> n2',
        '  n2 --> n2',
        '  classDef g0 fill:#0f7c74,stroke:#0f7c74,color:#fff',
        '  class n0,n2 g0',
        '  classDef g1 fill:#b4630c,stroke:#b4630c,color:#fff',
        '  class n1 g1',
        '',
      ].join('\n'),
    );
  });

  it('leaves out edges to nodes that aren’t listed, and groups nobody is in', () => {
    const text = toMermaidFlowchart({
      nodes: [{ id: 'a', label: 'A' }],
      edges: [{ source: 'a', target: 'gone' }],
      groups: [{ id: 'unused', color: '#000' }],
      direction: 'TB',
    });
    expect(text).toBe('flowchart TB\n  n0["A"]\n');
  });
});

describe('escapeLabel', () => {
  it('turns characters that would end or change a label into entity codes', () => {
    expect(escapeLabel('src/a "b" <c> #d')).toBe('src/a #quot;b#quot; #lt;c#gt; #35;d');
  });
});
