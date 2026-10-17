import type { Meta, StoryObj } from '@storybook/react-vite';

import { Hero } from './Hero';

const meta = {
  title: 'Components/Hero',
  component: Hero,
  args: { heading: 'Welcome', lead: 'An example site for the Lineage addon.' },
} satisfies Meta<typeof Hero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
