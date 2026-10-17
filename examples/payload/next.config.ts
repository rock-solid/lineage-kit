import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // The repo root, so Turbopack follows the workspace link to packages/payload-lineage
  turbopack: { root: path.resolve(dirname, '../..') },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
