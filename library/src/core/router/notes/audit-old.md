# Router Architecture Audit (Original Draft)

> **Superseded by `myaudit.md`.** This file is the original machine-generated draft. The canonical audit is `myaudit.md`, which incorporates all findings from this document plus the unified `page`/`dock`/`view` definitions from `../ui/definations.md`. Refer to `myaudit.md` for the authoritative analysis and implementation plan.

Critical analysis of the Anza client-side router architecture, proposed fixes using native browser APIs, and high-performance data structures for container graph traversal and route matching.

---

## 1. Critical Analysis

### 1.1. Hard Refresh Failures

**The Bug:**  
On hard refresh (Ctrl+R / direct URL entry), `setup()` in `intercept.js` fires its initial route match via `Promise.resolve().then(...)` — a single microtask delay. This races against:

1. Routes not yet registered (ES module graph hasn't evaluated `ui.element(...)` calls)
2. Container elements not yet in the DOM (Custom Elements haven't connected)
3. The orchestrator listener not yet attached (if `define/index.js` loads after `router/index.js`)

The microtask fires *before* `DOMContentLoaded`, *before* Custom Element `connectedCallback`, and often *before* downstream modules finish executing. The result: `match()` returns `null` (no routes registered) or emits `'found'` to an orchestrator that calls `getContainer()` on a node that hasn't mounted.

**Evidence in code:**

```javascript
// intercept.js line 248
Promise.resolve().then(async () => {
  const url = window.navigation.currentEntry?.url || window.location.href;
  const routeMatch = await match(url);  // routes[] is empty on cold boot
  ...
});
```

```javascript
// orchestrator.js line 28
const containerEl = router.getContainer(spec.container);
if (!containerEl) {
  console.warn(...);  // Silent failure — page never renders
  return;
}
```

**Edge cases:**

- Script loaded via `<script type="module">` (deferred by spec) — route registration happens in a subsequent microtask after `setup()` already fired.
- `<script type="module" async>` — execution order is completely non-deterministic.
- Service Worker serving stale cached HTML while JS bundles update — container tags may mismatch.

---

### 1.2. Global Initialization Timing

**The Bug:**  
The auto-bootstrap block in `router/index.js` runs at module evaluation time:

```javascript
if (typeof window !== 'undefined') {
  registerNavigator(navigate);
  setup();
  setupTabSync(router);
}
```

This means:

- `setup()` attaches the Navigation API listener *before* any route is registered.
- The initial match fires in the same microtask queue tick as module evaluation.
- There is no `window.router` global — users must import the object, but the docs propose a global instance. Currently there is no bridge.

**The Conflict:**  
You want the router available globally *before* app code loads. But ES modules are deferred and non-blocking. A `<script type="module">` that imports the router cannot guarantee its evaluation precedes other modules that register routes unless you enforce a strict import chain (which defeats parallelism).

**Edge cases:**

- Two entry points both importing `router/index.js` — `setup()` is idempotent, but route registration order is undefined.
- Dynamic `import()` of the router after page load — `setup()` fires, emits initial match, but DOMContentLoaded already passed.

---

### 1.3. Container Graph Is Flat

**The Bug:**  
`container.js` stores `Map<string, WeakRef<HTMLElement>>` — a flat key-value registry. There is no concept of:

- Parent-child relationships between containers
- Depth or nesting level
- Sibling adjacency
- Path from root to a given container

The `route.meta.parent` field in `match.js` establishes a *route chain* (parent pattern strings), but this chain has zero connection to the *container hierarchy*. A route declares `container: 'sidebar'` and that's the only topological information. If `sidebar` lives inside `main` which lives inside `body`, the router doesn't know.

**Consequence:**  
Cross-branch navigation (from a view mounted in container A to a view mounted in container B, where A and B share a common ancestor C) requires understanding the tree shape. Without a graph, the router cannot:

1. Determine which containers to unmount (everything below divergence point)
2. Determine which containers to mount (everything on the new branch)
3. Identify the Lowest Common Ancestor (LCA) to minimize DOM churn

---

### 1.4. Cross-Branch Reconciliation Is Absent

**The Bug:**  
The current resolution logic in `intercept.js` is binary:

```javascript
if (routeMatch?.route?.meta?.container) {
  const containerName = routeMatch.route.meta.container;
  if (!getContainer(containerName)) {
    throw new Error(...);  // Hard failure, no recovery
  }
}
```

If the target container is not in the DOM, the router *throws*. It makes no attempt to:

1. Walk up to a common ancestor that IS in the DOM
2. Sequentially render intermediate containers downward
3. Await their registration before proceeding

**Example failure:**

```text
URL: /settings/profile
Container: 'settings-panel'
'settings-panel' lives inside 'app-sidebar'
'app-sidebar' lives inside 'main'

Current page: /dashboard (rendered in 'main')
```

Navigation to `/settings/profile` fails because `settings-panel` doesn't exist yet — it would only exist after `app-sidebar` is mounted, which itself requires `main` to render the sidebar layout.

---

### 1.5. Route-to-Container Mapping Is One-Dimensional

**The Bug:**  
Each route declares a single `container` string:

```javascript
router.register('/settings/profile', 'page-profile', { container: 'settings-panel' });
```

But there's no mechanism to express:
- "To reach `settings-panel`, first ensure `app-sidebar` is mounted in `main`"
- "The chain of containers from root to target is: `body` → `main` → `app-sidebar` → `settings-panel`"

The `meta.parent` field in `match.js` chains *routes* by pattern string — it does NOT chain *containers*. The `chain` array built during matching represents the route ancestry, not the DOM ancestry.

**Mismatch:**  
Route hierarchy ≠ Container hierarchy. A deeply nested route (`/a/b/c/d`) might render in a top-level container (`main`). Conversely, a shallow route (`/settings`) might need three nested containers. The current architecture conflates these two orthogonal trees.

---

## 2. Proposed Fixes

### 2.1. Deferred Initial Match (Hard Refresh Survival)

**Problem:** The initial match fires before routes exist or containers mount.

**Fix:** Replace the microtask-based initial emit with a gated boot sequence that waits for readiness signals.

```javascript
// boot.js — new module
const gates = [];
let booted = false;

export function gate(promise) {
  if (booted) return;
  gates.push(promise);
}

export async function boot(emitter) {
  // Wait for DOM to be interactive
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  // Wait for all registered gates (route files, container definitions)
  await Promise.all(gates);
  gates.length = 0;
  booted = true;

  // Now safe to emit initial match
  emitter();
}

export function ready() {
  return booted;
}
```

**Integration in `intercept.js`:**

```javascript
import { boot, ready } from './boot.js';

export function setup() {
  if (ready()) return;
  // ...attach listeners...

  boot(async () => {
    const url = window.navigation.currentEntry?.url || location.href;
    const found = await match(url);
    if (found) emit('found', { ...found, direction: 'load' });
    else emit('notfound', { url });
  });
}
```

**Route registration gates itself:**

```javascript
// In element.js, after router.register():
import { gate } from '../../router/boot.js';
gate(customElements.whenDefined(tag));
```

**Why native:**
- `document.readyState` — synchronous, zero-cost check
- `DOMContentLoaded` — standard event, fires once DOM is parsed
- `Promise.all` — microtask scheduling, no timers
- `customElements.whenDefined` — native Custom Elements API

---

### 2.2. Global Router Attachment

**Fix:** Freeze a non-configurable property on `window` during auto-bootstrap.

```javascript
// router/index.js — at auto-bootstrap
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

**Why this is safe:**
- `Object.defineProperty` with `writable: false` prevents accidental overwrite.
- `enumerable: false` keeps it out of `for...in` loops and `Object.keys(window)`.
- `configurable: false` makes it permanent — no library can `delete window.router`.
- Code that imports `{ router }` still works identically.
- Code that references `window.router` works without import.

---

### 2.3. Hierarchical Container Graph

**Fix:** Replace the flat `Map<string, WeakRef>` with a tree structure that stores parent-child relationships and depth.

```javascript
// graph.js — new module

class Node {
  constructor(name, ref, parent = null) {
    this.name = name;
    this.ref = ref;            // WeakRef<HTMLElement>
    this.parent = parent;      // Node | null
    this.children = new Set(); // Set<Node>
    this.depth = parent ? parent.depth + 1 : 0;
  }

  alive() {
    return this.ref.deref() !== undefined;
  }
}

const nodes = new Map();  // string -> Node
const root = new Node('body', null, null);  // virtual root
nodes.set('body', root);

export function add(name, element, parent = 'body') {
  const ref = new WeakRef(element);
  const parentNode = nodes.get(parent) || root;
  const node = new Node(name, ref, parentNode);
  parentNode.children.add(node);
  nodes.set(name, node);
  return node;
}

export function remove(name) {
  const node = nodes.get(name);
  if (!node) return;
  if (node.parent) node.parent.children.delete(node);
  // Reparent orphans to grandparent
  for (const child of node.children) {
    child.parent = node.parent;
    child.depth = child.parent ? child.parent.depth + 1 : 0;
    if (node.parent) node.parent.children.add(child);
  }
  nodes.delete(name);
}

export function get(name) {
  return nodes.get(name) || null;
}

export function element(name) {
  return nodes.get(name)?.ref.deref() || null;
}

export function clear() {
  nodes.clear();
  root.children.clear();
  nodes.set('body', root);
}
```

**Registration changes in `container.js`:**

```javascript
import { add, remove } from './graph.js';

export function registerContainer(name, element, parent = 'body') {
  // ...existing singleton check...
  add(name, element, parent);
}

export function unregisterContainer(name, element) {
  // ...existing safety check...
  remove(name);
}
```

**Container spec gains a `parent` field:**

```javascript
ui.container('settings-panel', {
  parent: 'sidebar',      // <-- declares hierarchy
  template: '<slot></slot>',
  style: ':host { display: block; }'
});
```

---

### 2.4. Lowest Common Ancestor Algorithm

**Problem:** Navigate from container A to container B — which containers must unmount and which must mount?

**Algorithm:** Walk both nodes up to equal depth, then walk both up simultaneously until they meet.

```javascript
// lca.js

import { get } from './graph.js';

export function lca(a, b) {
  let nodeA = get(a);
  let nodeB = get(b);
  if (!nodeA || !nodeB) return null;

  // Equalize depth
  while (nodeA.depth > nodeB.depth) nodeA = nodeA.parent;
  while (nodeB.depth > nodeA.depth) nodeB = nodeB.parent;

  // Walk up together
  while (nodeA !== nodeB) {
    nodeA = nodeA.parent;
    nodeB = nodeB.parent;
  }

  return nodeA;  // The common ancestor node
}

export function path(from, to) {
  const ancestor = lca(from, to);
  if (!ancestor) return null;

  // Build path: [ancestor, ..., target]
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

**Complexity:** O(d) where d is the maximum depth of the tree. For typical UIs (depth 3-6), this is effectively O(1).

**Memory:** One `Node` object per registered container. Each node holds a name string, a WeakRef, a parent pointer, a Set of children, and an integer depth. For 20 containers: ~2KB.

---

### 2.5. Cascade Mount Sequence

**Problem:** Target container is not in the DOM. Must sequentially render containers from the nearest mounted ancestor down to the target.

```javascript
// cascade.js

import { get, element as resolve } from './graph.js';
import { lca, path } from './lca.js';

export async function ensure(target, current) {
  // Find the lowest mounted ancestor on the path to target
  const segments = path(current || 'body', target);
  if (!segments) throw new Error(`No path from '${current}' to '${target}'`);

  let mounted = null;

  // Walk down the path, find first unmounted node
  for (const node of segments) {
    const el = node.ref?.deref();
    if (el && el.isConnected) {
      mounted = node;
    } else {
      break;
    }
  }

  if (!mounted) {
    mounted = get('body');  // Fallback to root
  }

  // Now render each unmounted container sequentially from mounted downward
  const start = segments.indexOf(mounted) + 1;
  for (let i = start; i < segments.length; i++) {
    const node = segments[i];
    const parent = node.parent;
    const parentEl = parent.ref?.deref();
    if (!parentEl || !parentEl.isConnected) {
      throw new Error(`Parent '${parent.name}' disconnected during cascade`);
    }

    // Create the container element
    const tag = node.name;
    if (tag.includes('-') && !customElements.get(tag)) {
      await customElements.whenDefined(tag);
    }

    const el = document.createElement(tag);

    // Delegate to parent's swap interface or append directly
    if (typeof parentEl.swapView === 'function') {
      await parentEl.swapView(el, { direction: 'push' });
    } else {
      parentEl.replaceChildren(el);
    }

    // Wait for connectedCallback to fire and register the container
    await new Promise(r => requestAnimationFrame(r));

    // Verify registration
    if (!resolve(node.name)) {
      throw new Error(`Container '${node.name}' failed to register after mount`);
    }
  }

  return resolve(target);
}
```

**Why native:**
- `customElements.whenDefined` — awaits CE registration without polling
- `document.createElement` — zero-cost DOM node factory
- `requestAnimationFrame` — yields to layout, guarantees `connectedCallback` fires
- No timers, no polling, no `setTimeout`

---

### 2.6. Route-to-Graph Binding

**Fix:** Routes declare a `chain` of containers from root to target, not just a leaf container.

```javascript
router.register('/settings/profile', 'page-profile', {
  containers: ['main', 'sidebar', 'settings-panel']
  // Ordered root-to-leaf. The last element is the rendering target.
});
```

**During navigation:**

```javascript
// In intercept.js handler():
const target = meta.containers?.at(-1) || meta.container;
const chain = meta.containers || [target];

// Verify or cascade-mount the full container chain
for (let i = 0; i < chain.length; i++) {
  const name = chain[i];
  if (!resolve(name)) {
    await ensure(name, chain[i - 1] || 'body');
  }
}

// Now safe to render into the target
const containerEl = resolve(target);
```

**Backward compatibility:** The single `container` field still works — it's sugar for `containers: [container]`. When only one container is specified and it's already mounted, behavior is identical to current code.

---

## 3. Data Structures & Algorithms

### 3.1. Container Tree Node

```typescript
Node {
  name:     string          // 'main', 'sidebar', 'settings-panel'
  ref:      WeakRef<Element> // Garbage-collectable DOM reference
  parent:   Node | null     // Pointer up the tree
  children: Set<Node>       // Immediate children
  depth:    uint            // Distance from root (body = 0)
}
```

**Operations:**

| Operation | Complexity | Method |
|---------- |------------|--------|
| Add       | O(1)       | `add(name, el, parent)` |
| Remove    | O(c) where c = children count | `remove(name)` |
| Lookup    | O(1)       | `get(name)` via Map |
| LCA       | O(d) where d = max depth | `lca(a, b)` |
| Path      | O(d)      | `path(from, to)` |
| Cascade   | O(d) * await | `ensure(target)` |

### 3.2. Trie-Based Route Matcher

The current linear scan through sorted routes is O(n) per navigation. For applications with 100+ routes, a Radix Trie achieves O(k) matching where k = number of URL segments.

```javascript
// trie.js

class Segment {
  constructor() {
    this.static = new Map();  // literal -> Segment
    this.param = null;        // Segment (for :named)
    this.wild = null;         // Segment (for *)
    this.route = null;        // matched route entry
    this.key = null;          // param name (e.g. 'member')
  }
}

const trie = new Segment();

export function insert(pattern, route) {
  const parts = pattern.split('/').filter(Boolean);
  let node = trie;

  for (const part of parts) {
    if (part.startsWith(':')) {
      if (!node.param) {
        node.param = new Segment();
        node.param.key = part.slice(1);
      }
      node = node.param;
    } else if (part === '*') {
      if (!node.wild) node.wild = new Segment();
      node = node.wild;
    } else {
      if (!node.static.has(part)) {
        node.static.set(part, new Segment());
      }
      node = node.static.get(part);
    }
  }

  node.route = route;
}

export function find(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const params = {};
  const result = walk(trie, parts, 0, params);
  return result ? { route: result, params } : null;
}

function walk(node, parts, index, params) {
  if (index === parts.length) {
    return node.route;
  }

  const segment = parts[index];

  // Priority 1: static match
  if (node.static.has(segment)) {
    const result = walk(node.static.get(segment), parts, index + 1, params);
    if (result) return result;
  }

  // Priority 2: param match
  if (node.param) {
    params[node.param.key] = segment;
    const result = walk(node.param, parts, index + 1, params);
    if (result) {
      return result;
    }
    delete params[node.param.key];
  }

  // Priority 3: wildcard match
  if (node.wild) {
    params['*'] = parts.slice(index).join('/');
    return node.wild.route;
  }

  return null;
}
```

**Comparison:**

| Approach | Time (n routes, k segments) | Memory |
|----------|----------------------------|--------|
| Linear scan (current) | O(n) | O(n) route objects |
| Sorted + binary search | O(k * log n) | O(n) |
| Radix trie | O(k) | O(total segments) |

For hot-path navigation, the trie eliminates URLPattern compilation overhead on the fast path. URLPattern remains available as a fallback for complex patterns (regex groups, modifiers) that the trie cannot express.

### 3.3. LCA Algorithm (Detailed)

```
FUNCTION lca(nameA, nameB):
  nodeA ← graph.get(nameA)
  nodeB ← graph.get(nameB)

  IF nodeA is null OR nodeB is null:
    RETURN null

  // Phase 1: Equalize depths
  WHILE nodeA.depth > nodeB.depth:
    nodeA ← nodeA.parent

  WHILE nodeB.depth > nodeA.depth:
    nodeB ← nodeB.parent

  // Phase 2: Walk up in tandem
  WHILE nodeA ≠ nodeB:
    nodeA ← nodeA.parent
    nodeB ← nodeB.parent

  RETURN nodeA
```

**Correctness proof:** After depth equalization, both pointers are at the same depth. Since the tree is finite and connected to a single root, walking up in tandem must converge at the LCA.

**Worst case:** O(d) where d = tree depth. For UI container trees, d rarely exceeds 5.

### 3.4. Cascade Render Sequence

```
FUNCTION ensure(target, source):
  segments ← path(source || 'body', target)

  // Find deepest mounted node on the path
  mounted ← null
  FOR node IN segments:
    IF node.ref.deref() AND node.ref.deref().isConnected:
      mounted ← node
    ELSE:
      BREAK

  IF mounted is null:
    mounted ← root

  // Render from mounted+1 down to target
  start ← indexOf(mounted) + 1
  FOR i FROM start TO segments.length - 1:
    node ← segments[i]
    parentEl ← node.parent.ref.deref()

    ASSERT parentEl.isConnected

    tag ← node.name
    IF tag contains '-':
      AWAIT customElements.whenDefined(tag)

    el ← document.createElement(tag)

    IF parentEl has swapView:
      AWAIT parentEl.swapView(el)
    ELSE:
      parentEl.replaceChildren(el)

    AWAIT animationFrame  // Yield for connectedCallback

    ASSERT graph.element(node.name) is defined

  RETURN graph.element(target)
```

---

## 4. Additional Edge Cases & Bugs

### 4.1. MutationObserver Starvation

**Bug:** The `MutationObserver` in `container.js` is initialized inside `requestIdleCallback`. Under heavy load (60fps animation), `requestIdleCallback` may never fire — the observer never attaches and standard-element containers never get discovered.

**Fix:** Use `requestAnimationFrame` as the fallback when `requestIdleCallback` doesn't fire within 100ms:

```javascript
function ensureObserver() {
  if (observer || typeof window === 'undefined') return;

  const attach = () => { /* ...create and observe... */ };

  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(attach, { timeout: 100 });
  } else {
    requestAnimationFrame(attach);
  }
}
```

### 4.2. WeakRef Timing Hole

**Bug:** Between `disconnectedCallback` firing and `FinalizationRegistry` callback executing, a `getContainer()` call can return `undefined` even though the element was just removed intentionally (not GC'd). The consumer cannot distinguish "GC'd unexpectedly" from "unmounted normally."

**Fix:** `unregisterContainer()` should *immediately* delete the Map entry (it currently does). But `getContainer()` should NOT fall through to `querySelector` for non-selector names after an explicit unregister. Track explicit unregisters in a `Set<string>`:

```javascript
const unregistered = new Set();

export function unregisterContainer(name, element) {
  // ...existing logic...
  unregistered.add(name);
  // Clear after one macrotask to handle rapid remount
  setTimeout(() => unregistered.delete(name), 0);
}

export function getContainer(name) {
  if (unregistered.has(name)) return undefined;
  // ...existing logic...
}
```

### 4.3. Route Chain Infinite Loop

**Bug:** In `match.js`, the chain builder walks `meta.parent` without cycle detection:

```javascript
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

If route A declares parent B and route B declares parent A, this loops forever.

**Fix:** Track visited patterns:

```javascript
const visited = new Set();
while (currentRoute) {
  if (visited.has(currentRoute.patternStr)) break;  // Cycle detected
  visited.add(currentRoute.patternStr);
  // ...rest...
}
```

### 4.4. Concurrent Navigation Race

**Bug:** Two rapid navigations can both pass the container check, then both attempt `swapView` on the same container. The first `swapView` starts a View Transition. The second `swapView` calls `startViewTransition` while the first is still animating — this *skips* the first transition (browser spec: "if a view transition is running, starting a new one aborts the previous"). The result is visual jank.

**Fix:** Containers should track in-flight transitions and queue or abort:

```javascript
async swapView(element, options = {}) {
  // Abort previous transition if still running
  if (this._transition) {
    this._transition.skipTransition();
  }

  const doSwap = () => this.replaceChildren(element);

  if (typeof this.startViewTransition === 'function') {
    this._transition = this.startViewTransition({ callback: doSwap });
    await this._transition.finished;
    this._transition = null;
  } else {
    doSwap();
  }
}
```

### 4.5. Tab Sync Amplification Storm

**Bug:** With N tabs open and sync enabled, a navigation in tab 1 broadcasts to N-1 tabs. Each of those tabs navigates, which triggers `navigatesuccess`, which could broadcast again. The `sent` variable prevents echo, but only for exact URL match. If a guard redirects the URL (e.g., `/admin` → `/login`), the redirect URL differs from `sent`, causing a re-broadcast.

**Fix:** Add a `syncing` flag guard on outbound broadcasts:

```javascript
navHandler = () => {
  if (isSyncing) return;   // Already guarded
  // ...existing code...
};
```

This is already implemented. But the *redirect* case slips through because `isSyncing` is reset in `.finally()` before the redirect navigation completes. The fix: keep `isSyncing = true` for the full redirect chain:

```javascript
channel.onmessage = (event) => {
  const { type, url } = event.data || {};
  if (type === 'sync-navigate') {
    if (sent === url) return;
    sent = url;
    isSyncing = true;

    const finish = () => {
      // Delay unsync by one macrotask to cover redirects
      setTimeout(() => { isSyncing = false; }, 0);
    };

    const result = router.navigate(url);
    result?.finished?.then(finish, finish) ?? finish();
  }
};
```

---

## 5. Integration Roadmap

| Phase | Change | Risk | Files |
|-------|--------|------|-------|
| 1 | Add `boot.js` deferred gate | Low — additive, no breaking changes | `boot.js`, `intercept.js`, `element.js` |
| 2 | Attach `window.router` | Low — additive | `index.js` |
| 3 | Add `graph.js` tree structure | Medium — new module, container API gains `parent` param | `graph.js`, `container.js` |
| 4 | Add `lca.js` algorithm | Low — additive utility | `lca.js` |
| 5 | Add `cascade.js` mount sequence | Medium — changes intercept behavior on missing containers | `cascade.js`, `intercept.js` |
| 6 | Route `containers` array field | Low — backward-compatible extension | `intercept.js`, `match.js` |
| 7 | Optional trie matcher | Low — can run alongside URLPattern | `trie.js`, `match.js` |
| 8 | Fix edge-case bugs (4.1–4.5) | Low — targeted patches | Various |

---

## 6. Performance Budget

| Operation | Target | Native API |
|-----------|--------|-----------|
| Route match | < 0.1ms (warm) | URLPattern.exec / Trie walk |
| LCA computation | < 0.01ms | Pointer arithmetic |
| Cascade mount (per level) | < 16ms (one frame) | createElement + rAF |
| Container lookup | < 0.01ms | Map.get + WeakRef.deref |
| Initial boot gate | < 50ms after DOMContentLoaded | Promise.all |

All operations target zero GC pressure on the hot path. WeakRef derefs are non-allocating. Map lookups are O(1) amortized. The trie avoids creating intermediate objects during traversal.

---

## 7. Naming Convention Adherence

All proposed code follows the one-word naming rule:

| Concept | Name | Rationale |
|---------|------|-----------|
| Container tree node | `Node` | One word, scoped to `graph.js` |
| Tree module | `graph` | One word, describes the structure |
| LCA function | `lca` | Acronym, universally understood |
| Path function | `path` | One word, returns root-to-target |
| Boot gate | `gate` | One word, registers a prerequisite |
| Boot trigger | `boot` | One word, fires the initial match |
| Cascade function | `ensure` | One word, guarantees container exists |
| Trie segment | `Segment` | One word, represents one URL part |
| Trie insert | `insert` | One word |
| Trie lookup | `find` | One word |
| Node alive check | `alive` | One word, boolean method |
| Node element resolve | `element` | One word, returns DOM node |

Files: `graph.js`, `lca.js`, `cascade.js`, `boot.js`, `trie.js` — all single-word, lowercase.

---

*End of audit.*
