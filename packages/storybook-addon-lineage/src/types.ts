// Shared between the graph builder (Node, at Storybook start) and the viewer (browser).

export type LayerConfig = {
  id: string;
  label: string;
  /** Matched against the file path from the project root, e.g. `src/components/ui/button.tsx`. First match wins. */
  match: RegExp;
  color: string;
  /** Hidden until switched on in the viewer, for layers that crowd the graph (utilities, config). */
  hidden?: boolean;
};

/** The addon's options, set in `.storybook/main.ts`: `{ name: '@rocksoliddigital/storybook-addon-lineage', options }`. */
export type LineageOptions = {
  /** Folder to scan, relative to the project root (the folder above `.storybook`). Defaults to `src`. */
  srcDir?: string;
  /** Defaults to `tsconfig.json`; its `paths` resolve aliases like `@/`. */
  tsConfig?: string;
  /** Path patterns (regex source) left out of the graph. */
  exclude?: string[];
  /** Branch that changed files are compared with (`origin/<branch>` first). Defaults to `main`. */
  baseBranch?: string;
  /** Node groups and colours, matched top to bottom. Defaults to one layer for everything. */
  layers?: LayerConfig[];
};

export type LineageLayer = Omit<LayerConfig, 'match' | 'hidden'> & { hidden: boolean };

export type LineageNode = {
  /** File path from the project root. */
  id: string;
  label: string;
  layer: string;
  /** Docs page of the story file whose `component` is this file. */
  storyId?: string;
  /**
   * A story in the same folder that covers this file, when it has none of its own: a block's
   * `Component.tsx` fetches the data and its story renders the `View.tsx` beside it.
   */
  storyVia?: { storyId: string; label: string };
  /** Changed since the branch left the base branch: committed, uncommitted or new. */
  changed?: boolean;
};

/** `source` is the dependency, `target` the file that imports it, so the graph reads left to right like dbt's. */
export type LineageEdge = { source: string; target: string };

export type LineageGraph = {
  layers: LineageLayer[];
  nodes: LineageNode[];
  edges: LineageEdge[];
  /** The ref changed files are compared with, or `null` when git has none (e.g. a shallow CI clone). */
  changedSince: string | null;
};
