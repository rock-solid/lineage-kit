# Example: Payload

A minimal Payload 3 app with `@rocksoliddigital/payload-lineage`, for developing the plugin and trying it
out. It stores everything in a SQLite file (`example.db`), so it needs no database server.

From the repo root:

```sh
pnpm dev:payload   # or: mise dev-payload
```

Open http://localhost:3000/admin, create the first user, then **Lineage** in the nav. The content
model is small but shows each kind of link the pages draw:

| Field                             | Shows                                        |
| --------------------------------- | -------------------------------------------- |
| `posts.cover`, `pages.hero.image` | an upload, many-to-one                       |
| `posts.categories`                | `hasMany`, many-to-many                      |
| `pages.layout`                    | shared blocks used by slug, with their links |
| `pages.parent`                    | a collection pointing at itself (↻)          |
| `categories.posts`                | a join: a row, not a second line             |
| `header.nav[].page`               | a global's list, one-to-many                 |

The plugin also writes the lineage graph to `lineage/content.json` on each start, and the snapshot
in `lineage/graph.json` and `lineage/schema.json`, which are committed: change a collection on a
branch and **Changed since main** on either page shows what changed. Delete
`example.db` to start over.
