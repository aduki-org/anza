/**
 * src/elements/layout/surface/index.js
 *
 * Layout System: <ui-surface>
 * Standard styling layer wrapping semantic backdrop surfaces, elevated shadow levels,
 * and borders.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-surface', {
  style: './style.css',
  template: './index.html',
  props: {
    variant: { type: String, reflect: true, default: 'flat' }
  }
}, import.meta.url);
