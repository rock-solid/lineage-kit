import { layout, trace } from '@rock-solid/lineage-core';
import { describe, expect, it } from 'vitest';

import type { ContentEdge, ContentGraph, ContentNode } from '../types';
import {
  adminPath,
  fitPadding,
  forViewer,
  layoutEdges,
  LINEAGE_LAYOUT,
  linksToItself,
  STACKED_BELOW,
  visibleGraph,
} from './model';

const node = (kind: ContentNode['kind'], slug: string): ContentNode => ({
  id: `${kind}:${slug}`,
  kind,
  slug,
  label: slug,
});
const edge = (
  source: string,
  target: string,
  kind: ContentEdge['kind'] = 'relationship',
): ContentEdge => ({
  source,
  target,
  kind,
  fields: ['f'],
});

// media → hero block → pages → header, pages links to itself and back to the block; users unlinked
const graph: ContentGraph = {
  nodes: [
    node('collection', 'media'),
    node('block', 'hero'),
    node('collection', 'pages'),
    node('global', 'header'),
    node('collection', 'users'),
  ],
  edges: [
    edge('collection:media', 'block:hero', 'upload'),
    edge('block:hero', 'collection:pages', 'blocks'),
    edge('collection:pages', 'block:hero'),
    edge('collection:pages', 'collection:pages'),
    edge('collection:pages', 'global:header'),
  ],
};
const ids = (nodes: { id: string }[]) => nodes.map((n) => n.id);

describe('forViewer', () => {
  it('drops the collections and globals the viewer can’t read, with their links, and keeps blocks', () => {
    const { nodes, edges } = forViewer(graph, (n) => n.slug !== 'pages');
    expect(ids(nodes)).toEqual([
      'collection:media',
      'block:hero',
      'global:header',
      'collection:users',
    ]);
    expect(edges).toEqual([edge('collection:media', 'block:hero', 'upload')]);
  });
});

describe('visibleGraph', () => {
  it('hides unconnected nodes, not counting a link to itself', () => {
    const lonely: ContentGraph = {
      nodes: [...graph.nodes, node('collection', 'tags')],
      edges: [...graph.edges, edge('collection:tags', 'collection:tags')],
    };
    const { nodes } = visibleGraph(lonely, { hiddenKinds: new Set(), hideUnconnected: true });
    expect(ids(nodes)).not.toContain('collection:users');
    expect(ids(nodes)).not.toContain('collection:tags');
  });

  it('hides a kind, then what that leaves unconnected', () => {
    const { nodes, edges } = visibleGraph(graph, {
      hiddenKinds: new Set(['block']),
      hideUnconnected: true,
    });
    expect(ids(nodes)).toEqual(['collection:pages', 'global:header']);
    expect(edges.every((e) => e.source !== 'block:hero' && e.target !== 'block:hero')).toBe(true);
  });

  it('shows everything when nothing is filtered', () => {
    const { nodes, edges } = visibleGraph(graph, {
      hiddenKinds: new Set(),
      hideUnconnected: false,
    });
    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(5);
  });
});

describe('trace', () => {
  it('follows links both ways through a cycle, and stops', () => {
    expect([...trace('collection:media', graph.edges)].sort()).toEqual(
      ['block:hero', 'collection:media', 'collection:pages', 'global:header'].sort(),
    );
    expect([...trace('global:header', graph.edges)]).not.toContain('collection:users');
  });
});

describe('layoutEdges', () => {
  it('ranks blocks and uploads above relationships, so cycles break on the relationship', () => {
    const priority = (source: string, target: string) =>
      layoutEdges(graph.edges).find((e) => e.source === source && e.target === target)!.priority;
    expect(priority('block:hero', 'collection:pages')).toBe(10);
    expect(priority('collection:media', 'block:hero')).toBe(10);
    expect(priority('collection:pages', 'block:hero')).toBe(0);
  });

  it('puts a block before the page that uses it, even when the page links back to it', async () => {
    const positions = await layout(
      graph.nodes.map((n) => ({ id: n.id, width: 200, height: 48 })),
      layoutEdges(graph.edges),
      LINEAGE_LAYOUT,
    );
    const x = (id: string) => positions.get(id)!.x;
    expect(x('collection:media')).toBeLessThan(x('block:hero'));
    expect(x('block:hero')).toBeLessThan(x('collection:pages'));
    expect(x('collection:pages')).toBeLessThan(x('global:header'));
  });
});

describe('adminPath and linksToItself', () => {
  it('links collections and globals, not blocks', () => {
    expect(adminPath(node('collection', 'pages'))).toBe('/collections/pages');
    expect(adminPath(node('global', 'header'))).toBe('/globals/header');
    expect(adminPath(node('block', 'hero'))).toBeNull();
  });

  it('spots a self-link', () => {
    expect(linksToItself('collection:pages', graph.edges)).toBe(true);
    expect(linksToItself('block:hero', graph.edges)).toBe(false);
  });
});

describe('fitPadding', () => {
  it('leaves room for the details panel only when it sits beside the graph', () => {
    expect(fitPadding(STACKED_BELOW + 1).right).toBe('360px');
    expect(fitPadding(STACKED_BELOW).right).toBe('24px');
    expect(fitPadding(0).right).toBe('24px');
  });
});
