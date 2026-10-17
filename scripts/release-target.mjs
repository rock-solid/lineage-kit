#!/usr/bin/env node
// What a release tag publishes, for the Release workflow: `<package folder>@<version>`, e.g.
// `payload-lineage@0.1.0`. Checks the folder is a public package at that version, and works out
// the registry (the package's `publishConfig.registry`, else npmjs.com) and the dist-tag (`next`
// for a prerelease like 0.2.0-rc.1, so `npm install` doesn't pick it up, else `latest`).
//
//   node scripts/release-target.mjs <tag>    prints the result, or adds it to $GITHUB_OUTPUT
//
// Plain Node, no dependencies: the workflow runs it before installing anything.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const NPM = 'https://registry.npmjs.org';

/** The release a tag describes, or an error saying why it isn't one. */
export function releaseTarget(tag, readPackage = readPackageJson) {
  const at = tag.lastIndexOf('@');
  const folder = tag.slice(0, at);
  const version = tag.slice(at + 1);
  if (at <= 0 || !/^[a-z0-9-]+$/.test(folder) || !version) {
    return { error: `"${tag}" isn't <package folder>@<version>, e.g. payload-lineage@0.1.0` };
  }
  const pkg = readPackage(folder);
  if (!pkg) return { error: `No package in packages/${folder}` };
  if (pkg.private) return { error: `packages/${folder} is private, so it isn't published` };
  if (pkg.version !== version) {
    return { error: `${tag} doesn't match packages/${folder}, which is at ${pkg.version}` };
  }
  const registry = (pkg.publishConfig?.registry ?? NPM).replace(/\/$/, '');
  return {
    folder,
    name: pkg.name,
    version,
    registry,
    github: new URL(registry).hostname === 'npm.pkg.github.com',
    distTag: version.includes('-') ? 'next' : 'latest',
  };
}

function readPackageJson(folder) {
  const file = path.join(root, 'packages', folder, 'package.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

if (import.meta.filename === process.argv[1]) {
  const target = releaseTarget(process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '');
  if (target.error) {
    console.error(`::error title=Release::${target.error}`);
    process.exit(1);
  }
  const lines = Object.entries(target).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}
