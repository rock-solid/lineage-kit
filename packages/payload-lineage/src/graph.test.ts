import { describe, expect, it } from 'vitest';

import { buildContentGraph, type PayloadConfigLike } from './graph';

// Shaped like connect-hospitality's config: a hero group, a layout of blocks, a shared link field
const link = {
  name: 'link',
  type: 'group',
  fields: [{ name: 'reference', type: 'relationship', relationTo: ['pages', 'hotels'] }],
};
const mediaBlock = {
  slug: 'mediaBlock',
  labels: { singular: 'Media Block' },
  fields: [{ name: 'media', type: 'upload', relationTo: 'media' }],
};
const callToAction = { slug: 'cta', fields: [{ type: 'row', fields: [link] }] };

const config: PayloadConfigLike = {
  blocks: [mediaBlock],
  collections: [
    {
      slug: 'pages',
      labels: { plural: 'Pages' },
      fields: [
        {
          name: 'hero',
          type: 'group',
          fields: [{ name: 'media', type: 'upload', relationTo: 'media' }],
        },
        {
          type: 'tabs',
          tabs: [
            {
              fields: [
                {
                  name: 'layout',
                  type: 'blocks',
                  blocks: [callToAction],
                  blockReferences: ['mediaBlock'],
                },
              ],
            },
            { name: 'meta', fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] },
          ],
        },
      ],
    },
    {
      slug: 'hotels',
      fields: [
        {
          name: 'gallery',
          type: 'array',
          fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
        },
      ],
    },
    { slug: 'media', labels: { plural: { en: 'Media' } }, fields: [] },
    {
      slug: 'payload-preferences',
      fields: [{ name: 'user', type: 'relationship', relationTo: 'users' }],
    },
    { slug: 'users', fields: [] },
  ],
  globals: [
    { slug: 'header', label: 'Header', fields: [{ name: 'nav', type: 'array', fields: [link] }] },
  ],
};

describe('buildContentGraph', () => {
  const graph = buildContentGraph(config);
  const edge = (source: string, target: string) =>
    graph.edges.find((e) => e.source === source && e.target === target);

  it('makes nodes of collections, globals and blocks, leaving out Payload’s own', () => {
    expect(graph.nodes).toEqual([
      { id: 'collection:pages', kind: 'collection', slug: 'pages', label: 'Pages' },
      { id: 'collection:hotels', kind: 'collection', slug: 'hotels', label: 'hotels' },
      // Per-locale labels fall back to the slug
      { id: 'collection:media', kind: 'collection', slug: 'media', label: 'media' },
      { id: 'collection:users', kind: 'collection', slug: 'users', label: 'users' },
      { id: 'global:header', kind: 'global', slug: 'header', label: 'Header' },
      { id: 'block:cta', kind: 'block', slug: 'cta', label: 'cta' },
      { id: 'block:mediaBlock', kind: 'block', slug: 'mediaBlock', label: 'Media Block' },
    ]);
  });

  it('links uploads, merging the fields of one owner into one edge', () => {
    expect(edge('collection:media', 'collection:pages')).toEqual({
      source: 'collection:media',
      target: 'collection:pages',
      kind: 'upload',
      // An unnamed tab adds no path segment, a named one does
      fields: ['hero.media', 'meta.image'],
    });
    expect(edge('collection:media', 'collection:hotels')?.fields).toEqual(['gallery.image']);
  });

  it('links inline and referenced blocks to the field that uses them', () => {
    expect(edge('block:cta', 'collection:pages')).toMatchObject({
      kind: 'blocks',
      fields: ['layout'],
    });
    expect(edge('block:mediaBlock', 'collection:pages')).toMatchObject({
      kind: 'blocks',
      fields: ['layout'],
    });
  });

  it('follows fields inside blocks, with the block as the owner', () => {
    expect(edge('collection:media', 'block:mediaBlock')?.fields).toEqual(['media']);
    // A row adds no path segment
    expect(edge('collection:pages', 'block:cta')).toMatchObject({
      kind: 'relationship',
      fields: ['link.reference'],
    });
    expect(edge('collection:hotels', 'block:cta')).toBeDefined();
  });

  it('links globals', () => {
    expect(edge('collection:pages', 'global:header')?.fields).toEqual(['nav.link.reference']);
  });

  it('drops excluded collections and the edges to them', () => {
    const { nodes, edges } = buildContentGraph(config, { exclude: ['hotels'] });
    expect(nodes.map((n) => n.id)).not.toContain('collection:hotels');
    expect(
      edges.some((e) => e.source === 'collection:hotels' || e.target === 'collection:hotels'),
    ).toBe(false);
  });

  it('drops excluded blocks with their fields, by slug or by id', () => {
    for (const exclude of [['mediaBlock'], ['block:mediaBlock']]) {
      const { nodes, edges } = buildContentGraph(config, { exclude });
      expect(nodes.map((n) => n.id)).not.toContain('block:mediaBlock');
      expect(
        edges.some((e) => e.source === 'block:mediaBlock' || e.target === 'block:mediaBlock'),
      ).toBe(false);
    }
  });

  it('leaves a collection with a block’s slug in when the block is excluded by id', () => {
    const { nodes } = buildContentGraph(config, { exclude: ['block:media'] });
    expect(nodes.map((n) => n.id)).toContain('collection:media');
  });

  it('follows every definition of a block slug, not just the first', () => {
    // Two inline `hero` blocks with different fields, in different collections
    const hero = (field: string, relationTo: string) => ({
      slug: 'hero',
      fields: [{ name: field, type: 'upload', relationTo }],
    });
    const { nodes, edges } = buildContentGraph({
      collections: [
        {
          slug: 'pages',
          fields: [{ name: 'layout', type: 'blocks', blocks: [hero('image', 'images')] }],
        },
        {
          slug: 'posts',
          fields: [{ name: 'layout', type: 'blocks', blocks: [hero('video', 'videos')] }],
        },
        { slug: 'images', fields: [] },
        { slug: 'videos', fields: [] },
      ],
    });
    expect(nodes.filter((n) => n.id === 'block:hero')).toHaveLength(1);
    expect(edges.filter((e) => e.target === 'block:hero').map((e) => e.source)).toEqual([
      'collection:images',
      'collection:videos',
    ]);
  });

  it('stops at a block that contains itself', () => {
    const { edges } = buildContentGraph({
      blocks: [
        {
          slug: 'section',
          fields: [{ name: 'children', type: 'blocks', blockReferences: ['section'] }],
        },
      ],
      collections: [
        {
          slug: 'pages',
          fields: [{ name: 'layout', type: 'blocks', blockReferences: ['section'] }],
        },
      ],
    });
    expect(edges.map((e) => `${e.source}>${e.target}`)).toEqual([
      'block:section>block:section',
      'block:section>collection:pages',
    ]);
  });

  it('leaves out only Payload’s own collections, not globals or blocks that start with payload-', () => {
    const { nodes } = buildContentGraph({
      blocks: [{ slug: 'payload-hero', fields: [] }],
      collections: [
        { slug: 'payload-preferences', fields: [] },
        {
          slug: 'pages',
          fields: [{ name: 'layout', type: 'blocks', blockReferences: ['payload-hero'] }],
        },
      ],
      globals: [{ slug: 'payload-settings', fields: [] }],
    });
    expect(nodes.map((n) => n.id)).toEqual([
      'collection:pages',
      'global:payload-settings',
      'block:payload-hero',
    ]);
  });
});
