# @rock-solid/storybook-addon-lineage

The Storybook addon: a Lineage page with the import graph of a project's files. Users' docs:
[README.md](README.md).

- `src/graph.ts` builds the graph with dependency-cruiser, and finds changed files with git.
  `src/vite-plugin.ts` serves it as `virtual:lineage-graph` and rebuilds it on source changes.
  `src/preset.ts` wires both into Storybook and adds the page's story; `src/manager.tsx` is the
  toolbar button; `src/LineageGraph.tsx` the viewer.
- `tsconfig.json` sets `jsx: "react"` (`React.createElement`) on purpose: tsup would bundle
  `react/jsx-runtime` into the manager, where it doesn't match the React Storybook's UI runs on.
- tsup copies `src/stories` and `lineage.css` as they are: Storybook's indexer needs the story's
  literal `export default`, and the consumer's Vite loads the CSS.
- The viewer's tests are stories with play functions in
  `examples/react/src/lineage.test.stories.tsx`, run in a browser by `pnpm test`; add one for any
  viewer behaviour you change. `pnpm dev` runs that example Storybook.
- Focus keys in the URL are story ids, or for files without a story an encoded path
  (`encodePath`), so the URL keeps any file's focus; see the stories that cover them.
