# API Reference

Complete reference for the events facade and internal utilities.

---

## Facade

```javascript
import { events } from '@adukiorg/anza/events';
```

### `events.on(type, handler, signal)`

Subscribe to the global event bus. Returns a disposer.

```javascript
const off = events.on('update', (e) => { ... });
off(); // remove
```

### `events.emit(type, detail)`

Emit a global event.

```javascript
events.emit('update', { value: 42 });
```

### `events.listen(target, type, handler, options)`

Memory-safe DOM listener. Returns a disposer.

```javascript
const off = events.listen(el, 'click', handler, { signal: ctrl.signal });
```

### `events.delegate(root, selector, type, handler, options)`

Shadow-aware event delegation. Returns a disposer.

```javascript
const off = events.delegate(document.body, '.btn', 'click', handler);
```

### `events.once(target, type, options)`

Promise-wrapped single event.

```javascript
const event = await events.once(document, 'click');
```

### `events.names`

System event name constants:

```javascript
events.names.auth.signedin       // 'auth:signedin'
events.names.auth.signedout      // 'auth:signedout'
events.names.auth.refreshed      // 'auth:refreshed'
events.names.connectivity.online  // 'connectivity:online'
events.names.connectivity.offline // 'connectivity:offline'
events.names.preference.changed // 'preference:changed'
events.names.sw.updated          // 'sw:updated'
events.names.sw.message          // 'sw:message'
```

---

## Named Exports

```javascript
import { bus, EventBus, delegate, once, listen, names } from '@adukiorg/anza/events';
```

### `bus`

Global `EventBus` instance.

### `EventBus`

Class extending `EventTarget`:

```javascript
const myBus = new EventBus();
myBus.on('event', handler);
myBus.emit('event', detail);
```

Methods: `on(type, fn, signal)`, `emit(type, detail)`.

### `delegate(root, selector, type, handler, options)`

Shadow-aware event delegation. Returns disposer.

### `listen(target, type, handler, options)`

Memory-safe listener. Returns disposer.

### `once(target, type, options)`

Promise-wrapped single event. Returns `Promise<Event>`.

### `names`

System event constants object.

---

## Listener Options

All listener functions accept standard `addEventListener` options:

| Option | Type | Description |
| -------- | ------ | ------------- |
| `signal` | AbortSignal | Auto-cleanup on abort |
| `capture` | boolean | Capture phase |
| `once` | boolean | Fire once (native, not the `once()` function) |
| `passive` | boolean | Cannot call preventDefault |

---

## Event Payload

Bus and emit listeners receive a `CustomEvent`:

```javascript
{
  type: string,    // event name
  detail: any,     // payload passed to emit
  bubbles: boolean, // false for bus events
  composed: boolean // false for bus events
}
```
