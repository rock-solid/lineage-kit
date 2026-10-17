import { MERMAID_READABLE_NODES } from '@rocksoliddigital/lineage-core';
import { useCopy } from '@rocksoliddigital/lineage-core/react';
import React from 'react';

/**
 * Copies what the page shows as Mermaid, built when clicked. Past about 50 nodes, the label says the
 * diagram will be hard to read, so the filters can narrow it first.
 */
export const CopyMermaid: React.FC<{ text: () => string; size: number }> = ({ text, size }) => {
  const { status, copy } = useCopy();
  const large = size > MERMAID_READABLE_NODES;
  return (
    <button
      type="button"
      className="rs-lineage__copy"
      onClick={() => copy(text())}
      title={
        large
          ? `${size} is a lot for one Mermaid diagram; narrow it with the filters first for one that reads well`
          : 'Copy what the page shows as a Mermaid diagram, for a PR, doc or ticket'
      }
      aria-live="polite"
    >
      {status === 'copied' ? 'Copied' : status === 'failed' ? "Couldn't copy" : 'Copy Mermaid'}
      {large && status === 'idle' ? ' (large)' : ''}
    </button>
  );
};
