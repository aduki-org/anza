# Delegate

Event delegation registers one listener on an ancestor element to handle events from matching descendants. It traverses `composedPath()` so it works through shadow DOM boundaries.

---

## Signature

```javascript
delegate(root, selector, type, handler, options);
```

| Param | Type | Description |
| ------- | ------ | ------------- |
| `root` | EventTarget | The ancestor to listen on |
| `selector` | string | CSS selector for descendant matching |
| `type` | string | Event type |
| `handler` | function | Callback receives `(event, matchedElement)` |
| `options` | object | Standard `addEventListener` options plus `signal` |

Returns a disposer function.

---

## Basic Delegation

```javascript
import { events } from '@adukiorg/anza/events';

const dispose = events.delegate(
  document.body,
  '.btn',
  'click',
  (event, target) => {
    console.log('Button clicked:', target.textContent);
  }
);

// Later
dispose();
```

One listener on `document.body` handles all `.btn` clicks, including buttons added dynamically after registration.

---

## Shadow DOM Traversal

The delegation walks `composedPath()`, so it matches elements inside shadow roots:

```javascript
events.delegate(
  document.body,
  'my-component .action',
  'click',
  (event, target) => {
    // target may be inside a shadow root
  }
);
```

The path stops at the `root` element. Selectors outside the root are not evaluated.

---

## Selector Matching Cache

`element.matches()` results are cached in a two-level `WeakMap`:

```javascript
// First check for this element + selector
const result = matchesCache.get(element)?.get(selector);
```

This prevents redundant selector evaluations when the same element fires multiple events.

---

## Handler Binding

The handler is called with `this` bound to the matched element:

```javascript
events.delegate(container, '.item', 'click', function (event) {
  console.log(this.textContent); // the matched .item element
});
```

The second argument is also the matched element:

```javascript
(container, '.item', 'click', (event, target) => {
  console.log(target.textContent);
});
```

---

## Options

Pass standard `addEventListener` options:

```javascript
events.delegate(root, '.btn', 'click', handler, {
  capture: true,
  signal: controller.signal
});
```

---

## AbortSignal Cleanup

```javascript
const ctrl = new AbortController();

events.delegate(document.body, '.btn', 'click', handler, {
  signal: ctrl.signal
});

// Remove all delegated listeners on this root
ctrl.abort();
```
