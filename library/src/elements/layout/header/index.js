/**
 * src/elements/layout/header/index.js
 *
 * Layout System: <ui-header>
 * Top navigation header component displaying logo/branding sections,
 * action slots, and matching premium bordered surfaces.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-header', {
  style: './style.css',
  template: './index.html'
}, import.meta.url);
