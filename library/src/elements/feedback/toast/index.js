/**
 * src/elements/feedback/toast/index.js
 *
 * Feedback Element: <ui-toast>
 * Dynamic toast notifications. Manages automated dismiss timeouts, top-layer
 * popup placement overlays, and accessible WAI-ARIA role="status" regions.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §5
 */

import { ui } from '../../../core/ui/index.js';

let container = null;

function getContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = 'var(--space-6)';
  container.style.right = 'var(--space-6)';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = 'var(--space-2)';
  container.style.zIndex = '9999';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);
  return container;
}

ui.element('ui-toast', {
  style: './style.css',
  template: './index.html',
  props: {
    duration: { type: Number, reflect: true }
  },
  mount({ el, tags }) {
    const duration = el.duration || 3000;

    // Auto-dismiss timeout setup
    const timeoutId = setTimeout(() => dismiss(el, tags), duration);
    el.ctrl.signal.addEventListener('abort', () => clearTimeout(timeoutId));
  }
}, import.meta.url);

function dismiss(el, tags) {
  const toast = tags.one('.toast');
  toast.classList.add('fade-out');
  // Delete after fade transition completes
  setTimeout(() => el.remove(), 250);
}

/**
 * Static convenience helper to easily trigger a Toast dynamic alert popup.
 */
export function show(message, options = {}) {
  if (typeof window === 'undefined') return;
  const parent = getContainer();
  const el = document.createElement('ui-toast');
  if (options.duration) {
    el.duration = options.duration;
  }
  el.textContent = message;
  parent.appendChild(el);
  return el;
}
