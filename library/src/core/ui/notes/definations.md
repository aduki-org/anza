# Definitions

Companion to `audit.md`. Supersedes the split `ui.element` + `router.register` pattern and the `<route-outlet>` element. Defines four first-class UI primitives — `page`, `dock`, `view`, `part` — their configuration schema, internal registration behaviour, lifecycle contracts, file conventions, and composition model.

---

## 1. Overview

```text
┌──────────────────────────────────────────────────────────┐
│                     Route-bound                          │
│  page('/path', config)   ← has URL, renders into a dock  │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│                     Router-managed                       │
│  dock('name', config)    ← container shell in graph      │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│                     Pure Web Components                  │
│  view('tag', config)     ← stateful, composable unit     │
│  part('tag', config)     ← atomic, stateless primitive   │
└──────────────────────────────────────────────────────────┘
```

| Function | Route | In graph | Swap method | Template | Composable |
|----------|-------|----------|-------------|----------|------------|
| `page`   | Yes   | No       | No          | Required | Yes        |
| `dock`   | No    | Yes      | Yes         | Optional | Yes        |
| `view`   | No    | No       | No          | Required | Yes        |
| `part`   | No    | No       | No          | Required | Yes        |

All four call `customElements.define` internally. All four produce standard Custom Elements — you use them by their tag name in any HTML template.

---

## 2. Import

```js
import { page, dock, view, part } from './defs/index.js'
```

Or individually:

```js
import { page } from './defs/page.js'
import { dock } from './defs/dock.js'
import { view } from './defs/view.js'
import { part } from './defs/part.js'
```

---

## 3. `page`

### Page Overview

A `page` is a route-bound navigable unit. It maps a URL pattern to a Custom Element tag, declares the ordered container chain the router must traverse to reach the render target, and defines how the element receives route parameters.

A `page` has no persistent presence in the container graph. It is mounted into the last dock in its `via` chain, remains live for the duration of the route, and is removed when the route changes.

A `page` element can use `view` and `part` elements freely in its template.

### Page Signature

```text
page(route, config)
```

| Argument | Type   | Required | Description              |
|----------|--------|----------|--------------------------|
| `route`  | string | Yes      | URLPattern pathname      |
| `config` | object | Yes      | See schema below         |

### Page Schema

```js
page('/settings/profile/:id', {

  // ── Identity ────────────────────────────────────────────
  tag: 'page-settings-profile',   // required. Custom Element tag. Must contain '-'.

  // ── Container chain ─────────────────────────────────────
  via: ['main', 'sidebar', 'settings-panel'],
  // Ordered array of dock names, root to leaf.
  // The last entry is the render target.
  // Docks not yet in the DOM are mounted sequentially by cascade.js.
  // Backward-compatible: a single string is treated as via: [string].

  // ── Template ────────────────────────────────────────────
  // Inline form — template strings directly in the config:
  template: {
    html: `
      <slot name="header"></slot>
      <slot></slot>
    `,
    css: `:host { display: block; padding: 1rem; }`,
    shadow: 'open'
    // shadow: 'open' | 'closed' | false
    // false = light DOM — useful when parent CSS must pierce the element.
  },
  // File form — native .html and .css file paths:
  // template: {
  //   html: './template.html',
  //   css: './style.css',
  //   shadow: 'open'
  // },
  // File paths are resolved relative to the calling module's import.meta.url.
  // Using native files gives you full IDE completion, syntax highlighting,
  // Emmet, linting, and the browser's native CSS/HTML parsers.

  // ── Route parameter typing ───────────────────────────────
  props: {
    id:   { type: Number },   // /settings/profile/:id → element.id
    tab:  { type: String },   // from query string      → element.tab
    open: { type: Boolean }   // from query string      → element.open
  },

  // ── Query params to promote as props ────────────────────
  query: ['tab', 'open'],
  // Named query keys from the URL that are cast and set as element properties.
  // Casting follows the type declared in props above.

  // ── Route guard ─────────────────────────────────────────
  guard({ params, query }) {
    if (!auth.check()) return '/login'   // return string → redirect
    return true                          // return true   → proceed
    // return undefined / void            →              → proceed
  },

  // ── Lifecycle ────────────────────────────────────────────
  on: {
    load({ params, query, hash, state }) {
      // Called before the element is swapped into the dock.
      // 'this' is the element instance.
      // Returning a rejected Promise aborts the navigation.
      this.userId = params.id
    },
    unload() {
      // Called before the element is removed on route change.
      // 'this' is the element instance.
      this.cleanup?.()
    },
    connect() {
      // connectedCallback — element is in the DOM.
    },
    disconnect() {
      // disconnectedCallback — element removed from DOM.
    }
  }

})
```

### Page Registration

`page()` performs all of the following — the developer calls nothing else:

1. Defines an `HTMLElement` subclass using the `template` config.
2. Calls `customElements.define(config.tag, cls)`.
3. Calls `router.register(route, config.tag, { via: config.via, props: config.props, query: config.query })`.
4. Populates `specRegistry` with `{ props, query }` so the cascade can cast typed parameters.
5. Calls `gate(customElements.whenDefined(config.tag))` on the boot gate so the router's initial match waits for this element to be ready.

### Page Example — inline

```js
// pages/profile.js
import { page } from '../defs/index.js'

page('/profile/:id', {
  tag: 'page-profile',
  via: ['main'],
  template: {
    html: `<h1>Profile</h1><slot></slot>`,
    css: `:host { display: grid; gap: 1rem; }`
  },
  props: {
    id: { type: Number }
  },
  on: {
    load({ params }) {
      this.id = params.id
    }
  }
})
```

### Page Example — folder

Large pages with rich templates, complex loaders, or many sub-components use a folder. The folder name is the page slug.

```text
pages/
  profile/
    index.js        ← page() call, imports siblings
    template.html   ← native HTML template
    style.css       ← native CSS stylesheet
    load.js         ← exports load handler
    guard.js        ← exports guard function
```

```html
<!-- pages/profile/template.html -->
<slot name="header"></slot>
<section class="body">
  <slot></slot>
</section>
```

```css
/* pages/profile/style.css */
:host {
  display: grid;
  grid-template-rows: auto 1fr;
}
```

```js
// pages/profile/load.js
export async function load({ params }) {
  const res = await fetch('/api/users/' + params.id)
  this.data = await res.json()
}
```

```js
// pages/profile/index.js
import { page }  from '../../defs/index.js'
import { load }  from './load.js'
import { guard } from './guard.js'

page('/profile/:id', {
  tag: 'page-profile',
  via: ['main', 'content'],
  template: {
    html: './template.html',
    css: './style.css'
  },
  props: { id: { type: Number } },
  query: ['tab'],
  guard,
  on: { load }
}, import.meta.url)
```

The third argument `import.meta.url` is required when using file paths — it provides the base URL for resolving relative paths. When using inline strings the argument is optional.

---

## 4. `dock`

### Dock Overview

A `dock` is a persistent container shell. It lives in the DOM across route changes, receives swapped child content from the router, and registers itself in the container graph the moment it connects.

A `dock` is the replacement for `<route-outlet>`. Unlike the old outlet, a dock:

- Registers its own position in the hierarchical graph (via `graph.add`).
- Declares its parent dock, enabling LCA traversal and cascade mounting.
- Exposes a `swap` method the router calls to replace child content with a view transition.
- Automatically unregisters on `disconnectedCallback`.

A `dock` element can contain `view` and `part` elements as persistent chrome (navigation bars, sidebars, headers) alongside the `<slot>` where the router injects page content.

### Dock Signature

```text
dock(name, config)
```

| Argument | Type   | Required | Description                          |
|----------|--------|----------|--------------------------------------|
| `name`   | string | Yes      | Key in the container graph           |
| `config` | object | Yes      | See schema below                     |

### Dock Schema

```js
dock('sidebar', {

  // ── Identity ─────────────────────────────────────────────
  tag: 'dock-sidebar',
  // Optional. Defaults to 'dock-{name}' if omitted.
  // Must contain '-'. The tag is how the element appears in HTML.

  // ── Graph position ───────────────────────────────────────
  parent: 'main',
  // The dock name of the parent container.
  // Defaults to 'body' if omitted.
  // Used by graph.js for LCA traversal and cascade ordering.

  // ── Template ─────────────────────────────────────────────
  template: {
    html: `
      <nav>
        <slot name="nav"></slot>
      </nav>
      <slot></slot>
    `,
    css: `:host { display: flex; flex-direction: column; }`,
    shadow: 'open'
  },
  // If template is omitted entirely, the dock renders as a transparent
  // passthrough: shadow: false, html: '<slot></slot>'.

  // ── Lifecycle ────────────────────────────────────────────
  on: {
    connect() {
      // Fires after graph.add() has been called.
      // 'this' is the element instance.
    },
    disconnect() {
      // Fires before graph.remove() is called.
    },
    swap(el, { direction }) {
      // Override the default swap behaviour.
      // Called by cascade.js when mounting a new page or dock into this container.
      // Must return a Promise that resolves when the transition is complete.
      // Default implementation (used when swap is not declared):
      //
      //   if (this._tx) this._tx.skipTransition()
      //   const go = () => this.replaceChildren(el)
      //   if (typeof this.startViewTransition === 'function') {
      //     this._tx = this.startViewTransition({ callback: go })
      //     await this._tx.finished
      //     this._tx = null
      //   } else {
      //     go()
      //   }
    }
  }

})
```

### Dock Registration

`dock()` performs the following internally:

1. Defines an `HTMLElement` subclass.
2. On `connectedCallback`: calls `graph.add(name, el, config.parent ?? 'body')`.
3. On `disconnectedCallback`: calls `graph.remove(name)`.
4. Attaches the `swap` method — either the override from `on.swap` or the default view-transition implementation.
5. Calls `customElements.define(config.tag ?? 'dock-' + name, cls)`.
6. Calls `gate(customElements.whenDefined(tag))` on the boot gate.

The dock does **not** call `router.register`. It has no URL. The router discovers it through the container graph.

### Dock Example

```js
// docks/main.js
import { dock } from '../defs/index.js'

dock('main', {
  parent: 'body',
  template: {
    html: `
      <header><slot name="header"></slot></header>
      <main><slot></slot></main>
    `,
    css: `:host { display: grid; grid-template-rows: auto 1fr; min-height: 100vh; }`
  }
})
```

```js
// docks/sidebar.js
import { dock } from '../defs/index.js'

dock('sidebar', {
  parent: 'main',
  template: {
    html: `<aside><slot></slot></aside>`,
    css: `:host { display: block; width: 240px; }`
  },
  on: {
    async swap(el, { direction }) {
      const anim = this.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 })
      await anim.finished
      this.replaceChildren(el)
      this.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 })
    }
  }
})
```

### Placing a dock in HTML

A dock tag placed directly in HTML is discovered the moment it connects:

```html
<body>
  <dock-main>
    <dock-sidebar slot="sidebar"></dock-sidebar>
  </dock-main>
</body>
```

A dock can also be placed inside a page's template — it will mount and register itself as a child of whatever dock the page is rendered in. This is how sub-layouts work.

---

## 5. `view`

### View Overview

A `view` is a composable, stateful UI unit with no route and no container graph presence. It is a pure Web Component — the router never touches it directly.

A `view` is reused across pages, placed in dock chrome, used inside other views, or composed into part templates. It has observed properties, a full Custom Element lifecycle, and its own encapsulated shadow DOM.

Relationship to `page`: a `page` is a `view` that also has a URL. If you find yourself wanting to add a route to a `view`, promote it to a `page`.

### View Signature

```text
view(tag, config)
```

| Argument | Type   | Required | Description                  |
|----------|--------|----------|------------------------------|
| `tag`    | string | Yes      | Custom Element tag name      |
| `config` | object | Yes      | See schema below             |

### View Schema

```js
view('user-card', {

  // ── Observed properties ───────────────────────────────────
  props: {
    name:   { type: String, default: '' },
    avatar: { type: String, default: '' },
    count:  { type: Number, default: 0 },
    active: { type: Boolean, default: false }
  },
  // Each entry becomes an observed attribute AND a reflected property.
  // On attribute change the value is cast to the declared type before
  // attributeChangedCallback fires.
  // 'default' is the initial value assigned in the constructor.

  // ── Template ─────────────────────────────────────────────
  template: {
    html: `
      <img part="avatar" alt="">
      <span part="name"></span>
      <slot></slot>
    `,
    css: `
      :host { display: flex; align-items: center; gap: .5rem; }
      [part="avatar"] { width: 2rem; height: 2rem; border-radius: 50%; }
    `,
    shadow: 'open'
  },

  // ── Lifecycle ────────────────────────────────────────────
  on: {
    connect() {
      // connectedCallback.
    },
    disconnect() {
      // disconnectedCallback.
    },
    change(attr, prev, next) {
      // attributeChangedCallback.
      // 'attr' is the attribute name (kebab-case).
      // 'next' is already cast to the declared prop type.
      if (attr === 'avatar') this.shadowRoot.querySelector('[part="avatar"]').src = next
      if (attr === 'name')   this.shadowRoot.querySelector('[part="name"]').textContent = next
    },
    adopt() {
      // adoptedCallback — element moved to a new document.
    }
  }

})
```

### View Registration

`view()` performs the following internally:

1. Collects `static get observedAttributes()` from the `props` keys.
2. Defines the `HTMLElement` subclass with casting inside `attributeChangedCallback`.
3. Calls `customElements.define(tag, cls)`.
4. Does **not** interact with the router, boot gate, or container graph.

### View Example — inline

```js
// views/stat-card.js
import { view } from '../defs/index.js'

view('stat-card', {
  props: {
    label: { type: String, default: '' },
    value: { type: Number, default: 0 }
  },
  template: {
    html: `<dt part="label"></dt><dd part="value"></dd>`,
    css: `:host { display: contents; } [part="value"] { font-size: 2rem; font-weight: 700; }`
  },
  on: {
    change(attr, _, next) {
      this.shadowRoot.querySelector('[part="' + attr + '"]').textContent = next
    }
  }
})
```

### View Example — folder

```text
views/
  data-table/
    index.js          ← view() call
    template.html     ← native HTML template
    style.css         ← native CSS stylesheet
    sort.js           ← sort logic used inside on.connect
    filter.js         ← filter logic
```

```js
// views/data-table/index.js
import { view }    from '../../defs/index.js'
import { sort }    from './sort.js'
import { filter }  from './filter.js'

view('data-table', {
  props: {
    rows:   { type: String, default: '[]' },   // JSON string
    sortby: { type: String, default: '' },
    filter: { type: String, default: '' }
  },
  template: {
    html: './template.html',
    css: './style.css'
  },
  on: {
    connect() { this.render() },
    change()  { this.render() },
    render() {
      const rows = JSON.parse(this.rows)
      const sorted   = sort(rows, this.sortby)
      const filtered = filter(sorted, this.filter)
      // ... update DOM
    }
  }
}, import.meta.url)
```

---

## 6. `part`

### Part Overview

A `part` is an atomic, stateless UI primitive. It is the smallest reusable unit — buttons, icons, badges, chips, inputs, labels. It may declare props for configuration (variant, size, disabled) but carries no internal state beyond what the native element provides.

A `part` differs from a `view` in that it does not own data, does not fetch, does not manage layout, and its lifecycle is minimal. If you find yourself adding `on.change` logic beyond updating a CSS class or an attribute reflection, promote it to a `view`.

### Part Signature

```text
part(tag, config)
```

### Part Schema

```js
part('icon-btn', {

  // ── Props (optional) ──────────────────────────────────────
  props: {
    variant:  { type: String,  default: 'default' },
    size:     { type: String,  default: 'md' },
    disabled: { type: Boolean, default: false }
  },

  // ── Template ─────────────────────────────────────────────
  template: {
    html: `
      <button part="btn">
        <slot name="icon"></slot>
        <slot></slot>
      </button>
    `,
    css: `
      :host { display: inline-flex; }
      :host([disabled]) [part="btn"] { pointer-events: none; opacity: .4; }
    `,
    shadow: 'open'
  },

  // ── Lifecycle (minimal, optional) ────────────────────────
  on: {
    connect() {
      this.shadowRoot.querySelector('[part="btn"]').disabled = this.disabled
    }
  }

})
```

### Part Registration

`part()` performs the following internally:

1. Defines the `HTMLElement` subclass.
2. Calls `customElements.define(tag, cls)`.
3. Does **not** interact with the router, boot gate, or container graph.
4. Observed attributes are derived from `props` keys, same casting rules as `view`.

### Part Example

```js
// parts/badge.js
import { part } from '../defs/index.js'

part('status-badge', {
  props: {
    state: { type: String, default: 'idle' }
  },
  template: {
    html: `<span part="dot"></span><slot></slot>`,
    css: `
      :host { display: inline-flex; align-items: center; gap: .25rem; }
      [part="dot"] { width: .5rem; height: .5rem; border-radius: 50%; background: currentColor; }
      :host([state="live"])  { color: #16a34a; }
      :host([state="error"]) { color: #dc2626; }
    `
  }
})
```

---

## 7. Composition

All four primitives produce Custom Elements. They compose by using each other's tags in HTML templates.

### view inside page

```js
// Import the view so it is defined before the page renders.
import '../views/stat-card.js'
import '../views/user-card.js'
import { page } from '../defs/index.js'

page('/dashboard', {
  tag: 'page-dashboard',
  via: ['main'],
  template: {
    html: `
      <section class="stats">
        <stat-card label="Users" value="0"></stat-card>
        <stat-card label="Revenue" value="0"></stat-card>
      </section>
      <user-card></user-card>
    `,
    css: `:host { display: grid; gap: 1rem; }`
  }
})
```

Import order is the only requirement. Because all definitions call `customElements.define`, the browser upgrades the tags as soon as they appear in the shadow DOM.

### part inside view

```js
import '../parts/icon-btn.js'
import { view } from '../defs/index.js'

view('action-bar', {
  template: {
    html: `
      <icon-btn variant="ghost"><slot name="icon" slot="icon"></slot>Edit</icon-btn>
      <icon-btn variant="danger">Delete</icon-btn>
    `,
    css: `:host { display: flex; gap: .5rem; }`
  }
})
```

### dock inside page (sub-layout)

A page can declare a dock in its template to introduce a new layout region for its child routes.

```js
import '../docks/tab-panel.js'   // defines dock('tab-panel', { parent: 'content' })
import { page } from '../defs/index.js'

page('/settings', {
  tag: 'page-settings',
  via: ['main'],
  template: {
    html: `
      <nav>
        <a href="/settings/profile">Profile</a>
        <a href="/settings/security">Security</a>
      </nav>
      <dock-tab-panel></dock-tab-panel>
    `,
    css: `:host { display: grid; grid-template-rows: auto 1fr; }`
  }
})

// Child routes declare the sub-dock in via:
page('/settings/profile', {
  tag: 'page-settings-profile',
  via: ['main', 'tab-panel'],
  template: { html: `<slot></slot>`, css: `:host { display: block; }` }
})
```

When navigating to `/settings/profile` from an unrelated route:

1. `cascade.js` mounts `dock-main` (if absent).
2. `cascade.js` mounts `page-settings` into `main` (if absent).
3. `dock-tab-panel` — declared inside `page-settings`'s template — self-registers on `connectedCallback`.
4. `cascade.js` mounts `page-settings-profile` into `tab-panel`.

### page inside dock — persistent chrome

Docks can hold permanent `view` or `part` content in named slots alongside the router's swap target slot:

```js
dock('main', {
  template: {
    html: `
      <view-topbar slot="header"></view-topbar>
      <slot></slot>                             <!-- router injects here -->
    `,
    css: `:host { display: grid; grid-template-rows: auto 1fr; }`
  }
})
```

`view-topbar` is rendered once when the dock connects and persists across all navigations through `main`.

---

## 8. File Conventions

### Inline (single file)

Suitable when the template, style, and logic are short and cohesive.

```text
src/
  docks/
    main.js
    sidebar.js
  pages/
    home.js
    profile.js
  views/
    user-card.js
    data-table.js
  parts/
    icon-btn.js
    status-badge.js
  defs/
    page.js
    dock.js
    view.js
    part.js
    index.js
```

File name = the element's untagged slug. `page-profile` lives in `pages/profile.js`. `dock-sidebar` lives in `docks/sidebar.js`. `view-user-card` lives in `views/user-card.js`.

### Folder-based

When a definition grows — complex template, multiple helpers, separate load/guard logic — promote it to a folder. The folder name stays the slug.

```text
pages/
  profile/
    index.js         ← page() call, the only entry point
    template.html    ← native HTML template (IDE completion, Emmet, linting)
    style.css        ← native CSS stylesheet (IDE completion, linting)
    load.js          ← named export: load handler
    guard.js         ← named export: guard function

views/
  data-table/
    index.js
    template.html
    style.css
    sort.js
    filter.js

docks/
  sidebar/
    index.js
    template.html
    style.css
```

Template and style files are plain native files — no JS wrappers, no export boilerplate. The browser's native parsers handle them directly. IDEs provide full syntax highlighting, autocompletion, and linting out of the box.

```html
<!-- pages/profile/template.html -->
<header part="head"><slot name="header"></slot></header>
<section part="body"><slot></slot></section>
```

```css
/* pages/profile/style.css */
:host {
  display: grid;
  grid-template-rows: auto 1fr;
}
```

Helper files export named functions used in lifecycle hooks:

```js
// pages/profile/load.js
export async function load({ params }) {
  const res  = await fetch('/api/profile/' + params.id)
  this.model = await res.json()
}
```

The `index.js` imports helpers and points to native files:

```js
// pages/profile/index.js
import { page }   from '../../defs/index.js'
import { load }   from './load.js'
import { guard }  from './guard.js'

page('/profile/:id', {
  tag: 'page-profile',
  via: ['main', 'content'],
  template: {
    html: './template.html',
    css: './style.css'
  },
  props: { id: { type: Number } },
  query: ['tab'],
  guard,
  on: { load }
}, import.meta.url)
```

The third argument `import.meta.url` is required when template or style values are file paths. It tells the framework how to resolve relative paths. When using inline strings it can be omitted.

---

## 9. Tag Prefixes

Custom Element tags must contain a hyphen. Use these prefixes for instant visual identification:

| Type   | Prefix   | Example             |
|--------|----------|---------------------|
| `page` | `page-`  | `page-profile`      |
| `dock` | `dock-`  | `dock-sidebar`      |
| `view` | `view-`  | `view-user-card`    |
| `part` | `part-`  | `part-icon-btn`     |

Prefix is enforced by convention, not by the definition functions. The prefix is entirely visible in HTML, making the type of every element immediately clear at a glance.

If a `dock` tag is omitted from the config, it auto-derives as `dock-{name}`:

```js
dock('sidebar', { ... })          // tag = 'dock-sidebar'
dock('settings-panel', { ... })   // tag = 'dock-settings-panel'
```

---

## 10. Lifecycle Reference

### `page`

| Hook                              | When                                          | `this`   |
|-----------------------------------|-----------------------------------------------|----------|
| `on.load({ params, query, hash, state })` | Route activates, before swap into dock | Element  |
| `on.unload()`                     | Route deactivates, before swap away           | Element  |
| `on.connect()`                    | `connectedCallback` — element in DOM          | Element  |
| `on.disconnect()`                 | `disconnectedCallback` — element removed      | Element  |

`on.load` receives the same `params`, `query`, `hash`, `state` that the router resolved. Returning a rejected Promise from `on.load` aborts the navigation.

### `dock`

| Hook                              | When                                          | `this`   |
|-----------------------------------|-----------------------------------------------|----------|
| `on.connect()`                    | After `graph.add()` — dock is in graph        | Element  |
| `on.disconnect()`                 | Before `graph.remove()` — dock leaving graph  | Element  |
| `on.swap(el, { direction })`      | Router mounting content into this dock        | Element  |

`on.swap` must return a Promise. `direction` is the Navigation API `navigationType`: `'push'`, `'replace'`, `'traverse'`, or `'load'`.

### `view`

| Hook                              | When                                          | `this`   |
|-----------------------------------|-----------------------------------------------|----------|
| `on.connect()`                    | `connectedCallback`                           | Element  |
| `on.disconnect()`                 | `disconnectedCallback`                        | Element  |
| `on.change(attr, prev, next)`     | `attributeChangedCallback` — `next` is cast  | Element  |
| `on.adopt()`                      | `adoptedCallback`                             | Element  |

### `part`

| Hook                              | When                                          | `this`   |
|-----------------------------------|-----------------------------------------------|----------|
| `on.connect()`                    | `connectedCallback` — optional                | Element  |
| `on.disconnect()`                 | `disconnectedCallback` — optional             | Element  |

---

## 11. Route-Awareness Matrix

|                       | `page` | `dock` | `view` | `part` |
|-----------------------|--------|--------|--------|--------|
| URL pattern           | Yes    | No     | No     | No     |
| `via` chain           | Yes    | No     | No     | No     |
| Boot gate             | Yes    | Yes    | No     | No     |
| Container graph       | No     | Yes    | No     | No     |
| `swap` method         | No     | Yes    | No     | No     |
| Observed props        | Yes    | No     | Yes    | Yes    |
| Query param mapping   | Yes    | No     | No     | No     |
| Route guard           | Yes    | No     | No     | No     |
| `on.load / unload`    | Yes    | No     | No     | No     |
| `on.change`           | No     | No     | Yes    | No     |
| `on.adopt`            | No     | No     | Yes    | No     |
| Use in any template   | Yes    | Yes    | Yes    | Yes    |

---

## 12. Props Typing Reference

The `props` field uses the same casting model as the existing `specRegistry` in `outlet.js`. The outlet cast loop is now absorbed into the definition runtime.

| `type`    | Attribute value   | Cast result     |
|-----------|-------------------|-----------------|
| `String`  | `"hello"`         | `"hello"`       |
| `Number`  | `"42"`            | `42`            |
| `Number`  | `"bad"`           | `0`             |
| `Boolean` | `"true"` / `"1"` / `""` | `true`   |
| `Boolean` | `"false"` / `"0"` | `false`        |

For `page` props, route params and query values (both strings from the URL) are cast before being set as element properties. For `view` and `part` props, attribute values are cast inside `attributeChangedCallback`.

---

## 13. Migration from `ui.element` + `router.register`

| Before                                    | After                     |
|-------------------------------------------|---------------------------|
| `ui.element({ url: '/path', tag, container })` | `page('/path', { tag, via: [...] })` |
| `ui.container('name')`                    | `dock('name', { ... })`   |
| `<route-outlet>`                          | `<dock-main>`, `<dock-sidebar>` etc. |
| `router.register(pat, tag, meta)`         | Called internally by `page()` |
| `specRegistry.set(tag, spec)`             | Called internally by `page()` |
| `router.guard(fn)`                        | Still works. Per-route: `guard` field in `page()` |

Both APIs can coexist during migration. `router.register` and `registerContainer` remain public. Teams can migrate definition by definition.

---

## 14. `defs/index.js`

```js
export { page } from './page.js'
export { dock } from './dock.js'
export { view } from './view.js'
export { part } from './part.js'
```

Each file contains the definition function. The implementation wires Custom Element class creation, `customElements.define`, router registration, specRegistry population, and boot gating. None of that is the developer's concern.

---

*End of definitions.*
