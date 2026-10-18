// Changesets changelog module: writes each changeset as one line,
//   - **scope:** summary ([#12](pull)) ([abc1234](commit))
// with the scope taken from the PR's Conventional Commits title. The author rides along in a hidden
// comment for scripts/format-changelog.mjs, which runs after `changeset version` and turns the
// bump headings into emoji sections with a Contributors list.
//
// Needs GITHUB_TOKEN (the Release workflow has one) to look up the PR and author of the commit
// that added each changeset. A changeset can name them itself with `pr: #12`, `commit: abc1234`
// or `author: @name` lines, as with @changesets/changelog-github.

const API = 'https://api.github.com';
const SERVER = process.env.GITHUB_SERVER_URL || 'https://github.com';

async function github(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('Set GITHUB_TOKEN to generate the changelog: it looks up PRs on GitHub.');
  }
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(`GitHub API ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

const names = new Map();
function displayName(login) {
  if (!names.has(login)) {
    names.set(
      login,
      github(`/users/${login}`).then((user) => user?.name || login),
    );
  }
  return names.get(login);
}

// `feat(storybook): RSD-12 | add x` → `storybook`
function scopeOf(title) {
  return /^\w+(?:\(([^)]+)\))?!?:/.exec(title ?? '')?.[1];
}

function getRepo(options) {
  const repo = options?.repo || process.env.GITHUB_REPOSITORY;
  if (!repo)
    throw new Error(
      'Give the changelog module a repo: ["./changelog.mjs", { "repo": "org/repo" }]',
    );
  return repo;
}

async function getReleaseLine(changeset, _type, options) {
  const repo = getRepo(options);
  let pullNumber;
  let commit = changeset.commit;
  let author;
  const summary = changeset.summary
    .replace(
      /^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im,
      (_, n) => ((pullNumber = Number(n)), ''),
    )
    .replace(/^\s*commit:\s*(\S+)/im, (_, sha) => ((commit = sha), ''))
    .replace(/^\s*(?:author|user):\s*@?(\S+)/im, (_, login) => ((author = login), ''))
    .trim();

  let pull;
  if (pullNumber) {
    pull = await github(`/repos/${repo}/pulls/${pullNumber}`);
    commit ??= pull?.merge_commit_sha;
  } else if (commit) {
    pull = (await github(`/repos/${repo}/commits/${commit}/pulls`))?.[0];
  }
  author ??= pull?.user?.login;
  if (!author && commit) author = (await github(`/repos/${repo}/commits/${commit}`))?.author?.login;

  const scope = scopeOf(pull?.title);
  const [first, ...rest] = summary.split('\n').map((line) => line.trimEnd());
  const links = [
    pull && `([#${pull.number}](${SERVER}/${repo}/pull/${pull.number}))`,
    commit && `([${commit.slice(0, 7)}](${SERVER}/${repo}/commit/${commit}))`,
  ].filter(Boolean);
  const contributor = author
    ? ` <!-- contributor: ${await displayName(author)} (@${author}) -->`
    : '';

  return [
    `\n- ${scope ? `**${scope}:** ` : ''}${[first, ...links].join(' ')}${contributor}`,
    ...rest.map((line) => (line ? `  ${line}` : '')),
  ].join('\n');
}

// Workspace packages this release depends on that were bumped in the same release
async function getDependencyReleaseLine(_changesets, dependenciesUpdated) {
  if (!dependenciesUpdated.length) return '';
  return `\n- Updated dependencies: ${dependenciesUpdated
    .map((dependency) => `${dependency.name}@${dependency.newVersion}`)
    .join(', ')}`;
}

export default { getReleaseLine, getDependencyReleaseLine };
