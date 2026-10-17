import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Config, Plugin } from 'payload';

import { buildContentGraph, type PayloadConfigLike } from './graph';
import type { LineagePluginOptions } from './types';

/**
 * Adds content lineage to a Payload config. With `outputFile`, the graph is written as JSON when
 * Payload starts, for the Storybook page to merge.
 */
export function lineagePlugin({
  outputFile,
  enabled = process.env.NODE_ENV !== 'production',
  ...graphOptions
}: LineagePluginOptions = {}): Plugin {
  return (config: Config): Config => {
    if (!enabled || !outputFile) return config;
    return {
      ...config,
      onInit: async (payload) => {
        await config.onInit?.(payload);
        // The sanitized config, so collections other plugins add (e.g. form-builder's) are in it
        const graph = buildContentGraph(payload.config as PayloadConfigLike, graphOptions);
        const file = path.resolve(outputFile);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, `${JSON.stringify(graph, null, 2)}\n`);
        payload.logger.info(
          `Lineage: wrote ${graph.nodes.length} nodes and ${graph.edges.length} edges to ${outputFile}`,
        );
      },
    };
  };
}
