/**
 * src/elements/navigation/nav/index.js
 *
 * Navigation System: <ui-nav>
 * Flexible routing navigation wrapper offering horizontal/vertical orientation
 * and standard accessible semantic lists markup.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-nav', {
  style: './style.css',
  template: './index.html',
  props: {
    orientation: { type: String, reflect: true, default: 'horizontal' }
  },
  mount({ el }) {
    if (!el.hasAttribute('role')) {
      el.setAttribute('role', 'navigation');
    }
  }
}, import.meta.url);
