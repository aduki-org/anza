/**
 * src/elements/forms/toggle/index.js
 *
 * Form Control: <ui-toggle>
 * Form-participating Switch toggle element. Features standard switch ARIA roles,
 * custom :state(on) pseudo-classes, and beautiful slide animations.
 *
 * Source: doc 04 — Web Components §9, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-toggle', {
  style: './style.css',
  template: './index.html',
  form: true,
  props: {
    checked: { type: Boolean, reflect: true, state: 'on' },
    disabled: { type: Boolean, reflect: true, state: true },
    value: { type: String, reflect: true }
  },
  mount({ el, internals, on }) {
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }
    if (!el.hasAttribute('role')) {
      el.setAttribute('role', 'switch');
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
    if (name === 'checked' || name === 'disabled') {
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
      el.setAttribute('tabindex', '0');
    }
    syncAttributes(el, internals);
  }
}, import.meta.url);

function syncAttributes(el, internals) {
  const checked = el.checked;
  const disabled = el.disabled;

  if (checked) {
    internals.states.add('on');
    el.setAttribute('aria-checked', 'true');
  } else {
    internals.states.delete('on');
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
