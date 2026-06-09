/**
 * src/core/animations/tokens.js
 *
 * Single source of truth bridge: reads the CSS motion tokens
 * (`--duration-*`, `--ease-*` from src/tokens/primitives/motion.css) at runtime
 * so the WAAPI engine and the stylesheet share the same values. Falls back to
 * the token defaults when the document or a token is unavailable (e.g. SSR).
 */

const FALLBACK = {
  duration: { instant: 50, fast: 100, normal: 200, slow: 300, slower: 500 },
  ease: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    'in-out': 'cubic-bezier(0.4, 0, 0.6, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    linear: 'linear'
  }
};

function root() {
  if (typeof document === 'undefined' || !document.documentElement) return null;
  return getComputedStyle(document.documentElement);
}

function parseMs(value) {
  if (!value) return null;
  const v = value.trim();
  if (v.endsWith('ms')) return parseFloat(v);
  if (v.endsWith('s')) return parseFloat(v) * 1000;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

/** Resolve a duration token (ms). `name` is one of the --duration-* suffixes. */
export function duration(name = 'normal') {
  const fallback = FALLBACK.duration[name] ?? FALLBACK.duration.normal;
  const styles = root();
  if (!styles) return fallback;
  return parseMs(styles.getPropertyValue(`--duration-${name}`)) ?? fallback;
}

/** Resolve an easing token. `name` is one of the --ease-* suffixes. */
export function ease(name = 'default') {
  const fallback = FALLBACK.ease[name] ?? FALLBACK.ease.default;
  const styles = root();
  if (!styles) return fallback;
  const value = styles.getPropertyValue(`--ease-${name}`).trim();
  return value || fallback;
}

/** True when the user prefers reduced motion. */
export function reduced() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
