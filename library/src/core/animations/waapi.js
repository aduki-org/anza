/**
 * src/core/animations/waapi.js
 *
 * WAAPI Easing Curves and Keyframe Helpers.
 * Easing curves and durations are sourced from the CSS motion tokens
 * (`--ease-*`, `--duration-*`) via ./tokens.js, so JS animations and CSS share a
 * single source of truth. Values fall back to the token defaults when the
 * document is unavailable.
 *
 * Source: doc 03 — Native CSS Architecture §6, doc 12 — Performance §4
 */

import { duration as durationToken, ease } from './tokens.js';

/**
 * Named easing curves. CSS keywords are returned verbatim; the curated curves
 * resolve to the matching `--ease-*` motion token at access time.
 */
export const Timing = {
  EASE: 'ease',
  EASE_IN: 'ease-in',
  EASE_OUT: 'ease-out',
  EASE_IN_OUT: 'ease-in-out',
  LINEAR: 'linear',
  get DEFAULT() { return ease('default'); },
  get SMOOTH() { return ease('default'); },
  get FAST() { return ease('out'); },
  get SOFT() { return ease('in-out'); },
  get BOUNCE() { return ease('spring'); },
  get SPRING() { return ease('spring'); }
};

/**
 * Convenience helper to format WAAPI timing descriptors. Duration defaults to the
 * `--duration-normal` token; easing defaults to the `--ease-default` token.
 */
export function timing(duration = durationToken('normal'), easing = ease('default'), fill = 'both') {
  return { duration, easing, fill };
}

/**
 * Builds keyframe arrays for common transition templates.
 * Types: fade, slide, scale, zoom, blur.
 */
export function keyframes(type, options = {}) {
  if (type === 'fade') {
    return [
      { opacity: options.from ?? 0 },
      { opacity: options.to ?? 1 }
    ];
  }

  if (type === 'slide') {
    const axis = options.axis ?? 'y';
    const amount = options.from ?? '20px';
    const transformFrom = axis === 'x' ? `translateX(${amount})` : `translateY(${amount})`;

    return [
      { transform: transformFrom, opacity: 0 },
      { transform: 'translate(0, 0)', opacity: 1 }
    ];
  }

  if (type === 'scale') {
    return [
      { transform: `scale(${options.from ?? 0.95})`, opacity: 0 },
      { transform: 'scale(1)', opacity: 1 }
    ];
  }

  if (type === 'zoom') {
    return [
      { transform: `scale(${options.from ?? 1.1})`, opacity: 0 },
      { transform: 'scale(1)', opacity: 1 }
    ];
  }

  if (type === 'blur') {
    return [
      { filter: `blur(${options.from ?? '8px'})`, opacity: 0 },
      { filter: 'blur(0)', opacity: 1 }
    ];
  }

  return [];
}
