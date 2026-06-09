/**
 * core/theme/index.js
 *
 * Automatic theme switching. Attaches to window.theme on import and
 * restores the saved preference (or respects OS dark mode) without any
 * manual init call. The user can still import { theme } and call set or
 * toggle — both update the same global instance.
 */

const KEY = 'anza-theme';

function root() {
  return document.documentElement;
}

function restore() {
  let saved;
  try {
    saved = localStorage.getItem(KEY);
  } catch (_) {}

  if (saved && saved !== 'auto') {
    root().dataset.theme = saved;
    return;
  }

  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    root().dataset.theme = 'dark';
  }
}

export const theme = {
  /** Return the active theme name: light, dark, contrast, or auto. */
  get() {
    const attr = root().dataset.theme;
    if (attr) return attr;
    return 'auto';
  },

  /** Apply a theme name and persist it. */
  set(name) {
    const el = root();
    if (name === 'auto') {
      delete el.dataset.theme;
    } else {
      el.dataset.theme = name;
    }
    try {
      localStorage.setItem(KEY, name);
    } catch (_) {}
  },

  /** Toggle between light and dark. */
  toggle() {
    const current = this.get();
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = current === 'auto' ? (prefersDark ? 'dark' : 'light') : current;
    this.set(resolved === 'dark' ? 'light' : 'dark');
  }
};

// Auto-bootstrap on client load.
if (typeof window !== 'undefined') {
  if (!('theme' in window)) {
    Object.defineProperty(window, 'theme', {
      value: theme,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
  restore();
}
