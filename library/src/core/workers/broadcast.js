/**
 * src/core/workers/broadcast.js
 *
 * BroadcastChannel Manager.
 * Reference-counted channels: open on first subscriber, close when the last
 * subscriber leaves. Supports explicit close(name) and clear() for lifecycle
 * control. Cleans up both the message listener and the abort listener on
 * disposal to prevent memory leaks.
 *
 * Source: plan.md Phase 5
 */

class BroadcastManager {
  #channels = new Map();  // name → BroadcastChannel
  #listeners = new Map(); // name → Set<{ wrapped, fn, abortCleanup }>

  /**
   * Dispatches a message to a named channel.
   *
   * BroadcastChannel messages are NOT echoed to the posting instance — only
   * other channel instances with the same name receive them. So we always post
   * from a short-lived peer channel and close it immediately. This correctly
   * delivers to all subscriber channel instances, including the one managed
   * by this BroadcastManager.
   *
   * @param {string} name
   * @param {any}    payload
   */
  broadcast(name, payload) {
    // Always use a peer sender so the subscriber channel receives the message.
    // (A BroadcastChannel instance never fires its own onmessage for messages it posts.)
    const sender = new BroadcastChannel(name);
    sender.postMessage(payload);
    // Close asynchronously to allow same-process delivery before cleanup.
    setTimeout(() => sender.close(), 0);
  }

  /**
   * Subscribes to a named channel.
   * Returns a dispose function that removes the listener and cleans up the
   * abort listener.
   *
   * @param {string}      name
   * @param {Function}    fn
   * @param {AbortSignal} [signal]
   * @returns {() => void} dispose
   */
  subscribe(name, fn, signal) {
    if (signal?.aborted) return () => {};

    // Open channel on first subscriber
    if (!this.#channels.has(name)) {
      const ch = new BroadcastChannel(name);
      ch.onmessageerror = (e) => {
        console.error(`BroadcastChannel "${name}" deserialization error:`, e);
      };
      this.#channels.set(name, ch);
      this.#listeners.set(name, new Set());
    }

    const channel = this.#channels.get(name);
    const group = this.#listeners.get(name);

    const wrapped = (event) => {
      try {
        fn(event.data);
      } catch (err) {
        console.error(`Error in BroadcastChannel "${name}" subscriber:`, err);
      }
    };

    channel.addEventListener('message', wrapped);

    let abortCleanup = null;
    const entry = { wrapped, fn, abortCleanup };
    group.add(entry);

    const dispose = () => {
      channel.removeEventListener('message', wrapped);
      group.delete(entry);

      // Remove the abort listener we registered
      if (entry.abortCleanup) {
        signal?.removeEventListener('abort', entry.abortCleanup);
        entry.abortCleanup = null;
      }

      // Auto-close when no listeners remain
      if (group.size === 0) {
        channel.close();
        this.#channels.delete(name);
        this.#listeners.delete(name);
      }
    };

    if (signal) {
      const onAbort = () => dispose();
      entry.abortCleanup = onAbort;
      signal.addEventListener('abort', onAbort, { once: true });
    }

    return dispose;
  }

  /**
   * Closes one named channel and removes all its listeners.
   *
   * @param {string} name
   */
  close(name) {
    const channel = this.#channels.get(name);
    if (!channel) return;

    const group = this.#listeners.get(name) ?? new Set();
    for (const entry of group) {
      channel.removeEventListener('message', entry.wrapped);
      if (entry.abortCleanup) {
        // We don't have the signal reference here, so just null the cleanup
        entry.abortCleanup = null;
      }
    }

    channel.close();
    this.#channels.delete(name);
    this.#listeners.delete(name);
  }

  /**
   * Closes all open channels and removes all listeners.
   */
  clear() {
    for (const name of [...this.#channels.keys()]) {
      this.close(name);
    }
  }
}

export const broadcast = new BroadcastManager();
