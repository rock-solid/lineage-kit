import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Config, Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { lineagePlugin } from './plugin';

const config = {
  collections: [{ slug: 'media', fields: [] }],
} as unknown as Config;
const payload = (sanitized: unknown) =>
  ({ config: sanitized, logger: { info: vi.fn() } }) as unknown as Payload;

describe('lineagePlugin', () => {
  it('writes the graph of the sanitized config on init, after the existing onInit', async () => {
    const outputFile = path.join(
      await mkdtemp(path.join(tmpdir(), 'lineage-')),
      'out/lineage.json',
    );
    const onInit = vi.fn();
    const result = await lineagePlugin({ outputFile, enabled: true })({ ...config, onInit });

    await result.onInit!(payload({ collections: [{ slug: 'forms', fields: [] }] }));

    expect(onInit).toHaveBeenCalled();
    expect(JSON.parse(await readFile(outputFile, 'utf8'))).toEqual({
      nodes: [{ id: 'collection:forms', kind: 'collection', slug: 'forms', label: 'forms' }],
      edges: [],
    });
  });

  it('leaves the config alone when disabled or without an output file', async () => {
    expect(await lineagePlugin({ outputFile: 'x.json', enabled: false })(config)).toBe(config);
    expect(await lineagePlugin({ enabled: true })(config)).toBe(config);
  });
});
