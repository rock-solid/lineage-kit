// The rules for PR titles in CI: the repo's own, with commitlint's default ignores off. Those
// ignores wave `v1.2.3`, `Revert "..."`, `Merge ...` and `fixup!` messages through unchecked, and
// a PR title becomes the squash commit on main. The commit-msg hook keeps them, for `fixup!`
// commits.
// Dependabot's titles start with a capital `Bump`, and it can't be told otherwise. Only its exact
// shapes pass: `ci: Bump actions/checkout from 7 to 8` and `ci: Bump the actions group with 2 updates`.
const DEPENDABOT =
  /^[a-z]+(\([\w./-]+\))?: Bump (\S+ from \S+ to \S+( in \S+)?|the \S+ group( in \S+)? with \d+ updates?)$/;

export default {
  extends: ['./commitlint.config.mjs'],
  defaultIgnores: false,
  ignores: [(title) => DEPENDABOT.test(title.trim())],
};
