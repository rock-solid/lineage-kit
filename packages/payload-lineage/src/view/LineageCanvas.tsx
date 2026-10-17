import '@xyflow/react/dist/style.css';
import './lineage.css';

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import React, { useEffect, useMemo, useState } from 'react';

import type { ContentEdge, ContentGraph, ContentKind, ContentNode } from '../types';
import { layoutInput, linksToItself, NODE_HEIGHT, NODE_WIDTH, trace, visibleGraph } from './model';

const elk = new ELK();
const KINDS: { kind: ContentKind; label: string }[] = [
  { kind: 'collection', label: 'Collections' },
  { kind: 'block', label: 'Blocks' },
  { kind: 'global', label: 'Globals' },
];

type NodeState = 'default' | 'active' | 'related' | 'dimmed' | 'selected';
type NodeData = { node: ContentNode; state: NodeState; selfLink: boolean };
type ContentFlowNode = Node<NodeData, 'content'>;

export type LineageCanvasProps = {
  graph: ContentGraph;
  /** Admin URLs of the collections and globals, by node id, for the "Open" links. */
  adminURLs: Record<string, string>;
};

/**
 * The content graph, left to right from what an entity is built from to where it is used. Hover to
 * trace, click for the fields behind each link.
 */
export const LineageCanvas: React.FC<LineageCanvasProps> = (props) => (
  <ReactFlowProvider>
    <Canvas {...props} />
  </ReactFlowProvider>
);

const Canvas: React.FC<LineageCanvasProps> = ({ graph, adminURLs }) => {
  const { fitView } = useReactFlow();
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<ContentKind>>(new Set());
  const [hideUnconnected, setHideUnconnected] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const visible = useMemo(
    () => visibleGraph(graph, { hiddenKinds, hideUnconnected }),
    [graph, hiddenKinds, hideUnconnected],
  );

  // Lay out only when the set of nodes changes, not on hover
  const layoutKey = visible.nodes.map((n) => n.id).join('|');
  useEffect(() => {
    let cancelled = false;
    elk.layout(layoutInput(visible.nodes, visible.edges)).then((layout) => {
      if (cancelled) return;
      setPositions(new Map(layout.children?.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }])));
      // Leave room on the right for the details panel
      requestAnimationFrame(() =>
        fitView({ padding: { top: '96px', right: '360px', bottom: '24px', left: '24px' } }),
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutKey stands in for visible
  }, [layoutKey, fitView]);

  const traced = useMemo(
    () => (hovered ? trace(hovered, visible.edges) : null),
    [hovered, visible.edges],
  );

  const nodes: ContentFlowNode[] = useMemo(() => {
    if (!positions) return [];
    return visible.nodes.flatMap((node) => {
      const position = positions.get(node.id);
      if (!position) return [];
      let state: NodeState = 'default';
      if (traced)
        state = node.id === hovered ? 'active' : traced.has(node.id) ? 'related' : 'dimmed';
      else if (node.id === selected) state = 'selected';
      return [
        {
          id: node.id,
          type: 'content',
          position,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          data: { node, state, selfLink: linksToItself(node.id, visible.edges) },
        },
      ];
    });
  }, [positions, visible, traced, hovered, selected]);

  const edges: Edge[] = useMemo(
    () =>
      visible.edges
        .filter((e) => e.source !== e.target)
        .map((e) => {
          const onTrace = traced?.has(e.source) && traced.has(e.target);
          const state = traced
            ? onTrace
              ? ' rs-lineage__edge--active'
              : ' rs-lineage__edge--dimmed'
            : '';
          return {
            id: `${e.source}->${e.target}:${e.kind}`,
            source: e.source,
            target: e.target,
            className: `rs-lineage__edge rs-lineage__edge--${e.kind}${state}`,
            animated: !!onTrace,
          };
        }),
    [visible.edges, traced],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleKind = (kind: ContentKind) =>
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const focused = selected ? byId.get(selected) : undefined;
  const links = visible.edges.length;

  return (
    // `data-ready` once the first layout is done, for tests to wait on
    <div className="rs-lineage" data-ready={positions ? '' : undefined}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.1}
        onNodeMouseEnter={(_, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onNodeClick={(_, node) => setSelected(node.id)}
        onPaneClick={() => setSelected(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          className="rs-lineage__minimap"
          nodeClassName={(node) =>
            `rs-lineage__minimap-node--${(node as ContentFlowNode).data.node.kind}`
          }
          ariaLabel="Content lineage overview"
        />
        <Panel position="top-left">
          <div className="rs-lineage__toolbar">
            {KINDS.map(({ kind, label }) => (
              <label key={kind} className="rs-lineage__toggle">
                <input
                  type="checkbox"
                  checked={!hiddenKinds.has(kind)}
                  onChange={() => toggleKind(kind)}
                />
                <span className={`rs-lineage__swatch rs-lineage__swatch--${kind}`} />
                {label}
              </label>
            ))}
            <label className="rs-lineage__toggle">
              <input
                type="checkbox"
                checked={hideUnconnected}
                onChange={() => setHideUnconnected((current) => !current)}
              />
              Hide unconnected
            </label>
            <span className="rs-lineage__count">
              {visible.nodes.length} nodes, {links} link{links === 1 ? '' : 's'}
            </span>
          </div>
        </Panel>
        <Panel position="top-right">
          <Details
            node={focused}
            edges={visible.edges}
            byId={byId}
            adminURLs={adminURLs}
            onSelect={setSelected}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
};

const Details: React.FC<{
  node: ContentNode | undefined;
  edges: readonly ContentEdge[];
  byId: Map<string, ContentNode>;
  adminURLs: Record<string, string>;
  onSelect: (id: string) => void;
}> = ({ node, edges, byId, adminURLs, onSelect }) => {
  if (!node) {
    return (
      <aside className="rs-lineage__details">
        <p className="rs-lineage__hint">
          Hover a node to trace everything it's built from and everything that uses it. Click it to
          see the fields behind each link. Esc clears the selection.
        </p>
        <dl className="rs-lineage__legend">
          <div>
            <dt className="rs-lineage__line rs-lineage__line--relationship" />
            <dd>relationship</dd>
          </div>
          <div>
            <dt className="rs-lineage__line rs-lineage__line--upload" />
            <dd>upload</dd>
          </div>
          <div>
            <dt className="rs-lineage__line rs-lineage__line--blocks" />
            <dd>blocks field</dd>
          </div>
        </dl>
      </aside>
    );
  }
  const builtFrom = edges.filter((e) => e.target === node.id);
  const usedBy = edges.filter((e) => e.source === node.id);
  const url = adminURLs[node.id];
  const item = (edge: ContentEdge, otherId: string) => {
    const other = byId.get(otherId)!;
    return (
      <li key={`${edge.source}->${edge.target}:${edge.kind}`}>
        <button type="button" className="rs-lineage__link" onClick={() => onSelect(other.id)}>
          <span className="rs-lineage__link-name">
            <span className={`rs-lineage__swatch rs-lineage__swatch--${other.kind}`} />
            {edge.source === edge.target ? 'Itself' : other.label}
          </span>
          <span className="rs-lineage__via">
            {edge.kind} · {edge.fields.join(', ')}
          </span>
        </button>
      </li>
    );
  };
  return (
    <aside className="rs-lineage__details" aria-live="polite">
      <div>
        <span className={`rs-lineage__kind rs-lineage__kind--${node.kind}`}>{node.kind}</span>
        <h2 className="rs-lineage__name">{node.label}</h2>
        <code className="rs-lineage__id">{node.id}</code>
      </div>
      {url && (
        <a className="rs-lineage__open" href={url}>
          Open in the admin
        </a>
      )}
      <section>
        <h3 className="rs-lineage__heading">Built from · {builtFrom.length}</h3>
        {builtFrom.length ? (
          <ul className="rs-lineage__list">{builtFrom.map((e) => item(e, e.source))}</ul>
        ) : (
          <p className="rs-lineage__hint">
            None of its fields point at another collection or block.
          </p>
        )}
      </section>
      <section>
        <h3 className="rs-lineage__heading">Used by · {usedBy.length}</h3>
        {usedBy.length ? (
          <ul className="rs-lineage__list">{usedBy.map((e) => item(e, e.target))}</ul>
        ) : (
          <p className="rs-lineage__hint">Nothing uses it.</p>
        )}
      </section>
    </aside>
  );
};

const ContentNodeView: React.FC<NodeProps<ContentFlowNode>> = ({
  data: { node, state, selfLink },
}) => (
  <div
    className={`rs-lineage__node rs-lineage__node--${node.kind} rs-lineage__node--${state}`}
    title={node.id}
  >
    <Handle
      className="rs-lineage__handle"
      type="target"
      position={Position.Left}
      isConnectable={false}
    />
    <span className="rs-lineage__label">
      {node.label}
      {selfLink && (
        <span className="rs-lineage__self" title="Links to itself">
          ↻
        </span>
      )}
    </span>
    <span className="rs-lineage__meta">
      {node.kind} · {node.slug}
    </span>
    <Handle
      className="rs-lineage__handle"
      type="source"
      position={Position.Right}
      isConnectable={false}
    />
  </div>
);

const nodeTypes = { content: ContentNodeView };
