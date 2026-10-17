import { describe, expect, it } from 'vitest';

import type { PayloadConfigLike } from './graph';
import { buildSchema } from './schema';

const link = {
  name: 'link',
  type: 'group',
  fields: [{ name: 'reference', type: 'relationship', relationTo: 'pages' }],
};
const config = {
  blocks: [
    {
      slug: 'mediaBlock',
      fields: [{ name: 'media', type: 'upload', relationTo: 'media', required: true }],
    },
  ],
  collections: [
    {
      slug: 'pages',
      labels: { singular: 'Page', plural: 'Pages' },
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
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
                  blocks: [{ slug: 'cta', fields: [link] }],
                  blockReferences: ['mediaBlock'],
                },
              ],
            },
            {
              name: 'meta',
              fields: [
                { type: 'row', fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] },
              ],
            },
          ],
        },
        { name: 'related', type: 'relationship', relationTo: ['pages', 'hotels'], hasMany: true },
        { name: 'preview', type: 'ui' },
      ],
    },
    {
      slug: 'hotels',
      fields: [
        {
          name: 'gallery',
          type: 'array',
          fields: [
            { name: 'image', type: 'upload', relationTo: 'media' },
            { name: 'caption', type: 'text' },
          ],
        },
        { name: 'pages', type: 'join', collection: 'pages', on: 'related' },
      ],
    },
    { slug: 'media', upload: {}, fields: [{ name: 'alt', type: 'text' }] },
    {
      slug: 'users',
      auth: {},
      fields: [
        { name: 'email', type: 'email' },
        { name: 'salt', type: 'text', hidden: true },
      ],
    },
    { slug: 'payload-preferences', fields: [] },
  ],
  globals: [
    { slug: 'header', label: 'Header', fields: [{ name: 'nav', type: 'array', fields: [link] }] },
  ],
} as unknown as PayloadConfigLike;

describe('buildSchema', () => {
  const { entities, relations } = buildSchema(config);
  const fields = (id: string) => entities.find((e) => e.id === id)!.fields;

  it('makes a table of each collection and global, leaving out Payload’s own', () => {
    expect(entities.map((e) => e.id)).toEqual([
      'collection:pages',
      'collection:hotels',
      'collection:media',
      'collection:users',
      'global:header',
    ]);
    expect(entities.find((e) => e.id === 'collection:pages')).toMatchObject({
      label: 'Pages',
      singular: 'Page',
    });
    expect(entities.find((e) => e.id === 'global:header')).toMatchObject({
      label: 'Header',
      singular: 'Header',
    });
    expect(entities.find((e) => e.id === 'collection:media')).toMatchObject({ upload: true });
    expect(entities.find((e) => e.id === 'collection:users')).toMatchObject({ auth: true });
  });

  it('flattens groups, rows and tabs into dotted rows, and keeps arrays and blocks as one row each', () => {
    expect(fields('collection:pages')).toEqual([
      { name: 'id', type: 'id', required: true },
      { name: 'title', type: 'text', required: true, localized: true },
      { name: 'hero.media', type: 'upload', relationTo: ['media'] },
      { name: 'layout', type: 'blocks', blocks: ['cta', 'mediaBlock'] },
      { name: 'meta.image', type: 'upload', relationTo: ['media'] },
      { name: 'related', type: 'relationship', hasMany: true, relationTo: ['pages', 'hotels'] },
    ]);
    expect(fields('collection:hotels').map((f) => f.name)).toEqual(['id', 'gallery[]', 'pages']);
    expect(fields('global:header').map((f) => f.name)).toEqual(['nav[]']);
  });

  it('leaves out hidden and UI fields', () => {
    expect(fields('collection:users').map((f) => f.name)).toEqual(['id', 'email']);
  });

  it('attaches relations inside blocks and arrays to that row, as many, with the full path', () => {
    expect(relations).toContainEqual({
      from: 'collection:pages',
      field: 'layout',
      path: 'layout[mediaBlock].media',
      to: 'collection:media',
      kind: 'upload',
      many: true,
      polymorphic: false,
      unique: false,
    });
    expect(relations).toContainEqual(
      expect.objectContaining({
        from: 'collection:hotels',
        field: 'gallery[]',
        path: 'gallery[].image',
        many: true,
      }),
    );
    expect(relations).toContainEqual(
      expect.objectContaining({
        from: 'global:header',
        field: 'nav[]',
        path: 'nav[].link.reference',
        to: 'collection:pages',
      }),
    );
  });

  it('gives a single upload one relation, and a polymorphic hasMany one per collection', () => {
    expect(relations).toContainEqual(
      expect.objectContaining({
        field: 'hero.media',
        to: 'collection:media',
        many: false,
        polymorphic: false,
      }),
    );
    expect(relations.filter((r) => r.field === 'related')).toEqual([
      expect.objectContaining({ to: 'collection:pages', many: true, polymorphic: true }),
      expect.objectContaining({ to: 'collection:hotels', many: true, polymorphic: true }),
    ]);
  });

  it('shows a join as a row but not as a relation, since it reverses one', () => {
    expect(fields('collection:hotels')).toContainEqual({
      name: 'pages',
      type: 'join',
      relationTo: ['pages'],
    });
    expect(relations.some((r) => r.from === 'collection:hotels' && r.field === 'pages')).toBe(
      false,
    );
  });

  it('drops excluded collections and the relations to them', () => {
    const schema = buildSchema(config, { exclude: ['media'] });
    expect(schema.entities.map((e) => e.id)).not.toContain('collection:media');
    expect(schema.relations.some((r) => r.to === 'collection:media')).toBe(false);
  });

  it('stops at a block that contains itself, directly or through another block', () => {
    const self = {
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
    } as unknown as PayloadConfigLike;
    const cycle = {
      blocks: [
        {
          slug: 'a',
          fields: [
            { name: 'b', type: 'blocks', blockReferences: ['b'] },
            { name: 'img', type: 'upload', relationTo: 'media' },
          ],
        },
        { slug: 'b', fields: [{ name: 'a', type: 'blocks', blockReferences: ['a'] }] },
      ],
      collections: [
        { slug: 'pages', fields: [{ name: 'layout', type: 'blocks', blockReferences: ['a'] }] },
        { slug: 'media', fields: [] },
      ],
    } as unknown as PayloadConfigLike;
    expect(buildSchema(self).entities[0].fields.map((f) => f.name)).toEqual(['id', 'layout']);
    // pages → a → b → a stops at the second a, which is already on the path
    expect(buildSchema(cycle).relations.map((r) => r.path)).toEqual(['layout[a].img']);
  });

  it('walks a block again in another field when it isn’t a loop', () => {
    const reused = {
      blocks: [
        { slug: 'media', fields: [{ name: 'file', type: 'upload', relationTo: 'uploads' }] },
      ],
      collections: [
        {
          slug: 'pages',
          fields: [
            { name: 'hero', type: 'blocks', blockReferences: ['media'] },
            { name: 'layout', type: 'blocks', blockReferences: ['media'] },
          ],
        },
        { slug: 'uploads', fields: [] },
      ],
    } as unknown as PayloadConfigLike;
    expect(buildSchema(reused).relations.map((r) => r.path)).toEqual([
      'hero[media].file',
      'layout[media].file',
    ]);
  });

  it('keeps a collection’s own id field instead of adding one', () => {
    const custom = {
      collections: [
        {
          slug: 'hotels',
          fields: [
            { name: 'id', type: 'text', required: true },
            { name: 'name', type: 'text' },
          ],
        },
      ],
    } as unknown as PayloadConfigLike;
    expect(buildSchema(custom).entities[0].fields).toEqual([
      { name: 'id', type: 'text', required: true },
      { name: 'name', type: 'text' },
    ]);
  });

  it('leaves an excluded block out of the row and its references out of the relations', () => {
    const schema = buildSchema(config, { exclude: ['block:mediaBlock'] });
    expect(schema.entities[0].fields.find((f) => f.name === 'layout')).toEqual({
      name: 'layout',
      type: 'blocks',
      blocks: ['cta'],
    });
    expect(schema.relations.some((r) => r.path.startsWith('layout[mediaBlock]'))).toBe(false);
  });

  it('leaves out only Payload’s own collections, not globals or blocks that start with payload-', () => {
    const prefixed = {
      blocks: [{ slug: 'payload-hero', fields: [] }],
      collections: [
        { slug: 'payload-preferences', fields: [] },
        {
          slug: 'pages',
          fields: [{ name: 'layout', type: 'blocks', blockReferences: ['payload-hero'] }],
        },
      ],
      globals: [{ slug: 'payload-settings', fields: [] }],
    } as unknown as PayloadConfigLike;
    const schema = buildSchema(prefixed);
    expect(schema.entities.map((e) => e.id)).toEqual([
      'collection:pages',
      'global:payload-settings',
    ]);
    expect(schema.entities[0].fields).toContainEqual({
      name: 'layout',
      type: 'blocks',
      blocks: ['payload-hero'],
    });
  });
});
