import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Get in touch' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {};
export const Outline: Story = { args: { variant: 'outline' } };
