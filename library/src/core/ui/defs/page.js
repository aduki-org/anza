/**
 * src/core/ui/defs/page.js
 *
 * `page(route, config, base)` — a route-bound navigable unit. Maps a URL
 * pattern to a custom element, declares the ordered container chain (`via`) the
 * router traverses to reach the render target, and gates the boot sequence on
 * the element's definition so a hard refresh waits for it.
 *
 * Source: definations.md §3, tasks.md Phase 6
 */

import { router } from '../../router/index.js';
import { gate } from '../../router/boot.js';
import { element } from '../define/element.js';
import { specRegistry } from '../define/state.js';
import { translate } from './spec.js';

/**
 * @param {string} route - URL pattern, e.g. '/profile/:id'.
 * @param {object} config - page definition.
 * @param {string} config.tag - custom element tag (must contain a hyphen).
 * @param {string[]} [config.via] - ordered container chain, root-to-leaf.
 * @param {string} [config.container] - single container (back-compat for via).
 * @param {object} [config.props] - reactive props.
 * @param {string[]} [config.query] - query params to map onto props.
 * @param {Function} [config.guard] - route-scoped navigation guard.
 * @param {object} [config.on] - lifecycle hooks (load, connect, disconnect, change).
 * @param {string} [base] - import.meta.url of the caller (file templates).
 */
export function page(route, config, base) {
  const tag = config.tag;
  if (!tag) {
    console.error(`[Native UI] page('${route}') is missing a 'tag'.`);
    return;
  }

  // Normalise the container chain. The render target is the last container.
  const via = Array.isArray(config.via) && config.via.length
    ? config.via
    : (config.container ? [config.container] : []);
  const target = via.at(-1) ?? null;

  const spec = translate(config, { visual: true });
  // Carry routing metadata on the spec so the orchestrator can resolve the
  // render target and cast query params (specRegistry is populated by element()).
  spec.via = via;
  spec.container = target;
  if (config.query) spec.query = config.query;

  element(tag, spec, base);

  // Register the route. Keep both `via` (full chain) and `container` (target)
  // in meta so the interceptor cascade and orchestrator both work.
  router.register(route, tag, {
    ...config.meta,
    via,
    container: target
  });

  // Hold the initial match until this element is defined (hard-refresh safety).
  if (typeof customElements !== 'undefined') {
    gate(customElements.whenDefined(tag));
  }

  // Route-scoped guard: only runs when the destination matches this route.
  if (typeof config.guard === 'function') {
    registerGuard(route, config.guard);
  }
}

/** Adds a global guard that delegates to `fn` only for matching destinations. */
function registerGuard(route, fn) {
  let pattern = null;
  const Pattern = typeof URLPattern !== 'undefined' ? URLPattern : null;
  if (Pattern) {
    try {
      pattern = route.startsWith('http') ? new Pattern(route) : new Pattern({ pathname: route });
    } catch (_) { pattern = null; }
  }

  router.guard(async (destination, controller) => {
    if (pattern) {
      let url = destination?.url;
      try { url = new URL(url, globalThis.location?.href).href; } catch (_) {}
      if (!pattern.test(url)) return null; // not this route — allow
    }
    return fn(destination, controller);
  });
}
