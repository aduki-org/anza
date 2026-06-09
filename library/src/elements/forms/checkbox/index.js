/**
 * src/elements/forms/checkbox/index.js
 *
 * Form Control: <ui-checkbox>
 * Accessible form-participating tri-state checkbox element utilizing ElementInternals
 * states and beautiful semantic-bound SVGs indicators.
 *
 * Source: doc 04 — Web Components §9, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-checkbox', {
  style: './style.css',
  template: './index.html',
  form: true,
  props: {
    checked: { type: Boolean, reflect: true, state: true },
    indeterminate: { type: Boolean, reflect: true, state: true },
    disabled: { type: Boolean, reflect: true, state: true },
    required: { type: Boolean, reflect: true },
    value: { type: String, reflect: true }
  },
  mount({ el, internals, on }) {
    // Tabindex defaults
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }

    on.click(el, (e) => {
      if (el.disabled) return;
      e.preventDefault();
      el.checked = !el.checked;
    });

    on.keydown(el, (e) => {
      if (el.disabled) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        el.checked = !el.checked;
      }
    });

    syncAttributes(el, internals);
  },
  update({ el, name, val, internals }) {
    if (name === 'checked' || name === 'indeterminate' || name === 'disabled') {
      syncAttributes(el, internals);
    }
  },
  formResetCallback({ el, internals }) {
    el.checked = el.hasAttribute('checked');
    syncAttributes(el, internals);
  },
  formDisabledCallback({ el, internals, disabled }) {
    if (disabled) {
      el.removeAttribute('tabindex');
    } else {
      if (!el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
      }
    }
    syncAttributes(el, internals);
  }
}, import.meta.url);

function syncAttributes(el, internals) {
  const checked = el.checked;
  const indeterminate = el.indeterminate;
  const disabled = el.disabled;

  if (checked) {
    internals.states.add('checked');
    internals.states.delete('indeterminate');
  } else if (indeterminate) {
    internals.states.add('indeterminate');
    internals.states.delete('checked');
  } else {
    internals.states.delete('checked');
    internals.states.delete('indeterminate');
  }

  if (disabled) {
    internals.states.add('disabled');
    el.removeAttribute('tabindex');
  } else {
    internals.states.delete('disabled');
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }
  }

  const subValue = checked ? (el.value || 'on') : null;
  internals.setFormValue(subValue);
  validate(el, internals);
}

function validate(el, internals) {
  if (el.required && !el.checked) {
    internals.setValidity({ valueMissing: true }, 'You must check this box.');
  } else {
    internals.setValidity({});
  }
}
