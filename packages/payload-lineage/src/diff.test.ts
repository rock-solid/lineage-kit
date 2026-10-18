import { describe, expect, it } from 'vitest';

import { diffGraph, diffSchema, excludeFromGraph, excludeFromSchema } from './diff';
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

describe('changes against the running config’s exclude', () => {
  it('doesn’t bring back a collection excluded since as deleted, with its links', () => {
    const base: ContentGraph = {
      nodes: [node('collection', 'pages'), node('collection', 'posts')],
      edges: [edge('collection:posts', 'collection:pages')],
    };
    const current: ContentGraph = { nodes: [node('collection', 'pages')], edges: [] };
    const diff = diffGraph(excludeFromGraph(base, { exclude: ['posts'] }), current);
    expect(diff.nodes.map((n) => n.id)).toEqual(['collection:pages']);
    expect(diff.edges).toEqual([]);
  });

  it('drops excluded tables, blocks and the references inside excluded blocks from the base', () => {
    const pages: SchemaEntity = {
      id: 'collection:pages',
      kind: 'collection',
      slug: 'pages',
      label: 'pages',
      singular: 'pages',
      fields: [
        { name: 'layout', type: 'blocks', blocks: ['hero', 'form'] },
        { name: 'author', type: 'relationship', relationTo: ['users', 'posts'] },
      ],
    };
    const relation = (path: string, to: string) => ({
      from: 'collection:pages',
      field: path.split(/[.[]/)[0],
      path,
      to,
      kind: 'relationship' as const,
      many: true,
      polymorphic: false,
      unique: false,
    });
    const base: Schema = {
      entities: [pages, { ...pages, id: 'collection:posts', slug: 'posts', fields: [] }],
      relations: [
        relation('layout[hero].media', 'collection:pages'),
        relation('layout[form].page', 'collection:pages'),
        relation('author', 'collection:posts'),
      ],
    };
    const filtered = excludeFromSchema(base, { exclude: ['posts', 'block:form'] });
    expect(filtered.entities.map((e) => e.id)).toEqual(['collection:pages']);
    // As buildSchema writes them: the blocks list loses the excluded block; relationTo keeps
    // every slug, for the pages to filter by what the viewer can read
    expect(filtered.entities[0].fields).toEqual([
      { name: 'layout', type: 'blocks', blocks: ['hero'] },
      { name: 'author', type: 'relationship', relationTo: ['users', 'posts'] },
    ]);
    expect(filtered.relations.map((r) => r.path)).toEqual(['layout[hero].media']);
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
