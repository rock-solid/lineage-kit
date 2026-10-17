// What the admin view shows of a graph, kept free of React so it can be tested on its own.

import type { LayoutEdge, LayoutOptions } from '@rocksoliddigital/lineage-core';

import type { ContentEdge, ContentGraph, ContentKind, ContentNode } from '../types';

export const NODE_WIDTH = 200;
/**
 * Below this canvas width the details panel goes under the graph instead of beside it, so it never
 * covers the toolbar. Matches the `@container` query in `lineage.css`.
 */
export const STACKED_BELOW = 960;

/** Room fitView leaves around the graph: the toolbar above, and the details panel when it's beside it. */
export function fitPadding(layoutWidth: number) {
  const right = layoutWidth > STACKED_BELOW ? '360px' : '24px';
  return { top: '96px', right, bottom: '24px', left: '24px' } as const;
}
export const NODE_HEIGHT = 48;

export type ViewFilter = {
  hiddenKinds: ReadonlySet<ContentKind>;
  /** Leaves out nodes with no links, like a `users` collection nothing points at. */
  hideUnconnected: boolean;
};

/** The graph without the collections and globals the viewer can't read. Blocks have no access of their own. */
export function forViewer(
  graph: ContentGraph,
  canRead: (node: ContentNode) => boolean,
): ContentGraph {
  const nodes = graph.nodes.filter((n) => n.kind === 'block' || canRead(n));
  return { nodes, edges: edgesBetween(nodes, graph.edges) };
}

export function visibleGraph(graph: ContentGraph, { hiddenKinds, hideUnconnected }: ViewFilter) {
  let nodes = graph.nodes.filter((n) => !hiddenKinds.has(n.kind));
  let edges = edgesBetween(nodes, graph.edges);
  if (hideUnconnected) {
    // A link to itself doesn't connect a node to the rest of the graph
    const linked = new Set(
      edges.filter((e) => e.source !== e.target).flatMap((e) => [e.source, e.target]),
    );
    nodes = nodes.filter((n) => linked.has(n.id));
    edges = edgesBetween(nodes, edges);
  }
  return { nodes, edges };
}

export const LINEAGE_LAYOUT: LayoutOptions = {
  layerSpacing: 80,
  nodeSpacing: 16,
  placement: 'NETWORK_SIMPLEX',
};

/**
 * The links for the layout. Block and upload links outrank relationships, so a page that links back
 * to a block it uses draws that link backwards rather than moving the block to the right of the
 * page. Self-links are left out by the layout; the node shows a badge instead.
 */
export function layoutEdges(edges: readonly ContentEdge[]): LayoutEdge[] {
  return edges.map(({ source, target, kind }) => ({
    source,
    target,
    priority: kind === 'relationship' ? 0 : 10,
  }));
}

/** Where a node is edited in the admin; blocks are edited inside the documents that use them. */
export function adminPath(node: ContentNode): `/${string}` | null {
  if (node.kind === 'collection') return `/collections/${node.slug}`;
  if (node.kind === 'global') return `/globals/${node.slug}`;
  return null;
}

export function linksToItself(id: string, edges: readonly ContentEdge[]) {
  return edges.some((e) => e.source === id && e.target === id);
}

function edgesBetween(nodes: readonly ContentNode[], edges: readonly ContentEdge[]) {
  const ids = new Set(nodes.map((n) => n.id));
  return edges.filter((e) => ids.has(e.source) && ids.has(e.target));
}
