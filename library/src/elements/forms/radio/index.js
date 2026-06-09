/**
 * src/elements/forms/radio/index.js
 *
 * Form Control: <ui-radio>
 * Standard-compliant form-participating radio selection element. Cooperatively
 * coordinates selections within scopes sharing a `name` attribute.
 *
 * Source: doc 04 — Web Components §9, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-radio', {
  style: './style.css',
  template: './index.html',
  form: true,
  props: {
    checked: { type: Boolean, reflect: true, state: true },
    disabled: { type: Boolean, reflect: true, state: true },
    name: { type: String, reflect: true },
    value: { type: String, reflect: true }
  },
  mount({ el, internals, on }) {
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }
    if (!el.hasAttribute('role')) {
      el.setAttribute('role', 'radio');
    }

    on.click(el, (e) => {
      if (el.disabled || el.checked) return;
      e.preventDefault();
      el.checked = true;
    });

    on.keydown(el, (e) => {
      if (el.disabled || el.checked) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        el.checked = true;
      }
    });

    syncAttributes(el, internals);
  },
  update({ el, name, val, internals }) {
    if (name === 'checked' || name === 'disabled') {
      syncAttributes(el, internals);
      if (name === 'checked' && el.checked) {
        uncheckOthers(el);
      }
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
      el.setAttribute('tabindex', '0');
    }
    syncAttributes(el, internals);
  }
}, import.meta.url);

function syncAttributes(el, internals) {
  const checked = el.checked;
  const disabled = el.disabled;

  if (checked) {
    internals.states.add('checked');
    el.setAttribute('aria-checked', 'true');
  } else {
    internals.states.delete('checked');
    el.setAttribute('aria-checked', 'false');
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
}

function uncheckOthers(el) {
  const name = el.name;
  if (!name) return;

  // Find and query all other radio components in the same root node sharing the same name
  const root = el.getRootNode();
  const radios = Array.from(root.querySelectorAll(`ui-radio[name="${name}"]`));

  for (const radio of radios) {
    if (radio !== el && radio.checked) {
      radio.checked = false;
      radio.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  }
}
