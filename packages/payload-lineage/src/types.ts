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
   * The Lineage and Data model pages in the admin, at `/admin/lineage` and `/admin/lineage/schema`,
   * with a link in the nav. For users who can use the admin and pass `access`, showing only the
   * collections and globals they can read. Defaults to on.
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
  /**
   * The lineage graph and the data model as JSON, in `dir`, for the pages' "Changed since main"
   * view. Commit the files: on a branch, the pages compare the running config with the base
   * branch's copies, read with git. Written outside production only, when Payload starts and when a
   * page is opened. `true` for the defaults.
   */
  snapshot?: boolean | SnapshotOptions;
};

export type SnapshotOptions = {
  /** Folder for `graph.json` and `schema.json`, relative to the working directory. Defaults to `lineage`. */
  dir?: string;
  /** Branch to compare with (`origin/<branch>` first). Defaults to `main`. */
  baseBranch?: string;
};

export type LineageAccess = (args: {
  payload: Payload;
  user: TypedUser;
}) => boolean | Promise<boolean>;

/** What the plugin keeps in `config.custom.lineage` for the admin pages; server-only, like `custom`. */
export type LineageCustomConfig = {
  graphOptions: ContentGraphOptions;
  access?: LineageAccess;
  snapshot?: { dir: string; baseBranch: string };
};
