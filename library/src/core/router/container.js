/**
 * src/core/router/container.js
 *
 * Container registry facade. Delegates storage to the hierarchical graph
 * (graph.js) while preserving the historical public API and the CSS-selector
 * fallback for containers that are plain DOM elements rather than registered
 * docks.
 *
 * Source: tasks.md Phase 3, advance2.md
 */

import { add, remove, element as graphElement, get, clear } from './graph.js';

// Selectors we are still waiting to appear in the DOM.
const observedSelectors = new Set();
let observer;

/**
 * Boots the MutationObserver to discover standard (non-dock) containers that
 * match a tracked CSS selector. Uses requestIdleCallback with a 100ms timeout
 * so it still fires under sustained animation load, falling back to
 * requestAnimationFrame where idle callbacks are unavailable (RT bug 8.1).
 */
function ensureObserver() {
  if (observer || typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;

  const attach = () => {
    if (observer) return;
    observer = new MutationObserver(() => {
      let stillWaiting = false;
      for (const selector of observedSelectors) {
        if (!graphElement(selector)) {
          const el = document.querySelector(selector);
          if (el) registerContainer(selector, el);
          else stillWaiting = true;
        }
      }
      if (!stillWaiting && observer) {
        observer.disconnect();
        observer = null;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(attach, { timeout: 100 });
  } else {
    requestAnimationFrame(attach);
  }
}

/**
 * Registers a layout container as actively mounted in the DOM.
 *
 * @param {string} name - unique registry key (or CSS selector).
 * @param {HTMLElement} element - the DOM element instance.
 * @param {string} [parent='body'] - parent container key in the graph.
 */
export function registerContainer(name, element, parent = 'body') {
  add(name, element, parent);
}

/**
 * Unregisters a layout container when it is removed from the DOM.
 *
 * @param {string} name - the registry key.
 * @param {HTMLElement} [element] - element guard for the safety check.
 */
export function unregisterContainer(name, element) {
  remove(name, element);
}

/**
 * Retrieves an active layout container by name.
 *
 * A plain key (e.g. 'main') is resolved only through the graph. A CSS selector
 * (starts with '#', '.', '[', or contains a combinator) additionally resolves
 * against the document and self-registers on first hit.
 *
 * @param {string} name - the registry key or selector.
 * @returns {HTMLElement|undefined} the element, or undefined if not mounted.
 */
export function getContainer(name) {
  let el = graphElement(name);
  if (el) return el;

  if (isSelector(name) && typeof document !== 'undefined') {
    try {
      el = document.querySelector(name);
      if (el) {
        registerContainer(name, el);
        return el;
      }
      if (!observedSelectors.has(name)) observedSelectors.add(name);
      ensureObserver();
    } catch (_) {
      // Invalid selector string — ignore.
    }
    return el ?? undefined;
  }

  // Warn when a plain key shadows a real DOM element of the same tag name.
  if (typeof name === 'string' && typeof document !== 'undefined') {
    let queryResult = null;
    try { queryResult = document.querySelector(name); } catch (_) {}
    if (queryResult) {
      console.warn(
        `[Router] Container name "${name}" is ambiguous: it exists in the DOM as a selector ` +
        `but is being treated as a registry key. Use a selector prefix (e.g., "#${name}") ` +
        `to explicitly target the DOM element, or ensure it is registered via registerContainer().`
      );
    }
  }

  return el ?? undefined;
}

/** Heuristic: does this string look like a CSS selector rather than a key? */
function isSelector(name) {
  return typeof name === 'string' && /^[#.\[]|[\s>+~]/.test(name);
}

/**
 * Clears the entire container registry and stops selector observation.
 */
export function clearContainers() {
  clear();
  observedSelectors.clear();
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Re-export the graph node accessor for modules that need topology directly.
export { get as getNode };
