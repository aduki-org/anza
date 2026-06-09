/**
 * src/elements/data/stat/index.js
 *
 * Data Element: <ui-stat>
 * Standard KPI statistic display panel offering large numerical values,
 * secondary descriptive labels, and styled positive/negative/neutral trend change metrics.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-stat', {
  style: './style.css',
  template: './index.html',
  props: {
    trend: { type: String, reflect: true, default: 'neutral' }
  }
}, import.meta.url);
