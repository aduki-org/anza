# Workers Plan

This document defines the improvement plan for `core.workers`. It follows the notes in `docs/notes/`, especially the worker, runtime, performance, memory, security, offline, storage, transport, and module-system notes.

The goal is a native browser concurrency layer that keeps the main thread free, owns every worker lifecycle, makes cross-context messaging explicit, and cleans up after itself.

---

## 1. Scope

`core.workers` covers these files:

```
src/core/workers/
├── index.js
├── dedicated.js
├── pool.js
├── shared.js
├── broadcast.js
├── locks.js
├── offscreen.js
└── plan.md
```

Related files:

```
types/core/workers/index.d.ts
tests/core/workers/
docs/core/workers/index.md
```

---

## 2. Rules

All implementation work must follow the naming rules:

- Prefer one-word names.
- Keep file names lowercase and one word.
- Let folder scope carry the domain.
- Use short verbs for methods: `run`, `send`, `close`, `stop`, `open`.
- Use nouns for values: `task`, `payload`, `port`, `signal`, `timer`, `worker`.
- Avoid repeated qualifiers such as `workerWorker`, `channelName`, `taskItem`, or `scriptUrl` when `worker`, `name`, `item`, or `script` is clear.
- Keep public compatibility aliases only when removing them would break users.

Target public surface:

```javascript
workers.run(script, task, options)
workers.shared(script, name)
workers.lock(name, fn, options)
workers.broadcast(name, payload)
workers.subscribe(name, fn, signal)
workers.offscreen(canvas, script, options)
workers.close(script)
workers.clear()
```

Compatibility exports can remain during the transition:

```javascript
DedicatedWorker
WorkerPool
SharedConnection
OffscreenHandle
```

Internally, prefer shorter class aliases:

```javascript
Dedicated
Pool
Shared
Offscreen
```

---

## 3. Current Gaps

### `dedicated.js`

- `run` has no `AbortSignal` handling.
- `run` has no timeout support.
- Ports are not closed on abort or timeout.
- Worker `error` and `messageerror` events are not routed into pending requests.
- A terminated worker can still accept calls until the browser rejects them.
- Transfer ownership is supported, but there is no plain message contract check.

### `pool.js`

- `TaskOptions.signal` and `TaskOptions.timeout` exist in types but are not enforced.
- Idle workers do not expire after a quiet period.
- Pools are not shut down on `pagehide`.
- Crashed tasks are always rejected instead of allowing idempotent requeue.
- Priority sorting is simple and can starve background work.
- Queue items are not cancellable before execution.
- Pool size is not clamped by a configurable maximum.

### `shared.js`

- The type file exposes `postMessage`, `onMessage`, and `close`, but the runtime exposes `send` and `subscribe` without `close`.
- Fallback behavior does not fully match `MessagePort`.
- Fallback listener errors are not isolated.
- There is no explicit reconnect or closed state.
- There is no cross-tab fallback strategy using `BroadcastChannel` plus `Web Locks`.

### `broadcast.js`

- Abort cleanup removes the listener from the channel, but does not remove the abort listener.
- `messageerror` is not handled.
- Temporary one-shot channels close immediately after `postMessage`; this should be tested across browsers.
- There is no `close(name)` or `clear()` control for long-lived consumers.

### `locks.js`

- Passing both `signal` and `timeout` does not create a combined signal.
- `ifAvailable` and `steal` are not exposed.
- Fallback mode runs the callback immediately and does not provide same-tab mutual exclusion.
- Lock names need a documented convention.
- Timeout errors should preserve the original abort reason when present.

### `offscreen.js`

- Transfer has no `ready` acknowledgement from the worker.
- Resize, device pixel ratio, and visibility changes are not forwarded.
- Worker errors are logged but not surfaced to callers.
- There is no `send` method for render commands.
- `terminate` is available, but the public facade does not expose a clear close contract.

### `index.js`

- Pool instances are cached forever.
- There is no `close(script)` for one pool.
- There is no `clear()` for all pools.
- The facade does not expose dedicated worker creation directly.
- Docs, tests, and types are out of sync with runtime behavior.

---

## 4. Architecture

The module should enforce these principles from the notes:

1. The main thread is for UI and coordination.
2. Dedicated workers own task computation.
3. Shared workers own persistent same-origin coordination.
4. Service workers remain in `core.offline` and `src/sw`, but `core.workers` should provide safe message patterns where needed.
5. Broadcast channels inform other contexts that something happened.
6. Web Locks prevent other contexts from doing something concurrently.
7. OffscreenCanvas moves render loops away from the main thread.
8. Every request-response path uses `MessageChannel`.
9. Large binary payloads use transferables.
10. `SharedArrayBuffer` is optional and only enabled when `crossOriginIsolated` is true.

---

## 5. Message Contract

Worker requests should use plain data only:

```javascript
{
  task,
  payload,
  meta
}
```

Worker responses should be consistent:

```javascript
{
  ok,
  value,
  error
}
```

Rules:

- `ok: true` resolves with `value`.
- `ok: false` rejects with `error`.
- `error` must be serializable.
- Functions, DOM nodes, class instances, symbols, and weak references must not cross the worker boundary.
- Transferables should be passed explicitly.
- Transfer ownership must be documented because the sender loses access after transfer.

---

## 6. Implementation Phases

### Phase 1: Contract

- [ ] Define the request and response shape in `dedicated.js`.
- [ ] Accept `signal`, `timeout`, `transferables`, and `meta` in one `options` object.
- [ ] Keep the existing positional `run(task, payload, transferables)` path as a compatibility bridge.
- [ ] Normalize internal names: `script`, `name`, `item`, `payload`, `port`, `timer`.
- [ ] Update `types/core/workers/index.d.ts` to match runtime behavior.

### Phase 2: Dedicated

- [ ] Add abort support before and during a request.
- [ ] Add timeout support.
- [ ] Close both message ports on success, error, abort, timeout, and deserialization failure.
- [ ] Track pending requests so worker-level `error` can reject them.
- [ ] Add `closed` state after `terminate`.
- [ ] Add tests for success, worker error, message error, abort, timeout, and transferables.

### Phase 3: Pool

- [ ] Enforce `signal` and `timeout` while a task is queued.
- [ ] Remove queued tasks when aborted before execution.
- [ ] Add an idle timer that terminates workers after inactivity.
- [ ] Add `pagehide` cleanup for all pools.
- [ ] Add a maximum size option.
- [ ] Add fair priority scheduling so background work cannot starve forever.
- [ ] Add an `idempotent` option for safe requeue after worker crash.
- [ ] Add tests for cancellation, idle cleanup, crash recovery, and fairness.

### Phase 4: Shared

- [ ] Align runtime with types: `send`, `subscribe`, and `close`.
- [ ] Add aliases only if needed: `postMessage` to `send`, `onMessage` to `subscribe`.
- [ ] Track `connected` and `closed` states.
- [ ] Make fallback behavior match the same subscribe/send contract.
- [ ] Isolate listener errors in both normal and fallback modes.
- [ ] Add optional reconnect.
- [ ] Document when to use SharedWorker instead of BroadcastChannel.
- [ ] Add tests for native mode, fallback mode, close, and listener cleanup.

### Phase 5: Broadcast

- [ ] Remove abort listeners during manual disposal.
- [ ] Add `close(name)` for one channel.
- [ ] Add `clear()` for all channels.
- [ ] Add `messageerror` handling.
- [ ] Confirm one-shot broadcast delivery before closing the temporary channel.
- [ ] Add tests for subscribe, abort cleanup, disposal, close, clear, and message errors.

### Phase 6: Locks

- [ ] Support `mode`, `signal`, `timeout`, `ifAvailable`, and `steal`.
- [ ] Combine caller abort and timeout into one signal.
- [ ] Preserve abort reasons where possible.
- [ ] Add same-tab fallback queuing when Web Locks are missing.
- [ ] Document lock name conventions:

```text
idb:store
opfs:file
auth:refresh
sync:leader
cache:name
```

- [ ] Add tests for shared mode, exclusive mode, timeout, abort, try-lock, and fallback ordering.

### Phase 7: Offscreen

- [ ] Add a ready handshake after transfer.
- [ ] Add `send(payload, transferables)` for render commands.
- [ ] Forward resize and device pixel ratio updates.
- [ ] Surface worker errors to callers.
- [ ] Add `close()` as the primary lifecycle verb and keep `terminate()` as an alias.
- [ ] Add tests for unsupported environments, transfer success, ready, send, resize, error, and close.

### Phase 8: Facade

- [ ] Add `workers.close(script)` to terminate one pool.
- [ ] Add `workers.clear()` to terminate all pools and close broadcasts.
- [ ] Consider `workers.dedicated(script)` for direct dedicated worker creation.
- [ ] Keep `workers.run` as the main task-pool entry.
- [ ] Keep exports stable until a major release can remove compatibility names.

### Phase 9: Docs

- [ ] Update `docs/core/workers/index.md`.
- [ ] Add worker script examples for request-response handling.
- [ ] Document transferables and sender ownership loss.
- [ ] Document when to use each primitive:

| Need | Use |
|---|---|
| CPU task | `workers.run` |
| One tab-owned worker | `DedicatedWorker` |
| Shared socket or rate limit | `workers.shared` |
| Cross-tab event | `workers.broadcast` |
| Cross-tab mutex | `workers.lock` |
| Canvas render loop | `workers.offscreen` |

### Phase 10: Verification

- [ ] Run `npm test -- --files tests/core/workers/*.test.js` if supported by the runner.
- [ ] Run the full worker test group.
- [ ] Run existing storage and offline tests because they depend on worker patterns.
- [ ] Confirm declarations compile for `types/core/workers/index.d.ts`.
- [ ] Add browser checks for SharedWorker, BroadcastChannel, Web Locks, and OffscreenCanvas.

---

## 7. Test Matrix

| File | Coverage |
|---|---|
| `dedicated.test.js` | run, abort, timeout, error, messageerror, transfer |
| `pool.test.js` | priority, fairness, abort, timeout, idle, crash, clear |
| `shared.test.js` | connect, send, subscribe, fallback, close |
| `broadcast.test.js` | broadcast, subscribe, dispose, abort, close, clear |
| `locks.test.js` | exclusive, shared, timeout, abort, ifAvailable, fallback |
| `offscreen.test.js` | support, transfer, ready, resize, send, close |
| `index.test.js` | facade, pool reuse, close, clear |

---

## 8. Runtime Checks

Every feature should gate itself:

```javascript
const has = {
  worker: typeof Worker !== 'undefined',
  shared: typeof SharedWorker !== 'undefined',
  channel: typeof BroadcastChannel !== 'undefined',
  locks: typeof navigator !== 'undefined' && !!navigator.locks,
  offscreen: typeof OffscreenCanvas !== 'undefined',
  isolated: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
};
```

Rules:

- Missing Worker support should reject with a clear error.
- Missing SharedWorker support should fall back to a compatible local worker where possible.
- Missing BroadcastChannel support should degrade silently only for optional notifications.
- Missing Web Locks should use same-tab fallback locking.
- Missing OffscreenCanvas should return a handle that reports unsupported state.
- SharedArrayBuffer paths must require `isolated`.

---

## 9. Security

- Never pass DOM nodes, functions, or class instances to workers.
- Validate task names before dispatch if a worker script supports multiple tasks.
- Treat worker messages as untrusted input.
- Keep worker scripts as module workers.
- Avoid `importScripts`.
- Do not enable SharedArrayBuffer paths unless `crossOriginIsolated` is true.
- Route unhandled worker errors to the application error pipeline when one exists.

---

## 10. Performance

- Use transferables for large `ArrayBuffer`, `ImageBitmap`, `OffscreenCanvas`, streams, `AudioData`, and `VideoFrame`.
- Avoid cloning large payloads.
- Keep pool creation lazy.
- Reserve at least one logical core for the main thread.
- Reclaim idle workers.
- Prefer `pagehide` for shutdown hooks.
- Avoid unbounded queues.
- Add observable queue length and active count for diagnostics.

---

## 11. Done

The worker module is complete when:

- Public API, docs, tests, and declarations agree.
- Every subscription and port has deterministic cleanup.
- Abort and timeout work consistently across dedicated, pool, shared, broadcast, lock, and offscreen flows.
- Pool workers are lazy, bounded, cancellable, and reclaimed.
- Shared worker fallback is predictable.
- Broadcast channels close when unused.
- Locks coordinate same-origin work and have a same-tab fallback.
- OffscreenCanvas has a ready, send, resize, and close lifecycle.
- Worker errors are visible to callers.
- The main thread stays responsible for UI while heavy work moves to workers.
