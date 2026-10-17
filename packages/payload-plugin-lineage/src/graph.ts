import type {
  ContentEdge,
  ContentGraph,
  ContentGraphOptions,
  ContentKind,
  ContentNode,
} from './types';

// Structural types for the parts of a Payload config the graph reads, so a raw `Config` and a
// `SanitizedConfig` both fit, across Payload 3 minors.
type Labels = { singular?: unknown; plural?: unknown };
type BlockLike = { slug: string; labels?: Labels; fields: FieldLike[] };
type FieldLike = {
  type: string;
  name?: string;
  fields?: FieldLike[];
  tabs?: { name?: string; fields: FieldLike[] }[];
  blocks?: BlockLike[];
  /** Payload 3.x: blocks defined once in `config.blocks`, referenced by slug. */
  blockReferences?: (string | BlockLike)[];
  relationTo?: string | string[];
};
type EntityLike = { slug: string; label?: unknown; labels?: Labels; fields: FieldLike[] };
export type PayloadConfigLike = {
  collections?: EntityLike[];
  globals?: EntityLike[];
  blocks?: BlockLike[];
};

// Payload adds these to every sanitized config
const INTERNAL_SLUG = /^payload-/;

/** Builds the graph of a Payload config's collections, globals and blocks, and the fields that link them. */
export function buildContentGraph(
  config: PayloadConfigLike,
  { exclude = [] }: ContentGraphOptions = {},
): ContentGraph {
  const excluded = (kind: ContentKind, slug: string) =>
    INTERNAL_SLUG.test(slug) || exclude.includes(slug) || exclude.includes(`${kind}:${slug}`);
  const collections = (config.collections ?? []).filter((c) => !excluded('collection', c.slug));
  const globals = (config.globals ?? []).filter((g) => !excluded('global', g.slug));
  const sharedBlocks = new Map((config.blocks ?? []).map((b) => [b.slug, b]));

  const nodes = new Map<string, ContentNode>();
  const addNode = (kind: ContentKind, slug: string, label: string) => {
    const id = `${kind}:${slug}`;
    if (!nodes.has(id)) nodes.set(id, { id, kind, slug, label });
    return id;
  };
  for (const c of collections) addNode('collection', c.slug, labelOf(c, c.labels?.plural));
  for (const g of globals) addNode('global', g.slug, labelOf(g, g.label));
  const collectionIds = new Set(collections.map((c) => `collection:${c.slug}`));

  const edges = new Map<string, ContentEdge>();
  const addEdge = (source: string, target: string, kind: ContentEdge['kind'], field: string) => {
    const key = `${source}→${target}→${kind}`;
    const edge = edges.get(key) ?? { source, target, kind, fields: [] };
    if (!edge.fields.includes(field)) edge.fields.push(field);
    edges.set(key, edge);
  };

  // Each block is walked once, however many fields use it
  const walkedBlocks = new Set<string>();
  const walkBlock = (block: BlockLike) => {
    const id = addNode('block', block.slug, labelOf(block, block.labels?.singular));
    if (walkedBlocks.has(id)) return id;
    walkedBlocks.add(id);
    walkFields(block.fields, id, []);
    return id;
  };

  const walkFields = (fields: FieldLike[], owner: string, path: string[]) => {
    for (const field of fields) {
      // Rows, collapsibles and unnamed tabs only lay fields out, so they add no path segment
      const fieldPath = field.name ? [...path, field.name] : path;
      const dotted = fieldPath.join('.');

      if (field.type === 'relationship' || field.type === 'upload') {
        for (const slug of toArray(field.relationTo)) {
          const source = `collection:${slug}`;
          // Excluded and internal collections stay out, along with the edges to them
          if (collectionIds.has(source)) addEdge(source, owner, field.type, dotted);
        }
      }
      if (field.type === 'blocks') {
        const blocks = [
          ...(field.blocks ?? []),
          ...(field.blockReferences ?? []).map((b) =>
            typeof b === 'string' ? sharedBlocks.get(b) : b,
          ),
        ];
        for (const block of blocks) {
          // An excluded block is left out with its fields, so nothing it links to is reached through it
          if (block && !excluded('block', block.slug)) {
            addEdge(walkBlock(block), owner, 'blocks', dotted);
          }
        }
      }
      // A join field is the reverse of a relationship that is already an edge, so it is skipped
      if (field.fields) walkFields(field.fields, owner, fieldPath);
      for (const tab of field.tabs ?? []) {
        walkFields(tab.fields, owner, tab.name ? [...fieldPath, tab.name] : fieldPath);
      }
    }
  };

  for (const c of collections) walkFields(c.fields, `collection:${c.slug}`, []);
  for (const g of globals) walkFields(g.fields, `global:${g.slug}`, []);

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/** The label if it is plain text; labels can also be per-locale objects or functions. */
function labelOf(entity: { slug: string }, label: unknown): string {
  return typeof label === 'string' ? label : entity.slug;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
