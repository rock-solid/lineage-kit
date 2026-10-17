// An optional ticket, then a description starting with a lowercase letter or a digit:
// `feat: RSD-123 | add x`, `feat: add x`, `feat: 404 page redirect`. Only the first character is
// checked, like config-conventional's subject-case, so proper nouns later in the subject pass
// (`add GitHub login`).
// The commit-msg hook uses this file. CI checks PR titles against it too, with commitlint's default
// ignores off (rock-solid/github-actions pr-title-lint); the hook keeps them for `fixup!` commits.
const SUBJECT = /^(?:[A-Z][A-Z0-9]+-\d+ \| )?[a-z0-9].*$/;

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-ticket-format': ({ subject }) => [
          !subject || SUBJECT.test(subject),
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
