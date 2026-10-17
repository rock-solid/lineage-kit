import React from 'react';
import { Button } from 'storybook/internal/components';
import { STORY_PREPARED } from 'storybook/internal/core-events';
import { addons, types, useStorybookApi, useStorybookState } from 'storybook/manager-api';

export const LINEAGE_STORY_ID = 'lineage--project';

/**
 * "Lineage" in the toolbar: opens the graph focused on the current story's component. The focus goes in
 * as the story's id, which the viewer matches to the file the story documents.
 */
const LineageTool: React.FC = () => {
  const api = useStorybookApi();
  const { storyId } = useStorybookState();

  const open = () => {
    const focus = storyId;
    // Args can only be set once the Lineage story is prepared; URL args are read on first load only
    const onPrepared = ({ id }: { id: string }) => {
      if (id !== LINEAGE_STORY_ID) return;
      api.off(STORY_PREPARED, onPrepared);
      const story = api.getData(LINEAGE_STORY_ID);
      if (story?.type === 'story') api.updateStoryArgs(story, { focus });
    };
    api.on(STORY_PREPARED, onPrepared);
    api.selectStory(LINEAGE_STORY_ID);
  };

  return (
    <Button
      variant="ghost"
      size="small"
      padding="small"
      ariaLabel={false}
      tooltip="Show this component in the Lineage graph"
      onClick={open}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
      >
        <rect x="0.5" y="5" width="4" height="4" rx="1" />
        <rect x="9.5" y="0.5" width="4" height="4" rx="1" />
        <rect x="9.5" y="9.5" width="4" height="4" rx="1" />
        <path d="M4.5 7h2.5V2.5h2.5M7 7v4.5h2.5" />
      </svg>
      Lineage
    </Button>
  );
};

addons.register('rsd/lineage', () => {
  addons.add('rsd/lineage/tool', {
    type: types.TOOL,
    title: 'Lineage',
    match: ({ storyId, viewMode }) =>
      !!storyId &&
      !storyId.startsWith('lineage--') &&
      (viewMode === 'story' || viewMode === 'docs'),
    render: () => <LineageTool />,
  });
});
