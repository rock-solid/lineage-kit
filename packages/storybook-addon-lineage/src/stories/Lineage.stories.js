// Added to every project's Storybook by the preset (`stories`), so its title and id are fixed: the
// toolbar button opens `lineage--project`. Plain JS, copied rather than bundled: Storybook's
// indexer needs a literal `export default`, which bundlers rewrite.
import { createElement } from 'react';
import { useArgs } from 'storybook/preview-api';
import { expect, waitFor } from 'storybook/test';

import { LineageGraph } from '../index.js';

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
  argTypes: {
    graph: { table: { disable: true } },
    onFocusChange: { table: { disable: true } },
  },
  // The focused node goes back into the `focus` arg, so the URL links to it (when it has a story)
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return createElement(LineageGraph, {
      ...args,
      onFocusChange: (focus) => updateArgs({ focus: focus ?? undefined }),
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
