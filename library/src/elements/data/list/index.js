/**
 * src/elements/data/list/index.js
 *
 * Data Element: <ui-list>
 * Flexible list wrapper supplying clean spacer dividers, bordered panels,
 * and semantic token alignments.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-list', {
  style: './style.css',
  template: './index.html',
  props: {
    bordered: { type: Boolean, reflect: true }
  }
}, import.meta.url);
