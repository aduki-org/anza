/**
 * src/elements/feedback/progress/index.js
 *
 * Feedback Element: <ui-progress>
 * Premium progress indicator mapping directly to native progress states
 * while incorporating smooth CSS animations and active percentage labels.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-progress', {
  style: './style.css',
  template: './index.html',
  props: {
    value: { type: Number, reflect: true },
    max: { type: Number, reflect: true }
  },
  mount({ el, tags }) {
    // ARIA updates
    if (!el.hasAttribute('role')) {
      el.setAttribute('role', 'progressbar');
    }
    update(el, tags);
  },
  update({ el, tags }) {
    update(el, tags);
  }
}, import.meta.url);

function update(el, tags) {
  const val = el.value || 0;
  const max = el.max || 100;
  const fill = tags.one('.fill');
  const label = tags.one('#percent-label');

  const pct = Math.min(100, Math.max(0, Math.round((val / max) * 100)));

  fill.style.width = `${pct}%`;
  label.textContent = `${pct}%`;

  el.setAttribute('aria-valuenow', val);
  el.setAttribute('aria-valuemin', 0);
  el.setAttribute('aria-valuemax', max);
}
