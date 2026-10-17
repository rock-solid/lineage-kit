import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    a11y: { test: 'error' },
  },
};

export default preview;
