import type { Block } from 'payload';

// Shared blocks, defined once in `config.blocks` and used by slug (`blockReferences`)

export const CallToAction: Block = {
  slug: 'callToAction',
  labels: { singular: 'Call to action', plural: 'Calls to action' },
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'page', type: 'relationship', relationTo: 'pages' },
  ],
};

export const MediaBlock: Block = {
  slug: 'mediaBlock',
  labels: { singular: 'Media block', plural: 'Media blocks' },
  fields: [{ name: 'media', type: 'upload', relationTo: 'media', required: true }],
};

export const PostList: Block = {
  slug: 'postList',
  labels: { singular: 'Post list', plural: 'Post lists' },
  fields: [{ name: 'posts', type: 'relationship', relationTo: 'posts', hasMany: true }],
};
