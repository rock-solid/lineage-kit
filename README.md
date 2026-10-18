# 🧬 lineage-kit

dbt-style lineage for UI components and CMS content: what each piece is built with, where it is
used, and what a change affects.

## 📦 Packages

| Package                                                                         | npm                                                                                                                                                       |                                                                                                                            |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`@rocksoliddigital/storybook-addon-lineage`](packages/storybook-addon-lineage) | [![npm](https://img.shields.io/npm/v/@rocksoliddigital/storybook-addon-lineage)](https://www.npmjs.com/package/@rocksoliddigital/storybook-addon-lineage) | The lineage graph of your components, as a page in Storybook ([features](packages/storybook-addon-lineage#-features))      |
| [`@rocksoliddigital/payload-lineage`](packages/payload-lineage)                 | [![npm](https://img.shields.io/npm/v/@rocksoliddigital/payload-lineage)](https://www.npmjs.com/package/@rocksoliddigital/payload-lineage)                 | Lineage and data model (ERD) pages in the Payload admin, from your config ([features](packages/payload-lineage#-features)) |

## 🚀 Quick start

- **Storybook:** install the addon and add it to `.storybook/main.ts`: see
  [its README](packages/storybook-addon-lineage#-install).
- **Payload:** add the plugin to `payload.config.ts`: see
  [its README](packages/payload-lineage#-install), or run the
  [example](examples/payload) with `pnpm dev:payload`.

## 🗺️ Roadmap

What's next, known issues, limitations and ideas: see [ROADMAP.md](ROADMAP.md).

## 🤝 Contributing

Contributions are welcome: bug reports, ideas and pull requests. For anything bigger than a small
fix, open an issue first so we can agree on the approach.

### 🧰 Prerequisites

**With [mise](https://mise.jdx.dev) (recommended):** it installs the Node and pnpm versions pinned
in `mise.toml`.

```sh
mise trust
mise setup
```

**Without mise:** install Node 22 or later (CI uses 24), then let corepack provide the pnpm version
from `packageManager` in `package.json`.

```sh
corepack enable
pnpm run setup
```

Either way, setup installs the dependencies, the git hooks and the Chromium the tests run in. Use
`pnpm run setup` rather than `pnpm setup`, which is a pnpm command of its own.

### 💻 Commands

Every mise task is an alias over a pnpm script, so both columns run the same thing.

| Script             | mise               | What it does                                                                                                        |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm run setup`   | `mise setup`       | One-time setup: dependencies, git hooks, test browser                                                               |
| `pnpm dev`         | `mise dev`         | Builds the packages in watch mode and starts the example Storybook at http://localhost:6006                         |
| `pnpm dev:payload` | `mise dev-payload` | Builds the packages in watch mode and starts the example Payload admin at http://localhost:3000/admin               |
| `pnpm build`       | `mise build`       | Builds the packages to `dist/`                                                                                      |
| `pnpm test`        | `mise test`        | Every package's unit tests, the Payload example's config test, and the example Storybook's stories as browser tests |
| `pnpm lint`        | `mise lint`        | ESLint                                                                                                              |
| `pnpm typecheck`   | `mise typecheck`   | TypeScript, every package                                                                                           |
| `pnpm format`      | `mise format`      | Prettier                                                                                                            |
| `pnpm check`       | `mise check`       | Everything CI checks: format, build, lint, types, tests and the example Storybook build                             |
| `pnpm changeset`   | `mise changeset`   | Adds a changeset for a release: see [Releasing](#-releasing)                                                        |

### 🗂️ Project layout

- `packages/storybook-addon-lineage`: the addon.
  - `src/graph.ts` builds the graph with dependency-cruiser.
  - `src/vite-plugin.ts` serves it to the viewer and rebuilds it on changes.
  - `src/preset.ts` wires both into Storybook and adds the Lineage page.
  - `src/manager.tsx` is the toolbar button, `src/LineageGraph.tsx` the viewer.
- `packages/payload-lineage`: the Payload plugin.
  - `src/graph.ts` builds the lineage graph and `src/schema.ts` the data model, from the config.
  - `src/plugin.ts` registers the admin pages; `src/rsc.tsx` renders them on the server, and
    `src/view/` holds the canvases, which run in the browser.
- `packages/lineage-core`: what both share, walking a graph's links and laying it out with ELK
  (with a React hook). It's private: each package's build includes its code, so it's never
  published or installed on its own. Use it for anything both tools need, rather than copying.
- `examples/payload`: a minimal Payload app (SQLite, no database server) that installs the plugin
  from the workspace. On first start, create a user at http://localhost:3000/admin, then open
  Lineage in the nav. Its `src/lineage.test.ts` checks the plugin against this real config.
- `examples/react`: a small Storybook that installs the addon from the workspace. Develop against
  it; its `src/lineage.test.stories.tsx` tests the viewer on fixture graphs.
- `.changeset/`: the changesets waiting for the next release, and their config.

### ✅ Pull requests

1. Branch from `main`, and keep each PR to one change.
2. Run `pnpm check` before you push. CI runs the same.
3. Add or update a test for any behaviour you change. Package tests are Vitest files next to the
   code (`src/**/*.test.ts`); the Storybook viewer's are stories with play functions in
   `examples/react/src/lineage.test.stories.tsx`.
4. If it changes what a package does, add a changeset: `pnpm changeset` (see
   [Releasing](#-releasing)).
5. Fill in the PR template; the test plan matters most.

Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org),
e.g. `feat: add a dark theme` or `fix(storybook): keep the focus after a rebuild`. A git hook
checks commit messages and CI checks PR titles. PRs are squash-merged, so the title becomes the
commit on `main`.

## 📤 Releasing

Releases use [Changesets](https://github.com/changesets/changesets). The two published packages
share one version and are always released together, so each addon version goes with the plugin
version of the same number. A PR that changes what a package does adds a changeset:

```sh
pnpm changeset   # pick the packages and the bump, then write the changelog line
```

That adds a file under `.changeset/` to commit with the PR. `packages/lineage-core` is built into
both published packages, so a change there names the packages it changes. Docs, tests and CI need
none.

Once changesets reach `main`, the Release workflow opens a **Version Packages** PR, and keeps it up
to date: it bumps the versions and writes each package's `CHANGELOG.md`. Merging it publishes the
new versions to npmjs.com with provenance, tags them (`@rocksoliddigital/payload-lineage@<version>`) and
creates their GitHub Releases. GitHub doesn't let a PR the workflow opens start other workflows, so
close and reopen the Version Packages PR to run its checks.

Release notes group changesets under `🚀 Features`, `🐛 Bug Fixes` and `⚠️ Breaking Changes` (minor,
patch and major), one line each with the PR's scope, PR and commit, then `🤝 Contributors`.
`.changeset/changelog.mjs` writes the lines and `scripts/format-changelog.mjs` the sections, both
run by `pnpm version-packages` (`changeset version`, then the formatter). To preview, run it with
`GITHUB_TOKEN=$(gh auth token)` and discard the result. For a prerelease, see Changesets'
[prerelease guide](https://github.com/changesets/changesets/blob/main/docs/prereleases.md).

**Setting up publishing, once:**

- In the repo's Settings → Actions → General, allow GitHub Actions to create and approve pull
  requests, so the workflow can open the Version Packages PR.
- On npmjs.com, add the Release workflow (`rock-solid/lineage-kit`, `release.yml`) as each package's
  trusted publisher; publishing then needs no token. If npm won't take a trusted publisher before a
  package's first version, publish that version once by hand from `main` after merging the Version
  Packages PR: `pnpm build && pnpm changeset publish`.

## 📄 License

[MIT](LICENSE)
