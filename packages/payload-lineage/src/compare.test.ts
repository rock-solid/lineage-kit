import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { compare } from './compare';

describe('compare', () => {
  it('brings both snapshot files up to date, whichever page asks', async () => {
    const dir = path.join(await mkdtemp(path.join(tmpdir(), 'lineage-')), 'lineage');
    const payload = {
      config: { collections: [{ slug: 'forms', fields: [] }] },
      logger: { info: vi.fn(), warn: vi.fn() },
    } as unknown as Payload;

    await compare(payload, { graphOptions: {}, snapshot: { dir, baseBranch: 'main' } }, 'graph');

    const read = async (file: string) => JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    expect((await read('graph.json')).nodes).toHaveLength(1);
    // The data model page's file too, though only the lineage page was opened
    expect((await read('schema.json')).entities[0]).toMatchObject({ id: 'collection:forms' });
  });

  it('does nothing with the snapshot off', async () => {
    const payload = { config: {} } as unknown as Payload;
    expect(await compare(payload, { graphOptions: {} }, 'schema')).toEqual({});
  });
});
