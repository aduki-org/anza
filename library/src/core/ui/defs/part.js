/**
 * src/core/ui/defs/part.js
 *
 * `part(tag, config, base)` — an atomic, stateless UI primitive (buttons,
 * icons, badges, chips). Configurable through props, but carries no reactive
 * `on.change` re-render loop. If you reach for `on.change`, promote to a `view`.
 *
 * Source: definations.md §6, tasks.md Phase 6
 */

import { element } from '../define/element.js';
import { translate } from './spec.js';

/**
 * @param {string} tag - custom element tag name (must contain a hyphen).
 * @param {object} config - part definition (props, template, optional on.connect).
 * @param {string} [base] - import.meta.url of the caller; required when
 *   template/style are file paths.
 */
export function part(tag, config, base) {
  if (config?.on?.change) {
    console.warn(`[Native UI] <${tag}> is a 'part' but declares on.change. Parts are stateless — promote it to a 'view' if it needs reactive re-rendering.`);
  }
  const spec = translate(config);
  // Parts never run a reactive update loop, even if on.change slipped through.
  delete spec.update;
  element(tag, spec, base);
}
