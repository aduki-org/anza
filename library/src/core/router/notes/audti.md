# Router Architecture Audit

Companion: see `definitions.md` for the unified `page` / `dock` / `view` API that supersedes the split `ui.element` + `router.register` pattern referenced throughout this document.

---

## 1. Critical Analysis

### 1.1 Hard Refresh Failure

**Bug.**
`setup()` in `intercept.js` fires its initial route match via a single microtask:

```js
// intercept.js
Promise.resolve().then(async () => {
  const url = window.navigation.currentEntry?.url || window.location.href;
  const found = await match(url);   // routes[] is empty on cold boot
  ...
});
```

This races against three parallel processes:

1. **Route registration** — ES module graph has not yet evaluated any `page(...)` calls.
2. **Container availability** — Custom Elements have not fired `connectedCallback`.
3. **Orchestrator attachment** — listener may not yet exist.

The microtask fires *before* `DOMContentLoaded`, before Custom Element `connectedCallback`, and before downstream modules finish. Result: `match()` returns `null` or emits `found` to an orchestrator that calls `getContainer()` on a node that has not mounted.

**Edge cases.**

- `<script type="module">` is deferred by spec — route registration happens in a subsequent microtask *after* `setup()` already fired.
- `<script type="module" async>` — execution order is non-deterministic.
- Service Worker serving stale HTML while JS bundles update — container tags may mismatch registered names.

---

### 1.2 Global Initialization Timing

**Bug.**
The auto-bootstrap block in `router/index.js` runs at module evaluation time:

```js
if (typeof window !== 'undefined') {
  registerNavigator(navigate);
  setup();
  setupTabSync(router);
}
```

- `setup()` attaches the Navigation API listener *before* any route is registered.
- The initial match fires in the same microtask queue tick as module evaluation.
- No `window.router` global exists — users must import the object, but the pattern implies global availability.

**Edge cases.**

- Two entry points both importing `router/index.js` — `setup()` is idempotent, but route registration order is undefined.
- Dynamic `import()` after page load — `setup()` fires, emits initial match, but `DOMContentLoaded` already passed.

---

### 1.3 Flat Container Registry

**Bug.**
`container.js` stores `Map<string, WeakRef<HTMLElement>>` — a flat key-value store. It has no concept of:

- Parent/child relationships
- Depth or nesting level
- Sibling adjacency
- Path from root to a given container

The `route.meta.parent` field in `match.js` chains *route patterns*, not *DOM containers*. A route declaring `container: 'sidebar'` carries no information about whether `sidebar` lives inside `main` which lives inside `body`.

**Consequence.**
Cross-branch navigation — from a view in container A to a view in container B — requires understanding tree shape. Without a graph the router cannot:

1. Determine which containers to unmount (everything below the divergence point)
2. Determine which containers to mount (everything on the new branch)
3. Identify the Lowest Common Ancestor (LCA) to minimise DOM churn

---

### 1.4 Cross-Branch Reconciliation Is Absent

**Bug.**
Resolution logic in `intercept.js` is binary:

```js
if (routeMatch?.route?.meta?.container) {
  const name = routeMatch.route.meta.container;
  if (!getContainer(name)) {
    throw new Error(...);  // hard failure — no recovery
  }
}
```

On failure it throws. It makes no attempt to:

1. Walk up to a common ancestor that *is* in the DOM
2. Sequentially mount intermediate containers downward
3. Await their `connectedCallback` before proceeding

**Example.**

```
Target:   /settings/profile  →  container: 'settings-panel'
Chain:    body → main → sidebar → settings-panel
Current:  /dashboard  →  only 'main' is mounted
```

Navigation fails because `settings-panel` doesn't exist — it would only exist after `sidebar` is mounted inside `main`.

---

### 1.5 Route-to-Container Mapping Is One-Dimensional

**Bug.**
Each route declares a single `container` string with no way to express the mount chain:

```js
router.register('/settings/profile', 'page-profile', { container: 'settings-panel' });
```

There is no mechanism to say "to reach `settings-panel`, first ensure `sidebar` is in `main`." The `meta.parent` field chains *route patterns*, not *DOM ancestry*. These are orthogonal trees.

**Mismatch.**
Route hierarchy ≠ container hierarchy. A deeply nested route (`/a/b/c`) might render in a top-level container. A shallow route (`/settings`) might need three nested containers. The current architecture conflates them.

**Resolution.**
The `page(path, { via: [...chain] })` definition in the companion `definitions.md` solves this directly — the ordered array is the container chain root-to-leaf, with the last entry as the render target.

---

### 1.6 Auto-Bootstrap Has No Window Bridge

**Bug.**
The router initialises at module evaluation but never attaches to `window`. Any code that runs before the consumer's `import` statement cannot access the router instance. The documentation suggests `window.navigate(...)` but no bridge creates it.

---

### 1.7 No Cycle Detection in Route Chain

**Bug.**
`match.js` builds the parent chain without cycle detection:

```js
while (currentRoute) {
  const parentPattern = currentRoute.meta?.parent;
  if (parentPattern) {
    const parentRoute = routes.find(r => r.patternStr === parentPattern);
    currentRoute = parentRoute;
  } else {
    currentRoute = null;
  }
}
```

Route A declaring parent B and route B declaring parent A loops forever.

---

## 2. Proposed Fixes

### 2.1 Deferred Boot Gate

**Problem.** Initial match fires before routes exist or containers mount.

**Fix.** Replace the microtask emit with a gated sequence that waits for explicit readiness signals.

```js
// boot.js
const gates = [];
let booted = false;

export function gate(promise) {
  if (booted) return;
  gates.push(promise);
}

export async function boot(emit) {
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }
  await Promise.all(gates);
  gates.length = 0;
  booted = true;
  emit();
}

export function ready() {
  return booted;
}
```

**Integration in `intercept.js`:**

```js
import { boot, ready } from './boot.js';

export function setup() {
  if (ready()) return;
  // attach Navigation API listener ...

  boot(async () => {
    const url = window.navigation.currentEntry?.url || location.href;
    const found = await match(url);
    if (found) emit('found', { ...found, direction: 'load' });
    else emit('notfound', { url });
  });
}
```

**Route files gate on their element's CE registration:**

```js
// called internally by page() in defs/page.js
import { gate } from '../router/boot.js';
gate(customElements.whenDefined(tag));
```

**Why native.**
`document.readyState` — synchronous, zero-cost check.
`DOMContentLoaded` — fires once, no polling.
`Promise.all` — microtask, no timers.
`customElements.whenDefined` — native CE API, no polling.

---

### 2.2 Window Bridge

**Fix.** Attach a non-configurable global during auto-bootstrap.

```js
// router/index.js
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'router', {
    value: router,
    writable: false,
    enumerable: false,
    configurable: false
  });
  registerNavigator(navigate);
  setup();
  setupTabSync(router);
}
```

`writable: false` prevents accidental overwrite. `enumerable: false` keeps it out of `for...in`. `configurable: false` makes it permanent. Import-style usage still works identically.

---

### 2.3 Hierarchical Container Graph

**Fix.** Replace the flat `Map<string, WeakRef>` with a tree that stores parent-child relationships and depth.

```js
// graph.js
class Node {
  constructor(name, ref, parent = null) {
    this.name     = name;
    this.ref      = ref;             // WeakRef<HTMLElement>
    this.parent   = parent;          // Node | null
    this.children = new Set();       // Set<Node>
    this.depth    = parent ? parent.depth + 1 : 0;
  }

  alive() {
    return this.ref.deref() !== undefined;
  }
}

const nodes = new Map();
const root  = new Node('body', null, null);
nodes.set('body', root);

export function add(name, el, parent = 'body') {
  const ref        = new WeakRef(el);
  const parentNode = nodes.get(parent) ?? root;
  const node       = new Node(name, ref, parentNode);
  parentNode.children.add(node);
  nodes.set(name, node);
  return node;
}

export function remove(name) {
  const node = nodes.get(name);
  if (!node) return;
  node.parent?.children.delete(node);
  for (const child of node.children) {
    child.parent = node.parent;
    child.depth  = child.parent ? child.parent.depth + 1 : 0;
    node.parent?.children.add(child);
  }
  nodes.delete(name);
}

export function get(name)     { return nodes.get(name) ?? null; }
export function element(name) { return nodes.get(name)?.ref.deref() ?? null; }
export function clear()       { nodes.clear(); root.children.clear(); nodes.set('body', root); }
```

Containers declare their parent when defined via `dock(name, { parent })` in `definitions.md`.

---

### 2.4 Lowest Common Ancestor

**Problem.** Navigate from container A to container B — which containers unmount and which mount?

```js
// lca.js
import { get } from './graph.js';

export function lca(a, b) {
  let na = get(a);
  let nb = get(b);
  if (!na || !nb) return null;

  while (na.depth > nb.depth) na = na.parent;
  while (nb.depth > na.depth) nb = nb.parent;
  while (na !== nb) { na = na.parent; nb = nb.parent; }

  return na;
}

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
```

**Complexity.** O(d) where d = maximum tree depth. For typical UIs (depth 3–6) this is effectively O(1). No allocations on the hot path.

---

### 2.5 Cascade Mount Sequence

**Problem.** Target container not in the DOM. Must render containers root-to-leaf sequentially.

```js
// cascade.js
import { get, element as resolve } from './graph.js';
import { path } from './lca.js';

export async function ensure(target, current) {
  const segments = path(current ?? 'body', target);
  if (!segments) throw new Error(`No path: '${current}' → '${target}'`);

  // Find deepest mounted node on the path
  let mounted = null;
  for (const node of segments) {
    const el = node.ref?.deref();
    if (el?.isConnected) mounted = node;
    else break;
  }
  if (!mounted) mounted = get('body');

  // Mount sequentially from first unmounted downward
  const start = segments.indexOf(mounted) + 1;
  for (let i = start; i < segments.length; i++) {
    const node     = segments[i];
    const parentEl = node.parent.ref?.deref();
    if (!parentEl?.isConnected) throw new Error(`Parent '${node.parent.name}' disconnected`);

    const tag = node.name;
    if (tag.includes('-') && !customElements.get(tag)) {
      await customElements.whenDefined(tag);
    }

    const el = document.createElement(tag);
    if (typeof parentEl.swap === 'function') {
      await parentEl.swap(el, { direction: 'push' });
    } else {
      parentEl.replaceChildren(el);
    }

    // Yield for connectedCallback
    await new Promise(r => requestAnimationFrame(r));

    if (!resolve(node.name)) throw new Error(`Container '${node.name}' failed to register`);
  }

  return resolve(target);
}
```

**Why native.**
`customElements.whenDefined` — awaits CE registration, no polling.
`document.createElement` — zero-cost node factory.
`requestAnimationFrame` — yields to layout, guarantees `connectedCallback` fires.

---

### 2.6 Route Container Chain

**Fix.** Routes declare an ordered array of containers root-to-leaf. The last entry is the render target.

Using the new `page()` definition from `definations.md`:

```js
page('/settings/profile', {
  tag: 'page-profile',
  via: ['main', 'sidebar', 'settings-panel'],
  template: {
    html: './template.html',
    css: './style.css'
  }
}, import.meta.url)
```

During navigation:

```js
// intercept.js handler
const chain  = meta.via ?? (meta.container ? [meta.container] : []);
const target = chain.at(-1);

for (let i = 0; i < chain.length; i++) {
  if (!resolve(chain[i])) {
    await ensure(chain[i], chain[i - 1] ?? 'body');
  }
}

const container = resolve(target);
```

**Backward compatibility.** A single `container` string still works — treated as `via: [container]`.

---

### 2.7 Cycle Detection in Route Chain

```js
// match.js
const visited = new Set();
while (currentRoute) {
  if (visited.has(currentRoute.patternStr)) break;
  visited.add(currentRoute.patternStr);
  const parentPattern = currentRoute.meta?.parent;
  currentRoute = parentPattern
    ? routes.find(r => r.patternStr === parentPattern)
    : null;
}
```

---

## 3. Data Structures & Algorithms

### 3.1 Container Tree Node

```ts
Node {
  name:     string            // 'main' | 'sidebar' | 'settings-panel'
  ref:      WeakRef<Element>  // GC-safe DOM reference
  parent:   Node | null       // pointer up the tree
  children: Set<Node>         // immediate children
  depth:    number            // distance from root (body = 0)
}
```

| Operation | Complexity       | Method               |
|-----------|------------------|----------------------|
| Add       | O(1)             | `add(name, el, parent)` |
| Remove    | O(c) c=children  | `remove(name)`       |
| Lookup    | O(1)             | `get(name)` via Map  |
| LCA       | O(d) d=max depth | `lca(a, b)`          |
| Path      | O(d)             | `path(from, to)`     |
| Cascade   | O(d) × await     | `ensure(target)`     |

---

### 3.2 Radix Trie Route Matcher

Linear scan through sorted routes is O(n) per navigation. A Radix Trie achieves O(k) where k = URL segment count.

```js
// trie.js
class Segment {
  constructor() {
    this.static = new Map();  // literal → Segment
    this.param  = null;       // Segment (for :named)
    this.wild   = null;       // Segment (for *)
    this.route  = null;       // matched route entry
    this.key    = null;       // param name
  }
}

const trie = new Segment();

export function insert(pattern, route) {
  const parts = pattern.split('/').filter(Boolean);
  let node = trie;

  for (const part of parts) {
    if (part.startsWith(':')) {
      if (!node.param) { node.param = new Segment(); node.param.key = part.slice(1); }
      node = node.param;
    } else if (part === '*') {
      if (!node.wild) node.wild = new Segment();
      node = node.wild;
    } else {
      if (!node.static.has(part)) node.static.set(part, new Segment());
      node = node.static.get(part);
    }
  }

  node.route = route;
}

export function find(pathname) {
  const parts  = pathname.split('/').filter(Boolean);
  const params = {};
  const result = walk(trie, parts, 0, params);
  return result ? { route: result, params } : null;
}

function walk(node, parts, i, params) {
  if (i === parts.length) return node.route;

  const seg = parts[i];

  if (node.static.has(seg)) {
    const result = walk(node.static.get(seg), parts, i + 1, params);
    if (result) return result;
  }

  if (node.param) {
    params[node.param.key] = seg;
    const result = walk(node.param, parts, i + 1, params);
    if (result) return result;
    delete params[node.param.key];
  }

  if (node.wild) {
    params['*'] = parts.slice(i).join('/');
    return node.wild.route;
  }

  return null;
}
```

| Approach               | Time (n routes, k segments) | Memory               |
|------------------------|-----------------------------|----------------------|
| Linear scan (current)  | O(n)                        | O(n) route objects   |
| Sorted + binary search | O(k · log n)                | O(n)                 |
| Radix trie             | O(k)                        | O(total segments)    |

URLPattern remains available as a fallback for patterns the trie cannot express (regex groups, modifiers).

---

### 3.3 LCA Pseudocode

```
FUNCTION lca(a, b):
  na ← graph.get(a)
  nb ← graph.get(b)
  IF na is null OR nb is null → RETURN null

  WHILE na.depth > nb.depth → na ← na.parent
  WHILE nb.depth > na.depth → nb ← nb.parent
  WHILE na ≠ nb             → na ← na.parent; nb ← nb.parent

  RETURN na
```

**Proof.** After depth equalisation both pointers share depth. Since the tree is finite and rooted, simultaneous upward traversal must converge at the LCA.

**Worst case.** O(d). For real UI trees d rarely exceeds 5.

---

### 3.4 Cascade Sequence Pseudocode

```
FUNCTION ensure(target, source):
  segments ← path(source ?? 'body', target)

  mounted ← null
  FOR node IN segments:
    IF node.ref.deref() AND node.ref.deref().isConnected:
      mounted ← node
    ELSE:
      BREAK

  IF mounted is null → mounted ← root

  start ← indexOf(mounted) + 1
  FOR i FROM start TO segments.length - 1:
    node     ← segments[i]
    parentEl ← node.parent.ref.deref()
    ASSERT parentEl.isConnected

    IF node.name contains '-':
      AWAIT customElements.whenDefined(node.name)

    el ← document.createElement(node.name)

    IF parentEl.swap exists → AWAIT parentEl.swap(el)
    ELSE                    → parentEl.replaceChildren(el)

    AWAIT animationFrame   // yield for connectedCallback

    ASSERT graph.element(node.name) is defined

  RETURN graph.element(target)
```

---

## 4. Edge Cases & Bugs

### 4.1 MutationObserver Starvation

**Bug.** The `MutationObserver` in `container.js` is initialised inside `requestIdleCallback`. Under sustained 60 fps animation `requestIdleCallback` may never fire — the observer never attaches and standard-element containers are never discovered.

**Fix.**

```js
function attach() { /* create and observe */ }

if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(attach, { timeout: 100 });
} else {
  requestAnimationFrame(attach);
}
```

The `timeout: 100` option forces the callback even under load, with `requestAnimationFrame` as the fallback for environments that lack `requestIdleCallback`.

---

### 4.2 WeakRef Timing Hole

**Bug.** Between `disconnectedCallback` and `FinalizationRegistry` callback, `getContainer()` returns `undefined` even for an intentionally unmounted element. The consumer cannot distinguish "GC'd unexpectedly" from "unmounted normally."

**Fix.** Track explicit unregistrations:

```js
const gone = new Set();

export function unregister(name) {
  gone.add(name);
  setTimeout(() => gone.delete(name), 0);  // clear after one macrotask (rapid remount)
  nodes.delete(name);
}

export function element(name) {
  if (gone.has(name)) return undefined;
  return nodes.get(name)?.ref.deref() ?? null;
}
```

---

### 4.3 Concurrent Navigation Race

**Bug.** Two rapid navigations can both pass the container check, then both call `startViewTransition`. The browser aborts the first transition when the second starts — visual jank.

**Fix.**

```js
// In the swap method of a container element
async swap(el, options = {}) {
  if (this._tx) this._tx.skipTransition();

  const go = () => this.replaceChildren(el);

  if (typeof this.startViewTransition === 'function') {
    this._tx = this.startViewTransition({ callback: go });
    await this._tx.finished;
    this._tx = null;
  } else {
    go();
  }
}
```

---

### 4.4 Tab Sync Redirect Amplification

**Bug.** `isSyncing` is reset in `.finally()` before a guard-triggered redirect completes. The redirect URL differs from `sent`, causing a re-broadcast storm across tabs.

**Fix.** Delay the unsync by one macrotask to cover the redirect chain:

```js
channel.onmessage = ({ data }) => {
  const { type, url } = data ?? {};
  if (type !== 'sync-navigate') return;
  if (sent === url) return;
  sent = url;
  isSyncing = true;

  const finish = () => setTimeout(() => { isSyncing = false; }, 0);
  const result = router.navigate(url);
  result?.finished?.then(finish, finish) ?? finish();
};
```

---

## 5. Integration Roadmap

| Phase | Change                         | Risk   | Files                           | Status |
|-------|--------------------------------|--------|---------------------------------|--------|
| 1     | `boot.js` deferred gate        | Low    | `boot.js`, `intercept.js`       | Done   |
| 2     | `window.router` bridge         | Low    | `index.js`                      | Done   |
| 3     | `graph.js` tree structure      | Medium | `graph.js`, `container.js`      | Done   |
| 4     | `lca.js` algorithm             | Low    | `lca.js`                        | Done   |
| 5     | `cascade.js` mount sequence    | Medium | `cascade.js`, `intercept.js`    | Done   |
| 6     | `defs/` definitions layer      | Low    | `defs/page.js`, `defs/dock.js`, `defs/view.js` | Done    |
| 7     | `trie.js` route matcher        | Low    | `trie.js`, `match.js`           | Done   |
| 8     | Bug fixes (§ 4.1 – 4.4)        | Low    | Various                         | Done   |

All phases implemented. The `page` / `dock` / `view` / `part` definition layer is now the primary API. The legacy `ui.element({ url })` + `ui.container()` paths still function but are no longer recommended.

---

## 6. Performance Budget

| Operation              | Target              | Mechanism                        |
|------------------------|---------------------|----------------------------------|
| Route match            | < 0.1 ms (warm)     | Trie walk / URLPattern.exec      |
| LCA computation        | < 0.01 ms           | Pointer arithmetic               |
| Cascade (per level)    | < 16 ms (one frame) | `createElement` + `rAF`          |
| Container lookup       | < 0.01 ms           | `Map.get` + `WeakRef.deref`      |
| Boot gate              | < 50 ms after DCL   | `Promise.all`                    |

All hot-path operations target zero GC pressure. `WeakRef.deref` is non-allocating. `Map.get` is O(1) amortised. The trie avoids intermediate allocations during traversal.

---

## 7. Naming Convention

All new identifiers follow the one-word rule. Hyphens in custom element tag names are a browser requirement, not a convention violation.

| Concept                | Name      | File        |
|------------------------|-----------|-------------|
| Container tree node    | `Node`    | `graph.js`  |
| Tree module            | `graph`   | `graph.js`  |
| LCA function           | `lca`     | `lca.js`    |
| Root-to-target path    | `path`    | `lca.js`    |
| Boot prerequisite      | `gate`    | `boot.js`   |
| Boot trigger           | `boot`    | `boot.js`   |
| Cascade mount          | `ensure`  | `cascade.js`|
| Trie node              | `Segment` | `trie.js`   |
| Trie insert            | `insert`  | `trie.js`   |
| Trie lookup            | `find`    | `trie.js`   |
| Node alive check       | `alive`   | `graph.js`  |
| DOM element resolve    | `element` | `graph.js`  |
| Route + element + slot | `page`    | `defs/page.js`  |
| Container element      | `dock`    | `defs/dock.js`  |
| Plain component        | `view`    | `defs/view.js`  |
| Container swap method  | `swap`    | element class   |

Files: `graph.js`, `lca.js`, `cascade.js`, `boot.js`, `trie.js`, `defs/page.js`, `defs/dock.js`, `defs/view.js` — all single-word, lowercase.

---

*End of audit.*
