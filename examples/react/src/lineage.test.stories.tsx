import type { LineageGraphData } from '@rock-solid/storybook-addon-lineage';
import { LineageGraph } from '@rock-solid/storybook-addon-lineage';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';

// Tests of the viewer on fixture graphs, so they don't change when the example does. `!dev` keeps
// them out of the sidebar; `pnpm test` still runs them.
const meta = {
  title: 'Lineage tests',
  component: LineageGraph,
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LineageGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

const layers = [
  { id: 'component', label: 'Components', color: '#2563eb', hidden: false },
  { id: 'utility', label: 'Utilities', color: '#475569', hidden: true },
];

/** link → header → { grid, carousel } → page, plus a hidden utility used by link */
const graph: LineageGraphData = {
  changedSince: 'origin/main',
  layers,
  nodes: [
    { id: 'src/utils/merge.ts', label: 'merge', layer: 'utility' },
    { id: 'src/link.tsx', label: 'Link', layer: 'component' },
    {
      id: 'src/header.tsx',
      label: 'Header',
      layer: 'component',
      storyId: 'header--docs',
      changed: true,
    },
    { id: 'src/grid.tsx', label: 'Grid', layer: 'component', storyId: 'grid--docs' },
    { id: 'src/carousel.tsx', label: 'Carousel', layer: 'component' },
    { id: 'src/page.tsx', label: 'Page', layer: 'component' },
    { id: 'src/other.tsx', label: 'Other', layer: 'component' },
  ],
  edges: [
    { source: 'src/utils/merge.ts', target: 'src/link.tsx' },
    { source: 'src/link.tsx', target: 'src/header.tsx' },
    { source: 'src/header.tsx', target: 'src/grid.tsx' },
    { source: 'src/header.tsx', target: 'src/carousel.tsx' },
    { source: 'src/grid.tsx', target: 'src/page.tsx' },
    { source: 'src/link.tsx', target: 'src/other.tsx' },
  ],
};

const node = (root: HTMLElement, id: string) => root.querySelector(`[data-id="${id}"]`);

const waitForNode = (root: HTMLElement, id: string) =>
  waitFor(
    () => {
      const element = node(root, id);
      expect(element).not.toBeNull();
      return element!;
    },
    { timeout: 10000 },
  );

/** Click focuses; Upstream None drops the ancestors and keeps the descendants. */
export const Focus: Story = {
  args: { graph },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await waitForNode(canvasElement, 'src/header.tsx'));
    await expect(await canvas.findByText('+Header+')).toBeInTheDocument();
    // React Flow syncs its nodes in an effect, so the DOM follows a tick after the panel
    await waitFor(() => expect(node(canvasElement, 'src/other.tsx')).toBeNull());

    await userEvent.selectOptions(canvas.getByLabelText('Upstream'), 'None');
    await expect(await canvas.findByText('Header+')).toBeInTheDocument();
    await waitFor(() => expect(node(canvasElement, 'src/link.tsx')).toBeNull());
    await expect(node(canvasElement, 'src/page.tsx')).not.toBeNull();

    await userEvent.selectOptions(canvas.getByLabelText('Downstream'), '+1');
    await expect(await canvas.findByText('Header+1')).toBeInTheDocument();
    await waitFor(() => expect(node(canvasElement, 'src/page.tsx')).toBeNull());
  },
};

/** A focus from a link: a story id resolves to the file it documents. */
export const FocusFromStoryId: Story = {
  args: { graph, focus: 'grid--default' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('src/grid.tsx')).toBeInTheDocument();
  },
};

/** Search reaches hidden layers: picking a result switches its layer on and focuses it. */
export const SearchHiddenLayer: Story = {
  args: { graph },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await waitForNode(canvasElement, 'src/link.tsx');
    await expect(node(canvasElement, 'src/utils/merge.ts')).toBeNull();

    await userEvent.type(canvas.getByLabelText('Search'), 'merge');
    await userEvent.click(await canvas.findByRole('button', { name: /merge.*hidden/ }));
    await expect(await canvas.findByText('src/utils/merge.ts')).toBeInTheDocument();
    await expect(canvas.getByRole('checkbox', { name: /Utilities/ })).toBeChecked();
    await waitForNode(canvasElement, 'src/utils/merge.ts');
  },
};

/** `state:modified+`: the changed file and what uses it, with their stories. */
export const Changed: Story = {
  args: { graph },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await waitForNode(canvasElement, 'src/header.tsx');
    await expect(canvas.getByText('changed')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('checkbox', { name: /Changed since origin\/main/ }));
    await expect(await canvas.findByText('state:modified+')).toBeInTheDocument();
    await waitFor(() => expect(node(canvasElement, 'src/link.tsx')).toBeNull());
    await expect(node(canvasElement, 'src/other.tsx')).toBeNull();
    await expect(node(canvasElement, 'src/page.tsx')).not.toBeNull();
    await expect(canvas.getByRole('button', { name: 'Header' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Grid' })).toBeInTheDocument();
  },
};

/** An empty graph still reaches `data-ready`, so a project with no files doesn't fail its tests. */
export const Empty: Story = {
  args: { graph: { changedSince: null, layers, nodes: [], edges: [] } },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-ready]')).not.toBeNull());
  },
};
