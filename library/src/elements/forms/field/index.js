/**
 * src/elements/forms/field/index.js
 *
 * Form Control: <ui-field>
 * Field wrapper layout. Coordinates labels, required indicators, hints,
 * custom error message slots, and wraps any active form controls.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-field', {
  style: './style.css',
  template: './index.html',
  props: {
    label: { type: String, reflect: true },
    required: { type: Boolean, reflect: true }
  },
  mount({ el, tags }) {
    updateLabel(el, tags);
  },
  update({ el, name, tags }) {
    if (name === 'label') {
      updateLabel(el, tags);
    }
  }
}, import.meta.url);

function updateLabel(el, tags) {
  const labelVal = el.label;
  const labelSlot = tags.one('slot[name="label"]');

  if (labelVal) {
    // If a label attribute is provided and labelSlot has no customized children, stamp text
    const hasChildren = labelSlot.assignedNodes().length > 0;
    if (!hasChildren) {
      const labelEl = tags.one('label');
      labelEl.childNodes[0].textContent = labelVal;
    }
  }
}
