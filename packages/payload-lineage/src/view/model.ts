// What the admin view shows of a graph, kept free of React so it can be tested on its own.

import type { ContentEdge, ContentGraph, ContentKind, ContentNode } from '../types';

export const NODE_WIDTH = 200;
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

/** Every node upstream and downstream of `id`, and `id` itself, like dbt's `+model+`. */
export function trace(id: string, edges: readonly ContentEdge[]): Set<string> {
  const lineage = new Set([id]);
  for (const [from, to] of [
    ['target', 'source'],
    ['source', 'target'],
  ] as const) {
    const queue = [id];
    const seen = new Set([id]);
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of edges) {
        if (edge[from] !== current || seen.has(edge[to])) continue;
        seen.add(edge[to]);
        lineage.add(edge[to]);
        queue.push(edge[to]);
      }
    }
  }
  return lineage;
}

/**
 * The ELK graph for a left-to-right layout. Self-links are left out (the node shows a badge
 * instead), and block and upload links outrank relationships, so a page that links back to a block
 * it uses draws that link backwards rather than moving the block to the right of the page.
 */
export function layoutInput(nodes: readonly ContentNode[], edges: readonly ContentEdge[]) {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '16',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: nodes.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: edges
      .filter((e) => e.source !== e.target)
      .map((e, i) => ({
        id: `e${i}`,
        sources: [e.source],
        targets: [e.target],
        layoutOptions: { 'elk.layered.priority.direction': e.kind === 'relationship' ? '0' : '10' },
      })),
  };
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
