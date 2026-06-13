/**
 * src/elements/forms/input/index.js
 *
 * Form Control: <ui-input>
 * Form-participating text/number/email/password input control using ElementInternals
 * for seamless integration with native form submission and validation.
 *
 * Source: doc 04 — Web Components §9, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-input', {
  style: './style.css',
  template: './index.html',
  form: true,
  props: {
    type: { type: String, reflect: true, default: 'text' },
    value: { type: String, reflect: true },
    placeholder: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true, state: true },
    required: { type: Boolean, reflect: true },
    minlength: { type: Number, reflect: true },
    maxlength: { type: Number, reflect: true },
    min: { type: Number, reflect: true },
    max: { type: Number, reflect: true },
    pattern: { type: String, reflect: true }
  },
  mount({ el, internals, tags, on }) {
    const input = tags.one('input');

    // Bind change and input event listeners
    on.input('input', () => {
      el.value = input.value;
      validate(el, internals, input);
    });

    on.change('input', () => {
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });

    syncAttributes(el, tags);
  },
  update({ el, name, val, tags, internals }) {
    const input = tags.one('input');

    if (name === 'disabled') {
      input.disabled = !!val;
    } else if (name === 'value') {
      input.value = val || '';
    } else if (['type', 'placeholder', 'required', 'minlength', 'maxlength', 'min', 'max', 'pattern'].includes(name)) {
      if (val !== null && val !== undefined) {
        input.setAttribute(name, val);
      } else {
        input.removeAttribute(name);
      }
    }

    validate(el, internals, input);
  },
  formResetCallback({ el, tags }) {
    el.value = el.getAttribute('value') || '';
    const input = tags.one('input');
    input.value = el.value;
  },
  formDisabledCallback({ el, tags, disabled }) {
    const input = tags.one('input');
    input.disabled = disabled;
  }
}, import.meta.url);

function syncAttributes(el, tags) {
  const input = tags.one('input');
  const disabled = el.disabled;

  // Proxy observed attributes down to native input inside Shadow DOM
  const attrs = ['type', 'placeholder', 'required', 'minlength', 'maxlength', 'min', 'max', 'pattern'];
  for (const attr of attrs) {
    const val = el[attr];
    if (val !== null && val !== undefined) {
      input.setAttribute(attr, val);
    } else {
      input.removeAttribute(attr);
    }
  }

  input.disabled = disabled;
  input.value = el.value || '';
}

function validate(el, internals, input) {
  const val = input.value;

  internals.setFormValue(val);

  // Check validation and delegate state to ElementInternals
  if (!input.validity.valid) {
    internals.setValidity(input.validity, input.validationMessage, input);
  } else {
    internals.setValidity({});
  }
}
