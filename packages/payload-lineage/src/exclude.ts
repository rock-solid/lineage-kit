import type { ContentGraphOptions } from './types';

// Payload adds these collections to every sanitized config; it adds no globals or blocks
const INTERNAL_COLLECTION = /^payload-/;

/**
 * The plugin's `exclude` rule, shared by the graph, the data model and the base branch's snapshot:
 * a slug leaves out every kind with it, `<kind>:<slug>` only that one, and Payload's own
 * collections are always out.
 */
export function excluder({ exclude = [] }: ContentGraphOptions = {}) {
  return (kind: string, slug: string) =>
    (kind === 'collection' && INTERNAL_COLLECTION.test(slug)) ||
    exclude.includes(slug) ||
    exclude.includes(`${kind}:${slug}`);
}
