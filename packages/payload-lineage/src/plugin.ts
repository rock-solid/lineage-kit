import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Config, Plugin } from 'payload';

import { buildContentGraph, type PayloadConfigLike } from './graph';
import { buildSchema } from './schema';
import { resolveSnapshot, writeSnapshot, type ResolvedSnapshot } from './snapshot';
import type { ContentGraphOptions, LineageCustomConfig, LineagePluginOptions } from './types';

const PACKAGE = '@rocksoliddigital/payload-lineage';

/**
 * Adds content lineage to a Payload config: the Lineage and Data model pages in the admin, at
 * `/admin/lineage` and `/admin/lineage/schema`; with `outputFile`, the lineage graph as JSON on
 * each start outside production; with `snapshot`, the files the pages' "Changed since main" view
 * compares with.
 */
export function lineagePlugin({
  enabled = true,
  adminView = true,
  access,
  outputFile,
  snapshot: snapshotOption,
  ...graphOptions
}: LineagePluginOptions = {}): Plugin {
  return (config: Config): Config => {
    if (!enabled) return config;
    const production = process.env.NODE_ENV === 'production';
    // Off in production: it needs git and the base branch, which a server rarely has
    const snapshot = production ? undefined : resolveSnapshot(snapshotOption);
    let result = config;
    if (adminView) result = withAdminView(result, { graphOptions, access, snapshot });
    if (outputFile && !production) {
      result = withOutputFile(result, outputFile, graphOptions);
    }
    if (snapshot) result = withSnapshot(result, snapshot, graphOptions);
    return result;
  };
}

function withAdminView(config: Config, lineage: LineageCustomConfig): Config {
  const components = config.admin?.components;
  return {
    ...config,
    // For the pages and the nav link to read on the server; Payload never sends `custom` to the browser
    custom: { ...config.custom, lineage },
    admin: {
      ...config.admin,
      components: {
        ...components,
        // A server component, so it can check access before rendering the link
        afterNavLinks: [...(components?.afterNavLinks ?? []), `${PACKAGE}/rsc#LineageNavLink`],
        views: {
          ...components?.views,
          // Exact, so `/lineage` doesn't also match the data model below it
          lineage: {
            Component: `${PACKAGE}/rsc#LineageView`,
            exact: true,
            path: '/lineage',
          },
          lineageSchema: {
            Component: `${PACKAGE}/rsc#SchemaView`,
            exact: true,
            path: '/lineage/schema',
          },
        },
      },
    },
  };
}

function withOutputFile(
  config: Config,
  outputFile: string,
  graphOptions: ContentGraphOptions,
): Config {
  return {
    ...config,
    onInit: async (payload) => {
      await config.onInit?.(payload);
      // A lineage file mustn't stop the admin starting, e.g. on a read-only filesystem, so a
      // failure is only a warning. The existing onInit's errors still propagate.
      try {
        // The sanitized config, so collections other plugins add (e.g. form-builder's) are in it
        const graph = buildContentGraph(payload.config as PayloadConfigLike, graphOptions);
        const file = path.resolve(outputFile);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, `${JSON.stringify(graph, null, 2)}\n`);
        payload.logger.info(
          `Lineage: wrote ${graph.nodes.length} nodes and ${graph.edges.length} edges to ${outputFile}`,
        );
      } catch (err) {
        payload.logger.warn({ err, msg: `Lineage: couldn't write ${outputFile}` });
      }
    },
  };
}

function withSnapshot(
  config: Config,
  snapshot: ResolvedSnapshot,
  graphOptions: ContentGraphOptions,
): Config {
  return {
    ...config,
    onInit: async (payload) => {
      await config.onInit?.(payload);
      // As with the lineage file, a failure is only a warning
      try {
        const sanitized = payload.config as PayloadConfigLike;
        const wrote = [
          await writeSnapshot(snapshot.dir, 'graph', buildContentGraph(sanitized, graphOptions)),
          await writeSnapshot(snapshot.dir, 'schema', buildSchema(sanitized, graphOptions)),
        ];
        if (wrote.some(Boolean))
          payload.logger.info(`Lineage: updated the snapshot in ${snapshot.dir}`);
      } catch (err) {
        payload.logger.warn({
          err,
          msg: `Lineage: couldn't write the snapshot in ${snapshot.dir}`,
        });
      }
    },
  };
}
