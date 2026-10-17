# 🗺️ Roadmap: payload-lineage

Where `@rock-solid/payload-lineage` is, what's next, what doesn't work yet, and ideas we haven't
committed to. For what it does today, see the [README](README.md); for the Storybook addon and the
repo as a whole, the [main roadmap](../../ROADMAP.md). It changes as we learn; open an issue to
suggest or question anything here.

## 🧭 Status

0.0.0, not published. Tried on connect-hospitality (Payload 3.90, 8 collections, 2 globals, 22
blocks).

| Piece                                                   | Where                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| The content graph and the plugin that writes it as JSON | [#6](https://github.com/rock-solid/lineage-kit/pull/6), draft               |
| The Lineage and Data model pages in the admin           | [#8](https://github.com/rock-solid/lineage-kit/pull/8), draft, on top of #6 |

## 🚀 Now

- **Land #6 and #8.** Open both pages logged in (the steps #8 marks _for the reviewer_), fix what
  looks wrong, merge.
- **A release path.** The Release workflow only handles `storybook-addon-lineage@*` tags and
  publishes that package; widen its tag and publish filters so `payload-lineage@0.1.0` can ship. Goes
  wherever the addon goes (GitHub Packages or npmjs.com, see the main roadmap).

## ⏭️ Next

- **Changed since main**, as the Storybook addon has, including what was deleted.
  - The plugin also writes `lineage/schema.json`, and both files are committed. On a branch, the
    pages read `main`'s copies (`git show origin/main:lineage/schema.json`) and compare them with the
    running config.
  - Lineage: added, changed and deleted nodes and links. Data model: tables added or deleted, and
    fields added, removed or changed (type, required, what they reference).
  - Deleted nodes and tables stay on the page, faded, dashed and struck through, with the links
    they had, so it's clear what they connected.
  - A "Changed since main" toggle that shows only the changes and what they affect, like dbt's
    `state:modified+`.
  - Needs git and the base branch, so it works in `next dev` and CI, not on a production server,
    where the toggle is hidden. The first PR that commits the files has nothing to compare with.
- **Links inside rich text.** A Lexical `LinkFeature` with `enabledCollections`, an
  `UploadFeature` or a `BlocksFeature` can reference collections and blocks from inside the editor;
  today those aren't edges. Reading them means going into Lexical's resolved feature config, which can
  change between Payload versions, so it needs its own tests.
- **Which pages use which blocks**, from the documents: how many documents use each block, which
  pages they are, and which blocks nothing uses. Queried when the page is opened and cached, never on
  each request.
- **Merge into the Storybook page,** so a component shows the blocks, collections and pages that
  use it. Needs a block-to-component map: from `RenderBlocks`, or a convention like
  `src/blocks/<Name>/config.ts` next to `Component.tsx`.
- **One graph package for both tools.** The ELK layout, the traversal and the React Flow parts are
  written twice, in the addon and here; move the shared parts into one package.

## 🔭 Later

- **Shared field configs,** found by import scan, since Payload inlines fields: which blocks and
  collections use `link`, `linkGroup` or `sectionHeaderFields`.
- **A drift check** against hand-written inventories, such as a "page layouts and components" or a
  content model doc, in CI.
- **Who can open the pages,** as an option (e.g. admins only), beyond today's "logged in, and only
  what you can read".
- **Pending database changes:** compare the config with the latest migration snapshot
  (`src/migrations/*.json`) to show what `migrate:create` would change, before running it.

## 🐞 Known issues

- **Nobody has opened the pages logged in yet.** The redirects, the data and the layouts are tested,
  but not how the pages look (#8).
- **Links inside rich text are missing** from both pages (see Next).
- **Form-builder's field blocks crowd the lineage graph** (`checkbox`, `email`, `text`, …) unless
  listed in `exclude`.
- **A build needs `payload generate:importmap`** after installing or upgrading; `next dev` does it on
  its own.
- **ERD sentences use the config's labels,** so an uncountable singular ("a Media") or a plural that
  isn't one ("many Team") reads oddly. Setting `labels` on the collection fixes it, in the admin too.

## 🚧 Limitations

- **The config only.** Both pages show the model, not the content: no documents, counts or usage yet.
- **Payload 3 on Next.js 15 or 16, with React 19.**
- **Blocks have no access control of their own,** so anyone who can open the pages sees every block.
- **References that go both ways** (a page uses a block that links back to pages) are cycles; the
  lineage page draws the link back as running backwards instead of moving the block after the page.
- **A polymorphic reference is one line per collection,** and a join field is a row, not a line,
  since it reverses a reference that already is one.
- **Built on each visit,** in well under a millisecond on ~30 nodes; not measured on hundreds of
  collections.

## 💡 Ideas

Not committed to; open an issue if one would help you.

- Export the ERD as Mermaid (`erDiagram`) or SVG, for docs and PRs.
- Show a collection's hooks, access functions and versions/drafts settings on its table.
- Link a block's node to the component that renders it, in the editor.
- A "where is this used" panel on each collection's own admin page.
