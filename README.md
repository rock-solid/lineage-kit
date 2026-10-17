# 🧬 lineage-kit

dbt-style lineage for UI components and CMS content: what each piece is built with, where it is
used, and what a change affects.

## 📦 Packages

| Package                                                                   | Status |                                                                                                                       |
| ------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| [`@rock-solid/storybook-addon-lineage`](packages/storybook-addon-lineage) | 0.1    | The lineage graph of your components, as a page in Storybook ([features](packages/storybook-addon-lineage#-features)) |
| [`@rock-solid/payload-lineage`](packages/payload-lineage)                 | 0.0    | Lineage and data model (ERD) pages in the Payload admin, from your config                                             |

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

| Script             | mise                | What it does                                                                                                        |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm run setup`   | `mise setup`        | One-time setup: dependencies, git hooks, test browser                                                               |
| `pnpm dev`         | `mise dev`          | Builds the packages in watch mode and starts the example Storybook at http://localhost:6006                         |
| `pnpm dev:payload` | `mise dev-payload`  | Builds the packages in watch mode and starts the example Payload admin at http://localhost:3000/admin               |
| `pnpm build`       | `mise build`        | Builds the packages to `dist/`                                                                                      |
| `pnpm test`        | `mise test`         | Every package's unit tests, the Payload example's config test, and the example Storybook's stories as browser tests |
| `pnpm lint`        | `mise lint`         | ESLint                                                                                                              |
| `pnpm typecheck`   | `mise typecheck`    | TypeScript, every package                                                                                           |
| `pnpm format`      | `mise format`       | Prettier                                                                                                            |
| `pnpm check`       | `mise check`        | Everything CI checks: format, build, lint, types, tests and the example Storybook build                             |
| `pnpm release …`   | `mise release -- …` | Maintainers: see [Releasing](#-releasing)                                                                           |

### 🗂️ Project layout

- `packages/storybook-addon-lineage`: the addon.
  - `src/graph.ts` builds the graph with dependency-cruiser.
  - `src/vite-plugin.ts` serves it to the viewer and rebuilds it on changes.
  - `src/preset.ts` wires both into Storybook and adds the Lineage page.
  - `src/manager.tsx` is the toolbar button, `src/LineageGraph.tsx` the viewer.
- `examples/payload`: a minimal Payload app (SQLite, no database server) that installs the plugin
  from the workspace. On first start, create a user at http://localhost:3000/admin, then open
  Lineage in the nav. Its `src/lineage.test.ts` checks the plugin against this real config.
- `examples/react`: a small Storybook that installs the addon from the workspace. Develop against
  it; its `src/lineage.test.stories.tsx` tests the viewer on fixture graphs.
- `scripts/release.mjs`: the release script.

### ✅ Pull requests

1. Branch from `main`, and keep each PR to one change.
2. Run `pnpm check` before you push. CI runs the same.
3. Add or update a test for any behaviour you change. Package tests are Vitest files next to the
   code (`src/**/*.test.ts`); the Storybook viewer's are stories with play functions in
   `examples/react/src/lineage.test.stories.tsx`.
4. Fill in the PR template; the test plan matters most.

Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org),
e.g. `feat: add a dark theme` or `fix(storybook): keep the focus after a rebuild`. A git hook
checks commit messages and CI checks PR titles. PRs are squash-merged, so the title becomes the
commit on `main`.

## 📤 Releasing

For maintainers. `main` only takes changes through a PR, so a release has two steps:

```sh
pnpm release prepare minor   # or patch, major, or an exact version such as 1.0.0
```

This bumps the version on a `release/…` branch and opens its PR, listing the package's changes
since its last release. Once that PR is merged:

```sh
git switch main && git pull
pnpm release tag
```

That tags `main` as `<package>@<version>`, e.g. `payload-lineage@0.1.0`. The Release workflow
checks the tag matches the version, publishes the package and creates a GitHub Release with notes
from the merged PRs. A prerelease such as `0.2.0-rc.1` is published under the `next` dist-tag, so
`pnpm add` keeps installing the latest stable version. Add `--dry-run` to either step to see what it
would do. The repo has more than one package, so both steps take `--package <folder>`, e.g.
`pnpm release prepare minor --package payload-lineage`.

Each package publishes where its `publishConfig.registry` says, GitHub Packages or npmjs.com (the
default), so moving one is a change to its `package.json`. On npmjs.com, the first publish of a
package uses an `NPM_TOKEN` repository secret; after that, set the Release workflow up as the
package's trusted publisher on npmjs.com and delete the secret: publishes then need no token and
carry provenance.

## 📄 License

[MIT](LICENSE)
