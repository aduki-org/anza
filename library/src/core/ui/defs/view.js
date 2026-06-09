/**
 * src/core/ui/defs/view.js
 *
 * `view(tag, config, base)` — a composable, stateful Web Component with no
 * route and no container-graph presence. The router never touches it directly.
 * A `page` is a `view` that also owns a URL.
 *
 * Source: definations.md §5, tasks.md Phase 6
 */

import { element } from '../define/element.js';
import { translate } from './spec.js';

/**
 * @param {string} tag - custom element tag name (must contain a hyphen).
 * @param {object} config - view definition (props, template, on, methods).
 * @param {string} [base] - import.meta.url of the caller; required when
 *   template/style are file paths.
 */
export function view(tag, config, base) {
  const spec = translate(config, { visual: true });
  element(tag, spec, base);
}
