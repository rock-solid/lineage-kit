// The snapshot files the "Changed since main" view compares with: the lineage graph and the data
// model as JSON, committed with the config, and read back from the base branch with git.

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { Schema } from './schema';
import type { ContentGraph, SnapshotOptions } from './types';

const run = promisify(execFile);

export const SNAPSHOT_FILES = { graph: 'graph.json', schema: 'schema.json' } as const;
export type SnapshotKind = keyof typeof SNAPSHOT_FILES;
export type SnapshotContents = { graph: ContentGraph; schema: Schema };
type Contents = SnapshotContents;

export type ResolvedSnapshot = { dir: string; baseBranch: string };

export function resolveSnapshot(
  option: boolean | SnapshotOptions | undefined,
): ResolvedSnapshot | undefined {
  if (!option) return undefined;
  const { dir = 'lineage', baseBranch = 'main' } = option === true ? {} : option;
  return { dir, baseBranch };
}

export function toJSON(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Writes one snapshot file, if its content changed, so a page visit doesn't touch the file (or its
 * modified time) for nothing. Returns whether it wrote.
 */
export async function writeSnapshot<K extends SnapshotKind>(
  dir: string,
  kind: K,
  value: Contents[K],
): Promise<boolean> {
  const file = path.resolve(dir, SNAPSHOT_FILES[kind]);
  const text = toJSON(value);
  const existing = await readFile(file, 'utf8').catch(() => null);
  if (existing === text) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
  return true;
}

/**
 * What the pages compare with: the snapshot as it was where HEAD left the base branch (the merge
 * base, as `git diff main...` uses), so other branches merged since don't show as changes here.
 */
export type BaseSnapshot<T> =
  | { state: 'ready'; base: string; value: T }
  /** The base branch has no snapshot yet, e.g. on the PR that adds the option. */
  | { state: 'no-snapshot'; base: string }
  /** The base branch's file isn't JSON, e.g. after a badly resolved merge conflict. */
  | { state: 'invalid'; base: string }
  /** No git, or no base branch to compare with, e.g. a shallow CI clone. */
  | { state: 'no-base'; branch: string };

// By merge base and file: what a commit holds never changes
const cache = new Map<string, unknown>();
const MISSING = Symbol('missing');
const INVALID = Symbol('invalid');

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return INVALID;
  }
}

export async function readBaseSnapshot<K extends SnapshotKind>(
  { dir, baseBranch }: ResolvedSnapshot,
  kind: K,
  cwd = process.cwd(),
): Promise<BaseSnapshot<Contents[K]>> {
  // A large config's data model can pass `execFile`'s 1 MiB default
  const git = async (...args: string[]) =>
    (await run('git', args, { cwd, maxBuffer: 256 * 1024 * 1024 })).stdout.trim();
  let base: string | undefined;
  let mergeBase: string;
  try {
    // The remote branch first: a local main is often behind
    for (const ref of [`origin/${baseBranch}`, baseBranch]) {
      const found = await git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`).catch(
        () => null,
      );
      if (found) {
        base = ref;
        break;
      }
    }
    if (!base) return { state: 'no-base', branch: baseBranch };
    mergeBase = await git('merge-base', 'HEAD', base);
  } catch {
    return { state: 'no-base', branch: baseBranch };
  }

  // `./` makes the path relative to `cwd`, where the plugin writes the files, not the repo's root
  const relative = path
    .relative(cwd, path.resolve(cwd, dir, SNAPSHOT_FILES[kind]))
    .split(path.sep)
    .join('/');
  const file = relative.startsWith('../') ? relative : `./${relative}`;
  const key = `${mergeBase}:${file}`;
  if (!cache.has(key)) {
    const text = await git('show', `${mergeBase}:${file}`).catch(() => null);
    cache.set(key, text === null ? MISSING : parse(text));
  }
  const value = cache.get(key);
  if (value === MISSING) return { state: 'no-snapshot', base };
  if (value === INVALID) return { state: 'invalid', base };
  return { state: 'ready', base, value: value as Contents[K] };
}
