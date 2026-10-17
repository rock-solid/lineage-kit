import { useEffect, useState } from 'react';

import {
  layout,
  layoutKey,
  type LayoutEdge,
  type LayoutNode,
  type LayoutOptions,
  type Positions,
} from './layout';

/**
 * Lays the graph out with ELK and returns the positions, `null` until the first layout is done. It
 * lays out again only when nodes, their sizes or the edges change, not on every render (a hover,
 * a selection), and drops a layout that finishes after a newer one has started. `onLayout` runs
 * once the new positions are set, e.g. to fit the view to them.
 */
export function useLayout(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  options: LayoutOptions,
  onLayout?: () => void,
): Positions | null {
  const [positions, setPositions] = useState<Positions | null>(null);
  const key = layoutKey(nodes, edges, options);

  useEffect(() => {
    let cancelled = false;
    layout(nodes, edges, options).then((next) => {
      if (cancelled) return;
      setPositions(next);
      onLayout?.();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key stands in for nodes, edges and options
  }, [key]);

  return positions;
}
