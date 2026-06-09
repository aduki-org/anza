/**
 * src/core/ui/defs/spec.js
 *
 * Shared translator. Converts the declarative `page`/`dock`/`view`/`part`
 * config shape (from definations.md) into the lower-level `element()` spec
 * shape (element.js), so the four definition helpers reuse one battle-tested
 * custom-element factory instead of each re-implementing props, resources,
 * shadow DOM, and update batching.
 *
 * Config shape (definations.md):
 *   {
 *     tag, props, query, methods,
 *     template: { html, css, shadow },
 *     on: { load, connect, disconnect, change, ...helpers }
 *   }
 *
 * Source: tasks.md Phase 6
 */

// Lifecycle hook names that map onto the factory's mount/unmount/update slots.
// Every other entry under `on` is installed as a plain instance method so a
// hook body can call `this.render()` etc.
const HOOKS = new Set(['load', 'connect', 'disconnect', 'change']);

/**
 * Collects the route-derived params currently set on an element, keyed by the
 * declared prop names. Used to hand `on.load`/`on.connect` a `{ params }` bag.
 */
function paramsOf(el, props) {
  const out = {};
  if (props) {
    for (const key of Object.keys(props)) out[key] = el[key];
  }
  return out;
}

/**
 * Translates a declarative definition config into an `element()` spec.
 *
 * @param {object} config - the page/dock/view/part config.
 * @param {object} [opts]
 * @param {boolean} [opts.visual=false] - route updates through rAF when true.
 * @returns {object} a spec consumable by element().
 */
export function translate(config, opts = {}) {
  const spec = {};
  const tpl = config.template ?? {};

  // Template + style + shadow mode. `element()` takes html/css as separate
  // string fields (inline source or a resolvable file path) and a shadow mode.
  if (tpl.html != null) spec.template = tpl.html;
  if (tpl.css != null) spec.style = tpl.css;
  spec.mode = tpl.shadow === 'closed' ? 'closed' : 'open';
  if (tpl.shadow === false) {
    console.warn('[Native UI] Light DOM (shadow: false) is not supported by the element factory; falling back to open shadow root.');
  }

  if (config.props) spec.props = config.props;
  if (config.form) spec.form = config.form;
  if (config.query) spec.query = config.query;

  // Install all `on` entries (helpers + hooks) and explicit `methods` as
  // instance methods, so a hook body can call `this.<helper>()`.
  const on = config.on ?? {};
  const methods = { ...config.methods };
  for (const [name, fn] of Object.entries(on)) {
    if (typeof fn === 'function') methods[name] = fn;
  }
  if (Object.keys(methods).length) spec.methods = methods;

  // Map lifecycle hooks onto the factory's slots, invoking each with
  // `this` bound to the element and the lifecycle context as the argument.
  if (on.load || on.connect) {
    spec.mount = async (ctx) => {
      const el = ctx.el;
      if (on.load) {
        await on.load.call(el, { params: paramsOf(el, config.props), ...ctx });
      }
      if (on.connect) {
        await on.connect.call(el, ctx);
      }
    };
  }

  if (on.disconnect) {
    spec.unmount = (ctx) => on.disconnect.call(ctx.el, ctx);
  }

  if (on.change) {
    const update = (ctx) => on.change.call(ctx.el, ctx);
    if (opts.visual) update.visual = true;
    spec.update = update;
  }

  return spec;
}
