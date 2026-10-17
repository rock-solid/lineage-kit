import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InlineConfig } from 'vite';

import type { LineageOptions } from './types';
import { lineagePlugin } from './vite-plugin';

const PACKAGE_NAME = '@rocksoliddigital/storybook-addon-lineage';

// Storybook passes the addon's `options` (from main.ts) to each preset function, next to its own
// options such as `configDir`.
type PresetOptions = LineageOptions & { configDir: string };

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));

// The toolbar button (manager.js) needs no entry here: Storybook loads a package's `./manager`
// export by itself, and listing it too registers it twice.

/** The Lineage page itself, so projects don't add a story file for it. */
export const stories = (entries: unknown[] = []) => [
  ...entries,
  { directory: here('./stories'), files: '*.stories.js', titlePrefix: '' },
];

/** Builds the graph and serves it to the viewer as `virtual:lineage-graph`. */
export const viteFinal = (config: InlineConfig, options: PresetOptions) => {
  const { srcDir, tsConfig, exclude, baseBranch, layers, configDir } = options;
  // The project is the folder above .storybook
  const root = path.dirname(path.resolve(configDir));

  config.plugins = [
    ...(config.plugins ?? []),
    lineagePlugin({ srcDir, tsConfig, exclude, baseBranch, layers }, root),
  ];
  // Vite's dependency pre-bundling doesn't run plugins, so it can't resolve the virtual module
  config.optimizeDeps = {
    ...config.optimizeDeps,
    exclude: [...(config.optimizeDeps?.exclude ?? []), PACKAGE_NAME],
    include: [
      ...(config.optimizeDeps?.include ?? []),
      `${PACKAGE_NAME} > elkjs/lib/elk.bundled.js`,
      `${PACKAGE_NAME} > @xyflow/react`,
    ],
  };
  return config;
};
