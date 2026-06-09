/**
 * src/elements/forms/select/index.js
 *
 * Form Control: <ui-select>
 * Form-participating dropdown selector utilizing the native Popover API
 * and Anchor Positioning for premium overlay layout.
 *
 * Source: doc 04 — Web Components §9, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-select', {
  style: './style.css',
  template: './index.html',
  form: true,
  props: {
    value: { type: String, reflect: true },
    placeholder: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true, state: true },
    required: { type: Boolean, reflect: true }
  },
  mount({ el, internals, tags, on, watch }) {
    const slot = tags.one('slot');
    const trigger = tags.one('#trigger');
    const popover = tags.one('#dropdown');

    on.slotchange(slot, () => {
      const nodes = slot.assignedElements();
      for (const node of nodes) {
        on.click(node, (e) => {
          const target = e.currentTarget;
          const val = target.getAttribute('value') || target.textContent.trim();
          el.value = val;
          popover.hidePopover();
        });
      }
      syncValue(el, tags, internals);
    });

    // Anchor positioning polyfill fallback where needed
    if (!('anchorName' in document.documentElement.style)) {
      on.toggle(popover, (e) => {
        if (e.newState === 'open') {
          const rect = trigger.getBoundingClientRect();
          popover.style.top = `${rect.bottom + window.scrollY}px`;
          popover.style.left = `${rect.left + window.scrollX}px`;
          popover.style.width = `${rect.width}px`;
        }
      });
    }

    syncAttributes(el, tags, internals);
  },
  update({ el, name, val, tags, internals }) {
    if (name === 'disabled' || name === 'value' || name === 'placeholder') {
      syncAttributes(el, tags, internals);
    }
  },
  formResetCallback({ el, tags, internals }) {
    el.value = el.getAttribute('value') || '';
    syncAttributes(el, tags, internals);
  },
  formDisabledCallback({ el, tags, internals, disabled }) {
    const trigger = tags.one('#trigger');
    trigger.disabled = disabled;
    syncAttributes(el, tags, internals);
  }
}, import.meta.url);

function syncAttributes(el, tags, internals) {
  const trigger = tags.one('#trigger');
  const disabled = el.disabled;

  trigger.disabled = disabled;

  syncValue(el, tags, internals);
}

function syncValue(el, tags, internals) {
  const slot = tags.one('slot');
  const nodes = slot.assignedElements();
  const val = el.value;
  const label = tags.one('#selected-label');

  let selectedNode = null;
  for (const node of nodes) {
    const nodeVal = node.getAttribute('value') || node.textContent.trim();
    if (nodeVal === val) {
      node.setAttribute('selected', '');
      selectedNode = node;
    } else {
      node.removeAttribute('selected');
    }
  }

  if (selectedNode) {
    label.textContent = selectedNode.textContent.trim();
  } else {
    label.textContent = el.placeholder || 'Select option...';
  }

  internals.setFormValue(val || '');
  validate(el, internals);
}

function validate(el, internals) {
  const val = el.value;
  if (el.required && !val) {
    internals.setValidity({ valueMissing: true }, 'Please select an option.');
  } else {
    internals.setValidity({});
  }
}
