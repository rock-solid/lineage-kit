// What changed between two lineage graphs or data models: the base branch's snapshot and the
// running config. Deleted nodes, links, tables, fields and references stay in the result, marked
// as such, so the pages can show what they connected.

import type { Schema, SchemaEntity, SchemaField, SchemaRelation } from './schema';
import type { ContentEdge, ContentGraph, ContentNode } from './types';

export type Change = 'added' | 'changed' | 'deleted';
export type WithChange<T> = T & { change?: Change };

/**
 * Whether the pages can show what changed: `ready` to compare with `base`; `no-snapshot` when the
 * base branch has no snapshot yet; `invalid` when its file isn't JSON; `no-base` without git or the
 * branch. Left out when the plugin's
 * `snapshot` is off, or in production.
 */
export type ChangesStatus =
  | { state: 'ready'; base: string }
  | { state: 'no-snapshot'; base: string }
  | { state: 'invalid'; base: string }
  | { state: 'no-base'; branch: string };

export type DiffedGraph = {
  nodes: WithChange<ContentNode>[];
  edges: WithChange<ContentEdge>[];
};

/** A field of a table, with what it was on the base branch when it changed. */
export type DiffedField = WithChange<SchemaField> & { before?: SchemaField };

export type DiffedEntity = Omit<SchemaEntity, 'fields'> & {
  change?: Change;
  fields: DiffedField[];
};

export type DiffedSchema = {
  entities: DiffedEntity[];
  relations: WithChange<SchemaRelation>[];
};

export function edgeKey(edge: Pick<ContentEdge, 'source' | 'target' | 'kind'>) {
  return `${edge.source}->${edge.target}:${edge.kind}`;
}

/**
 * The current graph with what changed since `base`. A node is changed when its label or the links
 * its fields make (the links into it) are; deleted nodes and links come after the current ones.
 */
export function diffGraph(base: ContentGraph, current: ContentGraph): DiffedGraph {
  const baseNodes = new Map(base.nodes.map((n) => [n.id, n]));
  const baseEdges = new Map(base.edges.map((e) => [edgeKey(e), e]));
  const currentIds = new Set(current.nodes.map((n) => n.id));
  const currentEdges = new Set(current.edges.map(edgeKey));

  const edges: WithChange<ContentEdge>[] = current.edges.map((edge) => {
    const was = baseEdges.get(edgeKey(edge));
    if (!was) return { ...edge, change: 'added' };
    return sameList(was.fields, edge.fields) ? edge : { ...edge, change: 'changed' };
  });
  for (const [key, edge] of baseEdges) {
    if (!currentEdges.has(key)) edges.push({ ...edge, change: 'deleted' });
  }

  // A node's links are what its own fields point at, so a link that changed changes its target
  const relinked = new Set(edges.filter((e) => e.change).map((e) => e.target));
  const nodes: WithChange<ContentNode>[] = current.nodes.map((node) => {
    const was = baseNodes.get(node.id);
    if (!was) return { ...node, change: 'added' };
    return was.label !== node.label || relinked.has(node.id)
      ? { ...node, change: 'changed' }
      : node;
  });
  for (const node of base.nodes) {
    if (!currentIds.has(node.id)) nodes.push({ ...node, change: 'deleted' });
  }
  return { nodes, edges };
}

/**
 * The base branch's graph, aligned with what the running config filters out (`exclude`, and the
 * blocks only an excluded collection or block reaches). `unfiltered` is the running config built
 * with nothing excluded: whatever is in it still exists, so it's left out of the base rather than
 * coming back as deleted, past the read checks deleted items skip. Only what's in neither is gone.
 */
export function alignGraph(
  base: ContentGraph,
  unfiltered: ContentGraph,
  current: ContentGraph,
): ContentGraph {
  return {
    nodes: align(base.nodes, unfiltered.nodes, current.nodes, (n) => n.id),
    edges: align(base.edges, unfiltered.edges, current.edges, edgeKey),
  };
}

/**
 * The base branch's data model, aligned the same way. `unfiltered` is the running config built
 * with nothing excluded and hidden fields kept, so a table that's excluded now, a field that's
 * hidden now, and a reference inside an excluded block are filtered, not deleted.
 */
export function alignSchema(base: Schema, unfiltered: Schema, current: Schema): Schema {
  const unfilteredById = new Map(unfiltered.entities.map((e) => [e.id, e]));
  const currentById = new Map(current.entities.map((e) => [e.id, e]));
  const entities = align(base.entities, unfiltered.entities, current.entities, (e) => e.id).map(
    (entity) => {
      const now = currentById.get(entity.id);
      const all = unfilteredById.get(entity.id);
      if (!now || !all) return entity;
      return { ...entity, fields: align(entity.fields, all.fields, now.fields, (f) => f.name) };
    },
  );
  return {
    entities,
    relations: align(base.relations, unfiltered.relations, current.relations, relationKey),
  };
}

/**
 * Each base item: dropped when the running config has it but filters it out; the current item when
 * it differs from the base only by that filtering (a blocks field without an excluded block);
 * otherwise as it was, for the diff to compare.
 */
function align<T>(base: T[], unfiltered: T[], current: T[], key: (item: T) => string): T[] {
  const all = new Map(unfiltered.map((item) => [key(item), item]));
  const shown = new Map(current.map((item) => [key(item), item]));
  return base.flatMap((item) => {
    const k = key(item);
    const exists = all.get(k);
    const now = shown.get(k);
    if (!now) return exists ? [] : [item];
    return exists && sameValue(item, exists) ? [now] : [item];
  });
}

export function relationKey(r: Pick<SchemaRelation, 'from' | 'path' | 'to'>) {
  return `${r.from}|${r.path}->${r.to}`;
}

/**
 * The current data model with what changed since `base`: tables added or deleted, and in each table
 * the fields added, deleted or changed (type, required, what they reference, ...). A deleted field
 * keeps its place among the fields around it.
 */
export function diffSchema(base: Schema, current: Schema): DiffedSchema {
  const baseEntities = new Map(base.entities.map((e) => [e.id, e]));
  const currentIds = new Set(current.entities.map((e) => e.id));

  const entities: DiffedEntity[] = current.entities.map((entity) => {
    const was = baseEntities.get(entity.id);
    if (!was) return { ...entity, change: 'added' };
    const fields = diffFields(was.fields, entity.fields);
    // The table's own settings (label, auth, upload), then its fields
    const changed =
      !sameValue({ ...was, fields: [] }, { ...entity, fields: [] }) || fields.some((f) => f.change);
    return { ...entity, fields, ...(changed && { change: 'changed' as const }) };
  });
  for (const entity of base.entities) {
    if (!currentIds.has(entity.id)) entities.push({ ...entity, change: 'deleted' });
  }

  const baseRelations = new Map(base.relations.map((r) => [relationKey(r), r]));
  const currentRelations = new Set(current.relations.map(relationKey));
  const relations: WithChange<SchemaRelation>[] = current.relations.map((relation) => {
    const was = baseRelations.get(relationKey(relation));
    if (!was) return { ...relation, change: 'added' };
    return sameValue(was, relation) ? relation : { ...relation, change: 'changed' };
  });
  for (const [key, relation] of baseRelations) {
    if (!currentRelations.has(key)) relations.push({ ...relation, change: 'deleted' });
  }

  // A reference can change while its row doesn't, e.g. a field inside a block pointing somewhere
  // else; the row it belongs to, and its table, changed all the same
  const relinked = new Map<string, Set<string>>();
  for (const r of relations) {
    if (!r.change) continue;
    const rows = relinked.get(r.from) ?? new Set<string>();
    rows.add(r.field);
    relinked.set(r.from, rows);
  }
  const marked = entities.map((entity) => {
    const rows = relinked.get(entity.id);
    if (!rows || entity.change === 'added' || entity.change === 'deleted') return entity;
    return {
      ...entity,
      change: 'changed' as const,
      fields: entity.fields.map((f) =>
        rows.has(f.name) && !f.change ? { ...f, change: 'changed' as const } : f,
      ),
    };
  });
  return { entities: marked, relations };
}

function diffFields(before: SchemaField[], after: SchemaField[]): DiffedField[] {
  const old = new Map(before.map((f) => [f.name, f]));
  const fields: DiffedField[] = after.map((field) => {
    const was = old.get(field.name);
    if (!was) return { ...field, change: 'added' };
    return sameValue(was, field) ? field : { ...field, change: 'changed', before: was };
  });
  // Each deleted field goes after the field that came before it on the base branch
  let previous = -1;
  for (const field of before) {
    const at = fields.findIndex((f) => f.name === field.name);
    if (at >= 0) {
      previous = at;
      continue;
    }
    fields.splice(++previous, 0, { ...field, change: 'deleted' });
  }
  return fields;
}

function sameList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Equal as JSON, whatever the order of the keys: the files are written with the keys in any order. */
function sameValue(a: unknown, b: unknown) {
  return stable(a) === stable(b);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
