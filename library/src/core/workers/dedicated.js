/**
 * src/core/workers/dedicated.js
 *
 * Dedicated Worker Wrapper.
 * Manages the lifecycle of standard background dedicated Workers, using
 * native MessageChannel per request for isolated, concurrent execution corridors
 * without message cross-contamination.
 *
 * Message contract:
 *   Request  → { task, payload, meta }
 *   Response → { ok, value, error }
 *
 * Source: plan.md Phase 1, Phase 2
 */

export class Dedicated {
  #script;
  #worker;
  #pending = new Map(); // port1 → { resolve, reject, timer }
  #closed = false;

  constructor(script) {
    this.#script = script;
    this.#worker = new Worker(script, { type: 'module' });
    this.#worker.addEventListener('error', (e) => this.#fail(e));
    this.#worker.addEventListener('messageerror', (e) => this.#fail(e));
  }

  get closed() { return this.#closed; }

  /**
   * Dispatches a task to the worker.
   *
   * Options:
   *   payload       – data to send (structured-clone safe)
   *   transferables – Transferable[] transferred with the message
   *   signal        – AbortSignal to cancel the request
   *   timeout       – milliseconds before automatic abort
   *   meta          – arbitrary structured data attached to the request
   */
  run(task, options = {}) {
    if (this.#closed) {
      return Promise.reject(new Error(`Worker "${this.#script}" is closed`));
    }

    const {
      payload = null,
      transferables = [],
      signal,
      timeout,
      meta
    } = options;

    // Abort before anything starts
    if (signal?.aborted) {
      return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();

      // Combine caller signal and optional timeout into one controller
      let combined = null;
      let timer = null;

      if (signal || timeout) {
        combined = new AbortController();

        if (signal) {
          if (signal.aborted) {
            combined.abort(signal.reason);
          } else {
            signal.addEventListener('abort', () => combined.abort(signal.reason), { once: true });
          }
        }

        if (timeout) {
          timer = setTimeout(
            () => combined.abort(new Error(`Worker task "${task}" timed out after ${timeout}ms`)),
            timeout
          );
        }
      }

      const abort = combined?.signal;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        channel.port1.close();
        this.#pending.delete(channel.port1);
      };

      const fail = (reason) => {
        cleanup();
        reject(reason);
      };

      this.#pending.set(channel.port1, { resolve, reject: fail });

      channel.port1.onmessage = (e) => {
        const { ok, value, error } = e.data;
        cleanup();
        if (ok) {
          resolve(value);
        } else {
          reject(new Error(error ?? 'Worker task failed'));
        }
      };

      channel.port1.onmessageerror = () => {
        fail(new Error('Deserialization error on message channel'));
      };

      if (abort) {
        abort.addEventListener('abort', () => {
          fail(abort.reason ?? new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }

      this.#worker.postMessage(
        { task, payload, meta, port: channel.port2 },
        [channel.port2, ...transferables]
      );
    });
  }

  /** Route a worker-level error into all pending requests. */
  #fail(event) {
    const reason = event instanceof ErrorEvent
      ? new Error(event.message ?? 'Worker error')
      : new Error('Worker message deserialization error');

    for (const { reject } of this.#pending.values()) {
      reject(reason);
    }
    this.#pending.clear();
  }

  /** Terminate the worker. Subsequent `run` calls will reject immediately. */
  terminate() {
    if (this.#closed) return;
    this.#closed = true;
    this.#worker.terminate();
    const reason = new Error(`Worker "${this.#script}" terminated`);
    for (const { reject } of this.#pending.values()) {
      reject(reason);
    }
    this.#pending.clear();
  }
}

// Compatibility alias
export { Dedicated as DedicatedWorker };
