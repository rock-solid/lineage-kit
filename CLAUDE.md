# lineage-kit

dbt-style lineage for UI components (a Storybook addon) and CMS content (a Payload plugin). The
[README](README.md) covers setup, commands and the project layout; [ROADMAP.md](ROADMAP.md) what's
next, known issues and limitations. Commit, PR and hook rules are in
[.claude/rules/git-conventions.md](.claude/rules/git-conventions.md).

## Commands

- `pnpm run setup` once (not `pnpm setup`, which is pnpm's own command).
- `pnpm check` before pushing: format, build, lint, types, tests and the Storybook build, as CI.
- `pnpm dev` (Storybook at :6006) or `pnpm dev:payload` (Payload admin at :3000/admin).
- Filter by package name: `pnpm --filter @rocksoliddigital/payload-lineage test`, `--filter example`
  (Storybook), `--filter example-payload` (Payload).

## Packages

Each package has its own `CLAUDE.md` with what's particular to it.

- `packages/storybook-addon-lineage` and `packages/payload-lineage` are published.
- `packages/lineage-core` is private: what both share, bundled into each. Put shared logic there
  rather than copying it.
- Both graphs read left to right: an edge's `source` is the dependency, `target` what uses it. The
  addon's node ids are file paths; the plugin's are `<kind>:<slug>` (`collection:pages`).
- `examples/react` (Storybook) and `examples/payload` (Payload on SQLite) install the packages from
  the workspace, for developing and testing against.

## Repo hygiene

- The repo is public: never name client projects or their content in code, docs, tests, commits or
  PRs. Use generic examples (`pages`, `media`, `posts`).
- `examples/payload/AGENTS.md` and `CLAUDE.md` are written by `next dev`; leave them as generated.
- Generated files stay out of lint and format: `.next/`, the Payload `importMap.js`, `dist/`.
- Releases: see the README's Releasing section.
