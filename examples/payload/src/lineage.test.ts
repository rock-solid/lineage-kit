import { buildContentGraph, buildSchema } from '@rocksoliddigital/payload-lineage';
import { describe, expect, it } from 'vitest';

import configPromise from './payload.config';

// The plugin against a real, sanitized Payload config: what the Lineage and Data model pages show
describe('the example config', async () => {
  const config = await configPromise;

  it('makes a lineage node of each collection, global and block, without Payload’s own', () => {
    expect(buildContentGraph(config).nodes.map((n) => n.id)).toEqual([
      'collection:users',
      'collection:media',
      'collection:pages',
      'collection:posts',
      'collection:categories',
      'global:header',
      'block:callToAction',
      'block:mediaBlock',
      'block:postList',
    ]);
  });

  it('links blocks into the page that uses them, and what they reference into them', () => {
    const edges = buildContentGraph(config).edges.map(
      (e) => `${e.source} > ${e.target} (${e.kind})`,
    );
    expect(edges).toEqual(
      expect.arrayContaining([
        'collection:media > collection:pages (upload)',
        'block:mediaBlock > collection:pages (blocks)',
        'collection:media > block:mediaBlock (upload)',
        'collection:posts > block:postList (relationship)',
        'collection:pages > collection:pages (relationship)',
        'collection:pages > global:header (relationship)',
      ]),
    );
  });

  it('describes the data model with every kind of reference', () => {
    const { entities, relations } = buildSchema(config);
    const line = (from: string, field: string) =>
      relations
        .filter((r) => r.from === from && r.field === field)
        .map((r) => `${r.to}${r.many ? ' many' : ''}`);
    expect(line('collection:posts', 'cover')).toEqual(['collection:media']);
    expect(line('collection:posts', 'categories')).toEqual(['collection:categories many']);
    expect(line('collection:pages', 'layout')).toEqual([
      'collection:pages many',
      'collection:media many',
      'collection:posts many',
    ]);
    expect(line('global:header', 'nav[]')).toEqual(['collection:pages many']);
    const categories = entities.find((e) => e.id === 'collection:categories')!;
    // Payload's sanitizer marks a join as holding many, as it does: a list of posts
    expect(categories.fields).toContainEqual({
      name: 'posts',
      type: 'join',
      hasMany: true,
      relationTo: ['posts'],
    });
  });
});
