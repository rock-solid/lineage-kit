import { cp } from 'node:fs/promises';
import { defineConfig } from 'tsup';

const shared = { format: 'esm', target: 'es2022', dts: true, clean: false } as const;

export default defineConfig([
  // The plugin, and the admin view as a server component
  {
    ...shared,
    entry: { index: 'src/index.ts', rsc: 'src/rsc.tsx' },
    // Kept as an import, so the client components stay behind their 'use client' boundary
    external: ['./client.js'],
  },
  // The client components, loaded through Payload's import map
  {
    ...shared,
    entry: { client: 'src/client.ts' },
    banner: { js: "'use client';" },
    // Resolved by the consumer's bundler; the CSS is copied as it is
    external: ['./lineage.css'],
    onSuccess: async () => {
      await cp('src/view/lineage.css', 'dist/lineage.css');
    },
  },
]);
