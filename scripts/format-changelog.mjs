// Runs after `changeset version` (`pnpm version-packages`): turns the newest entry of each
// package's CHANGELOG.md into release notes grouped by type. The Release workflow copies that
// entry into the package's GitHub Release, so both read the same.
//
//   ### Minor Changes  →  ### 🚀 Features
//   ### Patch Changes  →  ### 🐛 Bug Fixes
//   ### Major Changes  →  ### ⚠️ Breaking Changes
//
// and the authors .changeset/changelog.mjs left in hidden comments become a Contributors list.
// An entry already in this form is left alone, so running it twice changes nothing.

import { glob, readFile, writeFile } from 'node:fs/promises';

const SECTIONS = {
  Major: '⚠️ Breaking Changes',
  Minor: '🚀 Features',
  Patch: '🐛 Bug Fixes',
};
const CONTRIBUTOR = / <!-- contributor: (.+?) -->/g;

export function formatEntry(entry) {
  if (!/^### (Major|Minor|Patch) Changes$/m.test(entry)) return entry;
  const contributors = [...new Set([...entry.matchAll(CONTRIBUTOR)].map((match) => match[1]))];
  let formatted = entry
    .replace(/^### (Major|Minor|Patch) Changes$/gm, (_, type) => `### ${SECTIONS[type]}`)
    .replace(CONTRIBUTOR, '')
    .trimEnd();
  if (contributors.length) {
    formatted += `\n\n### 🤝 Contributors\n\n${contributors.map((name) => `- ${name}`).join('\n')}`;
  }
  return `${formatted}\n`;
}

// The newest entry runs from the first `## ` heading to the next one.
export function formatChangelog(changelog) {
  const start = changelog.search(/^## /m);
  if (start === -1) return changelog;
  const next = changelog.slice(start + 3).search(/^## /m);
  const end = next === -1 ? changelog.length : start + 3 + next;
  const entry = changelog.slice(start, end);
  const formatted = formatEntry(entry);
  if (formatted === entry) return changelog;
  return changelog.slice(0, start) + formatted + (next === -1 ? '' : '\n') + changelog.slice(end);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for await (const path of glob(['CHANGELOG.md', '{packages,apps}/*/CHANGELOG.md'])) {
    const changelog = await readFile(path, 'utf8');
    const formatted = formatChangelog(changelog);
    if (formatted !== changelog) {
      await writeFile(path, formatted);
      console.log(`Formatted ${path}`);
    }
  }
}
