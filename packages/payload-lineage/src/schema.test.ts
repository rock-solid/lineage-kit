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
      labels: { plural: 'Pages' },
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
});
