/**
 * src/elements/navigation/pagination/index.js
 *
 * Navigation System: <ui-pagination>
 * URL query-state aware pagination component. Synchronously updates page variables
 * in a bookmarkable fashion via the client router.
 *
 * Source: doc 04 — Web Components §3, doc 08 — State Management §3, doc 09 — Routing §8
 */

import { ui } from '../../../core/ui/index.js';
import { navigate } from '../../../core/router/index.js';

ui.element('ui-pagination', {
  style: './style.css',
  template: './index.html',
  props: {
    page: { type: Number, reflect: true },
    total: { type: Number, reflect: true },
    limit: { type: Number, reflect: true }
  },
  mount({ el, tags, on }) {
    const prev = tags.one('#prev-btn');
    const next = tags.one('#next-btn');

    on.click(prev, () => changePage(el, -1));
    on.click(next, () => changePage(el, 1));

    // Sync pagination state with navigation changes
    if (typeof window !== 'undefined' && window.navigation) {
      window.navigation.addEventListener('navigate', () => syncState(el, tags), { signal: el.ctrl.signal });
    }

    syncState(el, tags);
  },
  update({ el, tags }) {
    syncState(el, tags);
  }
}, import.meta.url);

function syncState(el, tags) {
  const prev = tags.one('#prev-btn');
  const next = tags.one('#next-btn');
  const indicator = tags.one('.page-indicator');

  // Parse attributes safely using read-site coercion logic
  const total = Math.max(0, el.total || 0);
  const limit = Math.max(1, el.limit || 10);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  let page = 1;
  if (el.page) {
    page = el.page || 1;
  } else if (typeof window !== 'undefined') {
    const url = new URL(window.navigation?.currentEntry?.url || window.location.href);
    page = Number(url.searchParams.get('page')) || 1;
  }

  page = Math.min(totalPages, Math.max(1, page));

  indicator.textContent = `Page ${page} of ${totalPages}`;
  prev.disabled = page <= 1;
  next.disabled = page >= totalPages;
}

function changePage(el, delta) {
  const total = Math.max(0, el.total || 0);
  const limit = Math.max(1, el.limit || 10);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  let page = 1;
  if (el.page) {
    page = el.page || 1;
  } else if (typeof window !== 'undefined') {
    const url = new URL(window.navigation?.currentEntry?.url || window.location.href);
    page = Number(url.searchParams.get('page')) || 1;
  }

  const nextPage = Math.min(totalPages, Math.max(1, page + delta));

  if (el.page) {
    el.page = nextPage;
  } else if (typeof window !== 'undefined') {
    const url = new URL(window.navigation?.currentEntry?.url || window.location.href);
    url.searchParams.set('page', nextPage);
    navigate(url.pathname + url.search);
  }

  el.dispatchEvent(new CustomEvent('page-change', {
    detail: { page: nextPage },
    bubbles: true,
    composed: true
  }));
}
