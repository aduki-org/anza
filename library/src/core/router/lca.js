/**
 * src/core/router/lca.js
 *
 * Lowest common ancestor over the container graph. Given two container names,
 * computes the deepest node that is an ancestor of both — the pivot for a
 * cross-branch navigation (everything below it on the source side unmounts,
 * everything below it on the target side mounts).
 *
 * O(d) where d is tree depth. For real UI trees d rarely exceeds 5.
 *
 * Source: tasks.md Phase 4
 */

import { get } from './graph.js';

/**
 * @param {string} a - first container name.
 * @param {string} b - second container name.
 * @returns {import('./graph.js').Node|null} the lowest common ancestor, or null.
 */
export function lca(a, b) {
  let na = get(a);
  let nb = get(b);
  if (!na || !nb) return null;

  // Phase 1: equalize depth.
  while (na.depth > nb.depth) na = na.parent;
  while (nb.depth > na.depth) nb = nb.parent;

  // Phase 2: walk up in tandem until the pointers meet.
  while (na && nb && na !== nb) {
    na = na.parent;
    nb = nb.parent;
  }

  return na ?? null;
}

/**
 * Ordered node path from the common ancestor down to `to`.
 *
 * @param {string} from - source container name.
 * @param {string} to - target container name.
 * @returns {import('./graph.js').Node[]|null} ancestor-first node chain, or null.
 */
export function path(from, to) {
  const ancestor = lca(from, to);
  if (!ancestor) return null;

  const segments = [];
  let current = get(to);
  while (current && current !== ancestor) {
    segments.unshift(current);
    current = current.parent;
  }
  segments.unshift(ancestor);
  return segments;
}
