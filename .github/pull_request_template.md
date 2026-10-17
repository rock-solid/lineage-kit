<!--
Title: <type>(<scope>): TICKET-123 | lowercase description — drop "TICKET-123 | " if there is none.

Keep it brief: one idea per line, bullets over paragraphs, cut every word that doesn't earn its place.
The test plan is the exception. Write it so an engineer new to this codebase can check the work
without asking you.
-->

**TL;DR:** <!-- One sentence: what this PR does. -->

**Ticket:** <!-- link, or "none" -->

## 🎯 Why it matters

<!-- One or two sentences: the problem it solves, who it affects, or what it makes possible. -->

## 📝 What changed

- <!-- One line per change. Bold the part a reviewer should look at first. -->

## 🧪 Test plan

**Setup**
<!-- Everything needed from a fresh clone: branch, install, env vars, seed data, test accounts, flags. -->

1.

**Steps**
<!-- Numbered. Each step: the exact command, URL or click path, then what you should see. -->

1. → **Expect:**

**Edge cases and failure paths**
<!-- How this could break: bad or empty input, permissions, slow or failing dependencies, retries. -->

- [ ]

**Automated**

- [ ] Lint, type checks and tests pass
- [ ] New or changed behaviour has a test: <!-- name it, or say why not -->
- [ ] A changeset for each package whose behaviour changes (`pnpm changeset`): <!-- or say why none is needed -->

**Not covered**
<!-- What this plan doesn't check, and why. "Nothing" is a valid answer. -->
