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
import { useLayout } from '@rock-solid/lineage-core/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { Schema, SchemaEntity, SchemaField } from '../schema';
import {
  describeCardinality,
  erdEdges,
  ERD_LAYOUT,
  selfReferences,
  TABLE_WIDTH,
  tableHeight,
  visibleRows,
  type ErdEdge,
} from './erdModel';
import { fitPadding } from './model';

type TableState = 'default' | 'active' | 'related' | 'dimmed' | 'selected';
type TableData = {
  entity: SchemaEntity;
  rows: SchemaField[];
  hidden: number;
  expanded: boolean;
  /** Off with "Key fields only", which shows the same rows either way. */
  canExpand: boolean;
  selfRefs: Set<string>;
  linked: Set<string>;
  state: TableState;
  onToggle: () => void;
  onSelect: (id: string) => void;
  /** Shows the table's references while its header has keyboard focus, as hover does. */
  onTrace: (id: string | null) => void;
};
type TableNode = Node<TableData, 'table'>;

export type ErdCanvasProps = {
  schema: Schema;
  /** Admin URLs of the collections and globals, by entity id, for the "Open" links. */
  adminURLs: Record<string, string>;
};

/** The data model as an ERD: a table per collection and global, a line per reference. */
export const ErdCanvas: React.FC<ErdCanvasProps> = (props) => (
  <ReactFlowProvider>
    <Canvas {...props} />
  </ReactFlowProvider>
);

const Canvas: React.FC<ErdCanvasProps> = ({ schema, adminURLs }) => {
  const { fitView } = useReactFlow();
  const layoutRef = useRef<HTMLDivElement>(null);
  const [showGlobals, setShowGlobals] = useState(true);
  const [keysOnly, setKeysOnly] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const entities = useMemo(
    () => schema.entities.filter((e) => showGlobals || e.kind !== 'global'),
    [schema, showGlobals],
  );
  const relations = useMemo(() => {
    const ids = new Set(entities.map((e) => e.id));
    return schema.relations.filter((r) => ids.has(r.from) && ids.has(r.to));
  }, [schema, entities]);
  const lines = useMemo(() => erdEdges(relations), [relations]);

  const tables = useMemo(
    () =>
      entities.map((entity) => {
        const isExpanded = expanded.has(entity.id);
        const { rows, hidden } = visibleRows(entity, relations, { keysOnly, expanded: isExpanded });
        return {
          entity,
          rows,
          hidden,
          expanded: isExpanded,
          // Room for the "+N more" or "Show fewer" button under the rows
          height: tableHeight(rows.length, !keysOnly && (hidden || isExpanded) ? 1 : 0),
          selfRefs: selfReferences(entity, relations),
          linked: new Set(relations.filter((r) => r.from === entity.id).map((r) => r.field)),
        };
      }),
    [entities, relations, keysOnly, expanded],
  );

  // Lays out again only when tables come, go or change height, or the lines change
  const positions = useLayout(
    useMemo(
      () => tables.map((t) => ({ id: t.entity.id, width: TABLE_WIDTH, height: t.height })),
      [tables],
    ),
    useMemo(() => lines.map((l) => ({ source: l.from, target: l.to })), [lines]),
    ERD_LAYOUT,
    () =>
      requestAnimationFrame(() =>
        fitView({ padding: fitPadding(layoutRef.current?.clientWidth ?? 0) }),
      ),
  );

  // Hover shows a table's own references, both ways
  const neighbours = useMemo(() => {
    if (!hovered) return null;
    const ids = new Set([hovered]);
    for (const l of lines) {
      if (l.from === hovered) ids.add(l.to);
      if (l.to === hovered) ids.add(l.from);
    }
    return ids;
  }, [hovered, lines]);

  const nodes: TableNode[] = useMemo(() => {
    if (!positions) return [];
    return tables.flatMap((t) => {
      const position = positions.get(t.entity.id);
      if (!position) return [];
      let state: TableState = 'default';
      if (neighbours)
        state =
          t.entity.id === hovered ? 'active' : neighbours.has(t.entity.id) ? 'related' : 'dimmed';
      else if (t.entity.id === selected) state = 'selected';
      return [
        {
          id: t.entity.id,
          type: 'table',
          position,
          width: TABLE_WIDTH,
          height: t.height,
          data: {
            entity: t.entity,
            rows: t.rows,
            hidden: t.hidden,
            expanded: t.expanded,
            canExpand: !keysOnly,
            selfRefs: t.selfRefs,
            linked: t.linked,
            state,
            onSelect: setSelected,
            onTrace: setHovered,
            onToggle: () =>
              setExpanded((current) => {
                const next = new Set(current);
                if (next.has(t.entity.id)) next.delete(t.entity.id);
                else next.add(t.entity.id);
                return next;
              }),
          },
        },
      ];
    });
  }, [positions, tables, neighbours, hovered, selected, keysOnly]);

  const edges: Edge[] = useMemo(
    () =>
      lines.map((l) => {
        const on = neighbours && (l.from === hovered || l.to === hovered);
        const state = neighbours
          ? on
            ? ' rs-lineage__edge--active'
            : ' rs-lineage__edge--dimmed'
          : '';
        const kind = l.relations.every((r) => r.kind === 'upload') ? 'upload' : 'relationship';
        return {
          id: l.id,
          source: l.from,
          sourceHandle: `row:${l.field}`,
          target: l.to,
          targetHandle: 'table',
          type: 'smoothstep',
          label: l.cardinality,
          labelClassName: 'rs-erd__cardinality',
          labelBgClassName: 'rs-erd__cardinality-bg',
          className: `rs-lineage__edge rs-lineage__edge--${kind}${state}`,
          animated: !!on,
        };
      }),
    [lines, neighbours, hovered],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const byId = useMemo(() => new Map(schema.entities.map((e) => [e.id, e])), [schema]);
  const focused = selected ? byId.get(selected) : undefined;
  const fieldCount = entities.reduce((n, e) => n + e.fields.length, 0);

  return (
    <div className="rs-lineage-layout" ref={layoutRef}>
      <div className="rs-lineage" data-ready={positions ? '' : undefined}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          // The node's own button takes keyboard focus, so React Flow's wrappers don't add tab stops
          nodesFocusable={false}
          edgesFocusable={false}
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
              `rs-lineage__minimap-node--${(node as TableNode).data.entity.kind}`
            }
            ariaLabel="Data model overview"
          />
          <Panel position="top-left">
            <div className="rs-lineage__toolbar">
              <label className="rs-lineage__toggle">
                <input
                  type="checkbox"
                  checked={showGlobals}
                  onChange={() => setShowGlobals((v) => !v)}
                />
                <span className="rs-lineage__swatch rs-lineage__swatch--global" />
                Globals
              </label>
              <label className="rs-lineage__toggle">
                <input type="checkbox" checked={keysOnly} onChange={() => setKeysOnly((v) => !v)} />
                Key fields only
              </label>
              <span className="rs-lineage__count">
                {entities.length} tables, {fieldCount} fields, {lines.length} references
              </span>
            </div>
          </Panel>
        </ReactFlow>
      </div>
      {/* Beside the graph on a wide canvas, under it on a narrow one (see lineage.css) */}
      <Details
        entity={focused}
        lines={lines}
        byId={byId}
        adminURLs={adminURLs}
        onSelect={setSelected}
      />
    </div>
  );
};

const Details: React.FC<{
  entity: SchemaEntity | undefined;
  lines: readonly ErdEdge[];
  byId: Map<string, SchemaEntity>;
  adminURLs: Record<string, string>;
  onSelect: (id: string) => void;
}> = ({ entity, lines, byId, adminURLs, onSelect }) => {
  if (!entity) {
    return (
      <aside className="rs-lineage__details">
        <p className="rs-lineage__hint">
          Hover a table to see what it references and what references it. Click it for the field
          paths behind each line. Esc clears the selection.
        </p>
        <dl className="rs-lineage__legend">
          <div>
            <dt className="rs-erd__key">many-to-one</dt>
            <dd>each document references one; many can share it</dd>
          </div>
          <div>
            <dt className="rs-erd__key">many-to-many</dt>
            <dd>a list of references: hasMany, or inside an array or blocks</dd>
          </div>
          <div>
            <dt className="rs-erd__key">one-to-one</dt>
            <dd>a unique reference, or a global's single one</dd>
          </div>
          <div>
            <dt className="rs-erd__key">one-to-many</dt>
            <dd>a global's list of references</dd>
          </div>
          <div>
            <dt className="rs-erd__key">↻</dt>
            <dd>points at its own collection</dd>
          </div>
          <div>
            <dt className="rs-erd__key">*</dt>
            <dd>required</dd>
          </div>
        </dl>
      </aside>
    );
  }
  const out = lines.filter((l) => l.from === entity.id);
  const into = lines.filter((l) => l.to === entity.id);
  const url = adminURLs[entity.id];
  const item = (line: ErdEdge, otherId: string) => {
    const other = byId.get(otherId)!;
    const from = byId.get(line.from)!;
    const to = byId.get(line.to)!;
    return (
      <li key={line.id}>
        <button type="button" className="rs-lineage__link" onClick={() => onSelect(other.id)}>
          <span className="rs-lineage__link-name">
            <span className={`rs-lineage__swatch rs-lineage__swatch--${other.kind}`} />
            {other.label}
            <span className="rs-erd__cardinality-tag">{line.cardinality}</span>
          </span>
          <span className="rs-erd__sentence">
            {describeCardinality(line.cardinality, from, to)}
          </span>
          <span className="rs-lineage__via">{line.relations.map((r) => r.path).join(', ')}</span>
        </button>
      </li>
    );
  };
  return (
    <aside className="rs-lineage__details" aria-live="polite">
      <div>
        <span className={`rs-lineage__kind rs-lineage__kind--${entity.kind}`}>
          {entity.kind}
          {entity.auth ? ' · auth' : ''}
          {entity.upload ? ' · upload' : ''}
        </span>
        <h2 className="rs-lineage__name">{entity.label}</h2>
        <code className="rs-lineage__id">
          {entity.slug} · {entity.fields.length} fields
        </code>
      </div>
      {url && (
        <a className="rs-lineage__open" href={url}>
          Open in the admin
        </a>
      )}
      <section>
        <h3 className="rs-lineage__heading">References · {out.length}</h3>
        {out.length ? (
          <ul className="rs-lineage__list">{out.map((l) => item(l, l.to))}</ul>
        ) : (
          <p className="rs-lineage__hint">None of its fields reference another collection.</p>
        )}
      </section>
      <section>
        <h3 className="rs-lineage__heading">Referenced by · {into.length}</h3>
        {into.length ? (
          <ul className="rs-lineage__list">{into.map((l) => item(l, l.from))}</ul>
        ) : (
          <p className="rs-lineage__hint">Nothing references it.</p>
        )}
      </section>
    </aside>
  );
};

const TableView: React.FC<NodeProps<TableNode>> = ({
  data: {
    entity,
    rows,
    hidden,
    expanded,
    canExpand,
    selfRefs,
    linked,
    state,
    onToggle,
    onSelect,
    onTrace,
  },
}) => (
  <div className={`rs-erd__table rs-lineage__node--${entity.kind} rs-erd__table--${state}`}>
    <Handle
      id="table"
      className="rs-lineage__handle"
      type="target"
      position={Position.Left}
      isConnectable={false}
    />
    {/* A real button, so Tab reaches the table and Enter or Space opens its details */}
    <button
      type="button"
      className="rs-erd__header"
      title={entity.id}
      aria-label={`${entity.label}, ${entity.kind}: show its references`}
      onClick={() => onSelect(entity.id)}
      onFocus={() => onTrace(entity.id)}
      onBlur={() => onTrace(null)}
    >
      <span className="rs-erd__title">{entity.label}</span>
      <span className="rs-erd__badge">
        {entity.kind === 'global'
          ? 'global'
          : entity.auth
            ? 'auth'
            : entity.upload
              ? 'upload'
              : entity.slug}
      </span>
    </button>
    <ul className="rs-erd__rows">
      {rows.map((f) => (
        <li
          key={f.name}
          className={`rs-erd__row${linked.has(f.name) ? ' rs-erd__row--link' : ''}`}
          title={describe(f)}
        >
          <span className="rs-erd__field">
            {f.name}
            {f.required && <span className="rs-erd__required">*</span>}
            {selfRefs.has(f.name) && (
              <span className="rs-erd__self" title="Points at its own collection">
                ↻
              </span>
            )}
          </span>
          <span className="rs-erd__type">
            {f.type === 'blocks' ? `blocks (${f.blocks?.length ?? 0})` : f.type}
            {f.hasMany ? '[]' : ''}
          </span>
          {linked.has(f.name) && (
            <Handle
              id={`row:${f.name}`}
              className="rs-lineage__handle"
              type="source"
              position={Position.Right}
              isConnectable={false}
            />
          )}
        </li>
      ))}
    </ul>
    {canExpand && (hidden > 0 || expanded) && (
      <button
        type="button"
        className="rs-erd__more nodrag"
        onClick={(event) => {
          // Expanding isn't selecting the table
          event.stopPropagation();
          onToggle();
        }}
      >
        {expanded ? 'Show fewer fields' : `+${hidden} more field${hidden === 1 ? '' : 's'}`}
      </button>
    )}
  </div>
);

/** A row's tooltip: type, cardinality and what it points at. */
function describe(f: SchemaField) {
  const parts = [f.type];
  if (f.hasMany) parts.push('has many');
  if (f.required) parts.push('required');
  if (f.localized) parts.push('localized');
  if (f.unique) parts.push('unique');
  if (f.relationTo) parts.push(`→ ${f.relationTo.join(' | ')}`);
  if (f.blocks) parts.push(`blocks: ${f.blocks.join(', ')}`);
  return `${f.name}: ${parts.join(', ')}`;
}

const nodeTypes = { table: TableView };
