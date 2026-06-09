/**
 * src/elements/layout/scroll/index.js
 *
 * Layout System: <ui-scroll>
 * Custom scroll containment container offering momentum scrolling
 * and layout scroll-snap coordination.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-scroll', {
  style: './style.css',
  template: './index.html',
  props: {
    snap: { type: Boolean, reflect: true }
  }
}, import.meta.url);
