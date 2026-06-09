/**
 * src/elements/overlay/menu/index.js
 *
 * Overlay System: <ui-menu>
 * Anchor-able popover menu container implementing roving tabindex,
 * full keyboard menu navigation (arrows, Home, End), and WAI-ARIA role="menu" specifications.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §5
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-menu', {
  style: './style.css',
  template: './index.html',
  mount({ el, tags, on }) {
    const popover = tags.one('[popover]');
    const slot = tags.one('slot');

    on.slotchange(slot, () => {
      const items = getItems(tags);
      items.forEach((item, index) => {
        if (!item.hasAttribute('role')) {
          item.setAttribute('role', 'menuitem');
        }
        item.setAttribute('tabindex', index === 0 ? '0' : '-1');
      });
    });

    on.keydown(popover, (e) => {
      const items = getItems(tags);
      if (items.length === 0) return;

      const focusedIndex = parseInt(el.dataset.focusedIndex || '0', 10);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusItem(el, tags, focusedIndex + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusItem(el, tags, focusedIndex - 1);
          break;
        case 'Home':
          e.preventDefault();
          focusItem(el, tags, 0);
          break;
        case 'End':
          e.preventDefault();
          focusItem(el, tags, items.length - 1);
          break;
        case 'Escape':
          e.preventDefault();
          hide(el, tags);
          break;
      }
    });
  },
  methods: {
    show({ el, tags }) {
      tags.one('[popover]').showPopover();
      focusItem(el, tags, 0);
    },
    hide({ tags }) {
      tags.one('[popover]').hidePopover();
    },
    toggle({ el, tags }) {
      const popover = tags.one('[popover]');
      if (popover.matches(':popover-open')) {
        hide(el, tags);
      } else {
        this.show({ el, tags });
      }
    }
  }
}, import.meta.url);

function getItems(tags) {
  const slot = tags.one('slot');
  return slot.assignedElements().filter((el) => {
    const tag = el.tagName.toLowerCase();
    return tag === 'ui-button' || tag === 'button' || el.getAttribute('role') === 'menuitem';
  });
}

function focusItem(el, tags, index) {
  const items = getItems(tags);
  if (items.length === 0) return;

  // Boundary wrap protection
  const focusedIndex = (index + items.length) % items.length;
  el.dataset.focusedIndex = focusedIndex;

  items.forEach((item, idx) => {
    if (idx === focusedIndex) {
      item.setAttribute('tabindex', '0');
      item.focus();
    } else {
      item.setAttribute('tabindex', '-1');
    }
  });
}

function hide(el, tags) {
  tags.one('[popover]').hidePopover();
}
