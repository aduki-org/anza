/**
 * src/core/workers/index.js
 *
 * Public workers entry point.
 * Aggregates dedicated, pooled, shared, broadcast, locking, and offscreen
 * primitives into a single unified public facade.
 *
 * Public API:
 *   workers.run(script, task, opts)      – pool task
 *   workers.dedicated(script)            – raw dedicated worker
 *   workers.shared(script, name)         – shared worker connection
 *   workers.lock(name, fn, opts)         – web lock
 *   workers.broadcast(name, payload)     – fire-and-forget broadcast
 *   workers.subscribe(name, fn, signal)  – channel subscription
 *   workers.offscreen(canvas, script, opts) – offscreen canvas
 *   workers.close(script)               – terminate one pool
 *   workers.clear()                     – terminate all pools + clear broadcasts
 *
 * Feature gates:
 *   has.worker, has.shared, has.channel, has.locks, has.offscreen, has.isolated
 *
 * Source: plan.md Phase 8
 */

import { Dedicated, DedicatedWorker } from './dedicated.js';
import { Pool, WorkerPool } from './pool.js';
import { Shared, SharedConnection } from './shared.js';
import { broadcast } from './broadcast.js';
import { lock } from './locks.js';
import { offscreen, Offscreen, OffscreenHandle } from './offscreen.js';

/** Runtime feature detection */
export const has = {
  worker: typeof Worker !== 'undefined',
  shared: typeof SharedWorker !== 'undefined',
  channel: typeof BroadcastChannel !== 'undefined',
  locks: typeof navigator !== 'undefined' && !!navigator.locks,
  offscreen: typeof OffscreenCanvas !== 'undefined',
  isolated: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
};

// Pool registry — one pool per script URL
const pools = new Map();

export const workers = {
  /**
   * Runs a prioritized CPU-bound task in a lazily allocated dedicated worker pool.
   *
   * @param {string} script - Worker script URL
   * @param {string} task   - Task name
   * @param {object} [opts] - TaskOptions: payload, priority, signal, timeout, transferables, meta
   */
  run(script, task, opts = {}) {
    if (!has.worker) {
      return Promise.reject(new Error('Web Workers are not available in this environment'));
    }
    if (!pools.has(script)) {
      pools.set(script, new Pool(script, opts));
    }
    return pools.get(script).run(task, opts);
  },

  /**
   * Creates a raw Dedicated worker (not pooled).
   * Use this when you need a single long-lived worker with direct control.
   *
   * @param {string} script
   * @returns {Dedicated}
   */
  dedicated(script) {
    if (!has.worker) {
      throw new Error('Web Workers are not available in this environment');
    }
    return new Dedicated(script);
  },

  /**
   * Opens a connection to a SharedWorker (or dedicated fallback).
   *
   * @param {string} script
   * @param {string} [name]
   * @returns {Shared}
   */
  shared(script, name) {
    const connection = new Shared(script, name);
    connection.connect();
    return connection;
  },

  /**
   * Acquires a named Web Lock and executes `fn` within it.
   * See locks.js for lock name conventions and option details.
   */
  lock,

  /**
   * Sends a message to a named BroadcastChannel.
   *
   * @param {string} name
   * @param {any}    payload
   */
  broadcast(name, payload) {
    if (!has.channel) return; // degrade silently — optional cross-tab notification
    broadcast.broadcast(name, payload);
  },

  /**
   * Subscribes to messages on a named BroadcastChannel.
   * Returns a dispose function.
   *
   * @param {string}      name
   * @param {Function}    fn
   * @param {AbortSignal} [signal]
   */
  subscribe(name, fn, signal) {
    if (!has.channel) return () => {};
    return broadcast.subscribe(name, fn, signal);
  },

  /**
   * Transfers an HTMLCanvasElement to a worker for off-main-thread rendering.
   * Returns a Promise that resolves to an Offscreen handle after the ready
   * handshake completes.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {string}            script
   * @param {object}            [opts]
   */
  offscreen,

  /**
   * Terminates the pool for one script URL and removes it from the registry.
   *
   * @param {string} script
   */
  close(script) {
    const pool = pools.get(script);
    if (pool) {
      pool.terminate();
      pools.delete(script);
    }
  },

  /**
   * Terminates all pools and clears all broadcast channels.
   */
  clear() {
    for (const [script, pool] of pools) {
      pool.terminate();
      pools.delete(script);
    }
    broadcast.clear();
  }
};

export {
  Dedicated,
  Pool,
  Shared,
  Offscreen,
  broadcast,
  lock,
  offscreen,
  // Compatibility aliases
  DedicatedWorker,
  WorkerPool,
  SharedConnection,
  OffscreenHandle
};
