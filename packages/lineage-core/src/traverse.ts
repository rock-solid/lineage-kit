/** A link in a lineage graph: `source` is the dependency, `target` what uses it. */
export type Link = { source: string; target: string };

/** Each node's dependencies (`up`) and the nodes that use it (`down`). */
export function adjacency(links: readonly Link[]) {
  const up = new Map<string, string[]>();
  const down = new Map<string, string[]>();
  for (const { source, target } of links) {
    up.set(target, [...(up.get(target) ?? []), source]);
    down.set(source, [...(down.get(source) ?? []), target]);
  }
  return { up, down };
}

/** Every node reachable from `start` within `maxDepth` steps, not counting `start`. */
export function walk(start: string, next: Map<string, string[]>, maxDepth = Infinity) {
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

/** `id` and everything upstream and downstream of it, like dbt's `+model+`. */
export function trace(id: string, links: readonly Link[]): Set<string> {
  const { up, down } = adjacency(links);
  return new Set([id, ...walk(id, up), ...walk(id, down)]);
}
