// The rules for PR titles in CI: the repo's own, with commitlint's default ignores off. Those
// ignores wave `v1.2.3`, `Revert "..."`, `Merge ...` and `fixup!` messages through unchecked, and
// a PR title becomes the squash commit on main. The commit-msg hook keeps them, for `fixup!`
// commits.
export default {
  extends: ['./commitlint.config.mjs'],
  defaultIgnores: false,
};
