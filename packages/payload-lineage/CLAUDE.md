# @rocksoliddigital/payload-lineage

The Payload plugin: the Lineage and Data model pages in the admin. Users' docs: [README.md](README.md).

- `src/graph.ts` builds the lineage graph and `src/schema.ts` the data model, from a config;
  `src/plugin.ts` registers the pages, the nav link and the optional JSON file.
- "Changed since main": `src/snapshot.ts` writes `graph.json` and `schema.json` and reads the base
  branch's copies with git (at the merge base); `src/diff.ts` marks what was added, changed or
  deleted, keeping deleted items in the result; `src/compare.ts` is what the pages call. The base
  goes through the running `exclude` (`src/exclude.ts`, shared with the builders) before the diff,
  and the pages filter for the viewer after it: deleted items skip the read check, so anything
  that still exists must never come back as deleted.
- `src/rsc.tsx` holds the server components (the two pages, the nav link); `src/client.ts` the
  client ones, which tsup prefixes with `'use client'`. `rsc.tsx` imports `./client.js`, kept
  external in the build, so the boundary survives bundling. Keep that import path as is.
- The plugin passes its options to the pages through `config.custom.lineage`, which Payload keeps on
  the server. Payload doesn't check admin access on custom views; `src/access.ts` does, and the
  pages filter out what the user can't read before anything reaches the browser.
- `src/view/` holds what runs in the browser: the canvases, and `model.ts` / `erdModel.ts` with the
  pure logic, which is where tests go.
- After changing a component path the plugin registers, regenerate the example's import map:
  `pnpm --filter example-payload payload generate:importmap`.
- Test against sanitized configs, not only hand-written ones: Payload's sanitizer adds fields and
  collections (`payload-*`, `hasMany` on joins). `examples/payload/src/lineage.test.ts` runs the
  plugin on the example's real config; `pnpm dev:payload` runs that example.
