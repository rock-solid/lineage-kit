import { cp } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    preset: 'src/preset.ts',
    manager: 'src/manager.tsx',
  },
  format: 'esm',
  // Only the public API needs types; the preset and manager are loaded by Storybook
  dts: { entry: { index: 'src/index.ts' } },
  splitting: true,
  clean: true,
  target: 'es2022',
  // Resolved by the consumer's Storybook: the virtual module by our Vite plugin, CSS by Vite
  external: ['virtual:lineage-graph', './lineage.css'],
  // Copied as they are: the CSS for the consumer's Vite to load next to the chunks that import it,
  // the story because Storybook's indexer needs its literal `export default`
  onSuccess: async () => {
    await cp('src/lineage.css', 'dist/lineage.css');
    await cp('src/stories', 'dist/stories', { recursive: true });
  },
});
