# Transitions

The router wraps every DOM mutation in the browser's CSS View Transitions API when available, falling back instantly to synchronous rendering when unsupported or when the user prefers reduced motion.

---

## How It Works

When the router emits `found`, it calls:

```javascript
await transitions.run(async () => {
  // mount the new element
}, { sourceElement, name });
```

The `transitions.run` wrapper:

1. Checks `prefers-reduced-motion: reduce`
2. Checks for `document.startViewTransition`
3. If both pass, starts a view transition around the DOM update
4. Otherwise, runs the update synchronously

---

## Dock-Level Transitions

Docks use their own `swap` method for container-scoped transitions:

```javascript
// Inside a dock element
await this.swap(newElement, { direction: 'push' });
```

The dock tries three strategies in order:

1. **Element-scoped** `startViewTransition` (Chrome 147+) — isolated to this subtree, concurrent with other docks
2. **Document-scoped** `startViewTransition` — full-page transition
3. **Synchronous** `replaceChildren` — instant swap

Element-scoped transitions require `contain: layout` on the container. Every dock automatically receives this style.

---

## Shared Element Morphing

Morph a specific element between outgoing and incoming views:

```javascript
await transitions.run(() => {
  container.replaceChildren(detail);
}, {
  sourceElement: card,
  name: 'selected-card'
});
```

Before the transition, `sourceElement.style.viewTransitionName` is set to `'selected-card'`. After the transition completes (or fails), the name is cleared.

Use this for list-to-detail animations, card expansions, and any cross-view element continuity.

---

## Directional Hints

The `direction` option is passed through to the dock's `swap` method and exposed as a dataset attribute:

```javascript
await container.swap(newElement, { direction: 'back' });
```

In CSS:

```css
:host {
  transition: transform 300ms ease;
}

:host([data-transition-direction="back"]) {
  transform: translateX(-20px);
}
```

---

## Reduced Motion

When `prefers-reduced-motion: reduce` is active, transitions are skipped entirely. The DOM update runs synchronously. This is automatic — you do not need to handle it.

---

## Abort Safety

Rapid navigation can abort an in-flight transition. The router catches `AbortError` and silences it. The dock's `swap` method additionally aborts any previous transition before starting a new one, so rapid clicks do not leave half-finished animations.

---

## Manual Use

You can use `transitions.run` directly for non-router DOM updates:

```javascript
import { transitions } from '@adukiorg/anza/router';

await transitions.run(() => {
  panel.replaceChildren(newContent);
});
```

With shared element:

```javascript
await transitions.run(() => {
  panel.replaceChildren(newContent);
}, {
  sourceElement: thumbnail,
  name: 'hero-image'
});
```

---

## Tokens

View Transition timing and backdrop are controlled by semantic tokens. The library injects a token-aware stylesheet on the first transition so duration, easing, and background derive from the same layer as surfaces and content.

| Token | Default | Purpose |
| ------ | ------- | ------- |
| `--transition-bg` | `--color-surface-page` | Backdrop behind old and new page snapshots |
| `--transition-duration` | `--duration-normal` | How long the VT runs |
| `--transition-easing` | `--ease-out` | Default easing curve |
| `--transition-push` | `--ease-out` | Easing when navigating forward |
| `--transition-pop` | `--ease-in` | Easing when navigating back |
| `--transition-replace` | `--ease-in-out` | Easing for replace-style swaps |

The dock `swap` method reads `--transition-push` or `--transition-pop` based on the `direction` option and temporarily overrides `--transition-easing` on `:root` before starting the transition. This means back-navigation feels physically different from forward-navigation without writing any custom CSS.

Override any token in your own CSS:

```css
@layer overrides {
  :root {
    --transition-duration: 400ms;
    --transition-easing: var(--ease-spring);
  }
}
```

---

## CSS Transition Basics

View transitions work by taking GPU snapshots of the old and new DOM states and interpolating between them. Style the transition with CSS:

```css
::view-transition-old(root) {
  animation: fade-out 300ms ease;
}

::view-transition-new(root) {
  animation: fade-in 300ms ease;
}

@keyframes fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

For element-scoped transitions, target the container instead of `root`:

```css
dock-main::part(view-transition-old) {
  animation: slide-out 200ms ease;
}
```
