import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildGraph } from './graph';
import type { LineageGraph } from './types';

// A project with shadcn-style folders: each component beside an `index.ts` that re-exports it
const project = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: { jsx: 'react-jsx', baseUrl: '.', paths: { '@/*': ['src/*'] } },
  }),
  'src/components/ui/button/button.tsx': `export const Button = () => <button />;`,
  'src/components/ui/button/index.ts': `// Re-exported so imports stay @/components/ui/button
'use client';
export * from './button';`,
  'src/components/ui/button/button.stories.tsx': `import { Button } from '.';
export default { title: 'UI/Button', component: Button };`,
  'src/components/ui/card/card.tsx': `export const Card = () => <div />;`,
  'src/components/ui/card/index.ts': `export { Card } from './card';
export type { CardProps } from './types';`,
  'src/components/ui/card/types.ts': `export type CardProps = { title: string };`,
  // A barrel over a barrel
  'src/components/ui/index.ts': `export * from './card';`,
  // A barrel over several files stays a node
  'src/components/index.ts': `export * from './ui/button';
export * from './ui/card/card';`,
  // Not a barrel: it has code of its own
  'src/lib/index.ts': `export * from './cx';
export const noop = () => {};`,
  'src/lib/cx.ts': `export const cx = (...c: string[]) => c.join(' ');`,
  'src/pages/Home.tsx': `import { Button } from '@/components/ui/button';
import { Button as Again } from '@/components/ui/button/button';
import { Card } from '@/components/ui';
import { cx } from '@/lib';
export const Home = () => <main className={cx('a')}><Button /><Again /><Card /></main>;`,
  'src/pages/About.tsx': `import { Button } from '@/components';
export const About = () => <Button />;`,
};

let root: string;
let graph: LineageGraph;
const ids = () => graph.nodes.map((n) => n.id).sort();
const edges = () => graph.edges.map((e) => `${e.source} -> ${e.target}`).sort();

beforeAll(async () => {
  // realpath: on macOS the temp folder is behind a symlink, which dependency-cruiser doesn't resolve
  root = realpathSync(mkdtempSync(path.join(tmpdir(), 'lineage-graph-')));
  for (const [file, source] of Object.entries(project)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
  }
  graph = await buildGraph({}, root);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('barrels', () => {
  it('merges a barrel over one file into that file', () => {
    expect(ids()).toEqual([
      'src/components/index.ts',
      'src/components/ui/button/button.tsx',
      'src/components/ui/card/card.tsx',
      'src/components/ui/card/types.ts',
      'src/lib/cx.ts',
      'src/lib/index.ts',
      'src/pages/About.tsx',
      'src/pages/Home.tsx',
    ]);
  });

  it('links importers of the barrel, or a chain of them, to the file, once', () => {
    expect(edges()).toEqual([
      'src/components/index.ts -> src/pages/About.tsx',
      'src/components/ui/button/button.tsx -> src/components/index.ts',
      'src/components/ui/button/button.tsx -> src/pages/Home.tsx',
      'src/components/ui/card/card.tsx -> src/components/index.ts',
      'src/components/ui/card/card.tsx -> src/pages/Home.tsx',
      'src/lib/cx.ts -> src/lib/index.ts',
      'src/lib/index.ts -> src/pages/Home.tsx',
    ]);
  });

  it('names the file after itself and links it to a story that imports the barrel', () => {
    const button = graph.nodes.find((n) => n.id === 'src/components/ui/button/button.tsx');
    expect(button).toMatchObject({ label: 'button', storyId: 'ui-button--docs' });
  });
});
