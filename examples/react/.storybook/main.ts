import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    {
      name: '@rock-solid/storybook-addon-lineage',
      options: {
        layers: [
          {
            id: 'primitive',
            label: 'UI primitives',
            match: /^src\/components\/ui\//,
            color: '#7c3aed',
          },
          { id: 'component', label: 'Components', match: /^src\/components\//, color: '#2563eb' },
          { id: 'page', label: 'Pages', match: /^src\/pages\//, color: '#be123c' },
          {
            id: 'utility',
            label: 'Utilities',
            match: /^src\/lib\//,
            color: '#475569',
            hidden: true,
          },
        ],
      },
    },
  ],
  framework: '@storybook/react-vite',
};

export default config;
