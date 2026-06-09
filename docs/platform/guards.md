# Guards

The `guard` object provides asynchronous feature gates. Each method checks native support and either returns the native API or dynamically imports a polyfill.

---

## urlPattern

```javascript
const URLPattern = await guard.urlPattern();
const pattern = new URLPattern({ pathname: '/user/:id' });
```

Returns the native `URLPattern` class or loads the polyfill. Used by the router for pathname matching.

---

## navigation

```javascript
const nav = await guard.navigation();
nav.navigate('/settings');
```

Returns `window.navigation` or bootstraps the Navigation API polyfill. Used by the router for history management.

---

## popover

```javascript
await guard.popover();
document.getElementById('menu').showPopover();
```

Installs `HTMLElement` popover prototype methods if missing. Provides light-dismiss behavior and memory-safe cleanup.

---

## shadow

```javascript
await guard.shadow(document);
```

Applies the declarative shadow DOM polyfill to a root element. Parses `<template shadowrootmode="open">` nodes.

---

## anchor

```javascript
await guard.anchor(floatingEl, anchorEl, { inset: true });
```

Computates dynamic anchor positioning for floating elements when native CSS anchor positioning is unavailable.

---

## sanitizer

```javascript
const sanitizer = await guard.sanitizer();
const clean = sanitizer.sanitizeToString('<p>Safe</p>');
```

Returns a sanitizer wrapper with `.sanitizeToString(input)`. Uses the native `Sanitizer` API when available, falls back to `DOMPurify` or a textContent-based sanitizer.

---

## scheduler

```javascript
const scheduler = await guard.scheduler();
scheduler.postTask(fn, { priority: 'user-visible' });
```

Returns `globalThis.scheduler` or loads the polyfill. Supports three priorities: `user-blocking`, `user-visible`, `background`.

---

## yield

```javascript
await guard.yield();
```

Yields execution control back to the event loop. Equivalent to `scheduler.yield()` when available, otherwise falls back to `setTimeout(..., 0)`.

Use inside heavy loops to prevent UI freezing:

```javascript
for (let i = 0; i < 10000; i++) {
  process(i);
  if (i % 100 === 0) await guard.yield();
}
```
