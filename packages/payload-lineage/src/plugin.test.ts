import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Config, Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { lineagePlugin } from './plugin';

const config = {
  collections: [{ slug: 'media', fields: [] }],
} as unknown as Config;
const payload = (sanitized: unknown) =>
  ({ config: sanitized, logger: { info: vi.fn(), warn: vi.fn() } }) as unknown as Payload;

describe('lineagePlugin', () => {
  it('writes the graph of the sanitized config on init, after the existing onInit', async () => {
    const outputFile = path.join(
      await mkdtemp(path.join(tmpdir(), 'lineage-')),
      'out/lineage.json',
    );
    const onInit = vi.fn();
    const result = await lineagePlugin({ outputFile, adminView: false })({ ...config, onInit });

    await result.onInit!(payload({ collections: [{ slug: 'forms', fields: [] }] }));

    expect(onInit).toHaveBeenCalled();
    expect(JSON.parse(await readFile(outputFile, 'utf8'))).toEqual({
      nodes: [{ id: 'collection:forms', kind: 'collection', slug: 'forms', label: 'forms' }],
      edges: [],
    });
  });

  it('leaves the config alone when disabled', async () => {
    expect(await lineagePlugin({ outputFile: 'x.json', enabled: false })(config)).toBe(config);
  });

  it('adds the admin view and nav link, keeping the ones already there', async () => {
    const result = await lineagePlugin({ exclude: ['block:text'] })({
      ...config,
      admin: {
        components: {
          afterNavLinks: ['/Mine#Link'],
          views: { mine: { Component: '/Mine', path: '/mine' } },
        },
      },
    });
    expect(result.admin?.components?.afterNavLinks).toEqual([
      '/Mine#Link',
      '@rock-solid/payload-lineage/client#LineageNavLink',
    ]);
    expect(result.admin?.components?.views).toEqual({
      mine: { Component: '/Mine', path: '/mine' },
      lineage: {
        Component: {
          path: '@rock-solid/payload-lineage/rsc#LineageView',
          serverProps: { graphOptions: { exclude: ['block:text'] } },
        },
        exact: true,
        path: '/lineage',
      },
      lineageSchema: {
        Component: {
          path: '@rock-solid/payload-lineage/rsc#SchemaView',
          serverProps: { graphOptions: { exclude: ['block:text'] } },
        },
        exact: true,
        path: '/lineage/schema',
      },
    });
    // No output file, so nothing runs on init
    expect(result.onInit).toBeUndefined();
  });

  it('leaves the admin alone with adminView: false', async () => {
    expect(await lineagePlugin({ adminView: false })(config)).toBe(config);
  });

  it('writes no file in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const result = await lineagePlugin({ outputFile: 'x.json', adminView: false })(config);
      expect(result).toBe(config);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('warns instead of failing init when the file can’t be written', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lineage-'));
    // A file where the output folder should be, so creating the folder fails
    await writeFile(path.join(dir, 'blocker'), '');
    const outputFile = path.join(dir, 'blocker/lineage.json');
    const instance = payload({ collections: [] });

    const result = await lineagePlugin({ outputFile, adminView: false })(config);
    await expect(result.onInit!(instance)).resolves.toBeUndefined();

    expect(instance.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: `Lineage: couldn't write ${outputFile}` }),
    );
    expect(instance.logger.info).not.toHaveBeenCalled();
  });

  it('still fails init when the existing onInit throws', async () => {
    const onInit = () => Promise.reject(new Error('seed failed'));
    const result = await lineagePlugin({ outputFile: 'x.json', adminView: false })({
      ...config,
      onInit,
    });
    await expect(result.onInit!(payload({ collections: [] }))).rejects.toThrow('seed failed');
  });
});
