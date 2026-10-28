import type { LineageEdge } from './types';

/**
 * The left-to-right order of the layers' columns, as a column number per layer id. Layers go in the
 * order that has the most imports running left to right, so a project's utilities come before its
 * primitives, components and pages, whatever order the layers are listed in (that order is for
 * matching). A layer with its own `column` goes in at that position instead.
 *
 * Finding the order with the fewest imports running backwards is NP-hard, so this uses the greedy
 * heuristic of Eades, Lin and Smyth: take layers that nothing left of them imports first, then
 * layers that import nothing still unplaced last, else the one with the most imports out than in.
 * Ties keep the listed order.
 */
export function layerColumns(
  layers: readonly { id: string; column?: number }[],
  layerOf: (file: string) => string | undefined,
  edges: readonly LineageEdge[],
): Map<string, number> {
  // Imports between layers, weighted by how many files make them
  const weight = new Map<string, Map<string, number>>(layers.map((l) => [l.id, new Map()]));
  for (const e of edges) {
    const from = layerOf(e.source);
    const to = layerOf(e.target);
    if (!from || !to || from === to) continue;
    const out = weight.get(from);
    if (out) out.set(to, (out.get(to) ?? 0) + 1);
  }

  const remaining = layers.map((l) => l.id);
  const sum = (id: string, direction: 'out' | 'in') =>
    remaining.reduce(
      (total, other) =>
        total +
        (direction === 'out'
          ? (weight.get(id)?.get(other) ?? 0)
          : (weight.get(other)?.get(id) ?? 0)),
      0,
    );
  const take = (id: string) => remaining.splice(remaining.indexOf(id), 1)[0];

  const left: string[] = [];
  const right: string[] = [];
  while (remaining.length) {
    const source = remaining.find((id) => sum(id, 'in') === 0);
    if (source) {
      left.push(take(source));
      continue;
    }
    const sink = [...remaining].reverse().find((id) => sum(id, 'out') === 0);
    if (sink) {
      right.unshift(take(sink));
      continue;
    }
    const best = remaining.reduce((a, b) =>
      sum(b, 'out') - sum(b, 'in') > sum(a, 'out') - sum(a, 'in') ? b : a,
    );
    left.push(take(best));
  }

  // Layers with a `column` go in at that position, the rest keep their order around them
  const pinned = layers.filter((l) => l.column !== undefined).sort((a, b) => a.column! - b.column!);
  const order = [...left, ...right].filter((id) => !pinned.some((l) => l.id === id));
  for (const l of pinned) order.splice(Math.max(0, Math.min(l.column!, order.length)), 0, l.id);
  return new Map(order.map((id, column) => [id, column]));
}
