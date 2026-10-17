# 🧬 @rock-solid/storybook-addon-lineage

A dbt-style lineage graph of your components in Storybook. Every file in your source folder is a
node and every import an edge, read left to right from what a file is built with to where it is
used.

Works with Storybook 10 on Vite (`@storybook/react-vite`, `@storybook/nextjs-vite`) and React 18 or 19.

## ✨ Features

**👀 Explore**

- A **Lineage** page in the sidebar, added by the addon, with no story file to write.
- **Layers** colour the nodes (UI primitives, components, blocks, pages…), set by path in the addon's
  options. Switch any layer on or off; noisy ones, such as utilities, can start hidden.
- **Hover** a node to trace its whole lineage: everything upstream and downstream lights up, the rest
  dims.
- **Search** every file, hidden layers included; picking a result switches its layer on.
- **Hide unconnected files**, counts of files, imports and files without a story, a minimap, and pan
  and zoom.

**🎯 Focus**

- **Click** a node to see only its lineage, with **Upstream** and **Downstream** levels (None, +1,
  +2, +3, All), shown as a dbt selector such as `1+Header+2`.
- **Double-click**, or **Open story**, to go to its docs page. Nodes show whether they have a story,
  borrow one from their folder ("story via View"), or have none.

**🔗 Links**

- **Lineage** in the Storybook toolbar, on every story and docs page, opens the graph focused on that
  component.
- **The URL keeps the view:** focus and depths are saved however they change (a click, the graph's
  panel, the Controls panel) and survive a reload, so a view can be shared. Files without a story get
  a URL-safe key too.
- The **Controls** panel sets the focus and depths as well.

**🔄 Changes**

- **Changed since main** (dbt's `state:modified+`): the files changed on your branch, committed or
  not, and everything that uses them, with the stories to check. Changed files carry a badge in
  every view.
- **Live updates:** the graph rebuilds when imports change, without reloading the page.

**🧩 Setup**

- One entry in `.storybook/main.ts`, no story file to write. Options for the source folder,
  `tsconfig` (so aliases such as `@/` resolve), excluded paths, the base branch and layers.
- Works in `storybook dev` and in the static `build-storybook` output.
- The viewer passes Storybook's accessibility checks. The default layer colour keeps AA contrast
  with the white node text; the Options table below says how to pick others that do.

## 📥 Install

```sh
pnpm add -D @rock-solid/storybook-addon-lineage
```

Versions up to 0.1.1 were published to GitHub Packages only; later ones are on npmjs.com.

If the project sets pnpm's `minimumReleaseAge`, a new version can't be installed until it's that
old; exempt the scope with `minimumReleaseAgeExclude: ['@rock-solid/*']` in `pnpm-workspace.yaml`.

## ⚙️ Set up

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

### 🎛️ Options

| Option       | Default           |                                                                                                                                                                                                                      |
| ------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `srcDir`     | `'src'`           | Folder to scan, relative to the project root (the folder above `.storybook`)                                                                                                                                         |
| `tsConfig`   | `'tsconfig.json'` | Its `paths` resolve aliases such as `@/`                                                                                                                                                                             |
| `exclude`    | `[]`              | Path patterns (regex source) to leave out, e.g. generated files                                                                                                                                                      |
| `baseBranch` | `'main'`          | Branch that changed files are compared with; `origin/<branch>` is tried first                                                                                                                                        |
| `layers`     | one layer         | `{ id, label, match, color, hidden? }`, matched against paths from the project root, first match wins. `hidden` layers start switched off. Node text is white, so keep each colour at 4.5:1 or better against white. |

## 🔍 How it works

- The graph is built with [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) when
  Storybook starts (a fraction of a second for a few hundred files), and rebuilt when you save a file
  whose imports changed. Type-only imports aren't edges: they don't render anything.
- A story links to the file its `component` is imported from, so `Grid.stories.tsx` with
  `component: GridBlock` from `./Component` links to `Component.tsx`. A file without a story of its
  own borrows one from its folder ("story via View"); the rest show "no story".
- Changed files are the diff from the merge base with the base branch to the working tree, plus
  untracked files. Without that branch, as in a shallow CI clone, the toggle is off.

## 🚧 Limits

- Storybook 10 on Vite with React only.
- One node per file, from static imports. Type-only imports aren't edges.
- Story titles and `component` must be written as literals for a story to link.

Known issues, the full list of limitations, and what's planned:
[ROADMAP.md](https://github.com/rock-solid/lineage-kit/blob/main/ROADMAP.md).
