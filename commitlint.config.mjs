// An optional ticket, then a description starting with a lowercase letter or a digit:
// `feat: RSD-123 | add x`, `feat: add x`, `feat: 404 page redirect`. Only the first character is
// checked, like config-conventional's subject-case, so proper nouns later in the subject pass
// (`add GitHub login`).
// The commit-msg hook uses this file. CI checks PR titles against it too, with commitlint's default
// ignores off (commitlint.pr-title.config.mjs); the hook keeps them for `fixup!` commits.
const SUBJECT = /^(?:[A-Z][A-Z0-9]+-\d+ \| )?[a-z0-9].*$/;
// Dependabot titles its PRs with a capital `Bump` and can't be told otherwise, so its subjects are
// accepted too: `Bump actions/checkout from 7 to 8`, `Bump the actions group with 2 updates`,
// `Bump the actions group across 1 directory with 2 updates`. Only the subject is let through: the
// type, scope and length rules still apply.
const DEPENDABOT = /^Bump (\S+ from \S+ to \S+|the \S+ group)( (in|across|with) .+)?$/;

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-ticket-format': ({ subject }) => [
          !subject || SUBJECT.test(subject) || DEPENDABOT.test(subject),
          'subject must be "TICKET-123 | description" or "description", starting with a lowercase letter or digit',
        ],
      },
    },
  ],
  rules: {
    // Reads the ticket's capitals as a sentence-case subject; subject-ticket-format replaces it.
    'subject-case': [0],
    'subject-ticket-format': [2, 'always'],
  },
};
