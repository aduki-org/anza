/**
 * src/core/router/cache.js
 *
 * Internal route cache backed by the browser Cache API. The router uses this to
 * prefetch and store view assets / lazily-loaded module responses keyed by URL,
 * so revisiting or anticipating a route serves from cache instead of the network.
 *
 * Uses the same `x-expires-at` TTL convention as storage and api caches.
 */

const NAME = 'router-cache';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

async function open() {
  if (typeof caches === 'undefined') return null;
  return caches.open(NAME);
}

function key(url) {
  return new Request(new URL(url, globalThis.location?.href || 'http://localhost').href);
}

/**
 * Read a cached response for a route URL, honoring TTL. Returns `null` on miss
 * or when the Cache API is unavailable.
 */
export async function get(url) {
  const store = await open();
  if (!store) return null;

  const req = key(url);
  const res = await store.match(req);
  if (!res) return null;

  const expires = res.headers.get('x-expires-at');
  if (expires && Date.now() > Number(expires)) {
    await store.delete(req);
    return null;
  }
  return res.clone();
}

/**
 * Store a response for a route URL with an optional TTL (ms).
 */
export async function set(url, response, ttl = DEFAULT_TTL) {
  const store = await open();
  if (!store || !response || response.type === 'opaque') return;

  const headers = new Headers(response.headers);
  if (ttl) headers.set('x-expires-at', String(Date.now() + ttl));

  const body = response.body ? response.clone().body : null;
  const stamped = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
  await store.put(key(url), stamped);
}

/**
 * Prefetch a route URL into the cache. Returns the cached `Response` (or `null`).
 * Use on link hover / when a view becomes visible to make navigation instant.
 */
export async function prefetch(url, { ttl = DEFAULT_TTL, signal } = {}) {
  const existing = await get(url);
  if (existing) return existing;

  try {
    const res = await fetch(key(url), { signal });
    if (res && res.ok) {
      await set(url, res, ttl);
      return res.clone();
    }
  } catch {
    // Network failure during prefetch is non-fatal.
  }
  return null;
}

/**
 * Remove a single URL, or clear the entire route cache when called with no args.
 */
export async function purge(url) {
  const store = await open();
  if (!store) return;
  if (url) {
    await store.delete(key(url));
  } else if (typeof caches !== 'undefined') {
    await caches.delete(NAME);
  }
}

export const cache = { get, set, prefetch, purge };
