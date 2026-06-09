/**
 * src/elements/forms/textarea/index.js
 *
 * Form Control: <ui-textarea>
 * Form-participating multi-line text area supporting validation,
 * custom disabled states, and dynamic auto-resizing.
 *
 * Source: doc 04 — Web Components §9, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-textarea', {
  style: './style.css',
  template: './index.html',
  form: true,
  props: {
    value: { type: String, reflect: true },
    placeholder: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true, state: true },
    required: { type: Boolean, reflect: true },
    minlength: { type: Number, reflect: true },
    maxlength: { type: Number, reflect: true },
    autoresize: { type: Boolean, reflect: true },
    rows: { type: Number, reflect: true }
  },
  mount({ el, internals, tags, on, watch }) {
    const area = tags.one('textarea');

    on.input('textarea', () => {
      el.value = area.value;
      resize(el, area);
      validate(el, internals, area);
    });

    on.change('textarea', () => {
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });

    // Auto-resizing ResizeObserver setup
    const observer = new ResizeObserver(() => resize(el, area));
    observer.observe(area);
    el.ctrl.signal.addEventListener('abort', () => observer.disconnect());

    syncAttributes(el, tags);
  },
  update({ el, name, val, tags, internals }) {
    const area = tags.one('textarea');

    if (name === 'disabled') {
      area.disabled = !!val;
    } else if (name === 'value') {
      area.value = val || '';
    } else if (['placeholder', 'required', 'minlength', 'maxlength', 'rows'].includes(name)) {
      if (val !== null && val !== undefined) {
        area.setAttribute(name, val);
      } else {
        area.removeAttribute(name);
      }
    }

    resize(el, area);
    validate(el, internals, area);
  },
  unmount({ el }) {
    // ResizeObserver is cleaned up via AbortSignal in mount
  },
  formResetCallback({ el, tags }) {
    el.value = el.getAttribute('value') || '';
    const area = tags.one('textarea');
    area.value = el.value;
  },
  formDisabledCallback({ el, tags, disabled }) {
    const area = tags.one('textarea');
    area.disabled = disabled;
  }
}, import.meta.url);

function syncAttributes(el, tags) {
  const area = tags.one('textarea');
  const disabled = el.disabled;

  const attrs = ['placeholder', 'required', 'minlength', 'maxlength', 'rows'];
  for (const attr of attrs) {
    const val = el[attr];
    if (val !== null && val !== undefined) {
      area.setAttribute(attr, val);
    } else {
      area.removeAttribute(attr);
    }
  }

  area.disabled = disabled;
  area.value = el.value || '';

  resize(el, area);
}

function resize(el, area) {
  if (!el.autoresize) return;
  area.style.height = 'auto';
  area.style.height = `${area.scrollHeight}px`;
}

function validate(el, internals, area) {
  const val = area.value;

  internals.setFormValue(val);

  if (!area.validity.valid) {
    internals.setValidity(area.validity, area.validationMessage, area);
  } else {
    internals.setValidity({});
  }
}
