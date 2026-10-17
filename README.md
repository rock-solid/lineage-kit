# lineage-kit

dbt-style lineage for UI components and CMS content: what each piece is built with, where it is
used, and what a change affects.

| Package                                                                   |                                                                              |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`@rock-solid/storybook-addon-lineage`](packages/storybook-addon-lineage) | The lineage graph of your components, as a page in Storybook                 |
| `@rock-solid/payload-plugin-lineage`                                      | Next: collections, blocks and the pages that use them, from a Payload config |

## Develop

Node 22 or later and pnpm (the version in `packageManager`).

```sh
pnpm install
pnpm dev           # builds the package in watch mode and starts the example Storybook on :6006
pnpm test          # the example's stories as tests in Chromium, including the Lineage tests
pnpm lint && pnpm typecheck && pnpm format:check
```

The first test run needs a browser: `pnpm --filter example exec playwright install chromium`.

- `packages/storybook-addon-lineage`: the addon. `src/graph.ts` builds the graph, `src/vite-plugin.ts`
  serves it to the viewer, `src/preset.ts` wires both into Storybook, `src/manager.tsx` is the toolbar
  button and `src/LineageGraph.tsx` the viewer.
- `examples/react`: a small Storybook that installs the addon from the workspace. Its
  `src/lineage.test.stories.tsx` tests the viewer on fixture graphs.

## Release

Bump the version in the package's `package.json`, merge, then tag it:

```sh
git tag storybook-addon-lineage@0.1.0
git push --tags
```

The Release workflow checks the tag matches the version and publishes to GitHub Packages.

## License

MIT
