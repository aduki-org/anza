/**
 * src/elements/layout/app/index.js
 *
 * Layout System: <ui-app>
 * Global application frame shell providing side-by-side or stacked layouts
 * matching modern responsive standards.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-app', {
  style: './style.css',
  template: './index.html'
}, import.meta.url);
