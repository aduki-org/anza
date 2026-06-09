/**
 * src/elements/navigation/tabs/index.js
 *
 * Navigation System: <ui-tabs>
 * Roving-tabindex, keyboard-accessible (Left/Right arrows, Home, End),
 * and URL-sync capable tab container matching complete WAI-ARIA tablist structures.
 *
 * Source: doc 04 — Web Components §3, doc 05 — Native UI Primitives §3
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-tabs', {
  style: './style.css',
  template: './index.html',
  props: {
    active: { type: String, reflect: true }
  },
  mount({ el, tags, on }) {
    const tablist = tags.one('.tablist');
    const tabSlot = tags.one('slot[name="tab"]');

    on.slotchange(tabSlot, () => {
      const tabs = getTabs(tags);
      tabs.forEach((tab, index) => {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
        on.click(tab, (e) => {
          const tab = e.currentTarget;
          const value = tab.getAttribute('value') || tab.textContent.trim();
          el.active = value;
        });
      });
      syncTabs(el, tags);
    });

    on.keydown(tablist, (e) => {
      const tabs = getTabs(tags);
      if (tabs.length === 0) return;

      const focusedIndex = getFocusedIndex(el);

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          focusTab(el, tags, focusedIndex + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          focusTab(el, tags, focusedIndex - 1);
          break;
        case 'Home':
          e.preventDefault();
          focusTab(el, tags, 0);
          break;
        case 'End':
          e.preventDefault();
          focusTab(el, tags, tabs.length - 1);
          break;
      }
    });

    syncTabs(el, tags);
  },
  update({ el, tags }) {
    syncTabs(el, tags);
  }
}, import.meta.url);

function getTabs(tags) {
  const slot = tags.one('slot[name="tab"]');
  return slot.assignedElements();
}

function getPanels(tags) {
  const slot = tags.one('slot:not([name])');
  return slot.assignedElements().filter(el => el.getAttribute('role') === 'tabpanel' || el.tagName.toLowerCase() === 'ui-tab-panel');
}

function syncTabs(el, tags) {
  const active = el.active;
  const tabs = getTabs(tags);
  const panels = getPanels(tags);

  if (tabs.length === 0) return;

  let activeIndex = 0;
  tabs.forEach((tab, idx) => {
    const tabVal = tab.getAttribute('value') || tab.textContent.trim();
    const isSelected = active ? tabVal === active : idx === 0;

    tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    tab.setAttribute('tabindex', isSelected ? '0' : '-1');

    if (isSelected) {
      activeIndex = idx;
    }
  });

  el.dataset.focusedIndex = activeIndex;

  panels.forEach((panel, idx) => {
    if (idx === activeIndex) {
      panel.classList.add('active');
      panel.setAttribute('aria-hidden', 'false');
    } else {
      panel.classList.remove('active');
      panel.setAttribute('aria-hidden', 'true');
    }
  });
}

function getFocusedIndex(el) {
  return parseInt(el.dataset.focusedIndex || '0', 10);
}

function focusTab(el, tags, index) {
  const tabs = getTabs(tags);
  if (tabs.length === 0) return;

  const focusedIndex = (index + tabs.length) % tabs.length;
  el.dataset.focusedIndex = focusedIndex;
  const targetTab = tabs[focusedIndex];

  tabs.forEach((tab, idx) => {
    tab.setAttribute('tabindex', idx === focusedIndex ? '0' : '-1');
  });

  targetTab.focus();
  const value = targetTab.getAttribute('value') || targetTab.textContent.trim();
  el.active = value;
}
