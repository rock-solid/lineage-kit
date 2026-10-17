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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NAVIGATE_URL } from 'storybook/internal/core-events';
import { addons } from 'storybook/preview-api';
import defaultGraph from 'virtual:lineage-graph';

import { styles } from './classNames';
import type { LineageGraph as Graph, LineageLayer, LineageNode } from './types';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 48;
// Levels of ancestors or descendants a focused node shows, as in dbt's `2+model+1`
const DEPTHS = [0, 1, 2, 3, Infinity];
// A click waits this long for a second one, so a double-click doesn't refocus (and move) the graph first
const DOUBLE_CLICK_MS = 250;
const MAX_RESULTS = 8;

const elk = new ELK();

type NodeState = 'default' | 'active' | 'related' | 'dimmed' | 'match';
type NodeData = { node: LineageNode; layer: LineageLayer; state: NodeState };
type LineageFlowNode = Node<NodeData, 'lineage'>;

export type LineageGraphProps = {
  /** Defaults to the project graph built at Storybook start. */
  graph?: Graph;
  /**
   * The file to focus on: its path (`src/components/ui/button.tsx`) or the id of one of its stories
   * (`ui-button--docs`, `ui-button--outline`). Story ids are what links from a story use, because
   * Storybook only keeps URL-safe args in the URL.
   */
  focus?: string;
  /** Levels of ancestors (what the file is built with) a focused node shows. Defaults to all. */
  upstream?: number;
  /** Levels of descendants (where the file is used) a focused node shows. Defaults to all. */
  downstream?: number;
  /** Called with the focused node's story id (or path, when it has no story), or `null` when cleared. */
  onFocusChange?: (focus: string | null) => void;
};

/**
 * The project's import graph, dbt-style: dependencies on the left, the files that use them on the right.
 * Hover a node to trace its lineage, click to focus on it, double-click to open its story.
 */
export const LineageGraph: React.FC<LineageGraphProps> = (props) => (
  <ReactFlowProvider>
    <LineageView {...props} />
  </ReactFlowProvider>
);

const LineageView: React.FC<LineageGraphProps> = ({
  graph = defaultGraph,
  focus: focusProp,
  upstream: upstreamProp = Infinity,
  downstream: downstreamProp = Infinity,
  onFocusChange,
}) => {
  const { fitView } = useReactFlow();
  const [hiddenLayers, setHiddenLayers] = useState(
    () => new Set(graph.layers.filter((l) => l.hidden).map((l) => l.id)),
  );
  const [focus, setFocus] = useState(() => resolveFocus(graph, focusProp));
  const [upstream, setUpstream] = useState(upstreamProp);
  const [downstream, setDownstream] = useState(downstreamProp);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hideUnlinked, setHideUnlinked] = useState(true);
  const [changedOnly, setChangedOnly] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);

  const layers = useMemo(() => new Map(graph.layers.map((l) => [l.id, l])), [graph]);
  const nodesById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  // Follow the props, so a link from a story or the Controls panel (which set the args) updates an
  // open graph; the panel's own controls change the state in between
  const [synced, setSynced] = useState({ focusProp, upstreamProp, downstreamProp });
  if (focusProp !== synced.focusProp) setFocus(resolveFocus(graph, focusProp));
  if (upstreamProp !== synced.upstreamProp) setUpstream(upstreamProp);
  if (downstreamProp !== synced.downstreamProp) setDownstream(downstreamProp);
  if (
    focusProp !== synced.focusProp ||
    upstreamProp !== synced.upstreamProp ||
    downstreamProp !== synced.downstreamProp
  ) {
    setSynced({ focusProp, upstreamProp, downstreamProp });
  }

  const focusOn = useCallback(
    (id: string | null) => {
      setFocus(id);
      onFocusChange?.(id ? (nodesById.get(id)?.storyId ?? id) : null);
    },
    [nodesById, onFocusChange],
  );

  const changedIds = useMemo(
    () => graph.nodes.filter((n) => n.changed && !hiddenLayers.has(n.layer)).map((n) => n.id),
    [graph, hiddenLayers],
  );

  // Layer filter first, then the changed files, then the focus window, so each works on what the
  // one before it left
  const visible = useMemo(() => {
    let shownIds = new Set(graph.nodes.filter((n) => !hiddenLayers.has(n.layer)).map((n) => n.id));
    let edges = graph.edges.filter((e) => shownIds.has(e.source) && shownIds.has(e.target));
    if (hideUnlinked) {
      // Focused and changed files stay visible even when they have no links
      const focused = focus ? nodesById.get(focus) : undefined;
      shownIds = new Set(edges.flatMap((e) => [e.source, e.target]));
      if (focused && !hiddenLayers.has(focused.layer)) shownIds.add(focused.id);
      for (const id of changedIds) shownIds.add(id);
    }
    if (changedOnly) {
      // dbt's `state:modified+`: the changed files and everything that uses them
      const { down } = adjacency(edges);
      shownIds = new Set(changedIds.flatMap((id) => [id, ...walk(id, down, Infinity)]));
      edges = edges.filter((e) => shownIds.has(e.source) && shownIds.has(e.target));
    }
    if (!focus || !shownIds.has(focus)) return { ids: shownIds, edges };

    const { up, down } = adjacency(edges);
    const ids = new Set([focus, ...walk(focus, up, upstream), ...walk(focus, down, downstream)]);
    return { ids, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
  }, [
    graph,
    nodesById,
    hiddenLayers,
    hideUnlinked,
    changedIds,
    changedOnly,
    focus,
    upstream,
    downstream,
  ]);

  const { up, down } = useMemo(() => adjacency(visible.edges), [visible.edges]);

  // Lay out only when the set of nodes changes, not on hover
  const layoutKey = [...visible.ids].sort().join('|');
  useEffect(() => {
    let cancelled = false;
    elk
      .layout({
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.layered.spacing.nodeNodeBetweenLayers': '90',
          'elk.spacing.nodeNode': '14',
          'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        },
        children: [...visible.ids].map((id) => ({ id, width: NODE_WIDTH, height: NODE_HEIGHT })),
        edges: visible.edges.map((e, i) => ({
          id: `e${i}`,
          sources: [e.source],
          targets: [e.target],
        })),
      })
      .then((layout) => {
        if (cancelled) return;
        setPositions(new Map(layout.children?.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }])));
        // Leave room on the left for the panel
        requestAnimationFrame(() =>
          fitView({
            padding: { top: '24px', right: '24px', bottom: '24px', left: '300px' },
            duration: 300,
          }),
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutKey stands in for visible
  }, [layoutKey, fitView]);

  // Search covers every file, hidden layers included; names that start with the query come first
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return [];
    const rank = (n: LineageNode) => (n.label.toLowerCase().startsWith(needle) ? 0 : 1);
    return graph.nodes
      .filter((n) => n.label.toLowerCase().includes(needle) || n.id.toLowerCase().includes(needle))
      .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
  }, [graph, needle]);

  /** Focuses a search result, switching its layer on if it was hidden. */
  const pick = (node: LineageNode) => {
    setHiddenLayers((current) => {
      if (!current.has(node.layer)) return current;
      const next = new Set(current);
      next.delete(node.layer);
      return next;
    });
    setQuery('');
    focusOn(node.id);
  };

  // Hover traces the whole lineage, like dbt: every ancestor and every descendant
  const traced = useMemo(
    () =>
      hovered
        ? new Set([hovered, ...walk(hovered, up, Infinity), ...walk(hovered, down, Infinity)])
        : null,
    [hovered, up, down],
  );

  const nodes: LineageFlowNode[] = useMemo(() => {
    if (!positions) return [];
    const matchIds = new Set(matches.map((m) => m.id));
    return [...visible.ids].flatMap((id) => {
      const node = nodesById.get(id);
      const position = positions.get(id);
      if (!node || !position) return [];
      let state: NodeState = 'default';
      if (traced) state = id === hovered ? 'active' : traced.has(id) ? 'related' : 'dimmed';
      else if (id === focus) state = 'active';
      else if (matchIds.has(id)) state = 'match';
      return [
        {
          id,
          type: 'lineage',
          position,
          // Known up front so the minimap can draw the nodes before they are measured
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          data: { node, layer: layers.get(node.layer)!, state },
        },
      ];
    });
  }, [positions, visible.ids, nodesById, layers, traced, hovered, focus, matches]);

  const edges: Edge[] = useMemo(
    () =>
      visible.edges.map((e) => {
        const onTrace = traced?.has(e.source) && traced.has(e.target);
        return {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          className: traced ? (onTrace ? styles.edgeActive : styles.edgeDimmed) : undefined,
          animated: !!onTrace,
        };
      }),
    [visible.edges, traced],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && focusOn(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusOn]);

  const counts = useMemo(() => {
    const byLayer = new Map<string, number>();
    for (const n of graph.nodes) byLayer.set(n.layer, (byLayer.get(n.layer) ?? 0) + 1);
    return byLayer;
  }, [graph]);
  const withoutStory = [...visible.ids].filter((id) => !storyOf(nodesById.get(id))).length;
  // One entry per story: a block's Component and View share theirs
  const affectedStories = changedOnly
    ? [
        ...new Map(
          [...visible.ids]
            .map((id) => nodesById.get(id)!)
            .filter((n) => storyOf(n))
            .map((n) => [storyOf(n), n] as const),
        ).values(),
      ]
    : [];
  const focused = focus ? nodesById.get(focus) : undefined;

  return (
    // `data-ready` once the first layout is done, even an empty one, for tests to wait on
    <div className={styles.root} data-ready={positions ? '' : undefined}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.1}
        // Double-click opens a story, so it must not zoom
        zoomOnDoubleClick={false}
        onNodeMouseEnter={(_, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onNodeClick={(_, node) => {
          clearTimeout(clickTimer.current);
          clickTimer.current = setTimeout(() => focusOn(node.id), DOUBLE_CLICK_MS);
        }}
        onNodeDoubleClick={(_, node) => {
          clearTimeout(clickTimer.current);
          openStory(nodesById.get(node.id));
        }}
        onPaneClick={() => focusOn(null)}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => (node as LineageFlowNode).data.layer.color}
          ariaLabel="Lineage overview"
        />
        <Panel position="top-left">
          <div className={styles.panel}>
            <div>
              <h1 className={styles.title}>Lineage</h1>
              <p className={styles.hint}>
                Hover to trace, click to focus, double-click to open the story. Esc clears the
                focus.
              </p>
            </div>

            <label className={styles.field}>
              Search
              <input
                className={styles.input}
                type="search"
                value={query}
                placeholder="button, FeatureGrid…"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && matches[0] && pick(matches[0])}
              />
            </label>
            {needle && (
              <div className={styles.results}>
                <p className={styles.stats}>
                  {matches.length} match{matches.length === 1 ? '' : 'es'}
                  {matches.length > 0 && ', Enter focuses the first'}
                </p>
                {matches.slice(0, MAX_RESULTS).map((n) => (
                  <button
                    key={n.id}
                    className={styles.result}
                    type="button"
                    title={n.id}
                    onClick={() => pick(n)}
                  >
                    <span
                      className={styles.swatch}
                      style={{ '--layer': layers.get(n.layer)?.color } as React.CSSProperties}
                    />
                    <span className={styles.resultLabel}>{n.label}</span>
                    {hiddenLayers.has(n.layer) && <span className={styles.count}>hidden</span>}
                  </button>
                ))}
              </div>
            )}

            <fieldset className={styles.layers}>
              <legend className={styles.legend}>Layers</legend>
              {graph.layers.map((layer) => (
                <label key={layer.id} className={styles.layer}>
                  <input
                    type="checkbox"
                    checked={!hiddenLayers.has(layer.id)}
                    onChange={() =>
                      setHiddenLayers((current) => {
                        const next = new Set(current);
                        if (next.has(layer.id)) next.delete(layer.id);
                        else next.add(layer.id);
                        return next;
                      })
                    }
                  />
                  <span
                    className={styles.swatch}
                    style={{ '--layer': layer.color } as React.CSSProperties}
                  />
                  {layer.label}
                  <span className={styles.count}>{counts.get(layer.id) ?? 0}</span>
                </label>
              ))}
            </fieldset>

            <label className={styles.layer}>
              <input
                type="checkbox"
                checked={hideUnlinked}
                onChange={() => setHideUnlinked((current) => !current)}
              />
              Hide unconnected files
            </label>

            <p className={styles.stats}>
              {visible.ids.size} files, {visible.edges.length} imports, {withoutStory} without a
              story
            </p>

            <div className={styles.focus}>
              <label className={styles.layer}>
                <input
                  type="checkbox"
                  checked={changedOnly}
                  disabled={!graph.changedSince}
                  onChange={() => setChangedOnly((current) => !current)}
                />
                {graph.changedSince ? `Changed since ${graph.changedSince}` : 'Changed files'}
                <span className={styles.count}>{changedIds.length}</span>
              </label>
              {!graph.changedSince && (
                <p className={styles.hint}>No base branch to compare with in this checkout.</p>
              )}
              {changedOnly && (
                <>
                  <code className={styles.selector}>state:modified+</code>
                  <p className={styles.stats}>
                    {changedIds.length} changed, {visible.ids.size - changedIds.length} affected.
                    Stories to check:
                  </p>
                  <div className={styles.results}>
                    {affectedStories.length === 0 && <p className={styles.stats}>None</p>}
                    {affectedStories.map((n) => (
                      <button
                        key={n.id}
                        className={styles.result}
                        type="button"
                        title={n.id}
                        onClick={() => openStory(n)}
                      >
                        <span
                          className={styles.swatch}
                          style={{ '--layer': layers.get(n.layer)?.color } as React.CSSProperties}
                        />
                        <span className={styles.resultLabel}>{n.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {focused && (
              <div className={styles.focus}>
                <p className={styles.focusName}>{focused.id}</p>
                <code className={styles.selector}>
                  {selector(focused.label, upstream, downstream)}
                </code>
                <div className={styles.depths}>
                  <DepthSelect label="Upstream" value={upstream} onChange={setUpstream} />
                  <DepthSelect label="Downstream" value={downstream} onChange={setDownstream} />
                </div>
                {storyOf(focused) && (
                  <button
                    className={styles.button}
                    type="button"
                    onClick={() => openStory(focused)}
                  >
                    Open story
                  </button>
                )}
                <button className={styles.button} type="button" onClick={() => focusOn(null)}>
                  Show everything
                </button>
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

const LineageNodeView: React.FC<NodeProps<LineageFlowNode>> = ({
  data: { node, layer, state },
}) => (
  <div
    className={`${styles.node} ${state === 'default' ? '' : styles[state]} ${node.changed ? styles.changed : ''}`}
    style={{ '--layer': layer.color } as React.CSSProperties}
    title={node.id}
  >
    <Handle
      className={styles.handle}
      type="target"
      position={Position.Left}
      isConnectable={false}
    />
    <span className={styles.label}>{node.label}</span>
    {node.changed && <span className={styles.changedBadge}>changed</span>}
    <span className={styles.meta}>
      {layer.label}
      {node.storyVia && !node.storyId && (
        <span className={styles.storyVia}>story via {node.storyVia.label.split('/').pop()}</span>
      )}
      {!storyOf(node) && <span className={styles.noStory}>no story</span>}
    </span>
    <Handle
      className={styles.handle}
      type="source"
      position={Position.Right}
      isConnectable={false}
    />
  </div>
);

const nodeTypes = { lineage: LineageNodeView };

const DepthSelect: React.FC<{
  label: string;
  value: number;
  onChange: (depth: number) => void;
}> = ({ label, value, onChange }) => (
  <label className={styles.field}>
    {label}
    <select
      className={styles.input}
      value={String(value)}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {DEPTHS.map((d) => (
        <option key={d} value={String(d)}>
          {d === 0 ? 'None' : d === Infinity ? 'All' : `+${d}`}
        </option>
      ))}
    </select>
  </label>
);

/** The dbt selector for a focus: `+model+` for everything, `2+model+1` for two levels up and one down. */
function selector(name: string, upstream: number, downstream: number) {
  const level = (depth: number) => (depth === Infinity ? '' : String(depth));
  const up = upstream === 0 ? '' : `${level(upstream)}+`;
  const down = downstream === 0 ? '' : `+${level(downstream)}`;
  return `${up}${name}${down}`;
}

/** A node id from a path, or from a story id: the exact docs id first, then any story of the same component. */
function resolveFocus(graph: Graph, focus: string | undefined) {
  if (!focus) return null;
  const component = focus.split('--')[0];
  const node =
    graph.nodes.find((n) => n.id === focus || n.storyId === focus) ??
    graph.nodes.find((n) => n.storyId?.split('--')[0] === component);
  return node?.id ?? null;
}

/** The docs page that shows a file: its own story, or the one it borrows from its folder. */
function storyOf(node: LineageNode | undefined) {
  return node?.storyId ?? node?.storyVia?.storyId;
}

function openStory(node: LineageNode | undefined) {
  // A plain URL rather than SELECT_STORY, which would carry the graph's `focus` arg into the docs URL
  const storyId = storyOf(node);
  if (storyId) addons.getChannel().emit(NAVIGATE_URL, `?path=/docs/${storyId}`);
}

function adjacency(edges: Graph['edges']) {
  const up = new Map<string, string[]>();
  const down = new Map<string, string[]>();
  for (const { source, target } of edges) {
    up.set(target, [...(up.get(target) ?? []), source]);
    down.set(source, [...(down.get(source) ?? []), target]);
  }
  return { up, down };
}

/** Every node reachable from `start` within `maxDepth` steps, not counting `start`. */
function walk(start: string, next: Map<string, string[]>, maxDepth: number) {
  const seen = new Set<string>();
  let frontier = [start];
  for (let level = 0; level < maxDepth && frontier.length; level++) {
    frontier = frontier
      .flatMap((id) => next.get(id) ?? [])
      .filter((id) => id !== start && !seen.has(id));
    for (const id of frontier) seen.add(id);
  }
  return seen;
}
