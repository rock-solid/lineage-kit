import { useCallback, useEffect, useState } from 'react';

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

/**
 * Copies text, with the old `execCommand('copy')` as a fallback where the clipboard API is refused
 * (an iframe without `clipboard-write`, a non-secure origin). Resolves to whether it worked.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

export type CopyStatus = 'idle' | 'copied' | 'failed';

/** `copy(text)` and how the last copy went, back to `idle` after a couple of seconds. */
export function useCopy(resetAfterMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const copy = useCallback(async (text: string) => {
    setStatus((await copyText(text)) ? 'copied' : 'failed');
  }, []);
  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), resetAfterMs);
    return () => clearTimeout(timer);
  }, [status, resetAfterMs]);
  return { status, copy };
}
