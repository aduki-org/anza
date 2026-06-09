/**
 * src/core/router/boot.js
 *
 * Deferred boot gate. Holds the router's initial route match until the DOM is
 * parsed and every registered prerequisite (custom element definitions, etc.)
 * has resolved. This is what makes a hard refresh on a deep route work: the
 * first match no longer races ahead of element registration.
 *
 * Source: tasks.md Phase 1
 */

// Outstanding prerequisites the initial match must wait for.
const gates = new Set();

// Resolved once the boot sequence has fired.
let booted = false;

// Pending trigger captured before boot ran, if any.
let trigger = null;

/**
 * Registers a prerequisite promise. The initial route match will not run until
 * all gates registered before boot have settled. Gates added after boot has
 * already fired are ignored (the page is already live).
 *
 * @param {Promise<any>} promise - prerequisite to await (e.g. whenDefined).
 * @returns {Promise<any>} the same promise, for chaining.
 */
export function gate(promise) {
  if (booted || !promise || typeof promise.then !== 'function') return promise;
  gates.add(promise);
  // Drop the gate once it settles so the set never grows unbounded.
  promise.then(() => gates.delete(promise), () => gates.delete(promise));
  return promise;
}

/**
 * Fires the initial route match once the document is interactive and all gates
 * have settled. Idempotent — only the first call wins.
 *
 * @param {() => any | Promise<any>} emitFn - runs the initial match + emit.
 */
export function boot(emitFn) {
  if (booted) return;
  trigger = emitFn;

  const launch = async () => {
    if (booted) return;
    // Snapshot current gates; settle them all (failures are non-fatal — a
    // single element that fails to define must not wedge the whole router).
    const pending = Array.from(gates);
    if (pending.length) {
      await Promise.allSettled(pending);
    }
    booted = true;
    const fn = trigger;
    trigger = null;
    if (fn) await fn();
  };

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { launch(); }, { once: true });
  } else {
    launch();
  }
}

/**
 * @returns {boolean} true once the boot sequence has completed.
 */
export function ready() {
  return booted;
}

/**
 * Resets boot state. Intended for test isolation and SSR teardown.
 */
export function reset() {
  gates.clear();
  booted = false;
  trigger = null;
}
