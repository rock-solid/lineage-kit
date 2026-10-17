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
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import semver from 'semver';

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

/**
 * Runs a command and returns its output; with `write`, only prints it on a dry run. `quiet` hides
 * its errors, for lookups that are allowed to fail.
 */
function run(cmd, args, { write = false, quiet = false } = {}) {
  if (write && dryRun) {
    console.log(`  [dry run] ${cmd} ${args.join(' ')}`);
    return '';
  }
  return execFileSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'inherit'],
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
    .map((entry) => ({
      folder: entry.name,
      file: path.join(root, 'packages', entry.name, 'package.json'),
    }))
    // A folder another branch left behind (only node_modules) isn't a package
    .filter(({ file }) => existsSync(file))
    .map((pkg) => ({ ...pkg, json: JSON.parse(readFileSync(pkg.file, 'utf8')) }))
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

/** Where the Release workflow publishes a package: its `publishConfig.registry`, else npmjs.com. */
function registryName(json) {
  const registry = json.publishConfig?.registry ?? 'https://registry.npmjs.org';
  return new URL(registry).hostname === 'npm.pkg.github.com' ? 'GitHub Packages' : 'npmjs.com';
}

function tagExists(tag) {
  return (
    Boolean(run('git', ['tag', '--list', tag])) ||
    Boolean(run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]))
  );
}

/**
 * The version to release, with npm's rules (the `semver` package): `patch` after `0.2.0-rc.1` is
 * `0.2.0`, and an exact version must be valid SemVer as written, so `01.2.3` or `1.2.3-rc_1` fail.
 */
function nextVersion(current, bump) {
  if (['patch', 'minor', 'major'].includes(bump)) return semver.inc(current, bump);
  if (semver.valid(bump ?? '') !== bump) {
    fail(`"${bump}" isn't patch, minor, major or a valid version like 1.2.3 or 1.2.3-rc.1.`);
  }
  return bump;
}

/**
 * The package's commits since its last release tag (or since the start, for a first release). The
 * last tag is the nearest one in main's history, not the highest, which could be a later hotfix.
 */
function changesSinceLastTag(folder) {
  let lastTag = '';
  try {
    lastTag = run('git', ['describe', '--tags', '--abbrev=0', '--match', `${folder}@*`, 'HEAD'], {
      quiet: true,
    });
  } catch {
    // No release tag yet
  }
  const range = lastTag ? [`${lastTag}..HEAD`] : [];
  const log = run('git', ['log', '--format=- %s', ...range, '--', `packages/${folder}`]);
  return { lastTag, log: log || '- (no commits touch the package)' };
}

const pkg = findPackage(values.package);
const current = pkg.json.version;

if (command === 'prepare') {
  assertOnUpToDateMain();
  if (!semver.valid(current)) fail(`The current version, ${current}, isn't valid SemVer.`);
  const version = nextVersion(current, bump);
  if (!semver.gt(version, current)) fail(`${version} isn't higher than the current ${current}.`);
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
    `1. The Release workflow runs for \`${tag}\` → **Expect:** it publishes ${pkg.json.name}@${version} to ${registryName(pkg.json)} and creates a GitHub Release with notes.`,
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
