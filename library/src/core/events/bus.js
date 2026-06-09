/**
 * src/core/events/bus.js
 *
 * Global Event Bus.
 * Extends the native EventTarget for engine-optimized listener dispatch.
 * Preserves backward-compatible .on() and .emit() wrapper methods while
 * exposing the full native addEventListener / dispatchEvent interface.
 *
 * Source: doc 10 — Event Architecture §9
 */

export class EventBus extends EventTarget {
  /**
   * Subscribes to a global event.
   * If a signal is provided, the subscription is automatically cleaned up when the signal aborts.
   * Returns a disposer function for manual cleanup.
   */
  on(type, fn, signal) {
    if (signal?.aborted) return () => {};

    this.addEventListener(type, fn, { signal });

    const dispose = () => {
      this.removeEventListener(type, fn);
    };

    return dispose;
  }

  /**
   * Dispatches a global custom event with a detail payload.
   */
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export const bus = new EventBus();
