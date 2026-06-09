# Implementation Tasks

Comprehensive task list derived from `myaudit.md` and `../ui/definations.md`. Covers the router overhaul, the new definition layer (`page`/`dock`/`view`/`part`), and the Rust toolchain changes required to support them.

Companion documents:

- `myaudit.md` — architecture audit, proposed fixes, data structures, edge-case bugs
- `../ui/definations.md` — unified `page`/`dock`/`view`/`part` API specification

---

## Phase 1 — Boot Gate

**Goal.** Survive hard refresh. Defer the router's initial `'found'` emit until routes are registered and containers are mounted.

### 1.1 Create `router/boot.js`

New module. Exports `gate(promise)`, `boot(emitFn)`, `ready()`.

- `gate` accepts a `Promise` that must resolve before the router emits its first match.
- `boot` waits for `DOMContentLoaded` (if `document.readyState === 'loading'`), then `Promise.all(gates)`, then calls `emitFn`.
- `ready` returns `true` after boot completes.

**APIs used.** `document.readyState`, `DOMContentLoaded` event, `Promise.all`.

### 1.2 Update `router/intercept.js`

Replace the `Promise.resolve().then(...)` initial-emit block inside `setup()` with a call to `boot()`.

Remove the current microtask:

```js
// DELETE
Promise.resolve().then(async () => { ... });
```

Replace with:

```js
import { boot, ready } from './boot.js';

// inside setup(), after attaching listeners:
boot(async () => {
  const url = window.navigation.currentEntry?.url || location.href;
  const found = await match(url);
  if (found) emit('found', { ...found, direction: 'load' });
  else emit('notfound', { url });
});
```

### 1.3 Wire boot gate into element registration

In the new `defs/page.js` and `defs/dock.js` (Phase 6), after `customElements.define`, call:

```js
import { gate } from '../router/boot.js';
gate(customElements.whenDefined(tag));
```

Until Phase 6 exists, wire it into the existing `ui/define/element.js` after `customElements.define(tag, DeclarativeElement)`:

```js
if (spec.url) {
  gate(customElements.whenDefined(tag));
}
```

---

## Phase 2 — Window Bridge

**Goal.** Attach the router to `window` so non-module scripts and devtools can access it.

### 2.1 Update `router/index.js`

In the auto-bootstrap block, add before `setup()`:

```js
Object.defineProperty(window, 'router', {
  value: router,
  writable: false,
  enumerable: false,
  configurable: false
});
```

---

## Phase 3 — Container Graph

**Goal.** Replace the flat `Map<string, WeakRef>` with a hierarchical tree that enables LCA traversal and cascade mounting.

### 3.1 Create `router/graph.js`

New module. Data structure:

```
Node { name, ref: WeakRef, parent: Node|null, children: Set<Node>, depth: number }
```

Exports:

- `add(name, element, parent = 'body')` — insert a node, update parent's children set
- `remove(name)` — delete a node, reparent orphans to grandparent
- `get(name)` — return `Node` or `null`
- `element(name)` — return `HTMLElement` via `WeakRef.deref()` or `null`
- `clear()` — reset the tree to root-only

Virtual root node `'body'` is created at module load. `FinalizationRegistry` prunes stale nodes.

### 3.2 Update `router/container.js`

Rewrite to delegate to `graph.js`. Keep the same public API signatures for backward compatibility:

- `registerContainer(name, element, parent)` → calls `graph.add`
- `unregisterContainer(name, element)` → calls `graph.remove`
- `getContainer(name)` → calls `graph.element`
- `clearContainers()` → calls `graph.clear`

Remove the `MutationObserver` logic (docks self-register in `connectedCallback`; no polling needed).

### 3.3 Add `parent` parameter to container registration

`registerContainer` gains an optional third argument `parent`. Default: `'body'`. Passed through to `graph.add`.

---

## Phase 4 — LCA Algorithm

**Goal.** Enable cross-branch navigation by computing the lowest common ancestor between two containers.

### 4.1 Create `router/lca.js`

Exports:

- `lca(a, b)` — depth-equalisation + tandem walk, returns `Node` or `null`
- `path(from, to)` — returns `[Node, ...]` from ancestor to target

O(d) complexity where d = tree depth.

---

## Phase 5 — Cascade Mount

**Goal.** When a target container is absent, sequentially mount intermediate containers from the nearest live ancestor down to the target.

### 5.1 Create `router/cascade.js`

Exports:

- `ensure(target, current)` — walk `path()`, find deepest mounted node, sequentially `createElement` + `swap`/`replaceChildren` + `rAF` yield for each missing level.

Uses `customElements.whenDefined`, `document.createElement`, `requestAnimationFrame`.

### 5.2 Update `router/intercept.js` handler

Replace the hard `throw` on missing container with cascade logic:

```js
const chain = meta.via ?? (meta.container ? [meta.container] : []);
const target = chain.at(-1);

for (let i = 0; i < chain.length; i++) {
  if (!element(chain[i])) {
    await ensure(chain[i], chain[i - 1] ?? 'body');
  }
}
```

---

## Phase 6 — Definition Layer (`defs/`)

**Goal.** Implement the `page`, `dock`, `view`, `part` definition functions from `definations.md`. These supersede the split `ui.element` + `router.register` pattern.

### 6.1 Create `ui/defs/page.js`

`page(route, config, base)` — route-bound element.

Internal steps:

1. Normalize `config.template` — detect file paths (strings ending in `.html`/`.css` or starting with `./`) vs inline strings.
2. If file paths: resolve against `base` (the caller's `import.meta.url`).
3. Define an `HTMLElement` subclass. Attach shadow DOM, preload resources via `preloadResources()`.
4. Install `on.load`/`on.unload`/`on.connect`/`on.disconnect` lifecycle hooks.
5. Install `config.props` as reactive observed attributes/properties.
6. Call `customElements.define(config.tag, cls)`.
7. Call `router.register(route, config.tag, { via: config.via, props: config.props, query: config.query })`.
8. Register spec in `specRegistry`.
9. Call `gate(customElements.whenDefined(config.tag))`.
10. If `config.guard` is defined, wrap it as a route-scoped guard on `router.guard`.

### 6.2 Create `ui/defs/dock.js`

`dock(name, config)` — container element.

Internal steps:

1. Derive tag from `config.tag ?? 'dock-' + name`.
2. Define an `HTMLElement` subclass. If template omitted, use passthrough `<slot></slot>`.
3. In `connectedCallback`: call `graph.add(name, this, config.parent ?? 'body')`.
4. In `disconnectedCallback`: call `graph.remove(name)`.
5. Attach `swap` method — either `config.on.swap` override or the default view-transition implementation.
6. Call `customElements.define(tag, cls)`.
7. Call `gate(customElements.whenDefined(tag))`.

### 6.3 Create `ui/defs/view.js`

`view(tag, config, base)` — composable stateful component. No route, no graph.

Same element-definition logic as `page` minus routing and container registration. Supports `props`, `template`, `on.connect`/`on.disconnect`/`on.change`, `methods`.

### 6.4 Create `ui/defs/part.js`

`part(tag, config, base)` — atomic stateless primitive.

Minimal subset of `view`. No reactive updates, no `on.change`. Constructor-time attribute reads, static shadow DOM.

### 6.5 Create `ui/defs/index.js`

Facade exporting `{ page, dock, view, part }`.

### 6.6 Update `ui/define/orchestrator.js`

Update the `'found'` listener to understand `via` chains (from `meta.via`) instead of a single `container` string. Use the cascade logic from Phase 5.

### 6.7 Deprecate (do not remove) existing APIs

`ui.element` and `ui.container` remain functional. Add a console info message on first use suggesting migration to `page`/`dock`/`view`/`part`. Do not break existing code.

---

## Phase 7 — Trie Route Matcher

**Goal.** O(k) route matching where k = URL segment count, replacing O(n) linear scan.

### 7.1 Create `router/trie.js`

`Segment` class with `static: Map`, `param: Segment|null`, `wild: Segment|null`, `route`, `key`.

Exports:

- `insert(pattern, route)` — decompose pattern into segments, walk/create trie nodes
- `find(pathname)` — walk trie with backtracking, return `{ route, params }` or `null`

Priority order: static > param > wildcard (matching the URLPattern specificity model).

### 7.2 Integrate into `router/match.js`

On `register()`, insert into the trie alongside the existing `routes[]` array. On `match()`, try trie first; fall back to URLPattern linear scan for patterns containing regex groups or modifiers the trie cannot express.

---

## Phase 8 — Edge-Case Bug Fixes

### 8.1 MutationObserver starvation (`container.js`)

Add `{ timeout: 100 }` to `requestIdleCallback`. Fall back to `requestAnimationFrame` when `requestIdleCallback` is unavailable.

### 8.2 WeakRef timing hole (`graph.js`)

Track explicit unregisters in a `Set<string>`. Return `undefined` from `element()` if the name is in the set. Clear the entry after one macrotask via `setTimeout(..., 0)`.

### 8.3 Cycle detection (`match.js`)

Add a `visited` Set to the parent-chain walker. Break on cycle.

### 8.4 Concurrent navigation race (`defs/dock.js`)

In the default `swap` method, call `this._tx?.skipTransition()` before starting a new view transition. Clear `this._tx` on completion.

### 8.5 Tab sync redirect amplification (`sync/tab.js`)

Delay `isSyncing = false` by one macrotask using `setTimeout(() => { isSyncing = false }, 0)` to cover guard-triggered redirects.

---

## Phase 9 — Rust Toolchain Changes

**Goal.** The `anza` CLI must understand the new `page`/`dock`/`view`/`part` definition functions and the native `.html`/`.css` file convention.

### 9.1 Update `ExtractedSpec` struct (`types/runner.rs`)

Add new fields to `ExtractedSpec`:

```rust
pub struct ExtractedSpec {
  pub tag: String,
  pub kind: String,                                    // "page" | "dock" | "view" | "part" | "element" | "container"
  pub props: HashMap<String, PropConfig>,
  pub methods: Vec<String>,
  pub url: Option<String>,                             // page only
  pub container: Option<String>,                       // backward compat
  pub via: Vec<String>,                                // page: ordered dock chain
  pub parent: Option<String>,                          // dock: parent dock name
  pub meta: HashMap<String, String>,
}
```

### 9.2 Update element extraction (`extract/runner.rs`)

The `ElementVisitor` currently only recognises `ui.element(...)` and `ui.container(...)`. Expand to also match:

- `page(route, config)` — top-level function call, not `ui.page`
- `dock(name, config)` — top-level function call
- `view(tag, config)` — top-level function call
- `part(tag, config)` — top-level function call

For each, extract:

| Call | `tag` source | `url` source | `via` source | `parent` source | `kind` |
|------|-------------|-------------|-------------|----------------|--------|
| `page(route, { tag, ... })` | `config.tag` | first argument (`route`) | `config.via` | — | `"page"` |
| `dock(name, { tag, ... })` | `config.tag` or `'dock-' + name` | — | — | `config.parent` | `"dock"` |
| `view(tag, config)` | first argument | — | — | — | `"view"` |
| `part(tag, config)` | first argument | — | — | — | `"part"` |

Update `parse_spec_object` to also extract:

- `via` — array of string literals
- `parent` — string literal
- `template.html` and `template.css` — when `template` is an object with `html`/`css` string properties that are file paths

### 9.3 Update asset resolution in build graph (`build/graph.rs`)

The `Collector::scan_spec` method currently looks for top-level `template` and `style` string literals:

```rust
"template" | "style" => {
  if let Expr::Lit(Lit::Str(s)) = &*kv.value { ... }
}
```

Add handling for when `template` is an **object** with `html` and `css` properties:

```rust
"template" => {
  match &*kv.value {
    // Existing: template: './file.html'
    Expr::Lit(Lit::Str(s)) => { /* existing logic */ }
    // New: template: { html: './template.html', css: './style.css' }
    Expr::Object(obj) => {
      for prop in &obj.props {
        if let PropOrSpread::Prop(p) = prop {
          if let Prop::KeyValue(inner_kv) = &**p {
            if let PropName::Ident(inner_key) = &inner_kv.key {
              if (inner_key.sym == "html" || inner_key.sym == "css") {
                if let Expr::Lit(Lit::Str(s)) = &*inner_kv.value {
                  if let Some(v) = str_value(s) {
                    if v.starts_with("./") || v.starts_with("../") || v.starts_with('/') {
                      self.assets.push((v, s.span));
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    _ => {}
  }
}
```

Also recognise the new top-level call patterns (`page(...)`, `dock(...)`, `view(...)`, `part(...)`) so that their `template` objects are scanned for asset paths. Currently only `ui.element(...)` and `ui.container(...)` trigger `scan_spec`.

### 9.4 Update route manifest (`extract/routes.rs`)

Extend `RouteRecord` to include `via`:

```rust
struct RouteRecord<'a> {
  tag: &'a str,
  path: &'a str,
  #[serde(skip_serializing_if = "Option::is_none")]
  container: Option<&'a str>,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  via: &'a Vec<String>,
  params: Vec<String>,
}
```

Update `routes.json` output to include the `via` array for pages. Update `routes.d.ts` `RouteMap` interface to type-check `via`.

### 9.5 Update type generation

Generate interfaces for all four definition types, not just `ui.element`. The `kind` field in `ExtractedSpec` distinguishes them. For docks, generate a `swap` method in the interface:

```typescript
export interface DockSidebarElement extends HTMLElement {
  swap(el: HTMLElement, options?: { direction?: string }): Promise<void>;
}
```

### 9.6 Update `doctor` command (`main.rs`)

Add checks for:

- `src/docks/` directory (dock definitions)
- `src/pages/` directory (page definitions)
- `src/views/` directory (view definitions)
- `src/parts/` directory (part definitions)

Warn (don't error) if `src/elements/` exists alongside `src/pages/` — suggest migration.

### 9.7 Update watcher HMR classification (`watcher/runner.rs`)

`.html` and `.css` changes inside component folders should trigger the correct HMR message kind (`Html` or `Css`). The existing classification already handles this by extension, but verify that changes to `template.html` and `style.css` inside `pages/profile/` correctly propagate.

---

## Phase 10 — Cleanup & Migration

### 10.1 Update `<route-outlet>` (`router/outlet.js`)

`<route-outlet>` remains functional but is deprecated. Add a console info suggesting migration to `<dock-*>` elements on first `connectedCallback`.

### 10.2 Update `ui/define/index.js`

Export `page`, `dock`, `view`, `part` alongside `define`, `element`, `container`.

### 10.3 Update package exports (`library/package.json`)

Add `./defs` export path mapping to `src/core/ui/defs/index.js`.

### 10.4 Update documentation

- `router/usage.md` — add sections for `page`, `dock`, `via` chains, cascade mounting
- `ui/usage.md` — add `page`/`dock`/`view`/`part` API documentation
- `router/plan.md` — mark completed sections, add new architecture diagrams

---

## Dependency Order

```text
Phase 1 (boot.js)
  └─ Phase 2 (window bridge)     — independent
  └─ Phase 3 (graph.js)
       └─ Phase 4 (lca.js)
            └─ Phase 5 (cascade.js)
                 └─ Phase 6 (defs/)
                      └─ Phase 9 (Rust toolchain)
                           └─ Phase 10 (cleanup)
  └─ Phase 7 (trie.js)           — independent
  └─ Phase 8 (bug fixes)         — independent
```

Phases 1, 2, 7, and 8 can run in parallel. Phases 3-6 are sequential. Phase 9 (Rust) can start after Phase 6 API is finalized. Phase 10 runs last.

---

## Verification

Each phase must pass before proceeding:

| Phase | Verification |
| ----- | ------------ |
| 1 | Hard refresh on a registered route renders correctly. No console errors on cold boot. |
| 2 | `window.router` is available in devtools console. `window.router === router` is `true`. |
| 3 | `graph.add('a', el, 'body')` + `graph.get('a')` returns the node. `graph.element('a')` returns the element. |
| 4 | `lca('sidebar', 'settings')` returns the correct common ancestor. `path('body', 'settings')` returns the correct chain. |
| 5 | Navigate to a route whose dock chain has 3 levels, none mounted. All three mount sequentially. Page renders. |
| 6 | `page('/test', { tag: 'page-test', via: ['main'], template: { html: './t.html', css: './s.css' } }, import.meta.url)` defines element, registers route, gates boot. |
| 7 | 100 routes registered. `match('/route/99')` returns in < 0.1ms. |
| 8 | Tab sync with redirect guard does not loop. Rapid double-click navigation does not throw. |
| 9 | `anza scan` extracts specs from `page(...)` calls. `routes.json` includes `via` arrays. Build graph resolves `template.html` and `style.css` inside `template: {}` objects. |
| 10 | `<route-outlet>` still works. `ui.element` still works. No regressions. |

---

*End of tasks.*
