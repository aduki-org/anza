/**
 * src/elements/forms/form/index.js
 *
 * Form Orchestrator: <ui-form>
 * Wraps form controls and handles accessible native form submission,
 * validation tracking, and automatic offline background sync queue buffering.
 *
 * Source: doc 04 — Web Components §9, doc 13 — Offline and Background §5
 */

import { ui } from '../../../core/ui/index.js';
import { check } from '../../../core/offline/connectivity.js';
import { queue } from '../../../core/offline/queue.js';
import { pipeline } from '../../../core/api/pipeline.js';

ui.element('ui-form', {
  style: './style.css',
  template: './index.html',
  props: {
    action: { type: String, reflect: true },
    method: { type: String, reflect: true },
    offline: { type: Boolean, reflect: true }
  },
  mount({ el, tags, on }) {
    const form = tags.one('form');

    on.submit(form, async (e) => {
      e.preventDefault();

      const action = el.action || window.location.href;
      const method = (el.method || 'POST').toUpperCase();

      // 1. Gather all form-associated inputs under this form subtree
      const controls = Array.from(el.querySelectorAll('*')).filter(
        (ctrl) => ctrl.constructor.formAssociated
      );

      // 2. Validate all active elements using standard validation routines
      let isValid = true;
      for (const ctrl of controls) {
        if (typeof ctrl.reportValidity === 'function' && !ctrl.reportValidity()) {
          isValid = false;
        }
      }

      if (!isValid) {
        el.dispatchEvent(new CustomEvent('invalid', { bubbles: true, composed: true }));
        return;
      }

      // 3. Serialize all elements values into form data
      const payload = {};
      for (const ctrl of controls) {
        const name = ctrl.getAttribute('name');
        if (name) {
          payload[name] = ctrl.value;
        }
      }

      el.dispatchEvent(new CustomEvent('submit-start', { detail: { payload }, bubbles: true, composed: true }));

      // 4. Verify connectivity using network connectivity HEAD probes
      const online = await check();

      if (!online && el.offline) {
        // Offline mode: push into background sync queue
        try {
          const syncId = await queue.push('offline-form-submit', {
            url: action,
            method,
            headers: { 'Content-Type': 'application/json' },
            body: payload
          });

          // Register standard browser SyncManager tag if available
          if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg.sync) {
              await reg.sync.register('pending');
            }
          }

          el.dispatchEvent(new CustomEvent('offline-queued', { detail: { syncId, payload }, bubbles: true, composed: true }));
        } catch (err) {
          el.dispatchEvent(new CustomEvent('submit-error', { detail: err, bubbles: true, composed: true }));
        }
        return;
      }

      // Online mode: submit directly via our fetch API networking clients pipelines
      try {
        const res = await pipeline(action, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: el.ctrl.signal
        });

        el.dispatchEvent(new CustomEvent('success', { detail: res, bubbles: true, composed: true }));
      } catch (err) {
        el.dispatchEvent(new CustomEvent('submit-error', { detail: err, bubbles: true, composed: true }));
      }
    });

    syncAttributes(el, tags);
  },
  update({ el, name, tags }) {
    if (name === 'action' || name === 'method') {
      syncAttributes(el, tags);
    }
  }
}, import.meta.url);

function syncAttributes(el, tags) {
  const form = tags.one('form');
  if (el.action) {
    form.setAttribute('action', el.action);
  }
  if (el.method) {
    form.setAttribute('method', el.method);
  }
}
