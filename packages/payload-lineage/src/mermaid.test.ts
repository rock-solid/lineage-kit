import { describe, expect, it } from 'vitest';

import { contentGraphToMermaid, schemaToMermaid } from './mermaid';
import type { Schema, SchemaEntity, SchemaRelation } from './schema';

describe('contentGraphToMermaid', () => {
  it('draws relationships solid, uploads dashed and blocks thick, labelled with their fields', () => {
    const text = contentGraphToMermaid({
      nodes: [
        { id: 'collection:media', kind: 'collection', slug: 'media', label: 'Media' },
        { id: 'block:hero', kind: 'block', slug: 'hero', label: 'Hero' },
        { id: 'collection:pages', kind: 'collection', slug: 'pages', label: 'Pages' },
      ],
      edges: [
        { source: 'collection:media', target: 'block:hero', kind: 'upload', fields: ['image'] },
        { source: 'block:hero', target: 'collection:pages', kind: 'blocks', fields: ['layout'] },
        {
          source: 'collection:pages',
          target: 'block:hero',
          kind: 'relationship',
          fields: ['link.page', 'cta.page'],
        },
      ],
    });
    expect(text).toContain('n0 -.->|"image"| n1');
    expect(text).toContain('n1 ==>|"layout"| n2');
    expect(text).toContain('n2 -->|"link.page, cta.page"| n1');
    expect(text).toContain('class n0,n2 g0');
  });
});

const entity = (kind: 'collection' | 'global', slug: string, fields: SchemaEntity['fields']) =>
  ({ id: `${kind}:${slug}`, kind, slug, label: slug, singular: slug, fields }) as SchemaEntity;
const rel = (from: string, field: string, to: string, extra: Partial<SchemaRelation> = {}) => ({
  from,
  field,
  path: field,
  to,
  kind: 'relationship' as const,
  many: false,
  polymorphic: false,
  unique: false,
  ...extra,
});

describe('schemaToMermaid', () => {
  const schema: Schema = {
    entities: [
      entity('collection', 'pages', [
        { name: 'id', type: 'id', required: true },
        { name: 'hero.image', type: 'upload', required: true, relationTo: ['media'] },
        { name: 'layout', type: 'blocks', blocks: ['cta', 'mediaBlock'] },
        { name: 'parent', type: 'relationship', relationTo: ['pages'] },
        { name: 'tags', type: 'relationship', hasMany: true, relationTo: ['media'] },
      ]),
      entity('collection', 'media', [{ name: 'id', type: 'id', required: true }]),
      entity('collection', 'form-submissions', [{ name: 'id', type: 'id' }]),
      entity('global', 'header', [{ name: 'nav[]', type: 'array' }]),
    ],
    relations: [
      rel('collection:pages', 'hero.image', 'collection:media', { kind: 'upload' }),
      rel('collection:pages', 'layout', 'collection:media', {
        many: true,
        path: 'layout[mediaBlock].media',
      }),
      rel('collection:pages', 'parent', 'collection:pages'),
      rel('collection:pages', 'tags', 'collection:media', { many: true }),
      rel('global:header', 'nav[]', 'collection:pages', { many: true }),
      rel('collection:form-submissions', 'id', 'collection:media', { unique: true }),
    ],
  };
  const text = schemaToMermaid(schema);

  it('writes each table with its fields, keys and the original path when the name had to change', () => {
    expect(text).toContain('  pages["pages"] {');
    expect(text).toContain('    id id PK "required"');
    expect(text).toContain('    upload hero_image FK "hero.image, required, → media"');
    expect(text).toContain('    blocks layout FK "blocks: cta, mediaBlock"');
    expect(text).toContain('    relationship[] tags FK "→ media"');
    expect(text).toContain('  global_header["header"] {');
    expect(text).toContain('    array nav[] FK');
    expect(text).toContain('  form-submissions["form-submissions"] {');
  });

  it('draws each reference with crow’s feet for its cardinality', () => {
    expect(text).toContain('  pages }o--|| media : "hero.image"');
    expect(text).toContain('  pages }o--o{ media : "layout[mediaBlock].media"');
    expect(text).toContain('  pages }o--o| pages : "parent"');
    expect(text).toContain('  pages }o--o{ media : "tags"');
    expect(text).toContain('  global_header |o--o{ pages : "nav[]"');
    expect(text).toContain('  form-submissions |o--o| media : "id"');
  });

  it('keeps a collection and a global with the same slug apart', () => {
    const both = schemaToMermaid({
      entities: [entity('collection', 'header', []), entity('global', 'header', [])],
      relations: [],
    });
    expect(both).toContain('  header["header"] {');
    expect(both).toContain('  global_header["header"] {');
  });

  it('labels a row’s line with every full path it stands for', () => {
    const nested = schemaToMermaid({
      entities: [
        entity('collection', 'pages', [{ name: 'layout', type: 'blocks' }]),
        entity('collection', 'media', []),
      ],
      relations: [
        rel('collection:pages', 'layout', 'collection:media', {
          many: true,
          path: 'layout[hero].image',
        }),
        rel('collection:pages', 'layout', 'collection:media', {
          many: true,
          path: 'layout[gallery].images[].image',
        }),
        rel('collection:pages', 'layout', 'collection:media', {
          many: true,
          path: 'layout[hero].image',
        }),
      ],
    });
    expect(nested).toContain(
      '  pages }o--o{ media : "layout[hero].image, layout[gallery].images[].image"',
    );
  });

  it('keeps a required polymorphic reference optional for each of its collections', () => {
    const either = schemaToMermaid({
      entities: [
        entity('collection', 'links', [
          { name: 'to', type: 'relationship', required: true, relationTo: ['pages', 'media'] },
        ]),
        entity('collection', 'pages', []),
        entity('collection', 'media', []),
      ],
      relations: [
        rel('collection:links', 'to', 'collection:pages', { polymorphic: true }),
        rel('collection:links', 'to', 'collection:media', { polymorphic: true }),
      ],
    });
    expect(either).toContain('  links }o--o| pages : "to"');
    expect(either).toContain('  links }o--o| media : "to"');
  });

  it('marks a global as referencing each target at most once, single or list', () => {
    const globals = schemaToMermaid({
      entities: [
        entity('global', 'footer', [{ name: 'logo', type: 'upload', relationTo: ['media'] }]),
        entity('collection', 'media', []),
      ],
      relations: [rel('global:footer', 'logo', 'collection:media', { kind: 'upload' })],
    });
    expect(globals).toContain('  global_footer |o--o| media : "logo"');
  });
});
