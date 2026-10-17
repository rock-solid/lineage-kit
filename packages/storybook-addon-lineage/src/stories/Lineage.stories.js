// Added to every project's Storybook by the preset (`stories`), so its title and id are fixed: the
// toolbar button opens `lineage--project`. Plain JS, copied rather than bundled: Storybook's
// indexer needs a literal `export default`, which bundlers rewrite.
import { createElement } from 'react';
import { useArgs } from 'storybook/preview-api';
import { expect, waitFor } from 'storybook/test';

import { LineageGraph } from '../index.js';

// Depth args are numbers, or `all` for every level. Numbers rather than '0'–'3': Storybook reads
// `upstream:1` in a URL as the number 1, and drops values that aren't among the options.
const DEPTH_OPTIONS = [0, 1, 2, 3, 'all'];
const DEPTH_MAPPING = { all: Infinity };
const DEPTH_LABELS = { 0: 'None', 1: '+1', 2: '+2', 3: '+3', all: 'All' };
const depthArg = (depth) => (depth === Infinity ? 'all' : depth);

const meta = {
  title: 'Lineage',
  component: LineageGraph,
  // A tool page, not a component, so it has no Docs page
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    // Focusing a node changes the args; that is navigation, not an edit worth saving
    controls: { disableSaveFromUI: true },
  },
  // Declared here rather than left to docgen, which can't read prop types from compiled JS
  argTypes: {
    focus: {
      control: 'text',
      description:
        "The file to focus on: one of its stories' ids (`ui-button--docs`), its path (`src/components/ui/button.tsx`), or its path with `-` for `/` and `.` (`src-components-ui-button-tsx`), which is what the URL keeps",
    },
    upstream: {
      control: { type: 'select', labels: DEPTH_LABELS },
      options: DEPTH_OPTIONS,
      mapping: DEPTH_MAPPING,
      description: 'Levels of ancestors (what the file is built with) a focused file shows',
    },
    downstream: {
      control: { type: 'select', labels: DEPTH_LABELS },
      options: DEPTH_OPTIONS,
      mapping: DEPTH_MAPPING,
      description: 'Levels of descendants (where the file is used) a focused file shows',
    },
    graph: { table: { disable: true } },
    onFocusChange: { table: { disable: true } },
    onDepthChange: { table: { disable: true } },
  },
  args: { upstream: 'all', downstream: 'all' },
  // The focus and depths chosen in the graph go back into the args, so the URL keeps them and a
  // reload or a shared link opens the same view
  render: function Render(args) {
    const [, updateArgs, resetArgs] = useArgs();
    return createElement(LineageGraph, {
      ...args,
      // Clearing resets the arg: `updateArgs({ focus: undefined })` would leave it in the URL
      onFocusChange: (focus) => (focus ? updateArgs({ focus }) : resetArgs(['focus'])),
      onDepthChange: ({ upstream, downstream }) =>
        updateArgs({ upstream: depthArg(upstream), downstream: depthArg(downstream) }),
    });
  },
};

export default meta;

/**
 * Every file in the project's source folder, built from their imports when Storybook starts. Use the
 * toolbar's Lineage button on any story to open this focused on its component.
 */
export const Project = {
  // Only waits for the async layout, so the a11y test sees the graph. Play functions also run in
  // the UI, so this must not change the focus a link set.
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-ready]')).not.toBeNull(), {
      timeout: 10000,
    });
  },
};
