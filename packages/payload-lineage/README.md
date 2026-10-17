# 🧬 @rock-solid/payload-lineage

The content side of lineage, from a Payload config. Collections, globals and blocks are nodes, and
the fields that link them are edges, read left to right from what an entity is built with to where
it is used: `media` → `block:mediaBlock` → `pages`.

- **Relationship and upload fields** link a collection to the collection, global or block that
  points at it.
- **Blocks fields** link each block, inline or referenced from `config.blocks`, to what uses it.
- **Fields inside blocks** are followed too, with the block as the owner.
- Each edge lists the dotted paths of the fields that make it, e.g. `hero.media`.

Works with Payload 3.

> **Status:** early. The graph comes from the config only. Which pages use which blocks (from the
> documents), shared field configs (by import scan), the `/admin/lineage` view and merging into the
> Storybook page are next; see the [roadmap](../../ROADMAP.md).

## ⚙️ Set up

Add the plugin to `payload.config.ts`:

```ts
import { lineagePlugin } from '@rock-solid/payload-lineage';

export default buildConfig({
  // ...
  plugins: [lineagePlugin({ outputFile: 'lineage/content.json' })],
});
```

When Payload starts, it writes the graph of the sanitized config to `outputFile`, so collections
other plugins add (such as form-builder's `forms`) are in it.

| Option       | Default               |                                                                          |
| ------------ | --------------------- | ------------------------------------------------------------------------ |
| `outputFile` | none                  | Where to write the graph as JSON. Without it the plugin does nothing yet |
| `exclude`    | `[]`                  | Slugs to leave out with their edges; `block:text` names only that block  |
| `enabled`    | on outside production | Set to `false` to skip it                                                |

Payload's own collections (`payload-preferences`, `payload-migrations`, ...) are always left out.

Or build the graph yourself, e.g. in a script:

```ts
import { buildContentGraph } from '@rock-solid/payload-lineage';
import config from '@payload-config';

const graph = buildContentGraph(await config);
```

## 📄 Output

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

To leave out form-builder's field blocks, which crowd the graph:

```ts
lineagePlugin({
  outputFile: 'lineage/content.json',
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
