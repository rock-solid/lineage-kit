import { describe, expect, it } from 'vitest';

import type { SchemaEntity, SchemaRelation } from '../schema';
import {
  changedTables,
  describeCardinality,
  erdEdges,
  ROW_LIMIT,
  schemaForViewer,
  selfReferences,
  tableHeight,
  visibleRows,
} from './erdModel';

const rel = (
  from: string,
  field: string,
  to: string,
  many = false,
  unique = false,
): SchemaRelation => ({
  from,
  field,
  path: field,
  to,
  kind: 'upload',
  many,
  polymorphic: false,
  unique,
});

const relations = [
  rel('collection:pages', 'layout', 'collection:media', true),
  rel('collection:pages', 'layout', 'collection:media'),
  rel('collection:pages', 'hero.media', 'collection:media'),
  rel('collection:pages', 'parent', 'collection:pages'),
];

describe('erdEdges', () => {
  const edges = erdEdges(relations);

  it('merges relations from one row to one collection into one line, many-to-many if any is a list', () => {
    expect(edges.find((e) => e.field === 'layout')).toMatchObject({
      cardinality: 'many-to-many',
      relations: [{}, {}],
    });
    expect(edges.find((e) => e.field === 'hero.media')).toMatchObject({
      cardinality: 'many-to-one',
    });
  });

  it('makes a global’s side one, since it is a single document', () => {
    const [list, single] = erdEdges([
      rel('global:header', 'nav[]', 'collection:pages', true),
      rel('global:footer', 'logo', 'collection:media'),
    ]);
    expect(list.cardinality).toBe('one-to-many');
    expect(single.cardinality).toBe('one-to-one');
  });

  it('makes a single unique reference one-to-one', () => {
    const [edge] = erdEdges([
      rel('collection:users', 'profile', 'collection:profiles', false, true),
    ]);
    expect(edge.cardinality).toBe('one-to-one');
  });

  it('draws no line for a table pointing at itself', () => {
    expect(edges).toHaveLength(2);
    const pages = { id: 'collection:pages' } as SchemaEntity;
    expect(selfReferences(pages, relations)).toEqual(new Set(['parent']));
  });
});

describe('visibleRows', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ name: `f${i}`, type: 'text' }));
  const entity: SchemaEntity = {
    id: 'collection:media',
    kind: 'collection',
    slug: 'media',
    label: 'Media',
    singular: 'Media',
    fields: [{ name: 'id', type: 'id' }, ...many, { name: 'folder', type: 'relationship' }],
  };
  const own = [rel('collection:media', 'folder', 'collection:folders')];

  it('cuts a long table to the limit, keeping the id and the rows with relations', () => {
    const { rows, hidden } = visibleRows(entity, own, { keysOnly: false, expanded: false });
    expect(rows).toHaveLength(ROW_LIMIT);
    expect(rows.map((r) => r.name)).toContain('folder');
    expect(rows[0].name).toBe('id');
    expect(hidden).toBe(entity.fields.length - ROW_LIMIT);
  });

  it('keeps a collection’s own id field with keysOnly', () => {
    const custom: SchemaEntity = {
      ...entity,
      fields: [{ name: 'id', type: 'text' }, ...many],
    };
    expect(visibleRows(custom, [], { keysOnly: true, expanded: false }).rows).toEqual([
      { name: 'id', type: 'text' },
    ]);
  });

  it('shows everything when expanded, and only the keys with keysOnly', () => {
    expect(visibleRows(entity, own, { keysOnly: false, expanded: true }).hidden).toBe(0);
    expect(
      visibleRows(entity, own, { keysOnly: true, expanded: false }).rows.map((r) => r.name),
    ).toEqual(['id', 'folder']);
  });
});

describe('layout and access', () => {
  it('sizes tables to their rows, with room for "+N more"', () => {
    expect(tableHeight(3, 0)).toBeLessThan(tableHeight(3, 5));
    expect(tableHeight(4, 0) - tableHeight(3, 0)).toBe(tableHeight(5, 0) - tableHeight(4, 0));
  });

  it('drops the names of collections the viewer can’t read from the fields that point at them', () => {
    const schema = {
      entities: [
        {
          id: 'collection:pages',
          kind: 'collection',
          slug: 'pages',
          label: 'Pages',
          singular: 'Page',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'owner', type: 'relationship', relationTo: ['users', 'private-records'] },
            { name: 'records', type: 'join', relationTo: ['private-records'] },
          ],
        },
        {
          id: 'collection:users',
          kind: 'collection',
          slug: 'users',
          label: 'Users',
          singular: 'User',
          fields: [],
        },
        {
          id: 'collection:private-records',
          kind: 'collection',
          slug: 'private-records',
          label: 'Private',
          singular: 'Private',
          fields: [],
        },
      ] as SchemaEntity[],
      relations: [],
    };
    const visible = schemaForViewer(schema, (e) => e.slug !== 'private-records');
    expect(visible.entities[0].fields).toEqual([
      { name: 'title', type: 'text' },
      { name: 'owner', type: 'relationship', relationTo: ['users'] },
      { name: 'records', type: 'join' },
    ]);
    expect(JSON.stringify(visible)).not.toContain('private-records');
  });

  it('drops tables the viewer can’t read, with their relations', () => {
    const schema = {
      entities: [
        {
          id: 'collection:pages',
          kind: 'collection',
          slug: 'pages',
          label: 'Pages',
          singular: 'Page',
          fields: [],
        },
        {
          id: 'collection:media',
          kind: 'collection',
          slug: 'media',
          label: 'Media',
          singular: 'Media',
          fields: [],
        },
      ] as SchemaEntity[],
      relations,
    };
    const visible = schemaForViewer(schema, (e) => e.slug !== 'media');
    expect(visible.entities.map((e) => e.id)).toEqual(['collection:pages']);
    expect(visible.relations).toEqual([rel('collection:pages', 'parent', 'collection:pages')]);
  });
});

describe('describeCardinality', () => {
  const hotels = { kind: 'collection', label: 'Hotels', singular: 'Hotel' };
  const header = { kind: 'global', label: 'Header', singular: 'Header' };
  const pages = { label: 'Pages', singular: 'Page' };
  const media = { label: 'Media', singular: 'Media' };

  it('reads a global as the one document it is', () => {
    expect(describeCardinality('one-to-many', header, pages)).toBe(
      'The Header references many Pages.',
    );
    expect(describeCardinality('one-to-one', header, pages)).toBe(
      'The Header references one Page.',
    );
  });

  it('reads each cardinality as a sentence from the referencing side', () => {
    expect(describeCardinality('many-to-one', hotels, media)).toBe(
      'Each Hotel references one Media; a Media can be referenced by many Hotels.',
    );
    expect(describeCardinality('many-to-many', hotels, media)).toBe(
      'Each Hotel references many Media; a Media can be referenced by many Hotels.',
    );
    expect(describeCardinality('one-to-one', hotels, media)).toBe(
      'Each Hotel references one Media, and a Media can be referenced by only one Hotel.',
    );
  });
});

describe('changes', () => {
  const table = (id: string): SchemaEntity => ({
    id,
    kind: 'collection',
    slug: id.split(':')[1],
    label: id,
    singular: id,
    fields: [{ name: 'id', type: 'id', required: true }],
  });

  it('marks a line by its relations: all added or deleted, or changed when they differ', () => {
    const [mixed] = erdEdges([
      { ...rel('collection:pages', 'layout', 'collection:media'), change: 'added' },
      { ...rel('collection:pages', 'layout', 'collection:media'), path: 'layout[b].media' },
    ]);
    expect(mixed.change).toBe('changed');
    const [deleted] = erdEdges([
      { ...rel('collection:pages', 'hero', 'collection:media'), change: 'deleted' },
    ]);
    expect(deleted.change).toBe('deleted');
  });

  it('keeps changed rows in a cut-down table', () => {
    const fields = Array.from({ length: ROW_LIMIT + 5 }, (_, i) => ({
      name: `f${i}`,
      type: 'text',
      ...(i === ROW_LIMIT + 4 && { change: 'added' as const }),
    }));
    const entity = { ...table('collection:pages'), fields };
    const { rows } = visibleRows(entity, [], { keysOnly: false, expanded: false });
    expect(rows).toHaveLength(ROW_LIMIT);
    expect(rows.at(-1)?.name).toBe(`f${ROW_LIMIT + 4}`);
  });

  it('shows the tables that changed and the ones that reference them', () => {
    const shown = changedTables({
      entities: [
        { ...table('collection:media'), change: 'changed' },
        table('collection:pages'),
        table('collection:users'),
      ],
      relations: [rel('collection:pages', 'hero', 'collection:media')],
    });
    expect([...shown].sort()).toEqual(['collection:media', 'collection:pages']);
  });
});
