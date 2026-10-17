# lineage-kit

dbt-style lineage for UI components (a Storybook addon) and CMS content (a Payload plugin). The
[README](README.md) covers setup, commands and the project layout; [ROADMAP.md](ROADMAP.md) what's
next, known issues and limitations. Commit, PR and hook rules are in
[.claude/rules/git-conventions.md](.claude/rules/git-conventions.md).

## Commands

- `pnpm run setup` once (not `pnpm setup`, which is pnpm's own command).
- `pnpm check` before pushing: format, build, lint, types, tests and the Storybook build, as CI.
- `pnpm dev` (Storybook at :6006) or `pnpm dev:payload` (Payload admin at :3000/admin).
- Filter by package name: `pnpm --filter @rock-solid/payload-lineage test`, `--filter example`
  (Storybook), `--filter example-payload` (Payload).

## Packages

- `packages/storybook-addon-lineage` and `packages/payload-lineage` are published.
- `packages/lineage-core` is private: what both share (traversal, ELK layout, `useLayout`). It
  exports its TypeScript source and is a devDependency of both, so tsup bundles it into their
  `dist`. Put shared logic there rather than copying it, and keep its types out of the published
  packages' public types, which can't import it.
- Both graphs read left to right: an edge's `source` is the dependency, `target` what uses it. The
  addon's node ids are file paths; the plugin's are `<kind>:<slug>` (`collection:pages`).

## Payload plugin

- `src/rsc.tsx` holds the server components (the two admin pages, the nav link); `src/client.ts`
  the client ones, which tsup prefixes with `'use client'`. `rsc.tsx` imports `./client.js`, kept
  external in the build, so the boundary survives bundling.
- The plugin passes its options to the pages through `config.custom.lineage`, which Payload keeps on
  the server. Payload doesn't check admin access on custom views; `src/access.ts` does.
- After changing a component path the plugin registers, regenerate the example's import map:
  `pnpm --filter example-payload payload generate:importmap`.
- Test against sanitized configs, not only hand-written ones: Payload's sanitizer adds fields and
  collections (`payload-*`, `hasMany` on joins). `examples/payload/src/lineage.test.ts` runs the
  plugin on the example's real config.

## Repo hygiene

- The repo is public: never name client projects or their content in code, docs, tests, commits or
  PRs. Use generic examples (`pages`, `media`, `posts`).
- `examples/payload/AGENTS.md` and `CLAUDE.md` are written by `next dev`; leave them as generated.
- Generated files stay out of lint and format: `.next/`, the Payload `importMap.js`, `dist/`.
- Releases: see the README's Releasing section.
