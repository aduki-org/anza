/**
 * src/core/router/intercept.js
 *
 * Core navigation interceptor loop.
 * Attaches listeners to the Navigation API 'navigate' event, evaluates security
 * guards, manages loading indicators, and performs updates wrapped in view transitions.
 *
 * Source: doc 09 — Routing §2, §5, §9, §13
 */

import { match } from './match.js';
import { transitions } from './transitions.js';
import { getContainer } from './container.js';
import { isCallback, runCallback } from './handler.js';
import { boot, reset as resetBoot } from './boot.js';
import { ensure } from './cascade.js';

let guards = [];
let notFoundHandler = null;
let ready = false;

// Module-level root slots — captured once in setup(), cleared in destroy().
let win   = null;
let shell = null;   // WeakRef<HTMLElement> — points to <main id="main">

/** Returns the live <main id="main"> element, or null if GC'd. */
export function getShell() { return shell?.deref() ?? null; }

/** Returns the captured window reference. */
export function getWin()   { return win; }

// Navigation API listener references for teardown
let navListener = null;
let successListener = null;
let errorListener = null;

const listeners = {
  found: new Set(),
  notfound: new Set(),
  error: new Set()
};

/**
 * Registers an event listener on the router.
 * Supported events: 'found', 'notfound', 'error'.
 * Returns a disposer. Supports auto-cleanup via AbortSignal.
 */
export function on(type, callback, signal) {
  if (!listeners[type]) return () => {};

  listeners[type].add(callback);

  const dispose = () => {
    listeners[type].delete(callback);
    signal?.removeEventListener('abort', dispose);
  };

  if (signal) {
    signal.addEventListener('abort', dispose, { once: true });
  }

  return dispose;
}

/**
 * Emits an event to registered router listeners.
 */
export function emit(type, detail) {
  if (!listeners[type]) return;
  for (const callback of Array.from(listeners[type])) {
    try {
      callback(detail);
    } catch (err) {
      console.error(`Error in router event listener for "${type}":`, err);
    }
  }
}

/**
 * Registers a global navigation guard. Returns a disposer.
 * Guards receive (destination, controller) and return a redirect URL if blocked,
 * or null/undefined to allow.
 */
export function addGuard(guardFn) {
  guards.push(guardFn);
  return () => {
    const idx = guards.indexOf(guardFn);
    if (idx !== -1) guards.splice(idx, 1);
  };
}

/** Grouped guard API. */
export const guardsApi = {
  add: addGuard,
  clear() { guards = []; }
};

/**
 * Sets the default handler for unmatched routes (404 page). Returns a disposer.
 */
export function setNotFound(handler) {
  notFoundHandler = handler;
  return () => {
    if (notFoundHandler === handler) notFoundHandler = null;
  };
}

/** Grouped miss API. */
export const missApi = {
  set: setNotFound,
  clear() { notFoundHandler = null; }
};

/**
 * Attaches the global window.navigation navigate listener.
 * Idempotent — safe to call multiple times.
 */
export function setup() {
  if (ready) return;
  if (typeof window === 'undefined' || !window.navigation) return;
  ready = true;

  win   = window;
  const mainEl = document.getElementById('main');
  // Only wrap in WeakRef when the element exists. setup() may be called at
  // module-evaluation time (before DOMContentLoaded), so the element may not
  // be in the DOM yet. anchor() in boot.js is the authoritative check that
  // throws if the element is absent at boot time.
  if (mainEl) shell = new WeakRef(mainEl);
  navListener = (event) => {
    // Skip cross-origin navigations, file downloads, or same-document hash scrolls
    if (!event.canIntercept || event.hashChange || event.downloadRequest) {
      return;
    }

    const url = event.destination.url;
    let precommitted = false; // Scoped precommitted guard state (RT-02)

    event.intercept({
      /**
       * Runs guards before URL changes.
       * Supports atomic redirection before URL commit (Chrome & Firefox).
       */
      async precommitHandler(controller) {
        precommitted = true;
        const destination = event.destination;
        for (const guardFn of guards) {
          const redirectUrl = await guardFn(destination, controller);
          if (redirectUrl) {
            controller.redirect(redirectUrl);
            return;
          }
        }
      },

      /**
       * Executes DOM mutations, layout changes, and provides fallbacks for Safari.
       */
      async handler() {
        const destination = event.destination;
        let routeMatch = null;
        try {
          routeMatch = await match(destination.url);
        } catch (err) {
          emit('error', { error: err, url: destination.url, route: null, phase: 'match' });
          return;
        }

        // Layout resolution: ensure the route's container chain is mounted.
        // Routes declare an ordered `via` chain (root-to-leaf) or a single
        // `container`. Missing containers are mounted via cascade rather than
        // throwing — a hard refresh on a deep route can now build its own
        // layout instead of erroring out.
        if (routeMatch) {
          const meta = routeMatch.route?.meta ?? {};
          const chain = Array.isArray(meta.via) && meta.via.length
            ? meta.via
            : (meta.container ? [meta.container] : []);

          try {
            for (let i = 0; i < chain.length; i++) {
              if (!getContainer(chain[i])) {
                await ensure(chain[i], chain[i - 1] ?? 'main');   // was 'body'
              }
            }
          } catch (err) {
            emit('error', { error: err, url: destination.url, route: routeMatch.route, phase: 'container' });
            throw err;
          }
        }

        // Graceful Safari Fallback: Evaluate guards inside post-commit handler if precommit is ignored.
        if (!precommitted) {
          for (const guardFn of guards) {
            let redirectUrl;
            try {
              redirectUrl = await guardFn(destination, null);
            } catch (err) {
              emit('error', { error: err, url: destination.url, route: routeMatch?.route ?? null, phase: 'guard' });
              return;
            }
            if (redirectUrl) {
              window.navigation.navigate(redirectUrl, { history: 'replace' });
              return;
            }
          }
        }

        await transitions.run(async () => {
          if (routeMatch) {
            // Run callback handlers exactly once, here (never during match()).
            if (isCallback(routeMatch.route.handler)) {
              try {
                await runCallback(routeMatch.route.handler, routeMatch.params, event);
              } catch (err) {
                emit('error', { error: err, url: destination.url, route: routeMatch.route, phase: 'handler' });
                return;
              }
            }

            emit('found', {
              tag: routeMatch.tag,
              params: routeMatch.params,
              query: routeMatch.query,
              hash: routeMatch.hash,
              chain: routeMatch.chain,
              url: destination.url,
              direction: event.navigationType
            });
          } else {
            emit('notfound', { url: destination.url });

            if (notFoundHandler) {
              await notFoundHandler(event);
            } else {
              console.error(`Route matching failed and no not-found boundary handler was configured: ${destination.url}`);
            }
          }
        });
      }
    });
  };

  successListener = () => {
    const url = window.navigation.currentEntry?.url;
    if (url) {
      import('./sync/index.js').then(({ coordinateConnections }) => {
        coordinateConnections(url);
      }).catch(() => {});
    }
  };

  errorListener = (event) => {
    const error = event.error;

    // Silence aborted/superseded navigation actions
    if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
      return;
    }

    console.error('Navigation error caught globally:', error);
    emit('error', { error, url: window.navigation.currentEntry?.url ?? null, route: null, phase: 'navigation' });

    import('../events/index.js').then(({ events }) => {
      events.emit('core:error', {
        code: 'NAVIGATION_FAILED',
        message: error?.message || 'Navigation failed',
        cause: error,
        context: { url: window.navigation.currentEntry?.url },
        recoverable: true
      });
    }).catch(() => {});
  };

  window.navigation.addEventListener('navigate', navListener);
  window.navigation.addEventListener('navigatesuccess', successListener);
  window.navigation.addEventListener('navigateerror', errorListener);

  // Trigger initial on-boot matching once the DOM is parsed and every gated
  // prerequisite (element definitions registered via boot.gate) has settled.
  // Deferring this past DOMContentLoaded is what survives a hard refresh on a
  // deep route — the first match no longer races element registration.
  boot(async () => {
    const url = window.navigation.currentEntry?.url || window.location.href;
    const routeMatch = await match(url);
    if (routeMatch) {
      emit('found', {
        tag: routeMatch.tag,
        params: routeMatch.params,
        query: routeMatch.query,
        hash: routeMatch.hash,
        chain: routeMatch.chain,
        url,
        direction: 'load'
      });
    } else {
      emit('notfound', { url });
    }
  });
}

/**
 * Tears down all navigation listeners and resets router state.
 * Useful for test isolation and SSR teardown.
 */
export function destroy() {
  if (!ready) return;
  ready = false;
  win   = null;
  shell = null;
  if (typeof window !== 'undefined' && window.navigation) {
    if (navListener) window.navigation.removeEventListener('navigate', navListener);
    if (successListener) window.navigation.removeEventListener('navigatesuccess', successListener);
    if (errorListener) window.navigation.removeEventListener('navigateerror', errorListener);
  }

  navListener = null;
  successListener = null;
  errorListener = null;

  guards = [];
  notFoundHandler = null;
  resetBoot();

  for (const set of Object.values(listeners)) {
    set.clear();
  }

  // Close sync channel via dynamic import (avoids circular dep at module load)
  import('./sync/tab.js').then(m => m.close?.()).catch(() => {});
}

class TransitionController {
  constructor(url, navigationPromise) {
    this.url = url;
    this.promise = navigationPromise;
    this.listeners = {
      found: [],
      notfound: [],
      error: []
    };

    const getPath = (u) => {
      try { return new URL(u, window.location.href).pathname; } catch (_) { return u; }
    };

    // Coordinate with Navigation events using standard on() mechanism (RT-01)
    const disposeFound = on('found', (detail) => {
      if (getPath(detail.url) === getPath(this.url)) {
        cleanup();
        this._dispatch('found', detail);
      }
    });

    const disposeNotFound = on('notfound', (detail) => {
      if (getPath(detail.url) === getPath(this.url)) {
        cleanup();
        this._dispatch('notfound', detail);
      }
    });

    const disposeError = on('error', (detail) => {
      cleanup();
      this._dispatch('error', detail.error);
    });

    const cleanup = () => {
      disposeFound();
      disposeNotFound();
      disposeError();
    };

    this.promise.catch((err) => {
      cleanup();
      this._dispatch('error', err);
    });
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  _dispatch(event, payload) {
    for (const cb of this.listeners[event]) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`Error inside fluent navigation "${event}" handler:`, err);
      }
    }
  }
}

let navigateCallback = null;

export function registerNavigator(cb) {
  navigateCallback = cb;
}

export const nav = {
  to(url, options) {
    if (!navigateCallback) {
      console.warn('[Router] Navigator is not registered yet. Falling back to dynamic import.');
      return new TransitionController(url, import('./history.js').then(m => m.navigate(url, options)));
    }
    const result = navigateCallback(url, options);
    const p = result instanceof Promise ? result : Promise.resolve(result);
    return new TransitionController(url, p);
  }
};
