# API Reference

Complete reference for the platform module.

---

## Named Exports

```javascript
import { supports, guard, reset, typeGuard } from '@adukiorg/anza/platform';
```

### `supports`

Lazy-evaluated feature detection object. See [supports.md](supports.md) for the full flag list.

### `guard.urlPattern()`

Returns `Promise<URLPatternClass>`.

### `guard.navigation()`

Returns `Promise<navigationObject>`.

### `guard.popover()`

Returns `Promise<void>`. Installs polyfill if needed.

### `guard.shadow(root)`

Returns `Promise<void>`. Applies declarative shadow DOM polyfill to root.

### `guard.anchor(floating, anchorEl, options)`

Returns `Promise<void>`. Computes anchor positioning fallback.

### `guard.sanitizer()`

Returns `Promise<{ sanitizeToString(input) }>`.

### `guard.scheduler()`

Returns `Promise<schedulerObject>`.

### `guard.yield()`

Returns `Promise<void>`. Yields to the event loop.

### `reset(key)`

Clears cached detection value for a flag.

```javascript
reset('urlPattern');
```

### `typeGuard(key, message)`

Throws if the feature is not supported.

```javascript
typeGuard('opfs', 'File storage is required');
```

---

## Scheduler Polyfill API

When native `scheduler` is unavailable, the polyfill exposes:

```javascript
scheduler.postTask(fn, { priority, delay, signal })
scheduler.yield()
```

Priorities: `user-blocking`, `user-visible`, `background`.
