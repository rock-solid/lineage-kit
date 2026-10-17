import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { lineagePlugin } from '@rock-solid/payload-lineage';
import { buildConfig } from 'payload';

import { CallToAction, MediaBlock, PostList } from './blocks';
import { Categories, Header, Media, Pages, Posts, Users } from './collections';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: dirname },
  },
  collections: [Users, Media, Pages, Posts, Categories],
  globals: [Header],
  blocks: [CallToAction, MediaBlock, PostList],
  // An example only: set PAYLOAD_SECRET for anything else
  secret: process.env.PAYLOAD_SECRET || 'example-only-secret',
  // A file next to the app, so the example runs without a database server
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URL || 'file:./example.db' } }),
  typescript: { autoGenerate: false },
  plugins: [lineagePlugin({ outputFile: 'lineage/content.json' })],
});
