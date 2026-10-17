import type { LineageGraphData } from '@rocksoliddigital/storybook-addon-lineage';
import { LineageGraph } from '@rocksoliddigital/storybook-addon-lineage';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor } from 'storybook/test';

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

/** Depths given as props, as from a link or the Controls panel. */
export const DepthsFromProps: Story = {
  args: { graph, focus: 'src/header.tsx', upstream: 0, downstream: 1 },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText('Header+1')).toBeInTheDocument();
    await waitForNode(canvasElement, 'src/grid.tsx');
    await expect(node(canvasElement, 'src/page.tsx')).toBeNull();
    await expect(node(canvasElement, 'src/link.tsx')).toBeNull();
  },
};

/** Props changed on a mounted graph (what the Controls panel does) update its focus and depths. */
export const PropsChangeAfterMount: Story = {
  args: { graph },
  render: function Render(args) {
    const [props, setProps] = useState({ focus: 'src/link.tsx', upstream: Infinity });
    return (
      <>
        <button type="button" onClick={() => setProps({ focus: 'src/header.tsx', upstream: 1 })}>
          Change props
        </button>
        <LineageGraph {...args} {...props} />
      </>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('+Link+')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Change props' }));
    await expect(await canvas.findByText('1+Header+')).toBeInTheDocument();
    await expect(await canvas.findByText('src/header.tsx')).toBeInTheDocument();
  },
};

/** Every focus can go in a URL: a story id, or for a file without a story its encoded path. */
export const FocusKeys: Story = {
  args: { graph, onFocusChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(await waitForNode(canvasElement, 'src/carousel.tsx'));
    await waitFor(() =>
      expect(args.onFocusChange).toHaveBeenLastCalledWith('src_2Fcarousel_2Etsx'),
    );
    await userEvent.click(await waitForNode(canvasElement, 'src/header.tsx'));
    await waitFor(() => expect(args.onFocusChange).toHaveBeenLastCalledWith('header--docs'));
  },
};

/** An encoded path from a link resolves to its file. */
export const FocusFromEncodedPath: Story = {
  args: { graph, focus: 'src_2Fcarousel_2Etsx' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('src/carousel.tsx')).toBeInTheDocument();
  },
};

/** `src/foo-bar.tsx` and `src/foo/bar.tsx` get different keys, and each key focuses its own file. */
const similarPaths: LineageGraphData = {
  changedSince: null,
  layers,
  nodes: [
    { id: 'src/foo-bar.tsx', label: 'foo-bar', layer: 'component' },
    { id: 'src/foo/bar.tsx', label: 'bar', layer: 'component' },
    { id: 'src/page.tsx', label: 'Page', layer: 'component' },
  ],
  edges: [
    { source: 'src/foo-bar.tsx', target: 'src/page.tsx' },
    { source: 'src/foo/bar.tsx', target: 'src/page.tsx' },
  ],
};

export const SimilarPathsKeepTheirKeys: Story = {
  args: { graph: similarPaths, onFocusChange: fn() },
  render: function Render(args) {
    // Feeds the reported key back as the focus, as the Lineage page's args do
    const [focus, setFocus] = useState<string | undefined>();
    return (
      <LineageGraph
        {...args}
        focus={focus}
        onFocusChange={(key) => {
          args.onFocusChange?.(key);
          setFocus(key ?? undefined);
        }}
      />
    );
  },
  // Checks the keys differ and each restores its own file, whatever the format (FocusKeys pins that)
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const onFocusChange = args.onFocusChange as ReturnType<typeof fn>;
    const lastKey = () => onFocusChange.mock.lastCall?.[0];

    await userEvent.click(await waitForNode(canvasElement, 'src/foo/bar.tsx'));
    await waitFor(() => expect(lastKey()).toBeTruthy());
    const slashKey = lastKey();
    // The key came back as the focus and it's still foo/bar, not foo-bar
    await expect(await canvas.findByText('src/foo/bar.tsx')).toBeInTheDocument();
    await expect(canvas.queryByText('src/foo-bar.tsx')).toBeNull();

    await userEvent.keyboard('{Escape}');
    await userEvent.click(await waitForNode(canvasElement, 'src/foo-bar.tsx'));
    // Esc reports null first, so wait for the second click's key
    await waitFor(() => {
      expect(lastKey()).toBeTruthy();
      expect(lastKey()).not.toBe(slashKey);
    });
    await expect(await canvas.findByText('src/foo-bar.tsx')).toBeInTheDocument();
    await expect(canvas.queryByText('src/foo/bar.tsx')).toBeNull();
  },
};

/** A focus given as a path (e.g. typed into the Controls panel) is reported back as its key. */
export const PathFocusReportedAsKey: Story = {
  args: { graph, focus: 'src/link.tsx', onFocusChange: fn() },
  play: async ({ args, canvas }) => {
    await expect(await canvas.findByText('src/link.tsx')).toBeInTheDocument();
    await waitFor(() => expect(args.onFocusChange).toHaveBeenLastCalledWith('src_2Flink_2Etsx'));
  },
};

/** Depths changed in the graph's panel are reported, for the story to keep in the URL. */
export const DepthChangeReported: Story = {
  args: { graph, focus: 'src/header.tsx', onDepthChange: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await canvas.findByText('+Header+');
    await userEvent.selectOptions(canvas.getByLabelText('Upstream'), 'None');
    await expect(args.onDepthChange).toHaveBeenLastCalledWith({
      upstream: 0,
      downstream: Infinity,
    });
    await userEvent.selectOptions(canvas.getByLabelText('Downstream'), '+2');
    await expect(args.onDepthChange).toHaveBeenLastCalledWith({ upstream: 0, downstream: 2 });
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

/** Copy as Mermaid copies the graph as shown: hidden layers stay out. */
export const CopyAsMermaid: Story = {
  args: { graph },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await waitForNode(canvasElement, 'src/link.tsx');
    // Stand in for the clipboard, so the test sees exactly what was copied
    const writeText = fn(async (_text: string) => {});
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy as Mermaid' }));
      await expect(await canvas.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
      const text = writeText.mock.calls[0][0];
      await expect(text).toMatch(/^flowchart LR\n/);
      await expect(text).toContain('["Header"]');
      await expect(text).toContain('["Page"]');
      await expect(text).not.toContain('merge');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else delete (navigator as { clipboard?: unknown }).clipboard;
    }
  },
};
