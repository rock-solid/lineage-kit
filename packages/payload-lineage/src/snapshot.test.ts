import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readBaseSnapshot, resolveSnapshot, writeSnapshot } from './snapshot';

const graph = (slug: string) => ({
  nodes: [{ id: `collection:${slug}`, kind: 'collection' as const, slug, label: slug }],
  edges: [],
});

async function repo() {
  const root = await mkdtemp(path.join(tmpdir(), 'lineage-snapshot-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('commit', '-q', '--allow-empty', '-m', 'init');
  return { root, git };
}

describe('resolveSnapshot', () => {
  it('is off without the option, and fills in the defaults', () => {
    expect(resolveSnapshot(undefined)).toBeUndefined();
    expect(resolveSnapshot(false)).toBeUndefined();
    expect(resolveSnapshot(true)).toEqual({ dir: 'lineage', baseBranch: 'main' });
    expect(resolveSnapshot({ baseBranch: 'develop' })).toEqual({
      dir: 'lineage',
      baseBranch: 'develop',
    });
  });
});

describe('writeSnapshot', () => {
  it('writes the file, and leaves it alone when nothing changed', async () => {
    const dir = path.join(await mkdtemp(path.join(tmpdir(), 'lineage-')), 'lineage');
    expect(await writeSnapshot(dir, 'graph', graph('pages'))).toBe(true);
    const file = path.join(dir, 'graph.json');
    const written = await stat(file);
    expect(await writeSnapshot(dir, 'graph', graph('pages'))).toBe(false);
    expect((await stat(file)).mtimeMs).toBe(written.mtimeMs);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(graph('pages'));
  });
});

describe('readBaseSnapshot', () => {
  const snapshot = { dir: 'cms/lineage', baseBranch: 'main' };

  it('reads the base branch’s copy where the branch left it, relative to the working directory', async () => {
    const { root, git } = await repo();
    const cwd = path.join(root, 'cms');
    await writeSnapshot(path.join(cwd, 'cms/lineage'), 'graph', graph('pages'));
    git('add', '.');
    git('commit', '-q', '-m', 'snapshot');
    git('switch', '-q', '-c', 'feature');
    await writeSnapshot(path.join(cwd, 'cms/lineage'), 'graph', graph('posts'));
    git('commit', '-q', '-am', 'change');
    // main moves on after the branch left it: the branch still compares with where it started
    git('switch', '-q', 'main');
    await writeSnapshot(path.join(cwd, 'cms/lineage'), 'graph', graph('media'));
    git('commit', '-q', '-am', 'later');
    git('switch', '-q', 'feature');

    expect(await readBaseSnapshot(snapshot, 'graph', cwd)).toEqual({
      state: 'ready',
      base: 'main',
      value: graph('pages'),
    });
  });

  it('says when the base branch has no snapshot, or there is no base branch', async () => {
    const { root } = await repo();
    expect(await readBaseSnapshot(snapshot, 'schema', root)).toEqual({
      state: 'no-snapshot',
      base: 'main',
    });
    expect(await readBaseSnapshot({ ...snapshot, baseBranch: 'develop' }, 'graph', root)).toEqual({
      state: 'no-base',
      branch: 'develop',
    });
    const notARepo = await mkdtemp(path.join(tmpdir(), 'lineage-'));
    await writeFile(path.join(notARepo, 'x'), '');
    expect(await readBaseSnapshot(snapshot, 'graph', notARepo)).toEqual({
      state: 'no-base',
      branch: 'main',
    });
  });

  it('reads a snapshot past execFile’s 1 MiB default', async () => {
    const { root, git } = await repo();
    // About 2 MiB of nodes
    const big = {
      nodes: Array.from({ length: 20000 }, (_, i) => graph(`collection-${i}`).nodes[0]),
      edges: [],
    };
    await writeSnapshot(path.join(root, 'cms/lineage'), 'graph', big);
    git('add', '.');
    git('commit', '-q', '-m', 'snapshot');
    const found = await readBaseSnapshot(snapshot, 'graph', root);
    expect(found.state).toBe('ready');
    expect(found.state === 'ready' && found.value.nodes).toHaveLength(20000);
  });

  it('says the snapshot is invalid instead of failing when it isn’t JSON', async () => {
    const { root, git } = await repo();
    const dir = path.join(root, 'cms/lineage');
    await writeSnapshot(dir, 'schema', { entities: [], relations: [] });
    // As a badly resolved merge conflict leaves it
    await writeFile(path.join(dir, 'schema.json'), '<<<<<<< HEAD\n{}\n=======\n');
    git('add', '.');
    git('commit', '-q', '-m', 'conflict');
    expect(await readBaseSnapshot(snapshot, 'schema', root)).toEqual({
      state: 'invalid',
      base: 'main',
    });
  });
});
