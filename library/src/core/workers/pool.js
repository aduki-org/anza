/**
 * src/core/workers/pool.js
 *
 * Dedicated Worker Pool.
 * Bounded by a configurable max (default: hardwareConcurrency - 1, min 2).
 * Priority queue: user-blocking > user-visible > background with anti-starvation
 * counter so background work cannot wait forever.
 *
 * Source: plan.md Phase 3
 */

import { Dedicated } from './dedicated.js';

// Numeric priority levels
const LEVEL = { 'user-blocking': 2, 'user-visible': 1, background: 0 };

// Starvation prevention: a background task gets promoted after this many
// higher-priority tasks have run ahead of it.
const STARVATION_LIMIT = 20;

export class Pool {
  #script;
  #max;
  #idle;
  #workers = [];
  #queue = [];
  #inited = false;
  #closed = false;
  #idleMs;

  /**
   * @param {string} script  - Worker script URL
   * @param {object} [opts]
   * @param {number} [opts.size]    - Initial pool size
   * @param {number} [opts.max]     - Maximum pool size (≥ size)
   * @param {number} [opts.idle]    - Idle timeout in ms before a worker is reclaimed (0 = never)
   */
  constructor(script, opts = {}) {
    const cores = navigator.hardwareConcurrency || 2;
    const defaultSize = Math.max(2, cores - 1);

    this.#script = script;
    this.#max = Math.max(opts.max ?? opts.size ?? defaultSize, 1);
    this.#idle = opts.idle ?? 30_000; // 30 s default
    this.#inited = false;

    // Shutdown on page hide — covers both BFCache restores and actual unloads
    addEventListener('pagehide', () => this.terminate(), { once: true });
  }

  get size() { return this.#workers.length; }
  get pending() { return this.#queue.length; }

  #spawn() {
    const w = {
      instance: new Dedicated(this.#script),
      busy: false,
      timer: null
    };
    this.#workers.push(w);
    return w;
  }

  #init() {
    if (this.#inited) return;
    this.#inited = true;
    // Spawn at least one worker eagerly; the rest are lazy
    this.#spawn();
  }

  /**
   * Queues a task with priority scheduling.
   *
   * Options (TaskOptions):
   *   payload       – structured-clone data
   *   transferables – Transferable[]
   *   signal        – AbortSignal
   *   timeout       – ms to cancel while queued or running
   *   priority      – 'user-blocking' | 'user-visible' | 'background'
   *   idempotent    – if true, requeue on worker crash
   *   meta          – arbitrary metadata for the worker
   */
  run(task, options = {}) {
    if (this.#closed) {
      return Promise.reject(new Error(`Pool "${this.#script}" is closed`));
    }

    const {
      payload = null,
      transferables = [],
      signal,
      timeout,
      priority: priorityStr = 'user-visible',
      idempotent = false,
      meta
    } = options;

    const level = LEVEL[priorityStr] ?? 1;

    // Already-aborted signals are rejected immediately
    if (signal?.aborted) {
      return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }

    this.#init();

    return new Promise((resolve, reject) => {
      // Combine caller signal + optional timeout while task is queued OR running
      let controller = null;
      let timer = null;

      if (signal || timeout) {
        controller = new AbortController();

        if (signal) {
          signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
        }
        if (timeout) {
          timer = setTimeout(
            () => controller.abort(new Error(`Pool task "${task}" timed out after ${timeout}ms`)),
            timeout
          );
        }
      }

      const combined = controller?.signal;

      const item = {
        task,
        payload,
        transferables,
        signal: combined,
        meta,
        idempotent,
        level,
        waited: 0,       // starvation counter
        resolve: (v) => { if (timer) clearTimeout(timer); resolve(v); },
        reject: (e) => { if (timer) clearTimeout(timer); reject(e); },
        cancelled: false
      };

      // Cancel while still queued
      if (combined) {
        combined.addEventListener('abort', () => {
          item.cancelled = true;
          item.reject(combined.reason ?? new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }

      this.#enqueue(item);
      this.#next();
    });
  }

  #enqueue(item) {
    this.#queue.push(item);
    // Sort ascending so pop() returns highest priority.
    // Secondary: lower waited = lower index = pop'd later (oldest high-priority runs first).
    this.#queue.sort((a, b) => {
      const ea = this.#effective(a);
      const eb = this.#effective(b);
      return ea - eb; // ascending; pop() gives highest
    });
  }

  /** Effective priority with starvation compensation */
  #effective(item) {
    const boost = Math.floor(item.waited / STARVATION_LIMIT);
    return Math.min(item.level + boost, 2);
  }

  #next() {
    if (this.#queue.length === 0) return;

    // Find an idle worker
    let slot = this.#workers.find((w) => !w.busy && !w.instance.closed);

    // Spawn a new one if under max
    if (!slot && this.#workers.length < this.#max) {
      slot = this.#spawn();
    }

    if (!slot) return;

    // Increment waited counter for items that will stay in queue
    for (const item of this.#queue) item.waited++;

    // Dequeue the highest-priority item (last after sort)
    const item = this.#queue.pop();

    // Skip if already cancelled while queued
    if (item.cancelled) {
      this.#next(); // try the next item
      return;
    }

    this.#cancelIdleTimer(slot);
    slot.busy = true;

    slot.instance
      .run(item.task, {
        payload: item.payload,
        transferables: item.transferables,
        signal: item.signal,
        meta: item.meta
      })
      .then(item.resolve)
      .catch((err) => {
        if (item.idempotent && !item.signal?.aborted && !slot.instance.closed) {
          // Safe to requeue for one retry
          item.waited = 0;
          this.#enqueue(item);
        } else {
          item.reject(err);
        }

        // Recycle crashed worker
        if (slot.instance.closed || err?.message?.includes('terminated')) {
          try { slot.instance.terminate(); } catch { /* already gone */ }
          slot.instance = new Dedicated(this.#script);
        }
      })
      .finally(() => {
        slot.busy = false;
        this.#startIdleTimer(slot);
        this.#next();
      });
  }

  #startIdleTimer(slot) {
    if (!this.#idle || this.#workers.length <= 1) return;
    slot.timer = setTimeout(() => {
      if (!slot.busy) {
        slot.instance.terminate();
        this.#workers = this.#workers.filter((w) => w !== slot);
      }
    }, this.#idle);
  }

  #cancelIdleTimer(slot) {
    if (slot.timer) {
      clearTimeout(slot.timer);
      slot.timer = null;
    }
  }

  /** Terminates all workers and clears the queue. */
  terminate() {
    if (this.#closed) return;
    this.#closed = true;

    const reason = new Error(`Pool "${this.#script}" terminated`);
    for (const item of this.#queue) {
      if (!item.cancelled) item.reject(reason);
    }
    this.#queue = [];

    for (const w of this.#workers) {
      this.#cancelIdleTimer(w);
      try { w.instance.terminate(); } catch { /* already gone */ }
    }
    this.#workers = [];
  }
}

// Compatibility alias
export { Pool as WorkerPool };
