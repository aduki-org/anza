# Styles

Styles are loaded per element and applied to the shadow root. The UI layer uses constructable stylesheets when available, falling back to `<style>` injection.

---

## Inline CSS

```javascript
view('styled-box', {
  template: '<div class="box"></div>',
  style: `
    :host { display: block; padding: 1rem; }
    .box { background: #f0f0f0; border-radius: 4px; }
  `
});
```

---

## File CSS

```javascript
view('styled-box', {
  template: { html: './box.html', css: './box.css' }
}, import.meta.url);
```

Or with the definition layer:

```javascript
view('styled-box', {
  template: { html: './box.html', css: './box.css' }
}, import.meta.url);
```

---

## Constructable Stylesheets

When `CSSStyleSheet` and `adoptedStyleSheets` are supported:

1. CSS is fetched once per unique URL
2. A `CSSStyleSheet` is created and populated with `replaceSync()`
3. The sheet is stored in a global cache
4. Each instance adopts the shared sheet via `shadowRoot.adoptedStyleSheets`

This means:

- One fetch per CSS file across the entire application
- One stylesheet object shared by all instances
- Hot reload updates all live instances simultaneously

---

## Fallback

When constructable stylesheets are unsupported:

1. CSS text is fetched and stored as a string
2. Each instance injects a `<style>` element into its shadow root

No shared caching, but full compatibility.

---

## HMR (Hot Module Replacement)

During development, the factory listens for `native:hmr:css` events:

```javascript
window.dispatchEvent(new CustomEvent('native:hmr:css', {
  detail: { path: './box.css', css: '/* new css */' }
}));
```

When a matching CSS file is detected, the shared stylesheet is updated with `replaceSync()`. All live instances reflect the change without remounting.

Only one listener per unique style URL is registered globally.

---

## Scoped Styles

Styles defined in a declarative element are scoped to its shadow root. They do not leak outside:

```css
/* Inside <styled-box> shadow root */
.box { color: red; }   /* only matches inside this element */
```

Use `:host` to style the element itself:

```css
:host { display: flex; gap: 1rem; }
:host([active]) { border: 2px solid blue; }
```

---

## Dock Containment

Docks automatically receive `contain: layout` styling for view transition isolation:

```css
:host { contain: layout; display: block; }
```

This is prepended to any user-supplied style. Do not override `contain` on docks unless you understand the transition implications.
