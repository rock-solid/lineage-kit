import type { CollectionConfig, GlobalConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [{ name: 'name', type: 'text' }],
};

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Media item', plural: 'Media' },
  upload: true,
  fields: [{ name: 'alt', type: 'text', required: true }],
};

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
    // A group: its fields show as `hero.image` on both pages
    {
      name: 'hero',
      type: 'group',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [],
      blockReferences: ['callToAction', 'mediaBlock', 'postList'],
    },
    // Points at its own collection: a ↻ on the node and the row
    { name: 'parent', type: 'relationship', relationTo: 'pages' },
  ],
};

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true },
  ],
};

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Category', plural: 'Categories' },
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
    // The other side of Posts' `categories`: a row on the data model, not a second line
    { name: 'posts', type: 'join', collection: 'posts', on: 'categories' },
  ],
};

export const Header: GlobalConfig = {
  slug: 'header',
  fields: [
    {
      name: 'nav',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'page', type: 'relationship', relationTo: 'pages', required: true },
      ],
    },
  ],
};
