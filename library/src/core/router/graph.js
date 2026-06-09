/**
 * src/core/router/graph.js
 *
 * Hierarchical container graph. Replaces the flat name->WeakRef registry with a
 * tree that knows parent/child relationships and depth, enabling lowest-common-
 * ancestor traversal (lca.js) and sequential cascade mounting (cascade.js).
 *
 * Every node holds a WeakRef to its element so an unmounted container can be
 * garbage-collected without a manual unregister. A FinalizationRegistry prunes
 * stale nodes. The virtual root 'body' always exists.
 *
 * Source: tasks.md Phase 3
 */

class Node {
  constructor(name, ref, parent) {
    this.name = name;            // registry key, e.g. 'main' | 'sidebar'
    this.ref = ref;              // WeakRef<Element> | null (null for virtual root)
    this.parent = parent;        // Node | null
    this.children = new Set();   // Set<Node>
    this.depth = parent ? parent.depth + 1 : 0;
  }

  /** @returns {boolean} true while the referenced element is still alive. */
  alive() {
    return this.ref ? this.ref.deref() !== undefined : true;
  }
}

const nodes = new Map();
const root = new Node('body', null, null);
nodes.set('body', root);

// Explicit unregistrations. element() returns undefined for a name in this set
// so a just-unmounted container is not confused with a GC'd one (RT bug 8.2).
const gone = new Set();

// Prune stale nodes after their element is collected.
const finalizer = typeof FinalizationRegistry !== 'undefined'
  ? new FinalizationRegistry((name) => {
      const node = nodes.get(name);
      if (node && !node.alive()) detach(name);
    })
  : { register() {}, unregister() {} };

/** Removes a node from the tree, reparenting its children to its parent. */
function detach(name) {
  const node = nodes.get(name);
  if (!node || node === root) return;
  node.parent?.children.delete(node);
  for (const child of node.children) {
    child.parent = node.parent;
    child.depth = child.parent ? child.parent.depth + 1 : 0;
    node.parent?.children.add(child);
  }
  nodes.delete(name);
}

/**
 * Inserts (or re-points) a container node under a parent.
 *
 * @param {string} name - unique registry key.
 * @param {Element} el - the container element.
 * @param {string} [parent='body'] - parent registry key.
 * @returns {Node} the inserted node.
 */
export function add(name, el, parent = 'body') {
  gone.delete(name);

  const existing = nodes.get(name);
  if (existing && existing !== root) {
    const prev = existing.ref?.deref();
    if (prev && prev !== el) {
      throw new Error(`ContainerError: Singleton violation — '${name}' is already mounted. A second instance cannot register while the first is active.`);
    }
    // Same element re-registering (e.g. HMR): refresh the ref and return.
    existing.ref = new WeakRef(el);
    return existing;
  }

  const parentNode = nodes.get(parent) ?? root;
  const node = new Node(name, new WeakRef(el), parentNode);
  parentNode.children.add(node);
  nodes.set(name, node);
  finalizer.register(el, name);
  return node;
}

/**
 * Removes a container node. Marks the name as explicitly gone for one macrotask
 * so a lookup during teardown does not fall back to a stale resolution.
 *
 * @param {string} name - registry key.
 * @param {Element} [el] - element guard; if given, only removes when it matches.
 */
export function remove(name, el) {
  const node = nodes.get(name);
  if (!node || node === root) return;

  const current = node.ref?.deref();
  if (el && current && current !== el) return;

  if (current) {
    try { finalizer.unregister(current); } catch (_) {}
  }
  detach(name);

  gone.add(name);
  if (typeof setTimeout !== 'undefined') {
    setTimeout(() => gone.delete(name), 0);
  }
}

/**
 * @param {string} name - registry key.
 * @returns {Node|null} the node, or null if absent.
 */
export function get(name) {
  return nodes.get(name) ?? null;
}

/**
 * Resolves a node's live element.
 *
 * @param {string} name - registry key.
 * @returns {Element|null|undefined} element, null if absent,
 *   or undefined if the name was just explicitly removed.
 */
export function element(name) {
  if (gone.has(name)) return undefined;
  const node = nodes.get(name);
  if (!node) return null;
  return node.ref ? (node.ref.deref() ?? null) : null;
}

/** Resets the graph to root-only. */
export function clear() {
  nodes.clear();
  root.children.clear();
  gone.clear();
  nodes.set('body', root);
}

export { Node, root };
