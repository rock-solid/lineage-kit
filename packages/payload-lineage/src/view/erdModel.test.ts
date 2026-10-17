import { describe, expect, it } from 'vitest';

import type { SchemaEntity, SchemaRelation } from '../schema';
import {
  erdEdges,
  erdLayoutInput,
  ROW_LIMIT,
  schemaForViewer,
  selfReferences,
  tableHeight,
  visibleRows,
} from './erdModel';

const rel = (from: string, field: string, to: string, many = false): SchemaRelation => ({
  from,
  field,
  path: field,
  to,
  kind: 'upload',
  many,
  polymorphic: false,
});

const relations = [
  rel('collection:pages', 'layout', 'collection:media', true),
  rel('collection:pages', 'layout', 'collection:media'),
  rel('collection:pages', 'hero.media', 'collection:media'),
  rel('collection:pages', 'parent', 'collection:pages'),
];

describe('erdEdges', () => {
  const edges = erdEdges(relations);

  it('merges relations from one row to one collection into one line, N:M if any holds many', () => {
    expect(edges.find((e) => e.field === 'layout')).toMatchObject({
      cardinality: 'N:M',
      relations: [{}, {}],
    });
    expect(edges.find((e) => e.field === 'hero.media')).toMatchObject({ cardinality: 'N:1' });
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
    const input = erdLayoutInput([{ id: 'collection:pages', height: 120 }], erdEdges(relations));
    expect(input.children[0]).toMatchObject({ height: 120 });
    expect(input.edges.map((e) => e.sources[0] + '>' + e.targets[0])).toEqual([
      'collection:pages>collection:media',
      'collection:pages>collection:media',
    ]);
  });

  it('drops tables the viewer can’t read, with their relations', () => {
    const schema = {
      entities: [
        { id: 'collection:pages', kind: 'collection', slug: 'pages', label: 'Pages', fields: [] },
        { id: 'collection:media', kind: 'collection', slug: 'media', label: 'Media', fields: [] },
      ] as SchemaEntity[],
      relations,
    };
    const visible = schemaForViewer(schema, (e) => e.slug !== 'media');
    expect(visible.entities.map((e) => e.id)).toEqual(['collection:pages']);
    expect(visible.relations).toEqual([rel('collection:pages', 'parent', 'collection:pages')]);
  });
});
