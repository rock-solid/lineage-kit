import { escapeLabel, toMermaidFlowchart } from '@rocksoliddigital/lineage-core';

import type { Schema, SchemaEntity, SchemaField, SchemaRelation } from './schema';
import type { ContentEdge, ContentGraph, ContentKind } from './types';

// The two pages as Mermaid, for pasting into a PR, a doc or a ticket: the lineage as a flowchart,
// the data model as an erDiagram.

/** The admin's light-theme colours for each kind. */
const KIND_COLORS: Record<ContentKind, string> = {
  collection: '#0f7c74',
  block: '#b4630c',
  global: '#6b4bb8',
};
// Relationships solid, uploads dashed, blocks fields thick, as on the Lineage page
const EDGE_STYLE = { relationship: 'solid', upload: 'dashed', blocks: 'thick' } as const;

/** The lineage graph as a left-to-right flowchart, each link labelled with its fields. */
export function contentGraphToMermaid(graph: ContentGraph): string {
  return toMermaidFlowchart({
    nodes: graph.nodes.map((n) => ({ id: n.id, label: n.label, group: n.kind })),
    edges: graph.edges.map((e: ContentEdge) => ({
      source: e.source,
      target: e.target,
      label: e.fields.join(', '),
      style: EDGE_STYLE[e.kind],
    })),
    groups: Object.entries(KIND_COLORS).map(([id, color]) => ({ id, color })),
  });
}

/**
 * The data model as an erDiagram: a table per collection and global with its fields, and a line
 * per reference, in crow's-foot notation (`}o--o|` is many-to-one, `}o--o{` many-to-many). Each
 * field and line keeps its full path in its comment or label.
 */
export function schemaToMermaid(schema: Schema): string {
  const names = entityNames(schema.entities);
  const byId = new Map(schema.entities.map((e) => [e.id, e]));
  const lines = ['erDiagram'];

  for (const entity of schema.entities) {
    const keys = new Set(schema.relations.filter((r) => r.from === entity.id).map((r) => r.field));
    lines.push(`  ${names.get(entity.id)}["${escapeLabel(entity.label)}"] {`);
    for (const field of entity.fields) lines.push(`    ${attribute(field, keys.has(field.name))}`);
    lines.push('  }');
  }

  // One line per row and collection, like the Data model page, but keeping a table's references to
  // itself, which Mermaid draws as a loop
  const lineGroups = new Map<string, SchemaRelation[]>();
  for (const r of schema.relations) {
    if (!names.has(r.from) || !names.has(r.to)) continue;
    const key = `${r.from}\n${r.field}\n${r.to}`;
    lineGroups.set(key, [...(lineGroups.get(key) ?? []), r]);
  }
  for (const group of lineGroups.values()) {
    const { from, to, field } = group[0];
    const row = byId.get(from)?.fields.find((f) => f.name === field);
    lines.push(
      `  ${names.get(from)} ${crowsFoot(group, from, !!row?.required)} ${names.get(to)} : "${escapeLabel(field)}"`,
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Mermaid entity names from slugs: letters, digits, `-` and `_` only, globals prefixed so a
 * collection and a global can share a slug, and a number added if two still clash.
 */
function entityNames(entities: readonly SchemaEntity[]) {
  const names = new Map<string, string>();
  const taken = new Set<string>();
  for (const e of entities) {
    const base = `${e.kind === 'global' ? 'global_' : ''}${e.slug}`.replace(/[^A-Za-z0-9_-]/g, '_');
    let name = /^[A-Za-z]/.test(base) ? base : `e_${base}`;
    for (let i = 2; taken.has(name); i++) name = `${base}_${i}`;
    taken.add(name);
    names.set(e.id, name);
  }
  return names;
}

/** `type name KEY "comment"`, with the name cut down to the characters Mermaid documents. */
function attribute(field: SchemaField, isReference: boolean) {
  const type = `${safeWord(field.type)}${field.hasMany ? '[]' : ''}`;
  const name = safeWord(field.name);
  const key = field.type === 'id' || field.name === 'id' ? ' PK' : isReference ? ' FK' : '';
  const notes = [
    ...(name !== field.name ? [field.name] : []),
    ...(field.required ? ['required'] : []),
    ...(field.unique ? ['unique'] : []),
    ...(field.relationTo ? [`→ ${field.relationTo.join(' | ')}`] : []),
    ...(field.blocks ? [`blocks: ${field.blocks.join(', ')}`] : []),
  ];
  const comment = notes.length ? ` "${escapeLabel(notes.join(', '))}"` : '';
  return `${type} ${name}${key}${comment}`;
}

function safeWord(text: string) {
  const word = text.replace(/[^A-Za-z0-9_\-[\]()]/g, '_');
  return /^[A-Za-z]/.test(word) ? word : `f_${word}`;
}

/**
 * Crow's feet from the referencing side: a list is many (`o{`), a single reference one (`o|`, or
 * `||` when required). A global is one document (`||`); a unique reference lets each target be
 * referenced once (`|o`); otherwise many documents can share it (`}o`).
 */
function crowsFoot(relations: readonly SchemaRelation[], from: string, required: boolean) {
  const many = relations.some((r) => r.many);
  const fromSide = from.startsWith('global:')
    ? '||'
    : relations.every((r) => r.unique) && !many
      ? '|o'
      : '}o';
  const toSide = many ? 'o{' : required ? '||' : 'o|';
  return `${fromSide}--${toSide}`;
}
