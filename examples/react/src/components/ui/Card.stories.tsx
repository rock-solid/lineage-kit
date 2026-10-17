import type { Meta, StoryObj } from '@storybook/react-vite';

import { Card } from './Card';

const meta = {
  title: 'UI/Card',
  component: Card,
  args: { title: 'Trace', children: 'Hover a node to see its lineage.' },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
