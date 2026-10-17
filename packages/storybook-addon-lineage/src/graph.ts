import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cruise, type ICruiseResult, type IModule } from 'dependency-cruiser';
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import { toId } from 'storybook/internal/csf';

import type { LineageEdge, LineageGraph, LineageNode, LineageOptions } from './types';

const STORY_FILE = /\.stories\.[jt]sx?$/;
// Code only: no stylesheets, images or declaration files
const CODE_FILE = /(?<!\.d)\.[cm]?[jt]sx?$/;
const OTHER_LAYER = { id: 'other', label: 'Other', color: '#64748b', hidden: true };
const DEFAULT_LAYERS = [{ id: 'files', label: 'Files', match: /./, color: '#2563eb' }];

/** Builds the import graph of `srcDir`, with each file assigned a layer and linked to its story. */
export async function buildGraph(
  { srcDir = 'src', layers: layerConfig = DEFAULT_LAYERS, ...options }: LineageOptions,
  root = process.cwd(),
): Promise<LineageGraph> {
  const tsConfigPath = path.resolve(root, options.tsConfig ?? 'tsconfig.json');
  const { output } = await cruise(
    [srcDir],
    {
      baseDir: root,
      tsPreCompilationDeps: true,
      doNotFollow: { path: 'node_modules' },
      exclude: { path: options.exclude ?? [] },
      tsConfig: { fileName: tsConfigPath },
    },
    undefined,
    { tsConfig: extractTSConfig(tsConfigPath) },
  );
  const modules = (output as ICruiseResult).modules.filter(
    (m) => m.source.startsWith(`${srcDir}/`) && CODE_FILE.test(m.source),
  );

  const storyIds = new Map<string, string>();
  for (const m of modules) {
    if (!STORY_FILE.test(m.source)) continue;
    const story = storyTarget(root, m);
    if (story && !storyIds.has(story.componentPath)) storyIds.set(story.componentPath, story.id);
  }

  const changes = changedFiles(root, options.baseBranch ?? 'main');
  const files = modules.filter((m) => !STORY_FILE.test(m.source));
  const ids = new Set(files.map((m) => m.source));
  const labels = uniqueLabels(files.map((m) => m.source));

  const nodes: LineageNode[] = files.map((m) => ({
    id: m.source,
    label: labels.get(m.source)!,
    layer: layerConfig.find((l) => l.match.test(m.source))?.id ?? OTHER_LAYER.id,
    ...(storyIds.has(m.source) && { storyId: storyIds.get(m.source) }),
    ...(changes?.files.has(m.source) && { changed: true }),
  }));

  // Files with no story of their own borrow one from their folder, preferring a file they import
  for (const n of nodes) {
    if (n.storyId) continue;
    const siblings = nodes.filter((o) => o.storyId && path.dirname(o.id) === path.dirname(n.id));
    const imported = new Set(
      files.find((m) => m.source === n.id)?.dependencies.map((d) => d.resolved),
    );
    const via = siblings.find((o) => imported.has(o.id)) ?? siblings[0];
    if (via) n.storyVia = { storyId: via.storyId!, label: via.label };
  }

  const edges: LineageEdge[] = files.flatMap((m) =>
    m.dependencies
      // Type-only imports don't render anything, so they aren't lineage
      .filter(
        (d) =>
          ids.has(d.resolved) &&
          d.resolved !== m.source &&
          !d.dependencyTypes.includes('type-only'),
      )
      .map((d) => ({ source: d.resolved, target: m.source })),
  );

  const layers = layerConfig.map(({ match: _match, hidden, ...layer }) => ({
    ...layer,
    hidden: !!hidden,
  }));
  if (nodes.some((n) => n.layer === OTHER_LAYER.id)) layers.push(OTHER_LAYER);

  return { layers, nodes, edges, changedSince: changes?.base ?? null };
}

/**
 * Files changed since HEAD left `branch` (dbt's `state:modified`): the diff from the merge base to the
 * working tree, plus untracked files. `null` when there is no git, or no such branch to compare with.
 */
function changedFiles(root: string, branch: string) {
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const exists = (ref: string) => {
    try {
      git('rev-parse', '--verify', '--quiet', ref);
      return true;
    } catch {
      return false;
    }
  };

  try {
    // The remote branch first: a local main is often behind
    const base = [`origin/${branch}`, branch].find(exists);
    if (!base) return null;
    const mergeBase = git('merge-base', 'HEAD', base).trim();
    const lines = [
      ...git('diff', '--name-only', '--relative', mergeBase).split('\n'),
      ...git('ls-files', '--others', '--exclude-standard').split('\n'),
    ];
    return { base, files: new Set(lines.filter(Boolean)) };
  } catch {
    return null;
  }
}

/**
 * The file a story file documents: the import that binds its `component`, so `FeatureGrid.stories.tsx`
 * with `component: FeatureGridBlock` from './Component' links to `Component.tsx`.
 */
function storyTarget(root: string, story: IModule) {
  const source = readFileSync(path.join(root, story.source), 'utf8');
  const title = source.match(/\btitle:\s*['"`]([^'"`]+)['"`]/)?.[1];
  const component = source.match(/\bcomponent:\s*([A-Za-z_$][\w$]*)/)?.[1];
  if (!title || !component) return null;

  const binding = new RegExp(`\\b${component}\\b`);
  for (const [, clause, specifier] of source.matchAll(
    /import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g,
  )) {
    if (!binding.test(clause)) continue;
    const resolved = story.dependencies.find((d) => d.module === specifier)?.resolved;
    return resolved ? { componentPath: resolved, id: toId(title, 'docs') } : null;
  }
  return null;
}

/** `Stats/Component.tsx` and `Link/index.tsx` are named after their folder; clashes fall back to `folder/file`. */
function uniqueLabels(paths: string[]) {
  const short = (p: string) => {
    const dir = path.basename(path.dirname(p));
    const base = path.basename(p).replace(/\.[jt]sx?$/, '');
    if (base === 'index' || base === 'Component') return dir;
    if (base.startsWith('Component.')) return `${dir} (${base.slice('Component.'.length)})`;
    return base;
  };
  const counts = new Map<string, number>();
  for (const p of paths) counts.set(short(p), (counts.get(short(p)) ?? 0) + 1);

  return new Map(
    paths.map((p) => {
      const label = short(p);
      if (counts.get(label) === 1) return [p, label];
      return [p, `${path.basename(path.dirname(p))}/${path.basename(p).replace(/\.[jt]sx?$/, '')}`];
    }),
  );
}
