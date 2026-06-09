/**
 * src/elements/overlay/dialog/index.js
 *
 * Overlay System: <ui-dialog>
 * Premium dialog overlay wrapping native browser <dialog> for zero-cost
 * focus traps, light backdrops, Escape dismissals, and modal lifecycles.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §5
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-dialog', {
  style: './style.css',
  template: './index.html',
  props: {
    open: { type: Boolean, reflect: true }
  },
  mount({ el, tags, on }) {
    const dialog = tags.one('dialog');

    // Sync close and cancel events from native dialog
    on.close(dialog, () => {
      el.open = false;
      el.dispatchEvent(new CustomEvent('close', {
        detail: { returnValue: dialog.returnValue },
        bubbles: true,
        composed: true
      }));
    });

    on.cancel(dialog, (e) => {
      const cancelEvent = new CustomEvent('cancel', {
        bubbles: true,
        composed: true,
        cancelable: true
      });
      el.dispatchEvent(cancelEvent);
      if (cancelEvent.defaultPrevented) {
        e.preventDefault();
      }
    });
  },
  methods: {
    showModal({ el, tags }) {
      const dialog = tags.one('dialog');
      dialog.showModal();
      el.open = true;
      el.dispatchEvent(new CustomEvent('show', { bubbles: true, composed: true }));
    },
    close({ el, tags }, returnValue = '') {
      const dialog = tags.one('dialog');
      dialog.close(returnValue);
      el.open = false;
    }
  }
}, import.meta.url);
