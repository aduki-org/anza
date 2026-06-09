/**
 * src/elements/feedback/empty/index.js
 *
 * Feedback Element: <ui-empty>
 * Informative empty state component supporting custom illustrations slots,
 * titles, secondary paragraphs, and CTA actions triggers.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-empty', {
  style: './style.css',
  template: './index.html',
  props: {
    title: { type: String, reflect: true },
    description: { type: String, reflect: true }
  },
  mount({ el, tags }) {
    update(el, tags);
  },
  update({ el, tags }) {
    update(el, tags);
  }
}, import.meta.url);

function update(el, tags) {
  const title = el.title || 'No records found';
  const description = el.description || 'Try adjusting your search criteria or add new records.';

  tags.one('#title-label').textContent = title;
  tags.one('#desc-label').textContent = description;
}
