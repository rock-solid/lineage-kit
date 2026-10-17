// What the ERD shows of a schema, kept free of React so it can be tested on its own.

import type { Schema, SchemaEntity, SchemaField, SchemaRelation } from '../schema';

export const TABLE_WIDTH = 260;
export const HEADER_HEIGHT = 44;
export const ROW_HEIGHT = 24;
export const FOOTER_HEIGHT = 26;
/** Rows a table shows before "+N more"; rows with relations always show. */
export const ROW_LIMIT = 10;

/**
 * From the referencing table's side: `many-to-one` for a single reference (many hotels can share
 * one image), `many-to-many` for a list of them, `one-to-one` for a single `unique` reference. A
 * global is one document, so its side is always one: `one-to-one` or `one-to-many`.
 */
export type Cardinality = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

/** One line on the diagram: every relation from one row to one collection. */
export type ErdEdge = {
  id: string;
  from: string;
  field: string;
  to: string;
  /** The loosest of its relations: any list makes it many-to-many. */
  cardinality: Cardinality;
  relations: SchemaRelation[];
};

export function cardinalityOf(relation: SchemaRelation): Cardinality {
  if (relation.from.startsWith('global:')) return relation.many ? 'one-to-many' : 'one-to-one';
  if (relation.many) return 'many-to-many';
  return relation.unique ? 'one-to-one' : 'many-to-one';
}

// How many each side can hold, loosest last; one line takes the loosest of its relations
const LOOSENESS: Cardinality[] = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'];

/**
 * The line read as a sentence, e.g. "Each Hotel references one Media; a Media can be referenced by
 * many Hotels".
 */
export function describeCardinality(
  cardinality: Cardinality,
  from: { kind: string; label: string; singular: string },
  to: { label: string; singular: string },
) {
  // A global is the one document of its kind
  if (from.kind === 'global') {
    return cardinality === 'one-to-many'
      ? `The ${from.label} references many ${to.label}.`
      : `The ${from.label} references one ${to.singular}.`;
  }
  if (cardinality === 'one-to-one') {
    return `Each ${from.singular} references one ${to.singular}, and a ${to.singular} can be referenced by only one ${from.singular}.`;
  }
  if (cardinality === 'many-to-one') {
    return `Each ${from.singular} references one ${to.singular}; a ${to.singular} can be referenced by many ${from.label}.`;
  }
  return `Each ${from.singular} references many ${to.label}; a ${to.singular} can be referenced by many ${from.label}.`;
}

export function erdEdges(relations: readonly SchemaRelation[]): ErdEdge[] {
  const edges = new Map<string, ErdEdge>();
  for (const r of relations) {
    // A table pointing at itself is marked on the row, not drawn as a loop
    if (r.from === r.to) continue;
    const id = `${r.from}.${r.field}->${r.to}`;
    const edge = edges.get(id) ?? {
      id,
      from: r.from,
      field: r.field,
      to: r.to,
      cardinality: cardinalityOf(r),
      relations: [],
    };
    edge.relations.push(r);
    const own = cardinalityOf(r);
    if (LOOSENESS.indexOf(own) > LOOSENESS.indexOf(edge.cardinality)) edge.cardinality = own;
    edges.set(id, edge);
  }
  return [...edges.values()];
}

/** The rows of a row-holding entity that point back at it, e.g. nested docs' `parent`. */
export function selfReferences(entity: SchemaEntity, relations: readonly SchemaRelation[]) {
  return new Set(
    relations.filter((r) => r.from === entity.id && r.to === entity.id).map((r) => r.field),
  );
}

export type RowFilter = { keysOnly: boolean; expanded: boolean };

/**
 * The rows a table shows: with `keysOnly`, the id and the rows with relations; otherwise every row,
 * cut to `ROW_LIMIT` unless expanded, keeping the rows with relations either way.
 */
export function visibleRows(
  entity: SchemaEntity,
  relations: readonly SchemaRelation[],
  { keysOnly, expanded }: RowFilter,
): { rows: SchemaField[]; hidden: number } {
  const linked = new Set(relations.filter((r) => r.from === entity.id).map((r) => r.field));
  const isKey = (f: SchemaField) => f.type === 'id' || linked.has(f.name) || f.type === 'join';
  if (keysOnly) {
    const rows = entity.fields.filter(isKey);
    return { rows, hidden: entity.fields.length - rows.length };
  }
  if (expanded || entity.fields.length <= ROW_LIMIT) return { rows: entity.fields, hidden: 0 };
  const keys = entity.fields.filter(isKey).length;
  let budget = Math.max(ROW_LIMIT - keys, 0);
  const rows = entity.fields.filter((f) => isKey(f) || budget-- > 0);
  return { rows, hidden: entity.fields.length - rows.length };
}

export function tableHeight(rows: number, hidden: number) {
  return HEADER_HEIGHT + rows * ROW_HEIGHT + (hidden ? FOOTER_HEIGHT : 0) + 4;
}

/** The ELK graph: tables sized to their rows, referencing tables on the left. */
export function erdLayoutInput(
  tables: { id: string; height: number }[],
  edges: readonly ErdEdge[],
) {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.spacing.nodeNode': '28',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: tables.map((t) => ({ id: t.id, width: TABLE_WIDTH, height: t.height })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
  };
}

/** Collections and globals the viewer can't read leave the schema, with every relation to or from them. */
export function schemaForViewer(
  schema: Schema,
  canRead: (entity: SchemaEntity) => boolean,
): Schema {
  const entities = schema.entities.filter(canRead);
  const ids = new Set(entities.map((e) => e.id));
  return {
    entities,
    relations: schema.relations.filter((r) => ids.has(r.from) && ids.has(r.to)),
  };
}
