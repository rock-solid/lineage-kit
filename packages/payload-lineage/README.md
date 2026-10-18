# 🧬 @rocksoliddigital/payload-lineage

The content side of lineage, from a Payload config, as two pages in the admin:

- **Lineage** (`/admin/lineage`): collections, globals and blocks, and the fields that link them,
  read left to right from what each is built from to where it is used: `media` →
  `block:mediaBlock` → `pages`. Hover a node to trace everything upstream and downstream; click it
  for the fields behind each link.
- **Data model** (`/admin/lineage/schema`): an ERD, with a table per collection and global listing
  its fields, and a line from each field that references another collection, labelled with its
  cardinality:

| Label          | Means                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| `many-to-one`  | One reference per document, which many documents can share                |
| `many-to-many` | A list of references: `hasMany`, or inside an array or blocks field       |
| `one-to-one`   | A `unique` reference, or a global's single one (a global is one document) |
| `one-to-many`  | A global's list of references                                             |

A "Lineage" link in the nav opens them. To try them, run the
[example](https://github.com/rock-solid/lineage-kit/tree/main/examples/payload).

Works with Payload 3 on Next.js 15 or 16, with React 19. Early days: what's next is on the
[roadmap](https://github.com/rock-solid/lineage-kit/blob/main/ROADMAP.md#-payload-plugin).

## ✨ Features

**👀 Explore**

- **Lineage** and **Data model** pages in the admin, with a link in the nav, added by the plugin.
- **Kinds** colour the nodes: collections, blocks and globals. Switch any kind on or off, and
  **Hide unconnected** collections, like a `users` that nothing points at.
- **Hover** a node to trace its whole lineage: everything upstream and downstream lights up, the rest
  dims. On the data model, hover a table for what it references and what references it.
- **Click** a node or table for the fields behind each link, with its cardinality as a sentence
  ("Each Post references many Categories"), and **Open in the admin**.
- **Key fields only** cuts the tables down to their ids and references; long tables show ten rows
  and a "+N more".
- **Copy Mermaid** copies what the page shows, with its filters, as a Mermaid diagram: the lineage
  as a flowchart, the data model as an `erDiagram` in crow's-foot notation. Paste it into a PR, a
  doc or a ticket, and GitHub, GitLab and most docs tools draw it.

**🔄 Changes**

- **Changed since main** (dbt's `state:modified+`): with `snapshot` on, both pages mark what a branch
  added, changed or deleted, compared with the base branch, and a toggle shows only that and what it
  affects. See [Changed since main](#-changed-since-main).
- **Deleted** collections, blocks, fields and references stay on the page, faded, dashed and struck
  through, with the links they had, so it's clear what they connected.

**🔒 Access**

- For users who can use the admin and pass the plugin's `access`, showing only the collections and
  globals they can read. Everything is checked and built on the server. See [Access](#-access).

**🧩 Setup**

- One line in `payload.config.ts`. Options for excluded slugs, access, the JSON file and the
  snapshot.
- Built from the running config on each visit (well under a millisecond), so the pages are never out
  of date. `buildContentGraph` and `buildSchema` give the same data to scripts.
- Follows the admin's light and dark themes.

## 📥 Install

```sh
pnpm add @rocksoliddigital/payload-lineage
```

## ⚙️ Set up

Add the plugin to `payload.config.ts`:

```ts
import { lineagePlugin } from '@rocksoliddigital/payload-lineage';

export default buildConfig({
  // ...
  plugins: [lineagePlugin()],
});
```

Then update the import map, so the admin can find the pages. `next dev` does this on its own; for a
build, run:

```sh
pnpm payload generate:importmap
```

| Option       | Default |                                                                                   |
| ------------ | ------- | --------------------------------------------------------------------------------- |
| `adminView`  | `true`  | The two admin pages and the nav link                                              |
| `access`     | none    | `({ user, payload }) => boolean`, on top of admin access; see [Access](#-access)  |
| `outputFile` | none    | Where to write the lineage graph as JSON on each start, outside production only   |
| `snapshot`   | off     | `true`, or `{ dir, baseBranch }`: see [Changed since main](#-changed-since-main)  |
| `exclude`    | `[]`    | Slugs to leave out of both pages and the file; `block:text` names only that block |
| `enabled`    | `true`  | Set to `false` to turn the plugin off                                             |

Payload's own collections (`payload-preferences`, `payload-migrations`, ...) are always left out. If
the file can't be written (e.g. a read-only filesystem), Payload logs a warning and starts anyway.

To leave out form-builder's field blocks, which crowd the lineage graph:

```ts
lineagePlugin({
  exclude: [
    'checkbox',
    'country',
    'email',
    'message',
    'number',
    'select',
    'state',
    'text',
    'textarea',
  ].map((s) => `block:${s}`),
});
```

Or build either yourself, e.g. in a script, and keep a diagram in your docs up to date:

```ts
import {
  buildContentGraph,
  buildSchema,
  contentGraphToMermaid,
  schemaToMermaid,
} from '@rocksoliddigital/payload-lineage';
import config from '@payload-config';

const graph = buildContentGraph(await config);
const schema = buildSchema(await config);
const diagram = schemaToMermaid(schema); // or contentGraphToMermaid(graph)
```

## 🔒 Access

The pages and their nav link are for users who can use the admin (Payload's `access.admin` on the
users collection, which Payload itself doesn't check on custom pages), and who pass the plugin's
`access`, if set:

```ts
lineagePlugin({ access: ({ user }) => user.role === 'admin' });
```

Anyone else is sent where Payload sends them for its own pages: the login page when logged out, the
unauthorized page when logged in, each with a `redirect` back. The pages show only the collections
and globals the user can read, along with every link to or from them; blocks have no access control
of their own, so they're all shown. Everything is checked and built on the server, so nothing a user
can't see reaches the browser.

## 🔄 Changed since main

```ts
lineagePlugin({ snapshot: true }); // or { dir: 'lineage', baseBranch: 'main' }, the defaults
```

The plugin writes the lineage graph and the data model to `lineage/graph.json` and
`lineage/schema.json`, when Payload starts and when a page is opened, outside production. **Commit
both files.** On a branch, the pages compare the running config with the base branch's copies, from
where the branch left it (`git merge-base HEAD origin/main`; `main` without a remote):

- **Lineage:** nodes and links added, changed or deleted. A node is changed when its label or the
  links its fields make change.
- **Data model:** tables added, changed or deleted, and in each, fields added, deleted or changed
  (type, required, `hasMany`, localized, unique, what they reference). A changed table lists its
  changed fields, with what each was before.
- **The toggle** shows only the changes and what they affect: everything downstream on the lineage,
  and the tables that reference a changed one on the data model.

It needs git and the base branch, so it works in `next dev`, not in production, where the toggle is
hidden. Without git or the branch, or before the base branch has the files (the PR that turns the
option on), the toggle is disabled and says why. Deleted collections and globals are shown to
everyone who can open the pages: they hold no documents, and the committed files name them anyway.
Changes to a block's fields that aren't links don't mark it changed yet.

## 📄 The lineage file

```json
{
  "nodes": [
    { "id": "collection:media", "kind": "collection", "slug": "media", "label": "Media" },
    { "id": "block:mediaBlock", "kind": "block", "slug": "mediaBlock", "label": "Media Block" }
  ],
  "edges": [
    {
      "source": "collection:media",
      "target": "block:mediaBlock",
      "kind": "upload",
      "fields": ["media"]
    }
  ]
}
```

Node ids are `<kind>:<slug>`, so they can't clash with the file paths the Storybook addon uses as
ids. `source` is the dependency and `target` what uses it, as in the Storybook addon. Join fields are
left out, since each is the reverse of a relationship that is already an edge. A collection that
links to itself, like nested-docs' `parent`, keeps the edge to itself.

## 🗂️ The data model

`buildSchema` flattens groups, rows, collapsibles and tabs into dotted rows (`hero.media`), and keeps
each array and blocks field as one row (`gallery[]`, `layout`). A reference inside one of those
attaches to that row, with its full path: `layout[mediaBlock].media`. Hidden fields (an auth
collection's `salt` and `hash`) and UI fields are left out. A join field is a row but not a line,
since it reverses a relationship that already is one.
