import type { Meta, StoryObj } from '@storybook/react-vite';

import { FeatureList } from './FeatureList';

const meta = {
  title: 'Components/Feature list',
  component: FeatureList,
  args: {
    items: [
      { title: 'Trace', text: 'Hover a node to see its lineage.' },
      { title: 'Focus', text: 'Click to focus on it.' },
    ],
  },
} satisfies Meta<typeof FeatureList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
