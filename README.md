# Anza

> The browser already knows how to render, route, cache, and animate. We just stopped getting in its way.

Anza gives the browser a gentle nudge — reactive state, view transitions, offline caching, and custom elements without a build step. Just import and ship.

## Structure

| Folder | Contents |
| ------ | -------- |
| `library/` | Runtime library and custom elements (`@adukiorg/anza`) |
| `tools/` | Rust CLI for dev server, build, and type extraction |
| `tasks/` | Repo automation scripts |
| `docs/` | Full documentation |

## Workers

The workers module (`@adukiorg/anza/workers`) provides a unified API for web workers:

- **Dedicated workers** — Raw workers and pooled task execution with priority queues
- **Shared workers** — Cross-tab worker connections with automatic fallback
- **Web Locks** — Named locks for cross-tab coordination
- **BroadcastChannel** — Fire-and-forget cross-tab messaging
- **OffscreenCanvas** — Off-main-thread rendering

```js
import { workers } from '@adukiorg/anza/workers';

// Run a task in a worker pool
await workers.run('/worker.js', 'process', { payload: data });

// Create a dedicated worker
const worker = workers.dedicated('/worker.js');

// Shared worker across tabs
const shared = workers.shared('/shared.js', 'my-app');

// Web Lock for coordination
await workers.lock('resource', async () => {
  // Critical section
});

// Cross-tab broadcast
workers.broadcast('updates', { type: 'refresh' });
```

## Build

The CLI is a Rust binary. To compile it:

```bash
node tasks/build.js
```

This writes the release binary to `tools/target/release/anza`.

## Develop

```bash
cd library
npm install
npm test     # real-browser tests via @web/test-runner
```

## License

[MIT](./LICENSE) © 2026 Aduki
