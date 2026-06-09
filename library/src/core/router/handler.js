/**
 * src/core/router/handler.js
 *
 * One clear contract for what a route handler can be. This removes the previous
 * ambiguity where `match()` invoked every function handler as a lazy tag factory
 * while `intercept()` separately treated functions with arguments as callbacks —
 * which could run a callback twice (once during matching, once on navigation).
 *
 * A handler is exactly one of:
 *   - a string                  -> a custom element tag, e.g. 'page-home'
 *   - a zero-arg function       -> a lazy tag factory, e.g. async () => 'page-home'
 *   - a function (params, event)-> a callback (arity > 0)
 *   - { tag: string }           -> a static tag
 *   - { load: () => tag }       -> a lazy tag factory
 *   - { handler: (params, ev) } -> a callback
 */

/** Does this handler render via a callback (rather than resolving to a tag)? */
export function isCallback(handler) {
  if (typeof handler === 'function') return handler.length > 0;
  if (handler && typeof handler === 'object') return typeof handler.handler === 'function';
  return false;
}

/**
 * Resolve a handler to its element tag, or `null` when the handler is a callback.
 * Never invokes callbacks (arity > 0 / `{ handler }`), so it is safe in `match()`.
 */
export async function resolveTag(handler) {
  if (typeof handler === 'string') return handler;

  if (typeof handler === 'function') {
    return handler.length === 0 ? await handler() : null;
  }

  if (handler && typeof handler === 'object') {
    if (typeof handler.tag === 'string') return handler.tag;
    if (typeof handler.load === 'function') return await handler.load();
  }

  return null;
}

/** Run a callback handler. No-op for tag/lazy handlers. */
export async function runCallback(handler, params, event) {
  if (typeof handler === 'function' && handler.length > 0) {
    return handler(params, event);
  }
  if (handler && typeof handler === 'object' && typeof handler.handler === 'function') {
    return handler.handler(params, event);
  }
}
