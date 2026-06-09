/**
 * src/core/workers/locks.js
 *
 * Web Locks API Facade.
 * Provides exclusive or shared operational execution blocks with AbortSignal
 * and timeout controls. Combines caller signal + timeout into a single signal.
 * Exposes ifAvailable and steal modes. Falls back to a same-tab queue when
 * the Web Locks API is unavailable.
 *
 * Lock name conventions:
 *   idb:<store>      – IndexedDB store access
 *   opfs:<file>      – Origin Private File System file
 *   auth:<op>        – Authentication operation (e.g. auth:refresh)
 *   sync:<role>      – Background sync (e.g. sync:leader)
 *   cache:<name>     – Cache invalidation (e.g. cache:avatar)
 *
 * Source: plan.md Phase 6
 */

// Same-tab fallback queue when Web Locks API is absent.
// Maps lock name → Promise chain (exclusive, ordered).
const fallbackQueue = new Map();

/**
 * Acquires a named lock and executes `fn` within it.
 *
 * @param {string}   name        Lock name (see conventions above)
 * @param {Function} fn          Async callback to execute while holding the lock
 * @param {object}   [options]
 * @param {AbortSignal} [options.signal]      External abort signal
 * @param {'exclusive'|'shared'} [options.mode='exclusive']
 * @param {number}   [options.timeout]        ms before acquisition times out
 * @param {boolean}  [options.ifAvailable]    Acquire only if lock is immediately available
 * @param {boolean}  [options.steal]          Forcibly pre-empt any existing holder
 * @returns {Promise<any>}
 */
export async function lock(name, fn, options = {}) {
  const { signal, mode = 'exclusive', timeout, ifAvailable = false, steal = false } = options;

  // -- Same-tab fallback --
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return _fallback(name, fn, { signal, timeout, ifAvailable });
  }

  // -- Combine signal + timeout --
  let controller = null;
  let timer = null;

  if (signal || timeout) {
    controller = new AbortController();

    if (signal) {
      if (signal.aborted) {
        controller.abort(signal.reason);
      } else {
        signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
      }
    }

    if (timeout) {
      timer = setTimeout(() => {
        const reason = new Error(`Lock "${name}" acquisition timed out after ${timeout}ms`);
        reason.name = 'TimeoutError';
        controller.abort(reason);
      }, timeout);
    }
  }

  const active = controller?.signal ?? undefined;

  const requestOpts = { mode, signal: active };
  if (ifAvailable) requestOpts.ifAvailable = true;
  if (steal) requestOpts.steal = true;

  try {
    return await navigator.locks.request(name, requestOpts, async (acquired) => {
      // ifAvailable returns null when the lock is not immediately grantable
      if (acquired === null) {
        throw new DOMException(`Lock "${name}" is not available`, 'NotAllowedError');
      }
      return await fn();
    });
  } catch (err) {
    // Rethrow AbortError with the original abort reason when present
    if (err.name === 'AbortError' && active?.aborted) {
      throw active.reason ?? err;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Same-tab mutual exclusion fallback (no Web Locks API).
 * Uses a promise chain to serialise callbacks for each lock name.
 * Does not support shared mode (all locks are exclusive in fallback).
 */
async function _fallback(name, fn, { signal, timeout, ifAvailable } = {}) {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }

  if (ifAvailable) {
    // In fallback mode we cannot check availability — always treat as unavailable
    // when there is already an active chain for this name.
    if (fallbackQueue.has(name)) {
      throw new DOMException(`Lock "${name}" is not available (fallback)`, 'NotAllowedError');
    }
  }

  const prior = fallbackQueue.get(name) ?? Promise.resolve();

  let resolveChain;
  const link = new Promise((res) => { resolveChain = res; });
  fallbackQueue.set(name, prior.then(() => link));

  let timer = null;
  let controller = null;

  if (signal || timeout) {
    controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }
    if (timeout) {
      timer = setTimeout(() => {
        const r = new Error(`Lock "${name}" acquisition timed out after ${timeout}ms`);
        r.name = 'TimeoutError';
        controller.abort(r);
      }, timeout);
    }
  }

  const combined = controller?.signal;

  try {
    // Wait for the chain, but bail early if aborted while queued
    await Promise.race([
      prior,
      ...(combined
        ? [new Promise((_, rej) => combined.addEventListener('abort', () => rej(combined.reason), { once: true }))]
        : [])
    ]);

    if (combined?.aborted) {
      throw combined.reason ?? new DOMException('Aborted', 'AbortError');
    }

    return await fn();
  } finally {
    if (timer) clearTimeout(timer);
    resolveChain();
    // Clean up the map when the chain is idle
    const remaining = fallbackQueue.get(name);
    if (remaining === prior.then(() => link)) {
      fallbackQueue.delete(name);
    }
  }
}
