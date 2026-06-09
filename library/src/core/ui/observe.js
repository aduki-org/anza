/**
 * src/core/ui/observe.js
 *
 * Safe Observer Factories.
 * Wraps browser ResizeObserver, IntersectionObserver, MutationObserver, and PerformanceObserver
 * APIs with automatic AbortSignal-driven disconnect cleanups to secure observers
 * against lifecycle memory leaks.
 *
 * Abort listeners are removed when manual disposal runs first, preventing
 * long-lived signals from retaining stale closures.
 *
 * Source: doc 14 — Memory Management §5, doc 17 — Browser API §10
 */

/**
 * ResizeObserver with automatic AbortSignal cleanup.
 */
export function resize(el, fn, signal) {
  if (signal?.aborted) return () => {};

  const observer = new ResizeObserver((entries) => {
    try {
      fn(entries);
    } catch (err) {
      console.error('Error in ResizeObserver callback:', err);
    }
  });

  observer.observe(el);

  const dispose = () => {
    observer.disconnect();
    signal?.removeEventListener('abort', dispose);
  };

  signal?.addEventListener('abort', dispose);

  return dispose;
}

/**
 * IntersectionObserver with automatic AbortSignal cleanup.
 */
export function intersection(el, fn, signal, options = {}) {
  if (signal?.aborted) return () => {};

  const observer = new IntersectionObserver((entries) => {
    try {
      fn(entries);
    } catch (err) {
      console.error('Error in IntersectionObserver callback:', err);
    }
  }, options);

  observer.observe(el);

  const dispose = () => {
    observer.disconnect();
    signal?.removeEventListener('abort', dispose);
  };

  signal?.addEventListener('abort', dispose);

  return dispose;
}

/**
 * MutationObserver with automatic AbortSignal cleanup.
 */
export function mutation(el, fn, signal, options = { childList: true }) {
  if (signal?.aborted) return () => {};

  const observer = new MutationObserver((mutations) => {
    try {
      fn(mutations);
    } catch (err) {
      console.error('Error in MutationObserver callback:', err);
    }
  });

  observer.observe(el, options);

  const dispose = () => {
    observer.disconnect();
    signal?.removeEventListener('abort', dispose);
  };

  signal?.addEventListener('abort', dispose);

  return dispose;
}

/**
 * PerformanceObserver with automatic AbortSignal cleanup.
 */
export function performance(types, fn, signal, options = {}) {
  if (signal?.aborted) return () => {};

  const observer = new PerformanceObserver((list) => {
    try {
      fn(list);
    } catch (err) {
      console.error('Error in PerformanceObserver callback:', err);
    }
  });

  observer.observe({ entryTypes: types, ...options });

  const dispose = () => {
    observer.disconnect();
    signal?.removeEventListener('abort', dispose);
  };

  signal?.addEventListener('abort', dispose);

  return dispose;
}
