// A graph as Mermaid text, which GitHub, GitLab and most docs tools draw: for pasting a view into a
// PR, a doc or a ticket.

export type MermaidNode = {
  id: string;
  label: string;
  /** Nodes in a group share its colour, e.g. a layer or a kind. */
  group?: string;
};

export type MermaidEdge = {
  source: string;
  target: string;
  label?: string;
  /** `solid` by default; `dashed` and `thick` tell kinds of link apart. */
  style?: 'solid' | 'dashed' | 'thick';
};

export type MermaidGroup = { id: string; label?: string; color: string };

export type MermaidFlowchart = {
  nodes: readonly MermaidNode[];
  edges: readonly MermaidEdge[];
  groups?: readonly MermaidGroup[];
  /** Left to right by default, like the graphs. */
  direction?: 'LR' | 'TB';
};

/** Past this many nodes a Mermaid diagram gets hard to read; the copy buttons say so. */
export const MERMAID_READABLE_NODES = 50;

const ARROW = { solid: '-->', dashed: '-.->', thick: '==>' } as const;

/**
 * A flowchart, nodes and edges in the order given. Ids become `n0`, `n1`, … so any id is safe, and
 * labels are quoted with Mermaid's entity codes for the characters that would end them. An edge to
 * a node that isn't listed is left out.
 */
export function toMermaidFlowchart({
  nodes,
  edges,
  groups = [],
  direction = 'LR',
}: MermaidFlowchart): string {
  const ids = new Map(nodes.map((n, i) => [n.id, `n${i}`]));
  const lines = [`flowchart ${direction}`];

  for (const n of nodes) lines.push(`  ${ids.get(n.id)}["${escapeLabel(n.label)}"]`);

  for (const e of edges) {
    const from = ids.get(e.source);
    const to = ids.get(e.target);
    if (!from || !to) continue;
    const arrow = ARROW[e.style ?? 'solid'];
    const label = e.label ? `|"${escapeLabel(e.label)}"|` : '';
    lines.push(`  ${from} ${arrow}${label} ${to}`);
  }

  const used = new Set(nodes.map((n) => n.group).filter(Boolean));
  groups.forEach((g, i) => {
    if (!used.has(g.id)) return;
    const members = nodes.filter((n) => n.group === g.id).map((n) => ids.get(n.id));
    lines.push(`  classDef g${i} fill:${g.color},stroke:${g.color},color:#fff`);
    lines.push(`  class ${members.join(',')} g${i}`);
  });

  return `${lines.join('\n')}\n`;
}

/**
 * Text safe inside a quoted Mermaid label: `#` first (it starts an entity code), then quotes and
 * angle brackets as entity codes.
 */
export function escapeLabel(text: string) {
  return text
    .replace(/#/g, '#35;')
    .replace(/"/g, '#quot;')
    .replace(/</g, '#lt;')
    .replace(/>/g, '#gt;');
}
