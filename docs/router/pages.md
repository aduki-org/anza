# Pages

`page(route, config, base)` defines a route-bound custom element. It is the primary way to declare navigable views in an Anza application.

---

## Signature

```javascript
page(route, config, base);
```

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `route` | string | yes | URL pattern, e.g. `'/'` or `'/profile/:id'` |
| `config` | object | yes | Page definition (see below) |
| `base` | string | no | `import.meta.url` of the caller; required for file templates |

---

## Config Fields

### `tag`

The custom element tag. Must contain a hyphen.

```javascript
page('/', { tag: 'page-home' });
```

### `via`

Ordered container chain, root to leaf. The last entry is the render target.

```javascript
page('/settings/profile', {
  tag: 'page-profile',
  via: ['main', 'sidebar', 'content']
});
```

### `container`

Single container (back-compat for `via` with one entry):

```javascript
page('/', { tag: 'page-home', container: 'main' });
```

### `template`

HTML template. Three forms:

**Inline string:**

```javascript
template: '<h1>Home</h1>'
```

**File reference (requires `base`):**

```javascript
template: { html: './home.html', css: './home.css' }
```

**Shadow toggle:**

```javascript
template: { html: './home.html', css: './home.css', shadow: false }
```

Setting `shadow: false` renders into the light DOM instead of a shadow root.

### `style`

Inline CSS string. When using file templates, the CSS path goes inside the `template` object.

```javascript
style: ':host { display: block; padding: 1rem; }'
```

### `props`

Reactive properties with type casting. Values from the URL are cast automatically.

```javascript
props: {
  id:    { type: Number, default: 0 },
  active:{ type: Boolean }
}
```

Supported types: `String`, `Number`, `Boolean`.

### `query`

Query parameters to map onto props:

```javascript
query: ['tab', 'search'],
props: {
  tab:    { type: String },
  search: { type: String }
}
```

Visiting `/settings?tab=profile&search=alice` sets `tab = 'profile'` and `search = 'alice'`.

### `hash`

Declare a `hash` prop to receive the URL hash:

```javascript
props: { hash: { type: String } }
```

Visiting `/settings#section-2` sets `hash = '#section-2'`.

### `on`

Lifecycle hooks:

```javascript
on: {
  load({ el, params, query, hash, ctrl }) {
    // Called once after mount
    return fetchUser(params.id);
  },
  connect({ el }) {
    // Called when the element connects to the DOM
  },
  disconnect({ el }) {
    // Called when the element disconnects
  },
  change({ el, name, val }) {
    // Called when a declared prop changes
  }
}
```

All hooks receive a context object with `el` (the element), `params` (route parameters), `query` (query object), `hash` (hash string), and `ctrl` (an AbortController whose signal aborts when the element disconnects).

`load` may return a promise. The router does not wait for it — the element mounts immediately and the promise resolves asynchronously. Use this for data fetching that should not block rendering.

### `guard`

Route-scoped navigation guard:

```javascript
page('/checkout', {
  tag: 'page-checkout',
  via: ['main'],
  guard: (destination, controller) => {
    if (!cart.hasItems()) return '/cart';
  }
});
```

See [guards.md](guards.md) for full guard documentation.

### `meta`

Additional metadata passed to the route registry:

```javascript
meta: { analytics: 'checkout' }
```

Available in match results as `result.route.meta`.

---

## Boot Gate

`page()` automatically gates the initial route match on the element's custom element definition:

```javascript
gate(customElements.whenDefined(tag));
```

This means a hard refresh on `/user/42` will wait for `<page-user>` to be defined before running the initial match, eliminating the race condition that plagued earlier router architectures.

---

## Route Registration

`page()` registers the route internally:

```javascript
router.register(route, tag, { via, container: target, ...meta });
```

The tag is both the custom element name and the route handler.

---

## Example: Full Page Definition

```javascript
page('/user/:id', {
  tag: 'page-user',
  via: ['main'],
  template: { html: './user.html', css: './user.css' },
  props: {
    id: { type: Number, default: 0 },
    tab: { type: String }
  },
  query: ['tab'],
  on: {
    async load({ params }) {
      const user = await fetchUser(params.id);
      this.user = user;
    },
    change({ name, val }) {
      if (name === 'tab') this.refreshTab(val);
    }
  }
}, import.meta.url);
```
