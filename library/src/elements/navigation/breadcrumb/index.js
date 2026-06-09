/**
 * src/elements/navigation/breadcrumb/index.js
 *
 * Navigation System: <ui-breadcrumb>
 * Standard-compliant accessible navigation trails trails. Injects design spacing
 * dividers between items using CSS pseudoselectors.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-breadcrumb', {
  style: './style.css',
  template: './index.html'
}, import.meta.url);
