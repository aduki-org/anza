/**
 * src/core/router/trie.js
 *
 * Radix-trie route matcher. Decomposes patterns into '/'-separated segments and
 * matches a pathname in O(k) where k is the segment count, instead of the O(n)
 * linear scan over all routes. Static segments beat params beat wildcards, the
 * same specificity order the URLPattern scan uses.
 *
 * Patterns the trie cannot express (regex groups, optional/repeat modifiers)
 * are rejected by insert() so match.js can keep them on the URLPattern path.
 *
 * Source: tasks.md Phase 7
 */

class Segment {
  constructor() {
    this.static = new Map();  // literal -> Segment
    this.param = null;        // Segment for a :named segment
    this.wild = null;         // Segment for a * segment
    this.route = null;        // route entry stored at a terminal node
    this.key = null;          // param name (when this node is a param child)
  }
}

const trie = new Segment();

/** A pattern is trie-expressible only if every segment is plain, :param, or *. */
export function expressible(pattern) {
  if (typeof pattern !== 'string') return false;
  if (pattern.startsWith('http://') || pattern.startsWith('https://')) return false;
  for (const part of pattern.split('/')) {
    if (!part) continue;
    if (part === '*') continue;
    if (part.startsWith(':')) {
      // Reject modifiers/regex groups: ':id?', ':id+', ':id(\\d+)'.
      if (/[?+*(){}]/.test(part)) return false;
      continue;
    }
    // A literal segment must contain no pattern metacharacters.
    if (/[:*?+(){}]/.test(part)) return false;
  }
  return true;
}

/**
 * Inserts a route under its pattern.
 *
 * @param {string} pattern - e.g. '/members/:id/posts/:post'.
 * @param {object} route - the route entry to store.
 * @returns {boolean} true if inserted, false if the pattern is not expressible.
 */
export function insert(pattern, route) {
  if (!expressible(pattern)) return false;

  const parts = pattern.split('/').filter(Boolean);
  let node = trie;

  for (const part of parts) {
    if (part === '*') {
      node.wild ??= new Segment();
      node = node.wild;
    } else if (part.startsWith(':')) {
      node.param ??= new Segment();
      node.param.key = part.slice(1);
      node = node.param;
    } else {
      if (!node.static.has(part)) node.static.set(part, new Segment());
      node = node.static.get(part);
    }
  }

  node.route = route;
  return true;
}

/**
 * Finds the most specific route for a pathname.
 *
 * @param {string} pathname - e.g. '/members/42/posts/7'.
 * @returns {{ route: object, params: Record<string,string> }|null}
 */
export function find(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const params = {};
  const route = walk(trie, parts, 0, params);
  return route ? { route, params } : null;
}

function walk(node, parts, index, params) {
  if (index === parts.length) return node.route;

  const segment = parts[index];

  // 1. Static — highest specificity.
  const staticNode = node.static.get(segment);
  if (staticNode) {
    const hit = walk(staticNode, parts, index + 1, params);
    if (hit) return hit;
  }

  // 2. Param — medium specificity. Backtrack the binding if it fails.
  if (node.param) {
    params[node.param.key] = decode(segment);
    const hit = walk(node.param, parts, index + 1, params);
    if (hit) return hit;
    delete params[node.param.key];
  }

  // 3. Wildcard — lowest specificity, swallows the remainder.
  if (node.wild) {
    params['*'] = parts.slice(index).map(decode).join('/');
    return node.wild.route;
  }

  return null;
}

function decode(s) {
  try { return decodeURIComponent(s); } catch (_) { return s; }
}

/** Empties the trie. */
export function clear() {
  trie.static.clear();
  trie.param = null;
  trie.wild = null;
  trie.route = null;
}

export { Segment };
