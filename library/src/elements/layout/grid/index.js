/**
 * src/elements/layout/grid/index.js
 *
 * Layout System: <ui-grid>
 * Multi-column responsive layout grid offering automated columns mapping
 * and standard spacing gaps.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-grid', {
  style: './style.css',
  template: './index.html',
  props: {
    cols: { type: String, reflect: true },
    gap: { type: String, reflect: true }
  },
  mount({ el }) {
    update(el);
  },
  update({ el }) {
    update(el);
  }
}, import.meta.url);

function update(el) {
  if (el.cols) {
    if (!isNaN(el.cols)) {
      el.style.setProperty('--grid-cols', `repeat(${el.cols}, minmax(0, 1fr))`);
    } else {
      el.style.setProperty('--grid-cols', el.cols);
    }
  }

  if (el.gap) {
    const gapVal = el.gap.includes('px') || el.gap.includes('rem') ? el.gap : `var(--space-${el.gap})`;
    el.style.setProperty('--grid-gap', gapVal);
  }
}
