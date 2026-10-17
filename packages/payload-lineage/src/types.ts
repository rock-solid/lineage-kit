// The content graph, shaped like the Storybook addon's so its page can merge the two.

import type { Payload, TypedUser } from 'payload';

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
  /** Set to `false` to turn the plugin off. Defaults to on. */
  enabled?: boolean;
  /**
   * The graph as a page in the admin, at `/admin/lineage`, with a link in the nav. Logged-in users
   * only, and only the collections and globals they can read. Defaults to on.
   */
  adminView?: boolean;
  /**
   * Who can open the admin pages and see their nav link, on top of the admin's own access rule.
   * Defaults to everyone who can use the admin. E.g. `({ user }) => user.role === 'admin'`.
   */
  access?: LineageAccess;
  /**
   * Where to write the graph as JSON when Payload starts, relative to the working directory, e.g.
   * for the Storybook page to merge. Written outside production only.
   */
  outputFile?: string;
};

export type LineageAccess = (args: {
  payload: Payload;
  user: TypedUser;
}) => boolean | Promise<boolean>;

/** What the plugin keeps in `config.custom.lineage` for the admin pages; server-only, like `custom`. */
export type LineageCustomConfig = {
  graphOptions: ContentGraphOptions;
  access?: LineageAccess;
};
