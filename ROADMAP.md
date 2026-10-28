# 🗺️ Roadmap

What's next, what doesn't work yet, and ideas we haven't committed to: first for the repo as a
whole, then for each package. For what each does today, see its README, e.g. the Storybook addon's
[features](packages/storybook-addon-lineage#-features). It changes as we learn; open an issue to
suggest or question anything here.

## 🌐 Whole repo

### ⏭️ Next

- **More in the shared core.** `packages/lineage-core` holds the traversal and the ELK layout; the
  React Flow canvases (hover tracing, fit-to-view, the minimap) are still written twice, once per
  tool, and are the next candidates.
- **Export a view as an image,** PNG or SVG of the canvas in the current theme, next to Copy
  Mermaid on each page.

### 🐞 Known issues

- **The old `@rock-solid/storybook-addon-lineage` needs a GitHub token:** it's on GitHub Packages
  only (npm's `@rock-solid` scope belongs to someone else). Install `@rocksoliddigital/…` from npm.
  Beyond `pnpm install`, pnpm re-checks the lockfile's supply-chain policy on fresh clones and after
  lockfile or workspace changes, and that check needs the token too; without it, even a project's
  Storybook tests fail with a 401 in CI.
- **New versions are blocked by pnpm's minimum release age** unless the project exempts the scope
  (`minimumReleaseAgeExclude: ['@rocksoliddigital/*']` in `pnpm-workspace.yaml`).

## 📚 Storybook addon

`@rocksoliddigital/storybook-addon-lineage`: the import graph of your components, as a page in Storybook.

### ⏭️ Next

- **A lineage block on every Docs page:** a small graph centred on the component, linking to the
  full page.
- **A selector box:** type dbt syntax (`2+Button+1`, `+FeatureGrid`, `Button,Card`,
  `state:modified+`) instead of clicking.
- **The rest of the view in the URL:** layers, search, "Hide unconnected files" and changed-files
  mode.
- **Dark mode** that follows Storybook's theme.

### 🔭 Later

- **The content side in Storybook:** merge the Payload plugin's graph into the page, so a component
  shows the blocks, collections and pages that use it (see the
  [Payload plugin](#-payload-plugin)).
- **Impact in CI:** a CLI that lists the stories a branch affects (`state:modified+`), to run only
  those story tests and post them on the PR. It can share its commands with the Payload plugin's
  CLI (see the [Payload plugin](#-payload-plugin)).
- **Architecture rules:** report import rules from the same graph, e.g. "components don't import
  generated CMS types".

### 🐞 Known issues

Things that misbehave today. Fixes welcome.

- **The graph doesn't rebuild for changes outside the source folder.** A new `tsconfig.json` alias, or
  fetching `origin/main` (which moves the changed-files baseline), shows up after the next source
  edit or a Storybook restart.
- **Esc only clears the focus when keyboard focus is in the preview.** After clicking in Storybook's
  own UI, such as the Controls tab, click the canvas first.
- **A click takes 250ms to focus,** so it can be told apart from a double-click.
- **Hidden layers break chains.** An edge through a hidden file (A → utility → B) isn't drawn as A → B,
  so with "Hide unconnected files" on, files whose only links go through hidden layers disappear.

### 🚧 Limitations

What the design doesn't cover. Some are on the roadmap, others are trade-offs.

- **Storybook 10 on Vite with React** (`react-vite`, `nextjs-vite`). The graph is served by a Vite
  plugin and the page is a React story, so webpack builders and other renderers aren't supported.
- **Files, not components.** A file that exports several components is one node. A barrel over
  several files (`components/index.ts` re-exporting them all) is a node too, and links everything that
  imports it to all of them; barrels over a single file merge into it.
- **Static imports only.** Imports built at runtime (``import(`./${name}`)``), and links that live in
  data, such as a CMS block's slug mapped to its component, aren't edges.
- **Type-only imports aren't edges,** on purpose: they don't render anything.
- **Story linking needs literals.** A story links to the file its `component` is imported from, with
  `title` and `component` written as literals. Pattern stories without a `component` aren't nodes, and
  changing only a story file doesn't mark its component as changed.
- **One source folder** per Storybook; no graph across the packages of a monorepo.
- **Changed files need the base branch locally** (`origin/main` or `main`). In shallow CI clones the
  toggle is off.
- **Links to files without a story aren't pretty.** Their key is the path with `_` and a hex code for
  each `/`, `.` or other character (`src_2Fblocks_2FRenderBlocks_2Etsx`), so that no two paths share
  a key. Story ids, which most links use, stay readable.
- **Links name the docs page.** Opening the graph from a story saves that component's docs id
  (`ui-button--docs`), not the story you came from.
- **The Lineage page isn't a story test** in projects using it: `@storybook/addon-vitest` only runs
  stories from the project's own globs.
- **Light theme only,** with a fixed-width panel; not built for phone-sized screens.
- **Large graphs are untested.** It's used on ~150 files; layout and rendering at 1,000+ nodes haven't
  been measured.

### 💡 Ideas

Not committed to; open an issue if one would help you.

- Group nodes into a column per layer, as dbt does with sources, staging and marts.
- Collapse a folder into one node.
- Node details: lines of code, last change, owners from `CODEOWNERS`.
- Find components nothing uses, and import cycles.
- Open a file in the editor from its node.
- Compare the graph between two branches.
- A VS Code view of the same graph.

## 🧬 Payload plugin

`@rocksoliddigital/payload-lineage`: the content side of lineage, from a Payload config, as the Lineage
and Data model pages in the admin. Tried on a client project (Payload 3.90, 8 collections, 2
globals, 22 blocks); `examples/payload` is a small one to develop against.

### ⏭️ Next

- **A CLI,** so a script or CI job gets the graphs without a running admin or a login. The plugin
  registers a command through Payload's `bin` config, which reads the same config the pages do:
  - `payload lineage mermaid` prints the lineage as a Mermaid flowchart, and `--schema` the data
    model as an `erDiagram`.
  - `payload lineage json` prints the graph or, with `--schema`, the data model as JSON.
  - `--out <file>` writes to a file, so a committed diagram can be kept up to date, and `--check`
    fails when that file is out of date, for CI.
  - The same filters as the pages: `exclude`, and a focus with a depth to keep large graphs
    readable: `--focus collection:pages --depth 2`.
- **Links inside rich text.** A Lexical `LinkFeature` with `enabledCollections`, an
  `UploadFeature` or a `BlocksFeature` can reference collections and blocks from inside the editor;
  today those aren't edges. Reading them means going into Lexical's resolved feature config, which can
  change between Payload versions, so it needs its own tests.
- **Which pages use which blocks**, from the documents: how many documents use each block, which
  pages they are, and which blocks nothing uses. Queried when the page is opened and cached, never on
  each request.
- **Merge into the Storybook page** (see the [Storybook addon](#-storybook-addon)). Needs a
  block-to-component map: from `RenderBlocks`, or a convention like `src/blocks/<Name>/config.ts`
  next to `Component.tsx`.

### 🔭 Later

- **Shared field configs,** found by import scan, since Payload inlines fields: which blocks and
  collections use a shared field such as a `link` group.
- **A drift check** against hand-written inventories, such as a "page layouts and components" or a
  content model doc, in CI.
- **Pending database changes:** compare the config with the latest migration snapshot
  (`src/migrations/*.json`) to show what `migrate:create` would change, before running it.

### 🐞 Known issues

- **Links inside rich text are missing** from both pages (see Next).
- **Form-builder's field blocks crowd the lineage graph** (`checkbox`, `email`, `text`, …) unless
  listed in `exclude`.
- **A block's own fields don't mark it changed** in "Changed since main", only its links: the
  snapshot files hold a block's links, not its fields. Collections and globals show every field
  change on the Data model page.
- **ERD sentences use the config's labels,** so an uncountable singular ("a Media") or a plural that
  isn't one ("many Team") reads oddly. Setting `labels` on the collection fixes it, in the admin too.

### 🚧 Limitations

- **The config only.** Both pages show the model, not the content: no documents, counts or usage yet.
- **Payload 3 on Next.js 15 or 16, with React 19.**
- **Blocks have no access control of their own,** so anyone who can open the pages sees every block.
- **References that go both ways** (a page uses a block that links back to pages) are cycles; the
  lineage page draws the link back as running backwards instead of moving the block after the page.
- **A polymorphic reference is one line per collection,** and a join field is a row, not a line,
  since it reverses a reference that already is one.
- **Built on each visit,** in well under a millisecond on ~30 nodes; not measured on hundreds of
  collections.

### 💡 Ideas

Not committed to; open an issue if one would help you.

- Show a collection's hooks, access functions and versions/drafts settings on its table.
- Link a block's node to the component that renders it, in the editor.
- A "where is this used" panel on each collection's own admin page.

## 🙋 Suggest something

Open an issue with what you're trying to do, not just the feature: it helps us find the smallest
change that solves it. For anything bigger than a small fix, agree the approach in an issue before
opening a PR (see [Contributing](README.md#-contributing)).
