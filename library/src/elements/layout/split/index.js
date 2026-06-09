/**
 * src/elements/layout/split/index.js
 *
 * Layout System: <ui-split>
 * Flexible two-pane responsive split layout divider.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-split', {
  style: './style.css',
  template: './index.html',
  props: {
    ratio: { type: String, reflect: true, default: '1-1' }
  }
}, import.meta.url);
