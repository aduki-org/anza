/**
 * src/elements/feedback/skeleton/index.js
 *
 * Feedback Element: <ui-skeleton>
 * Premium skeleton placeholder container utilizing the Web Animations API (WAAPI)
 * for smooth off-thread opacity shimmers, respecting prefers-reduced-motion.
 *
 * Source: doc 04 — Web Components §3, doc 12 — Performance §5
 */

import { ui } from '../../../core/ui/index.js';

ui.element('ui-skeleton', {
  style: './style.css',
  template: './index.html',
  props: {
    variant: { type: String, reflect: true },
    width: { type: String, reflect: true },
    height: { type: String, reflect: true }
  },
  mount({ el, tags, on }) {
    const shimmer = tags.one('.shimmer');

    // ARIA roles assignment
    if (!el.hasAttribute('aria-hidden')) {
      el.setAttribute('aria-hidden', 'true');
    }

    // High performance off-thread WAAPI shimmer animation
    const animation = shimmer.animate(
      [
        { opacity: 0.4 },
        { opacity: 0.85 },
        { opacity: 0.4 }
      ],
      {
        duration: 1500,
        iterations: Infinity,
        easing: 'ease-in-out'
      }
    );

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    handleMotion(animation, motionQuery);

    motionQuery.addEventListener('change', (e) => handleMotion(animation, e), { signal: el.ctrl.signal });

    syncAttributes(el);
  },
  unmount({ el }) {
    // Animation is cleaned up via AbortSignal in mount
  },
  update({ el }) {
    syncAttributes(el);
  }
}, import.meta.url);

function syncAttributes(el) {
  if (el.width) {
    el.style.setProperty('--skeleton-width', el.width.includes('px') || el.width.includes('%') || el.width.includes('rem') ? el.width : `var(--space-${el.width})`);
  } else {
    el.style.removeProperty('--skeleton-width');
  }

  if (el.height) {
    el.style.setProperty('--skeleton-height', el.height.includes('px') || el.height.includes('%') || el.height.includes('rem') ? el.height : `var(--space-${el.height})`);
  } else {
    el.style.removeProperty('--skeleton-height');
  }
}

function handleMotion(animation, e) {
  if (e.matches) {
    animation.pause();
  } else {
    animation.play();
  }
}
