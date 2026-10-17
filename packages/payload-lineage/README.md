# 🧬 @rock-solid/payload-lineage

The content side of lineage, from a Payload config, as two pages in the admin:

- **Lineage** (`/admin/lineage`): collections, globals and blocks, and the fields that link them,
  read left to right from what each is built from to where it is used: `media` →
  `block:mediaBlock` → `pages`. Hover a node to trace everything upstream and downstream; click it
  for the fields behind each link.
- **Data model** (`/admin/lineage/schema`): an ERD, with a table per collection and global listing
  its fields, and a line from each field that references another collection. `N:1` is one
  reference per document, `N:M` a list (`hasMany`, or inside an array or blocks field).

Both are built from the running config on each visit (well under a millisecond), so they are never
out of date. They're for logged-in users, and show only the collections and globals the user can
read. A "Lineage" link in the nav opens them.

Works with Payload 3 on Next.js 15 or 16.

> **Status:** early. Both pages come from the config only. Which pages use which blocks (from the
> documents), shared field configs (by import scan) and merging into the Storybook page are next;
> see the [roadmap](../../ROADMAP.md).

## ⚙️ Set up

Add the plugin to `payload.config.ts`:

```ts
import { lineagePlugin } from '@rock-solid/payload-lineage';

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
import { buildContentGraph, buildSchema } from '@rock-solid/payload-lineage';
import config from '@payload-config';

const graph = buildContentGraph(await config);
const schema = buildSchema(await config);
```

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
