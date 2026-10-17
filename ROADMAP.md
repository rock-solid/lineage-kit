# 🗺️ Roadmap

Where lineage-kit is, what's next, what doesn't work yet, and ideas we haven't committed to. It
changes as we learn; open an issue to suggest or question anything here.

## 🧭 Status

| Package                               | Version                             |                                        |
| ------------------------------------- | ----------------------------------- | -------------------------------------- |
| `@rock-solid/storybook-addon-lineage` | 0.1.0, on GitHub Packages (private) | Used in connect-hospitality as a trial |
| `@rock-solid/payload-plugin-lineage`  | In progress, not published          | See [Later](#-later)                   |

## 🚀 Now

- **Keep the view in the URL and restore the Controls panel** ([#4](https://github.com/rock-solid/lineage-kit/pull/4)):
  URL-safe focus keys for files without a story, depth changes written back, depths that survive a
  reload. Ships as 0.1.1.
- **Decide how projects install it.** GitHub Packages needs a token wherever pnpm installs: every
  developer, every CI job and every Docker build, because pnpm 12's supply-chain check fetches the
  package's metadata ([Known issues](#-known-issues)). Publishing publicly on npmjs.com removes all of
  that.

## ⏭️ Next

- **Public release on npmjs.com:** check that the `@rock-solid` npm org is free, make the repo public,
  switch the Release workflow's registry.
- **A lineage block on every Docs page:** a small graph centred on the component, linking to the
  full page.
- **A selector box:** type dbt syntax (`2+Button+1`, `+FeatureGrid`, `Button,Card`,
  `state:modified+`) instead of clicking.
- **The rest of the view in the URL:** layers, search, "Hide unconnected files" and changed-files
  mode.
- **Dark mode** that follows Storybook's theme.

## 🔭 Later

- **`@rock-solid/payload-plugin-lineage`:** the content side of lineage, from a Payload config.
  - Collections, globals and blocks as nodes, with `relationship` and `upload` fields as edges.
  - Which pages use which blocks, from the documents themselves.
  - Which blocks and collections use each shared field config (found by import scan, since Payload
    inlines fields).
  - An admin view at `/admin/lineage`, and a JSON export the Storybook page can merge, so a
    component shows the blocks, collections and pages that use it.
  - A drift check against hand-written inventories, e.g. a "page layouts and components" doc.
- **Impact in CI:** a CLI that lists the stories a branch affects (`state:modified+`), to run only
  those story tests and post them on the PR.
- **Architecture rules:** report import rules from the same graph, e.g. "components don't import
  generated CMS types".

## 🐞 Known issues

Things that misbehave today. Fixes welcome.

- **0.1.0 loses the view on reload, and its Controls panel is empty** in projects installing the
  package. Fixed in [#4](https://github.com/rock-solid/lineage-kit/pull/4), not yet released.
- **Installs need a GitHub token.** Beyond `pnpm install`, pnpm re-checks the lockfile's
  supply-chain policy on fresh clones and after lockfile or workspace changes, and that check also
  needs the token. Until then even `pnpm test:storybook` fails with a 401.
- **New versions are blocked by pnpm's minimum release age** unless the project exempts the scope
  (`minimumReleaseAgeExclude: ['@rock-solid/*']` in `pnpm-workspace.yaml`).
- **The graph doesn't rebuild for changes outside the source folder.** A new `tsconfig.json` alias, or
  fetching `origin/main` (which moves the changed-files baseline), shows up after the next source
  edit or a Storybook restart.
- **Esc only clears the focus when keyboard focus is in the preview.** After clicking in Storybook's
  own UI, such as the Controls tab, click the canvas first.
- **A click takes 250ms to focus,** so it can be told apart from a double-click.
- **Hidden layers break chains.** An edge through a hidden file (A → utility → B) isn't drawn as A → B,
  so with "Hide unconnected files" on, files whose only links go through hidden layers disappear.
- **The release log warns "Skipped OIDC"**: pnpm tries OIDC provenance first, which GitHub Packages
  doesn't use. Harmless.

## 🚧 Limitations

What the design doesn't cover. Some are on the roadmap, others are trade-offs.

- **Storybook 10 on Vite with React** (`react-vite`, `nextjs-vite`). The graph is served by a Vite
  plugin and the page is a React story, so webpack builders and other renderers aren't supported.
- **Files, not components.** A file that exports several components is one node; barrel files
  (`index.ts` re-exports) add a hop.
- **Static imports only.** Imports built at runtime (``import(`./${name}`)``), and links that live in
  data, such as a CMS block's slug mapped to its component, aren't edges.
- **Type-only imports aren't edges,** on purpose: they don't render anything.
- **Story linking needs literals.** A story links to the file its `component` is imported from, with
  `title` and `component` written as literals. Pattern stories without a `component` aren't nodes, and
  changing only a story file doesn't mark its component as changed.
- **One source folder** per Storybook; no graph across the packages of a monorepo.
- **Changed files need the base branch locally** (`origin/main` or `main`). In shallow CI clones the
  toggle is off.
- **The Lineage page isn't a story test** in projects using it: `@storybook/addon-vitest` only runs
  stories from the project's own globs.
- **Light theme only,** with a fixed-width panel; not built for phone-sized screens.
- **Large graphs are untested.** It's used on ~150 files; layout and rendering at 1,000+ nodes haven't
  been measured.

## 💡 Ideas

Not committed to; open an issue if one would help you.

- Export the graph or a focused view as PNG, SVG or Mermaid, for docs and PRs.
- Group nodes into a column per layer, as dbt does with sources, staging and marts.
- Collapse a folder into one node.
- Node details: lines of code, last change, owners from `CODEOWNERS`.
- Find components nothing uses, and import cycles.
- Open a file in the editor from its node.
- Compare the graph between two branches.
- A VS Code view of the same graph.

## 🙋 Suggest something

Open an issue with what you're trying to do, not just the feature: it helps us find the smallest
change that solves it. For anything bigger than a small fix, agree the approach in an issue before
opening a PR (see [Contributing](README.md#-contributing)).
