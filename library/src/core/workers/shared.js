/**
 * src/core/workers/shared.js
 *
 * SharedWorker Lifecycle Wrapper.
 * Public surface: connect(), send(), subscribe(fn, signal), close()
 * Falls back to a Dedicated Worker when SharedWorker is unavailable.
 * Isolates listener errors in both modes.
 *
 * Source: plan.md Phase 4
 */

export class Shared {
  #script;
  #name;
  #port = null;
  #listeners = new Set();
  #connected = false;
  #closed = false;

  /**
   * @param {string} script - SharedWorker script URL
   * @param {string} [name] - Named shared worker instance key
   */
  constructor(script, name = 'native-shared') {
    this.#script = script;
    this.#name = name;
  }

  get connected() { return this.#connected; }
  get closed() { return this.#closed; }

  /**
   * Opens the port to the SharedWorker (or dedicated fallback).
   * Safe to call multiple times; subsequent calls are no-ops.
   */
  connect() {
    if (this.#connected || this.#closed) return;

    if (typeof SharedWorker !== 'undefined') {
      try {
        const worker = new SharedWorker(this.#script, {
          name: this.#name,
          type: 'module'
        });

        this.#port = worker.port;
        this.#port.onmessage = (e) => this.#dispatch(e.data);
        this.#port.onmessageerror = (e) => {
          console.error('SharedWorker message deserialization error:', e);
        };
        this.#port.start();
        this.#connected = true;
        return;
      } catch (err) {
        console.warn(`SharedWorker "${this.#script}" failed, using dedicated fallback:`, err);
      }
    }

    this.#fallback();
  }

  #fallback() {
    try {
      const worker = new Worker(this.#script, { type: 'module' });

      // Wrap dedicated worker as a port-compatible object
      this.#port = {
        postMessage: (msg, transfer) => worker.postMessage(msg, transfer),
        close: () => worker.terminate()
      };

      worker.onmessage = (e) => this.#dispatch(e.data);
      worker.onmessageerror = (e) => {
        console.error('Fallback worker message deserialization error:', e);
      };
      this.#connected = true;
    } catch (err) {
      console.error(`Cannot start worker "${this.#script}":`, err);
    }
  }

  #dispatch(data) {
    for (const fn of this.#listeners) {
      try {
        fn(data);
      } catch (err) {
        console.error('Error in Shared subscriber:', err);
      }
    }
  }

  /** Send a message to the shared worker. */
  send(message, transferables = []) {
    if (this.#closed) return;
    if (!this.#connected) this.connect();
    this.#port?.postMessage(message, transferables);
  }

  /**
   * Subscribe to messages from the shared worker.
   * Returns a dispose function.
   *
   * @param {Function} fn
   * @param {AbortSignal} [signal]
   */
  subscribe(fn, signal) {
    if (this.#closed) return () => {};
    if (signal?.aborted) return () => {};

    this.#listeners.add(fn);

    const dispose = () => this.#listeners.delete(fn);

    if (signal) {
      signal.addEventListener('abort', dispose, { once: true });
    }

    return dispose;
  }

  /** Close the port and release all listeners. */
  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#connected = false;
    this.#listeners.clear();
    try { this.#port?.close?.(); } catch { /* best-effort */ }
    this.#port = null;
  }

  // Compatibility aliases
  postMessage(msg, transfer) { return this.send(msg, transfer); }
  onMessage(fn, signal) { return this.subscribe(fn, signal); }
}

// Compatibility alias
export { Shared as SharedConnection };
