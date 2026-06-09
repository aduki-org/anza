/**
 * src/elements/data/card/index.js
 *
 * Data Element: <ui-card>
 * Premium card containment container including header, body, footer slots,
 * and subtle micro-animation interactive hover lifts.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-card', {
  style: './style.css',
  template: './index.html',
  props: {
    interactive: { type: Boolean, reflect: true }
  }
}, import.meta.url);
