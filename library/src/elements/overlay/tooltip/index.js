/**
 * src/elements/overlay/tooltip/index.js
 *
 * Overlay System: <ui-tooltip>
 * Accessible CSS-driven tooltip indicator. Wraps content and displays a popup hint
 * on hover and focus-within without requiring JS positioning computations.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §5
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-tooltip', {
  style: './style.css',
  template: './index.html'
}, import.meta.url);
