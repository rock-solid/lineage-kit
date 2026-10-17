#!/usr/bin/env node
// Releases a package in two steps, because main only takes changes through a PR:
//
//   pnpm release prepare <patch|minor|major|x.y.z>   bump the version on a release branch, open its PR
//   pnpm release tag                                 after that PR merges: tag main, which publishes
//
// Options: --package <name> (needed once the repo has more than one), --dry-run (print, change
// nothing). The tag is `<package folder>@<version>`, e.g. `storybook-addon-lineage@0.2.0`; the
// Release workflow publishes on it.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    package: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});
const dryRun = values['dry-run'];
const [command, bump] = positionals;

const USAGE = `Usage:
  pnpm release prepare <patch|minor|major|x.y.z>   bump the version on a release branch, open its PR
  pnpm release tag                                 after that PR merges: tag main, which publishes

Options:
  --package <name>   the package to release, once the repo has more than one
  --dry-run          print what would happen, change nothing`;

if (values.help || !['prepare', 'tag'].includes(command)) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

/** Runs a command and returns its output; with `write`, only prints it on a dry run. */
function run(cmd, args, { write = false } = {}) {
  if (write && dryRun) {
    console.log(`  [dry run] ${cmd} ${args.join(' ')}`);
    return '';
  }
  return execFileSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

/** The publishable packages in packages/, by folder name. */
function findPackage(name) {
  const packages = readdirSync(path.join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(root, 'packages', entry.name, 'package.json');
      return { folder: entry.name, file, json: JSON.parse(readFileSync(file, 'utf8')) };
    })
    .filter((pkg) => !pkg.json.private);
  if (name) {
    const pkg = packages.find((p) => p.folder === name || p.json.name === name);
    if (!pkg) fail(`No package "${name}". Packages: ${packages.map((p) => p.folder).join(', ')}`);
    return pkg;
  }
  if (packages.length !== 1) {
    fail(`Pick one with --package: ${packages.map((p) => p.folder).join(', ')}`);
  }
  return packages[0];
}

/** Clean tree, on main, and level with origin/main, so the release is what's on main. */
function assertOnUpToDateMain() {
  if (run('git', ['status', '--porcelain']))
    fail('The working tree has changes. Commit or stash them first.');
  const branch = run('git', ['branch', '--show-current']);
  if (branch !== 'main') fail(`Run this on main (you're on ${branch}).`);
  run('git', ['fetch', '--quiet', '--tags', 'origin', 'main']);
  if (run('git', ['rev-parse', 'HEAD']) !== run('git', ['rev-parse', 'origin/main'])) {
    fail('main is not level with origin/main. Pull (or push) first.');
  }
}

function tagExists(tag) {
  return (
    Boolean(run('git', ['tag', '--list', tag])) ||
    Boolean(run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]))
  );
}

function nextVersion(current, bump) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(bump ?? ''))
    fail(`"${bump}" isn't patch, minor, major or a version like 1.2.3.`);
  return bump;
}

/** True when a is a higher version than b (pre-release suffixes count as lower). */
function isHigher(a, b) {
  const parts = (v) => v.split('-')[0].split('.').map(Number);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return !a.includes('-') && b.includes('-');
}

/** The package's commits since its last release tag (or since the start, for a first release). */
function changesSinceLastTag(folder) {
  const lastTag = run('git', ['tag', '--list', `${folder}@*`, '--sort=-v:refname']).split('\n')[0];
  const range = lastTag ? [`${lastTag}..HEAD`] : [];
  const log = run('git', ['log', '--format=- %s', ...range, '--', `packages/${folder}`]);
  return { lastTag, log: log || '- (no commits touch the package)' };
}

const pkg = findPackage(values.package);
const current = pkg.json.version;

if (command === 'prepare') {
  assertOnUpToDateMain();
  const version = nextVersion(current, bump);
  if (!isHigher(version, current)) fail(`${version} isn't higher than the current ${current}.`);
  const tag = `${pkg.folder}@${version}`;
  if (tagExists(tag)) fail(`${tag} is already tagged.`);

  const branch = `release/${pkg.folder}-${version}`;
  const title = `chore(release): ${pkg.folder} ${version}`;
  const { lastTag, log } = changesSinceLastTag(pkg.folder);
  console.log(`Preparing ${pkg.json.name} ${current} → ${version}${dryRun ? ' (dry run)' : ''}`);

  run('git', ['switch', '-c', branch], { write: true });
  if (dryRun)
    console.log(`  [dry run] set "version": "${version}" in ${path.relative(root, pkg.file)}`);
  else writeFileSync(pkg.file, JSON.stringify({ ...pkg.json, version }, null, 2) + '\n');
  run('git', ['commit', '--quiet', '-am', title], { write: true });
  run('git', ['push', '--quiet', '-u', 'origin', branch], { write: true });

  const body = [
    `**TL;DR:** Releases ${pkg.json.name} ${version}.`,
    '',
    '**Ticket:** none',
    '',
    '## 🎯 Why it matters',
    '',
    `Publishes what has merged since ${lastTag || 'the start'}, so projects can install it.`,
    '',
    '## 📝 What changed',
    '',
    `- **Version ${current} → ${version}** in \`packages/${pkg.folder}/package.json\``,
    '',
    `Changes in this release:`,
    '',
    log,
    '',
    '## 🧪 Test plan',
    '',
    '**Setup**',
    '',
    `1. Merge this PR, then on an up-to-date main run \`pnpm release tag\`.`,
    '',
    '**Steps**',
    '',
    `1. The Release workflow runs for \`${tag}\` → **Expect:** it publishes ${pkg.json.name}@${version} to GitHub Packages and creates a GitHub Release with notes.`,
    '',
    '**Edge cases and failure paths**',
    '',
    "- [ ] The workflow refuses a tag that doesn't match the version",
    '',
    '**Automated**',
    '',
    '- [ ] Lint, type checks and tests pass',
    '- [ ] New or changed behaviour has a test: no code changes, version only',
    '',
    '**Not covered**',
    '',
    'Installing the published version in a project: done after the release.',
  ].join('\n');
  run(
    'gh',
    ['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', body],
    { write: true },
  );

  console.log(
    `\nNext: merge the PR, then on main run \`pnpm release tag${values.package ? ` --package ${pkg.folder}` : ''}\`.`,
  );
}

if (command === 'tag') {
  if (bump) fail('`tag` takes no version: it tags the version that main already has.');
  assertOnUpToDateMain();
  const tag = `${pkg.folder}@${current}`;
  if (tagExists(tag))
    fail(`${tag} is already tagged. Run \`pnpm release prepare <bump>\` for a new version.`);

  console.log(`Tagging ${pkg.json.name} ${current} as ${tag}${dryRun ? ' (dry run)' : ''}`);
  run('git', ['tag', '--annotate', tag, '--message', `${pkg.json.name} ${current}`], {
    write: true,
  });
  run('git', ['push', '--quiet', 'origin', tag], { write: true });

  const repo = run('gh', ['repo', 'view', '--json', 'url', '--jq', '.url']);
  console.log(`\nThe Release workflow publishes it: ${repo}/actions/workflows/release.yml`);
}
