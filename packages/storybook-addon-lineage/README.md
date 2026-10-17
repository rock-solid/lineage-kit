# @rock-solid/storybook-addon-lineage

A dbt-style lineage graph of your components in Storybook. Every file in your source folder is a
node and every import an edge, read left to right from what a file is built with to where it is
used.

- **Hover** a node to trace its lineage: everything upstream and downstream lights up.
- **Click** to focus on it. Upstream and Downstream set how many levels each way, shown as a dbt
  selector like `1+Header+2`.
- **Double-click** to open its story.
- **Lineage** in the toolbar opens the graph focused on the current story's component. The focus
  stays in the URL, so a focused view can be shared.
- **Changed since main** (dbt's `state:modified+`) shows the files changed on your branch and
  everything that uses them, with the stories to check.
- **Search** covers every file, including hidden layers.

Works with Storybook 10 on Vite (`@storybook/react-vite`, `@storybook/nextjs-vite`) and React 18 or 19.

## Install

The package is on GitHub Packages for now. Point the `@rock-solid` scope at it in the project's
`.npmrc`:

```ini
@rock-solid:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

`GITHUB_TOKEN` needs `read:packages` (locally, a personal access token; in GitHub Actions, the
workflow token, once the package grants the repository access). Then:

```sh
pnpm add -D @rock-solid/storybook-addon-lineage
```

## Set up

Add it to `.storybook/main.ts`. The options are optional; without them every file in `src` is one
blue layer.

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  addons: [
    '@storybook/addon-docs',
    {
      name: '@rock-solid/storybook-addon-lineage',
      options: {
        layers: [
          {
            id: 'primitive',
            label: 'UI primitives',
            match: /^src\/components\/ui\//,
            color: '#7c3aed',
          },
          { id: 'component', label: 'Components', match: /^src\/components\//, color: '#2563eb' },
          { id: 'page', label: 'Pages', match: /^src\/(app|pages)\//, color: '#be123c' },
          {
            id: 'utility',
            label: 'Utilities',
            match: /^src\/lib\//,
            color: '#475569',
            hidden: true,
          },
        ],
      },
    },
  ],
  // ...
};
```

The addon adds the **Lineage** page to the sidebar and the toolbar button; there's no story file to
write.

### Options

| Option       | Default           |                                                                                                                                                                                                                      |
| ------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `srcDir`     | `'src'`           | Folder to scan, relative to the project root (the folder above `.storybook`)                                                                                                                                         |
| `tsConfig`   | `'tsconfig.json'` | Its `paths` resolve aliases such as `@/`                                                                                                                                                                             |
| `exclude`    | `[]`              | Path patterns (regex source) to leave out, e.g. generated files                                                                                                                                                      |
| `baseBranch` | `'main'`          | Branch that changed files are compared with; `origin/<branch>` is tried first                                                                                                                                        |
| `layers`     | one layer         | `{ id, label, match, color, hidden? }`, matched against paths from the project root, first match wins. `hidden` layers start switched off. Node text is white, so keep each colour at 4.5:1 or better against white. |

## How it works

- The graph is built with [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) when
  Storybook starts (a fraction of a second for a few hundred files), and rebuilt when you save a file
  whose imports changed. Type-only imports aren't edges: they don't render anything.
- A story links to the file its `component` is imported from, so `Grid.stories.tsx` with
  `component: GridBlock` from `./Component` links to `Component.tsx`. A file without a story of its
  own borrows one from its folder ("story via View"); the rest show "no story".
- Changed files are the diff from the merge base with the base branch to the working tree, plus
  untracked files. Without that branch, as in a shallow CI clone, the toggle is off.

## Limits

- Story titles and `component` must be written as literals for a story to link.
- The Lineage page isn't collected by `@storybook/addon-vitest`, which only runs the stories in your
  own `stories` globs, so your story tests don't depend on the addon.
