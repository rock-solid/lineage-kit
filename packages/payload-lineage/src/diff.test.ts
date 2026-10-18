import { describe, expect, it } from 'vitest';

import { alignGraph, alignSchema, diffGraph, diffSchema } from './diff';
import { buildContentGraph } from './graph';
import { buildSchema } from './schema';
import type { Schema, SchemaEntity } from './schema';
import type { ContentEdge, ContentGraph, ContentNode } from './types';

const node = (kind: ContentNode['kind'], slug: string, label = slug): ContentNode => ({
  id: `${kind}:${slug}`,
  kind,
  slug,
  label,
});
const edge = (source: string, target: string, fields = ['f']): ContentEdge => ({
  source,
  target,
  kind: 'relationship',
  fields,
});
const changes = (items: { change?: string }[], id: (item: never) => string) =>
  Object.fromEntries(items.map((i) => [id(i as never), i.change ?? null]));

describe('diffGraph', () => {
  // media → pages → header on main; this branch adds posts, deletes header and relinks pages
  const base: ContentGraph = {
    nodes: [node('collection', 'media'), node('collection', 'pages'), node('global', 'header')],
    edges: [
      edge('collection:media', 'collection:pages'),
      edge('collection:pages', 'global:header'),
    ],
  };
  const current: ContentGraph = {
    nodes: [node('collection', 'media'), node('collection', 'pages'), node('collection', 'posts')],
    edges: [
      edge('collection:media', 'collection:pages', ['f', 'g']),
      edge('collection:posts', 'collection:pages'),
    ],
  };
  const diff = diffGraph(base, current);

  it('marks nodes added, deleted, and changed when the links their fields make change', () => {
    expect(changes(diff.nodes, (n: ContentNode) => n.id)).toEqual({
      'collection:media': null,
      'collection:pages': 'changed',
      'collection:posts': 'added',
      'global:header': 'deleted',
    });
  });

  it('keeps deleted links, after the current ones, and marks links whose fields changed', () => {
    expect(changes(diff.edges, (e: ContentEdge) => `${e.source} > ${e.target}`)).toEqual({
      'collection:media > collection:pages': 'changed',
      'collection:posts > collection:pages': 'added',
      'collection:pages > global:header': 'deleted',
    });
    expect(diff.edges.at(-1)?.change).toBe('deleted');
  });

  it('marks a renamed node as changed, and nothing at all when nothing changed', () => {
    const renamed = diffGraph(base, {
      ...base,
      nodes: base.nodes.map((n) => (n.slug === 'media' ? { ...n, label: 'Images' } : n)),
    });
    expect(renamed.nodes[0].change).toBe('changed');
    expect(diffGraph(base, base)).toEqual(base);
  });
});

describe('diffSchema', () => {
  const entity = (slug: string, fields: SchemaEntity['fields']): SchemaEntity => ({
    id: `collection:${slug}`,
    kind: 'collection',
    slug,
    label: slug,
    singular: slug,
    fields,
  });
  const base: Schema = {
    entities: [
      entity('pages', [
        { name: 'id', type: 'id', required: true },
        { name: 'title', type: 'text' },
        { name: 'summary', type: 'textarea' },
        { name: 'hero', type: 'upload', relationTo: ['media'] },
      ]),
      entity('media', [{ name: 'id', type: 'id', required: true }]),
      entity('legacy', [{ name: 'id', type: 'id', required: true }]),
    ],
    relations: [
      {
        from: 'collection:pages',
        field: 'hero',
        path: 'hero',
        to: 'collection:media',
        kind: 'upload',
        many: false,
        polymorphic: false,
        unique: false,
      },
    ],
  };
  const current: Schema = {
    entities: [
      entity('pages', [
        { name: 'id', type: 'id', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'hero', type: 'upload', relationTo: ['media'] },
        { name: 'slug', type: 'text' },
      ]),
      // The same, with its keys in another order: not a change
      {
        fields: [{ type: 'id', name: 'id', required: true }],
        singular: 'media',
        label: 'media',
        slug: 'media',
        kind: 'collection',
        id: 'collection:media',
      },
      entity('posts', [{ name: 'id', type: 'id', required: true }]),
    ],
    relations: [{ ...base.relations[0], many: true }],
  };
  const diff = diffSchema(base, current);

  it('marks tables added, deleted, and changed when a field is, whatever the key order', () => {
    expect(changes(diff.entities, (e: SchemaEntity) => e.id)).toEqual({
      'collection:pages': 'changed',
      'collection:media': null,
      'collection:posts': 'added',
      'collection:legacy': 'deleted',
    });
  });

  it('marks fields, keeps a deleted one where it was, and keeps what a changed one was', () => {
    const pages = diff.entities[0];
    expect(pages.fields.map((f) => `${f.name}:${f.change ?? '-'}`)).toEqual([
      'id:-',
      'title:changed',
      'summary:deleted',
      // Its own settings are the same, but its reference became a list
      'hero:changed',
      'slug:added',
    ]);
    expect(pages.fields[1].before).toEqual({ name: 'title', type: 'text' });
  });

  it('marks a reference whose cardinality changed', () => {
    expect(diff.relations.map((r) => r.change)).toEqual(['changed']);
  });
});

describe('changes against what the running config filters out', () => {
  // Main's config: pages use a hero block (with a nested cta block) and a form block
  const field = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    type: 'text',
    ...extra,
  });
  const main = {
    collections: [
      {
        slug: 'pages',
        fields: [
          field('title'),
          field('token'),
          {
            name: 'layout',
            type: 'blocks',
            blocks: [
              {
                slug: 'hero',
                fields: [
                  { name: 'image', type: 'upload', relationTo: 'media' },
                  {
                    name: 'cta',
                    type: 'blocks',
                    blocks: [{ slug: 'cta', fields: [field('label')] }],
                  },
                ],
              },
              {
                slug: 'form',
                fields: [{ name: 'page', type: 'relationship', relationTo: 'posts' }],
              },
            ],
          },
        ],
      },
      { slug: 'posts', fields: [field('title')] },
      { slug: 'media', fields: [] },
    ],
  };
  // The same collections on the branch, with `token` now hidden
  const branch = {
    collections: main.collections.map((c) =>
      c.slug === 'pages'
        ? {
            ...c,
            fields: c.fields.map((f) =>
              'name' in f && f.name === 'token' ? { ...f, hidden: true } : f,
            ),
          }
        : c,
    ),
  };
  const lineage = (exclude: string[]) => {
    const current = buildContentGraph(branch, { exclude });
    return diffGraph(
      alignGraph(buildContentGraph(main), buildContentGraph(branch), current),
      current,
    );
  };
  const dataModel = (exclude: string[]) => {
    const current = buildSchema(branch, { exclude });
    const unfiltered = buildSchema(branch, {}, { includeHidden: true });
    return diffSchema(alignSchema(buildSchema(main), unfiltered, current), current);
  };
  const deleted = <T extends { change?: string }>(items: T[]) =>
    items.filter((i) => i.change === 'deleted');

  it('doesn’t take an excluded collection for deleted, nor the blocks only it reaches', () => {
    // Excluding pages leaves hero and the cta inside it, and form, unreachable
    const diff = lineage(['pages']);
    expect(deleted(diff.nodes)).toEqual([]);
    expect(deleted(diff.edges)).toEqual([]);
    expect(deleted(dataModel(['pages']).entities)).toEqual([]);
  });

  it('doesn’t take an excluded block, or the blocks inside it, for deleted', () => {
    expect(deleted(lineage(['block:hero']).nodes)).toEqual([]);
    const { entities, relations } = dataModel(['block:form', 'posts']);
    // The layout row lists one block fewer only because of the filter: unchanged
    expect(entities.find((e) => e.id === 'collection:pages')?.change).toBeUndefined();
    expect(deleted(relations)).toEqual([]);
  });

  it('doesn’t take a field hidden on the branch for deleted, but still finds one removed', () => {
    expect(dataModel([]).entities.flatMap((e) => deleted(e.fields))).toEqual([]);
    // With another change on the table, so its fields are aligned one by one, not swapped whole
    const retitled = {
      collections: branch.collections.map((c) =>
        c.slug === 'pages'
          ? {
              ...c,
              fields: c.fields.map((f) =>
                'name' in f && f.name === 'title' ? { ...f, required: true } : f,
              ),
            }
          : c,
      ),
    };
    const now = buildSchema(retitled);
    const both = diffSchema(
      alignSchema(buildSchema(main), buildSchema(retitled, {}, { includeHidden: true }), now),
      now,
    );
    const pages = both.entities.find((e) => e.id === 'collection:pages')!;
    expect(pages.change).toBe('changed');
    expect(deleted(pages.fields)).toEqual([]);
    const removed = {
      collections: branch.collections.map((c) => (c.slug === 'posts' ? { ...c, fields: [] } : c)),
    };
    const current = buildSchema(removed);
    const diff = diffSchema(
      alignSchema(buildSchema(main), buildSchema(removed, {}, { includeHidden: true }), current),
      current,
    );
    expect(diff.entities.flatMap((e) => deleted(e.fields)).map((f) => f.name)).toEqual(['title']);
  });

  it('still marks a collection removed from the config as deleted', () => {
    const gone = { collections: branch.collections.filter((c) => c.slug !== 'posts') };
    const current = buildContentGraph(gone);
    const diff = diffGraph(alignGraph(buildContentGraph(main), current, current), current);
    expect(deleted(diff.nodes).map((n) => n.id)).toEqual(['collection:posts']);
  });
});

describe('a reference that changes inside its row', () => {
  it('marks the row and its table changed when only the reference moved', () => {
    const pages = (to: string): Schema => ({
      entities: [
        {
          id: 'collection:pages',
          kind: 'collection',
          slug: 'pages',
          label: 'pages',
          singular: 'pages',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'layout', type: 'blocks', blocks: ['mediaBlock'] },
          ],
        },
      ],
      relations: [
        {
          from: 'collection:pages',
          field: 'layout',
          path: 'layout[mediaBlock].media',
          to,
          kind: 'upload',
          many: true,
          polymorphic: false,
          unique: false,
        },
      ],
    });
    const diff = diffSchema(pages('collection:media'), pages('collection:posts'));
    expect(diff.entities[0].change).toBe('changed');
    expect(diff.entities[0].fields.map((f) => f.change ?? null)).toEqual([null, 'changed']);
    expect(diff.relations.map((r) => `${r.to}:${r.change}`)).toEqual([
      'collection:posts:added',
      'collection:media:deleted',
    ]);
  });
});
