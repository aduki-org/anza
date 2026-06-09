# Scheduling

Cooperative task scheduling for main-thread-friendly work. Prevents long tasks that hurt Interaction to Next Paint (INP).

---

## schedule

```javascript
import { ui } from '@adukiorg/anza/ui';

ui.schedule(() => {
  renderChunk();
}, ui.Priority.VISIBLE);
```

Priorities:

| Priority | Fallback Latency | Use Case |
| ---------- | ----------------- | ---------- |
| `BLOCKING` | 0ms | Critical path work |
| `VISIBLE` | 16ms | UI updates |
| `BACKGROUND` | `requestIdleCallback` | Offscreen work |

Uses `scheduler.postTask` when available, falling back to `setTimeout` or `requestIdleCallback`.

---

## scheduleFrame

Run during the next `requestAnimationFrame`:

```javascript
ui.scheduleFrame(() => {
  measureLayout();
}).then(() => {
  applyStyles();
});
```

Returns a promise that resolves with the callback's return value.

---

## yield

Yield control to the browser mid-task:

```javascript
import { ui } from '@adukiorg/anza/ui';

async function processLargeDataset(rows) {
  for (const row of rows) {
    process(row);
    if (rows.indexOf(row) % 100 === 0) {
      await ui.yield(); // let the browser breathe
    }
  }
}
```

Uses `scheduler.yield()` when available, falling back to `setTimeout(..., 0)`.

---

## When to Use Each

- **`schedule()`** — defer non-critical work: analytics, logging, non-urgent rendering
- **`scheduleFrame()`** — layout measurement, animation frame work, visual updates
- **`yield()`** — chunk heavy computation inside loops

---

## Example: Chunked Rendering

```javascript
view('data-grid', {
  props: {
    rows: { type: Array, default: [] }
  },
  on: {
    async change({ name, val, refs }) {
      if (name !== 'rows') return;

      refs.body.innerHTML = '';
      const chunkSize = 50;

      for (let i = 0; i < val.length; i += chunkSize) {
        const chunk = val.slice(i, i + chunkSize);
        const fragment = document.createDocumentFragment();
        for (const row of chunk) {
          fragment.appendChild(createRow(row));
        }
        refs.body.appendChild(fragment);
        await ui.yield();
      }
    }
  }
});
```

The grid renders in chunks, yielding between each so the browser stays responsive.
