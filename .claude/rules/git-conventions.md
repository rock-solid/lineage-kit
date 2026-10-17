# Commits and pull requests

Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org).

- Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `style`, `revert`.
- Lowercase type; the description starts with a lowercase letter or a digit (proper nouns later on are fine: `add GitHub login`), imperative mood, no trailing period, header under 100 characters.
- Breaking changes: `feat!: ...` or a `BREAKING CHANGE:` footer.
- Reverts: `revert: <original header>`. GitHub's Revert button titles the PR `Revert "..."`, which the
  title check rejects — retitle it.

## PR titles carry the ticket

`<type>(<optional scope>): <TICKET-123> | <description>`, e.g. `feat(auth): RSD-123 | add password reset`.

- Take the ticket from the branch name (`feature/RSD-123-...`) or from what the user said. If there
  is none, drop the `TICKET-123 | ` prefix — **never invent a ticket number**.
- Squash merges use the PR title as the commit on the main branch, so the title is what history
  keeps. Commits on the branch may carry the ticket too, but need not.

## PR descriptions follow the template

Fill in `.github/pull_request_template.md` section by section and pass it as `--body` to
`gh pr create` — `gh` does not apply the template when a body is given. Keep every heading as
written, emoji included, write "None" under a section that doesn't apply rather than deleting it,
and drop the HTML comments.

Keep **every checkbox with its full description**; tick the ones that are true and leave the rest
unticked. Never cut a box down to its bold label — the description is what tells the reviewer what
the box means.

**Be brief everywhere except the test plan.** The TL;DR is one sentence; "Why it matters" is one or
two, about the problem or outcome, not a recap of the changes; each change is one line. No
preamble, no restating the title, no list of every file touched.

**Make the test plan thorough enough that a new engineer can check the work without you:**

- Setup from a fresh clone: branch, install, env vars, seed data, accounts, flags.
- Numbered steps with the exact command, URL or click path, each ending in **Expect:** and a result
  specific enough to tell pass from fail. "It works" is not an expectation.
- Edge cases and failure paths: bad or empty input, permissions, failing dependencies.
- What the plan doesn't cover, and why.

**Report honestly.** Tick only boxes you verified. For each step, say whether you ran it and what
you saw; mark steps you didn't run as _for the reviewer_. Never present an unrun step as done.

## Hooks

CI checks PR titles, and where the repo has a `commit-msg` hook, commitlint checks commits. When
either rejects a message, fix the message. **Never bypass hooks** with `--no-verify`, `-n` or
`LEFTHOOK=0`.

## Changesets

A PR that changes what a published package does (`packages/storybook-addon-lineage`,
`packages/payload-lineage`, or `packages/lineage-core`, which is built into both) adds a changeset
with `pnpm changeset`, or by writing `.changeset/<name>.md` directly: the packages, the bump
(`patch` for fixes, `minor` for features while below 1.0) and one changelog line for users. Docs,
tests, CI and examples need none. Never edit versions or `CHANGELOG.md` by hand; the Version
Packages PR does that.
