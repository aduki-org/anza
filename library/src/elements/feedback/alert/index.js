/**
 * src/elements/feedback/alert/index.js
 *
 * Feedback Element: <ui-alert>
 * Inline severity notifications (info, success, warning, error) incorporating WAI-ARIA
 * role="alert" live regions and dismiss action controllers.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-alert', {
  style: './style.css',
  template: './index.html',
  props: {
    variant: { type: String, reflect: true },
    dismissible: { type: Boolean, reflect: true }
  },
  mount({ el, tags, on }) {
    const closeBtn = tags.one('button');

    on.click(closeBtn, () => {
      el.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true }));
      el.remove();
    });
  }
}, import.meta.url);
