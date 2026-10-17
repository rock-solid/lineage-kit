// The content graph, shaped like the Storybook addon's so its page can merge the two.

export type ContentKind = 'collection' | 'global' | 'block';

export type ContentNode = {
  /** `<kind>:<slug>`, e.g. `collection:pages` or `block:hero`. */
  id: string;
  kind: ContentKind;
  slug: string;
  label: string;
};

/** What makes one node depend on another. */
export type ContentEdgeKind = 'relationship' | 'upload' | 'blocks';

/**
 * `source` is the dependency, `target` the collection, global or block whose fields point at it,
 * so the graph reads left to right like the Storybook addon's: `media` → `pages`.
 */
export type ContentEdge = {
  source: string;
  target: string;
  kind: ContentEdgeKind;
  /** Dotted paths of the fields that make the link, e.g. `layout` or `hero.image`. */
  fields: string[];
};

export type ContentGraph = {
  nodes: ContentNode[];
  edges: ContentEdge[];
};

export type ContentGraphOptions = {
  /**
   * Left out of the graph, with their edges. A slug leaves out every collection, global and block
   * with it; `<kind>:<slug>`, e.g. `block:text`, only that one. Payload's own collections
   * (`payload-preferences`, `payload-migrations`, ...) are always left out.
   */
  exclude?: string[];
};

export type LineagePluginOptions = ContentGraphOptions & {
  /** Where to write the graph as JSON when Payload starts, relative to the working directory. */
  outputFile?: string;
  /** Defaults to on outside production, so the graph doesn't slow a production start. */
  enabled?: boolean;
};
