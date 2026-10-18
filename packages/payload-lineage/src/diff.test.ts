import { describe, expect, it } from 'vitest';

import { diffGraph, diffSchema } from './diff';
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
      'hero:-',
      'slug:added',
    ]);
    expect(pages.fields[1].before).toEqual({ name: 'title', type: 'text' });
  });

  it('marks a reference whose cardinality changed', () => {
    expect(diff.relations.map((r) => r.change)).toEqual(['changed']);
  });
});
