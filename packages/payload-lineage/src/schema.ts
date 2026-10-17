import type { PayloadConfigLike } from './graph';
import type { ContentGraphOptions } from './types';

// The data model of a Payload config, for an ERD: collections and globals as tables of their
// fields, and the relations between them.

export type SchemaField = {
  /** Dotted from the top level; arrays end in `[]`, e.g. `hero.media` or `gallery[]`. */
  name: string;
  type: string;
  required?: boolean;
  /** A relationship, upload, select, text or number field holding a list. */
  hasMany?: boolean;
  localized?: boolean;
  unique?: boolean;
  /** Collections a relationship, upload or join field points at. */
  relationTo?: string[];
  /** Block slugs a blocks field allows. */
  blocks?: string[];
};

export type SchemaEntity = {
  /** `collection:<slug>` or `global:<slug>`, as in the content graph. */
  id: string;
  kind: 'collection' | 'global';
  slug: string;
  label: string;
  /** An auth collection (users) or an upload collection (media). */
  auth?: boolean;
  upload?: boolean;
  fields: SchemaField[];
};

export type SchemaRelation = {
  /** The entity holding the reference. */
  from: string;
  /** The row in `from` it belongs to: the field itself, or the array or blocks field around it. */
  field: string;
  /** The full path of the referencing field, e.g. `layout[mediaBlock].media`. */
  path: string;
  /** The collection referenced. */
  to: string;
  kind: 'relationship' | 'upload';
  /** Many references per document: `hasMany`, or inside an array or blocks field. */
  many: boolean;
  /** The field can point at more than one collection. */
  polymorphic: boolean;
};

export type Schema = { entities: SchemaEntity[]; relations: SchemaRelation[] };

type FieldLike = {
  type: string;
  name?: string;
  /** Never sent over the API, like an auth collection's `salt` and `hash`. */
  hidden?: boolean;
  required?: boolean;
  hasMany?: boolean;
  localized?: boolean;
  unique?: boolean;
  fields?: FieldLike[];
  tabs?: { name?: string; fields: FieldLike[] }[];
  blocks?: { slug: string; fields: FieldLike[] }[];
  blockReferences?: (string | { slug: string; fields: FieldLike[] })[];
  relationTo?: string | string[];
  collection?: string | string[];
};
type EntityLike = {
  slug: string;
  label?: unknown;
  labels?: { plural?: unknown };
  auth?: unknown;
  upload?: unknown;
  fields: FieldLike[];
};
type ConfigLike = {
  collections?: EntityLike[];
  globals?: EntityLike[];
  blocks?: { slug: string; fields: FieldLike[] }[];
};

const INTERNAL_SLUG = /^payload-/;
// Lay fields out without storing anything under their own name
const LAYOUT = new Set(['row', 'collapsible']);

/** Builds the data model of a Payload config: each collection and global with its fields, and the relations between them. */
export function buildSchema(
  config: PayloadConfigLike,
  { exclude = [] }: ContentGraphOptions = {},
): Schema {
  const { collections = [], globals = [], blocks = [] } = config as ConfigLike;
  const excluded = (kind: string, slug: string) =>
    INTERNAL_SLUG.test(slug) || exclude.includes(slug) || exclude.includes(`${kind}:${slug}`);
  const shownCollections = collections.filter((c) => !excluded('collection', c.slug));
  const shownGlobals = globals.filter((g) => !excluded('global', g.slug));
  const targets = new Set(shownCollections.map((c) => c.slug));
  const sharedBlocks = new Map(blocks.map((b) => [b.slug, b]));

  const relations: SchemaRelation[] = [];

  const entity = (kind: 'collection' | 'global', e: EntityLike): SchemaEntity => {
    const id = `${kind}:${e.slug}`;
    const fields: SchemaField[] =
      kind === 'collection' ? [{ name: 'id', type: 'id', required: true }] : [];

    /**
     * `row` is the array or blocks field the walk is inside, if any: nested fields don't get rows of
     * their own, but their relations attach to it.
     */
    const walk = (list: FieldLike[], path: string, row: SchemaField | null, many: boolean) => {
      for (const field of list) {
        // Internal fields and admin-only UI hold nothing a reader of the data model works with
        if (field.type === 'ui' || field.hidden) continue;
        if (LAYOUT.has(field.type) || (field.type === 'group' && !field.name)) {
          walk(field.fields ?? [], path, row, many);
          continue;
        }
        if (field.type === 'tabs') {
          for (const tab of field.tabs ?? []) {
            walk(tab.fields, tab.name ? join(path, tab.name) : path, row, many);
          }
          continue;
        }
        const name = join(path, field.name ?? field.type);
        if (field.type === 'group') {
          walk(field.fields ?? [], name, row, many);
          continue;
        }
        if (field.type === 'array') {
          const own = row ?? add({ name: `${name}[]`, type: 'array', required: field.required });
          walk(field.fields ?? [], `${name}[]`, own, true);
          continue;
        }
        if (field.type === 'blocks') {
          const allowed = [
            ...(field.blocks ?? []),
            ...(field.blockReferences ?? []).map((b) =>
              typeof b === 'string' ? sharedBlocks.get(b) : b,
            ),
          ].filter((b) => b !== undefined);
          const own =
            row ??
            add({
              name,
              type: 'blocks',
              required: field.required,
              blocks: allowed.map((b) => b.slug),
            });
          for (const block of allowed) walk(block.fields, `${name}[${block.slug}]`, own, true);
          continue;
        }

        const own =
          row ??
          add({
            name,
            type: field.type,
            required: field.required,
            hasMany: field.hasMany,
            localized: field.localized,
            unique: field.unique,
            ...((field.relationTo || field.collection) && {
              relationTo: toArray(field.relationTo ?? field.collection),
            }),
          });
        // A join is the reverse of a relationship that is already a relation, so it is only a row
        if (field.type === 'relationship' || field.type === 'upload') {
          const to = toArray(field.relationTo);
          for (const slug of to) {
            if (!targets.has(slug)) continue;
            relations.push({
              from: id,
              field: own.name,
              path: name,
              to: `collection:${slug}`,
              kind: field.type,
              many: many || !!field.hasMany,
              polymorphic: to.length > 1,
            });
          }
        }
      }
    };
    const add = (field: SchemaField) => {
      const clean = Object.fromEntries(
        Object.entries(field).filter(([, v]) => v !== undefined && v !== false),
      ) as SchemaField;
      fields.push(clean);
      return clean;
    };

    walk(e.fields, '', null, false);
    return {
      id,
      kind,
      slug: e.slug,
      label: labelOf(e, kind === 'collection' ? e.labels?.plural : e.label),
      ...(kind === 'collection' && e.auth ? { auth: true } : {}),
      ...(kind === 'collection' && e.upload ? { upload: true } : {}),
      fields,
    };
  };

  const entities = [
    ...shownCollections.map((c) => entity('collection', c)),
    ...shownGlobals.map((g) => entity('global', g)),
  ];
  return { entities, relations };
}

function join(path: string, name: string) {
  return path ? `${path}.${name}` : name;
}

function labelOf(entity: { slug: string }, label: unknown): string {
  return typeof label === 'string' ? label : entity.slug;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
