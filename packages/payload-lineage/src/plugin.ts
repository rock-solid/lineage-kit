import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Config, Plugin } from 'payload';

import { buildContentGraph, type PayloadConfigLike } from './graph';
import type { ContentGraphOptions, LineageCustomConfig, LineagePluginOptions } from './types';

const PACKAGE = '@rock-solid/payload-lineage';

/**
 * Adds content lineage to a Payload config: a page in the admin at `/admin/lineage`, and with
 * `outputFile`, the graph as JSON on each start outside production.
 */
export function lineagePlugin({
  enabled = true,
  adminView = true,
  access,
  outputFile,
  ...graphOptions
}: LineagePluginOptions = {}): Plugin {
  return (config: Config): Config => {
    if (!enabled) return config;
    let result = config;
    if (adminView) result = withAdminView(result, { graphOptions, access });
    if (outputFile && process.env.NODE_ENV !== 'production') {
      result = withOutputFile(result, outputFile, graphOptions);
    }
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
