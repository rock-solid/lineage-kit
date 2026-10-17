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

Both are built from the running config on each visit (well under a millisecond), so they are never
out of date. A "Lineage" link in the nav opens them. To try them, run the
[example](https://github.com/rock-solid/lineage-kit/tree/main/examples/payload).

Works with Payload 3 on Next.js 15 or 16, with React 19.

> **Status:** early. Both pages come from the config only. Which pages use which blocks (from the
> documents), shared field configs (by import scan) and merging into the Storybook page are next;
> see the [roadmap](https://github.com/rock-solid/lineage-kit/blob/main/ROADMAP.md#-payload-plugin).

## 📥 Install

Not published yet: the first release, 0.2.0, is on the
[roadmap](https://github.com/rock-solid/lineage-kit/blob/main/ROADMAP.md#-payload-plugin). Then:

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

Or build either yourself, e.g. in a script:

```ts
import { buildContentGraph, buildSchema } from '@rocksoliddigital/payload-lineage';
import config from '@payload-config';

const graph = buildContentGraph(await config);
const schema = buildSchema(await config);
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
