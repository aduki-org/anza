# Transitions

The `transition()` wrapper initiates a CSS View Transition around a DOM mutation, falling back to direct execution when unsupported or when the user prefers reduced motion.

---

## Basic Use

```javascript
import { ui } from '@adukiorg/anza/ui';

await ui.transition(() => {
  container.replaceChildren(newElement);
});
```

If View Transitions are supported and the user has not requested reduced motion, the DOM update is wrapped in a transition. Otherwise, the callback runs immediately.

---

## Return Shape

`transition()` returns a promise resolving to a transition-like object:

```javascript
const tx = await ui.transition(updateDOM);

// Always available:
tx.finished              // resolves when transition ends (or immediately)
tx.updateCallbackDone   // resolves when the DOM update callback completes
tx.skipTransition()     // no-op when transitions are skipped
```

When transitions are skipped (unsupported or reduced motion):

- `finished` resolves immediately with the callback's result
- `ready` rejects with "View Transitions skipped or unsupported"
- `skipTransition` is a no-op

---

## Reduced Motion

When `prefers-reduced-motion: reduce` is active, transitions are skipped entirely. The DOM update runs synchronously. This is automatic — no code change needed.

---

## Inside Components

Use `transition()` inside event handlers for animated swaps:

```javascript
view('gallery', {
  template: `
    <div class="thumbs"></div>
    <img ref="main" class="main">
  `,
  on: {
    connect({ on, refs }) {
      on.click('.thumb', async (e, target) => {
        await ui.transition(() => {
          refs.main.src = target.dataset.full;
        });
      });
    }
  }
});
```

---

## CSS

Style the transition with CSS pseudo-elements:

```css
::view-transition-old(root) {
  animation: fade-out 200ms ease;
}

::view-transition-new(root) {
  animation: fade-in 200ms ease;
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

For element-scoped transitions (dock `swap`), target the element:

```css
::view-transition-old(dock-main) {
  animation: slide-out 200ms ease;
}
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

Override any token in your own CSS:

```css
@layer overrides {
  :root {
    --transition-duration: 400ms;
    --transition-easing: var(--ease-spring);
  }
}
```

The library sets `background: var(--transition-bg)` on both `::view-transition-old(root)` and `::view-transition-new(root)` automatically. You only need to write custom CSS if you want animations beyond the default cross-fade.

---