/**
 * src/elements/layout/stack/index.js
 *
 * Layout System: <ui-stack>
 * Vertical stack container applying standardized layout gap spacers.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-stack', {
  style: './style.css',
  template: './index.html',
  props: {
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
  if (el.gap) {
    const gapVal = el.gap.includes('px') || el.gap.includes('rem') ? el.gap : `var(--space-${el.gap})`;
    el.style.setProperty('--stack-gap', gapVal);
  }
}
