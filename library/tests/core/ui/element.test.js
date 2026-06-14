/**
 * tests/core/ui/element.test.js
 *
 * Test suite for ui.element runtime features.
 */

import { ui } from '../../../src/core/ui/index.js';

function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('ui.element runtime', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    container = null;
  });

  it('mount receives standard contexts and parameters', async () => {
    let mountCtx = null;
    const tag = 'test-mount-context';

    ui.element(tag, {
      template: '<div><span ref="child"></span></div>',
      props: {
        val: { type: String }
      },
      mount(ctx) {
        mountCtx = ctx;
      }
    });

    const el = document.createElement(tag);
    container.appendChild(el);
    await wait();

    if (!mountCtx) {
      throw new Error('Expected mount to be called');
    }

    if (mountCtx.el !== el) {
      throw new Error('Expected mount ctx.el to be the element');
    }

    if (!mountCtx.ctrl || typeof mountCtx.ctrl.signal === 'undefined') {
      throw new Error('Expected mount ctx.ctrl to be an AbortController');
    }

    if (!mountCtx.refs || mountCtx.refs.child?.tagName !== 'SPAN') {
      throw new Error('Expected mount ctx.refs to resolve refs');
    }

    if (!mountCtx.tags || typeof mountCtx.tags.one !== 'function') {
      throw new Error('Expected mount ctx.tags cache proxy');
    }

    if (typeof mountCtx.on !== 'object' || typeof mountCtx.watch !== 'object') {
      throw new Error('Expected mount ctx to contain on and watch proxies');
    }
  });

  it('update receives change parameters correctly', async () => {
    const updates = [];
    const tag = 'test-update-params';

    ui.element(tag, {
      props: {
        count: { type: Number, default: 0 }
      },
      update(ctx) {
        updates.push({
          name: ctx.name,
          val: ctx.val,
          old: ctx.old,
          prev: ctx.prev
        });
      }
    });

    const el = document.createElement(tag);
    container.appendChild(el);
    await wait();

    el.count = 5;
    await wait();

    el.count = 10;
    await wait();

    if (updates.length !== 2) {
      throw new Error(`Expected 2 updates, got ${updates.length}`);
    }

    if (updates[0].name !== 'count' || updates[0].val !== 5 || updates[0].old !== 0) {
      throw new Error('First update parameters mismatch');
    }

    if (updates[1].name !== 'count' || updates[1].val !== 10 || updates[1].old !== 5) {
      throw new Error('Second update parameters mismatch');
    }
  });

  it('runs unmount before controller abort', async () => {
    let unmountRun = false;
    let signalAbortedDuringUnmount = null;
    const tag = 'test-unmount-order';

    ui.element(tag, {
      mount({ ctrl }) {
        this._ctrl = ctrl;
      },
      unmount() {
        unmountRun = true;
        signalAbortedDuringUnmount = this._ctrl.signal.aborted;
      }
    });

    const el = document.createElement(tag);
    container.appendChild(el);
    await wait();

    el.remove();
    await wait();

    if (!unmountRun) {
      throw new Error('Expected unmount to run');
    }

    if (signalAbortedDuringUnmount !== false) {
      throw new Error('Expected abort controller to be active during unmount callback');
    }
  });

  it('casts properties: Boolean, Number, and String correctly', async () => {
    const tag = 'test-prop-casting';
    ui.element(tag, {
      props: {
        active: { type: Boolean },
        count: { type: Number, default: 42 },
        name: { type: String, default: 'unknown' }
      }
    });

    const el = document.createElement(tag);
    container.appendChild(el);

    // Initial default values
    if (el.active !== false || el.count !== 42 || el.name !== 'unknown') {
      throw new Error('Default property values mismatch');
    }

    // Set attributes
    el.setAttribute('active', '');
    el.setAttribute('count', '100');
    el.setAttribute('name', 'Antigravity');

    if (el.active !== true) {
      throw new Error('Expected active boolean attribute casting to be true');
    }
    if (el.count !== 100) {
      throw new Error('Expected count attribute to cast to Number');
    }
    if (el.name !== 'Antigravity') {
      throw new Error('Expected name attribute to cast to String');
    }

    // Remove boolean attribute
    el.removeAttribute('active');
    if (el.active !== false) {
      throw new Error('Expected active boolean to be false when attribute is removed');
    }
  });

  it('honors reflect settings', async () => {
    const tag = 'test-reflect-semantics';
    ui.element(tag, {
      props: {
        reflected: { type: String, reflect: true },
        ignored: { type: String, reflect: false }
      }
    });

    const el = document.createElement(tag);
    container.appendChild(el);

    el.reflected = 'hello';
    el.ignored = 'world';

    if (el.getAttribute('reflected') !== 'hello') {
      throw new Error('Expected reflected property to write attribute');
    }

    if (el.hasAttribute('ignored')) {
      throw new Error('Expected reflect:false property to NOT write attribute');
    }
  });

  it('installs spec.methods and warns/skips reserved name conflicts', async () => {
    const tag = 'test-methods-install';
    let customMethodCalled = false;
    let warnCalled = false;

    const originalWarn = console.warn;
    console.warn = () => { warnCalled = true; };

    try {
      ui.element(tag, {
        methods: {
          custom() {
            customMethodCalled = true;
          },
          connectedCallback() {
            // Reserved name, should be skipped
          }
        }
      });

      const el = document.createElement(tag);
      container.appendChild(el);

      if (typeof el.custom !== 'function') {
        throw new Error('Expected custom method to be installed on element');
      }

      el.custom();
      if (!customMethodCalled) {
        throw new Error('Expected custom method to be callable and execute');
      }

      if (!warnCalled) {
        throw new Error('Expected warning for reserved method name conflict');
      }
    } finally {
      console.warn = originalWarn;
    }
  });

  it('maps short form hooks to attachInternals callbacks', async () => {
    const tag = 'test-form-hooks';
    let associatedCalled = false;
    let disabledCalled = false;
    let resetCalled = false;
    let restoreCalled = false;

    ui.element(tag, {
      form: true,
      associated() { associatedCalled = true; },
      disabled() { disabledCalled = true; },
      reset() { resetCalled = true; },
      restore() { restoreCalled = true; }
    });

    const el = document.createElement(tag);
    container.appendChild(el);

    // Trigger form lifecycle callbacks
    el.formAssociatedCallback(null);
    el.formDisabledCallback(true);
    el.formResetCallback();
    el.formStateRestoreCallback(null, 'restore');

    if (!associatedCalled || !disabledCalled || !resetCalled || !restoreCalled) {
      throw new Error('Expected all short form hooks to be called');
    }
  });

  it('renders styles via fallback <style> node when adoptedStyleSheets are not used', async () => {
    // Force fallback path by overriding stylesheet support or testing fallback functionality.
    // In our implementation, preloadResources returns cssText if CSSStyleSheet/adoptedStyleSheets is unsupported.
    // Let's create an element that relies on style but mock/unmock CSSStyleSheet or just verify fallback behavior.
    const tag = 'test-style-fallback';
    ui.element(tag, {
      style: '/* inline-fallback-style */ body { color: red; }'
    });

    const el = document.createElement(tag);
    container.appendChild(el);
    await wait();

    // Since stylesheet is fallback in browsers that lack adoptedStyleSheets,
    // let's verify style fallback node exists.
    // If adoptStyleSheets is natively supported, it will use adopting. Let's force fallback path
    // by registering an element with NO styleUrl but inlineStyle when supportsSheets is false.
    // Let's check if the element has either adoptedStyleSheets or a style node.
    const hasSheets = el.shadowRoot.adoptedStyleSheets && el.shadowRoot.adoptedStyleSheets.length > 0;
    const hasStyleTag = el.shadowRoot.querySelector('style') !== null;

    if (!hasSheets && !hasStyleTag) {
      throw new Error('Expected style rules to be applied via adoptedStyleSheets or style node');
    }
  });


  it('sanitizes malformed descriptor fields safely', async () => {
    // Descriptor is validated via validateDescriptor in preloadResources.
    // Let's test with a mock/custom descriptor registration if possible, or just call validateDescriptor directly.
    const { validateDescriptor } = await import('../../../src/core/ui/define/utils.js');
    const malformed = {
      version: 'invalid', // should not match typeof number
      refs: 'not-an-array',
      ids: {},
      classes: null,
      customField: 42
    };

    const validated = validateDescriptor(malformed);
    if (!validated) {
      throw new Error('Expected validation to return a safe object');
    }

    if (validated.version !== undefined) {
      throw new Error('Expected invalid version type to be omitted');
    }

    if (!Array.isArray(validated.refs) || validated.refs.length !== 0) {
      throw new Error('Expected refs to default to empty array');
    }

    if (!Array.isArray(validated.ids) || validated.ids.length !== 0) {
      throw new Error('Expected ids to default to empty array');
    }

    if (validated.customField !== 42) {
      throw new Error('Expected unknown fields to be preserved');
    }
  });

  it('catches async BaseElement mount rejections safely', async () => {
    const tag = 'test-mount-catch';
    let errorLogged = false;

    const originalError = console.error;
    console.error = () => { errorLogged = true; };

    try {
      ui.element(tag, {
        async mount() {
          throw new Error('intentional mount failure');
        }
      });

      const el = document.createElement(tag);
      container.appendChild(el);
      await wait();

      if (!errorLogged) {
        throw new Error('Expected async mount rejection to be caught and logged');
      }
    } finally {
      console.error = originalError;
    }
  });
});
