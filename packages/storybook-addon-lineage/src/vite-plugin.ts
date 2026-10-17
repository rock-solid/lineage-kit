import path from 'node:path';
import type { Plugin } from 'vite';

import { buildGraph } from './graph';
import type { LineageGraph, LineageOptions } from './types';

export const VIRTUAL_ID = 'virtual:lineage-graph';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const SOURCE_FILE = /\.[jt]sx?$/;

/**
 * Serves the graph as `virtual:lineage-graph`. In dev it rebuilds after source changes and hot-updates
 * the viewer only when the graph itself changed, so editing a component doesn't reload the page.
 */
export function lineagePlugin(options: LineageOptions, root: string): Plugin {
  let graph: Promise<LineageGraph> | null = null;

  return {
    name: 'lineage-kit',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      graph ??= buildGraph(options, root);
      return `export default ${JSON.stringify(await graph)};`;
    },
    configureServer(server) {
      const srcDir = path.join(root, options.srcDir ?? 'src') + path.sep;
      let timer: ReturnType<typeof setTimeout> | undefined;

      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(srcDir) || !SOURCE_FILE.test(file)) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const previous = graph && JSON.stringify(await graph);
          graph = buildGraph(options, root);
          if (JSON.stringify(await graph) === previous) return;
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) await server.reloadModule(mod);
        }, 300);
      });
    },
  };
}
