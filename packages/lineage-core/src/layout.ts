import ELK from 'elkjs/lib/elk.bundled.js';

import type { Link } from './traverse';

export type LayoutNode = { id: string; width: number; height: number };

export type LayoutEdge = Link & {
  /**
   * When a cycle has to be broken, edges with a higher priority keep pointing left to right; the
   * lowest are drawn running backwards. Defaults to 0.
   */
  priority?: number;
};

export type LayoutOptions = {
  /** Space between columns. */
  layerSpacing: number;
  /** Space between nodes in a column. */
  nodeSpacing: number;
  /** ELK's node placement: `NETWORK_SIMPLEX` straightens long edges, `BRANDES_KOEPF` packs tighter. */
  placement: 'NETWORK_SIMPLEX' | 'BRANDES_KOEPF';
};

export type Positions = Map<string, { x: number; y: number }>;

/**
 * The ELK graph for a left-to-right layered layout. Links from a node to itself are left out: a
 * caller shows those on the node.
 */
export function layoutInput(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  { layerSpacing, nodeSpacing, placement }: LayoutOptions,
) {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
      'elk.spacing.nodeNode': String(nodeSpacing),
      'elk.layered.nodePlacement.strategy': placement,
    },
    children: nodes.map(({ id, width, height }) => ({ id, width, height })),
    edges: edges
      .filter((e) => e.source !== e.target)
      .map((e, i) => ({
        id: `e${i}`,
        sources: [e.source],
        targets: [e.target],
        ...(e.priority !== undefined && {
          layoutOptions: { 'elk.layered.priority.direction': String(e.priority) },
        }),
      })),
  };
}

let elk: InstanceType<typeof ELK> | undefined;

/** Where each node goes, its top-left corner, from ELK. */
export async function layout(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  options: LayoutOptions,
): Promise<Positions> {
  elk ??= new ELK();
  const result = await elk.layout(layoutInput(nodes, edges, options));
  return new Map(result.children?.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
}
